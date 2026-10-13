# Device push notifications

## Owner decision — 13 October 2026

After event and invitation email were removed (ADR 019), a person only learned of an update by opening treeti. The owner asked for notifications on phones and computers, at no cost.

- **Standards only.** Notifications use Web Push (RFC 8291 message encryption, RFC 8292 VAPID) implemented with Web Crypto in `src/lib/web-push.ts`, so the same code runs on Cloudflare Workers and Node with no dependency. A unit check reproduces the RFC 8291 example byte for byte.
- **Opt-in per device.** Nothing is requested automatically. The Notifications and Account pages show **Turn on notifications**; the browser then asks for permission. iPhone and iPad allow this only for an app added to the home screen, so those devices are told to install first. A blocked permission is explained, not re-requested. **Turn off** and signing out both remove the device.
- **What is stored.** `public.push_subscriptions` (migration `202610130008`) holds the push service address and the two public values the browser supplies for each device, keyed to the user. It is server-only: row level security is on with no browser policy. A device belongs to whoever signed in on it last, and at most eight devices are kept per person. Addresses must be https and on a browser vendor's push service, so a subscription cannot direct the server elsewhere.
- **What is sent.** When the outbox records a lifecycle update for a participant other than the person who acted, their devices receive the same short generic line (for example "A repayment has been confirmed by both parties.") and the agreement path. When an invitation is created for an email that already has an account, that person's devices are told an agreement is waiting. No names, amounts or links to invitation tokens are sent. A retried outbox row does not notify twice.
- **Failure never blocks records.** Sending cannot throw into the outbox; a device the push service reports as gone is forgotten; other failures are dropped. Consent and financial state continue to commit synchronously and never depend on delivery.
- **Keys.** The VAPID pair is created once by `node scripts/set-push-keys.mjs`, which stores both values as Worker secrets without writing the private key to disk or the terminal and refuses to replace an existing pair, because rotation disconnects every enabled device. Without the pair the feature stays hidden.

Limits: delivery depends on the browser vendor's service and the device being reachable; the demonstration offers no device notifications; private debt reminders are not pushed yet; read state on the Notifications page remains per device. On the free Workers plan a single outbox batch that notified many devices could approach the 50-subrequest limit; the batch size and eight-device cap keep this unlikely at current scale.

Validation: unit checks cover encryption, signing and delivery outcomes; PGlite integration checks cover the migration, device ownership, the cap, retired devices, the service allow-list and browser-role denial. Real delivery to a phone can only be confirmed on the live site after release.
