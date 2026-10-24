import assert from "node:assert/strict";
import { readFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
const base = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
const hash = (data) => createHash("sha256").update(data).digest("hex");
for (const name of [
  "logo.jpg",
  "favicon.ico",
  "apple-touch-icon.png",
  "icon-192.png",
  "icon-512.png",
]) {
  const response = await fetch(base + "/" + name);
  assert.equal(response.status, 200, name);
  assert.equal(
    hash(Buffer.from(await response.arrayBuffer())),
    hash(await readFile("public/" + name)),
    "Deployed asset differs: " + name,
  );
}
const response = await fetch(base + "/login");
assert.equal(response.status, 200);
const html = await response.text();
assert(html.includes("Thesis Defense Scheduler · PSITS"));
assert.match(html, /rel="icon"[^>]+href="\/favicon.ico"/);
assert.match(html, /rel="apple-touch-icon"[^>]+href="\/apple-touch-icon.png"/);
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE ?? "playwright"
);
const browser = await chromium.launch({
  channel: process.env.BROWSER_CHANNEL ?? "msedge",
  headless: true,
  args: ["--disable-gpu"],
});
try {
  const page = await browser.newPage({
    viewport: { width: 1336, height: 768 },
  });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(base + "/login");
  const logo = page.getByRole("img", { name: "PSITS", exact: true });
  await logo.waitFor();
  assert(await logo.evaluate((el) => el.complete && el.naturalWidth > 0));
  assert.equal(
    await page.locator('link[rel="shortcut icon"]').getAttribute("href"),
    "/favicon.ico",
  );
  await mkdir("output/playwright", { recursive: true });
  await page.screenshot({
    path: "output/playwright/hosted-login-psits.png",
    fullPage: true,
  });
  assert.deepEqual(errors, []);
  console.log(
    "PASS branding: PSITS logo and all icon assets match source hashes; live metadata, favicon and rendered login logo verified",
  );
} finally {
  await browser.close();
}
