# Verification receipt

Verified locally on Windows using Node.js 24.19.0, Next.js 16.4.3, Prisma 6.19.3 and project-local PostgreSQL 18. Source is in `G:\Thesis_Scheduler`. This machine's generated dependencies are stored on the SSD in `D:\DevCaches\thesis-scheduler\node_modules` through an ignored workspace junction; a normal clone uses `npm ci` as documented. The Next launcher preserves module identity across Windows junctions.

| Check | Result | Evidence / limits |
|---|---|---|
| Initial PostgreSQL migration | PASS | Tables, foreign keys, unique membership/attempt indexes, limits, singleton checks and membership-scope trigger applied |
| Fictional seed | PASS | 12 groups, 19 students, 5 faculty; missing availability, incomplete committee, full adviser, teaching conflict and unavailable room cases |
| Constraint tests | PASS | 11 tests, 0 failures; group counting, capacity, role overlap, buffers, daily/weekly limits, exceptions, room seating, missing availability and bounded search |
| TypeScript | PASS | `tsc --noEmit`; final production build also ran TypeScript successfully |
| Database workflow | PASS | Availability -> draft -> publication -> reschedule -> history/notifications -> authorized PDF |
| Concurrent room/person booking | PASS | Two conflicting publications; exactly one committed |
| Concurrent workload threshold | PASS | Two non-overlapping publications contending for last daily faculty slot; exactly one committed |
| Student authorization | PASS | Own-group records only; unrelated-group reports empty; coordinator actions rejected |
| HTTP sessions and downloads | PASS | Real Better Auth logins for all three roles, cookie session scope, anonymous denial, forbidden master export, authorized PDF download, same-origin mutation guard |
| Availability change after publication | PASS | Session flagged, coordinator notified, original reservation retained |
| Production build | PASS | Next.js optimized webpack build, TypeScript, prerendering and route tracing completed |
| Production dependency audit | PASS | 0 known vulnerabilities after a tested `deepmerge-ts` 8.0.0 override |
| Sample PDFs | PASS | 1-page three-member group schedule at version 2; 5-page master schedule; all pages rendered and visually reviewed |
| Long-title / large-roster PDF | PASS | Temporary draft fixture with 100 members across 3 pages; all 100 names extracted and every page visually reviewed |
| Browser workflow and themes | PASS | Actual login, availability save, explicit title attempt, readiness approval, generation, publication, roster preview and PDF download; light/dark/system; no runtime errors; 390 px viewport has no page overflow |
| GitHub source publication | PASS | Pushed to `Gabbu69/PSITS_thesis_scheduler` on `main`; local and remote commit SHAs verified at delivery |
| Public hosted deployment | NOT RUN | Requested deliverable is source publication to the supplied GitHub repository; local server verified separately |

## Acceptance coverage

1. Three-member group: exactly one published session, three student participants, every name in extracted PDF text and visual roster.
2. Adviser at 8/8: ninth assignment rejected by actual database service; existing advisee's session successfully published.
3. Cross-role overlap: shared validator checks faculty by user ID and deduplicates chair/panel attendance.
4. Availability and buffers: participant and room blocks intersecting only the turnover period reject a session.
5. Daily and weekly workload: fourth daily session passes, fifth fails; cancelled entries release capacity and completed entries still count.
6. Waiting list: unscheduled attempts retain specific reasons and next-step suggestions.
7. Concurrent publication: tested both real booking collision and distinct-slot workload-cap race against PostgreSQL transactions.
8. Rescheduling: version increments to 2, both historical versions remain, affected student receives a notice, PDF reflects the new date/time.

The demo's proposal-defense schedule was generated for November 2–6, 2026. Group PSITS-001 was explicitly rescheduled to November 5 at 08:00–08:45 PHT. A later fictional adviser exception flags it for coordinator review while keeping its reservation. This is intentional acceptance-test data, not a silently fixed conflict.

The production browser acceptance run additionally created and published PSITS-001's separate title-defense attempt on November 6, preserving existing published proposal defenses. The sample PDFs document the proposal schedule from the preceding database acceptance run; the application's current reports include the later title session too.

## Dependency compatibility and security

Current official Next.js requirements, Better Auth's Prisma integration, PostgreSQL transaction locks and React PDF wrapping behavior were checked during implementation. Prisma's supported classic client is used rather than adopting an unneeded release candidate. Prisma's transitive dependency is overridden to patched `deepmerge-ts` 8.0.0; Prisma generation and the production build pass with it. See the [upstream advisory](https://github.com/advisories/GHSA-ggr8-5vv4-36mx) and [release notes](https://github.com/RebeccaStevens/deepmerge-ts/releases/tag/v8.0.0). The package lock contains registry packages, not local-drive dependency URLs.

The initial dependency setup encountered registry resets and system-drive/low-memory constraints. Cached packages were restored with SHA-512 verification, and the final source was tested against the complete restored dependency tree. Those setup failures are not reported as passing application checks.

## Faculty readability and navigation follow-up — October 24, 2026

Applied UI/UX Pro Max guidance to the supplied short-screen sidebar and sign-in screenshots. The interface now uses rem sizes with an 18px base, 16px navigation and form text, and a 14px minimum for secondary labels at the default browser text size. Navigation scrolls independently, offers an explicit More pages / Back to first pages control, and brings the current page into view. Theme controls have visible labels; account details and Sign out remain accessible. Faculty/student dashboards show personal availability and schedule shortcuts with role-appropriate next steps.

| Check on the updated source | Result | Evidence / limits |
|---|---|---|
| Production build and TypeScript | PASS | Final optimized Next.js webpack build, TypeScript, prerendering and route tracing completed |
| Scheduling constraint regression tests | PASS | 11 tests, 0 failures; no scheduling or database logic changed |
| Sign-in recovery | PASS | Browser-held request aborts after 15 seconds, restores the button and retains entries; real incorrect-password feedback, password visibility, successful login and sign out |
| Readable text and theme contrast | PASS | Computed body text >=18px and all visible nondecorative text >=14px on checked pages; secondary text against the secondary surface >=4.5:1 in light/dark/system modes |
| Short-screen sidebar | PASS | 1336×636 viewport; labeled theme controls and Sign out fully reachable; More pages and Back to first pages work; current page has aria-current and is brought into view |
| Responsive navigation | PASS | 1024×768, 390×844, 390×568 and 668×318 viewports; drawer focus stays inside, Escape restores focus to Menu, navigation closes the drawer; no document overflow |
| Enlarged text | PASS | 200% root text size on a 1336×636 viewport; adaptive dashboard columns and reachable account controls; reduced CSS viewport checked separately (not claimed as a native browser zoom test) |
| Faculty/coordinator page layout | PASS | Groups, faculty, rooms, published calendar, reports and notifications at desktop and phone widths; coordinator drafts, waiting list and settings at phone width; no page overflow or browser runtime errors |
| HTTP authentication, authorization and PDF | PASS | Sequential final rerun of verify-http.mjs: all three roles, student scope/denials, anonymous denial, authorized PDF download and same-origin protection |
| Direct faculty user trial / assistive technology certification | NOT RUN | Automated browser and visual checks do not establish usability acceptance by actual professors or full WCAG conformance |

The repeatable read-only browser checks are in `scripts/verify-readability.mjs`; reviewed screenshots are in ignored `output/playwright/readability-*.png`. An initial overlapping HTTP/browser run encountered the existing sign-in rate limit; the checks were rerun sequentially and passed with rate limiting retained. The enlarged-text check found a 14px page overflow in the chart panel; adaptive columns fixed it and the final check passed. The earlier full scheduling workflow and database concurrency results above remain the implementation baseline; this follow-up did not reset demo schedules or rerun the mutating workflow verifier.

## Appearance dropdown and profile disclosure — October 24, 2026

Replaced the three theme buttons with a labeled native **Appearance** dropdown containing Light, Dark and System. The profile name/avatar is now a disclosure button; **Sign out** is absent until it is opened. The disclosure exposes its expanded state, closes on outside interaction or focus leaving the profile, and supports Escape with focus restoration. Escape within the profile does not also dismiss the mobile navigation drawer. A failed sign-out request shows an error instead of redirecting as though it succeeded.

- PASS: final production build including TypeScript, prerendering and route tracing.
- PASS: updated `scripts/verify-readability.mjs` against the production server. Each theme persists through reload; Sign out is hidden initially, opens from the profile, dismisses on outside click, opens with Enter and closes with Escape; actual sign out returns to login.
- PASS: existing readability, contrast, desktop/phone layouts, short windows, keyboard drawer containment, 200% text resizing and page-overflow checks; no browser runtime errors. Reviewed the closed mobile profile and open desktop profile screenshots.
- PASS: sequential HTTP regression check for all three account roles, student authorization restrictions, same-origin protection and the authorized PDF download.
- Updated the older, mutating `scripts/verify-browser.mjs` theme selectors to match the dropdown; that full data-entry/publication script was not rerun for this interface-only change.

Initial local builds encountered system memory exhaustion; the final complete build succeeded using Node 24 with a 512 MB old-space limit and 4 MB semi-space limit. No system settings, unrelated application processes, or scheduling/database records were changed to resolve it.
