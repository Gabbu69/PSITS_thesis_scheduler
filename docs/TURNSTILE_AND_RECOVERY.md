# Cloudflare Turnstile and authenticator recovery

This change replaces the daily authenticator challenge with Cloudflare Turnstile plus the existing email/password sign-in. The authenticator is used for forgotten-password recovery and its initial pairing confirmation.

## Configure Cloudflare

1. Open the Cloudflare dashboard → Application security → Turnstile → Add widget manually.
2. Name: **PSITS Thesis Scheduler**. Hostname: **psits-thesis-scheduler.vercel.app**. Use **Managed** mode; keep pre-clearance off.
3. Put the public site key in `TURNSTILE_SITE_KEY` and the secret in `TURNSTILE_SECRET_KEY`, in the private environment of this app. Never commit or paste the secret into chat.
4. Keep `BETTER_AUTH_URL=https://psits-thesis-scheduler.vercel.app` on production. The server rejects tokens from other hostnames/actions. Use separately configured widgets/environments for any other hostname.
5. Apply `202610260001_turnstile_recovery` to the intended database and deploy the matching source together. Do not deploy without both real widget keys; authentication fails closed if configuration is missing. Official dummy keys are only accepted when `BETTER_AUTH_URL` explicitly points to localhost/127.0.0.1.

The browser loads Cloudflare's official widget script and sends the returned token to the server. The server calls Cloudflare Siteverify with a ten-second timeout. It requires success, the expected action (`login` or `password_reset`), and the configured hostname. Cloudflare rejects expired/used tokens. The client obtains a fresh token after each submission and provides error/retry feedback.

## Password recovery

`/forgot-password` accepts email, a new password, confirmation, and a current six-digit code. Turnstile is required before checking account information. Failed/unavailable/unknown accounts receive the same generic response. Each normalized email has at most five attempts in fifteen minutes, stored in the database and shared across app instances. Correct codes are consumed even if the proposed password was used recently. A reset runs under the shared database lock, updates the password, preserves pairing, clears mandatory temporary-password state, revokes every existing session, and adds a credential-free audit event. It never creates a login session.

Password history stores only the last five previous password hashes. Current/recent passwords are rejected across recovery, signed-in password changes, and coordinator replacements. History cannot cover passwords that were never recorded before this release. Old backup-code login is disabled. Phone loss still requires coordinator identity verification; phone re-pairing is outside this change.

## Verification

- `npm test`: token validation unit tests plus existing scheduling/security tests.
- `npm run typecheck` and `npm run build`.
- `scripts/verify-real-auth.mjs`: use an empty isolated localhost test database and Cloudflare's documented test key pair. Includes account setup, mandatory password change, encrypted recovery pairing, no daily OTP prompt, mandatory Turnstile, old-route rejection, roles, authenticator recovery, fresh-password rejection, code replay and concurrent-reset rejection, session revocation, persistent recovery budgets, and origin checks.
- CI uses the same documented dummy keys against localhost. They are not production credentials.

Historical verification documents and the existing PDF describe the earlier mandatory-login-MFA release. This document and README describe the new behavior; do not treat historical test receipts as verification of this change. Deployment and physical-phone acceptance must be reported separately from local tests.

Sources: [Cloudflare widget rendering](https://developers.cloudflare.com/turnstile/get-started/client-side-rendering/), [server validation](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/), [testing](https://developers.cloudflare.com/turnstile/troubleshooting/testing/), and [Better Auth authenticator enrollment](https://better-auth.com/docs/plugins/2fa). The recovery-only plugin composition is verified against installed Better Auth 1.7.12 source; it intentionally retains enrollment endpoints/schema and omits the plugin's daily-login hook.
## Local verification receipt — October 26, 2026 (Asia/Manila)

- All 17 unit tests passed.
- TypeScript checking and the final optimized production build passed.
- The new migration applied successfully to a fresh isolated local database.
- The updated account integration verifier passed setup, encrypted pairing, daily login without OTP, required Turnstile, legacy-route denial, role boundaries, fresh-password recovery, replay/concurrent-reset denial, session revocation, and persistent recovery throttling.
- Browser checks against the production build passed with the real Cloudflare test widget: wrong-password retry, desktop/mobile login, no horizontal overflow at 390px, password-confirmation feedback, authenticator reset, and successful login with the new password. Separate HTTP checks rejected expired authenticator codes and a previously-used password.
- Runtime dependency audit reported zero known vulnerabilities. `git diff --check` passed.

These checks used fictional accounts in an isolated local database and Cloudflare's official dummy widget keys. No real account password was changed for testing. Production activation and physical-phone acceptance are separate steps.

## Production release — October 26, 2026 (Asia/Manila)

Runtime source: `7958f9fabac29cf4a622cd7010e01d1dc53d35d8`, pushed to `origin/main`. [GitHub CI passed](https://github.com/Gabbu69/PSITS_thesis_scheduler/actions/runs/40343137940). Vercel deployment `dpl_FmY9pnrvjqF3HA4wWmy6QxUM8pua` reported READY and is aliased to [the live application](https://psits-thesis-scheduler.vercel.app). The matching additive migration applied successfully through the existing Neon direct connection, and Prisma reports the schema up to date. The widget uses Managed mode, the exact production hostname, and no pre-clearance. Its rotated secret is stored as a Vercel Production Secret; neither real key is committed.

Live checks: `/login` and `/forgot-password` returned 200 with the current forms and valid configuration; both sign-in and recovery rejected missing Turnstile tokens with 400; anonymous data/reports remained inaccessible. The real production widget completed verification in Brave, and an authorized deliberately invalid login reached credential verification and returned 401, confirmed in Vercel request logs. The real account was not used for this check. Headless automation was shown a human checkbox; it was not used to claim successful human verification. Full password-reset acceptance was tested on the isolated database, including the production build's browser flow. No real password was reset and no real phone pairing was changed during verification.

Production record counts before and after rollout were unchanged: one account, zero groups, and zero defense sessions; no password-history or recovery audit rows were added by rollout tests. Physical-phone recovery acceptance still belongs to the account owner. This receipt changes documentation only; deployed runtime source is identified above.
