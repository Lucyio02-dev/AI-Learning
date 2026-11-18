import { test, expect } from "@playwright/test";
import { watchBrowserErrors, expectNoBrowserErrors } from "./helpers.js";

test("生产构建可启动，发布元数据与内容版本一致", async ({ page, request }) => {
  const errors = watchBrowserErrors(page);
  const response = await request.get("/release.json");
  expect(response.ok()).toBe(true);
  const release = await response.json();
  expect(release.version).toMatch(/^\d+\.\d+\.\d+$/);
  expect(release.commit).toMatch(/^[0-9a-f]{40}$/);
  expect((await request.get(`/${release.assetDirectory}/app.js`)).ok()).toBe(true);

  await page.goto("/");
  await expect(page).toHaveTitle(/AI Learning/);
  await page.goto("/#course/foundation/0");
  await page.locator("#lesson-note").fill("生产构建中的离线笔记");
  await expect(page.locator("#draft-status")).toContainText("草稿已保存");
  await page.reload();
  await expect(page.locator("#lesson-note")).toHaveValue("生产构建中的离线笔记");
  await page.screenshot({ path: "test-results/representative-dist-home.png", fullPage: true });
  await expectNoBrowserErrors(errors);
});
