# Security and workflow polish review — 25 October 2026

This review covers local source changes. It does not establish that the hosted deployment includes them or constitute a complete penetration test.

## Security and privacy fixes

- API data and report routes return deliberately public validation and business errors. Prisma errors are mapped to safe conflict messages; unexpected failures return a generic server error instead of database queries or connection details.
- Calendar dates reject impossible dates, including non-leap-year February 29 and month-end rollover. Availability, college rules, draft generation, session changes, and report filters use strict validation. Report versions and reversed report date ranges are validated.
- New schedule snapshots retain schedule and policy history while storing only participant IDs and names. Workspace and JSON report responses also sanitize existing snapshots. Historical schedule versions are hidden from participants who were not members of that snapshot.
- Non-coordinator group responses include active memberships. Student numbers are trimmed, bounded, and required; account emails normalize pasted spaces and case before validation.
- API responses carry `Cache-Control: no-store`. The app sets headers to reject framing and content sniffing, restrict form submissions and embedded objects, and limit referrer information. Framework identification headers are disabled.

## Workflow fixes and missing controls added

- Publishing all drafts requires explicit confirmation showing the draft count and participant-notification consequence.
- Regenerating a selection with existing unlocked drafts asks before replacing them. Locked drafts and published sessions remain reserved.
- Removing availability uses an app confirmation dialog. Room/person filters show only the selected resource category.
- Account security supports replacing recovery codes with the current password through the existing Better Auth plugin. Old codes are invalidated. New codes can be downloaded locally, and continuing requires acknowledgment that they were saved. Unsaved codes trigger the browser's navigation warning on unload.
- Report previews clear when their filters change, discard superseded responses, and show loading and network-failure feedback.
- Mutation submission is guarded against concurrent duplicate requests. Dialog dismissal is disabled during saving. Expired or newly restricted sessions return to the relevant account step.
- A successful save followed by a failed refresh is reported accurately. Mutation timeouts advise refreshing to check the result before resubmitting.
- Keyboard focus traversal excludes hidden group-wizard fields. A failed initial workspace load has a retry button. Sign-in step changes are disabled during verification.
- Published-session review notifications are sent when a session first enters review; repeated rechecks do not duplicate notices. Repairing the conflict clears the attention flag while retaining the booking.

## Verification

Use `npm test`, `npm run typecheck`, and `npm run build` for the normal checks.

The existing `scripts/verify-real-auth.mjs` checks first-coordinator setup, mandatory password replacement, MFA gates, authenticator sign-in, backup-code replay rejection, role scope, atomic availability changes, origin checks, and lockout. It requires an empty isolated localhost test database.

After that verifier has created the fictional QA accounts, `scripts/verify-security-regressions.ts` checks privacy filtering on legacy snapshots, historical roster authorization, notification deduplication, repaired warning state, and invalid-date rejection. It also creates a fictional draft for the browser checks. It refuses databases outside localhost or without `test_audit_` in the name; run it only once in a fresh audit environment.

`scripts/verify-audit-ui.mjs` checks HTTP headers and safe API errors, publish/regeneration/removal confirmations, availability filters, stale previews, network-failure recovery, recovery-code regeneration and sign-in, and mobile dialog layout. `scripts/verify-sign-out.mjs` exercises the existing sign-out confirmation, including Cancel, Escape, focus restoration, the mobile drawer, failed requests, and session revocation. Browser checks use the repository's existing Playwright script convention.

QA environment files, credentials, downloaded recovery codes, and browser captures stay in ignored `tmp/` and `output/playwright/` paths. Set `QA_ACCOUNTS_FILE` to a private file in `tmp/` to keep separate QA environments' accounts apart. `NEXT_DIST_DIR` allows test servers/builds to use a separate ignored directory without replacing the normal development build.

## Completed checks

- 16 unit tests passed.
- TypeScript and the production build passed.
- The real-account authentication verifier passed on a newly created local audit database.
- The security regression verifier passed, including legacy snapshot privacy and repaired warning state.
- The complete scheduling workflow passed on a second isolated fixture database, including concurrent publication and daily workload enforcement.
- Browser audit checks passed against the final production build at desktop and 375px mobile sizes, with no browser runtime errors.
- Sign-out regression checks passed across workspace, password setup, and authenticator setup.
- `npm audit --omit=dev` reported zero known production dependency vulnerabilities.

No hosted deployment or college-record mutation was performed. Existing sample PDFs and generated Next.js type configuration were restored after verification.
