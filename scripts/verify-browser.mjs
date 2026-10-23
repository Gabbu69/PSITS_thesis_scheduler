// Optional browser QA: provide PLAYWRIGHT_MODULE when using an existing bundled runtime.
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE ?? "playwright"
);
const base = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
await mkdir("output/playwright", { recursive: true });
const browser = await chromium.launch({
  channel: process.env.BROWSER_CHANNEL ?? "msedge",
  headless: true,
  args: ["--disable-gpu"],
});
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1100 },
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(base + "/login");
  await page.getByLabel("College email").fill("coordinator@demo.psits.test");
  await page
    .getByLabel("Password", { exact: true })
    .fill(process.env.DEMO_PASSWORD);
  await page.getByRole("button", { name: "Sign in to workspace" }).click();
  await page
    .getByRole("heading", { name: "Let’s make room for progress." })
    .waitFor();
  await page.getByRole("button", { name: "light theme", exact: true }).click();
  await page.screenshot({
    path: "output/playwright/dashboard-light.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "dark theme", exact: true }).click();
  await page.screenshot({
    path: "output/playwright/dashboard-dark.png",
    fullPage: true,
  });
  assert(
    await page.locator("html").evaluate((el) => el.classList.contains("dark")),
  );
  await page.getByRole("button", { name: "system theme", exact: true }).click();
  await page.getByRole("link", { name: "Availability", exact: true }).click();
  await page
    .getByRole("button", { name: "Add availability", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByLabel("Person (leave blank for room / college block)")
    .selectOption("student");
  await dialog
    .getByLabel("Specific date (overrides recurring availability)")
    .fill("2026-11-06");
  await dialog
    .getByLabel("Label / class / reason")
    .fill("Browser acceptance: verified availability");
  await dialog.getByRole("button", { name: "Save & validate" }).click();
  await page.getByRole("status").waitFor();
  // Create a distinct title-defense attempt; existing published proposals stay fixed.
  await page.getByRole("link", { name: "Thesis groups", exact: true }).click();
  let group = page.locator(".group-card").filter({ hasText: "PSITS-001" });
  await group.getByRole("button", { name: "New attempt", exact: true }).click();
  await page
    .getByRole("dialog")
    .locator('select[name="stageId"]')
    .selectOption("title");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Save & validate" })
    .click();
  await page.getByRole("status").waitFor();
  group = page.locator(".group-card").filter({ hasText: "PSITS-001" });
  await group
    .locator(".attempt-row")
    .filter({ hasText: "Title Defense" })
    .getByRole("button", { name: "Approve ready" })
    .click();
  await page.getByRole("status").waitFor();
  await page
    .getByRole("link", { name: "Schedule workspace", exact: true })
    .click();
  await page.locator('select[name="stageId"]').selectOption("title");
  await page.getByLabel("From", { exact: true }).fill("2026-11-06");
  await page.getByLabel("Through", { exact: true }).fill("2026-11-06");
  await page
    .getByRole("button", { name: "Generate proposed schedule", exact: true })
    .click();
  await page.getByRole("status").waitFor();
  await page
    .getByRole("button", { name: "Publish all draft sessions" })
    .click();
  await page.getByRole("status").waitFor();
  await page
    .getByRole("link", { name: "Reports & exports", exact: true })
    .click();
  await page.getByRole("button", { name: "Preview student list" }).click();
  await page.locator("table").waitFor();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("link", { name: "Download PDF", exact: true }).click();
  const download = await downloadPromise;
  await download.saveAs("output/playwright/browser-downloaded-schedule.pdf");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(base);
  await page
    .getByRole("heading", { name: "Let’s make room for progress." })
    .waitFor();
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  );
  await page.screenshot({
    path: "output/playwright/dashboard-mobile.png",
    fullPage: true,
  });
  assert.deepEqual(errors, []);
  console.log(
    "PASS browser: login, light/dark/system, availability save, stage attempt, readiness, draft generation, publication, report preview, PDF download, mobile overflow and runtime errors",
  );
} finally {
  await browser.close();
}
