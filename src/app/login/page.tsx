"use client";
import { useState } from "react";
import {
  CalendarDays,
  ArrowRight,
  ShieldCheck,
  Users,
  Clock3,
} from "lucide-react";
export default function Login() {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <main className="login">
      <section className="login-story">
        <div className="brand">
          <img src="/logo.jpg" alt="PSITS" />
          <div>
            PSITS<span>THESIS DEFENSE SCHEDULER</span>
          </div>
        </div>
        <div>
          <span className="eyebrow">LESS BACK-AND-FORTH. MORE PROGRESS.</span>
          <h1>
            A common time.
            <br />A clear next step.
          </h1>
          <p>
            Bring your group, your professors, and your defense together. All in
            one shared schedule.
          </p>
          <div className="login-points">
            <span>
              <Users /> Everyone’s availability
            </span>
            <span>
              <Clock3 /> Conflicts caught early
            </span>
            <span>
              <ShieldCheck /> Coordinator-approved schedules
            </span>
          </div>
        </div>
        <small>One college. One coordinated defense journey.</small>
      </section>
      <section className="login-panel">
        <div className="login-form">
          <div className="icon-tile">
            <CalendarDays size={27} />
          </div>
          <span className="eyebrow">YOUR DEFENSE, ORGANIZED</span>
          <h2>Welcome back.</h2>
          <p>Sign in to your college workspace.</p>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError("");
              const f = new FormData(e.currentTarget);
              try {
                const r = await fetch("/api/auth/sign-in/email", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    email: f.get("email"),
                    password: f.get("password"),
                  }),
                });
                const d = await r.json();
                if (!r.ok) throw new Error(d.message ?? "Unable to sign in");
                location.href = "/";
              } catch (e) {
                setError((e as Error).message);
                setBusy(false);
              }
            }}
          >
            <label>
              College email
              <input
                type="email"
                name="email"
                autoComplete="username"
                required
                placeholder="you@college.edu"
              />
            </label>
            <label>
              Password
              <input
                type="password"
                name="password"
                autoComplete="current-password"
                required
                placeholder="Enter your password"
              />
            </label>
            {error && (
              <div role="alert" className="error">
                {error}
              </div>
            )}
            <button className="primary" disabled={busy}>
              {busy ? "Signing in…" : "Sign in to workspace"}
              <ArrowRight size={17} />
            </button>
          </form>
          <div className="note">
            Accounts are provided by your thesis coordinator.
            <br />
            Fictional demo accounts are documented in the README.
          </div>
        </div>
      </section>
    </main>
  );
}
