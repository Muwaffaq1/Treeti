# Pending invitation resends and simpler navigation

The bottom navigation contains Overview, Agreements, My debts and My investments. Agreement creation remains available from the overview and agreements pages.

A lender or borrower can select **Resend invitation** beside a person awaiting a response under **Agreed together**, on the current agreement version. This also covers invited witnesses after both parties approve. The action directly queues a fresh email invitation and displays a private link to share manually.

Resending preserves terms, version, status, approvals and attestations. It does not sign on anyone’s behalf. Closed, finalized and declined requests cannot be resent. Pending older links for the same recipient/version are revoked; previously claimed links remain usable for the verified person. New invitations use the existing seven-day expiry and email verification flow.

A server-enforced one-minute cooldown applies per recipient/version under the agreement transaction lock. Standard authorization, same-origin checks, rate limits and idempotency apply. Tokens remain encrypted in the delivery outbox and absent from idempotency responses. Background delivery skips invitations once the recipient’s response is recorded.

Validation: unit checks cover expiry, response eligibility, authorization, unchanged evidence and cooldowns; PostgreSQL integration checks cover durable encrypted delivery and idempotency; browser checks cover mobile/tablet navigation, direct resend, claiming the fresh link and hiding resend after approval. No database migration is required.
