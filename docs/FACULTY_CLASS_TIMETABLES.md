# Faculty class timetables

Visitors see the existing public **Faculty Class Schedules** board at `/` or `/class-schedules`, without a sign-in form or faculty login button/link. It shows only coordinator-published regular teaching schedules and is separate from the private thesis defense schedule. Faculty manually enter `/faculty/login` to use the existing sign-in page. The legacy `/login` URL remains compatible with account/recovery links and existing student/coordinator access. Signed-in users retain their existing workspace at `/`.

## Faculty workflow

1. Manually open `/faculty/login`, sign in with your coordinator-provided account, and open **Class schedules**. Existing password, Turnstile, first-use setup, and server-side role/ownership checks still apply. Students cannot manage timetables, faculty can edit only their own, and only coordinators can publish.
2. Choose the academic year and semester. Enter the timetable's effective start and end dates.
3. Add the subject code/name, section, room/location, weekdays, and start/end time. Use separate entries when a subject has different times on different days. Split overnight classes into separate daily entries.
4. Select **Save draft**. Saved classes immediately protect teaching time from defense bookings, even before publication.
5. Select **Submit for review**. The coordinator receives an in-app notification.

Continue maintaining **My availability** for defense scheduling. Class timetable gaps do not count as submitted availability. Personal availability notes are never published on the class board.

## Coordinator workflow

Open **Class schedules**, select a pending timetable, and review its added/removed meetings, effective dates, and overlapping defense reservations. Select **Review and publish**, inspect the preview, then confirm publication. Coordinators may also enter or correct a timetable, save it, and submit it for review before publishing.

Saving edits after submission returns the working revision to draft. The last published revision stays on the login page until its replacement is published. Both saved working classes and the previous published classes continue blocking defense scheduling in the meantime. This deliberately protects times removed by an unapproved edit.

To retire a published timetable, remove all its classes, save, submit, and explicitly confirm the empty revision in the publication dialog. Previous publications remain in **Publication history**, including publication time and coordinator name. A stale save/publication is rejected; discard unsaved changes and use **Reload** to get the latest version.

Class changes recheck draft and published defenses under the existing scheduling lock. Published reservations that newly need review notify the coordinator and participants. Reservations are retained until the coordinator resolves them. Class changes never automatically move a defense. Defense generation, edits, rescheduling, and publication all check classes, including the defense turnover buffer. Weekly meetings apply only during their effective dates.

## Public display and privacy

Visitors can search professor names and filter by semester, professor, weekday, or Today; refresh; and print the filtered board. All displayed times use Asia/Manila. The initial semester favors a current published timetable with the latest effective start; otherwise it uses the newest publication. Date ranges are displayed even when the selected term is past or future.

Only professor display names, faculty filtering identifiers, academic term, effective dates, publication time, and approved class fields are exposed. Public responses omit students, email addresses, private availability notes, accounts, unpublished meetings, and publication history. The board uses uncached reads; Refresh preserves login entries. An unavailable board does not disable sign-in.

## Migration and verification

The additive migration is `202610280001_faculty_class_timetables`. Regenerate the Prisma client with `npm run db:generate`, test the migration against an isolated database/Neon branch, and apply the committed migration through the normal release process **before deploying this code**. Use a direct database connection for Neon migrations. No production data is seeded or converted. Until actual timetables are published, the login page displays “No timetables published.”

- `npm test` checks timetable validation, overlap/effective-date rules, public term selection, and existing scheduling/security behavior.
- `npm run test:class-schedules` creates a fresh local PostgreSQL cluster beneath ignored `tmp/`, applies migrations, seeds fictional fixtures, runs the existing workflow verifier, and checks privacy, ownership, publication, concurrent saves, retirement, notifications, and defense conflicts. It never reads the application's database URL. Port 55482 must be available.
- After `npm run build`, `npm run test:class-schedules -- --serve` additionally starts the production build against the fictional local database at port 3108 for browser checks. These fixture publications exist only in the isolated test database.
- Run `npm run typecheck` and `npm run build` before release. Check mobile, tablet, desktop, keyboard access, failure/retry, print output, and the existing sign-in and recovery flows.

The first release supports manual weekly class entry. It does not import spreadsheets or model holiday/class cancellation exceptions. Regular teaching locations are descriptive; this feature protects faculty time rather than reserving defense rooms for classes.

## Optional Ryan Gonzaga local sample

Run `npm run db:sample-ryan -- --confirm-local-demo` after local migrations and coordinator setup to create the user-requested temporary Ryan Gonzaga faculty account and publish eight provisional weekly entries transcribed from the supplied image. This is an opt-in local sample, never part of builds, migrations, or production seeding. The script refuses non-local database hosts and refuses to overwrite an existing Ryan account.

The sample uses the reserved placeholder address `ryan.gonzaga.placeholder@example.invalid`, an unverified email, and a randomly generated hashed password. Initial credentials are written only to the Git-ignored `tmp/Ryan_Gonzaga_Local_Account_PRIVATE.txt`; never commit or share that file publicly. Password change and recovery-authenticator enrollment remain required. Through **Accounts → Manage**, the coordinator can replace the email and issue a fresh temporary password while preserving the faculty identity and timetable.

The academic term is explicitly provisional, with effective dates October 28–December 31, 2026. Subject codes, sections, and rooms are unconfirmed placeholders. Confirm those details and dates before using this timetable as an official schedule. The Wednesday webinar in the image is excluded from regular teaching classes.
