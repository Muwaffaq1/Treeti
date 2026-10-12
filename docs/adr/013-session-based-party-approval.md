# Session-based lender and borrower approval — 10 October 2026

The owner explicitly requests removing the second verification-code round trip when an already signed-in lender or borrower approves terms. This replaces the original PRD action-specific OTP requirement for party approval only.

The mutation route revalidates the Supabase user and verified contacts on every request. An authenticated participant may approve after reviewing the exact current version, checking the affirmation and confirming their name. Keep origin checks, participant authorization, explicit affirmation, signature validation, stale-version checks, transactional persistence and idempotency. Do not synthesize a step-up grant or describe a session approval as fresh OTP evidence.

New approvals record VERIFIED_EMAIL_SESSION or VERIFIED_PHONE_SESSION (DEMO_SESSION for synthetic demonstrations), the verified contact, timestamp, version ID/hash and affirmation. Existing immutable approvals and evidence remain untouched. Approval does not consume an unrelated single-use grant. Witness attestation and the financial confirmation actions retain their existing verification policy. Sign-in still requires verified contact authentication; an expired/invalid session must sign in again.

No schema migration or provider authentication configuration change is needed. Cover live approval routing, both party approvals without grants, missing affirmation, unauthorized identity, stale versions, accurate evidence and retained financial/witness verification.
