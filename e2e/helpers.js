import { expect } from "@playwright/test";

export function watchBrowserErrors(page) {
  const errors = [];
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const text = message.text();
    // 404 静态资源与同步冲突 409 是测试显式覆盖的预期结果；其余错误仍使测试失败。
    if (/favicon\.ico|Failed to load resource.*404|Failed to load resource.*409 \(Conflict\)/i.test(text)) return;
    errors.push(`console: ${text}`);
  });
  return errors;
}

export async function resetLearningData(page) {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.locator("#app")).not.toBeEmpty();
}

export async function saveCourseNote(page, text) {
  await page.goto("/#course/foundation/0");
  await page.locator("#lesson-note").fill(text);
  await expect(page.locator("#draft-status")).toContainText("草稿已保存");
}

export async function expectNoBrowserErrors(errors) {
  expect(errors, errors.join("\n")).toEqual([]);
}
