# Short witness verification and working sign-in returns

## Decision recorded before implementation — 9 October 2026

The product owner requested witnesses to respond without traditional account creation. Architecture section 18 already permits an internal authenticated identity with no username, password, profile setup or separate registration page. Keep that model; an invitation and typed name alone do not establish the invited contact's identity.

- A witness enters their name within the invitation and receives a code at its server-selected destination. The client cannot change the destination or request a borrower approval grant through this flow.
- After verification, claim the invitation using the existing transaction and identity/distinct-role checks. Recheck its current version and witness status. Issue the existing five-minute, single-use `attest` grant for that exact agreement/version. Verification does not submit an attestation; the witness still reads the terms, types their confirmation name and expressly consents.
- Expired, revoked, superseded, already-responded and wrong-role invitations do not receive a witness grant. A name may be stored on a newly created internal identity; this is not a claim of identity-document verification.
- A regular sign-in email may return through a PKCE callback while the provider still uses its default link template. Bind this return to the original signed, short-lived challenge and verify the returned identity. Never accept arbitrary access tokens, external return destinations or a magic link as an agreement action grant.
- The intended email interface remains codes. Install the prepared Supabase OTP templates through custom SMTP. Until delivery is configured, do not claim that real multi-person testing or production email works. Resend's testing domain permits only the account owner's address.

No evidence schema, witness policy, party authentication requirement or financial authorization is weakened. The product owner clarified that this request concerns witnesses. Lenders and borrowers retain authenticated access.
