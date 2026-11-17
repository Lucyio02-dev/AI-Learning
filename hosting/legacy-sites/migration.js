import { originLearningBackup, originLearningSnapshot } from "./src/core/transfer.js";
import { release } from "./src/app/release.js";

const status = document.querySelector("#transfer-status");
document.querySelector("#continue").href = release.canonicalUrl;

function download(data, name) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

document.querySelector("#export").addEventListener("click", () => {
  try {
    const backup = originLearningBackup(localStorage, location.origin);
    if (!backup) {
      status.textContent = "这个浏览器没有在此地址保存学习记录；可直接进入正式工作台。";
      return;
    }
    download(backup, "ai-learning-before-move.json");
    status.textContent = "备份已下载。请在正式站点选择“导入备份 → 合并”。此处的原始记录仍然保留。";
  } catch {
    status.textContent = "数据无法直接读取。请导出原始恢复包保留副本，再处理损坏数据；此处没有修改或清空原记录。";
  }
});

document.querySelector("#recover").addEventListener("click", () => {
  try {
    download({ app: "ai-learning-recovery", sourceOrigin: location.origin, rawLearningData: originLearningSnapshot(localStorage) }, "ai-learning-origin-recovery.json");
    status.textContent = "原始恢复包已下载。此文件用于数据修复；正常迁移请使用“学习备份”。";
  } catch { status.textContent = "浏览器不允许访问存储，请保留当前浏览器数据后再处理。"; }
});
