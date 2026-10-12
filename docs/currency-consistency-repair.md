# Currency consistency repair

11 October 2026.

## Report and changes

A tester's GBP agreement showed a correctly labeled principal beside hardcoded naira zero interest. The agreement summary now formats its interest amount with that version's currency. A second omission in the cleared-balance caption is fixed as well.

The shared money formatter now requires an explicit currency argument instead of silently defaulting to NGN. TypeScript checks every call site. Each agreement/version and private debt continues to own its currency independently; there is no account-wide currency setting or conversion between currency totals. Empty overviews show a neutral zero rather than inventing a naira balance.

The audit covers creation/revision previews, agreement cards and details, historical version terms, witness wording, repayment/forgiveness/settlement dialogs, installment schedules, private debt payment histories/plans/edits, grouped overview totals, and agreement/receipt/settlement PDFs. The landing-page sample remains an explicitly naira example. Interest remains zero and its rate remains 0%.

## Regression coverage

Browser tests check principal, zero interest and installment labels for all ten supported currencies. A GBP agreement is approved and partially repaid, and its balance and cleared amount stay in GBP while an existing NGN agreement and separate overview total remain in naira. Independent GBP/NGN private debts retain their units in payment dialogs, histories, plans and totals. An empty overview does not assign NGN to a GBP-only draft.

All financial mutations used for QA are synthetic local demo records. No existing user's agreement terms, approvals, evidence, balances or currency are changed by this repair. No database migration is required.

## Validation and staging release

All 134 unit/integration tests, lint, TypeScript, Cloudflare build and required local workerd checks pass. Eight distinct focused browser checks pass across two runs (the GBP journey was repeated after the empty-overview change). Workerd checks include single/installment PDF rendering and private/security response behavior.

Published staging version `7d5d37cc-85be-4e59-8bc2-c08cb3f3f5aa` at https://staging.usetreeti.xyz; gzip 2,999.08 KiB. Previous staging version: `22b0bde2-3d02-4592-b5da-f5edb4f83b73`. Production is unchanged. The public agreement/overview client asset matches the tested build byte for byte.

Post-deployment staging HTTPS, branding, legacy redirects, origin enforcement, private responses and unsigned job rejection checks pass. No real email or financial mutation was triggered.
