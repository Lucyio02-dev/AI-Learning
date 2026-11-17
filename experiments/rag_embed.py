"""Real local embeddings for the RAG lab (CPU, bge-small-zh-v1.5).

Modes:
  index  --input corpus.jsonl --out DIR [--chunk-size 200] [--overlap 40]
  serve  --index DIR          (JSON lines on stdin -> results on stdout)
  query  --texts "a" "b"      (print pairwise cosine similarity matrix)

Protocol (serve mode), one JSON object per line on stdin:
  {"query": "...", "topK": 3, "currentOnly": false, "filterIds": null}
Response line:
  {"ok": true, "results": [{...chunk, "score": float}], "elapsedMs": int}
or {"ok": false, "error": "..."}
"""
import argparse
import json
import os
import sys
import time

MODEL_ID = "BAAI/bge-small-zh-v1.5"
DIM = 512  # bge-small hidden size; verified at runtime


def chunk_text(text, size=200, overlap=40):
    size = max(1, int(size))
    overlap = max(0, min(size // 2, int(overlap)))
    step = max(1, size - overlap)
    chunks = []
    i = n = 0
    while i < len(text):
        piece = text[i:i + size].strip()
        if piece:
            n += 1
            chunks.append(piece)
        i += step
    return chunks


def load_model():
    import torch
    from transformers import AutoModel, AutoTokenizer
    tokenizer = AutoTokenizer.from_pretrained(MODEL_ID)
    model = AutoModel.from_pretrained(MODEL_ID).eval()
    torch.set_grad_enabled(False)
    return tokenizer, model


def embed(tokenizer, model, texts):
    import torch
    vectors = []
    batch = 32
    for start in range(0, len(texts), batch):
        batch_texts = texts[start:start + batch]
        encoded = tokenizer(batch_texts, padding=True, truncation=True,
                            max_length=512, return_tensors="pt")
        output = model(**encoded)
        # CLS pooling + L2 normalization (bge convention)
        hidden = output.last_hidden_state[:, 0]
        hidden = torch.nn.functional.normalize(hidden, p=2, dim=1)
        vectors.extend(hidden.tolist())
    return vectors


def cosine(a, b):
    dot = sum(x * y for x, y in zip(a, b))
    na = sum(x * x for x in a) ** 0.5 or 1.0
    nb = sum(x * x for x in b) ** 0.5 or 1.0
    return dot / (na * nb)


def cmd_index(args):
    docs = [json.loads(line) for line in open(args.input, encoding="utf-8") if line.strip()]
    os.makedirs(args.out, exist_ok=True)
    chunks = []
    for doc in docs:
        for i, piece in enumerate(chunk_text(doc.get("text", ""), args.chunk_size, args.overlap), 1):
            chunks.append({
                "id": f"{doc['id']}#c{i}",
                "docId": doc["id"],
                "title": doc.get("title", ""),
                "version": doc.get("version", ""),
                "current": bool(doc.get("current", False)),
                "date": doc.get("date", ""),
                "text": piece,
            })
    tokenizer, model = load_model()
    started = time.time()
    vectors = embed(tokenizer, model, [c["text"] for c in chunks])
    with open(os.path.join(args.out, "vectors.json"), "w", encoding="utf-8") as f:
        json.dump(vectors, f, ensure_ascii=False)
    with open(os.path.join(args.out, "chunks.json"), "w", encoding="utf-8") as f:
        json.dump(chunks, f, ensure_ascii=False, indent=1)
    meta = {
        "model": MODEL_ID,
        "dim": len(vectors[0]) if vectors else DIM,
        "chunkSize": args.chunk_size,
        "overlap": args.overlap,
        "numChunks": len(chunks),
        "numDocs": len(docs),
        "builtAt": time.strftime("%Y-%m-%dT%H:%M:%S"),
        "corpusHash": str(hash(json.dumps(docs, ensure_ascii=False, sort_keys=True))),
        "elapsedS": round(time.time() - started, 2),
    }
    with open(os.path.join(args.out, "meta.json"), "w", encoding="utf-8") as f:
        json.dump(meta, f, ensure_ascii=False, indent=2)
    print(json.dumps({"ok": True, "meta": meta}, ensure_ascii=False))


def cmd_serve(args):
    with open(os.path.join(args.index, "vectors.json"), encoding="utf-8") as f:
        vectors = json.load(f)
    with open(os.path.join(args.index, "chunks.json"), encoding="utf-8") as f:
        chunks = json.load(f)
    tokenizer, model = load_model()
    print(json.dumps({"ok": True, "ready": True, "chunks": len(chunks)}), flush=True)
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        started = time.time()
        try:
            req = json.loads(line)
            qvec = embed(tokenizer, model, [req["query"]])[0]
            scored = []
            for chunk, vec in zip(chunks, vectors):
                if req.get("currentOnly") and not chunk.get("current"):
                    continue
                if req.get("filterIds") and chunk["docId"] in req["filterIds"]:
                    continue
                scored.append({**chunk, "score": round(cosine(qvec, vec), 4)})
            scored.sort(key=lambda c: -c["score"])
            top_k = max(1, int(req.get("topK", 3)))
            print(json.dumps({
                "ok": True,
                "results": scored[:top_k],
                "elapsedMs": round((time.time() - started) * 1000, 1),
            }, ensure_ascii=False), flush=True)
        except Exception as error:  # keep the loop alive; report per-line errors
            print(json.dumps({"ok": False, "error": str(error)}, ensure_ascii=False), flush=True)


def cmd_query(args):
    tokenizer, model = load_model()
    vectors = embed(tokenizer, model, list(args.texts))
    matrix = [[round(cosine(a, b), 4) for b in vectors] for a in vectors]
    print(json.dumps({"ok": True, "texts": args.texts, "matrix": matrix}, ensure_ascii=False))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="mode", required=True)
    p_index = sub.add_parser("index")
    p_index.add_argument("--input", required=True)
    p_index.add_argument("--out", required=True)
    p_index.add_argument("--chunk-size", type=int, default=200)
    p_index.add_argument("--overlap", type=int, default=40)
    p_serve = sub.add_parser("serve")
    p_serve.add_argument("--index", required=True)
    p_query = sub.add_parser("query")
    p_query.add_argument("--texts", nargs="+", required=True)
    args = parser.parse_args()
    if args.mode == "index":
        cmd_index(args)
    elif args.mode == "serve":
        cmd_serve(args)
    else:
        cmd_query(args)


if __name__ == "__main__":
    main()
