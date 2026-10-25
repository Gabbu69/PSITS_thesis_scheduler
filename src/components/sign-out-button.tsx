"use client";
import { useEffect, useRef, useState } from "react";
import { LogOut } from "lucide-react";

export function SignOutButton({ className, icon = false }: { className?: string; icon?: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (!dialog.current?.open) return;
      // Keep the underlying mobile drawer's keyboard handler out of this dialog.
      event.stopPropagation();
      if (event.key === "Escape") {
        event.preventDefault();
        if (!busy) dialog.current.close();
      }
    };
    document.addEventListener("keydown", handleKey, true);
    return () => document.removeEventListener("keydown", handleKey, true);
  }, [busy]);
  return <>
    <button type="button" className={className} onClick={() => { setError(""); dialog.current?.showModal(); }}>
      {icon && <LogOut size={20} aria-hidden="true" />}Sign out
    </button>
    <dialog ref={dialog} className="sign-out-dialog" aria-labelledby="sign-out-title" aria-describedby="sign-out-description"
      onKeyDown={(e) => e.stopPropagation()}
      onBlur={(e) => e.stopPropagation()}
      onCancel={(e) => { if (busy) e.preventDefault(); }}
      onClick={(e) => { if (e.target === e.currentTarget && !busy) dialog.current?.close(); }}>
      <h2 id="sign-out-title">Are you sure you want to sign out?</h2>
      <p id="sign-out-description">You’ll need your password and authenticator code to sign in again.</p>
      {error && <div className="error" role="alert">{error}</div>}
      <div className="sign-out-actions">
        <button type="button" autoFocus disabled={busy} onClick={() => dialog.current?.close()}>Cancel</button>
        <button type="button" className="primary" disabled={busy} aria-busy={busy} onClick={async () => {
          if (busy) return;
          setBusy(true); setError("");
          try {
            const response = await fetch("/api/auth/sign-out", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}", signal: AbortSignal.timeout(15000) });
            if (!response.ok) throw new Error("Sign out failed. Please try again.");
            location.href = "/login";
          } catch { setError("Could not sign out. Check your connection and try again."); }
          finally { setBusy(false); }
        }}>{busy ? "Signing out…" : "Sign out"}</button>
      </div>
    </dialog>
  </>;
}
