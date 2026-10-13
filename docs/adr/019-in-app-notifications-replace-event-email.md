# In-app notifications replace event and invitation email

## Owner decision — 13 October 2026

The owner does not want to pay for higher email limits and asked that the only email a person receives is their sign-in code. The free email plan allows 100 messages a day, and lifecycle updates were emailed to every participant for about twenty event types, so one agreement with six repayments could send two dozen emails. This supersedes the email-only delivery choice in ADR 009 for everything except sign-in.

What changed:

- **Lifecycle updates are in-app only.** The outbox worker still records each update in `notifications`, now skipping the person who performed the action, and no longer sends email. A Notifications page and a bell with an unread count show what other people did on a person's agreements, derived from agreement events and the pending-invitation inbox so the demonstration and live modes behave the same. Read state is kept per device in browser storage; it is a convenience, not a record.
- **Invitations are not emailed.** After sending, and after Resend invitation, the sender is shown the private link with **Share on WhatsApp** first and **Copy link** second. A person who already has an account also sees the request in their in-app inbox. A person who has never used treeti learns of it only if the sender shares the link. The invited email remains required because it is the identity the invitee must verify.
- **Remind on WhatsApp.** When a party is waiting on someone who has already opened the agreement — to approve, confirm as a witness, confirm a repayment, review forgiveness or acknowledge settlement — a **Remind on WhatsApp** action beside that person opens WhatsApp with a short message and the agreement link. treeti sends nothing itself, and the message contains no amounts.
- **Email reminders for private debts are no longer offered.** In-app reminders and calendar files remain. Reminders already scheduled by email are left to run.
- **Install prompt.** A signed-in person who has not installed treeti is shown a dismissible prompt after about seven seconds, at most once every fourteen days. It never blocks the page and is suppressed in automated browsers unless a test asks for it.

Not included yet: phone and browser push notifications, which need a new table, signing keys held as Worker secrets and service-worker changes. Until then a person learns of an update when they open treeti.

Sign-in codes are still emailed through Supabase and remain subject to the provider's daily cap and the project's hourly auth email limit.

Validation: unit checks cover who is notified, ordering, limits and the pending-invitation notice; browser checks cover the unread count, the New marker, read state, the WhatsApp share target, the install prompt and accessibility at phone and desktop widths. No database migration is required.
