# Private debt tracking — scope addition

The user requested personal tracking of debts agreed outside Ahd. This extends the original PRD with an owner-only ledger. Existing agreement workflows and consent rules remain unchanged.

Each record names the person owed, original principal, currency, debt date and optional notes. Owner-recorded repayments reduce this private balance immediately: there is no counterparty confirmation because the record is expressly personal bookkeeping. Zero balance is labelled “Paid back”, not mutually settled or witnessed. No invitations, notifications to the named person, signatures, PDFs or witness access are created.

Use authenticated server storage, owner checks, database RLS, integer minor units, validated calendar dates, transactional repayment checks and idempotent writes. Demo records use the existing workspace file adapter and are isolated by owner. Currency totals remain separate, with no inferred exchange rate. Initially supported currencies all have two decimal minor units: NGN, USD, GBP, EUR, GHS, KES, SAR, AED, CAD and AUD.

The earlier unfinished browser-only draft is replaced by durable server records. PostgreSQL schema is added by migration 202610080003_private_debts.sql. Production still requires the previously identified Supabase credentials and migrations.

## Verification

Unit and PostgreSQL integration checks cover exact minor-unit calculations, separate currency totals, idempotency, owner isolation, row-level security, direct mutation restrictions, date validation and overpayment prevention. Browser checks cover creation, refresh persistence, partial and full repayment, filtering, maximum amounts, long names/notes, accessibility and switching profiles at 375, 390, 430, 1366 and 1920 pixels. Screenshots are saved in `output/qa/private-debts-*.png` and `output/qa/private-debt-payment-*.png`.

Visual review moved the remaining balance onto its own row, kept secondary amounts readable, stopped cards stretching to their neighbour's height, and made long notes expandable.

The subsequent [Cash App design-system refresh](cash-app-design-system.md) adds owner-only timed reminders, in-app due cues, calendar exports and configured production email delivery. Reminder preferences use their own RLS-protected table and do not mutate agreement evidence. Paid debts cancel Ahd reminders; separately imported calendar events must be managed in the user's calendar.

## Hosted JSON transport repair — 9 October 2026

The first hosted debt reload exposed a Postgres.js transport mismatch: repositories send serialized JSON text, while the driver's inferred JSON/jsonb serializer encoded it again. The two saved staging debts were JSON strings containing their intact snapshots, so their amounts were unavailable to the UI.

Both Node and Workers connections now use explicit JSON codecs: serialized JSON text is sent unchanged, and reads decode existing object/array snapshots that were encoded twice. This applies consistently to debt records, payments, agreement evidence and idempotency responses. No stored financial records, ownership rules, amounts or hashes are rewritten. This is a compatibility repair within the existing architecture.

Regression checks cover exact balances, legacy snapshots, evidence/idempotency contents, scalar JSON and both connection configurations. A read-only real PostgreSQL probe confirmed correct JSON and jsonb round trips and verified both existing debt amounts against their relational principal columns. The full unit/integration suite passes (72 tests); hosted validation is recorded in [Cloudflare setup](cloudflare-setup.md).

Email-enabled reminder saves now queue a scoped Inngest event at the saved absolute timestamp. The worker reloads the saved reminder and debt before delivery; an old event cannot send a rescheduled reminder or a cancelled/paid debt. Database leases and provider idempotency keys suppress repeat delivery. Email submission failures trigger bounded job retries, with periodic recovery enabled only in production. Calendar alerts and in-app reminders remain independent. See [ADR 008](adr/008-background-delivery-wakeups.md).
