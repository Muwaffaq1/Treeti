# Production readiness — 12 October 2026

## Current promotion decision

The existing Supabase project and Cloudflare Worker have been promoted to **https://usetreeti.xyz**, preserving accounts and records. GitHub's verify and Workers checks passed for app commit `53a75e7`. A clean build of that commit passed local Workers checks, and the main-domain HTTPS/origin/private-route/old-link checks and scoped signed background-job probes passed. Final Cloudflare version: `34317822-68d0-42aa-b8dc-2278b8de4cd6`. A fresh private snapshot restored 26 tables, 380 rows, 36 foreign keys and six files offline. See [ADR 016](adr/016-existing-project-production-promotion.md) for release evidence, backup limits and rollback.

The owner's root-domain sign-in/reload and existing-record/PDF checks remain pending. Privacy/terms/support, independent recovery and failure monitoring remain broader-launch tasks. Schedules remain disabled to protect shared quotas. Use `npm run cf:deploy:production` for future verified releases; the old staging deployment command is guarded. Newer uncommitted local UI edits were preserved and excluded from this release.

## Release — notifications lookup within the CPU limit

Production at **https://usetreeti.xyz** runs app commit `f12d6c9` as Cloudflare version `88e1b2d4-4d4a-43c3-a339-82181e54f84d`, deployed 13 October 2026 with `npm run cf:deploy:production`. This fixes a fault from the two notification releases: the bell loaded every agreement in full on each page, and Cloudflare cut `GET /api/notifications` off with “Worker exceeded CPU time limit”. Safari showed the cut-off as “The string did not match the expected pattern.” when the owner tried to turn on notifications on an iPhone.

Live mode now reads the `notifications` table in one query (`recordedNotices`), the bell reuses its list for 60 seconds, and a response that is not JSON shows “treeti is busy right now. Wait a moment and try again.” Demo mode still derives its list from agreements.

Production steps, in order: a fresh private snapshot (`output/backups/2026-10-13T10-24-27.137Z`, 27 tables, 499 rows, 36 foreign keys, nine Storage files, restored offline); GitHub's verify and Workers jobs passed for the commit; then the deploy. No migration and no secret changed. Locally, lint, types, 170 unit and integration tests and the Workers checks passed. After the deploy, `npm run check:production` and the read-only scoped job probes passed.

Not verified by the agent: CPU time of the new lookup on the live site, and the owner's iPhone turning notifications on. Rollback version: `9e14aae9-e7a8-4a5a-a679-63e218e19c0c`.

## Release — device push notifications

Production at **https://usetreeti.xyz** runs app commit `450c1bb` as Cloudflare version `9e14aae9-e7a8-4a5a-a679-63e218e19c0c` (gzip 3,027.95 KiB), deployed 13 October 2026 with `npm run cf:deploy:production`. People can turn on notifications per device from the Notifications or Account page; see [ADR 020](adr/020-device-push-notifications.md).

Production steps, in order: a fresh private snapshot (`output/backups/2026-10-13T09-31-45.864Z`, 26 tables, 498 rows, 36 foreign keys, nine Storage files, restored offline); GitHub's verify and Workers jobs passed for the commit; `npm run db:migrate` applied `202610130008_push_subscriptions.sql` only, and a read-only check confirmed the table is empty, has row level security with no policy, and cannot be read by the `anon` or `authenticated` roles; `node scripts/set-push-keys.mjs` created `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` as Worker secrets and a second run changed nothing; then the deploy. Locally, lint, types, 169 unit and integration tests and the Workers checks passed. After the deploy, `npm run check:production` and the read-only scoped job probes passed, `/api/push` and `/api/push/subscribe` rejected unsigned requests with 401, and the live service worker contained the push handler.

Not verified by the agent: the signed-in control, and a real alert arriving on a phone or computer. The owner should turn notifications on and have a second person act on a shared agreement.

Rollback version: `6e40aece-98f2-49a8-ad8b-d46cd3f9f61e`. A code rollback leaves the new table and the two secrets in place; both are unused by the earlier version. Do not regenerate the keys: that disconnects every enabled device.

## Release — in-app notifications replace event and invitation email

Production at **https://usetreeti.xyz** runs app commit `84b96d4` as Cloudflare version `6e40aece-98f2-49a8-ad8b-d46cd3f9f61e` (gzip 3,021.91 KiB), deployed 13 October 2026 with `npm run cf:deploy:production`. Lifecycle updates and invitations are no longer emailed; the only email is the sign-in code. The release adds the Notifications page and bell, WhatsApp-first sharing of invitation links, **Remind on WhatsApp** for a waiting party, and a dismissible install prompt, and removes the email option for private debt reminders; see [ADR 019](adr/019-in-app-notifications-replace-event-email.md). No database migration was needed. Push notifications are not included.

GitHub's Workers job passed on the first commit (`7337e2c`) but its verify job failed in five browser checks: two of the new notification checks raced the bell's first load, and three existing checks were refused by the demonstration's 120-commands-per-person limit because the new checks ran as the same demonstration person. `84b96d4` changes only the test file — the new checks wait for the first load and act as other demonstration people — and both jobs then passed. Locally, lint, types, 160 unit tests and the Workers checks passed; the full browser suite had passed apart from the same rate-limit effect. A fresh private snapshot (`output/backups/2026-10-13T08-34-32.085Z`) restored 26 tables, 498 rows, 36 foreign keys and nine Storage files offline. After the deploy, `npm run check:production` and the read-only scoped job probes passed, `/api/notifications` rejected an unsigned request with 401, and the support page served the new wording. Signed-in screens were not checked by the agent.

Local browser checks use the shared Upstash limiter because its credentials are in `.env.local`; repeated local runs can therefore be rate-limited and consume a little of that quota.

Rollback version: `e8007c60-cb48-4901-9948-d530525ba9f0`. Rolling back restores event and invitation email.

## Release — link preview card

Production at **https://usetreeti.xyz** runs app commit `6d1c644` as Cloudflare version `e8007c60-cb48-4901-9948-d530525ba9f0` (gzip 3,018.24 KiB), deployed 12 October 2026 with `npm run cf:deploy:production`. Every page now carries Open Graph and X card metadata pointing at `/og/treeti-link-preview.png` (1200×630, 40 KB), regenerated with `node scripts/build-og-image.mjs`. The `robots` setting still asks search engines not to index the site; lift it deliberately for a broader launch.

GitHub's verify and Workers jobs passed for the commit. Locally, lint, types, 155 unit tests, the link-preview and policy-page browser tests and the Workers checks passed. A fresh private snapshot (`output/backups/2026-10-12T23-39-43.728Z`) restored 26 tables, 457 rows, 36 foreign keys and nine Storage files offline. After the deploy, `npm run check:production` passed, the live home page served the metadata, and the image returned 200 as `image/png`. Rendering inside WhatsApp, X and other apps was not checked by the agent.

Rollback version: `5d8b75a9-8164-42ba-b51c-345d10eb81c0`.

## Release — privacy, terms and support pages

Production at **https://usetreeti.xyz** runs app commit `b502e2c` as Cloudflare version `5d8b75a9-8164-42ba-b51c-345d10eb81c0` (gzip 3,018.00 KiB), deployed 12 October 2026 with `npm run cf:deploy:production`. It adds the public `/privacy`, `/terms` and `/support` pages and links them from the landing footer, sign-in form and account page; see [ADR 018](adr/018-privacy-terms-support-pages.md). The text names the owner as operator and was not legally reviewed. No database migration was needed.

GitHub's verify job passed for the commit. Its Workers job failed once because the local Workers runtime did not start on the runner, then passed unchanged on a re-run. Locally, lint, types, 155 unit tests, the new policy-page browser tests, 20 related browser tests and the Workers checks passed. A fresh private snapshot (`output/backups/2026-10-12T22-21-24.162Z`) restored 26 tables, 457 rows, 36 foreign keys and nine Storage files offline. After the deploy, `npm run check:production` passed, the three pages returned 200 on the main domain, and the old staging hostname redirected `/privacy` to it.

Rollback version: `d5bf9971-88af-462f-80f2-8da92a5f35e4`.

## Release — navigation and invitation resend

Production at **https://usetreeti.xyz** runs app commit `6aa078f` as Cloudflare version `d5bf9971-88af-462f-80f2-8da92a5f35e4` (gzip 3,004.03 KiB), deployed 12 October 2026 at 21:58 UTC with `npm run cf:deploy:production`. It removes Create from the bottom navigation and adds **Resend invitation** for people who have not yet responded; see [ADR 017](adr/017-pending-invitation-resend.md). No database migration was needed.

Before the deploy, GitHub's checks passed for the commit, and lint, types, 155 unit tests, the invitation-resend browser test and the local Workers checks passed on a clean checkout. A fresh private snapshot (`output/backups/2026-10-12T21-54-40.864Z`) restored 26 tables, 452 rows, 36 foreign keys and nine Storage files offline. After the deploy, `npm run check:production` and the read-only scoped job probes passed with no email sent and no records changed. The owner confirmed on the live site that the navigation shows four items and that Resend invitation appears for a lender awaiting approval.

Rollback version: `34317822-68d0-42aa-b8dc-2278b8de4cd6`. A code rollback does not restore or delete financial data.

The sections below record earlier staging checks; newer release notes and ADR 016 supersede their counts and the earlier separate-project requirement.

## Historical staging position

treeti staging is live at **https://staging.usetreeti.xyz** on Cloudflare Workers. Production is not deployed; staging remains a controlled testing environment. Cloudflare is active and Resend verified `mail.usetreeti.xyz`. Normal DNS, HTTPS, the application origin and the approved Supabase sign-in URL cutover are complete. Old staging application links redirect to the new hostname. Authenticated sign-in and reload on the new hostname are the next owner check. See [ADR 011](adr/011-staging-custom-domain.md).

Verified:

- Shared agreements support ten currencies with separate totals and correctly labeled documents. Private debts offer optional repayment plans and protected corrections. Both themes have paper grain; light mode uses cream surfaces. Staging version `22b0bde2-3d02-4592-b5da-f5edb4f83b73` passes 134 unit/integration tests, 18 relevant browser cases, lint, types, build and local workerd checks. See [release details](feedback-features-and-paper-theme.md).

- Supabase Auth, PostgreSQL and two private Storage buckets are configured. Six migrations are applied; the original 22 application tables and the new private debt revision table have RLS, with direct client writes blocked. Read-only checks confirm original debt revisions are preserved.
- Resend custom SMTP delivers sign-in codes to the owner's test address, including a fresh request from the new hostname. Authenticated dashboard access survives reload on the previous hostname. Signed-in visits to `/` and `/login` return to the workspace. New-hostname sign-in/reload and long-running token expiry/refresh remain separate checks.
- Resend verified the new sending domain and all three required records. Staging notification sender configuration is now `treeti <notifications@mail.usetreeti.xyz>`. A test through the existing treeti API key was accepted and marked Delivered by Resend (email `01a12113-f50f-7b9e-914b-14a311194397`); it did not create or modify agreement records.
- Both saved private debts and the existing agreement draft load after the JSON transport repair. Existing immutable records were not rewritten.
- Upstash enforces shared rate limits. Inngest event/signing keys and three staging functions are connected; recurring staging sweeps remain disabled to protect the shared free-tier budget.
- Committed agreement actions now queue scoped delivery events; email-enabled private reminders queue future events. Signed hosted probes confirm immediate execution and future scheduling using nonexistent test IDs, with no email or financial mutation. Production retains recovery schedules; staging needs a manual recovery run when wakeups or bounded retries fail. See [ADR 008](adr/008-background-delivery-wakeups.md).
- All **111 unit/integration tests** pass after session-based party approval, with lint, type checks and Cloudflare build. Seventeen relevant browser checks passed (13 existing agreement/private-debt checks and four new installment checks); the previous rebrand validation passed **39 browser tests**. Local workerd checks cover routing/security/caching, single-payment and installment PDF rendering, hashing and encrypted delivery, plus five-width light/dark sign-in rendering. Synthetic browser tests cover the short witness flow and the local financial journey. An additional focused PWA check verifies the treeti manifest, icon paths, favicon and offline behavior. These do not establish a real hosted multi-person journey. See [ADR 012](adr/012-installment-repayment-plans.md).

Both the notification sender and Supabase SMTP sender now use `treeti <notifications@mail.usetreeti.xyz>`. The SMTP change was explicitly approved by the owner, saved in the dashboard, and confirmed by a fresh delivered email (`01a12149-72eb-7222-8732-8ce589e7d474`, subject **Your treeti verification code**). Its rendered body contains the code instructions only. Both authentication templates have been replaced with the approved code-only treeti template. Existing SMTP credentials and `send.nuring.com` configuration are unchanged; Resend team quotas are shared. Live sign-in and new invitations are email-only in the UI and API; older phone invitations explain the unavailable channel. Canonical phone records and demo behavior remain supported. See [ADR 009](adr/009-email-only-live-delivery.md).

The treeti rebrand is deployed as staging version `fb1ddfa4-1b82-4746-a850-adf125f41395` (gzip 2,984.72 KiB). The hosted dashboard retained the owner's session and existing draft. Signed hosted immediate and future reminder probes passed on repeat after an initial probe did not complete; they processed zero records and sent no email. See [ADR 010](adr/010-treeti-brand.md) for provider labels and preserved compatibility identifiers. Upstash's database display rename remains pending management access. A dependency audit reports five high advisories in development-only ESLint glob dependencies; do not force npm's proposed downgrade to an incompatible Next lint stack. Review a compatible patched toolchain separately.

Witnesses use a short invitation flow without a separate registration page, password or profile setup. Supabase creates or reuses an internal identity after verification of the server-selected invited contact. A verified witness invitation claims access to that exact version; the revalidated session authorizes an explicit witness response without a second action code. Verification alone does not attest; the witness still reviews and explicitly confirms. Regular sign-in callbacks do not grant agreement actions. ADR 014 supersedes the action-grant requirement in [ADR 007](adr/007-invitation-verification-and-auth-return.md).

The domain cutover used version `373e5682-8984-4b09-b8ad-0f2fafbfc7b6`. The normal-DNS hosted smoke check passes, and signed immediate/future job probes on the new endpoint completed without financial changes. A fresh owner code request returned 200 and was marked Delivered by Resend. These checks do not establish the authenticated multi-party journey.

Simplicity release version: `e5948bdd-d303-40cf-a986-31c171411925` (gzip 2,994.44 KiB). The simplicity audit is implemented: email-only returning sign-in, a name once on first use, automatic invitation opening, three-step creation with Agree and send, session-based witness/financial record actions, automatic finalization, and optional mutual closure consent within final-payment recording/confirmation. Existing finalized evidence remains immutable. All 126 unit/integration tests, 24 focused Chromium browser checks, two mobile WebKit checks, lint, type checking, Cloudflare build and local workerd checks pass. Hosted smoke checks pass for the new email-only sign-in, private first-use name screen, unauthenticated profile-write rejection, origins, redirects and unsigned jobs. No schema or provider setting change is required. Real hosted multi-person testing remains the owner’s next check. See [ADR 014](adr/014-simple-verified-session-flows.md) and [implementation verification](simplicity-implementation.md).

## Ordered launch work

1. Validate the full hosted create → borrower review/approval → two independent witnesses → automatic finalization → private PDF → repayment/confirmation → mutual settlement journey for single repayment and installment plans. Check version changes, stale/expired/revoked invitations, identity mismatch, long witness reads and version-scoped access. Verify Storage upload/download, actual notification delivery and private debt email retries/cancellation with real contacts.
2. Establish deployment ownership. Source is pushed to the private `Muwaffaq1/Treeti` repository. Complete the GitHub Actions checks, connect the selected website domain, and extend delivery validation to actual invited participants. Configure SMS if phone sign-in is offered; keep unsupported contact flows gated until then.
3. Complete Workers validation: long-running session refresh, transaction/connection lifecycle, PDF workloads and signed background processing. Measure realistic CPU/memory against the chosen Cloudflare plan; local workerd success does not establish Free CPU compatibility. Node middleware support in the selected adapter is experimental. Retain adapter smoke checks on upgrades. Test PWA installation on actual iOS/Android devices and ensure private data is not cached offline.
4. Complete security, abuse/authorization, monitoring and launch policy gates: job/delivery failure alerts, verified backup restoration and evidence recovery, rollback, privacy notice, user terms, retention/data-subject workflows, and qualified legal/Islamic review of witness/evidence claims. Current hashes provide internal consistency; external KMS sealing and protected evidence retention are not implemented. Resolve the required sealing policy before marketing externally sealed evidence.
5. Promote the existing services as one live environment under ADR 016, with the HTTPS root app domain and restricted Auth redirects. Do not retain two independently writable deployments or sync different code versions under the same Inngest app/environment. Disable the file-backed demonstration. Verify a complete production smoke test, then invite a small beta group and monitor delivery, authorization, support needs and shared quotas before expanding.

Credentials stay in provider secret storage and ignored local configuration. Configuration checks are not delivery, security or production-readiness guarantees. See [Cloudflare setup and verification](cloudflare-setup.md) for versions, individual hosted checks and the safe repeatable job probe.

## References

- [Supabase production checklist](https://supabase.com/docs/guides/deployment/going-into-prod)
- [Supabase custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp)
- [Cloudflare Next.js deployment](https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/)
- [Cloudflare Workers environments](https://developers.cloudflare.com/workers/wrangler/environments/)

Current staging version: `d43019f2-2e2e-4187-91a1-75f4567a9899` (gzip 2,994.87 KiB). Cancelled proposals are excluded from default agreement lists and counts, with a separate Cancelled filter preserving history. Native disclosure markers are replaced with consistent SVG icons. Four focused browser checks, lint, types, Cloudflare build and workerd checks pass. This is a staging UI update; the existing launch checklist still applies. See [release details](cancelled-agreements-and-icons.md).
