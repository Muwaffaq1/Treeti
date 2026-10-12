# Simpler treeti flows — 11 October 2026

## Implemented findings

| Priority | Source | Before → after | Why |
| --- | --- | --- | --- |
| High | `src/components/auth.tsx:10`, `src/app/api/auth/[action]/route.ts:33` | Name + email on every sign-in → email + code, first-use name only after verification | Returning users keep their saved name; sending never probes account existence or overwrites it. |
| High | `src/components/auth.tsx:24` | Check invitation + claim → automatic lookup and verified recipient claim | Reading never implies agreement; wrong identities get a clear account-change route. |
| High | `src/modules/agreements/domain.ts:65`, `src/components/agreement-detail.tsx` | Repeated action codes → server-revalidated session + explicit action | Keep role, counterparty, version, balance and consent checks; record truthful session evidence. |
| High | `src/components/create-agreement.tsx:58`, `src/modules/agreements/domain.ts:111` | Send, then approve separately → Agree and send | Atomic lender consent and invitation. Save draft remains separate and creates no approval. |
| Medium | `src/modules/agreements/domain.ts:247` | Manual finalize → preserve automatically at the last required confirmation | Exact immutable version, approvals, witnesses, audit root and document generation stay together in the locked transaction. |
| Medium | `src/components/agreement-detail.tsx`, `src/modules/agreements/domain.ts:201` | Final payment, confirmation, two settlement dialogs → optional explicit closure consent inside recording and confirmation | Conditional consent takes effect only when a confirmed payment clears the balance. Both parties must opt in. |
| Medium | `src/components/create-agreement.tsx:64` | Four creation screens → Loan details, Terms, Review; More options for optional text | Group related essentials and keep optional details discoverable. |
| Medium | `src/components/auth.tsx:35`, `src/components/agreement-detail.tsx` | Witness name twice + five-minute action grant → invited/stored name, one email verification and witness affirmation | Long reads do not require another code. Name remains editable for the confirmation; access stays version-scoped. |

No historical finalized record is rewritten. Pre-existing complete, unfinalized agreements retain the explicit finalize compatibility action; new last-required confirmations finalize automatically. Legacy payments without closure consent retain separate acknowledgments. Original presence-based witness versions retain their original statements unless revised with new party consent.

## Verification

- 126 unit/integration checks passed, including PostgreSQL atomic agree/send, idempotent auto-finalization and combined settlement; missing consent, wrong role/contact, stale/revoked invitations, competing balances and immutable evidence remain covered.
- 24 Chromium browser checks passed across focused runs, including the complete create → borrower agreement → two witnesses → automatic PDF → final repayment → mutual closure journey. Axe checks and overflow checks cover 375, 390, 430, 1366 and 1920 px; short witness verification covers both themes. Fixed a same-workspace demo-cookie race exposed by automatic lookup.
- Two mobile WebKit checks passed at 375/768 px, covering single/monthly/custom date controls.
- Lint, type checking and Cloudflare build pass. Worker dry-run: gzip 2,994.44 KiB, below the Free 3 MiB limit. No new dependency, schema migration or provider Auth setting needed.
- Local workerd checks pass: private caching and routes, disabled demo, unsigned job rejection, PDF rendering/hashing, signed sessions, and email-only sign-in rendering at five widths in both themes. Hosted smoke verification passes for HTTPS, email-only sign-in, private first-use name setup and unauthenticated profile-write rejection, old-link redirects, strict origins, private responses and unsigned job rejection. No real emails, participant agreements or payments are created by these checks.

Visual review: mobile loan-details and terms screenshots checked. This is a focused flow verification, not a complete RTL/200% zoom or real hosted multi-person accessibility test.

Verdict: Approve the simplified flows for staging review after the runtime and hosted checks. Public production launch still requires the existing production-readiness gates and a real multi-person retest.

Deployed to `staging.usetreeti.xyz`, Worker version `e5948bdd-d303-40cf-a986-31c171411925`. Previous rollback version: `9b13f9c3-cf84-43dc-9f3b-0cdf84c36a8b`. No production environment or unrelated provider settings changed. Real hosted borrower/witness email delivery and the complete multi-person journey remain a user retest.
