# Thesis Defense Scheduler

A college defense scheduler for coordinators, teachers, and students. Uses Next.js, PostgreSQL, Prisma, Better Auth, and real PDF/CSV reports. All scheduling times use Asia/Manila.

Live application: [PSITS Thesis Scheduler](https://psits-thesis-scheduler.vercel.app).

## First use

The workspace starts empty. There are no shared demo logins, sample students, prefilled groups, or pretend schedules.

1. The app owner sets a private random `SETUP_KEY` (at least 32 characters).
2. Open `/setup`. Enter the key, the actual college name, and the first coordinator’s name, email, and chosen password.
3. Sign in and connect an authenticator app. Scan the QR code, enter its six-digit code, and save the recovery codes.
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

## Authenticator security

Every role connects its own authenticator before accessing the workspace. Password sign-in produces a verification challenge for enrolled accounts; protected APIs and reports require the completed session. New accounts must first replace the coordinator-issued temporary password.

QR codes are rendered locally. Secrets and backup codes are encrypted by the existing Better Auth two-factor plugin. Recovery codes work once. Repeated incorrect codes temporarily lock verification. Keep `BETTER_AUTH_SECRET` stable: changing it invalidates encrypted authenticator information. See the [Better Auth two-factor documentation](https://better-auth.com/docs/plugins/2fa).

If a phone is lost, use a saved recovery code during sign-in. Keep the recovery codes in private storage. An enrolled user can check authenticator status or change their password through their profile menu. There is no unauthenticated bypass or coordinator button that silently removes MFA.

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

`node --env-file=tmp/real-auth-test.env scripts/verify-real-auth.mjs` exercises first-account setup, mandatory password changes, authenticator setup/sign-in, recovery-code replay rejection, role scope, and multi-day availability. It refuses databases whose name does not contain `test` and servers outside localhost. Use an empty isolated test database and a private QA environment with its own `DATABASE_URL`, `BETTER_AUTH_URL`, and `SETUP_KEY`.

The original fictional scheduling fixtures are restricted to isolated testing: `ALLOW_TEST_FIXTURES=1 npm run db:test-fixtures` also requires a database name containing `test` or `ci`. Never run legacy workflow verifiers against college records. CI uses a separate test database. See [current usability and security verification](docs/USABILITY_AND_REAL_ACCOUNTS.md).

## Scheduling guarantees

Readiness approval and schedule publication remain separate. Draft generation, edits, rescheduling, and publication share the same conflict checks. Missing availability does not mean free time. Published sessions keep their participant and location snapshots, versions, and audit history. Scheduling mutations use PostgreSQL transactions and a shared advisory lock. Adviser capacity and defense workload remain separate limits.

The configurable initial limits are starting values; the coordinator must set the college’s actual requirements before publishing a schedule. No institutional approval is implied.

## Deployment

The linked Vercel project uses the existing Neon PostgreSQL database. Apply reviewed migrations using its direct database connection before deploying the corresponding app. Runtime requests use the existing pooled connection. Deployment does not seed data. See [hosting](docs/HOSTED_DEPLOYMENT.md).
