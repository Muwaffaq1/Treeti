# Direct verification-code resend

The sign-in page now provides a dedicated Resend code action after the first send. It directly sends another code to the same contact, retains the return path, clears the old input only after success, announces that the new code was sent, and returns focus to the code field. Change email is a separate action.

The witness invitation provides the same direct resend action, preserving the server-selected destination and original invitation token/version. The verification form stays available during pending requests, and code errors offer Resend code instead of a redundant invitation reload action. Busy controls prevent duplicate clicks. Failed/rate-limited sends preserve the entered code and show the server error so the person can retry without leaving the page.

Expired challenges now explicitly direct the person to Resend code. Existing expiry, server-side contact/IP verification rate limits, intended-recipient checks, verified session checks and explicit agreement consent remain in force. No routine agreement approval adds a code step.

Regression tests cover expired normal sign-in and borrower-return paths, witness resending, failed/rate-limited sends, focus and status announcements. Server tests advance beyond the challenge expiry and verify successful renewal for both sign-in and witness invitations. Provider/browser transports are mocked; no real email or financial record is changed by these tests.

## Validation and staging release

All 136 unit/integration tests, lint, Cloudflare build/TypeScript and local workerd checks pass. Fifteen distinct local browser checks pass across focused runs, including five widths in both themes and the expired/rate-limited recovery cases. All four focused resend cases also pass against the deployed staging frontend with email/verification calls intercepted; hosted HTTPS/origin/private-response smoke checks pass.

Published staging version `b4942b66-2d0f-4260-b020-c912528807a2`, gzip 2,999.41 KiB, at https://staging.usetreeti.xyz. Previous version: `7d5d37cc-85be-4e59-8bc2-c08cb3f3f5aa`. No database migration, provider credential/settings change, real test email or financial mutation was needed. Production is unchanged.
