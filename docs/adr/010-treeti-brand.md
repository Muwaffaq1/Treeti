# treeti product name

## Decision recorded before implementation — 9 October 2026

The owner renamed the product from Ahd to **treeti**, with `usetreeti.xyz` as its purchased domain. Use the lowercase name across product copy, fresh email templates, metadata, PWA installation, newly rendered documents, reminders and service display labels. Create a purple app symbol and favicon that remain legible at small sizes.

Preserve already stored agreement wording, IDs, signatures, audit hashes and document artifacts. Preserve deployed environment variable names, cookie names, encryption derivation labels, database/storage identifiers, Inngest app/event identifiers and the current staging Worker hostname until a separately tested migration can replace them without losing sessions, access, job retries or records. These are compatibility identifiers, not the product's display name. Keep original PRD/architecture documents as supplied and historical ADRs as a record of prior decisions.

Retain legacy public icon URLs for installed clients while the new manifest and service worker reference treeti assets. Invalidate only this app's old public cache. Keep private records out of the service worker cache. Generated PDF appearance may change for newly generated artifacts; previously stored files remain unchanged.

New agreement numbers use `TREETI-YYYY-NNNNN`. Existing `AHD-YYYY-NNNNN` numbers remain valid, including public integrity lookup. Imported calendar reminder UIDs retain their existing suffix to avoid duplicate events.

Provider verification: Supabase organization `treeti`, project `treeti staging`, SMTP sender `treeti`, Resend key label `treeti staging`, Inngest organization `treeti` and event-key label `treeti staging` were saved and verified. Inngest's served app label follows its stable SDK app ID (`ahd`), and its dashboard does not expose an independent rename action. Keep that ID until a job migration is tested. Upstash's `ahd-staging-ratelimit` label is still pending: the console exposes no rename control, and its documented rename API requires management credentials, not the connected Redis REST token. Do not create a broad management key just for a cosmetic change. Cloudflare Worker names and the existing hostname remain compatibility identifiers.

This rebrand does not turn staging into production or automatically change authentication return destinations. Provider display labels and sender display names must be verified after saving. Never alter the unrelated `send.nuring.com` product.
