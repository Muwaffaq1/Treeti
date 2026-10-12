# Workers database connectivity — 9 October 2026

## Decision before implementation

Use Cloudflare Hyperdrive for hosted PostgreSQL access while retaining Supabase, Postgres.js, server-side transactions and request-scoped clients. Local Node development and migrations retain the existing verified transaction-pooler URL. Hyperdrive must connect to Supabase's direct endpoint with the existing public Supabase CA and `verify-full`. Disable Hyperdrive query caching: balances, approvals, leases and invitation checks must read current database state. Provision staging only, on the existing Free plan; do not enable a paid subscription.

Signed Inngest staging runs exposed a ten-second connection timeout. An isolated workerd probe reproduced it with the Node driver; a raw socket successfully received PostgreSQL's SSL acceptance byte, narrowing the failure to TLS upgrade. The driver's Workers-specific entry also failed with a network error. Local Node connections using the same credentials and verified CA succeed. Do not bypass certificate verification to work around runtime incompatibility.

Cloudflare recommends the direct Supabase endpoint for Hyperdrive rather than double pooling. Hyperdrive supports custom CA verification and is included in Workers Free with 100,000 database statements per day. Retain request-scoped cleanup, no direct client writes and no database schema changes. Enable prepared statements for Hyperdrive, including `unsafe()` calls, as its current Postgres.js guidance warns against `prepare:false`. Keep the existing local pooler settings unchanged. Validate signed jobs and transaction commit/rollback before claiming hosted database readiness; still verify authenticated workflows and realistic Free-plan CPU usage separately.

## Staging validation

Hyperdrive `ahd-staging-postgres` was created with `verify-full`, the Supabase CA, caching disabled and an origin connection limit of five. Code version `f2bd8796-1779-46ee-833b-8159514d54ea` is deployed. Signed Inngest outbox and agreement-reminder jobs now complete, exercising hosted transactions against the empty database. The private debt reminder function also completes but returns its unconfigured-delivery guard while Resend is missing. Runs: `01M4FCX9ZD29HC1PM9DN4N52PP`, `01M4FCXAEFXT3DXR85VEASW69T`, `01M4FCXAXCQR1DQKR1QAQKPVSP`. No email or financial record was created. All 43 unit tests, lint, type checking, Cloudflare build and local Workers runtime checks pass. Full authenticated transactions, rollback and financial workloads remain launch gates.

The adapter needs a local Hyperdrive connection during deployment setup. The committed loopback URL is a synthetic local placeholder, never the hosted origin or a real credential. Override it using `CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE` for local PostgreSQL testing; never commit that override. Staging credentials are not inherited into production.

## References

- [Hyperdrive and Supabase](https://developers.cloudflare.com/hyperdrive/examples/connect-to-postgres/postgres-database-providers/supabase/)
- [Custom CA and verify-full](https://developers.cloudflare.com/hyperdrive/configuration/tls-ssl-certificates-for-hyperdrive/)
- [Postgres.js settings](https://developers.cloudflare.com/hyperdrive/examples/connect-to-postgres/postgres-drivers-and-libraries/postgres-js/)
- [Free-plan quota](https://developers.cloudflare.com/hyperdrive/platform/pricing/)
