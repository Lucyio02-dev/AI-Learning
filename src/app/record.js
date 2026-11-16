// 运行记录统一入口：写状态、挂能力、刷新 UI。
import * as S from "./state.js";
import { getCourse, labInfo } from "../content/index.js";

// record(lab, {mode, summary, evidence, passed, statuses, config, metrics}) → run
export function recordRun(run) {
  const lab = run.lab;
  const courseId = labInfo[lab]?.course;
  const statuses = run.statuses ||
    (run.passed === true
      ? { diagnosed: true, verified: true }
      : { diagnosed: !!run.passed, verified: false });
  const saved = S.recordRun({ ...run, statuses });
  // 能力映射：诊断=诊断能力；验证需要独立验证路径（对照/gold-evidence/复核）
  if (courseId && statuses.diagnosed) S.setCapability(courseId, "diagnosed", true, saved.id);
  if (courseId && statuses.verified) S.setCapability(courseId, "verified", true, saved.id);
  return saved;
}
