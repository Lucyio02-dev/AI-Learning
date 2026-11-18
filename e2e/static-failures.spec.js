import { test, expect } from "@playwright/test";
import { resetLearningData, saveCourseNote, watchBrowserErrors, expectNoBrowserErrors } from "./helpers.js";

test("存储失败不显示已保存，编辑内容保留且重试后持久化", async ({ page }) => {
  const errors = watchBrowserErrors(page);
  await resetLearningData(page);
  await page.goto("/#course/foundation/0");
  await page.evaluate(() => {
    window.__failLearningStorage = false;
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (window.__failLearningStorage && key === "ai-learning-lab-v3") {
        throw new DOMException("Quota exceeded", "QuotaExceededError");
      }
      return original.call(this, key, value);
    };
  });

  const draft = "空间不足时仍保留的草稿";
  await page.evaluate(() => { window.__failLearningStorage = true; });
  await page.locator("#lesson-note").fill(draft);
  await expect(page.locator("#draft-status")).toContainText("未保存");
  await expect(page.locator("#lesson-note")).toHaveValue(draft);

  await page.evaluate(() => { window.__failLearningStorage = false; });
  await page.getByRole("button", { name: "重试保存" }).click();
  await expect(page.locator("#draft-status")).toContainText("草稿已保存");
  await page.reload();
  await expect(page.locator("#lesson-note")).toHaveValue(draft);
  await expectNoBrowserErrors(errors);
});

test("损坏备份在预检阶段失败，不覆盖现有笔记", async ({ page }) => {
  const errors = watchBrowserErrors(page);
  await resetLearningData(page);
  const note = "损坏导入前的笔记";
  await saveCourseNote(page, note);
  await page.goto("/#settings");
  await page.locator("#backup-import-input").setInputFiles({
    name: "broken.json",
    mimeType: "application/json",
    buffer: Buffer.from("{broken"),
  });
  await expect(page.locator("#import-preview")).toContainText("导入失败");
  await page.goto("/#course/foundation/0");
  await expect(page.locator("#lesson-note")).toHaveValue(note);
  await expectNoBrowserErrors(errors);
});
