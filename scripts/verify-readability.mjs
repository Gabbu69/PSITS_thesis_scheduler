// Read-only browser regression checks; no availability or schedule records change.
// Set PLAYWRIGHT_MODULE to use an existing Playwright installation if needed.
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE ?? "playwright"
);
const base = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
const password = process.env.DEMO_PASSWORD;
assert(password, "Set DEMO_PASSWORD in the local environment");
await mkdir("output/playwright", { recursive: true });
const browser = await chromium.launch({
  channel: process.env.BROWSER_CHANNEL ?? "msedge",
  headless: true,
  args: ["--disable-gpu"],
});
const errors = [];
async function screenshot(page, name) {
  await page.screenshot({
    path: `output/playwright/readability-${name}.png`,
    fullPage: true,
  });
}
async function noOverflow(page) {
  const size = await page.evaluate(() => ({
    content: document.documentElement.scrollWidth,
    viewport: innerWidth,
  }));
  if (size.content > size.viewport + 1) {
    console.log(
      "Overflow diagnostics",
      await page.locator("body *").evaluateAll((elements) =>
        elements
          .filter((el) => {
            const rect = el.getBoundingClientRect();
            return (
              rect.width &&
              (rect.right > innerWidth + 1 || rect.left < -1) &&
              !el.closest(
                ".sidebar, .table-wrap, .week-strip, [aria-hidden=true]",
              )
            );
          })
          .slice(0, 20)
          .map((el) => ({
            tag: el.tagName,
            class: el.className,
            text: el.textContent.slice(0, 80),
            right: el.getBoundingClientRect().right,
          })),
      ),
    );
    await page.screenshot({
      path: "output/playwright/readability-overflow.png",
    });
  }
  assert(size.content <= size.viewport + 1, JSON.stringify(size));
}
async function insideViewport(locator) {
  await locator.scrollIntoViewIfNeeded();
  assert(await locator.isVisible());
  assert(
    await locator.evaluate((el) => {
      const r = el.getBoundingClientRect();
      return (
        r.top >= -1 &&
        r.left >= -1 &&
        r.bottom <= innerHeight + 1 &&
        r.right <= innerWidth + 1
      );
    }),
    `Control outside viewport: ${await locator.textContent()}`,
  );
}
async function typeCredentials(page, email) {
  await page.getByLabel("College email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
}
async function signIn(page, email) {
  await page.goto(base + "/login");
  await typeCredentials(page, email);
  await page.getByRole("button", { name: "Sign in to workspace" }).click();
  await page.locator("#main-content").waitFor();
}
async function checkReadableText(page) {
  const fonts = await page.evaluate(() => {
    const small = [];
    const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (walk.nextNode()) {
      const node = walk.currentNode;
      const el = node.parentElement;
      if (
        !node.textContent.trim() ||
        !el ||
        el.closest('[aria-hidden="true"], script, style') ||
        !el.getClientRects().length
      )
        continue;
      const style = getComputedStyle(el);
      if (style.visibility === "hidden") continue;
      if (parseFloat(style.fontSize) < 14)
        small.push({
          text: node.textContent.trim().slice(0, 60),
          size: style.fontSize,
        });
    }
    return {
      body: parseFloat(getComputedStyle(document.body).fontSize),
      small,
    };
  });
  assert(fonts.body >= 18, JSON.stringify(fonts));
  assert.deepEqual(fonts.small, []);
}
async function checkContrast(page) {
  const ratio = await page.evaluate(() => {
    const el = document.createElement("span");
    el.style.cssText = "color:var(--muted);background-color:var(--surface)";
    document.body.append(el);
    const style = getComputedStyle(el);
    const luminance = (value) =>
      value
        .match(/[\d.]+/g)
        .slice(0, 3)
        .map(Number)
        .map((n) => n / 255)
        .map((n) => (n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4))
        .reduce((a, n, i) => a + n * [0.2126, 0.7152, 0.0722][i], 0);
    const a = luminance(style.color),
      b = luminance(style.backgroundColor);
    el.remove();
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  });
  assert(ratio >= 4.5, `Secondary-text contrast: ${ratio}`);
}
try {
  const page = await browser.newPage({
    viewport: { width: 1336, height: 636 },
  });
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(base + "/login");
  await typeCredentials(page, "faculty@demo.psits.test");
  const reveal = page.getByRole("button", { name: "Show password" });
  await reveal.click();
  assert.equal(
    await page.getByLabel("Password", { exact: true }).getAttribute("type"),
    "text",
  );
  await page.getByRole("button", { name: "Hide password" }).click();
  let heldRequest;
  await page.route("**/api/auth/sign-in/email", (route) => {
    heldRequest = route;
  });
  await page.getByRole("button", { name: "Sign in to workspace" }).click();
  await page
    .getByRole("alert")
    .filter({ hasText: "taking too long" })
    .waitFor({ timeout: 20000 });
  assert(
    await page
      .getByRole("button", { name: "Sign in to workspace" })
      .isEnabled(),
  );
  assert.equal(
    await page.getByLabel("College email").inputValue(),
    "faculty@demo.psits.test",
  );
  assert.equal(
    await page.getByLabel("Password", { exact: true }).inputValue(),
    password,
  );
  await page.unroute("**/api/auth/sign-in/email");
  await heldRequest?.abort().catch(() => {});
  await page
    .getByLabel("Password", { exact: true })
    .fill("incorrect-demo-password");
  await page.getByRole("button", { name: "Sign in to workspace" }).click();
  await page.getByRole("alert").filter({ hasText: "not recognized" }).waitFor();
  await checkReadableText(page);
  await noOverflow(page);
  await screenshot(page, "login-error");
  await signIn(page, "faculty@demo.psits.test");
  assert(
    await page
      .getByRole("link", { name: "My availability", exact: true })
      .isVisible(),
  );
  assert(
    await page
      .getByRole("link", { name: "My defense schedule", exact: true })
      .isVisible(),
  );
  const nav = page.getByRole("navigation", { name: "Main navigation" });
  const morePages = page.getByRole("button", {
    name: "More pages",
    exact: true,
  });
  await morePages.waitFor();
  const initialScroll = await nav.evaluate((el) => el.scrollTop);
  await morePages.click();
  assert((await nav.evaluate((el) => el.scrollTop)) > initialScroll);
  await insideViewport(nav.locator("a").last());
  await page
    .getByRole("button", { name: "Back to first pages", exact: true })
    .click();
  assert.equal(await nav.evaluate((el) => el.scrollTop), 0);
  for (const theme of ["light", "dark", "system"]) {
    const button = page.getByRole("button", {
      name: `${theme} theme`,
      exact: true,
    });
    await insideViewport(button);
    await button.click();
    assert.equal(await button.getAttribute("aria-pressed"), "true");
    await checkContrast(page);
    await checkReadableText(page);
    await noOverflow(page);
    if (theme !== "system") await screenshot(page, `faculty-${theme}`);
  }
  await insideViewport(
    page.getByRole("button", { name: "Sign out", exact: true }),
  );
  await page
    .getByRole("link", { name: "My availability", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Add availability", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.waitFor();
  await checkReadableText(page);
  const formInput = dialog
    .locator("input:not([type=checkbox]), select, textarea")
    .first();
  assert(
    await formInput.evaluate(
      (el) => parseFloat(getComputedStyle(el).fontSize) >= 16,
    ),
  );
  await screenshot(page, "availability-form");
  await page.keyboard.press("Escape");
  await dialog.waitFor({ state: "hidden" });
  await nav.getByRole("link", { name: "Notifications", exact: true }).click();
  await page
    .getByRole("heading", { name: "Notifications", exact: true })
    .waitFor();
  await insideViewport(
    nav.getByRole("link", { name: "Notifications", exact: true }),
  );
  assert.equal(
    await nav
      .getByRole("link", { name: "Notifications", exact: true })
      .getAttribute("aria-current"),
    "page",
  );
  await page.mouse.move(1000, 200);
  await screenshot(page, "notifications-desktop");
  for (const viewport of [
    { width: 1024, height: 768 },
    { width: 390, height: 844 },
    { width: 390, height: 568 },
    { width: 668, height: 318 },
  ]) {
    await page.setViewportSize(viewport);
    await noOverflow(page);
    const menu = page.getByRole("button", { name: "Open navigation" });
    await menu.click();
    assert.equal(await menu.getAttribute("aria-expanded"), "true");
    assert(
      await page
        .locator(".sidebar")
        .evaluate((el) => el.contains(document.activeElement)),
    );
    await insideViewport(
      page.getByRole("button", { name: "Sign out", exact: true }),
    );
    await page.keyboard.press("Tab");
    assert(
      await page
        .locator(".sidebar")
        .evaluate((el) => el.contains(document.activeElement)),
    );
    await page.keyboard.press("Escape");
    assert.equal(await menu.getAttribute("aria-expanded"), "false");
    assert(await menu.evaluate((el) => el === document.activeElement));
    await menu.click();
    await nav.getByRole("link", { name: "Availability", exact: true }).click();
    await page
      .getByRole("heading", { name: "Availability", exact: true })
      .waitFor();
    await page.locator(".sidebar.mobile-open").waitFor({ state: "hidden" });
    await checkReadableText(page);
    await noOverflow(page);
    await screenshot(page, `availability-${viewport.width}x${viewport.height}`);
    if (viewport.width === 390 && viewport.height === 568) {
      await page.screenshot({
        path: "output/playwright/readability-mobile-viewport.png",
      });
      await menu.click();
      await page.screenshot({
        path: "output/playwright/readability-mobile-menu.png",
      });
      await page.keyboard.press("Escape");
    }
  }
  await page.setViewportSize({ width: 1336, height: 636 });
  await page.goto(base + "/");
  await page.locator("#main-content").waitFor();
  await page.locator("html").evaluate((el) => {
    el.style.fontSize = "200%";
  });
  await insideViewport(
    page.getByRole("button", { name: "Sign out", exact: true }),
  );
  await noOverflow(page);
  await screenshot(page, "text-200-percent");
  await page.locator("html").evaluate((el) => {
    el.style.fontSize = "";
  });
  for (const viewport of [
    { width: 1336, height: 636 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    for (const path of [
      "/groups",
      "/faculty",
      "/rooms",
      "/calendar",
      "/reports",
      "/notifications",
    ]) {
      await page.goto(base + path);
      await page.locator("#main-content").waitFor();
      await checkReadableText(page);
      await noOverflow(page);
    }
  }
  await page.setViewportSize({ width: 1336, height: 636 });
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await page.getByRole("heading", { name: "Welcome back." }).waitFor();
  await screenshot(page, "login-light");
  await page.evaluate(() => localStorage.setItem("theme", "dark"));
  await page.reload();
  await page.getByRole("heading", { name: "Welcome back." }).waitFor();
  await checkContrast(page);
  await screenshot(page, "login-dark");
  await signIn(page, "coordinator@demo.psits.test");
  const settings = nav.getByRole("link", {
    name: "Settings & history",
    exact: true,
  });
  await insideViewport(settings);
  await insideViewport(
    page.getByRole("button", { name: "Sign out", exact: true }),
  );
  await settings.click();
  await page
    .getByRole("heading", { name: "Settings & history", exact: true })
    .waitFor();
  await noOverflow(page);
  await screenshot(page, "coordinator-settings");
  await page.setViewportSize({ width: 390, height: 844 });
  for (const path of ["/drafts", "/waiting", "/settings"]) {
    await page.goto(base + path);
    await page.locator("#main-content").waitFor();
    await checkReadableText(page);
    await noOverflow(page);
  }
  assert.deepEqual(errors, []);
  console.log(
    "PASS: sign-in timeout/retry, incorrect-password feedback, password visibility, real faculty/coordinator login and sign out",
  );
  console.log(
    "PASS: 18px body, minimum 14px visible text, secondary-text contrast >=4.5 in themes, visible theme labels, footer reachable at 636px height",
  );
  console.log(
    "PASS: drawer keyboard containment, Escape/focus restoration, navigation at 1024/390/668 widths, 318px short viewport, 200% text resizing, no page overflow or runtime errors",
  );
} finally {
  await browser.close();
}
