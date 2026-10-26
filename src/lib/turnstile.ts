// Cloudflare requires server-side validation; tokens expire after five minutes and work once.
// https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
export class TurnstileError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
const testKey = /^[123]x0{20,}/;
export function turnstileConfigured() {
  const site = process.env.TURNSTILE_SITE_KEY;
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!site || !secret) return false;
  // Official dummy keys are only accepted on an explicitly configured local server.
  const local = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/?$/.test(process.env.BETTER_AUTH_URL ?? "");
  return local || (!testKey.test(site) && !testKey.test(secret));
}
export async function verifyTurnstile(token: string | null, action: "login" | "password_reset", fetcher: typeof fetch = fetch) {
  if (!turnstileConfigured()) throw new TurnstileError("Sign-in security is being configured. Please contact your coordinator.", 503);
  if (!token || token.length > 2048) throw new TurnstileError("Complete the security check and try again.");
  try {
    const response = await fetcher("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret: process.env.TURNSTILE_SECRET_KEY, response: token }),
      signal: AbortSignal.timeout(10000),
    });
    const data = await response.json();
    const hostname = new URL(process.env.BETTER_AUTH_URL!).hostname;
    const localTest = ["localhost", "127.0.0.1"].includes(hostname) && testKey.test(process.env.TURNSTILE_SECRET_KEY!);
    if (!response.ok || data.success !== true || (!localTest && (data.action !== action || data.hostname !== hostname)))
      throw new TurnstileError("Security check expired or was not accepted. Please try again.");
  } catch (error) {
    if (error instanceof TurnstileError) throw error;
    throw new TurnstileError("Security check is unavailable. Please try again shortly.", 503);
  }
}
