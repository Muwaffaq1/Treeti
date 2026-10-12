# treeti

treeti is a private, interest-free agreement record for people who want clear terms, mutual confirmation, truthful witnessing, and a preserved repayment history. It does not lend, hold, transfer, score, or collect money.

## Run the demonstration

```bash
npm ci
AHD_ENABLE_DEMO=true npm run dev
```

Open [http://127.0.0.1:3000/demo](http://127.0.0.1:3000/demo). The demonstration uses synthetic identities and persists its sample workspaces in `.ahd-demo/`; no real OTP, message, identity, storage, or payment operation occurs.

Use **My debts** to privately track money owed outside shared agreements. Add the person, currency and original amount, then record repayments to see what remains. Records belong to the signed-in profile, persist on the server, and keep totals separate by currency. The named person receives no invitation or notification. See [private debt scope](docs/private-debts.md) for the storage and consent boundaries.

Use **Remind me** on a private debt to set a date and time. The reminder appears in My debts when due; **Add to calendar** downloads an event with an alert for use while treeti is closed. Calendar imports must be updated or removed in the calendar itself. Configured production accounts can also select an email reminder to their verified email address. The demo sends no real email.

Use **My investments** to privately record where you have invested, with dated contributions, separate currency totals, corrections, and archive/restore. These records do not estimate profits, losses, or current value. See [investment tracking](docs/investment-tracker-proposal.md).

## Install treeti

Choose **Install treeti** from the mobile menu, **Keep treeti close** in the desktop sidebar, or **Install treeti** in Account. Compatible browsers offer installation; the fallback sheet gives platform-specific instructions. The PWA includes standalone launch, app icons, home-screen shortcuts and an offline connection screen. It intentionally does not cache private records or accept offline financial writes. Serve production over HTTPS. Localhost supports desktop development testing; opening the app on a phone requires a reachable HTTPS deployment.

The visual primitives and Cash App references are documented in [the design system study](docs/cash-app-design-system.md).

## Connect production services

Copy `.env.example` to `.env.local` and provide Supabase URL/publishable key, a privileged server database URL, a session secret, and the application URL. Resend and Inngest are used for delivery and retries when configured. Supabase Storage remains private; document and proof routes issue authorized responses only.

Apply the migrations in `supabase/migrations/` with the repository migration script or Supabase migration tooling:

```bash
npm run db:migrate
```

The production runtime deliberately fails closed when required services are not configured. It never falls back to the demonstration adapter.

See [production readiness](docs/production-readiness.md) for the staging-to-production sequence. Upstash Redis is required for production verification rate limits. Witnesses verify their invited email once, then read and explicitly confirm without a separate signup or profile form. Supabase creates or reuses the internal identity. Routine agreement actions reuse a server-revalidated session. See [simple flows](docs/adr/014-simple-verified-session-flows.md).

Cloudflare Workers is the selected staging and production host. The OpenNext bundle and local Workers checks cover routes, security headers, private caching, PDF rendering and crypto. Hosted authentication/session refresh, Supabase transactions/Storage and background delivery still require service accounts and staging tests. The adapter needs documented packaging shims and has experimental Node middleware support; local success does not prove the free plan's CPU allowance is sufficient. See [Cloudflare setup](docs/cloudflare-setup.md) and [adapter validation](docs/adr/005-cloudflare-adapter-validation.md).

New agreement versions use a digital witness acknowledgment: read the terms, confirm who is lending to whom, and agree to act as a witness without guaranteeing repayment. No physical-presence statement is collected. Older pending versions need updated wording and fresh party approvals to use this interface; finalized evidence keeps its original statements. See [the witness policy decision](docs/adr/002-digital-witness-acknowledgment.md).

Personal email reminders require migration `202610080004_debt_reminders.sql`, `RESEND_API_KEY`, `AHD_EMAIL_FROM`, a verified sender and the Inngest integration at `/api/inngest`. The `personal-debt-reminders` and `deliver-outbox` functions sweep every five minutes and retry failed delivery. Email attempts may start up to five minutes after the chosen time, with additional delays for delivery failures or backlog. Messages contain no creditor name or amount. Fully paid debts cancel their treeti reminder. Calendar alerts are managed separately by the calendar application. See [the beta background budget](docs/adr/004-beta-background-budget.md); do not run two permanent environments on one free allowance.

Agreement creation has three steps: loan details, terms, review. **Agree and send** records explicit lender consent with the invitation. Both party approvals and the requested witness confirmations automatically preserve the exact record. A final repayment can include each party’s explicit closure consent; separate settlement acknowledgments remain available.

## Checks

```bash
npm run lint
npm run typecheck
npm run test
npm run test:e2e
npm run build
```

For Cloudflare, run `npm run cf:build` followed by `npm run test:workers`. `npm run cf:preview` starts the application in the local Workers runtime. `npm run setup:check` checks hosted configuration without printing credentials; it deliberately fails while accounts are unconfigured.

The browser checks cover the complete create → invite → approve → witness → finalize → repay → settle journey, mobile widths 375/390/430, laptop and large desktop widths, accessibility assertions, long inputs, origin protection, stale commands, and a generated PDF path. Example PDFs and visual QA captures are generated in `output/`, which is excluded from source control. Local credentials, demo workspaces, build output and test reports are also excluded. Only the blank `.env.example` and `.dev.vars.example` configuration templates are committed.

## Scope boundary

The implementation follows the supplied PRD and architecture for the V1 path. Single repayments and weekly, monthly or custom installment schedules are supported under ADR 012. Extensions, mediation, WhatsApp delivery and broader dispute workflows remain outside V1. Hashes provide tamper evidence inside treeti; the generated record does not claim external cryptographic sealing, legal enforceability, or Islamic compliance.
