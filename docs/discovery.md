# Discovery completed — 8 October 2026

- [x] Desktop documentation folder: `/Users/muwaffaqyusuf/Desktop/ahd`
- [x] Read all 2,157 lines of `prd.md`.
- [x] Read all 3,742 lines of `architecture.md`.
- [x] Recursively inspected repository. Only the two source documents exist; no Git repository, application, hidden credentials, or AGENTS.md instructions.
- [x] Inspected installed skill catalog, local skills directories and plugin skills inventory.
- [x] Read Mobbin research, Emil design engineering, better-interface and its six domain skills, and interaction-design instructions.
- [x] Conducted targeted Mobbin contract signing, transaction review and verified invitation research.
- [x] Established design direction in `design-research.md`.
- [x] Identified external credentials below.

## Internal requirements summary

The primary promise is a trustworthy, private record that protects relationships. The MVP records money; it never transfers it. Lender proposes, borrower reviews/accepts/requests changes/declines, both explicitly approve the exact immutable version, witnesses truthfully attest, and the server atomically finalizes. Approvals and attestations bind to version hashes and versioned affirmation text. A witness is never a guarantor; review-only does not satisfy direct witnessing. Witness access excludes subsequent repayment and hardship information. Witness configuration is a product workflow choice, not a religious ruling.

Keep all money in integer minor units, contractual dates as DATE, evidence timestamps on the server, old versions and evidence append-only, audit events hash-chained. Financial commands require authentication, role membership, concurrency checks, idempotency and atomic transactions. Repayments reduce balance only on counterparty confirmation. Disputes preserve balance. Zero balance requires both settlement acknowledgments. Preserve PDFs and manifests from finalized canonical data. Notifications/PDF failures cannot undo consent or financial state.

Stack: TypeScript, Next.js App Router, React, Tailwind, accessible shadcn-style primitives, React Hook Form, Zod, Supabase Auth/PostgreSQL/private Storage, Inngest, Resend, react-pdf, SHA-256, Vitest, Playwright, fast-check. KMS/S3 Object Lock is the documented production-hardening layer. Vercel deployment target. English first; single repayment V1. Extensions/forgiveness are secondary to a complete tested MVP.

## Credentials eventually needed

Supabase project URL/publishable key, server database connection and service-role key; enabled phone OTP provider and email OTP templates; Resend API key and verified sender; Inngest signing/event keys. Upstash credentials for shared rate limiting. Optional Sentry DSN and PostHog key. Before evidentiary production launch: AWS KMS/S3 credentials and reviewed retention policy. None were found in this project or matching environment variable names. Do not print secret values.

## Sources

Original `prd.md` and `architecture.md` remain unchanged and authoritative. Current implementation references: [Next.js installation](https://nextjs.org/docs/app/getting-started/installation), [Supabase SSR](https://supabase.com/docs/guides/auth/server-side/creating-a-client), [Supabase OTP verification](https://supabase.com/docs/reference/javascript/auth-verifyotp), [Inngest Next.js](https://www.inngest.com/docs/getting-started/nextjs-quick-start).
