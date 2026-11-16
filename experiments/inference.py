"""Actual CPU model inference. Run --check before downloading weights.

Run records (model version, config, sampling, timing) are written as JSON
next to stdout so the experiment task runner can archive reproducible logs.
"""
import argparse
import json
import os
import platform
import sys
import time


def write_record(path, record):
    if not path:
        return
    os.makedirs(os.path.dirname(os.path.abspath(path)) or ".", exist_ok=True)
    with open(path, "w", encoding="utf-8") as handle:
        json.dump(record, handle, ensure_ascii=False, indent=2)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true")
    parser.add_argument(
        "--prompt",
        default="Explain what a language model does in one sentence.",
    )
    parser.add_argument("--max-new-tokens", type=int, default=80)
    parser.add_argument("--seed", type=int, default=0)
    parser.add_argument("--sample", action="store_true",
                        help="Enable sampling instead of greedy decoding.")
    parser.add_argument("--json-out", default="",
                        help="Write a machine-readable run record to this path.")
    args = parser.parse_args()
    record = {
        "script": "experiments/inference.py",
        "mode": "local-compute",
        "python": sys.version.split()[0],
        "platform": platform.platform(),
        "config": {
            "model_id": "HuggingFaceTB/SmolLM2-135M-Instruct",
            "prompt": args.prompt,
            "max_new_tokens": args.max_new_tokens,
            "sampling": bool(args.sample),
            "seed": args.seed,
            "device": "cpu",
        },
        "data_version": "SmolLM2-135M-Instruct checkpoint (HF hub, resolved at run time)",
    }
    started = time.time()
    try:
        import torch
        import transformers
        from transformers import AutoModelForCausalLM, AutoTokenizer
    except ImportError as error:
        record.update(status="failed", stage="dependencies", error=str(error))
        write_record(args.json_out, record)
        print(
            f"Missing dependency: {error}. Install experiments/requirements.txt",
            file=sys.stderr,
        )
        return 1
    record["versions"] = {
        "torch": torch.__version__,
        "transformers": transformers.__version__,
    }
    print(
        f"Python: {sys.version.split()[0]} | torch: {torch.__version__} "
        f"| transformers: {transformers.__version__}"
    )
    print(f"Execution device: CPU | CUDA available: {torch.cuda.is_available()}")
    if args.check:
        record.update(status="succeeded", stage="check")
        write_record(args.json_out, record)
        print("Dependency check passed. No weights downloaded, no inference executed.")
        return 0
    if args.sample:
        torch.manual_seed(args.seed)
    model_id = record["config"]["model_id"]
    print(f"Loading {model_id}; first run downloads model files.")
    try:
        tokenizer = AutoTokenizer.from_pretrained(model_id)
        model = AutoModelForCausalLM.from_pretrained(model_id).to("cpu").eval()
        text = tokenizer.apply_chat_template(
            [{"role": "user", "content": args.prompt}],
            tokenize=False,
            add_generation_prompt=True,
        )
        inputs = tokenizer(text, return_tensors="pt")
        with torch.inference_mode():
            result = model.generate(
                **inputs,
                max_new_tokens=args.max_new_tokens,
                do_sample=bool(args.sample),
                pad_token_id=tokenizer.eos_token_id,
            )
    except Exception as error:  # download/network/runtime failures stay actionable
        record.update(status="failed", stage="inference", error=str(error),
                      elapsed_s=round(time.time() - started, 2))
        write_record(args.json_out, record)
        print(
            "Inference failed. Check network for first-time weight download, "
            f"free memory and disk space. Error: {error}",
            file=sys.stderr,
        )
        return 1
    output = tokenizer.decode(
        result[0, inputs["input_ids"].shape[1]:], skip_special_tokens=True
    )
    elapsed = round(time.time() - started, 2)
    print("Generated text (not a factuality guarantee):")
    print(output)
    record.update(
        status="succeeded",
        stage="generate",
        input_tokens=int(inputs["input_ids"].shape[1]),
        output_tokens=int(result.shape[1] - inputs["input_ids"].shape[1]),
        elapsed_s=elapsed,
        result=output,
    )
    write_record(args.json_out, record)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
