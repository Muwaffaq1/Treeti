# Promote the existing project for the initial launch

## Owner decision — 12 October 2026

The owner chose to reuse Supabase project `uuryyzuuzfgqtznszrls` for the initial production release. A second project is not required for this launch. Preserve all accounts, agreements, approvals, immutable evidence, private debts and investments. No test records are identified as disposable, so no records are deleted.

Promote the existing Cloudflare Worker, Hyperdrive connection, Upstash limiter and Inngest app as one live environment. The Worker ID `ahd-staging` and Inngest ID `ahd` remain compatibility identifiers. Do not create a second writable deployment or sync two different code versions against this database and Inngest app. Future staging work must use local synthetic data or a separately provisioned environment.

## Prepared deployment

`wrangler.promotion.jsonc` binds the same Worker to `usetreeti.xyz` and retains `staging.usetreeti.xyz`. The canonical app origin must be changed to `https://usetreeti.xyz` at cutover. Application GET/HEAD requests on both old hostnames redirect to the root domain with their paths and query strings intact; mutation requests remain subject to the exact canonical origin check. Sessions are host-scoped; users sign in once on the root domain. Existing invitations and documents are not rewritten.

The existing mail sender `treeti <notifications@mail.usetreeti.xyz>` and service credentials are retained. Supabase needs the root Site URL and exact root `/auth/callback` redirect. Keep the old exact callbacks during transition. Sync the same Inngest app to the root `/api/inngest` endpoint. Do not enable duplicate schedules. Recovery sweeps remain disabled for this initial promotion to protect the shared free-tier budget; scoped events and scheduled individual reminders remain active. Review failed-delivery monitoring and recovery before increasing use.

## Backup and restoration

`npm run backup:project` makes a repeatable-read, read-only application snapshot in a timestamped `output/backups/` directory. That directory is Git-ignored. Files have mode 0600 and directories mode 0700. It includes public application table rows, applied migration source, sequence positions, account reference metadata, bucket metadata and private Storage files. Saved document hashes are checked against the authoritative artifact records.

A PGlite restore check imports the financial records into an isolated in-memory database, compares every table, checks all foreign keys and sequence positions, and checks saved Storage hashes. It never writes to live Supabase. The 12 October snapshot verified 26 tables, 343 rows, 36 foreign keys and six Storage files. The snapshot is sensitive and must remain private.

This is **not a complete Supabase provider backup**: it excludes Auth credentials/sessions and provider settings. Local files also do not protect against loss of this computer. Arrange a protected independent copy and full-provider recovery before broader launch. Do not import a snapshot over live records without an explicit recovery decision.

## Cutover procedure

1. Complete lint, types, unit/browser tests and local Workers checks. The first CI failures were test setup: WebKit was missing; mocked sign-in screens lacked synthetic public configuration; sequential amount typing started before hydration; unconfigured Workers correctly returned a secure setup error on `/welcome`.
2. Retain the previous Cloudflare version ID and canonical origin for rollback. Back up current records.
3. Save Supabase's Site URL as `https://usetreeti.xyz` and add the exact `https://usetreeti.xyz/auth/callback` URL. Authentication destination changes through the browser need specific confirmation.
4. Deploy the tested artifact using `npm run cf:deploy:production`, retaining the existing origin until the root hostname has verified HTTPS. Then change the existing Worker's `AHD_APP_URL` secret to `https://usetreeti.xyz`. Keep demo disabled and all existing private service bindings. The old `cf:deploy:staging` command is guarded to prevent dropping the production routes.
5. Run `npm run check:production`. Sync and verify scoped signed jobs using the root origin with `scripts/check-hosted-jobs.mjs`; these probes use nonexistent IDs and send no messages.
6. The owner signs in at the root hostname, reloads, and confirms existing records and document downloads are present. Open an old invitation link and check that it reaches the correct root-domain path. No agent should approve an actual financial agreement on the owner's behalf for testing.

Rollback uses the previous Worker version/configuration, restores `AHD_APP_URL=https://staging.usetreeti.xyz` and resyncs jobs to the old endpoint. Restore the previous Site URL when necessary; keep exact callback URLs until transition is complete. A code rollback does not restore or delete financial data.

## Completed cutover — 12 October 2026

The existing Worker now serves **https://usetreeti.xyz** as its canonical origin. Supabase's saved Site URL and three exact callbacks were verified in the dashboard. Both old app hostnames retain their routes and redirect page paths/query strings to the main domain. The existing Inngest app is synced to `https://usetreeti.xyz/api/inngest`. No accounts, financial records, Storage files or unrelated mail domains were deleted or changed.

- Released app source: `53a75e7cf0b7f5712643e00fb8c1dd5656414466`. GitHub [run 38264965600](https://github.com/Muwaffaq1/Treeti/actions/runs/38264965600) passed both verify and Workers jobs.
- Automatic deployment review initially rejected the working checkout because it contained uncommitted UI edits outside that CI run. Those edits were preserved and excluded. A separate release directory was populated from the exact tested commit; 170 source/configuration files were hash-compared before a fresh build. Its local Workers checks passed for private routes/security, currencies, PDF rendering/hashes, signed sessions, encrypted delivery payloads and five viewport widths in both themes.
- Upload: gzip **3,008.88 KiB**; initial artifact version `3c1e1659-26ba-4284-8680-2f36e1a40721`; final canonical-origin version **`34317822-68d0-42aa-b8dc-2278b8de4cd6`**. Retained Hyperdrive and private secrets; schedules remain disabled.
- Fresh private snapshot: `output/backups/2026-10-12T19-17-17.243Z`, with **26 tables, 380 rows, 36 foreign keys and six Storage files** verified by offline restore. The same backup limitations above apply.
- `npm run check:production` passed using normal DNS and verified TLS: branding, old invitation/verification redirects, strict mutation origins, private/no-store responses, protected debts/investments/profile APIs, callback origin and unsigned-job rejection.
- Scoped signed delivery and future-reminder probes completed on the main-domain endpoint using nonexistent IDs. No financial record was changed and no email was sent. The real browser renders the production email-only sign-in form.

Use `npm run cf:deploy:production` for future verified releases. It targets `wrangler.promotion.jsonc` and the same existing Worker. Do not deploy the unused `ahd-production` environment in the older base configuration. For a read-only hosted jobs check, use `AHD_APP_URL=https://usetreeti.xyz npm run jobs:check:staging`; append `-- --sync` only when intentionally syncing the same app. Local ignored canonical URL references were updated to the main domain.

The owner still needs to sign in on the root hostname, reload and inspect existing records/PDF downloads. The pre-cutover rollback version remains `7d797c67-d10a-46a3-9513-c81fafc4444f`; restore the staging canonical origin and job endpoint when rolling back. Do not restore a data snapshot for a code-only rollback.

## Remaining launch work

The owner reports staging multi-party end-to-end flows work. Root-domain authenticated checks remain necessary after cutover. Privacy/terms/support ownership, monitoring and independent recovery remain separate launch tasks. This decision does not establish legal enforceability, full provider recovery or readiness for unlimited traffic.
