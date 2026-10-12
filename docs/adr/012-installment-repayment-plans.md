# Installment repayment plans — 9 October 2026

The owner requested grouped amounts while typing and repayment options beyond a single payment after tester feedback. This explicitly brings installment schedules forward from the PRD's V2 list. Keep the existing versioned PostgreSQL JSON evidence architecture; no new service or database table is needed.

Offer single repayment, weekly installments, monthly installments and a custom dated schedule. Use integer minor units, split recurring payments exactly with the remainder in the final payment, anchor monthly dates to the original day (clamping short months), and require 2–60 positive payments in strictly increasing date order. Their sum must equal the principal, no payment may precede the agreement date, and the final payment must match the contractual due date. Validate on the server as well as the form.

Store the schedule in each immutable agreement version and its canonical payload. New installment versions use terms schema v3; existing single-payment versions retain their fields, hashes and wording. All parties approve the same version, witnesses read that schedule, and final PDFs include it. Editing the plan requires a new version and fresh approvals before finalization.

Installments describe agreed dates, not transfers or automatic collection. Existing confirmed-payment accounting remains authoritative. Show cumulative progress against the schedule to parties only; proposed/disputed payments do not reduce scheduled outstanding amounts. Early or partial payments remain possible. Forgiveness clears balance only after acknowledgment. Settlement still requires zero balance and both parties' acknowledgment. Do not add interest, penalties or automatic financial transitions.

Group amount inputs without rounding, losing trailing decimals or moving the caret to the end during editing. Keep invalid pasted content visible for validation rather than silently turning it into a different valid amount.

## Implementation and verification

Schedules are stored inside the existing append-only version JSON; no database migration or provider configuration change is required. The form previews weekly/monthly splits and supports custom dated amounts, adding/removing payments and splitting custom amounts equally each month. The schedule appears in review, agreement detail and the finalized PDF. Parties see cumulative cleared/remaining progress; witnesses see agreed dates and amounts only.

Amount grouping applies to the lending principal, custom installment amounts, agreement repayments/forgiveness and private debt/payment fields. Browser checks cover typing, pasting, middle-of-number insertion and deletion, preserving fractional precision and refusing invalid pasted negative values.

Editing exposed an existing read-only borrower-contact issue: the sanitized participant list omits other contacts. The form now uses the borrower contact already present in the lender-visible canonical version payload; access rules and witness projections are unchanged.

All 104 unit/integration tests pass, including exact splits, weekly/year rollover, leap years/month-end anchoring, malformed/mismatched schedules, immutable PostgreSQL persistence, new-version hashes and approvals, two digital witnesses, confirmation-only balance changes, settlement and deterministic installment PDFs. Four new browser tests pass for monthly/mobile, weekly/desktop, custom/mobile dark mode, saved-plan reload/revision and invalid input. Thirteen existing agreement/debt browser checks also passed. Lint, type checking and Cloudflare build pass. The three-page synthetic installment PDF was rendered and visually reviewed; no clipping or overlap was observed. Local workerd validates both single-payment and installment PDFs and their hashes.

The new browser tests initially found a saved-plan confirmation still reading the single due-date field, then a navigation race in the test and the existing draft-edit contact issue. The confirmation now reads the saved version's final due date; the test waits for navigation, and revision checks pass. Hosted multi-person installment validation with actual contacts remains separate from these synthetic checks.

The corrected build is deployed at `https://staging.usetreeti.xyz`, version `6d2ec86f-688c-4893-a27e-036f5a5b66ed`, gzip 2,992.48 KiB. Final local workerd checks pass after the contact fix. Live checks pass for HTTPS, strict origins, redirects, private responses and unsigned jobs. The hosted client bundle's SHA-256 matches the tested local build and includes all three installment options. No live financial records, participant confirmations or provider credentials were changed by deployment validation.
