# Ahd design research

## Goal and searches

Study trust-critical review, consent and invitation moments before design. Platform: web. Queries: contract review and electronic signing from invitation to confirmation; banking review with recipient, amount and date; invitation acceptance with inviter, role and verification code. Mobbin returned inline previews which were inspected. Findings are synthesis, not copies of those products.

## Observed patterns

- [Contra contract review](https://mobbin.com/flows/a0a16055-b922-423f-a52f-82c7410b825e): staged proposal/contract/review/sign progress, a separate document panel and explicit name/checkbox ceremony. Ahd: guided drafting, readable full wording alongside the decision, and a visible version identifier. Applies to FR-003–010 and FR-017–022.
- [Deel signing](https://mobbin.com/flows/fa9252f7-90c9-4843-9fb1-44da9907e1a9): numbered participant signature cards change from actions to recorded completion; review and download remain available. Ahd: individual lender/borrower/witness status, no collective “everyone signed” until the server verifies it. Applies to FR-010, FR-019.
- [Upwork direct contract](https://mobbin.com/flows/afe65c0a-21fb-49c6-883b-109abb7c3ff9): proposal explicitly says awaiting response, key terms precede approval/decline. Ahd: “proposed amount” before acknowledgment; equally reachable change and decline actions. Avoid its lengthy account creation for guest witnesses.
- [Wise transaction review](https://mobbin.com/screens/ced7c24f-5381-4d74-8c7c-313b54f94540): amount leads, details repeat before a single prominent confirmation. [Melio review](https://mobbin.com/screens/7382bfe2-2bbe-4353-8546-5319faec7cea): grouped date and recipient sections with contextual edit links. Ahd: review all principal/due-date/interest/participants before sending, and review repayments before recording them. Ahd records external payments rather than adopting send-money labels. FR-024–028.
- [Mercury review](https://mobbin.com/screens/4f69e54d-7e1c-49c0-a0af-b5c5e583b7fb): narrow central column, generous whitespace, concise consequence near action. Ahd: remove dashboard chrome during consequential ceremonies.
- [Notion invitation verification](https://mobbin.com/screens/b287f274-3f13-4c94-af6b-f4d7790adc26): invitation context remains visible during code entry, destination is explicit and resend has feedback. [Cake Equity](https://mobbin.com/screens/08722f65-af1a-4222-a3df-4688dd93d495): reminds invitee which email/account must match. [Calendly invitation](https://mobbin.com/screens/7ac1e36a-0bf2-45b3-a50d-7bbcb98a9648): offers an identity-mismatch path. Ahd: verify the intended destination before revealing private terms and allow “This agreement is not for me.” FR-006, FR-012–018.

## Original design direction

Warm paper background, white document surfaces, deep ink text, pine-green primary actions, muted amber for pending attention and clear textual status labels. Editorial serif display headings pair with a readable sans-serif interface. Tabular monetary values; generous section spacing; 16px mobile inputs; 44px touch targets. A quiet side navigation on desktop becomes a bottom navigation on mobile. Overview prioritizes human names and next actions, not financial performance graphs. Agreement detail centers the agreed record, approval progress, balance and timeline.

Creation is four steps: amount, person, terms, review. Full content remains readable at narrow widths. Confirmations state precisely what was saved; typed names supplement role-specific affirmations and OTP, never replace authentication. Witness education precedes attestation and includes three distinct observation types. Review-only remains visible without satisfying witness requirements.

## Copy and motion decisions

Sentence case, verb-first buttons, neutral missed-date wording, specific recovery instructions, no debt-shaming or compliance/enforceability promises. Proposed payment remains “Awaiting confirmation.” Witness education: “You are not agreeing to repay this debt.”

After stable interaction implementation: short button press feedback, 180–220ms overlay opacity/transform, state labels and checkmarks retained without motion. No decorative balance counting, bounce or repeated list entrances. Reduced-motion disables movement; keyboard paths remain immediate.

## Research boundary

These are UI observations, not validation of Nigerian legal sufficiency or religious witnessing policy. Both source documents require expert review before claims. Additional research will be driven by concrete implementation problems rather than delaying the MVP.
# Cash App refresh

The 8 October design-system study and implementation tokens are documented in [cash-app-design-system.md](cash-app-design-system.md). It adapts balance hierarchy, pill actions, rounded modules, review sheets and confirmation cues into Ahd while preserving the documented consent workflow.

## Attention card refinement — 8 October 2026

Target: the overview's agreement action card. Searches covered a banking dashboard with pending review cards (web), Cash App pending requests (iOS), and document dashboards with signature requests (web).

- [Cash App pending activity](https://mobbin.com/screens/e37f6a5b-2b8f-4aa5-a296-ee5a7401a844) separates pending items from completed history, uses person markers and places an explicit pill action beside actionable entries. Borrow the clear action, not the bright green brand.
- [Remote home tasks](https://mobbin.com/screens/77dc7ffb-b3db-4c4f-9484-450a684aff41) uses white task rows on a neutral canvas, with a clear title and a short supporting explanation. A white surface is enough to distinguish an actionable record; an amber fill is unnecessary.
- [Docusign agreements](https://mobbin.com/screens/9889eedc-56fc-4b8c-bd60-3234a55a79a7) separates document identity, status and a concrete Sign action. Ahd keeps the review step before any approval.
- [Airwallex spend requests](https://mobbin.com/screens/64cb7251-edd5-4bfa-ad69-8f89182ffafa) keeps pending status separate from request identity. Ahd uses a quiet Your turn badge instead of repeating urgency language.

Decision: replace the beige notification row with a white, subtly bordered card. Lead with the other participant's name and an initials avatar, retain the agreement reference, separate the next task with a fine divider, and present Review agreement or Open agreement as an explicit pill. The entire card remains a single keyboard-accessible link; clicking it opens the existing agreement review flow and never approves an agreement. Small screens stack the task and action. The heading count stays; the decorative Let's keep things moving line is removed.

Typography now uses self-hosted Geist Sans at 400/500/600/700, as requested. Lora remains in the wordmark and document artifacts.

## Overview and guide refinement — 8 October 2026

- [Cash App money home](https://mobbin.com/screens/a94b5872-01a9-4cc6-a8ed-b838dfc3b1ef) leads with a real balance and short actions; the amount is the visual anchor, rather than a promotional statement.
- [Wise home](https://mobbin.com/screens/ede78e65-ca02-449f-96c0-f36420fe9281) separates balances and account modules from its smaller informational message. Its bright urgency banner is inappropriate for Ahd's routine overview.
- [Mercury home](https://mobbin.com/screens/dbf9eb63-dcfe-4876-965a-e8a6d8702092) groups financial facts in neutral cards and places quick actions near the account overview. No fictitious graph or invented trend is needed in Ahd.
- [Origin dashboard](https://mobbin.com/screens/591e20b0-b44f-4ed7-81d9-db59fe022d5e) keeps informational content in secondary modules outside the main financial summary. [Xero setup guide](https://mobbin.com/screens/ff34c481-0859-4601-adb0-db44730c2790) uses a short title, concrete explanation and destination link to make education actionable.

Decision: replace the promotional mint hero and duplicated summary strip with one useful overview: Remaining in active agreements, the exact combined balance in Ahd's current shared-agreement currency (NGN), active agreement count, all agreement count, and next-step count. The balance module uses a pale tint while count links stay white. The amount describes recorded remaining obligations, not money held by Ahd; private debts stay separate. Link the attention count to the actual attention section, only when it exists. Remove Peace of mind, in writing and A shared record as requested. Replace the quotation with How Ahd works and a specific description of the existing guide. Copy now explains the page's job directly.

## Activity refinement — 8 October 2026

- [Monzo activity](https://mobbin.com/screens/13465bf2-7b22-40db-bee3-5486f4429541) groups entries under date labels with a distinct icon, readable event identity and quieter secondary detail.
- [Up history](https://mobbin.com/screens/ce919d50-33c1-4470-89ef-68eb34e0bc27) separates each day's rows and puts time beside the identity. [Wise history](https://mobbin.com/screens/62ecd9e8-86a2-4d2b-8d67-678e1693356c) uses restrained circular icons and secondary metadata rather than a large connected timeline.
- [Basecamp latest activity](https://mobbin.com/screens/3119c9f0-832e-448d-b750-03e5a806e9f6) separates days before presenting actors and actions. [Docusign envelope history](https://mobbin.com/screens/3b9577ec-b873-41e6-8a9b-82588f79da3b) retains action and exact timestamp as independent facts.

Decision: keep all recorded events, ordered newest first, and group them by calendar date in Africa/Lagos. Same-agreement timestamp ties use the preserved event sequence. A white group contains rows with semantic Lucide event icons, the recorded action, the agreement's parties/reference and a quiet time. Mint denotes a recorded confirmation; amber distinguishes a pending/review action, with text carrying the meaning. Each row links to its agreement. A cross-agreement history does not imply one shared progress percentage. Remove A preserved history and the shared footer as requested, reserving mobile bottom space for navigation. No audit data or hash chain is changed.

## Profile menu and appearance — 8 October 2026

- [Whereby account chooser](https://mobbin.com/screens/6e2dae71-0e89-4e82-8151-273e444af8de) uses a distinct identity marker and separated account rows. [Base account selector](https://mobbin.com/screens/0845c520-3a4f-4557-8431-285ab7adfcbc) reserves a checkmark for the active identity.
- [Remote Global HR profile switcher](https://mobbin.com/screens/cca1f651-7076-424e-8727-c8b4162369ef) separates profiles with clear names and a selected check. The [Fabric switcher](https://mobbin.com/screens/abdab1a1-c88c-40b9-8197-65c7cae286be) pairs circular identity marks with readable rows rather than exposing a compact operating-system menu.

Ahd uses an accessible Radix Select popover: circular initials, full names in the menu, a selected check, 56px rows, arrow-key/type-ahead support and Escape/focus return. It switches only the existing demo identity; it does not impersonate a production account. The background is inert while the menu is open.

The requested paper appearance uses a static, tiled SVG fractal-noise filter. It adds grain to the page canvas without animating or intercepting pointer events. Solid surfaces keep financial text clear. Semantic color tokens now support warm light paper and neutral charcoal surfaces. Theme preference is saved locally, follows the device by default, responds to system and cross-tab changes, and is applied before hydration to avoid a bright initial flash. Account includes Light, Dark and Device controls; the workspace has quick toggles. The browser/PWA theme color and offline screen follow the appearance. No additional private data is cached.

All decorative eyebrow headings have been removed from application screens. The agreement reference/version and private-debt currency/date remain as normal metadata. The guide's demonstration note has a 24px gap before its next action.


## Neutral dark appearance — 8 October 2026

The user requested a proper dark theme without green-tinted backgrounds or controls. Targeted Mobbin searches examined dark financial home screens and activity lists:

- [Cash App — dark home](https://mobbin.com/screens/d0320495-16a1-47cd-8164-d1fb9c7adc94): nearly black canvas and subtly lifted dark cards, white primary text, subdued secondary text.
- [Midday — dark workspace](https://mobbin.com/screens/4bcceb63-2afc-42cd-8c0a-12123af41a42): restrained monochrome dashboard, thin dividers, neutral controls.
- [Wealthsimple — dark activity](https://mobbin.com/screens/50d78c98-ef51-4a9a-90a6-cfe61769b373): date groups, neutral iconography, white values and low-contrast separators.

These are observed reusable patterns, not extracted proprietary tokens or a universal standard. Ahd uses its own neutral palette: #111111 canvas, #1c1c1c cards, #262626 recessed/secondary surfaces, #2c2c2c menus, #f1f1ef text and #b7b7b3 secondary text. Off-white actions use dark labels. Navigation, success badges, review cards, progress, field surfaces and callouts no longer receive a green tint in dark mode. Amber and red remain limited to meaningful pending/error states. Static monochrome grain has lower opacity in dark mode, keeping financial text legible. Browser/PWA chrome and offline recovery use the same neutral background. Light-mode brand colors remain unchanged.


## Purple primary actions and grey roles — 8 October 2026

The user's chosen #9C62F8 supersedes the earlier monochrome action and green brand choices. Research used three concrete queries: dark dashboard/purple primary/charcoal cards (web), banking home/purple controls/dark background (iOS), light financial dashboard/purple action/white cards/grey controls (web).

- [Mixpanel — dark dashboard](https://mobbin.com/screens/1a7d8d86-f0e8-456a-a60c-65c6eb13a252): charcoal navigation and panels with purple emphasis, readable white figures, and quiet outlines. Reuse the separation of surface hierarchy from accent emphasis; chart saturation is outside Ahd's scope.
- [KOHO — dark home](https://mobbin.com/screens/e49dff2c-e073-421b-8a2f-17458c37f3cd): purple selected tab/navigation against neutral dark chrome. Its promotional bright CTA and illustrated balance card are not adopted.
- [Quicken — light dashboard](https://mobbin.com/screens/804e1b41-0d08-460c-9318-bc47e5e6868e): white modules over light grey, secondary controls stay quiet, purple identifies interactive affordances.

Ahd's primary fill is exactly #9C62F8 in both themes. It uses #121212 labels; measured WCAG contrast is recorded in design-qa.md. Body copy uses neutral ink and grey secondary text. Theme-specific purple links (#7135C5 light, #C7A6FF dark) and soft selected-navigation backgrounds avoid using the bright primary as small text. Balances, callouts, forms and review summaries use grey surfaces rather than a brand tint. Filter selection stays neutral so it does not compete with the primary action. Status meaning still includes explicit labels/icons. The search focus indicator now outlines the complete rounded control instead of its square inner input; this retains visible keyboard focus.


## Responsive utility menu — 8 October 2026

[Manus — mobile account panel](https://mobbin.com/screens/fc3ef8e5-b4e4-4504-8f6a-00fcd97db718) places identity before grouped, icon-led utility rows. [Hootsuite — account panel](https://mobbin.com/screens/155a6fa5-52e6-466e-b3b3-6333eb747dd6) similarly separates profile information from account destinations. [Basedash — profile actions](https://mobbin.com/screens/f3873762-b55a-4bb5-8f7f-13fb11a9acec) exposes appearance beside account actions rather than adding persistent toolbar clutter.

Ahd adopts that grouping in a compact anchored menu. At <=1100px, a single 48px header menu button replaces the separate theme/install/avatar controls. It contains current identity, Account, Light/Dark mode, Install Ahd when available, and How Ahd works. Touch rows are 52px, icons are inset, the panel has 16px viewport clearance, and Escape restores the trigger. Radix non-modal menu semantics support arrow keys, dismissal and focus handling. Installation help lives outside the menu lifecycle so selecting it can close the menu and then open a dialog. Tablet navigation uses the existing labeled bottom navigation; desktop sidebar remains above 1100px.


### CTA label revision

The user subsequently requested that filled CTA labels match the page background in each theme. The final dark action uses #9C62F8 with #111111 labels (4.96:1). The light action uses a close deeper purple, #8541DF, with paper-light #F6F4EF labels (5.00:1). Light-mode hover deepens further; dark-mode hover lightens. This changes the earlier dark-labels-in-both-themes decision. Exact #9C62F8 with light text would miss the small-text contrast target, so the user's allowance for a close purple is used in light mode. Destructive filled actions also follow the theme-specific label treatment with a suitable background.
