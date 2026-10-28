"use client";
import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { TurnstileWidget } from "./turnstile-widget";
import { ClassScheduleBoard } from "./class-schedule-board";
export function LoginForm({ setupAvailable, message, siteKey }: { setupAvailable: boolean; message: string; siteKey: string }) {
  const [error, setError] = useState(""), [busy, setBusy] = useState(false), [show, setShow] = useState(false);
  const [token, setToken] = useState(""), [attempt, setAttempt] = useState(0);
  return <main className="login-layout"><section className="entry-card login-card" aria-labelledby="login-heading">
    <img src="/logo.jpg" className="entry-logo" alt="PSITS" />
    <p className="entry-brand">Thesis Scheduler</p><h1 id="login-heading">Sign in</h1>
    <p>Use the account provided by your coordinator.</p>
    <a className="text-link login-board-link" href="#class-schedules-board">View faculty schedules</a>
    {message && <div className="success" role="status">{message}</div>}
    <form onSubmit={async (e) => {
      e.preventDefault(); if (busy || !token) return; setBusy(true); setError("");
      const f = new FormData(e.currentTarget);
      try {
        const r = await fetch("/api/auth/sign-in/email", { method: "POST", headers: { "Content-Type": "application/json", "x-captcha-response": token }, body: JSON.stringify({ email: String(f.get("email")).trim().toLowerCase(), password: f.get("password") }), signal: AbortSignal.timeout(20000) });
        const d = await r.json().catch(() => null);
        if (!r.ok) throw new Error(r.status === 429 ? "Too many attempts. Please wait before trying again." : d?.code === "TURNSTILE_FAILED" ? d.message : "Email or password not recognized.");
        location.href = "/";
      } catch (e) { setError(["TimeoutError", "AbortError"].includes((e as Error).name) ? "Connection timed out. Your entries have been kept; please try again." : (e as Error).message); }
      finally { setBusy(false); setToken(""); setAttempt(attempt + 1); }
    }}>
      <label>Email<input type="email" name="email" autoComplete="username" autoCapitalize="none" spellCheck={false} maxLength={254} required /></label>
      <label htmlFor="login-password">Password</label>
      <div className="password-field">
        <input id="login-password" type={show ? "text" : "password"} name="password" autoComplete="current-password" maxLength={128} required />
        <button type="button" className="password-toggle" aria-label={show ? "Hide password" : "Show password"} aria-pressed={show} onClick={() => setShow(!show)}>{show ? <EyeOff size={20} /> : <Eye size={20} />}{show ? "Hide" : "Show"}</button>
      </div>
      {siteKey ? <TurnstileWidget key={attempt} siteKey={siteKey} action="login" onToken={setToken} /> : <div role="alert" className="error">Sign-in security is being configured. Please contact your coordinator.</div>}
      {error && <div role="alert" className="error">{error}</div>}
      <button className="primary" disabled={busy || !token} aria-busy={busy}>{busy ? "Signing in…" : "Sign in"}</button>
    </form>
    <a className="text-link" href="/forgot-password">Forgot password?</a>
    <details><summary>Need an account?</summary><p>Contact your thesis coordinator for your own account. Your authenticator is used only when resetting a forgotten password.</p></details>
    {setupAvailable && <a className="text-link" href="/setup">Set up the first coordinator</a>}
  </section><ClassScheduleBoard /></main>;
}
