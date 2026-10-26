"use client";
import { useState } from "react";
import { SignOutButton } from "./sign-out-button";
import QRCode from "react-qr-code";
export function SecurityForm({ enabled, email }: { enabled: boolean; email: string }) {
  const [error, setError] = useState(""), [busy, setBusy] = useState(false);
  const [uri, setUri] = useState("");
  const [verified, setVerified] = useState(false);
  async function post(path: string, body: object) {
    const r = await fetch(`/api/auth/two-factor/${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(20000) });
    const d = await r.json(); if (!r.ok) throw new Error(r.status === 429 ? "Too many attempts. Wait before trying again." : d.message ?? "Please check your details and try again.");
    return d;
  }
  return <main className="entry-page"><section className="entry-card security-card">
    <img src="/logo.jpg" alt="PSITS" className="entry-logo" />
    <h1>{verified || enabled ? "Account security" : "Set up password recovery"}</h1><p>{email}</p>
    {verified || enabled ? <>
      <div className="success" role="status">Your authenticator is connected for password recovery.</div>
      <p>Daily sign-in uses your email, password, and Cloudflare Turnstile. Your authenticator code is only needed if you forget your password.</p>
      <a href="/" className="button primary">Back to home</a><a href="/account" className="text-link">Change password</a>
    </> : !uri ? <>
      <p>Connect Google Authenticator, Microsoft Authenticator, or another authenticator app once so you can reset a forgotten password. You won’t need a code for daily sign-in.</p>
      <form onSubmit={async (e) => {
        e.preventDefault(); if (busy) return; setBusy(true); setError("");
        try { setUri((await post("enable", { password: new FormData(e.currentTarget).get("password") })).totpURI); }
        catch (e) { setError((e as Error).message); } finally { setBusy(false); }
      }}><label>Confirm your password<input name="password" type="password" maxLength={128} required autoComplete="current-password" /></label><button className="primary" disabled={busy}>{busy ? "Preparing…" : "Connect authenticator"}</button></form>
    </> : <>
      <h2>1. Scan this QR code</h2><div className="auth-qr"><QRCode value={uri} size={208} /></div>
      <details><summary>Can’t scan? Enter a setup key</summary><p>In your authenticator, choose “Enter a setup key” and “Time based”.</p><code className="secret-key">{new URL(uri).searchParams.get("secret")}</code></details>
      <h2>2. Confirm your recovery app</h2>
      <form onSubmit={async (e) => {
        e.preventDefault(); if (busy) return; setBusy(true); setError("");
        try { await post("verify-totp", { code: new FormData(e.currentTarget).get("code") }); setVerified(true); }
        catch { setError("Code not accepted. Use the latest six-digit code from your app."); } finally { setBusy(false); }
      }}><label>Six-digit code<input name="code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required autoComplete="one-time-code" /></label><button className="primary" disabled={busy}>{busy ? "Checking…" : "Verify authenticator"}</button></form>
    </>}
    {error && <div role="alert" className="error">{error}</div>}
    {!(enabled || verified) && <SignOutButton />}
  </section></main>;
}
