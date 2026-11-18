import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { resetLearningData, saveCourseNote, watchBrowserErrors, expectNoBrowserErrors } from "./helpers.js";

test("静态主链路：诊断 → 课程笔记 → 规则实验 → 项目关联 → 导出导入 → 刷新恢复", async ({ page }) => {
  const errors = watchBrowserErrors(page);
  await resetLearningData(page);

  await page.goto("/#diagnostic");
  await page.getByRole("button", { name: /保存并查看推荐起点/ }).click();
  await expect(page).toHaveURL(/#home/);

  const noteText = `端到端笔记 ${Date.now()}`;
  await saveCourseNote(page, noteText);
  await page.goto("/#course/foundation/3");
  const readButton = page.getByRole("button", { name: /记录阅读完成|已记录阅读/ });
  await expect(readButton).toBeVisible();
  if ((await readButton.textContent()).includes("记录阅读完成")) await readButton.click();
  await expect(page.getByRole("button", { name: "已记录阅读" })).toBeVisible();

  await page.goto("/#lab/prompt");
  await page.getByRole("button", { name: "运行规则演示" }).click();
  await expect(page.locator("#output")).toContainText("规则演示结果");

  await page.goto("/#projects/assistant");
  await page.locator("summary", { hasText: "添加实验记录" }).click();
  await expect(page.locator("[data-link-run]")).toHaveCount(1);
  await page.locator("[data-link-run]").click();
  await expect(page.locator(".linked-run")).toHaveCount(1);
  await expect(page.locator("#project-link-status")).not.toContainText("未保存");

  await page.reload();
  await expect(page.locator(".linked-run")).toHaveCount(1);
  await page.goto("/#course/foundation/0");
  await expect(page.locator("#lesson-note")).toHaveValue(noteText);
  await page.goto("/#projects/assistant");
  await expect(page.locator(".linked-run")).toHaveCount(1);

  const [projectExport] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "导出项目档案" }).click(),
  ]);
  const projectFile = await projectExport.path();
  const projectMarkdown = await readFile(projectFile, "utf8");
  expect(projectMarkdown).toContain("## 关联实验记录");
  expect(projectMarkdown).toContain("prompt");

  await page.goto("/#settings");
  const [backup] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: /导出完整备份/ }).click(),
  ]);
  const backupPath = await backup.path();
  const backupText = await readFile(backupPath, "utf8");
  expect(backupText).toContain(noteText);

  await page.goto("/#course/foundation/0");
  await page.locator("#lesson-note").fill("导入前的新修改");
  await expect(page.locator("#draft-status")).toContainText("草稿已保存");
  await page.goto("/#settings");
  await page.locator("#backup-import-input").setInputFiles(backupPath);
  await expect(page.locator("#import-preview")).toContainText("导入预检");
  await Promise.all([
    page.waitForEvent("load"),
    page.getByRole("button", { name: /替换现有数据/ }).click(),
  ]);
  await page.goto("/#course/foundation/0");
  await expect(page.locator("#lesson-note")).toHaveValue(noteText);

  await expectNoBrowserErrors(errors);
});
