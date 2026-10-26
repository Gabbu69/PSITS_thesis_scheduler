"use client";
import Script from "next/script";
import { useEffect, useRef, useState } from "react";

type Turnstile = { render: (container: HTMLElement, options: Record<string, unknown>) => string; remove: (id: string) => void };
declare global { interface Window { turnstile?: Turnstile } }
export function TurnstileWidget({ siteKey, action, onToken }: { siteKey: string; action: "login" | "password_reset"; onToken: (token: string) => void }) {
  const container = useRef<HTMLDivElement>(null), callback = useRef(onToken);
  callback.current = onToken;
  const [ready, setReady] = useState(false), [error, setError] = useState(""), [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!ready || !container.current || !window.turnstile) return;
    const widget = window.turnstile.render(container.current, {
      sitekey: siteKey, action, theme: "auto", size: container.current.clientWidth < 300 ? "compact" : "flexible",
      callback: (token: string) => { setError(""); callback.current(token); },
      "expired-callback": () => { callback.current(""); setError("Security check expired. Please retry the check."); },
      "error-callback": () => { callback.current(""); setError("Security check could not load. Check your connection and retry."); },
      "timeout-callback": () => { callback.current(""); setError("Security check timed out. Please retry the check."); },
    });
    return () => { window.turnstile?.remove(widget); };
  }, [ready, siteKey, action, retry]);
  return <div className="turnstile-check">
    <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" onReady={() => setReady(true)} onError={() => setError("Security check could not load. Check your connection and reload the page.")} />
    <div ref={container} />
    {!ready && !error && <p role="status">Loading security check…</p>}
    {error && <div role="alert"><p>{error}</p><button type="button" onClick={() => { callback.current(""); setError(""); if (ready) setRetry(retry + 1); else location.reload(); }}>Retry security check</button></div>}
  </div>;
}
