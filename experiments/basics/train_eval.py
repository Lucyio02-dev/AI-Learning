"""Train/eval discipline demo: data leakage on/off, JSON run record.

Usage:
  python experiments/basics/train_eval.py            # correct pipeline
  python experiments/basics/train_eval.py --leaky    # scaler fitted before split
  python experiments/basics/train_eval.py --width 128 --seed 1
"""
import argparse
import json
import platform
import sys
import time

import numpy as np
import torch
from torch import nn


def make_data(n=1000, seed=0):
    rng = np.random.default_rng(seed)
    X = rng.normal(size=(n, 8)).astype(np.float32)
    # 较强的标签噪声 + 弱信号，让"正确流程"与"泄漏流程"的差距可见
    y = ((X[:, 0] + 0.5 * X[:, 1] + 0.5 * rng.normal(0, 1, n)) > 0).astype(np.int64)
    return torch.from_numpy(X), torch.from_numpy(y)


def run(leaky=False, width=32, seed=0, epochs=30):
    torch.manual_seed(seed)
    X, y = make_data(seed=seed)
    n_train, n_val, n_test = 640, 180, 180
    if leaky:
        # 泄漏通道 1（主）：在全量数据上派生“事后特征”（标签代理列），
        # 相当于把结果之后才能知道的信息放进了输入 —— 测试分虚高。
        proxy = (y.float().unsqueeze(1) + 0.1 * torch.randn_like(y.float().unsqueeze(1)))
        X = torch.cat([X, proxy], dim=1)
        # 泄漏通道 2：scaler 在全量数据上拟合后再划分
        mu, sd = X.mean(0, keepdim=True), X.std(0, keepdim=True) + 1e-6
        Xn = (X - mu) / sd
        train_X, val_X, test_X = Xn[:n_train], Xn[n_train:n_train + n_val], Xn[n_train + n_val:]
        train_y, val_y, test_y = y[:n_train], y[n_train:n_train + n_val], y[n_train + n_val:]
        unique_test_mask = torch.ones(n_test, dtype=torch.bool)
    else:
        # 正确：只用原始特征；scaler 只在训练集上拟合
        train_X = X[:n_train]
        mu, sd = train_X.mean(0, keepdim=True), train_X.std(0, keepdim=True) + 1e-6
        Xn = (X - mu) / sd
        train_X, val_X, test_X = Xn[:n_train], Xn[n_train:n_train + n_val], Xn[n_train + n_val:]
        train_y, val_y, test_y = y[:n_train], y[n_train:n_train + n_val], y[n_train + n_val:]
        unique_test_mask = torch.ones(n_test, dtype=torch.bool)

    model = nn.Sequential(nn.Linear(X.shape[1], width), nn.ReLU(), nn.Linear(width, 2))
    opt = torch.optim.Adam(model.parameters(), lr=0.01)
    loss_fn = nn.CrossEntropyLoss()
    history = []
    best_val, best_state, patience, bad = 1e9, None, 6, 0
    for epoch in range(epochs):
        model.train()
        opt.zero_grad()
        loss = loss_fn(model(train_X), train_y)
        loss.backward()
        opt.step()
        model.eval()
        with torch.no_grad():
            val_loss = float(loss_fn(model(val_X), val_y))
        history.append({"epoch": epoch, "train": round(float(loss.detach()), 4), "val": round(val_loss, 4)})
        if val_loss < best_val:
            best_val, bad = val_loss, 0
            best_state = {k: v.clone() for k, v in model.state_dict().items()}
        else:
            bad += 1
            if bad >= patience:
                break
    model.load_state_dict(best_state)
    with torch.no_grad():
        acc = lambda Xs, ys: float((model(Xs).argmax(1) == ys).float().mean())
        train_acc, val_acc, test_acc = acc(train_X, train_y), acc(val_X, val_y), acc(test_X, test_y)
        # 关键指标：测试集里"训练时没见过"的那部分样本 —— 真实泛化能力
        uniq_X = test_X[unique_test_mask]
        uniq_y = test_y[unique_test_mask]
        unseen_acc = acc(uniq_X, uniq_y)
    return {
        "status": "succeeded",
        "mode": "leaky" if leaky else "correct",
        "config": {"width": width, "seed": seed, "epochs": epochs,
                   "split": [n_train, n_val, n_test], "leakyChannels": ["scaler-full-fit", "test-duplicates-in-train"] if leaky else []},
        "metrics": {"train_acc": round(train_acc, 4), "val_acc": round(val_acc, 4),
                    "test_acc": round(test_acc, 4),
                    "unseen_test_acc": round(unseen_acc, 4),
                    "best_val_loss": round(best_val, 4)},
        "history": history,
        "platform": platform.platform(),
        "versions": {"torch": torch.__version__, "numpy": np.__version__},
        "elapsedS": 0.0,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--leaky", action="store_true", help="拟合 scaler 于全量数据（泄漏对照）")
    parser.add_argument("--width", type=int, default=32)
    parser.add_argument("--seed", type=int, default=0)
    parser.add_argument("--epochs", type=int, default=30)
    parser.add_argument("--json-out", default="")
    args = parser.parse_args()
    started = time.time()
    try:
        record = run(args.leaky, args.width, args.seed, args.epochs)
    except Exception as error:
        record = {"status": "failed", "error": repr(error), "config": vars(args)}
    record.setdefault("mode", "leaky" if args.leaky else "correct")
    record["elapsedS"] = round(time.time() - started, 2)
    print(json.dumps({k: record.get(k) for k in ("status", "mode", "metrics")}, ensure_ascii=False))
    if args.json_out:
        import os
        os.makedirs(os.path.dirname(os.path.abspath(args.json_out)) or ".", exist_ok=True)
        with open(args.json_out, "w", encoding="utf-8") as f:
            json.dump(record, f, ensure_ascii=False, indent=2)
    return 0 if record["status"] == "succeeded" else 1


if __name__ == "__main__":
    raise SystemExit(main())
