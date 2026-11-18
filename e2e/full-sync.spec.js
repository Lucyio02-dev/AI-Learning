import { test, expect } from "@playwright/test";
import { resetLearningData, saveCourseNote, watchBrowserErrors, expectNoBrowserErrors } from "./helpers.js";

test("两个浏览器上下文的同步冲突可见，并可合并恢复", async ({ page, browser, baseURL }) => {
  const errorsA = watchBrowserErrors(page);
  const username = `e2e${Date.now()}`;
  const password = "e2e-password-123";

  await resetLearningData(page);
  await page.goto("/#settings");
  await page.locator("#reg-user").fill(username);
  await page.locator("#reg-pass").fill(password);
  await page.getByRole("button", { name: "注册并登录" }).click();
  await expect(page.locator("#sync-status")).toContainText("注册成功");

  await saveCourseNote(page, "账户 A 的初始笔记");
  await page.goto("/#settings");
  await page.getByRole("button", { name: "推送到服务器" }).click();
  await expect(page.locator("#sync-status")).toContainText("已推送");

  const contextB = await browser.newContext({ baseURL, locale: "zh-CN" });
  const pageB = await contextB.newPage();
  const errorsB = watchBrowserErrors(pageB);
  try {
    await resetLearningData(pageB);
    await pageB.goto("/#settings");
    await pageB.locator("#login-user").fill(username);
    await pageB.locator("#login-pass").fill(password);
    await pageB.getByRole("button", { name: "登录", exact: true }).click();
    await expect(pageB.locator("#sync-status")).toContainText("登录成功");

    await saveCourseNote(pageB, "账户 B 的后续笔记");
    await pageB.goto("/#settings");
    await pageB.getByRole("button", { name: "推送到服务器" }).click();
    await expect(pageB.locator("#sync-status")).toContainText("已推送");
  } finally {
    await contextB.close();
  }

  await saveCourseNote(page, "账户 A 的离线修改");
  await page.goto("/#settings");
  await page.getByRole("button", { name: "推送到服务器" }).click();
  await expect(page.locator("#sync-status")).toContainText("同步冲突");
  await page.getByRole("button", { name: /合并/ }).click();
  await expect(page.locator("#sync-status")).toContainText("已合并推送");

  await expectNoBrowserErrors(errorsA);
  await expectNoBrowserErrors(errorsB);
});
