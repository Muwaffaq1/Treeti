# Private investments and agreement PDF release

Implemented 12 October 2026 for staging.

- My investments is accessible in the main mobile/tablet navigation and desktop sidebar. Owners can create a record in any of the ten supported currencies, add dated contributions, correct metadata or contributions, search and archive/restore.
- Active totals stay separate by currency and use exact integer arithmetic. These are recorded contributions, not returns or current valuation. Currency stays fixed once additional contributions exist.
- Owner checks protect reads and writes. Updates serialize on the record and check its revision. Idempotent retries avoid duplicate contributions. Supabase owner-only RLS and append-only revision snapshots preserve private corrections.
- The additive migration is `202610110007_private_investments.sql`; existing debt and agreement data is unaffected.
- The final agreement PDF uses a warm cream page, charcoal typography, purple accent, prominent principal, party columns and clearly separated confirmations. The owner requested removal of inventory items 8-10: timeline, integrity/verification block, disclaimer and footer.
- Exact finalized wording, currency, installments, approvals and witness statements remain. Authentication levels and statement versions were retained as part of items 6-7.
- Presentation version 2 is stored separately, so downloading an older agreement shows the new design without replacing its original saved artifact or rewriting its manifest. Verification prefers the current presentation when one exists. Receipt and settlement document layouts are unchanged.

Research references and the full original content inventory are in `pdf-design-research.md`. Scope and operation details are in `investment-tracker-proposal.md`.

Validation: 144 unit/integration tests; three browser journeys at phone, tablet and desktop widths including owner isolation, editing, currencies, archive/restore, accessibility and layout; lint and types; visual PDF checks plus text/page-bound checks for witness and 60-installment records. Cloudflare build/runtime and deployment details are recorded after publishing.

Published to `https://staging.usetreeti.xyz` as Worker `ahd-staging`, version `aab9f6eb-8e25-47fb-9070-59f539b41e77`. Compressed Worker upload: 3,009.98 KiB (within the free plan's 3 MiB limit). Local workerd checks passed for routes, private caching/security, investment totals, both PDF layouts and sign-in across five widths in both themes. Production was not deployed.
