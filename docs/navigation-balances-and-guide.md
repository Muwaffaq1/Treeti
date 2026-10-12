# Navigation, local activity and current guide — 12 October 2026

My investments replaces Activity in the main sidebar and mobile bottom navigation. Activity remains available in the mobile/tablet utility menu and secondary sidebar list.

Overview separates Money owed to you (lender) from Money you owe (borrower), showing exact outstanding ACTIVE/SETTLEMENT_PENDING balances grouped by currency in each direction. Witnessed, proposed, cancelled and settled agreements are excluded. Private debts are kept in My debts, never mixed with shared agreements.

Activity derives its time zone from the viewer’s device after hydration. Both event times and day groups use that zone, including daylight saving. Original UTC timestamps and the agreement’s business-date rules are unchanged. The full local timestamp is available on the time element.

How treeti works now covers email sign-in and resending codes, currencies and instalments, borrower review, optional accountless witnesses, external repayments and documents, private debts, investments, cancellation and local activity. The public and signed-in guides share the same content; the testing walkthrough and prelaunch text have been removed from the guide.

Validation: lint and typecheck pass; all 146 unit/integration tests pass; ten browser journeys cover currencies, investments and navigation, with the three final navigation/local-time journeys also rerun successfully. Phone (375px), tablet (768px) and desktop (1366px) layouts were inspected. New York, Tokyo and London browser time zones and a winter/summer DST unit case passed. Cloudflare runtime checks and live staging smoke checks pass.

Published to https://staging.usetreeti.xyz on 12 October 2026. Worker ahd-staging, version d8df0ca7-e398-4ebb-b12d-cb01873afbea; compressed upload 3007.00 KiB. Production was not deployed.


Sidebar cleanup: removed the Clarity today / Trust tomorrow caption and the Private by intention privacy block, with 32px below the brand and 24px above the account row. Lint, the desktop browser/navigation check, and Cloudflare build/runtime checks passed. Published staging version 7d797c67-d10a-46a3-9513-c81fafc4444f, compressed 3006.86 KiB.
