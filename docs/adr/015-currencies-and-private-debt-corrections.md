# ADR 015 — Currency choices and private debt corrections

Accepted, 11 October 2026.

## Decision

Shared agreements support the same ten two-decimal currencies as private debts: NGN, USD, GBP, EUR, GHS, KES, SAR, AED, CAD and AUD. Amounts remain exact integer minor units. Currency is part of the agreed version, wording, witness acknowledgment and frozen evidence. New non-NGN versions use `treeti-terms-v4`; earlier evidence remains unchanged. Currency changes to proposals create a new version requiring fresh consent. Finalized agreement currency cannot change.

The overview shows one total per currency; it does not convert or add unlike currencies. PDFs, receipts and schedules use the agreement currency. Non-NGN amounts include their explicit code to distinguish currencies that share a symbol.

Private debts can optionally have a single repayment date or weekly, monthly or custom installments. Plans contain 2–60 ordered payments totaling the full original amount. Monthly schedules retain the initial day and clamp shorter months. Recorded payments clear the earliest amounts first. These plans remain private and neither invite the named person nor move money.

Owners can correct a private debt's person, original amount, date, note and plan. Currency can change only before any payment is recorded. The revised amount cannot be below recorded payments and the revised debt date cannot be after the earliest payment. Payments remain immutable. A revision guard prevents overwriting a concurrent edit; edits and repayments serialize on the same database row. Retrying the same request is idempotent.

Migration `202610110006_currencies_and_debt_edits.sql` adds append-only private debt revisions, preserves originals, validates edits and plans, and expands the agreement currency allowlist. Direct authenticated writes remain prohibited; revisions are readable only by their owner. Records cannot be deleted. Reminders are removed when a correction leaves no balance.

## Consequences

This supports correcting personal records without rewriting payment evidence. It does not provide currency conversion, interest, payment processing or editing finalized shared terms. Currency precision is intentionally limited to the supported two-decimal currencies. Existing participant and witness sign-in rules are unchanged.
