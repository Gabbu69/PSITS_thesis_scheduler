# Usability and real accounts

Revision date: October 24, 2026, Asia/Manila.

## Behavior

The decorative home hero, fake calendar, generic charts, and repeated explanatory copy were removed. Home now presents actual next actions, actual counts, and published defenses. Students have four main pages; teachers have those pages plus personal workload. Coordinators have six main destinations. Reports, room records, teacher records, and the waiting list remain reachable through More or contextual actions.

Group creation has two steps with retained inputs and Back/Next controls. Native checkboxes replace Ctrl/Command multi-selects. Availability uses weekly/day selection or a single date, conditional fields, and an optional note/date section. Several weekdays save in one transaction. Group maintenance, detailed schedule actions, activity history, and alternate schedule views open on demand. A new Accounts page creates and manages actual accounts. Empty schedule setup links back to the records needed to proceed.

## Accounts and security

The original fictional workspace is retired after private snapshots have passed checksum, content, and actual restore checks. No synthetic records are inserted by setup, migrations, deployment, or the ordinary seed command. Fixture creation requires an explicit testing flag and an isolated database name. The production demo-password environment variable is removed.

The first coordinator must provide the actual college name, personal name, real email, and a chosen password at `/setup`, using the private setup key. The endpoint accepts a one-time claim under the same transaction lock as scheduling. Further account creation requires coordinator authorization. Reserved example/test email domains are rejected. Each new person must replace the coordinator-issued temporary password.

Authenticator enrollment is required for each role. The QR code is rendered locally; no secret is sent to a QR service. Enrollment requires the current password and a working six-digit code. The app displays ten private recovery codes and asks the user to save them. Enrolled sign-in requires password plus an authenticator or unused recovery code. APIs and reports reject password-only challenges and accounts that still need password replacement or enrollment. The existing Better Auth plugin encrypts authenticator secrets and backup codes and persists account lockout after repeated failed codes. Password changes also have a bounded attempt counter. Password reset revokes sessions and keeps the authenticator connected.

There is no automatic email/SMS delivery. Coordinators privately provide temporary login details and handle password resets. Recovery codes are the supported way to sign in after losing a phone. Actual phone pairing and professor/classmate acceptance require the owners of those accounts.

## Verification

- PASS: TypeScript and optimized production build.
- PASS: all 11 scheduling constraint regression tests.
- PASS: isolated database workflow, generation, publication, student scope, adviser capacity, rescheduling/history, real PDF, publication concurrency, workload limits, and published-session attention flags.
- PASS: real-account HTTP verification: private setup, duplicate-claim prevention, reserved-email rejection, mandatory password change, individual MFA enrollment, invalid-code rejection, encrypted storage, password-only denial, one-use recovery codes, teacher/student/coordinator permissions, atomic weekday saves, cross-origin denial, and persistent authenticator lockout.
- PASS: private snapshots of local and hosted fictional data were restored into separate local scratch databases and all original table counts matched. The schema migration was also tested on the restored hosted snapshot before the hosted migration was applied.
- PASS: complete browser flow for college records, room availability, two-step group creation and retained fields, checkbox committee assignment, student readiness request, adviser approval, draft generation, publication, student schedule, and a real authorized PDF.
- PASS: every role page in the simplified navigation, 375/390 px phone widths, 668 x 318 landscape, 1024 x 768 tablet, dark mode, 200% text, mobile Escape/focus restoration, and zero browser runtime errors. Desktop, phone, and dark screenshots were visually inspected.
- PASS: browser account creation → required personal password → locally rendered QR → valid TOTP → ten recovery codes → required save acknowledgment → home.
- PASS: guarded retirement removed 25 fictional accounts, 12 groups, sample schedules, availability, and related records from each normal local/hosted database. Both finished with zero accounts and zero sample records.
- Hosting rollout is being published from the source revision containing this receipt.

## Evidence and boundaries

Browser captures and run receipts are local under `output/playwright/`. They use an isolated local test database and explicit QA identities; those identities are not inserted into the normal or hosted workspace. Private snapshots, credentials, setup keys, and restore receipts remain in ignored `tmp/` and are excluded from deployment uploads.

An early development-server browser run hit the laptop’s memory limit. Optimized production builds were subsequently run with the bundled Node runtime and bounded memory. Browser verification uses that production server. Initial browser runs caught and corrected select labeling and a missing wizard navigation button; these are not reported as successful runs.

## Private recovery and first setup

Setup access is saved only in `tmp/REAL_WORKSPACE_SETUP.txt`. Snapshot files and checksum manifests are in `tmp/private-backups/`. `scripts/restore-snapshot.mjs --restore-to-new-local-database` checks the archive hash and restores it into a newly created local scratch database; it never overwrites the active database. `SNAPSHOT_FILE` can select an archive basename. The default selects the latest local archive.

The real coordinator still needs to provide their actual identity, choose their private password, and connect their own phone. No coordinator identity or password was invented. Physical authenticator-app pairing, external email delivery, and renewed classmate/professor acceptance are not claimed by the automated checks.
