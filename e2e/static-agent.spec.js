import { test, expect } from "@playwright/test";
import { resetLearningData, watchBrowserErrors, expectNoBrowserErrors } from "./helpers.js";

test("Agent 写入超时后刷新恢复，核验完成且历史保留", async ({ page }) => {
  const errors = watchBrowserErrors(page);
  await resetLearningData(page);
  await page.goto("/#lab/agent");
  await page.getByRole("button", { name: /启动任务/ }).click();
  await expect(page.locator("#output")).toContainText("检查点已保存");

  await page.reload();
  await expect(page.locator("#output")).toContainText("发现未完成检查点");
  await page.getByRole("button", { name: "从检查点恢复运行" }).click();
  await page.getByRole("button", { name: "按策略恢复" }).click();
  await expect(page.locator("#output")).toContainText("任务完成：一次写入，一条有效预约");

  await page.reload();
  await expect(page.locator("#agent-runs")).toContainText("核验后恢复");
  await expectNoBrowserErrors(errors);
});
