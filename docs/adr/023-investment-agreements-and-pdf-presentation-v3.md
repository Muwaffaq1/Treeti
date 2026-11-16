# ADR 023 — Investment agreements behind a switch, and PDF presentation v3

## Status

Accepted, 16 November 2026.

## Investment agreements

Partners can write an investment agreement together (`src/modules/investment-agreements/`, screens in `src/components/investment-agreement.tsx`, migration `202611150011`). The owner chose these rules on 15 November 2026:

- 2 to 5 partners, including the writer, each putting in an amount of money. The agreement records who is investing together and how much each puts in. On 16 November 2026 the owner removed profit splits and loss rules: those are left for the partners to settle between themselves.
- Every partner signs the same version. A change request goes back to the writer, who makes a new version that everyone signs again. People can't be added or removed after sending.
- Up to two optional witnesses. The writer can finish without waiting for them.
- Invitations are private links the writer shares themselves (WhatsApp or copy), so no new email type is added (ADR 019).
- When final, each partner gets a linked record in their own Investments, showing each person's share of the money put in.

**Switch.** The owner's scholar accepted the wording on 16 November 2026, and the feature was turned on in production on 17 November 2026 (migration applied, `AHD_INVESTMENT_AGREEMENTS=true` in `wrangler.promotion.jsonc`). Before that, it was off because the wording had not yet been approved. `investmentAgreementsEnabled()` (`src/modules/investment-agreements/enabled.ts`) keeps the feature off in production. It is on in local development, and anywhere else only when `AHD_INVESTMENT_AGREEMENTS=true` (the demo test link sets it). When off, the pages answer "unavailable", the `/api/joint` routes return 404, and the New menu options and investments link are hidden. Nothing reads the new table, so migration `202611150011` is **not** applied to the live database yet.

To turn it on after review: apply the migration with `npm run db:migrate`, set `AHD_INVESTMENT_AGREEMENTS=true` on the Worker, and deploy.

## PDF presentation v3

All four documents (loan agreement, repayment receipt, settlement record, investment agreement) share one print-first design in `src/modules/documents/kit.tsx`: white paper, one accent, a plain-language summary, an amount card, numbered sections, signature blocks, a QR record check with SHA-256 fingerprints, and a footer with page numbers. Signed wording, affirmations and disclaimers are unchanged.

Saved evidence is never overwritten. Agreement PDFs move to `presentationVersion` 3: the next download for an older agreement saves a new copy alongside the original, and the record check uses the newest saved presentation. Saved receipts and settlement records keep their original copy; ones generated from now on use the new design.

## Consequences

- PDF, receipt, settlement and proof routes now return their intended 4xx errors instead of a bare 500 (a missing `await` let errors bypass the handler).
- Turning investment agreements on later needs a migration and an environment change, not a code change.
