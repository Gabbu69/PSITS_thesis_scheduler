"use client";
import { useState } from "react";
import QRCode from "react-qr-code";
export function SecurityForm({ enabled, email }: { enabled: boolean; email: string }) {
  const [error, setError] = useState(""), [busy, setBusy] = useState(false);
  const [enrollment, setEnrollment] = useState<{ totpURI: string; backupCodes: string[] } | null>(null);
  const [verified, setVerified] = useState(false), [saved, setSaved] = useState(false);
  async function post(path: string, body: object) {
    const r = await fetch(`/api/auth/two-factor/${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(20000) });
    const d = await r.json(); if (!r.ok) throw new Error(r.status === 429 ? "Too many attempts. Wait 15 minutes and try again." : d.message ?? "Please check your details and try again.");
    return d;
  }
  return <main className="entry-page"><section className="entry-card security-card">
    <img src="/logo.jpg" alt="PSITS" className="entry-logo" />
    <h1>{verified || enabled ? "Account security" : "Set up your authenticator"}</h1>
    <p>{email}</p>
    {enabled && !enrollment ? <>
      <div className="success">Authenticator is connected.</div>
      <a href="/" className="button primary">Back to home</a>
      <a href="/account" className="text-link">Change password</a>
    </> : !enrollment ? <>
      <p>Open Google Authenticator, Microsoft Authenticator, or another authenticator app on your phone.</p>
      <form onSubmit={async (e) => {
        e.preventDefault(); setBusy(true); setError("");
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
        e.preventDefault(); setBusy(true); setError("");
        try { await post("verify-totp", { code: new FormData(e.currentTarget).get("code") }); setVerified(true); }
        catch { setError("Code not accepted. Use the latest six-digit code from your app."); } finally { setBusy(false); }
      }}>
        <label>Six-digit code<input name="code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required autoComplete="one-time-code" /></label>
        <button className="primary" disabled={busy}>{busy ? "Checking…" : "Verify authenticator"}</button>
      </form>
    </> : <>
      <div className="success">Authenticator connected.</div>
      <h2>Save your recovery codes</h2>
      <p>Each code works once if you lose your phone. Keep them somewhere private.</p>
      <div className="backup-codes">{enrollment.backupCodes.map((code) => <code key={code}>{code}</code>)}</div>
      <button onClick={() => {
        const url = URL.createObjectURL(new Blob([`PSITS Thesis Scheduler\n${email}\nRecovery codes - keep private\n\n${enrollment.backupCodes.join("\n")}\n`], { type: "text/plain" }));
        const a = document.createElement("a"); a.href = url; a.download = "psits-recovery-codes.txt"; a.click(); URL.revokeObjectURL(url);
      }}>Download recovery codes</button>
      <label className="check-label"><input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} />I have saved my recovery codes</label>
      <button className="primary" disabled={!saved} onClick={() => { location.href = "/"; }}>Continue to home</button>
    </>}
    {error && <div role="alert" className="error">{error}</div>}
    {!(enabled || verified) && <button onClick={async () => { await fetch("/api/auth/sign-out", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }); location.href = "/login"; }}>Sign out</button>}
  </section></main>;
}
