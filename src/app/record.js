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
  const { run: saved, ok } = S.recordRun({ ...run, statuses });
  // 只有运行记录真正写入后，才同步能力证据；否则界面不能出现“已验证”的假象。
  if (ok) {
    if (courseId && statuses.diagnosed) S.setCapability(courseId, "diagnosed", true, saved.id);
    if (courseId && statuses.verified) {
      S.setCapability(courseId, "verified", true, saved.id);
      S.setCapability(courseId, "experimentPassed", true, saved.id);
    }
  }
  return { ...saved, persisted: ok };
}
