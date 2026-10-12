# Final agreement PDF review

Research date: 2026-10-11. Implemented on 12 October 2026 after the owner chose to remove items 8-10.

## References inspected on Mobbin

- [Bonsai](https://mobbin.com/screens/4b4a228a-c0dd-445f-b8d6-a0b6778a648f): two generous signature columns with names and dates below. Use spacing to distinguish confirmations from contract prose.
- [Contractbook](https://mobbin.com/screens/19b53841-f3e0-4fc6-9fe6-acfd96958dcf): two party panels precede numbered agreement sections. Separate identity, financial facts and wording.
- [Midday](https://mobbin.com/screens/328c47b5-51d9-4e71-ac3a-ee46f4c65304): compact document metadata, aligned numeric rows and a prominent total. Use restrained rules instead of dense repeated boxes.
- [Square](https://mobbin.com/screens/ff3c2be2-17af-4d0d-981f-ba2b18731e34): a small QR code and explanation in the footer. Keep verification discoverable without giving hashes the same prominence as the agreement.
- [Airwallex](https://mobbin.com/screens/3cb31af0-9c52-4e70-a5f1-421541a57c12): balances listed separately with explicit currency codes. Investment totals should retain distinct currencies, without an invented converted total.

## Complete visible inventory for the final agreement

1. treeti wordmark, tagline, document title, public agreement reference, version. Demonstration records also identify themselves as demonstrations.
2. Lender and borrower names.
3. Principal in the agreement currency; zero contractual interest and 0%; agreement date; final repayment date; repayment structure; finalization timestamp in UTC.
4. Installment schedule, when present: payment number, due date and amount in the agreement currency.
5. Full frozen agreement wording. This includes loan amount, interest, dates/repayment conditions, optional purpose/additional terms, requested witness count and witness/payment statements. Historical agreements preserve their original wording.
6. Party confirmations: role, typed name/signature, acceptance statement, timestamp, authentication level and statement version identifier.
7. Witness acknowledgments: name/signature, acknowledgment statement, acknowledgment type, timestamp, authentication level and text version identifier. Legacy records retain their original attestation/presence wording. With no witnesses, a sentence explains that none were requested.
8. Record timeline: timestamps and action labels through finalization.
9. Record integrity: version SHA-256, evidence manifest SHA-256, audit root hash, verification QR code and verification URL.
10. Scope disclaimer: participant record, hash consistency versus external cryptographic signature, and no assertion of legal enforceability or Islamic compliance. Demonstrations have an additional synthetic-record warning. Every page has reference/version and page numbering.

PDF metadata also includes title, author/creator (treeti), and the frozen creation/modification time. These are file properties rather than visible agreement content.

Implemented direction: warm off-white page, charcoal text, a restrained purple accent, prominent amount, clear party columns and spacious confirmations. Removed the timeline, integrity hashes, QR/verification block, scope disclaimer and footer from the final agreement PDF. Party/witness authentication identifiers and statement versions remain because they belong to retained items 6-7. The complete frozen agreed wording is preserved. Stored evidence, historical canonical wording and previously saved PDF artifacts stay intact. The new layout is saved as presentation version 2, at a separate storage path. Downloads of both new and older agreements use that presentation; previously saved artifacts retain their original bytes. Verification checks the current presentation when present, with the original artifact as a fallback. Receipt and settlement PDF content remains unchanged.
