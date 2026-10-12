# Public privacy, terms and support pages

## Owner decision — 12 October 2026

Before a soft launch the owner asked for the privacy, terms and support gaps recorded in ADR 016 to be closed. The owner chose to be named as the operator as an individual (Muwaffaq Yusuf, Nigeria), to publish `yusufmuwaffaq17@gmail.com` as the contact for support and privacy requests, and to name Nigerian law in the terms.

`/privacy`, `/terms` and `/support` are public, static pages that need no sign-in. They are linked from the landing footer, the sign-in form ("By continuing you agree to the terms and privacy policy"), the account page and each other. The proxy matcher includes them so old hostnames redirect to the main domain like other pages.

The text describes what the product does today: the records it stores, who can see them, the services it runs on (Supabase, Cloudflare, Resend, Inngest, Upstash), that no advertising or analytics trackers are used, that a confirmed agreement is a shared record kept for all its participants, and that treeti does not lend, hold or move money, give advice, or promise legal enforceability or religious compliance. Account deletion and data requests are handled manually by email; there is no self-service deletion.

These pages were drafted without legal review. A qualified lawyer should review them before a broader launch, and they must be updated when the operator, contact address, service providers, tracking or deletion behaviour change. The operator name and contact address live in `src/components/legal.tsx`.

Validation: browser checks cover all three pages at 375 and 1366 pixels in both themes for status, headings, the contact link, horizontal overflow and WCAG 2.1 AA, plus the links from the landing page, sign-in form and account page. No database migration is required.
