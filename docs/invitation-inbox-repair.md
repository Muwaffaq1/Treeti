# Borrower invitation access and mobile forms — 9 October 2026

Tester feedback exposed two gaps: the invitation claim POST was gated to demo mode, so signed-in staging recipients received a 404; and the dashboard queried linked participant user IDs only, excluding invited borrowers until they opened an email link. Restore the authenticated live claim route with existing origin, verification, expiry, version and role checks.

Implement the existing PRD FR-037 in-app borrower-invited requirement using a separate pending inbox. Match only Supabase-verified contacts, return lender name and public agreement reference only, and show a Review agreement action on the overview and agreement listing. Unsigned drafts, stale/revoked/expired invitations, already-linked participants and other contacts do not appear. Reviewing explicitly claims the invitation under a parent-row transaction and links the borrower; it does not approve terms. No token is exposed in the inbox, and guessing an invitation UUID does not confer access. A repeated authorized claim is idempotent. Witness verification and scoped evidence access remain the separate existing flow.

No schema migration, RLS relaxation, evidence rewrite, real agreement creation or external email is needed for this repair. Existing active emailed invitations can use the restored route.

Constrain native date/datetime inputs and their field wrappers to the available inline width and use shrinkable grid tracks. Preserve the native date picker and visible focus. Verify the single, recurring and custom-plan forms in Chromium and mobile WebKit, including nested cards with a large amount.
