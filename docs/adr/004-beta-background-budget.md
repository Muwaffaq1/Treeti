# Background scheduling for the free-tier beta — 8 October 2026

## Decision before implementation

Keep Inngest and the transactional PostgreSQL outbox. Change the outbox and private debt email reminder sweeps from once per minute to once every five minutes. Keep the daily agreement reminder job, database leases, retries, delivery idempotency keys and cancellation checks. Approval, witnessing, finalization, repayment and settlement continue to commit synchronously; email and artifact jobs never determine consent or financial state.

This is a beta delivery tradeoff: a due email reminder or invitation may wait up to five minutes before being attempted, plus provider time, backlog and retries. In-app records and due cues update independently. Calendar alerts retain their chosen time. Do not promise exact email delivery times.

## Reason and budget

Inngest Free currently includes 50,000 executions/month. A function run and its single `step.run` each count. Two minute sweeps consume 172,800 executions in a 30-day month before users, retries or the daily job. Five-minute sweeps plus the daily job consume 34,620 in 30 days, or 35,774 in 31 days. This leaves some headroom but is not a guarantee: retries and additional workflows consume quota. Two always-running staging/production environments would exceed the shared free allowance. Keep staging jobs disabled except while testing; monitor usage before a wider beta.

If higher volume or faster delivery is needed, evaluate event-triggered wakeups with a recovery sweep before upgrading. A lost wakeup must never lose a committed outbox record. Do not drop rate limiting, authenticated witness consent, private storage or evidence preservation to save cost.

## Staging connection — 9 October 2026

Before registering the hosted staging app, require `AHD_JOB_SCHEDULES=true` to register cron triggers. Staging and local configuration leave this disabled and register manual `ahd/jobs/<function-id>` event triggers instead; production explicitly enables the documented schedules. This implements the staging budget restriction above while allowing signed hosted execution checks. Manual events contain no participant data. Reminder email delivery remains blocked until its transport is configured. Do not point the eventual production deployment at staging credentials or sync both deployments under the same Inngest app/environment.

## References

ADR 008 adds scoped event wakeups after committed actions and future-timestamp events for email-enabled private reminders. Production retains its recovery schedules; staging retains disabled cron jobs. The baseline sweep allowance above now excludes additional event runs, which must be included when monitoring beta usage.

- [Inngest pricing and execution accounting](https://www.inngest.com/pricing)
- Architecture sections 50–55: transactional outbox, durable side effects and synchronous consent.
