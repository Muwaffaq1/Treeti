# Staging website domain

## Decision recorded before implementation — 9 October 2026

The owner approved connecting the staging app to `staging.usetreeti.xyz`. Keep the root domain available for a separate production deployment. Bind the existing staging Worker to the custom hostname using Cloudflare-managed DNS and TLS. Retain its Worker ID, database, signing keys and job app ID.

After HTTPS is verified, use `https://staging.usetreeti.xyz` as the hosted application origin and Supabase staging Site URL, with the exact `/auth/callback` redirect allowed. Existing emails, agreements, PDFs and stored evidence are not rewritten. Newly generated links use the new origin. Local development keeps localhost configuration.

GET/HEAD visits to application pages on the old staging Worker hostname redirect temporarily to the new hostname, preserving paths and query strings. Do not redirect mutation requests or the signed background-job endpoint. Keep strict same-origin mutation checks. Cookies are host-scoped; a user moving to the new hostname must sign in there. Do not copy sessions between domains or weaken verification.

Verify HTTPS, canonical redirects, private/no-store headers, foreign-origin rejection, manifest/icons, fresh code delivery, authenticated reload and scoped signed background probes. The real multi-person financial journey remains a separate validation task.

## Attachment verification

Staging version `dc762098-e6dd-4b78-82d1-ddaba00ef041` attaches the custom domain (gzip 2,985.24 KiB). The Cloudflare DNS dashboard shows a proxied Worker record for `staging`; its three existing mail records are unchanged. Cloudflare's public DNS resolver returns the domain's A records. A connection to the returned Cloudflare address with the hostname and certificate verification intact returns HTTP 200 and TLS verification result 0. The local resolver still caches a negative result at this check.

All 98 unit/integration tests, lint, type checking, Cloudflare build/dry run and local workerd checks pass.

## Completed staging cutover

The owner explicitly approved the authentication destinations. Supabase's new exact callback was saved alongside the old exact callback; its Site URL was saved as `https://staging.usetreeti.xyz`. The dashboard showed the new field and the save button returned to disabled. A later reload encountered an expired dashboard session, so no fresh reload verification of that field is claimed.

Cloudflare's application origin secret now uses the new domain. The current deployed version is `373e5682-8984-4b09-b8ad-0f2fafbfc7b6`. Normal local DNS subsequently resolved, HTTPS returned 200, and the browser rendered the new sign-in page. The old application-page redirect is active; mutations still reject the old origin.

`node scripts/check-staging-domain.mjs` passed using normal DNS, after an initial public-DNS check during propagation. It verifies HTTPS, branding, old links and their query strings, private response headers, PWA assets, strict mutation origins, missing-code callback handling and unsigned job rejection. It sends no email and changes no financial records.

Inngest's existing staging functions were synced to the new endpoint. Scoped signed outbox run `01M4GPY4HEECM5HSPE6A5P7Z4M` and future reminder run `01M4GPY4HET0N23JCV8NQNJ3JW` completed, with the latter's start checked against its future timestamp. Both processed zero records and sent no email. A separate authorized owner sign-in-code request returned 200; Resend marked email `01a12172-c473-7cf9-9fe5-714f9b1a6712` **Delivered**, subject **Your treeti verification code**.

The new sign-in page is open for the owner. Authenticated sign-in and reload on this hostname remain the next check; request a fresh code in that browser rather than reusing the separate delivery probe's code. The complete hosted multi-person financial journey and production deployment remain outstanding.
