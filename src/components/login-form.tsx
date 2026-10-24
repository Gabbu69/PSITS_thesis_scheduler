"use client";
import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
export function LoginForm({ setupAvailable, message }: { setupAvailable: boolean; message: string }) {
  const [step, setStep] = useState<"password" | "totp" | "recovery">("password");
  const [error, setError] = useState(""), [busy, setBusy] = useState(false), [show, setShow] = useState(false);
  return <main className="entry-page"><section className="entry-card">
    <img src="/logo.jpg" className="entry-logo" alt="PSITS" />
    <p className="entry-brand">Thesis Scheduler</p>
    <h1>{step === "password" ? "Sign in" : step === "totp" ? "Check your authenticator" : "Use a recovery code"}</h1>
    <p>{step === "password" ? "Use the account provided by your coordinator." : step === "totp" ? "Enter the six-digit code from your authenticator app." : "Enter one of the codes you saved during setup."}</p>
    {message && step === "password" && <div className="success" role="status">{message}</div>}
    <form key={step} onSubmit={async (e) => {
      e.preventDefault(); if (busy) return; setBusy(true); setError("");
      const f = new FormData(e.currentTarget);
      const endpoint = step === "password" ? "sign-in/email" : step === "totp" ? "two-factor/verify-totp" : "two-factor/verify-backup-code";
      const body = step === "password" ? { email: String(f.get("email")).trim().toLowerCase(), password: f.get("password") } : { code: String(f.get("code")).trim() };
      try {
        const r = await fetch(`/api/auth/${endpoint}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(15000) });
        const d = await r.json().catch(() => null);
        if (!r.ok) throw new Error(r.status === 429 ? "Too many attempts. Please wait before trying again." : step === "password" ? "Email or password not recognized." : "Code not accepted. Try a new code, or sign in again if this request has expired.");
        if (d?.twoFactorRedirect) setStep("totp"); else location.href = "/";
      } catch (e) { setError(["TimeoutError", "AbortError"].includes((e as Error).name) ? "Connection timed out. Your entries have been kept; please try again." : (e as Error).message); }
      finally { setBusy(false); }
    }}>
      {step === "password" ? <>
        <label>Email<input type="email" name="email" autoComplete="username" autoCapitalize="none" spellCheck={false} required /></label>
        <label htmlFor="login-password">Password</label>
        <div className="password-field">
          <input id="login-password" type={show ? "text" : "password"} name="password" autoComplete="current-password" required />
          <button type="button" className="password-toggle" aria-label={show ? "Hide password" : "Show password"} aria-pressed={show} onClick={() => setShow(!show)}>{show ? <EyeOff size={20} /> : <Eye size={20} />}{show ? "Hide" : "Show"}</button>
        </div>
      </> : <label>{step === "totp" ? "Six-digit code" : "Recovery code"}<input autoFocus name="code" autoComplete="one-time-code" inputMode={step === "totp" ? "numeric" : "text"} pattern={step === "totp" ? "[0-9]{6}" : undefined} maxLength={step === "totp" ? 6 : 64} required /></label>}
      {error && <div role="alert" className="error">{error}</div>}
      <button className="primary" disabled={busy}>{busy ? "Checking…" : step === "password" ? "Sign in" : "Verify and sign in"}</button>
    </form>
    {step !== "password" ? <div className="entry-links">
      <button onClick={() => { setStep(step === "totp" ? "recovery" : "totp"); setError(""); }}>{step === "totp" ? "Use a recovery code" : "Use authenticator code"}</button>
      <button onClick={() => { setStep("password"); setError(""); }}>Back to sign in</button>
    </div> : <details><summary>Need an account or a password reset?</summary><p>Contact your thesis coordinator. They can create your account or issue a temporary password. An authenticator recovery code is needed if you lose your phone.</p></details>}
    {setupAvailable && <a className="text-link" href="/setup">Set up the first coordinator</a>}
  </section></main>;
}
