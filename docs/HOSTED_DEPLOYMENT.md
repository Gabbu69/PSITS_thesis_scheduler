# Hosted deployment

Live fictional demo: **https://psits-thesis-scheduler.vercel.app**

Verified on October 24, 2026 (Asia/Manila). Runtime source commit: `e47532c9963b086dd5e26511056e84db8fe902d7`. Vercel deployment: `dpl_GtgqN7K6L4txw98idKLhRJHpCuP6`, reported **READY**, production target. Later documentation-only commits do not alter this runtime build.

## Hosting

- Vercel project: `psits-thesis-scheduler` in the owner's existing Vercel account.
- PostgreSQL: a new Neon **Free** plan resource, `psits-thesis-scheduler-db`, in Singapore. Runtime functions use the `sin1` region.
- Existing Next.js, Prisma, Better Auth, relational schema, advisory transaction locks and PDF reports are retained. Sites was checked first; its Workers runtime does not directly support the application's existing PostgreSQL connection. The owner chose compatible hosting instead of a backend rewrite.
- The hosted database is separate from `.postgres/`. It contains only the fictional seed: 12 groups, 19 students and 5 faculty, plus published sessions/history created by acceptance verification.
- Production uses separate, generated auth and demo-login secrets. No credentials are in Git. The private local handoff file is `tmp/HOSTED_DEMO_ACCOUNTS.txt`; it is ignored and excluded from deployment uploads. Hosted demo passwords differ from local demo passwords.
- `DATABASE_URL` uses the provisioned connection; schema migration and seed used the direct, unpooled connection. Only the fresh hosted demo database was migrated/seeded.

## Verification results

| Check | Result and evidence |
|---|---|
| Production build | PASS: Linux cloud build, Prisma client generation, TypeScript, static pages and function deployment |
| Schema and seed | PASS: initial migration applied to the new hosted database; fictional seed completed |
| Hosted database workflow | PASS: availability entry, deterministic drafts, useful waiting reasons, publication, three-member group/session, adviser limit, authorization, rescheduling, versions/history/notifications and actual PDF generation |
| Hosted concurrency | PASS: exactly one conflicting publication commits; non-overlapping publications cannot exceed the faculty daily cap |
| Published availability change | PASS: attention flag and coordinator notification; reservation retained |
| Live browser workflow | PASS through availability save, new title-defense attempt, readiness, draft generation, publication and roster preview. Its first PDF download exposed a missing runtime-font asset; corrected and independently retested below |
| Live HTTP checks | PASS after fix: all three role logins, anonymous denial, student data scope, coordinator/report denials, same-origin protection and authorized PDF download |
| Live browser download | PASS after fix: coordinator login, visible PSITS sidebar logo, roster preview and actual downloaded PDF with `%PDF` signature; 390px mobile layout and no browser runtime errors |
| Logo / browser icons | PASS: `scripts/verify-branding.mjs` checks exact SHA-256 matches for the deployed logo, favicon and app icons; metadata and the rendered PSITS login logo checked in a real browser |

The first hosted PDF response failed because PDFKit dynamically loads standard-font modules that automatic file tracing omitted. `next.config.ts` now explicitly includes those files for `/api/reports`, following [Vercel's file-inclusion guidance](https://vercel.com/kb/guide/how-can-i-use-files-in-serverless-functions). The corrected production deployment passes both HTTP PDF retrieval and the browser download.

## Updating the deployment

From the linked checkout, run the relevant tests, then:

```powershell
vercel deploy --prod --scope edgardo-gabriel-paclibars-projects
```

`vercel.json` regenerates the Prisma client and builds the existing Next.js app. A deployment does not automatically run schema migrations or reseed records. Apply any new reviewed migrations separately using the hosted direct connection and `prisma migrate deploy`; never run the destructive fictional verifier against real college data. The current GitHub source push and Vercel deployment are separate actions; automatic deployment on every Git push has not been configured.

For read-only logo verification, set `BETTER_AUTH_URL` to the live URL and run `node scripts/verify-branding.mjs` with an existing Playwright installation and Edge. `PLAYWRIGHT_MODULE` can identify that existing installation. `scripts/verify-http.mjs` also needs the private hosted demo password. Do not rerun the older mutating browser workflow against this demo unchanged: it already created the first title-defense attempt.
