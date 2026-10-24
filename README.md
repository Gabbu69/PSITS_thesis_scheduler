# Thesis Defense Scheduler

A local-first web application for one college: students and professors submit availability in one place, and a coordinator reviews and publishes a conflict-checked thesis defense schedule. Built with Next.js, TypeScript, Tailwind CSS, PostgreSQL, Prisma, Better Auth and React PDF. Uses the supplied PSITS logo with a navy/cyan academic dashboard and light, dark and system themes.

All demonstration names, student identifiers, theses and conflicts are fictional. Default limits (8 active advising groups, 4 defenses/day, 45 minutes + 15 minutes turnover, 3 panelists) are editable examples, not college policy.

Live fictional demo: **https://psits-thesis-scheduler.vercel.app**. Hosted on Vercel with Neon PostgreSQL; the local setup remains supported. The supplied PSITS logo appears on the login page, sidebar, browser tab and app icons. See [hosted deployment and verification](docs/HOSTED_DEPLOYMENT.md). Hosted demo passwords are private and are not committed to this repository.

## Requirements

- Node.js 22.12+ or a newer supported Node LTS; npm; Git.
- PostgreSQL 16+; **or** the included optional project-local PostgreSQL launcher (Windows x64 and other supported embedded-postgres platforms). No Docker, paid API or external auth service required.
- A browser. Internet is needed for dependency installation, not normal local use.

## Beginner-friendly local setup (PowerShell)

```powershell
git clone https://github.com/Gabbu69/PSITS_thesis_scheduler.git
cd PSITS_thesis_scheduler
npm ci
Copy-Item .env.example .env
```

Edit `.env`. Replace every placeholder. For the included local launcher you can use `scheduler` as the database username and any strong local database password, with port **5432**. Set `BETTER_AUTH_SECRET` to a unique random string of at least 32 characters. Set `DEMO_PASSWORD` to a chosen local demonstration password of at least 12 characters; all fictional accounts use this value when seeded. Never commit `.env`.

If you have an existing PostgreSQL installation, create a database/user and set `DATABASE_URL` accordingly. Otherwise start the project-local database in a separate terminal:

```powershell
npm run db:local
```

Keep it open. It persists database files in ignored `.postgres/`, listens only on loopback, and does not install a Windows service or modify system users. Do not start it on a port already used by another PostgreSQL service.

In your application terminal:

```powershell
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

Open [the local application](http://localhost:3000). The seed is non-destructive: if a college record already exists, it skips seeding.

| Role | Fictional local login | Password |
|---|---|---|
| Coordinator | `coordinator@demo.psits.test` | Your `DEMO_PASSWORD` value |
| Faculty | `faculty@demo.psits.test` | Your `DEMO_PASSWORD` value |
| Student (three-member group) | `student@demo.psits.test` | Your `DEMO_PASSWORD` value |

Other faculty accounts: `santos`, `cruz`, `lim`, `garcia` at `demo.psits.test`. Student accounts after the first use `student1`, `student2`, etc. These are local demonstration accounts, not real people.

## Walk through the application

1. Sign in as coordinator. Settings contains the college name/logo, terms, programs, sections, stages and user account form. Add students before creating a group.
2. Add a thesis group, select every member, and assign its adviser, panelists and panel chair. One group is one session, including an individual thesis.
3. On Availability, create weekly available hours with effective dates or specific dates. Add teaching/class conflicts as blocked periods. The coordinator may enter verified availability for a person or room. Each student and faculty member can also enter their own.
4. Have the student request readiness review. Approve readiness as coordinator or assigned adviser when enabled. A request alone never becomes READY.
5. In Schedule workspace, choose First Semester 2026–2027, Proposal Defense, November 2–6, 2026, and active rooms. Generate the draft. The fixture deliberately includes a full adviser, a professor's Monday teaching block, a room closed for maintenance, incomplete panel assignments and an unready group with missing availability.
6. Inspect sessions and projected daily workload. Lock drafts that should survive regeneration; edit any proposed time with a reason. Review the waiting list for practical conflict explanations.
7. Publish the draft. The server revalidates current data and publishes atomically. Notifications appear for participants. Sign in as the student or faculty to see the personal official schedule.
8. On Reports, select a scope and filters, preview the per-student list, and download PDF or CSV. Student access remains restricted even if URLs are edited.
9. To change a published session, use Edit and supply a reason. History retains previous versions. Cancellation releases booking workload; completion retains performed workload and does not archive the thesis group or free advising load. Archive a thesis group explicitly after all its defenses are resolved.

## Verification

```powershell
npm test
npm run typecheck
npm run build
```

For database-backed acceptance verification, use a **dedicated freshly seeded fictional demo database**:

```powershell
npm run verify
```

This verifier clears fictional defense sessions/history/notifications, generates and publishes drafts, tests authorization, capacity, rescheduling/history, affected-session alerts, and two concurrent publication races. It generates PDFs in `output/pdf/`. It refuses to run unless the college name contains `Fictional`. Do not run it on real college data. Results from the implementation run are recorded in `docs/VERIFICATION.md`.

For production-style local serving:

```powershell
npm run build
npm start
```

Set the correct `BETTER_AUTH_URL`, HTTPS and strong secrets before deployment. Back up PostgreSQL; keep database and auth credentials private. GitHub source publication and a successful hosted deployment are separate checks; the verified live deployment is documented below.

## Implementation notes

Read [architecture, relationship diagram, algorithm and limitations](docs/ARCHITECTURE.md) and [implementation plan](docs/IMPLEMENTATION_PLAN.md). The package lock fixes the tested dependency versions. Prisma 6 is used with its standard PostgreSQL client; Better Auth explicitly supports that setup without a driver adapter. Sources consulted: [Next.js requirements](https://nextjs.org/docs/app/guides/upgrading/version-16), [Better Auth Prisma integration](https://better-auth.com/docs/adapters/prisma), [PostgreSQL advisory locks](https://www.postgresql.org/docs/current/explicit-locking.html#ADVISORY-LOCKS), and [React PDF page wrapping](https://react-pdf.org/docs/v4/advanced/page-wrapping).

The tested dependency lock includes a patched `deepmerge-ts` override for Prisma's configuration dependency. The final production dependency audit reported no known vulnerabilities. See the verification receipt for exact check boundaries. The small Next launcher also supports Windows dependency junctions across drives.

Two reviewed example reports are included in `output/pdf/`: the proposal master schedule and the three-member group's rescheduled version 2. They are fictional samples, not live college schedules. `scripts/generate-samples.ts` can regenerate them from a published fictional demo database. `scripts/verify-http.mjs` checks real credential sessions against a running server; `scripts/verify-browser.mjs` is optional QA requiring an existing Playwright installation and Edge (or a configured browser channel).

For read-only interface regression checks, use `node --env-file=.env scripts/verify-readability.mjs` with a running server, the fictional demo accounts, and an existing Playwright installation. Set `PLAYWRIGHT_MODULE` to its module URL when it is outside this project, and `BROWSER_CHANNEL` when using a browser other than Edge. It checks login timeout/retry, readable text, themes, mobile navigation, enlarged text and page overflow, and saves screenshots in ignored `output/playwright/`. It does not change availability or defense records. The older `verify-browser.mjs` exercises data entry and publication and therefore changes fictional demo records.

The interface uses larger text for faculty readability: 18px base text, 16px menu/form text and 14px secondary labels. Browser text sizing and zoom remain available. The compact sidebar uses ordinary navigation links, with native scrolling only when the window is too short to fit them. Use **Menu** on tablets and phones. Faculty and students can start with **My availability** or **My defense schedule** on their dashboard.

Change Light, Dark or System using the **sun, moon and monitor icon buttons** in the top-right header. Each has a tooltip, accessible name and selected state. Click your **name/avatar** in the sidebar to open the profile menu and reveal **Sign out**. The profile menu starts closed and can be dismissed with Escape or by clicking elsewhere.

The first-fit scheduler uses stable priority and a bounded search. It never claims a proven lack of feasible slots. Faculty are assigned by the coordinator; automatic committee matching is a future extension. Preference requests, external email/SMS/calendar integration, manuscript/grading/plagiarism features and bulk import are outside the first implementation.
