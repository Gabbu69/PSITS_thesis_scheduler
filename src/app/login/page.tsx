"use client";
import { useState } from "react";
import {
  CalendarDays,
  ArrowRight,
  ShieldCheck,
  Users,
  Clock3,
  Eye,
  EyeOff,
} from "lucide-react";
export default function Login() {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [showPassword, setShowPassword] = useState(false);
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
              if (busy) return;
              setBusy(true);
              setError("");
              const f = new FormData(e.currentTarget);
              const controller = new AbortController();
              const timeout = setTimeout(() => controller.abort(), 15000);
              try {
                const r = await fetch("/api/auth/sign-in/email", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  signal: controller.signal,
                  body: JSON.stringify({
                    email: f.get("email"),
                    password: f.get("password"),
                  }),
                });
                const d = await r.json().catch(() => null);
                if (!r.ok)
                  throw new Error(
                    r.status === 401
                      ? "Your email or password was not recognized. Please check both and try again."
                      : (d?.message ??
                          "Sign in is unavailable right now. Please try again."),
                  );
                location.href = "/";
              } catch (e) {
                setError(
                  (e as Error).name === "AbortError"
                    ? "Sign in is taking too long. Please try again. Your entries have been kept."
                    : (e as Error).message === "Failed to fetch"
                      ? "We could not connect. Please check your connection and try again."
                      : (e as Error).message,
                );
              } finally {
                clearTimeout(timeout);
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
                autoCapitalize="none"
                spellCheck={false}
                required
                placeholder="you@college.edu"
              />
            </label>
            <label htmlFor="login-password">Password</label>
            <div className="password-field">
              <input
                id="login-password"
                type={showPassword ? "text" : "password"}
                name="password"
                autoComplete="current-password"
                required
                placeholder="Enter your password"
              />
              <button
                type="button"
                className="password-toggle"
                aria-label={showPassword ? "Hide password" : "Show password"}
                aria-pressed={showPassword}
                aria-controls="login-password"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? (
                  <EyeOff size={20} aria-hidden="true" />
                ) : (
                  <Eye size={20} aria-hidden="true" />
                )}
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
            {error && (
              <div role="alert" className="error">
                {error}
              </div>
            )}
            <button className="primary" disabled={busy} aria-busy={busy}>
              {busy ? "Signing in…" : "Sign in to workspace"}
              <ArrowRight size={17} />
            </button>
            {busy && (
              <p className="sign-in-status" role="status">
                Checking your account. Please wait…
              </p>
            )}
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
