import assert from "node:assert/strict";
import { readFile, mkdir } from "node:fs/promises";
import { createHmac } from "node:crypto";
import { PrismaClient } from "@prisma/client";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? "playwright");
const base = process.env.BETTER_AUTH_URL;
assert(new URL(base).hostname === "localhost" && /test/.test(new URL(process.env.DATABASE_URL).pathname), "Isolated localhost test database required.");
const users = JSON.parse(await readFile(process.env.QA_ACCOUNTS_FILE ?? "tmp/real-auth-qa-accounts.json", "utf8"));
function code(uri) {
  let bits = "";
  for (const c of new URL(uri).searchParams.get("secret")) bits += "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567".indexOf(c).toString(2).padStart(5, "0");
  const key = Buffer.from(bits.match(/.{8}/g).map((b) => parseInt(b, 2))), t = Buffer.alloc(8);
  t.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)));
  const h = createHmac("sha1", key).update(t).digest(), i = h[h.length - 1] & 15;
  return String((h.readUInt32BE(i) & 0x7fffffff) % 1000000).padStart(6, "0");
}
const db = new PrismaClient();
const browser = await chromium.launch({ channel: "msedge", headless: true, args: ["--disable-gpu"] });
await mkdir("output/playwright", { recursive: true });
let restore;
try {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const p = await ctx.newPage();
  const errors = []; p.on("pageerror", (e) => errors.push(e.message));
  let requests = 0; p.on("request", (r) => { if (r.url().endsWith("/api/auth/sign-out")) requests++; });
  async function login(u, mfa = true) {
    await p.goto(base + "/login");
    await p.getByLabel("Email", { exact: true }).fill(u.email);
    await p.getByLabel("Password", { exact: true }).fill(u.password);
    await p.getByRole("button", { name: "Sign in", exact: true }).click();
    if (mfa) {
      await p.getByLabel("Six-digit code", { exact: true }).fill(code(u.totpURI));
      await p.getByRole("button", { name: "Verify and sign in" }).click();
    }
  }
  await login(users.coordinator);
  await p.locator("#main-content").waitFor();
  await p.locator(".profile-trigger").click();
  await p.getByRole("button", { name: "Sign out", exact: true }).click();
  const dialog = p.getByRole("dialog", { name: "Are you sure you want to sign out?" });
  await dialog.waitFor(); assert.equal(requests, 0);
  assert(await dialog.getByRole("button", { name: "Cancel", exact: true }).evaluate((el) => el === document.activeElement));
  await dialog.screenshot({ path: "output/playwright/sign-out-confirmation.png" });
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await dialog.waitFor({ state: "hidden" }); assert.equal(requests, 0);
  assert.equal((await ctx.request.get(base + "/api/data")).status(), 200);
  await p.getByRole("button", { name: "Sign out", exact: true }).click();
  await p.keyboard.press("Escape"); await dialog.waitFor({ state: "hidden" }); assert.equal(requests, 0);
  assert(await p.getByRole("button", { name: "Sign out", exact: true }).evaluate((el) => el === document.activeElement));
  await p.getByRole("button", { name: "Sign out", exact: true }).click();
  await p.mouse.click(5, 5); await dialog.waitFor({ state: "hidden" }); assert.equal(requests, 0);
  await p.setViewportSize({ width: 375, height: 667 });
  await p.getByRole("button", { name: "Open navigation", exact: true }).click();
  if (!await p.getByRole("button", { name: "Sign out", exact: true }).isVisible()) await p.locator(".profile-trigger").click();
  await p.getByRole("button", { name: "Sign out", exact: true }).click();
  await dialog.waitFor(); assert(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  await p.keyboard.press("Escape"); await dialog.waitFor({ state: "hidden" });
  assert(await p.getByRole("button", { name: "Close navigation", exact: true }).isVisible());
  await p.getByRole("button", { name: "Sign out", exact: true }).click();
  await p.route("**/api/auth/sign-out", (route) => route.fulfill({ status: 500, contentType: "application/json", body: "{}" }));
  await dialog.getByRole("button", { name: "Sign out", exact: true }).click();
  await dialog.getByRole("alert").waitFor(); assert(!p.url().includes("/login"));
  await p.unroute("**/api/auth/sign-out");
  await dialog.getByRole("button", { name: "Sign out", exact: true }).click();
  await p.waitForURL("**/login"); assert.equal((await ctx.request.get(base + "/api/data")).status(), 401);
  console.log("PASS workspace: Cancel, default focus, Escape, backdrop, focus restoration, mobile drawer, failed request, retry, and confirmed session revocation.");
  await new Promise((r) => setTimeout(r, 11000));
  const student = users.people.find((u) => u.role === "STUDENT");
  const original = await db.user.findUniqueOrThrow({ where: { id: student.userId } }); restore = original;
  assert(original.email.endsWith("@scheduler-qa.ac"));
  await db.user.update({ where: { id: original.id }, data: { mustChangePassword: true } });
  await login(student); await p.waitForURL("**/account");
  await p.getByRole("button", { name: "Sign out", exact: true }).click(); await dialog.waitFor();
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click(); assert(p.url().endsWith("/account"));
  await p.getByRole("button", { name: "Sign out", exact: true }).click(); await dialog.getByRole("button", { name: "Sign out", exact: true }).click(); await p.waitForURL("**/login");
  await db.user.update({ where: { id: original.id }, data: { mustChangePassword: false, twoFactorEnabled: false } });
  await login(student, false); await p.waitForURL("**/security");
  await p.getByRole("button", { name: "Sign out", exact: true }).click(); await dialog.waitFor(); await p.keyboard.press("Escape"); await dialog.waitFor({ state: "hidden" });
  await p.getByRole("button", { name: "Sign out", exact: true }).click(); await dialog.getByRole("button", { name: "Sign out", exact: true }).click(); await p.waitForURL("**/login");
  console.log("PASS password and authenticator setup pages: sign-out confirmation, cancellation, and confirmed logout.");
  assert.deepEqual(errors, []); console.log("PASS no browser runtime errors; only isolated QA account flags were temporarily changed.");
} finally {
  if (restore) await db.user.update({ where: { id: restore.id }, data: { mustChangePassword: restore.mustChangePassword, twoFactorEnabled: restore.twoFactorEnabled } });
  await browser.close(); await db.$disconnect();
}
