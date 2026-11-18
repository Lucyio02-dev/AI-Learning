import { test, expect } from "@playwright/test";
import { resetLearningData, watchBrowserErrors, expectNoBrowserErrors } from "./helpers.js";

test("完整模式缺少训练数据时明确失败，不显示训练完成", async ({ page }) => {
  const errors = watchBrowserErrors(page);
  await resetLearningData(page);
  await page.goto("/#lab/embodied");
  await expect(page.locator("#mode-indicator")).toContainText("完整模式");

  await page.getByRole("button", { name: /训练 BC 策略/ }).click();
  await expect(page.locator("#emb-task-status")).toContainText(/未完成|失败/, { timeout: 30_000 });
  await expect(page.locator("#output")).not.toContainText("BC 训练完成");

  await page.reload();
  await expect(page.locator("#emb-runs")).toContainText("失败");
  await expectNoBrowserErrors(errors);
});
