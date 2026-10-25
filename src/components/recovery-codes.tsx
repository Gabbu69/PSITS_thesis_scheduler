"use client";
import { useEffect, useState } from "react";

export function RecoveryCodes({ codes, email, onDone }: { codes: string[]; email: string; onDone: () => void }) {
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    if (saved) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [saved]);
  return <>
    <h2>Save your recovery codes</h2>
    <p>Each code works once if you lose your phone. Keep them somewhere private. These codes are shown only now.</p>
    <div className="backup-codes">{codes.map((code) => <code key={code}>{code}</code>)}</div>
    <button type="button" onClick={() => {
      const url = URL.createObjectURL(new Blob([`PSITS Thesis Scheduler\n${email}\nRecovery codes - keep private\n\n${codes.join("\n")}\n`], { type: "text/plain" }));
      const link = document.createElement("a");
      link.href = url; link.download = "psits-recovery-codes.txt";
      document.body.appendChild(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }}>Download recovery codes</button>
    <label className="check-label"><input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} />I have saved my recovery codes</label>
    <button type="button" className="primary" disabled={!saved} onClick={onDone}>Continue to home</button>
  </>;
}
