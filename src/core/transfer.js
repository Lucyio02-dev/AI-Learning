// 在旧域名导出学习数据；只读取学习键，不读取账户令牌或修改原存储。
import { normalize } from "./schema.js";
import { exported, KEY, V2_KEY, LEGACY_KEY } from "./store.js";

export function originLearningSnapshot(storage) {
  const snapshot = {};
  for (const key of [KEY, V2_KEY, LEGACY_KEY, "ai-learning-import-backup", "ai-learning-agent-checkpoint"]) {
    const value = storage.getItem(key);
    if (value !== null) snapshot[key] = value;
  }
  return snapshot;
}

export function originLearningBackup(storage, sourceOrigin = "") {
  const snapshot = originLearningSnapshot(storage);
  const raw = snapshot[KEY] || snapshot[V2_KEY] || snapshot[LEGACY_KEY];
  if (!raw) return null;
  const data = JSON.parse(raw);
  const state = normalize(data.state || data);
  return {
    ...JSON.parse(exported(state)),
    sourceOrigin,
    recoveryRaw: snapshot,
  };
}
