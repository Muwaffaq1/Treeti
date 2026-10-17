# Interest-free safeguards and private debt witnesses

## Owner decision — 17 October 2026

Launch feedback asked for two things: a way to list the witnesses to a private debt, and protection against treeti being used to record interest-based loans. The owner chose to build both before the statement-style agreement wording, borrower-initiated agreements and next of kin access.

- **Debt witnesses are names only.** A private debt takes up to four optional witness names (`witnesses` in `src/modules/debts/model.ts`), shown on the card as "Witnessed by …" and editable. They live in the debt's `data` JSON, so no migration was needed. The existing metadata trigger ignores the key, and the revision history keeps each change. Private debts stay owner-only: witnesses are never invited, contacted or given access.
- **Each party declares the loan interest-free.** The lender's and borrower's approval wording now ends with an explicit declaration that only the amount lent is repaid, with no interest, fees, penalties or other extra charges. It is stored with the approval as `LENDER_ACCEPT_V2` / `BORROWER_ACCEPT_V2` and printed on the final PDF. Approvals already given keep their original V1 wording. Version text, hashes and witness statements are unchanged.
- **Warn, don't block.** `interestWording` (`src/components/agreement-utils.ts`) flags words such as interest, fee, penalty, profit or a percentage in the purpose and additional terms. "Interest-free", "no interest" and similar phrases are ignored. The lender sees a warning while writing and on review, and the borrower and witnesses see one before they respond. It does not block saving, because words like "profit" or "fee" can appear innocently. The binding safeguards are the 0% interest in the terms schema and the declarations.
- **Terms of use.** A clause prohibits recording a loan that requires repaying more than was borrowed, in any form, written or agreed separately, and allows suspension of accounts that break this rule.

Limits: treeti cannot see agreements made outside the app, and the word check can be avoided with deliberately vague wording. The terms clause and the parties' declarations are what make that misuse a breach.
