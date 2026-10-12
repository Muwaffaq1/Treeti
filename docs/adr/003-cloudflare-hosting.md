# Cloudflare hosting — 8 October 2026

## Decision

The product owner explicitly selected Cloudflare in place of Vercel. Cloudflare is the deployment target for staging and production. This supersedes the Vercel hosting, secret-management and preview-deployment references in the original architecture. The original source document remains preserved; this decision records the authorized change before deployment implementation.

Use Cloudflare Workers for the full-stack application. Continue using the documented Supabase Auth/PostgreSQL/private Storage, Resend, Inngest and Upstash services. Selecting Cloudflare hosting does not replace those services with D1, R2 or Workflows.

## Deployment preparation

Cloudflare's current Next.js guidance recommends vinext, currently in beta; OpenNext is also documented as an adapter path. Do not silently replace the app's Next.js toolchain or declare either path compatible from documentation alone. Validate the installed Next.js 16.4 app and choose the integration based on a successful Workers-runtime build and end-to-end checks. Record any necessary framework or runtime changes before applying them.

The compatibility check must cover:

- App Router, `proxy.ts`, Supabase session refresh/cookies, private responses and configured security headers.
- Transactional Postgres.js access and connection lifecycle in Workers; assess Hyperdrive while retaining Supabase PostgreSQL and existing transaction semantics.
- React-PDF rendering, packaged font access, Buffer/crypto APIs, private artifact upload/download, and runtime resource limits.
- Inngest's endpoint/signature verification and durable notification/reminder execution.
- Environment-specific secrets and app URLs, distinct staging/production databases, correct OTP redirects, and no shared caching of authenticated pages/API responses.
- PWA assets and installation over HTTPS. The file-backed demonstration adapter is for local development and must be disabled in the hosted production application.

Configure Cloudflare build/deploy integration, Workers secrets, staging/production environments and custom domains after runtime validation. This is a hosting decision, not a completed deployment or a claim that the current Node.js build has passed Workers tests.

## Sources checked

Implementation update: [ADR 005](005-cloudflare-adapter-validation.md) records the selected adapter, packaging changes and remaining hosted validation. The decision above preserves the pre-implementation requirements.

- [Cloudflare Next.js guidance](https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/)
- [Cloudflare OpenNext adapter](https://developers.cloudflare.com/workers/framework-guides/web-apps/opennext/)
- [Postgres.js with Hyperdrive](https://developers.cloudflare.com/hyperdrive/examples/connect-to-postgres/postgres-drivers-and-libraries/postgres-js/)
