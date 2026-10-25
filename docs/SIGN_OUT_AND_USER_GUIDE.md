# Sign-out confirmation and PSITS user guide

Updated October 25, 2026 (Asia/Manila).

The workspace profile, mandatory password setup, and authenticator setup now share a sign-out confirmation. The dialog asks “Are you sure you want to sign out?” and defaults keyboard focus to Cancel. Cancel, Escape, or a backdrop click keeps the session. Only the confirmation button sends the sign-out request. While it is running, repeated submission and dismissal are disabled. A failed request stays in the dialog with a retryable error; successful sign-out returns to login.

The dialog isolates its keyboard and focus events from the mobile drawer and profile menu. These details prevent Escape from closing the drawer and prevent disabled-button focus changes from dismissing an error.

Validation:

- PASS: optimized production build and TypeScript.
- PASS: browser verification of default Cancel focus, cancellation without a sign-out request, Escape, backdrop, focus restoration, 375px mobile drawer behavior, injected HTTP 500 failure, retry, and confirmed session revocation.
- PASS: password-setup and authenticator-setup confirmations, cancellations, and successful logout.
- PASS: no browser runtime errors. Temporary QA account flags were restored. Normal and hosted college records were not modified.

The [eight-page user guide](../output/pdf/PSITS_Thesis_Scheduler_User_Guide.pdf) covers first sign-in, authenticator setup/recovery, student and teacher workflows, coordinator accounts and college setup, group scheduling/publication, reports, requests, sign-out, and troubleshooting. It has A4 pages, embedded fonts, eight bookmarks, a clickable site link and a public-site QR code. No shared passwords, private setup keys, or personal student/teacher records are included.

All eight pages were rendered with Poppler and visually checked. Text extraction verified page count, body content, current labels and absence of demo credentials. The final PDF is 167,919 bytes; SHA-256: B024C30D734575F793F9D5436C9B909A25B7622A0D994D57B6BB058E9E12806F.

Recreate with `scripts/create-user-guide.py` using the bundled Python environment. The included screenshot is a crop of the actual confirmation dialog captured in the isolated QA browser; it contains no user identity or credentials. `scripts/verify-sign-out.mjs` requires an isolated localhost test database and the private QA fixture file.
