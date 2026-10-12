# ADR 014 — Simple verified-session flows

Accepted 11 October 2026, at the product owner’s request after the simplicity audit. Supersedes routine action step-up requirements in the original PRD/architecture; ADR 013 covered party approval only.

Private access still requires a server-revalidated, confirmed identity. Routine record actions, including witnesses, use that session rather than another OTP. The evidence describes session authentication accurately. Witness access remains scoped to an invited version; a bearer link and typed name alone do not authorize access. Sign-in asks for a name only if the verified profile has none.

Agree and send atomically records explicit lender consent and issues the borrower invitation. Sending without consent remains a distinct legacy action. Approval of changed terms remains fresh and explicit. Finalization runs in the same locked transaction as the last required approval/attestation, preserving the exact version, audit root and evidence manifest. Existing finalized records are unchanged.

Final-payment recording and confirmation offer optional explicit closure consent. A proposal stores conditional consent; it creates no settlement acknowledgment until the payment is confirmed and the balance is zero. Both parties’ consent is required for closure. Partial payments, disputed payments, and legacy payments without closure consent cannot silently settle an agreement. Separate settlement acknowledgments remain available.

Creation has three steps, with optional text behind More options. Invitations are checked automatically, then claimed with the verified recipient’s identity; opening does not approve terms. No new dependency or service configuration is needed.
