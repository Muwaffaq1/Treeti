# Cloudflare email beta setup

Current status: treeti staging is live at **https://staging.usetreeti.xyz**, with branding, verified SMTP sender and approved authentication destinations configured. Old staging application links redirect to this hostname. The initial setup sections below retain historical labels and validation; use the latest staging website cutover and [production readiness](production-readiness.md) for current status.

As of 9 October 2026, Ahd's guarded staging preview is deployed at **https://ahd-staging.yusufmuwaffaq17.workers.dev** on the owner's Cloudflare account. The Free Supabase organization Ahd contains project **Ahd staging**, reference `uuryyzuuzfgqtznszrls`, in West EU (Ireland). All five migrations are applied. Live read-only checks verified 22 application tables with RLS enabled, no anon/authenticated write privileges, and both Storage buckets private. Supabase public settings, server key, database URL, session secret and staging origin are stored in the staging Worker's secret storage. Prefer a modern secret API key before release. Keep staging and production projects separate. No paid subscriptions are authorized by these instructions.

The owner created the Free Upstash database `ahd-staging-ratelimit` in Ireland. Its REST credentials are saved privately in local configuration and Cloudflare staging secret storage. Synthetic checks against the live database verified denial across separate limiter instances and recovery after reset; the hosted sign-in form now renders. Separate hosted Worker instances and actual OTP delivery still need verification. The API fails closed when rate-limit configuration is missing. Inngest event/signing keys are stored privately locally and in Cloudflare. Three functions are synced against staging in the account’s default environment, named Production. Manual triggers keep continuous staging schedules disabled; eventual production needs a separate environment/app. Signed event ingestion, unsigned-request rejection and successful hosted runs of all three functions are verified; the two database sweeps exercised transactions on an empty database, while private debt email delivery skipped because Resend is absent. email delivery remains unavailable. The owner is postponing a sender domain, so public email delivery remains unavailable. The hosted preview is not ready for real financial records or outside testers. Its initial compressed bundle is approximately 2,970 KiB, below the Free plan's 3 MiB upload limit; this does not establish compatibility with request CPU limits or PDF workloads.

Hosted smoke checks on 9 October verified the sign-in setup notice visually, unauthenticated private API rejection (401), foreign-origin authentication rejection (403), authentication rejection without shared rate limits (503), and unsigned Inngest request rejection (401). The authentication responses use private/no-store caching. No OTP was sent during these checks. All 53 unit/integration tests, lint, type checking, the Cloudflare production build and local Workers smoke checks passed. Ten synthetic witness-form browser checks also passed. Authenticated hosted workflows remain untested.

## Services and configuration

Copy `.env.example` to `.env.local` for local checks and migrations. Copy `.dev.vars.example` to `.dev.vars` for local Workers preview. Both real files are ignored. Configure hosted values directly in Workers settings/secret storage; never paste credentials into documentation, commit them or put server keys in `NEXT_PUBLIC_*` variables.

| Service | Configuration |
| --- | --- |
| Supabase | Project URL and publishable key; server-only service role key; privileged PostgreSQL connection URL. Local Node/migrations use the verified transaction pooler with prepared statements disabled. Hosted Workers use Hyperdrive connected to the direct Supabase origin with the public CA / `verify-full`, caching disabled and prepared statements enabled. Apply all five migrations with `npm run db:migrate`. They create private `ahd-evidence` and `repayment-proofs-private` buckets. |
| Cloudflare | `AHD_APP_URL` is the exact HTTPS origin; `AHD_ENABLE_DEMO=false` and `AHD_RUNTIME=cloudflare` are set in Wrangler. Use a stable random `AHD_SESSION_SECRET` of at least 32 characters, stored as a secret. The default environment is `ahd-staging`; `production` is `ahd-production`. |
| Resend | API key and `AHD_EMAIL_FROM` on a verified sender domain. Configure Supabase custom SMTP and OTP templates too. An email beta can avoid SMS costs. The current UI accepts phone contacts, but invitation SMS transport is unimplemented: block phone options before an email-only beta, or implement and test SMS before offering them. |
| Inngest | Event and signing keys; register the HTTPS `/api/inngest` endpoint. Verify signature rejection and successful signed executions. Five-minute sweeps fit one idle environment within the free execution budget; keep staging jobs disabled except during testing. |
| Hyperdrive | Staging uses `HYPERDRIVE` bound to `ahd-staging-postgres`. Production needs its own binding and verified origin; hosted database access fails closed without the binding. See [ADR 006](adr/006-workers-database-connectivity.md). |
| Upstash | Redis REST URL/token for shared verification rate limits. Verify denied requests and recovery across separate Worker instances. |

The Supabase URL and publishable key are public build inputs as well as runtime values. Set them before `cf:build` and in the matching Worker environment. Build production again with its own public configuration; do not promote a bundle containing staging Supabase settings. All other keys are server secrets. Local `.env.local` does not upload secrets to Cloudflare automatically.

The first staging connection failed with `SELF_SIGNED_CERT_IN_CHAIN`. Both the migration runner and app now use the public Supabase Root 2021 CA bundled in `src/lib/database-tls.ts` for Supabase hosts, with `rejectUnauthorized: true`; hostname verification remains enabled. This follows [Supabase's SSL guidance](https://supabase.com/docs/guides/database/connecting-to-postgres#ssl). The certificate comes from the dashboard's Download certificate link, expires 26 April 2031, and has SHA-256 fingerprint `807025AD50D4ED219D2C9C7D299C004F824EB00CF7F65AFEF607D07B72E6CAFA`. Update the trust anchor if Supabase rotates it. Other database hosts retain their driver/URL TLS settings.

Native Workers TLS upgrade timed out in initial signed jobs, while Node connections passed. Staging now uses Hyperdrive with direct Supabase access and verified TLS. Hosted concurrency and rollback still need testing. Local Node testing must also cover the [documented Postgres.js pipelining limitation](https://supabase.com/docs/guides/database/postgres-js) with the transaction pooler. Migration and read-only checks pass; they do not prove concurrent application behavior. Do not use `max_pipeline: 0`, which breaks transactions. Resolve the driver/pooler choice before launch if this limitation affects the workload.

The current dashboard Site URL is `https://staging.usetreeti.xyz`, with its exact `/auth/callback` redirect allowed. The previous exact staging callback is retained during the transition. Preserve the invitation return path through sign-in. Configure the Auth email templates to display `{{ .Token }}` so first-time and returning users receive a code. The fallback callback binds PKCE to the originating challenge and never grants consent to an agreement action.

The prepared [verification email template](../supabase/templates/email-otp.html) uses Supabase's `{{ .Token }}` variable. Set subject **Your Ahd verification code** and apply the HTML to both **Confirm signup** and **Magic Link** templates so first-time and returning accounts receive an enterable code. The copy was checked against the app's verification flow using the better-writing skill. The HTML and subject are saved in both hosted templates, with dashboard success confirmations on 9 October. Hosted sign-in accepted a fresh SMTP-backed code request, and Resend marked **Your Ahd verification code** delivered on 9 October (email `01a11f3f-1261-756a-8b1c-9913c1975d6d`). The owner signed in on mobile and then in the originating browser. Browser inspection confirmed the authenticated `/app` dashboard and persistence after reload. Template QA found the editor had appended the new HTML to the legacy link body. The owner subsequently approved full replacement; both saved bodies now contain only the code-only treeti template. See the latest verification below. See [Supabase email templates](https://supabase.com/docs/guides/auth/auth-email-templates).

## Validation and deployment

1. Configure staging values, then run `npm run setup:check`. It reports missing/invalid settings without printing values. Passing does not prove connectivity or service permissions.
2. Run `npm run db:migrate` against the **staging** database. The runner tracks and serializes migrations; use it on a fresh project, or reconcile migration history before reusing a database migrated by another tool.
3. Run `npm run lint`, `npm run typecheck`, `npm run test`, `npm run cf:build`, and `npm run test:workers`. The isolated Workers probe uses only synthetic fixtures and is not an application route.
4. Sign in to the owner's Cloudflare account with `npx wrangler login`. Configure staging secrets, then use `npm run cf:deploy:staging`. A `workers.dev` HTTPS origin can support initial testing without buying a hosting domain. Update `AHD_APP_URL` and Auth settings to the actual origin before inviting testers.
5. Exercise real lender → borrower → two distinct witnesses → finalize → stored PDF → repayment → settlement. Also test private debt ownership, paid/cancelled reminders, identity mismatch, expired invitations, fresh OTP, rate limits, retries and sign-out/session expiry. Measure hosted CPU/memory, especially PDF generation, before claiming Free-plan compatibility.
6. Complete the gates in [production readiness](production-readiness.md), then provision production secrets/database and rebuild with production public values. Use `npm run cf:deploy:production`. Verify rollback and backup restoration before accepting real financial records.

These commands do not choose paid plans. Free quotas are limits, not a guarantee of a free production workload. A verified email domain may cost money if the owner has none. Supabase Free has no automatic backups; arrange and test evidence/database recovery. External evidence sealing remains unimplemented. The adapter's experimental Node middleware and generated-output shims require maintenance; see [ADR 005](adr/005-cloudflare-adapter-validation.md).

## References

- [Cloudflare OpenNext setup](https://developers.cloudflare.com/workers/framework-guides/web-apps/opennext/)
- [Worker secret storage](https://developers.cloudflare.com/workers/configuration/secrets/)
- [Supabase serverless connections and pooler limitations](https://supabase.com/docs/guides/database/connecting-to-postgres)
- [Supabase custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp)

### Authentication alignment — 9 October 2026

The owner approved and the dashboard confirms Site URL `https://ahd-staging.yusufmuwaffaq17.workers.dev` and the exact redirect `https://ahd-staging.yusufmuwaffaq17.workers.dev/auth/callback`. The callback binds PKCE to the originating signed challenge; old emails pointing to localhost must be replaced. It never authorizes an agreement action. The short witness invitation verification flow uses the existing authenticated identity and scoped attestation grant; see ADR 007. The owner pasted the Ahd sending key and saved custom SMTP; the dashboard confirms SMTP enabled and an encrypted stored password. The owner created a separate **Ahd staging** sending key in the existing Resend team. It is saved to ignored local configuration with permissions `600`, and `RESEND_API_KEY` plus `AHD_EMAIL_FROM` are connected to Cloudflare staging. Supabase SMTP and both OTP templates are now saved. The test sender is `Ahd <onboarding@resend.dev>`; it is restricted to the Resend account owner’s email. Existing `send.nuring.com` configuration was not edited; team usage limits are shared. Real SMTP code delivery is confirmed by Resend; authenticated browser dashboard access and persistence after reload are confirmed.

The callback and short witness verification changes are deployed to staging version `fbad5c86-5722-427d-96e1-ebac0061f100` (gzip 2,977.54 KiB). Hosted smoke checks confirm sign-in HTTP 200, missing-code callback redirect to a clear sign-in error with private/no-store headers, unknown invitation HTTP 410, and foreign-origin authentication HTTP 403. No real email was sent by these smoke checks. Supabase SMTP and OTP templates are configured. A fresh hosted sign-in request advanced to code entry, with Resend confirming delivery. The owner completed browser sign-in, and the dashboard survives reload. Template cleanup was completed in the later treeti rebrand verification below; no full financial or multi-party hosted journey is claimed.

## Signed-in entry navigation — 9 October

The owner reported an apparent sign-out when visiting `/`. Browser inspection confirmed the session still opened `/app`; the public homepage was displaying its unconditional sign-in button. Both `/` and `/login` now revalidate the identity through Supabase Auth and return signed-in users to the dashboard (or a validated existing return path). Both routes are dynamic and covered by session-refresh proxy and private/no-store headers. Signed-out visitors still receive the public homepage and sign-in form. No session, invitation or financial authorization checks were weakened.

Staging version `ab8e12a1-1fb0-4b62-bd00-93330b63d258` deploys this fix (gzip 2,980.12 KiB). Twenty-four focused authentication/navigation tests, lint, type checks, the Cloudflare production build, local workerd/security/caching/PDF checks and five-width light/dark sign-in checks pass. Hosted browser navigation from `/` returns the owner's existing authenticated session to `/app` without a new code; unauthenticated HTTP probes confirm private/no-store responses for `/` and `/login`. Long-running expired-token refresh and the full financial journey remain separate launch validation.

## Debt reload repair — 9 October

Staging version `45518265-4c78-4fe4-aa08-b703a0f0eca9` fixes double JSON serialization in the Postgres.js connection (gzip 2,979.12 KiB, startup 17 ms). See [private debt transport repair](private-debts.md). Existing snapshots are decoded on read; no stored records are rewritten. All 72 unit/integration tests, lint, type checks, Cloudflare build and local Worker checks pass. A read-only PostgreSQL probe confirms JSON/jsonb transport and both saved debt amounts. The authenticated hosted browser now loads both private debt cards after a full reload and after navigating from Overview to My debts. The owner's existing agreement draft also renders on Overview. No financial mutation or email was performed during this verification; the broader hosted repayment, witness and settlement journey remains unverified.

## Automatic delivery wakeups — 9 October

Staging version `e6c55532-f73f-4445-8c96-7caeb728ca34` adds post-commit agreement delivery wakeups and scheduled private debt email reminder events (gzip 2,979.78 KiB). The existing three Inngest functions are synced; staging cron remains disabled. Production keeps event triggers alongside its recovery schedules. Jobs validate resource IDs and load authoritative database state. Saved actions remain successful if enqueueing fails; static error labels contain no contacts, amounts or tokens. See [ADR 008](adr/008-background-delivery-wakeups.md).

The scoped hosted delivery run `01M4FYD0391TDN0G5YS5GQ8TWK` completed, as did scheduled reminder run `01M4FYD02RXE7Z16VKZHP9QGNR`; its start time was checked against the future event timestamp. These probes used nonexistent synthetic resource IDs, processed zero records and sent no email. Real delivery and the full financial journey remain separate checks. Production cron recovers missed wakeups; staging requires a manual recovery run when event submission or bounded retries are exhausted.

Repeat the safe hosted probe with the staging URL explicitly overriding the local development URL:

```sh
AHD_APP_URL=https://ahd-staging.yusufmuwaffaq17.workers.dev npm run jobs:check:staging -- --sync
```

Local credentials stay in ignored configuration. The probe refuses non-staging hosts and never prints keys. Unit/integration checks cover post-commit ordering, demo isolation, failure independence, opaque event payloads, retry propagation, leases, scope isolation, early/cancelled/rescheduled/sent/paid reminder suppression, and production recovery triggers. Lint, type checks, Cloudflare build and local workerd checks pass.

## Treeti domain preparation — 9 October

The owner purchased `usetreeti.xyz` and added it to Cloudflare's Free plan (zone `691eb89e60e970b70348d76bbbcd9f5f`). Its assigned nameservers are `serenity.ns.cloudflare.com` and `vick.ns.cloudflare.com`. Registrar propagation was initially pending; a later dashboard check on 9 October confirmed the domain is active. The Worker is not yet connected to the website domain.

The owner added the sending domain `mail.usetreeti.xyz` to Resend in Ireland (domain `f09b19d6-63ed-4ae4-a1a2-8c3b30d64872`). The account dashboard showed 1 of 3 domain slots used before adding it, with the existing `send.nuring.com` verified. With explicit owner approval, these three records were saved in Cloudflare and checked against Resend's displayed values:

| Type | Name relative to usetreeti.xyz | Content | Proxy | TTL |
| --- | --- | --- | --- | --- |
| TXT | `resend._domainkey.mail` | The exact public DKIM key supplied by this Resend domain | DNS only | Auto |
| CNAME | `rsend.mail` | `rsend-euw1.forge.rmta.net` | DNS only | Auto |
| CNAME | `send.mail` | `send.forge.rmta.net` | DNS only | Auto |

Resend's **I've added the records** check was submitted after saving all three. The domain initially showed **Pending / Looking for DNS records**; a later dashboard check confirmed **Verified** for the domain and each of the three records. Receiving remains disabled; the optional DMARC record was not added in this step. No existing domain records were edited or removed.

After verification, local ignored configuration and the Cloudflare staging `AHD_EMAIL_FROM` value were updated to `Ahd <notifications@mail.usetreeti.xyz>` using the existing Resend key. Wrangler confirmed the staging secret update. A test email through that key was accepted and marked **Delivered** in the Resend dashboard (email `01a12113-f50f-7b9e-914b-14a311194397`). This confirms the new domain/key combination for the owner's test recipient; the actual agreement outbox and multi-person sign-in journey still need validation.

The matching Supabase SMTP sender address was explicitly approved by the owner, saved, and visually verified after a dashboard reload. Existing SMTP credentials are untouched. Browser text/DOM observations mask the email as `<redacted>`; the saved address was confirmed from the rendered field. Fresh SMTP code delivery remains a separate check from the API-key email test.

The Worker custom domain, application origin and Supabase authentication destinations remain on their previous staging settings. No production deployment or app-wide rename is implied by the domain purchase.

## treeti rebrand and SMTP verification — 9 October

Staging version `fb1ddfa4-1b82-4746-a850-adf125f41395` deploys treeti product copy, metadata, new agreement numbering, fresh PDF/email branding, the purple app icon, favicon and install assets. The compressed Worker is 2,984.72 KiB. Public-only cache invalidation retains old icon URLs for installed clients. Existing IDs, hashes, evidence, sessions, encryption labels and service identifiers are preserved; see [ADR 010](adr/010-treeti-brand.md).

All 95 unit/integration tests and 39 browser tests pass, alongside lint, type checks, Cloudflare build and local workerd checks. A focused PWA retest confirms the new manifest and assets. Hosted dashboard inspection shows treeti and retains the owner's authenticated session. After an initial probe did not complete, a repeat completed signed outbox run `01M4GM46GFAKGERPF63JCV17X2` and scheduled reminder run `01M4GM46GGXVC7QZVCMMXK317Q`; both used nonexistent resource IDs, processed zero records and sent no email. The probe now reports a safe failure phase without credentials or provider bodies.

The owner approved service display renames and SMTP display name. Supabase organization/project, Resend sending-key label, Inngest organization/event-key label and SMTP sender are verified as treeti/treeti staging. Both hosted authentication bodies were fully replaced with the code-only template. A fresh staging sign-in code request returned HTTP 200; Resend marked `01a12149-72eb-7222-8732-8ce589e7d474` Delivered, from `"treeti" <notifications@mail.usetreeti.xyz>`, subject **Your treeti verification code**. Rendered body verification confirms code instructions only. No code or credential is recorded here.

Upstash's old database display label still requires a management credential for its documented rename API; the connected Redis REST credential cannot perform that operation. Inngest's served app label and Cloudflare Worker hostname follow stable app/service IDs and await a separately validated migration. No production deployment, custom website-domain attachment or full real multi-person journey is claimed.

## Staging website cutover — 9 October

The existing staging Worker now serves `staging.usetreeti.xyz` with Cloudflare-managed DNS/TLS. The owner approved and saved the Supabase Site URL and exact callback for this hostname; the old exact callback remains allowed. The hosted application origin uses the new hostname. Version `373e5682-8984-4b09-b8ad-0f2fafbfc7b6` is current; the attached bundle is 2,985.24 KiB gzip. Service IDs, credentials, mail DNS and stored records were preserved. See [ADR 011](adr/011-staging-custom-domain.md).

Normal DNS and browser HTTPS loading now pass. The read-only hosted domain check verifies old-link redirects, preserved paths/query strings, private/no-store responses, strict mutation origins, branding, install assets and unsigned-job rejection. All 98 unit/integration tests, lint, type checks, Cloudflare build/dry run and local workerd checks pass.

The existing Inngest staging functions are synced to the new endpoint. Signed outbox run `01M4GPY4HEECM5HSPE6A5P7Z4M` and future reminder run `01M4GPY4HET0N23JCV8NQNJ3JW` completed with zero records processed and no email sent. A separate authorized owner code request returned 200 and Resend marked email `01a12172-c473-7cf9-9fe5-714f9b1a6712` Delivered.

Repeat the domain check and scoped job probe with:

```sh
node scripts/check-staging-domain.mjs
AHD_APP_URL=https://staging.usetreeti.xyz npm run jobs:check:staging -- --sync
```

The browser is open to the new sign-in page. The owner must request a fresh code there because cookies and verification challenges are host-scoped. Authenticated new-hostname reload, the full real participant journey and production deployment remain separate checks.

## Amount formatting and installment plans — 9 October

Version `6d2ec86f-688c-4893-a27e-036f5a5b66ed` (gzip 2,992.48 KiB) adds live comma grouping and single, weekly, monthly or custom repayment plans. Existing PostgreSQL version JSON stores the validated schedules; no migration or new credential is required. All 104 unit/integration tests, 17 relevant browser checks, lint, type checking, Cloudflare build and final workerd checks pass. Single-payment and installment PDF rendering/hashing were exercised under workerd. Installment PDF pages and mobile/desktop light/dark forms were visually reviewed.

Post-deployment HTTPS/origin/private-response checks pass. The public client bundle hash matches the tested build and all installment options are present. The saved-draft confirmation and existing read-only borrower-contact edit issue discovered during browser testing are corrected. These synthetic/local and hosted asset checks do not replace actual multi-person hosted approval, witnessing, document storage and repayment testing. See [ADR 012](adr/012-installment-repayment-plans.md).

## Borrower invitation and mobile date repair — 9 October

Version `6c6ecc1f-7c70-4daa-9376-8648bbb019c8` (gzip 2,994.20 KiB) restores the live claim route and displays verified-contact pending borrower invitations before the account is linked. Review claims access without approving terms. Native date controls fit their wrappers and shrinkable grid tracks. No database migration, authentication setting change or evidence rewrite is needed. All 109 unit/integration tests, 18 relevant browser checks (including mobile WebKit), lint, type checks, Cloudflare build and local workerd checks pass. The owner should refresh staging and retry the existing active invitation and iPhone forms. See [repair details](invitation-inbox-repair.md).

## Session-based party approval — 10 October

Version `9b13f9c3-cf84-43dc-9f3b-0cdf84c36a8b` (gzip 2,994.33 KiB) removes action-specific code verification for signed-in lender/borrower approval. The server revalidates the verified Supabase session, then records explicit consent, name, timestamp and exact version/hash with accurate session-based authentication evidence. Existing evidence is untouched, and unrelated verification grants are not consumed. No schema or provider configuration change is needed. All 111 unit/integration tests, nine focused browser checks, lint, type checks, Cloudflare build and local workerd checks pass. See [ADR 013](adr/013-session-based-party-approval.md) and the [simplicity audit](ux-simplicity-audit.md).

## Simple verified-session flows — 11 October 2026

Staging version `e5948bdd-d303-40cf-a986-31c171411925` (gzip 2,994.44 KiB) implements ADR 014. Build, workerd and hosted smoke checks pass. The one-time name screen participates in the existing private response/session-refresh proxy. No migrations or Auth/provider configuration edits are required. See [simplicity implementation](simplicity-implementation.md) for exact tests and remaining hosted multi-person validation.

## Cancelled lists and SVG disclosures — 11 October 2026

Version `d43019f2-2e2e-4187-91a1-75f4567a9899` (gzip 2,994.87 KiB) moves cancelled proposals into their own filter and uses SVG icons for all disclosure summaries, including mobile Safari. Existing records remain intact. No migrations or provider configuration edits. Lint, types, four focused browser checks, build and local workerd checks pass. See [release details](cancelled-agreements-and-icons.md).


## Currency, private debt and paper appearance update — 11 October 2026

Version `22b0bde2-3d02-4592-b5da-f5edb4f83b73` (gzip 2,999.11 KiB) adds ten shared agreement currencies, optional private debt repayment plans, safe private debt corrections, and cream paper surfaces with grain in both themes. Migration 006 is applied; read-only checks confirm protected original revisions and RLS. All 134 unit/integration tests, 18 focused browser cases, lint, types, Cloudflare build and local workerd checks pass. See [release details](feedback-features-and-paper-theme.md) and [ADR 015](adr/015-currencies-and-private-debt-corrections.md). Production remains undeployed.

Hosted smoke and fresh signed-out light/dark appearance checks pass on the published version. No real email or financial mutation was triggered.
