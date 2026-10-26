"use client";
import { useState } from "react";
import { TurnstileWidget } from "./turnstile-widget";
export function RecoveryForm({ siteKey }: { siteKey: string }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [token, setToken] = useState(""), [attempt, setAttempt] = useState(0);
  return <main className="entry-page"><section className="entry-card">
    <img src="/logo.jpg" className="entry-logo" alt="PSITS" /><h1>Reset your password</h1>
    <p>Use your connected authenticator app to choose a fresh password. You’ll sign in again after saving.</p>
    <form onSubmit={async (event) => {
      event.preventDefault(); if (busy || !token) return;
      const form = new FormData(event.currentTarget); setError("");
      if (form.get("password") !== form.get("confirm")) { setError("Passwords do not match."); return; }
      setBusy(true);
      try {
        const response = await fetch("/api/account/recover", { method: "POST", headers: { "Content-Type": "application/json", "x-captcha-response": token }, body: JSON.stringify({ email: form.get("email"), code: form.get("code"), password: form.get("password") }), signal: AbortSignal.timeout(30000) });
        const data = await response.json(); if (!response.ok) throw new Error(data.error ?? "Could not reset password. Please try again.");
        location.href = "/login?password=changed";
      } catch (error) { setError(["TimeoutError", "AbortError"].includes((error as Error).name) ? "Connection timed out. Try signing in with your new password before retrying the reset." : (error as Error).message); }
      finally { setBusy(false); setToken(""); setAttempt(attempt + 1); }
    }}>
      <label>Email<input name="email" type="email" autoComplete="username" autoCapitalize="none" spellCheck={false} maxLength={254} required /></label>
      <label>New password<input name="password" type="password" minLength={12} maxLength={128} autoComplete="new-password" required /><small>At least 12 characters. Different from your current and last five passwords.</small></label>
      <label>Confirm new password<input name="confirm" type="password" minLength={12} maxLength={128} autoComplete="new-password" required /></label>
      <label>Authenticator code<input name="code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} autoComplete="one-time-code" required /><small>Enter the latest six-digit code from your app just before saving.</small></label>
      {siteKey ? <TurnstileWidget key={attempt} siteKey={siteKey} action="password_reset" onToken={setToken} /> : <div role="alert" className="error">Password recovery security is being configured. Please contact your coordinator.</div>}
      {error && <div className="error" role="alert">{error}</div>}
      <button className="primary" disabled={busy || !token} aria-busy={busy}>{busy ? "Saving new password…" : "Save new password"}</button>
    </form>
    <a href="/login" className="text-link">Back to sign in</a>
    <details><summary>Can’t access your authenticator?</summary><p>Contact your coordinator to verify your identity and receive a temporary password privately. Old recovery codes cannot be used to sign in.</p></details>
  </section></main>;
}
