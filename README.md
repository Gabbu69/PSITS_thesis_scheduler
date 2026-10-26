# Thesis Defense Scheduler

A college defense scheduler for coordinators, teachers, and students. Uses Next.js, PostgreSQL, Prisma, Better Auth, and real PDF/CSV reports. All scheduling times use Asia/Manila.

Live application: [PSITS Thesis Scheduler](https://psits-thesis-scheduler.vercel.app).

## First use

The workspace starts empty. There are no shared demo logins, sample students, prefilled groups, or pretend schedules.

1. The app owner sets a private random `SETUP_KEY` (at least 32 characters).
2. Open `/setup`. Enter the key, the actual college name, and the first coordinator’s name, email, and chosen password.
3. Sign in and connect an authenticator app. Scan the QR code and enter its six-digit code to enable forgotten-password recovery.
4. In **College setup**, add the actual programs, sections, academic term, defense stages, dates, and requirements.
5. In **Accounts**, add real teacher/student accounts. Give each person their temporary password privately. Each person chooses a personal password and connects their own authenticator at first sign-in.
6. Add actual groups and committee assignments, rooms and room availability. Teachers and students submit their own available times.
7. Create a draft, review it, and publish. Participants then see their official schedule and can download it.

The setup key stops working once the first account exists. Public sign-up is disabled. Test, example, and `.test` email addresses cannot be used for app accounts. Email delivery is not configured: the coordinator provides login details privately and handles password resets in **Accounts**. A password reset preserves the person’s authenticator.

## Daily use

- **Students:** Home → My group → My availability → My schedule. Submit the group for readiness review when it is ready.
- **Teachers:** Home → My groups → My availability → My schedule. My workload shows personal advising capacity and defense limits. Advisers can approve readiness when college rules allow it.
- **Coordinators:** Home shows unfinished setup and groups awaiting review. Main pages are Groups, Schedule, Availability, Accounts, and College setup. **More** contains teachers, rooms, reports, and the waiting list.

Group creation has two short steps. Weekly availability accepts multiple days at once. Less frequent group changes, scheduling rules, day-by-day views, and activity history open on demand.

## Sign-in and password recovery

Daily sign-in uses email, password, and a Cloudflare Turnstile security check. The authenticator is reserved for forgotten-password recovery. Every role connects a recovery authenticator once before using the workspace, and new users must replace their temporary passwords first. Existing authenticator pairings remain valid.

Choose **Forgot password?** on the login page, enter your email, a fresh password, its confirmation, and the latest six-digit authenticator code. Turnstile is validated on the server for both sign-in and recovery, including the expected hostname and action. Missing configuration or failed verification blocks the request. Recovery attempts are limited per email in PostgreSQL. Verified reset codes cannot be reused during their validity window, and concurrent attempts cannot reset twice with the same code. A successful reset revokes all sessions and requires a fresh sign-in; it does not sign the user in automatically.

Passwords must contain 12�128 characters and differ from the current and last five stored passwords. History starts when this release first changes a password; older passwords cannot be reconstructed. This policy also applies to signed-in password changes and coordinator-issued replacements. Only password hashes are stored in history, and the oldest hashes are removed beyond that limit.

QR codes are rendered locally. Better Auth encrypts authenticator secrets. Keep `BETTER_AUTH_SECRET` stable so existing pairings remain readable. Old authenticator/backup-code login routes are unavailable, and the signed-in security page no longer offers login recovery codes. If someone loses their phone, the coordinator must verify their identity and issue a fresh temporary password privately. Their existing authenticator stays connected; this release does not implement phone replacement.

See [Turnstile setup and release checks](docs/TURNSTILE_AND_RECOVERY.md) and the [Better Auth enrollment documentation](https://better-auth.com/docs/plugins/2fa).

## Local installation

Use Node.js 22 or newer and PostgreSQL. Copy `.env.example` to `.env`, replace its placeholders, and keep it private.

```powershell
npm ci
npm run db:generate
# If no local PostgreSQL service is installed, keep this open in a separate terminal:
npm run db:local
```

In another terminal:

```powershell
npm run db:migrate
npm run dev
```

Open [the local app](http://localhost:3000/setup). `npm run db:seed` creates no sample data. Normal migrations never create accounts or thesis records.

## Validation

```powershell
npm test
npm run typecheck
npm run build
```

`node --env-file=tmp/real-auth-test.env scripts/verify-real-auth.mjs` exercises first-account setup, mandatory password changes, recovery authenticator setup, Turnstile login, reset-code replay/concurrency rejection, role scope, and multi-day availability. It refuses databases whose name does not contain `test` and servers outside localhost. Use an empty isolated test database and a private QA environment with its own `DATABASE_URL`, `BETTER_AUTH_URL`, and `SETUP_KEY`.

The original fictional scheduling fixtures are restricted to isolated testing: `ALLOW_TEST_FIXTURES=1 npm run db:test-fixtures` also requires a database name containing `test` or `ci`. Never run legacy workflow verifiers against college records. CI uses a separate test database. See [current usability and security verification](docs/USABILITY_AND_REAL_ACCOUNTS.md).

## Scheduling guarantees

Readiness approval and schedule publication remain separate. Draft generation, edits, rescheduling, and publication share the same conflict checks. Missing availability does not mean free time. Published sessions keep their participant and location snapshots, versions, and audit history. Scheduling mutations use PostgreSQL transactions and a shared advisory lock. Adviser capacity and defense workload remain separate limits.

The configurable initial limits are starting values; the coordinator must set the college’s actual requirements before publishing a schedule. No institutional approval is implied.

## Deployment

The linked Vercel project uses the existing Neon PostgreSQL database. Apply reviewed migrations using its direct database connection before deploying the corresponding app. Runtime requests use the existing pooled connection. Deployment does not seed data. See [hosting](docs/HOSTED_DEPLOYMENT.md).

## PSITS user guide

The existing eight-page [PSITS usage guide](output/pdf/PSITS_Thesis_Scheduler_User_Guide.pdf) predates this authentication change; use the current sign-in/recovery instructions above. It also covers student and teacher workflows, coordinator setup and scheduling, reports, changes, sign-out confirmation, and troubleshooting. It contains no login credentials or private setup keys.

Signing out now asks **Are you sure you want to sign out?** Choose **Cancel** to keep the session or **Sign out** to confirm. This applies in the workspace and during password/authenticator setup.

Publishing schedules and regenerating over existing unlocked drafts also require confirmation. Removing a saved availability range uses an app dialog. Report previews clear when filters change, display loading feedback, and support retry after connection failures. See [the security and polish review](docs/SECURITY_AND_POLISH_REVIEW.md) for the fixes and verification scope.
