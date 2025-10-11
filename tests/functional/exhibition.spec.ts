import { test, expect } from "@playwright/test";

test("scripts execute inside iframe preview", async ({ page }) => {
  // Enable console logging to debug
  page.on("console", (msg) => console.log("PAGE LOG:", msg.text()));

  await page.goto(
    "http://localhost:8080/tests/functional/html/basic-initialization.html",
  );

  // Wait for the page to fully load
  await page.waitForLoadState("networkidle");

  // Check if iframe element exists
  const iframeExists = await page
    .locator("[data-js-exhibition-preview]")
    .count();

  expect(iframeExists).toBe(1);

  const iframe = page.frameLocator("[data-js-exhibition-preview]");

  // Wait for the container to appear and the script to execute
  await iframe.locator("#container h1").waitFor();

  // Verify script ran and modified DOM
  await expect(iframe.locator("#container h1")).toHaveText("Hello world");
});
