# Private investment log

Implemented on 12 October 2026. Entry point: My investments in the main mobile/tablet navigation and desktop sidebar.

The purpose is to remember where money was invested and the original contributions. It does not calculate investment returns, losses, market prices or current portfolio value.

A separate My investments area, accessible from the main navigation, keeps these personal records separate from loans and repayments. Adding a record requires a free-text investment name/place, amount, supported currency and date. Notes and categories are optional so any investment can be recorded.

Each record owns its currency. Further contributions use that same currency and retain their own dates and optional notes; investing in the same place in another currency creates a separate record. Cards show the name, total recorded amount invested, currency and most recent contribution. Totals are grouped by currency without exchange-rate conversion.

Owners can correct their own entries and archive records they no longer want in the default view. Contributions are private, with no borrower/witness, account connection, money transfer or additional verification step. Existing verified sessions authorize access, and ownership checks protect every read and write.

The first version supports add/edit records, correcting individual contributions, grouped totals, search and archive/restore. Currency can be corrected while there is only one contribution; once additional contributions are recorded, it stays fixed. Archived records retain their history and are excluded from active totals. Every update is serialized and checks the revision; retries use idempotency keys. Database policies isolate owners and an append-only revision table preserves corrections.

Totals are labeled Amount invested, never Current value or Profit. Categories, live prices, returns calculations and payment integrations are outside this version.
