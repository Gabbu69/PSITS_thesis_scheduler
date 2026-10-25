"use client";
import { useState } from "react";
import { SignOutButton } from "./sign-out-button";
import QRCode from "react-qr-code";
import { RecoveryCodes } from "./recovery-codes";
export function SecurityForm({ enabled, email }: { enabled: boolean; email: string }) {
  const [error, setError] = useState(""), [busy, setBusy] = useState(false);
  const [enrollment, setEnrollment] = useState<{ totpURI: string; backupCodes: string[] } | null>(null);
  const [verified, setVerified] = useState(false);
  const [replacementCodes, setReplacementCodes] = useState<string[] | null>(null);
  async function post(path: string, body: object) {
    const r = await fetch(`/api/auth/two-factor/${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(20000) });
    const d = await r.json(); if (!r.ok) throw new Error(r.status === 429 ? "Too many attempts. Wait 15 minutes and try again." : d.message ?? "Please check your details and try again.");
    return d;
  }
  return <main className="entry-page"><section className="entry-card security-card">
    <img src="/logo.jpg" alt="PSITS" className="entry-logo" />
    <h1>{verified || enabled ? "Account security" : "Set up your authenticator"}</h1>
    <p>{email}</p>
    {replacementCodes ? <>
      <div className="success" role="status">New recovery codes created. Your previous recovery codes no longer work.</div>
      <RecoveryCodes codes={replacementCodes} email={email} onDone={() => { location.href = "/"; }} />
    </> : enabled && !enrollment ? <>
      <div className="success">Authenticator is connected.</div>
      <a href="/" className="button primary">Back to home</a>
      <a href="/account" className="text-link">Change password</a>
      <details><summary>Replace recovery codes</summary>
        <p>Create a new set if your saved codes are lost or running low. Your previous recovery codes will stop working immediately. Your authenticator stays connected.</p>
        <form onSubmit={async (e) => {
          e.preventDefault(); if (busy) return;
          const password = new FormData(e.currentTarget).get("password");
          setBusy(true); setError("");
          try { const result = await post("generate-backup-codes", { password }); setReplacementCodes(result.backupCodes); }
          catch { setError("Could not replace recovery codes. Check your password and connection, then try again. If you have tried repeatedly, wait 15 minutes."); }
          finally { setBusy(false); }
        }}>
          <label>Confirm your password<input type="password" name="password" autoComplete="current-password" required maxLength={128} /></label>
          <button className="primary" disabled={busy} aria-busy={busy}>{busy ? "Creating codes…" : "Replace recovery codes"}</button>
        </form>
      </details>
    </> : !enrollment ? <>
      <p>Open Google Authenticator, Microsoft Authenticator, or another authenticator app on your phone.</p>
      <form onSubmit={async (e) => {
        e.preventDefault(); if (busy) return; setBusy(true); setError("");
        try { setEnrollment(await post("enable", { password: new FormData(e.currentTarget).get("password") })); }
        catch (e) { setError((e as Error).message); } finally { setBusy(false); }
      }}>
        <label>Confirm your password<input name="password" type="password" required autoComplete="current-password" /></label>
        <button className="primary" disabled={busy}>{busy ? "Preparing…" : "Connect authenticator"}</button>
      </form>
    </> : !verified ? <>
      <h2>1. Scan this QR code</h2>
      <div className="auth-qr"><QRCode value={enrollment.totpURI} size={208} /></div>
      <details><summary>Can’t scan? Enter a setup key</summary><p>In your authenticator, choose “Enter a setup key” and “Time based”.</p><code className="secret-key">{new URL(enrollment.totpURI).searchParams.get("secret")}</code></details>
      <h2>2. Enter the code from your app</h2>
      <form onSubmit={async (e) => {
        e.preventDefault(); if (busy) return; setBusy(true); setError("");
        try { await post("verify-totp", { code: new FormData(e.currentTarget).get("code") }); setVerified(true); }
        catch { setError("Code not accepted. Use the latest six-digit code from your app."); } finally { setBusy(false); }
      }}>
        <label>Six-digit code<input name="code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required autoComplete="one-time-code" /></label>
        <button className="primary" disabled={busy}>{busy ? "Checking…" : "Verify authenticator"}</button>
      </form>
    </> : <>
      <div className="success">Authenticator connected.</div>
      <RecoveryCodes codes={enrollment.backupCodes} email={email} onDone={() => { location.href = "/"; }} />
    </>}
    {error && <div role="alert" className="error">{error}</div>}
    {!(enabled || verified) && <SignOutButton />}
  </section></main>;
}
