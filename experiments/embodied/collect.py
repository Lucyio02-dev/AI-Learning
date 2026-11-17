"""Collect expert trajectories for behavior cloning.

Usage:
  python experiments/embodied/collect.py --episodes 20 --noise 0.1 \
      --out ../../artifacts/embodied/demo20.jsonl
Each line: {"episodeId", "meta", "frames":[{t,pose,observed,action,error}]}
Actions are body-frame increments (see sim.py) — semantics documented in meta.
"""
import argparse
import json
import math
import os
import random
import time

from sim import run_episode, expert_policy

ACTION_SEMANTICS = "body-frame increment (dx,dy) applied after R(theta); units: meters"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--episodes", type=int, default=20)
    parser.add_argument("--noise", type=float, default=0.1)
    parser.add_argument("--seed", type=int, default=11)
    parser.add_argument("--out", default="../../artifacts/embodied/expert.jsonl")
    args = parser.parse_args()
    started = time.time()
    os.makedirs(os.path.dirname(os.path.abspath(args.out)) or ".", exist_ok=True)
    successes = 0
    with open(args.out, "w", encoding="utf-8") as handle:
        for ep in range(args.episodes):
            seed = args.seed + ep * 977
            rng = random.Random(seed)
            angle = rng.uniform(0, 2 * math.pi)
            radius = rng.uniform(1.5, 4.0)
            target = (round(radius * math.cos(angle), 3), round(radius * math.sin(angle), 3))
            result = run_episode(
                target=target, noise=args.noise, seed=seed, max_steps=20,
                policy=expert_policy,
            )
            successes += result["success"]
            record = {
                "episodeId": f"ep-{seed}",
                "meta": {
                    "actionSemantics": ACTION_SEMANTICS,
                    "noise": args.noise,
                    "seed": seed,
                    "dt": 0.2,
                    "obsDims": 2,
                    "actDims": 2,
                    "target": list(target),
                    "startPose": result["startPose"],
                    "success": result["success"],
                    "finalError": result["finalError"],
                },
                "frames": result["frames"],
            }
            handle.write(json.dumps(record, ensure_ascii=False) + "\n")
    summary = {
        "status": "succeeded",
        "episodes": args.episodes,
        "expertSuccessRate": round(successes / args.episodes, 3),
        "out": os.path.abspath(args.out),
        "noise": args.noise,
        "elapsedS": round(time.time() - started, 2),
    }
    print(json.dumps(summary, ensure_ascii=False))
    with open(args.out + ".meta.json", "w", encoding="utf-8") as handle:
        json.dump(summary, handle, ensure_ascii=False, indent=2)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
