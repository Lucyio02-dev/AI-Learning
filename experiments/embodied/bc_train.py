"""Behavior cloning on the 2D sim: real CPU training with torch, minutes not hours.

Usage:
  python experiments/embodied/bc_train.py --data expert.jsonl \
      --out bc-model --json-out bc-train.json
Distinguishes: this is YOUR OWN training run (自己训练),
not running an official pretrained policy (运行已有策略).
"""
import argparse
import json
import math
import os
import platform
import time

import numpy as np
import torch
from torch import nn


def load_episodes(path):
    episodes = []
    with open(path, encoding="utf-8") as handle:
        for line in handle:
            if line.strip():
                episodes.append(json.loads(line))
    return episodes


def build_dataset(episodes, history=2):
    """Observation: the `history` poses BEFORE the action (world x,y) + target → 2*history+2 dims.
    Label: the expert body-frame action taken at that moment.
    Alignment: frames[i]["pose"] is the pose AFTER the action, so the pre-action
    pose for the first frame is meta.startPose, and for frame i>0 it is frames[i-1]["pose"]."""
    obs, act = [], []
    for ep in episodes:
        window = [ep["meta"].get("startPose", [0.0, 0.0])]
        for frame in ep["frames"]:
            action = frame.get("action")
            if action is None:  # e.g. timeSkew frames carry no action
                continue
            feats = []
            for pose in window[-history:]:
                feats.extend(pose[:2])
            while len(feats) < 2 * history:
                feats = [0.0, 0.0] + feats
            feats.extend(ep["meta"]["target"])
            obs.append(feats)
            act.append(action)
            window.append(frame["pose"][:2])
    return (
        torch.tensor(obs, dtype=torch.float32),
        torch.tensor(act, dtype=torch.float32),
    )


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data", required=True)
    parser.add_argument("--out", default="bc-model")
    parser.add_argument("--width", type=int, default=64)
    parser.add_argument("--epochs", type=int, default=200)
    parser.add_argument("--lr", type=float, default=3e-3)
    parser.add_argument("--seed", type=int, default=0)
    parser.add_argument("--json-out", default="")
    args = parser.parse_args()
    started = time.time()
    record = {
        "script": "experiments/embodied/bc_train.py",
        "kind": "own-training",  # 区分：自己训练（非官方预训练策略）
        "platform": platform.platform(),
        "device": "cpu",
    }
    try:
        torch.manual_seed(args.seed)
        episodes = load_episodes(args.data)
        X, Y = build_dataset(episodes)
        n_val = max(1, int(0.15 * len(X)))
        X_train, X_val = X[:-n_val], X[-n_val:]
        Y_train, Y_val = Y[:-n_val], Y[-n_val:]
        model = nn.Sequential(nn.Linear(X.shape[1], args.width), nn.ReLU(),
                              nn.Linear(args.width, args.width), nn.ReLU(),
                              nn.Linear(args.width, 2))
        opt = torch.optim.Adam(model.parameters(), lr=args.lr)
        loss_fn = nn.MSELoss()
        history = []
        for epoch in range(args.epochs):
            opt.zero_grad()
            loss = loss_fn(model(X_train), Y_train)
            loss.backward()
            opt.step()
            if epoch % 10 == 0 or epoch == args.epochs - 1:
                with torch.no_grad():
                    val_loss = float(loss_fn(model(X_val), Y_val))
                history.append({"epoch": epoch, "train": round(float(loss.detach()), 5), "val": round(val_loss, 5)})
        os.makedirs(args.out, exist_ok=True)
        weights_path = os.path.join(args.out, "policy.pt")
        torch.save({"state_dict": model.state_dict(), "obsDim": int(X.shape[1]),
                    "actDim": 2, "width": args.width, "history": 2,
                    "trainedOn": os.path.basename(args.data),
                    "trainSeed": args.seed}, weights_path)
        record.update({
            "status": "succeeded",
            "config": {k: getattr(args, k) for k in ("width", "epochs", "lr", "seed")},
            "data": {"path": os.path.abspath(args.data), "episodes": len(episodes),
                     "samples": int(len(X)), "obsDim": int(X.shape[1])},
            "finalTrainLoss": round(float(loss.detach()), 5),
            "finalValLoss": round(history[-1]["val"], 5),
            "history": history,
            "artifacts": [weights_path],
            "versions": {"torch": torch.__version__, "numpy": np.__version__},
            "elapsedS": 0.0,
        })
        record["elapsedS"] = round(time.time() - started, 2)
        print(json.dumps({k: record[k] for k in ("status", "kind", "finalTrainLoss",
                                                  "finalValLoss", "elapsedS")},
                         ensure_ascii=False))
    except Exception as error:
        record.update({"status": "failed", "error": str(error), "elapsedS": round(time.time() - started, 2)})
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
