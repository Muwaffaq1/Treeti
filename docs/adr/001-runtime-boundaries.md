# Runtime boundaries and documented MVP simplifications

## Context

The repository starts with only the source documents. No Supabase, OTP, Resend or Inngest credentials are configured, and no local PostgreSQL/Docker executables are installed.

## Decision before implementation

Keep the documented production stack: Next.js and Supabase PostgreSQL/Auth/Storage, transactional server domain services, Inngest/Resend, react-pdf. Add an explicitly isolated local demonstration adapter with synthetic identities and server-side file persistence, available only when `AHD_ENABLE_DEMO=true` or in local development. Demo data is not production evidence, OTP is simulated and no messages are delivered. Production must never fall back to the demo adapter when credentials are missing. Use embedded PostgreSQL (PGlite) only in automated database/RLS integration tests, not as production storage.

The architecture permits an MVP without KMS/S3 Object Lock. Implement SHA-256 manifests/private artifacts now and label integrity as hash consistency rather than externally signed evidence. Production sealing/retention remains a documented launch gate. Witness count is configurable without prescribing religious combinations. Default two requested witnesses is a product setting pending policy review.

## Consequences

Complete local multi-party QA is possible without credentials. Production integration can be exercised against real Supabase after credentials are supplied; that external delivery/auth verification cannot honestly be claimed complete before then. All differences must remain visible in UI/setup documentation.
