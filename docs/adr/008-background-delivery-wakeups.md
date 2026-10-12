# Background delivery wakeups — 9 October 2026

## Decision before implementation

Keep Supabase/PostgreSQL, the transactional outbox, Inngest and Resend. After a successful agreement mutation commits, use Next.js `after` to send a best-effort Inngest event for that agreement. Queue an email-enabled private reminder using its saved reminder ID and a future event timestamp. These are delivery hints, never consent or financial-state decisions. A failed event submission cannot turn a committed action into an API failure.

Job events contain only opaque resource IDs, stable deduplication IDs and the reminder's schedule timestamp. Names, contacts, debt amounts, terms, invitation tokens and verification codes stay in Ahd's database. Workers reload authoritative records and verify due time, current reminder ID, outstanding balance and cancellation before sending. Rescheduling changes the ID; the old event cannot send the replacement reminder early. Stable provider keys and database leases preserve delivery idempotency.

The existing three functions retain their IDs. Event triggers remain enabled alongside the documented production cron sweeps. Staging keeps cron disabled to preserve ADR 004's shared free-tier budget. Explicit wakeups make new staging actions usable without enabling another set of permanent sweeps. Delivery failures with remaining attempts cause job retries; terminal failures stay recorded for recovery. Production cron sweeps recover lost wakeups, delayed queues and exhausted immediate retries. Staging still needs a manual recovery sweep if submission fails or retries are exhausted.

This intentionally extends ADR 004's batch-only delivery tradeoff: ordinary delivery can start sooner, and each explicit wakeup consumes additional executions. Monitor usage before expanding the beta. No subscription upgrade or provider change is introduced. Future event timestamps avoid a host timer and a long-running sleep workflow.

## References

- Architecture sections 50–55: committed outbox, background side effects, delivery independent of agreement state.
- [Inngest v3 event submission and future timestamps](https://www.inngest.com/docs/reference/typescript/v3/events/send)
- [Inngest v3 function triggers](https://www.inngest.com/docs/reference/typescript/v3/functions/create)
- [Inngest limits](https://www.inngest.com/docs/durable-execution/limits)

Sender-domain restrictions remain a launch gate: the current Resend test sender can deliver only to the account owner's address.
