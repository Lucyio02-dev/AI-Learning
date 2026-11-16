"""Closed-loop evaluation of a BC policy (or the scripted expert).

Usage:
  python experiments/embodied/evaluate.py --model bc-model/policy.pt \
      --episodes 50 --target-dist train|new --json-out bc-eval.json
Metrics: success rate, mean/median final position error, mean steps,
failure breakdown (tolerance/time/fault-free assumption).
"""
import argparse
import json
import math
import os
import random
import statistics
import time

import torch
from torch import nn

from sim import run_episode, expert_policy


def load_policy(path):
    blob = torch.load(path, weights_only=False)
    model = nn.Sequential(nn.Linear(blob["obsDim"], blob["width"]), nn.ReLU(),
                          nn.Linear(blob["width"], blob["width"]), nn.ReLU(),
                          nn.Linear(blob["width"], 2))
    model.load_state_dict(blob["state_dict"])
    model.eval()
    return model, blob


def make_policy_fn(model, blob):
    history = blob.get("history", 2)

    def policy(pose, observed, fault=None):
        # window 内全部是“执行动作前”的位姿：当前 pose 就是其中之一
        policy.poses.append((pose[0], pose[1]))
        feats = []
        for p in policy.poses[-history:]:
            feats.extend(p[:2])
        while len(feats) < 2 * history:
            feats = [0.0, 0.0] + feats
        feats.extend(observed[:2])
        with torch.no_grad():
            action = model(torch.tensor([feats], dtype=torch.float32))[0].tolist()
        return action

    policy.poses = []
    return policy


def sample_target(dist, rng):
    if dist == "new":
        # 新条件：更远的目标（2.5~6.5），测试泛化
        angle = rng.uniform(0, 2 * math.pi)
        radius = rng.uniform(2.5, 6.5)
        return (round(radius * math.cos(angle), 3), round(radius * math.sin(angle), 3))
    angle = rng.uniform(0, 2 * math.pi)
    radius = rng.uniform(1.5, 4.0)
    return (round(radius * math.cos(angle), 3), round(radius * math.sin(angle), 3))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--model", default="",
                        help="留空则评测脚本专家（expert）作为对照基线")
    parser.add_argument("--episodes", type=int, default=50)
    parser.add_argument("--target-dist", default="train", choices=["train", "new"])
    parser.add_argument("--noise", type=float, default=0.05)
    parser.add_argument("--seed", type=int, default=99)
    parser.add_argument("--tolerance", type=float, default=0.15)
    parser.add_argument("--json-out", default="")
    args = parser.parse_args()
    started = time.time()
    rng = random.Random(args.seed)
    record = {"script": "experiments/embodied/evaluate.py",
              "kind": "own-training" if args.model else "expert-baseline"}
    try:
        if args.model:
            model, blob = load_policy(args.model)
            policy_fn = make_policy_fn(model, blob)
        else:
            policy_fn = expert_policy
        errors, steps, successes, failures = [], [], 0, {"tolerance": 0, "maxSteps": 0}
        for ep in range(args.episodes):
            target = sample_target(args.target_dist, rng)
            policy_fn.poses = []
            result = run_episode(target=target, noise=args.noise,
                                 seed=args.seed + ep * 131, max_steps=20,
                                 tolerance=args.tolerance, policy=policy_fn)
            errors.append(result["finalError"])
            steps.append(result["steps"])
            if result["success"]:
                successes += 1
            else:
                failures["maxSteps" if result["steps"] >= 20 else "tolerance"] += 1
        summary = {
            "status": "succeeded",
            "evalKind": "closed-loop",
            "model": os.path.abspath(args.model) if args.model else "scripted-expert",
            "targetDist": args.target_dist,
            "episodes": args.episodes,
            "noise": args.noise,
            "tolerance": args.tolerance,
            "seed": args.seed,
            "successRate": round(successes / args.episodes, 3),
            "meanFinalError": round(statistics.mean(errors), 4),
            "medianFinalError": round(statistics.median(errors), 4),
            "meanSteps": round(statistics.mean(steps), 1),
            "failures": failures,
        }
        record.update(summary)
        record["elapsedS"] = round(time.time() - started, 2)
        print(json.dumps(summary, ensure_ascii=False))
    except Exception as error:
        record.update({"status": "failed", "error": str(error)})
        print(json.dumps(record, ensure_ascii=False))
        if args.json_out:
            os.makedirs(os.path.dirname(os.path.abspath(args.json_out)) or ".", exist_ok=True)
            with open(args.json_out, "w", encoding="utf-8") as handle:
                json.dump(record, handle, ensure_ascii=False, indent=2)
        return 1
    if args.json_out:
        os.makedirs(os.path.dirname(os.path.abspath(args.json_out)) or ".", exist_ok=True)
        with open(args.json_out, "w", encoding="utf-8") as handle:
            json.dump(record, handle, ensure_ascii=False, indent=2)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
