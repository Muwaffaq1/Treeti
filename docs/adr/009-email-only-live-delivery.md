# Email-only live delivery

## Decision recorded before implementation — 9 October 2026

The architecture supports email and international phone contacts. This deployment has verified Resend email delivery but no SMS transport or configured phone verification provider. Offering phone contacts currently creates invitations people cannot verify and notifications that cannot be delivered.

Live sign-in, new borrower invitations and witness invitations therefore accept email addresses only. Enforce this at the API boundary as well as in forms; resolve invitation destinations on the server before checking availability. An existing phone invitation must explain that phone verification is unavailable rather than offer a code that cannot arrive. Financial confirmation selects a verified email belonging to the authenticated identity.

Keep canonical email/phone schemas, stored participant contacts, historical evidence and demonstration behavior intact. Existing phone records remain readable and their terms can be versioned; sending an unsupported invitation is blocked. This is a deployment capability restriction, not a change to identity or consent requirements. Do not add a switch that advertises SMS before both verification and notification transports are implemented and tested.

Validation must cover direct API bypass attempts, server-selected witness destinations, phone-only confirmation identities, existing phone invitations and unchanged demonstration support. Fresh hosted SMTP delivery and the complete multi-person agreement journey remain separate launch checks.
