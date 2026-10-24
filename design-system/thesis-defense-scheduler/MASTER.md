# Thesis Defense Scheduler design system

The implemented direction follows the supplied PSITS logo: navy, cyan and cool neutral surfaces. This is a college operations dashboard with restrained soft neumorphism. The requested light, dark and system modes take precedence over the initial automated dark-only suggestion.

## Source of truth

- Tokens and responsive behavior: src/app/globals.css.
- Theme persistence: next-themes in src/components/providers.tsx.
- Record workflows: src/components/workspace.tsx.
- Brand asset: public/logo.jpg, configurable in College Settings.

## Palette

| Token | Light | Dark |
|---|---|---|
| Background | #f0f4f8 | #111e2b |
| Secondary surface | #f8fafc | #162534 |
| Cards | #ffffff | #1b2d3d |
| Primary text | #173149 | #e1edf5 |
| Secondary text | #526779 | #a1b4c4 |
| Accent | #1479ad | #6bc7f0 |
| Borders | #e4ebf1 | #2a4053 |
| Primary action | #146c99 with white text | Same |

Use green, amber and red status badges with explicit words. The hero uses a navy gradient and an intentionally decorative calendar illustration.

## Layout and interaction

- Readability first: 18px base body text, 16px navigation/form text, and a 14px minimum for secondary labels at the default browser text size. Use rem units to respect preferred text size.
- Main controls are at least 48px tall; the menu paging control and compact header theme dropdown are 44px. The theme dropdown sits at the top right, shows only the selected Light, Dark or System mode, and has the accessible name Color theme. It preserves the selected preference.
- Desktop sidebar uses available viewport height: the menu scrolls independently, with an explicit More pages / Back to first pages control. Account details and theme selection remain reachable. Sign out is hidden until the user opens the profile using their name/avatar; the disclosure supports keyboard operation, Escape, focus restoration and outside-click dismissal. Very short windows scroll the entire sidebar.
- The current menu item is scrolled into view after navigation. At tablet widths and below, a labeled Menu button opens a drawer with keyboard focus containment, Escape, a close button and backdrop dismissal.
- Faculty and student dashboards link directly to personal availability and published defense schedules. Their next steps use role-appropriate language.
- Clear page title, labeled notifications and primary actions. A skip link goes straight to page content.
- Actual scoped totals, published sessions, unique scheduled/waiting group counts and advising-capacity note.
- Thin borders, 13-17 px radii and restrained raised shadows. Inputs have slight inset shadows.
- Labeled native inputs, searchable records, validation feedback and live save status.
- Modals trap keyboard focus, restore focus and support Escape.
- Mobile collapsible navigation, two-column metrics, one-column forms; wide tables scroll internally.
- Lucide icons, visible focus outlines and reduced-motion support.
- Sign-in has password visibility controls, an announced loading state, readable errors and a 15-second request timeout that restores the button and retains entries for retry.

## Verification

Production-browser screenshots were reviewed at 1440 px desktop and 390 px mobile widths. Light/dark/system preferences were exercised; mobile had no document-level horizontal overflow. The actual workflow was tested from availability through readiness, generation, publication, roster preview and PDF download.
