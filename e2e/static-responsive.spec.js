import { test, expect } from "@playwright/test";
import { watchBrowserErrors, expectNoBrowserErrors } from "./helpers.js";

test("390px 窄屏无横向溢出，键盘可达跳转内容", async ({ page }) => {
  const errors = watchBrowserErrors(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.locator(".brand")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(391);

  await page.keyboard.press("Tab");
  expect(await page.locator(".skip-link").evaluate((el) => el === document.activeElement)).toBe(true);

  await page.goto("/#course/foundation/0");
  await expect(page.locator(".lesson-body")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(391);
  await page.screenshot({ path: "test-results/representative-course-390.png", fullPage: true });
  await expectNoBrowserErrors(errors);
});
