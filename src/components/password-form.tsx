"use client";
import { useState } from "react";
import { SignOutButton } from "./sign-out-button";
export function PasswordForm({ required }: { required: boolean }) {
  const [error, setError] = useState(""), [busy, setBusy] = useState(false);
  return <main className="entry-page"><section className="entry-card">
    <h1>{required ? "Choose your password" : "Change password"}</h1>
    <p>{required ? "Replace your temporary password to continue." : "You’ll sign in again after saving."}</p>
    <form onSubmit={async (e) => {
      e.preventDefault(); if (busy) return; const f = new FormData(e.currentTarget); setError("");
      if (f.get("password") !== f.get("confirm")) { setError("Passwords do not match."); return; }
      setBusy(true);
      try {
        const r = await fetch("/api/account/password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(Object.fromEntries(f)), signal: AbortSignal.timeout(20000) });
        const d = await r.json(); if (!r.ok) throw new Error(d.error);
        location.href = "/login?password=changed";
      } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
    }}>
      <label>Current password<input name="current" type="password" required maxLength={128} autoComplete="current-password" /></label>
      <label>New password<input name="password" type="password" required minLength={12} maxLength={128} autoComplete="new-password" /><small>At least 12 characters.</small></label>
      <label>Confirm new password<input name="confirm" type="password" required minLength={12} autoComplete="new-password" /></label>
      {error && <div role="alert" className="error">{error}</div>}
      <button disabled={busy} className="primary">{busy ? "Saving…" : "Save password"}</button>
    </form>
    {!required && <a href="/" className="text-link">Back to home</a>}
    {required && <SignOutButton className="text-link" />}
  </section></main>;
}
