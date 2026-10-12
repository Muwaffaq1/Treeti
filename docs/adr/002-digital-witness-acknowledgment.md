# Digital witness acknowledgment

## Decision recorded before implementation — 8 October 2026

The product owner explicitly changed the witness workflow: read the exact terms, understand who is lending to whom, and agree to act as a witness. Physical presence at formation or debt acknowledgment is no longer a requirement for newly created agreement versions.

This overrides the direct-observation requirement in PRD FR-013–FR-015 and the corresponding architecture witness categories for new versions only. It is a product policy decision, not a claim about Islamic sufficiency or legal enforceability. The immediate-transaction writing exception in Al-Baqarah 2:282 does not itself determine the requirements for witnessing a deferred loan. The documented qualified policy review remains a launch requirement.

## Implementation contract

- New terms use `ahd-terms-v2` and bind `DIGITAL_ACKNOWLEDGEMENT_V1` into the hashed payload and human-readable wording. Both parties must approve that exact version.
- Store the response as `DIGITAL_ACKNOWLEDGEMENT`, with context `DOCUMENT_REVIEW`, the participant names, principal and version, explicit consent to act as a witness, and the non-guarantor statement. A single acknowledgment checkbox and typed name replace observation and presence questions; contact verification remains required in production.
- Digital acknowledgments satisfy the requested witness count only under this new policy. They never claim physical presence, formation observation, disbursement or receipt of funds. Ordinary legacy `REVIEW_ONLY` responses continue not to satisfy legacy requirements.
- Preserve existing version hashes, approvals, attestations and finalized PDFs. Pending older versions need a new version and fresh party approvals before using the simplified interface. Historic direct-witness responses retain their original wording and interpretation.
- Keep per-recipient invitations, distinct authenticated witnesses, exact-version binding, private access, append-only audit history and manual party finalization. No witness guarantees repayment or receives later financial details.
- Extend the database check constraint additively. The evidence manifest keeps its existing envelope schema; the embedded version policy and response text version explicitly identify the new semantics.

## Production next steps

The local demonstration is functional but is not production identity or delivery evidence. Connect and validate real Supabase Auth/PostgreSQL/private Storage, production OTP delivery, Resend and Inngest; test in a separate HTTPS staging environment. Before a public beta, complete monitoring, recovery, privacy/retention and evidence-policy review. Witnesses currently verify the invited contact and create/sign into an account without a password; anonymous link-only attestation is not supported.
