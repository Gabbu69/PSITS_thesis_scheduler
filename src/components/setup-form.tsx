"use client";
import { useState } from "react";
import Link from "next/link";

export function SetupForm() {
  const [error, setError] = useState(""), [busy, setBusy] = useState(false);
  return <main className="entry-page"><section className="entry-card">
    <img src="/logo.jpg" alt="PSITS" className="entry-logo" />
    <h1>Set up your college</h1>
    <p>Create the first coordinator account.</p>
    <form onSubmit={async (e) => {
      e.preventDefault(); setBusy(true); setError("");
      const form = new FormData(e.currentTarget);
      if (form.get("password") !== form.get("confirm")) { setError("Passwords do not match."); setBusy(false); return; }
      try {
        const r = await fetch("/api/setup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(Object.fromEntries(form)), signal: AbortSignal.timeout(20000) });
        const d = await r.json(); if (!r.ok) throw new Error(d.error);
        location.href = "/login?setup=complete";
      } catch (e) { setError((e as Error).name === "TimeoutError" ? "Connection timed out. Please try again." : (e as Error).message); }
      finally { setBusy(false); }
    }}>
      <label>Setup key<input name="key" type="password" required minLength={32} autoComplete="off" /><small>Use the private key provided by the app owner.</small></label>
      <label>College name<input name="college" required maxLength={200} autoComplete="organization" /></label>
      <label>Your full name<input name="name" required maxLength={200} autoComplete="name" /></label>
      <label>Your email<input name="email" type="email" required autoComplete="username" /></label>
      <label>Password<input name="password" type="password" required minLength={12} maxLength={128} autoComplete="new-password" /><small>At least 12 characters.</small></label>
      <label>Confirm password<input name="confirm" type="password" required minLength={12} autoComplete="new-password" /></label>
      {error && <div role="alert" className="error">{error}</div>}
      <button disabled={busy} className="primary">{busy ? "Creating workspace…" : "Create workspace"}</button>
    </form>
    <Link href="/login" className="text-link">Back to sign in</Link>
  </section></main>;
}
