# Tester feedback and paper appearance

11 October 2026. See [ADR 015](adr/015-currencies-and-private-debt-corrections.md).

## Changes

- Shared agreement creation offers ten currencies. Wording, digital witness statements, overview totals, schedules and documents retain those units.
- Private debt creation and editing offer optional single-date, weekly, monthly and custom plans. Plans appear in a disclosure on the card; recorded payments clear the earliest scheduled amounts.
- Every private debt has an Edit action, including paid records. Recorded payments stay unchanged, currency locks after the first payment, and stale edits offer a way to load the latest record.
- Light mode uses warm cream paper `#f3ede2`, cards `#faf6ed`, soft surfaces `#eae3d7` and raised surfaces `#fffaf1`. Dark mode retains neutral charcoal and the purple primary action. Static tiled SVG grain appears on the page and larger surfaces in both themes, has no pointer interception or continuous animation, and is suppressed in forced-colors mode. Browser theme color, installed-app splash and offline colors match the new cream palette.
- Creation fields wait for browser hydration before accepting input, preventing an early currency selection from being reset.

## Design verification

Following better-layout, optional plans use progressive disclosure and narrow forms use shrinkable tracks. Following better-writing, editing explains what can change and why currency is locked after payments. Following better-colors, appearance uses existing semantic tokens and keeps purple actions consistent.

Computed text contrast across the declared cream surfaces is at least 4.86:1 for secondary text and 12.78:1 for primary text. Across dark surfaces it is at least 6.94:1 and 12.35:1 respectively. Primary action text measures 4.72:1 in light mode and 4.96:1 in dark mode. Screenshot sampling confirms rendered grain in both themes; it is decorative rather than a content layer.

Automated checks cover currency units, exact schedules, immutable manifests, private debt ownership, revisions, payment preservation, database constraints and RLS. Synthetic browser journeys cover creation, repayment, edits, stale/error states and responsive layouts. EUR installment agreement and receipt PDFs were generated and their extracted currency values checked; the agreement pages were reviewed visually.

Not verified: translated copy, 200% zoom, long-running expired sessions, and a real multi-person hosted currency/repayment journey. Testing does not send real invitations or change users' financial records.

## Final validation and staging release

All 134 unit/integration tests, lint, TypeScript and 18 relevant browser checks pass across focused runs, including mobile WebKit at 375 and 768px. Local workerd checks pass for routing/security/private caching, single/installment PDFs, and five-width sign-in rendering in both themes. The supported USD browser journey creates a proposal, claims it as the borrower, approves it, opens the correctly labeled repayment form, and checks separate currency totals.

Migration 006 is applied to staging. Read-only metadata checks confirm six applied migrations, revision-table RLS, prohibited direct authenticated updates, and preserved original revisions for existing private debts. No real financial records were modified by QA.

Published staging version `22b0bde2-3d02-4592-b5da-f5edb4f83b73` at https://staging.usetreeti.xyz. Worker gzip size: 2,999.11 KiB, within the free-tier 3 MiB limit. Production is not deployed. Previous Worker version: `d43019f2-2e2e-4187-91a1-75f4567a9899`. The additive migration is retained if rolling back the Worker; downgrading the schema would discard the newly supported functionality.


Hosted smoke checks pass for HTTPS, branding, legacy redirects, origin enforcement, private responses and unsigned job rejection. Fresh signed-out browser sessions confirm the published cream tokens, grain, theme-color metadata and sign-in rendering in both themes. No code, real email or financial mutation was triggered.
