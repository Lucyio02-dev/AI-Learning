"""2D kinematic robot simulator: closed-loop episodes with fault injection.

Same math as src/labs/kinematics.js (browser lab). Deterministic given seed.

Usage:
  python experiments/embodied/sim.py --demo
  python experiments/embodied/sim.py --fault frame --seed 7 --json-out out.json
Faults: frame actionLimit drift occlusion timeSkew unit
"""
import argparse
import json
import math
import os
import time

FAULTS = ["none", "frame", "actionLimit", "drift", "occlusion", "timeSkew", "unit"]


class Rand:
    """mulberry32 — 与前端实现一致，保证跨端可复现。"""

    def __init__(self, seed):
        self.a = seed & 0xFFFFFFFF

    def __call__(self):
        self.a = (self.a + 0x6D2B79F5) & 0xFFFFFFFF
        t = self.a
        t = (t ^ (t >> 15)) * (t | 1) & 0xFFFFFFFF
        t = (t + ((t ^ (t >> 7)) * (t | 61) & 0xFFFFFFFF)) & 0xFFFFFFFF
        x = ((t ^ (t >> 14)) & 0xFFFFFFFF)
        return x / 4294967296


def rot(theta):
    return (math.cos(theta), -math.sin(theta), math.sin(theta), math.cos(theta))


def apply_r(r, p):
    xx, xy, yx, yy = r
    return (xx * p[0] + xy * p[1], yx * p[0] + yy * p[1])


def apply_rt(r, p):
    xx, xy, yx, yy = r
    return (xx * p[0] + yx * p[1], xy * p[0] + yy * p[1])


def run_episode(start=(0, 0, 90), target=(3.0, 2.0), policy=None, fault="none",
                noise=0.02, seed=7, max_steps=12, tolerance=0.15, dt=0.2):
    rng = Rand(seed)
    pose = [start[0], start[1], math.radians(start[2])]
    frames = []
    last_target = target
    success = False
    for t in range(max_steps):
        observed = target
        if fault == "occlusion" and t % 3 != 0:
            observed = last_target
        last_target = observed
        if fault == "unit":
            observed = (observed[0] * 180 / math.pi, observed[1] * 180 / math.pi)
        if policy:
            action = policy(pose, observed, fault)
        else:
            delta = (observed[0] - pose[0], observed[1] - pose[1])
            if fault != "frame":
                action = apply_rt(rot(pose[2]), delta)  # 世界→机体
            else:
                action = delta  # 故障：直接当机体位移
        if fault == "actionLimit":
            mag = math.hypot(*action)
            if mag > 2.0:
                action = (action[0] / mag * 2.0, action[1] / mag * 2.0)
        if fault == "drift":
            action = (action[0] + 0.15, action[1] + 0.05)
        action = (action[0] + (rng() * 2 - 1) * noise, action[1] + (rng() * 2 - 1) * noise)
        if fault == "timeSkew" and t == 0:
            frames.append({"t": t, "dt": dt, "pose": list(pose), "observed": list(observed),
                           "action": None, "note": "动作延迟一个周期"})
            continue
        move = apply_r(rot(pose[2]), action)
        pose[0] += move[0]
        pose[1] += move[1]
        err = math.hypot(pose[0] - target[0], pose[1] - target[1])
        frames.append({
            "t": t, "dt": dt,
            "pose": [round(pose[0], 4), round(pose[1], 4), round(math.degrees(pose[2]), 1)],
            "observed": list(observed),
            "action": [round(action[0], 4), round(action[1], 4)],
            "error": round(err, 4),
        })
        if err < tolerance:
            success = True
            break
    final_err = math.hypot(pose[0] - target[0], pose[1] - target[1])
    return {
        "frames": frames, "success": success, "finalError": round(final_err, 4),
        "steps": len(frames), "fault": fault, "noise": noise, "seed": seed,
        "target": list(target),
        "startPose": [round(start[0], 4), round(start[1], 4)],
    }


def expert_policy(pose, observed, fault=None):
    """供 collect.py 使用的"专家"：直接朝目标方向移动固定步长。"""
    delta = (observed[0] - pose[0], observed[1] - pose[1])
    body = apply_rt(rot(pose[2]), delta)
    mag = math.hypot(*body) or 1.0
    step = min(0.8, mag)
    return (body[0] / mag * step, body[1] / mag * step)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--demo", action="store_true")
    parser.add_argument("--fault", default="none", choices=FAULTS)
    parser.add_argument("--seed", type=int, default=7)
    parser.add_argument("--noise", type=float, default=0.02)
    parser.add_argument("--json-out", default="")
    args = parser.parse_args()
    started = time.time()
    result = run_episode(fault=args.fault, noise=args.noise, seed=args.seed)
    result["elapsedMs"] = round((time.time() - started) * 1000, 1)
    result["summary"] = (
        f"success={result['success']} finalError={result['finalError']} steps={result['steps']}"
    )
    print(result["summary"])
    for f in result["frames"][:5]:
        print(f)
    if len(result["frames"]) > 5:
        print(f"... {len(result['frames']) - 5} more frames")
    if args.json_out:
        os.makedirs(os.path.dirname(os.path.abspath(args.json_out)) or ".", exist_ok=True)
        with open(args.json_out, "w", encoding="utf-8") as handle:
            json.dump(result, handle, ensure_ascii=False, indent=1)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
