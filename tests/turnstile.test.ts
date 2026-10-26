import { test } from "node:test";
import assert from "node:assert/strict";
import { turnstileConfigured, verifyTurnstile } from "../src/lib/turnstile";

test("Turnstile fails closed for missing, failed, expired, foreign-host and foreign-action tokens", async () => {
  const saved = { ...process.env };
  try {
    process.env.BETTER_AUTH_URL = "https://scheduler.college.edu";
    delete process.env.TURNSTILE_SITE_KEY; delete process.env.TURNSTILE_SECRET_KEY;
    assert.equal(turnstileConfigured(), false);
    await assert.rejects(verifyTurnstile("token", "login"));
    process.env.TURNSTILE_SITE_KEY = "real-site"; process.env.TURNSTILE_SECRET_KEY = "real-secret";
    await assert.rejects(verifyTurnstile(null, "login"));
    await assert.rejects(verifyTurnstile("a".repeat(2049), "login"));
    for (const result of [{ success: false }, { success: true, hostname: "foreign.edu", action: "login" }, { success: true, hostname: "scheduler.college.edu", action: "password_reset" }]) {
      await assert.rejects(verifyTurnstile("token", "login", (async () => Response.json(result)) as typeof fetch));
    }
    await assert.rejects(verifyTurnstile("token", "login", (async () => { throw new Error("network"); }) as typeof fetch));
    await verifyTurnstile("token", "login", (async (url, options) => {
      assert.equal(url, "https://challenges.cloudflare.com/turnstile/v0/siteverify");
      assert.equal(JSON.parse(String(options?.body)).response, "token");
      return Response.json({ success: true, hostname: "scheduler.college.edu", action: "login" });
    }) as typeof fetch);
    process.env.TURNSTILE_SITE_KEY = "1x00000000000000000000AA";
    process.env.TURNSTILE_SECRET_KEY = "1x0000000000000000000000000000000AA";
    assert.equal(turnstileConfigured(), false, "dummy keys must not enable a hosted app");
    process.env.BETTER_AUTH_URL = "http://localhost:3100";
    assert.equal(turnstileConfigured(), true);
  } finally { process.env = saved; }
});
