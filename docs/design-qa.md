# Ahd interface verification — 8 October 2026

Scope: overview, agreement creation/review, party approval, witness attestation, repayment/settlement, private debts and reminder sheets, PWA installation guidance and offline recovery. Research and tokens are in [cash-app-design-system.md](cash-app-design-system.md).

The installed Mobbin research, Emil design engineering, better-accessibility, better-layout, better-writing, better-typography, better-colors and better-ui guidance informed this work.

| Before | After | Why |
| --- | --- | --- |
| Serif product headings and small control text | Geist Sans hierarchy, 16px inputs and clearer financial figures | Fast scanning and readable mobile forms |
| Rectangular controls and green actions throughout | Dark pill actions, neutral surfaces and selective mint accents | One clear primary action and calmer status hierarchy |
| Native input styles overrode icon padding | Shared field wrapper, 16px icon inset and 48px leading text padding | Prevent border crowding and text overlap |
| Label hints belonged to the accessible name | Separate label and described hint with unique IDs | Controls announce a concise name plus help |
| Modal trigger was absent from Radix context | Capture and restore the opening control's focus | Keyboard users continue from the same position |
| Four-step creation strip overflowed at 320px | Equal columns and stacked mobile labels | Keep every step readable at narrow widths |
| Long amounts and notes dominated cards | Remaining amount leads; secondary rows and expandable notes | Preserve exact values without overwhelming the record |
| One private debt stretched across the desktop | Cards keep a readable width in an auto-fill grid | Stable composition across one and many records |
| No reminder controls | Owner-only schedule, due cue, reschedule/remove and calendar alert | Support repayment planning without involving the person owed |
| Browser-only application | Manifest, original icons, install guidance and public-only offline fallback | App-like access without caching sensitive records |

## Verification coverage

- Automated browser journeys cover 375, 390, 430, 1366 and 1920px. Screenshot inspection includes overview, long names/amounts/terms, creation errors, form icon padding, repayment and reminder sheets.
- Additional keyboard testing covers opening and closing a sheet with Enter/Escape, focus restoration, 320px reflow and enlarged control/body text. Reduced motion is enforced in shared styles and tested in the narrow flow.
- Axe checks cover WCAG 2 A/AA and 2.1 AA across the tested flows. Native labels, accessible names and roles were also inspected in the live accessibility tree. A full VoiceOver session was not performed.
- Unit and PostgreSQL integration checks cover reminder time validation, zones, calendar privacy, idempotency, owner isolation, RLS, payment cancellation, retry and single delivery.
- PWA checks validate manifest/icon responses, standalone launch and shortcuts, installation guidance, public cache contents, offline navigation and recovery. Actual OS installation on physical iOS/Android devices was not performed.

Screenshots are in `output/qa/`. Live email transport remains unverified until production credentials and a registered Inngest integration are supplied; the worker is tested with an injected transport.

## Final check results

- 31 unit and PostgreSQL integration tests passed.
- 19 browser tests passed, including the complete agreement lifecycle, private debts, reminders, PWA recovery and responsive accessibility checks.
- ESLint, TypeScript and the production Webpack build passed.
- The final screenshot review confirmed the repaired 320px progress strip, mobile form spacing and desktop composition.

## User-directed refinement — Geist and financial overview

| Before | After | Why |
| --- | --- | --- |
| DM Sans throughout the interface | Self-hosted Geist Sans in four real weights | User's chosen interface family; Lora stays in the identity |
| Beige action row with document icon and chevron | White participant card, initials, task and explicit review action | Distinguish identity, next step and destination |
| Promotional mint hero and separate repeated totals | One financial overview with actual balances and linked counts | Put useful facts ahead of decorative copy |
| Three decorative eyebrows and the private-ledger eyebrow | Removed from Overview, Agreements, Activity and My debts | Reduce redundant copy above clear page headings |
| Quote strip and abstract link | Compact How Ahd works guide card with specific scope | Give education a clear destination |
| One long connected cross-agreement timeline | Date groups with event-specific Lucide icons and readable rows | Preserve audit actions without implying a shared progress state |
| Native selector arrow near the border | Custom chevron inset 16px, 44px text clearance, 44px target | Provide breathing room and prevent overlapping text |
| Large privacy text block | Neutral bordered note with title and shorter explanation | Keep owner-only behavior clear at lower visual weight |
| Shared promotional footer | Removed; mobile content reserves navigation space | Honor requested removal while keeping the last action reachable |

Research links and writing decisions are in `design-research.md`. Activity retains every event, timestamps in Africa/Lagos and agreement links. Review-card navigation does not approve an agreement. Physical-device testing, full VoiceOver, localization and RTL mirroring are not verified in this refinement.

| Before | After | Why |
| --- | --- | --- |
| Four small circles and labels consume mobile space | Four compact segments with a visible Step N of 4 count; connected labeled desktop steps | Adapt the progress indicator to the available space while retaining the full accessible step list |
| Private by intention. Shared only with participants. | This agreement is private to you, the borrower, and the witnesses you invite. | Name the people who can participate in plain language |

The stepper keeps `aria-current="step"` and announces completed steps. It is informational; navigation and field validation remain with Continue and Back.


## Paper, purple primary and neutral dark appearance

| Severity | Location | Before | After | Why |
| --- | --- | --- | --- | --- |
| Medium | src/app/appearance.css:13 | Green-tinted dark canvas, cards and buttons | #111111 canvas, charcoal surfaces, neutral copy, #9C62F8 primary | User requested proper dark greys and a purple primary; surface hierarchy remains distinct from actions |
| Medium | src/app/appearance.css:3 | Green-toned interface ink and neutral surfaces | Neutral ink/greys, warm paper canvas, accessible purple link variants | Give greys their own roles rather than using brand tint for every surface |
| Medium | src/app/appearance.css:52 | Square outline on the inner search input | Purple focus ring around the complete rounded search control | Match the field shape while retaining visible keyboard focus |
| Medium | src/components/profile-switcher.tsx:10 | Browser-native options and cramped arrow | Inset trigger, named profile rows, keyboard selection, Escape/focus restoration | Improve visual hierarchy and keep the active profile explicit |
| Medium | src/components/appearance.tsx:18 | No user appearance preference | Pre-hydration theme, persisted Light/Dark/Device choice, OS/cross-tab updates | Keep appearance consistent during navigation and launch |
| Low | src/app/appearance.css:26 | Flat page background | Static monochrome paper grain, lower opacity in dark mode | Add the requested texture without motion or pointer interference |
| Low | src/app/appearance.css:33 | Disclaimer touches guide CTA | 24px separation | Restore the requested breathing room |

Measured declared foreground/background pairs (WCAG relative luminance):

| Pair | Contrast |
| --- | --- |
| #121212 primary label on #9C62F8 | 4.92:1 |
| #121212 hover label on #A975FF | 5.96:1 |
| #7135C5 light link on #FFFEFA | 6.90:1 |
| #7135C5 selected light label on #F0E7FD | 5.82:1 |
| #C7A6FF dark link on #1C1C1C | 8.38:1 |
| #C7A6FF selected dark label on #30243F | 7.12:1 |
| #616161 secondary text on #EEEDEB | 5.29:1 |
| #B7B7B3 secondary text on #262626 | 7.52:1 |
| #F1F1EF primary text on #1C1C1C | 15.07:1 |

These are computed token pairs. Browser Axe checks verify rendered text contrast across the tested views. Field boundaries were strengthened independently of decorative card borders. Theme choice does not change agreement permissions or workflow transitions. Public offline recovery follows the selected appearance; private data remains outside the service-worker cache.


The responsive utility menu replaces three header controls below 1100px with one 48px trigger and 52px rows. Browser checks cover keyboard opening, Escape, theme selection, install-dialog handoff, focus return and Account navigation at mobile and tablet sizes. The handoff uses an explicit return-focus target because the selected menu item unmounts before the dialog closes. Desktop retains sidebar utilities.

A repayment-dialog Axe finding came from alpha compositing while the entrance animation was still running (4.46:1 sampled mid-frame). Accessibility checks now await finite animations before measuring the settled interface, rather than using a timing sleep or suppressing contrast checks. Primary label contrast at rest remains 4.92:1. Animation review continues to respect reduced motion.


Final CTA label update: light-mode labels now use the page-paper #F6F4EF on a close, deeper #8541DF (5.00:1); dark-mode labels use page-black #111111 on #9C62F8 (4.96:1). These supersede the earlier primary-label pairs above. Both themes use the same semantic `--action-text:var(--paper)` role. Theme-specific destructive fills preserve readable labels.

Final hover contrast: paper-light on #7832D2 is 6.00:1; page-black on #A975FF is 6.00:1. Destructive action pairs are 5.98:1 in light mode and 11.05:1 in dark mode. Field boundaries reach 3.03:1 against the light secondary surface and 3.24:1 against the dark secondary surface. Rounded search focus and menu layout screenshots are saved with the rest of the responsive evidence.


## Verified final refinement

- 27 browser tests passed, including full agreement creation/approval/witnessing/finalization/repayment/settlement, private debts, reminders, theme persistence, profile selection, responsive utilities and PWA recovery.
- Final targeted checks for 390px appearance, debt reminders and the refreshed public offline cache also passed.
- 31 unit and PostgreSQL integration tests passed.
- ESLint, TypeScript and the production Webpack build passed.
- Visually inspected light/dark overview, form, activity, profile menu, utility menu and rounded search focus screenshots. Responsive coverage includes 375/390/430px phones, 1024px tablet and 1366/1920px desktop; the existing 320px and enlarged-text checks also passed.
- Physical-device installation and a full VoiceOver session remain not verified.

Approve for the inspected color and responsive-interface scope; no outstanding high-severity findings in this scope.

## Digital witnesses and debt-form spacing — 8 October 2026

The owner changed the witness policy from direct observation to a digital acknowledgment. The policy decision was recorded before code changes in ADR 002. New hashed terms explicitly identify the policy; prior versions, statements and finalized documents remain unchanged.

| Surface | Before | After | Reason |
| --- | --- | --- | --- |
| Witness statement | “I personally witnessed the parties form this agreement.” | “I have read the terms of version [number]… [lender] is lending [principal] to [borrower]… I agree to act as a witness… I am not guaranteeing repayment.” | Preserve truthful consent without claiming observation, physical presence or transfer of funds. |
| Witness form | Observation category, presence category, separate education and affirmation checkboxes | One acknowledgment checkbox, typed name, production contact verification | Match the revised product workflow while retaining exact-version identity evidence. |
| Witness action | “Submit my attestation” | “Confirm as witness” | Use a direct, understandable action. |
| Pending legacy terms | Could invite direct witnesses using earlier wording | Explain the older policy and offer the lender “Update witness wording”; both parties approve again | Avoid silently changing an agreement after consent. |
| Debt currency/amount | Tablet rule set zero gap but retained two columns | 20px column gutter; smaller phone layouts remain stacked | Keep adjacent input boundaries visually distinct at the intermediate breakpoint. |

37 unit and PostgreSQL integration tests passed, covering explicit digital consent, identity matching, two independent witnesses, distinct/exact-version response counts, old-policy compatibility, fresh approval after revisions, tamper rejection, privacy and append-only evidence. The complete two-witness browser journey passed through PDF download, repayment and mutual settlement. Browser checks also passed accessibility and overflow at 375/390/430/1366/1920px. The expanded journey's time budget was increased to accommodate its five visual inspections and cold development PDF compilation.

Visually inspected the new witness form at phone and desktop sizes and the two-page agreement PDF, including the digital witness statement. Existing direct-observation PDFs retain their original conditional rendering. Debt creation was visually inspected at 390px and the reported 578px breakpoint. ESLint, TypeScript and the production Webpack build passed. Hosted authentication, delivery, storage, reminders and external evidence sealing remain production-readiness work, not claims established by local tests.

Final 578px dark-mode inspection confirms the visible gutter between Currency and Original amount. The debt create/payment/ownership journey at this width passed after the production build finished; the earlier concurrent run timed out while its save request was still pending, with no validation error. Nine relevant browser scenarios now pass across the completed runs. The complete repayment and settlement PDFs were also rendered and inspected.

## Cloudflare preparation — 8 October 2026

The OpenNext production build passes with the packaging changes recorded in ADR 005. Local workerd checks pass public routes/security headers, private API cache headers, cross-origin write rejection, disabled demo access and HTTP 401 for unsigned Inngest requests with a synthetic signing key. The separate synthetic probe passes PDF generation/hash matching, signed sessions and encrypted delivery round trips. Both PDF pages were rendered with Poppler and visually inspected without clipped text or missing glyphs.

Workers sign-in pages pass overflow checks at 375/390/430/1366/1920px in light and dark modes. Inspected phone and laptop screenshots; removed the dead demonstration CTA from hosted, unconfigured sign-in. Local development retains the demonstration option. The complete two-witness browser journey passes through finalization, PDF download, repayment and settlement. ESLint and TypeScript pass; 41 unit/database integration tests pass. Generated build output is excluded from lint/version control.

This validates local packaging and synthetic workflows. Hosted Auth, PostgreSQL/Storage, delivery, free-plan resource limits and production launch gates remain unverified until accounts and staging configuration exist.
