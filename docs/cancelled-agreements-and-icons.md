# Cancelled agreements and disclosure icons — 11 October 2026

Cancelled proposals are excluded from the default All list on both the overview and agreements page. A separate Cancelled filter preserves access to the original private record, cancellation event and version history. The overview count follows the default list. Search stays within the selected filter; clearing search retains that filter. Workspaces with only cancelled proposals offer both a new agreement and access to cancelled records.

There is no deletion command, database migration or change to participant access. Declined and settled agreements keep their existing behavior. Cancelled cards describe a cancelled proposal rather than an upcoming repayment date.

All native disclosure summaries now share a Lucide SVG chevron: creation More options, agreement wording, confirmation wording, private debt notes and payment history. Platform markers are suppressed, including Safari's marker, while native details/summary keyboard and expansion semantics remain intact. A source scan found no emoji icons in application TypeScript/TSX.

## Layout review

| Severity | Location | Before | After | Why |
| --- | --- | --- | --- | --- |
| MEDIUM | `src/components/dashboard.tsx:23` | Cancelled records occupy the default list. | Cancelled records have a separate filter and useful empty states. | Order by importance: keep actionable agreements in the default view. |
| LOW | `src/app/design-system.css:45` | Wrapping filters use space-between, separating items on the last row. | Filters wrap from the leading edge. | Align to shared edges and keep one control group together. |

Verification: focused Chromium cancellation tests cover both dashboard routes, search, immutable cancellation history, empty states, and filter bounds at 320, 375, 430, 768, 1366 and 1920px. An RTL mirror at 375px has no horizontal overflow. Mobile WebKit at 375 and 768px checks the SVG/hidden marker, keyboard expansion, retained optional-field values and installment input bounds. Screenshots inspected for mobile filters and terms. Browser-level 200% zoom and translated labels: Not verified.

Approve for the inspected scope. No HIGH findings remain in that scope.

Deployed staging version `d43019f2-2e2e-4187-91a1-75f4567a9899` (gzip 2,994.87 KiB). Lint, TypeScript, four focused browser checks, Cloudflare build and local workerd checks pass. The two Chromium cases were rerun after the final filter-alignment adjustment. Rollback version: `e5948bdd-d303-40cf-a986-31c171411925`. No real participant records were modified during testing.

Hosted smoke checks pass for staging HTTPS, branding, legacy redirects, strict origins, private responses and unsigned job rejection. No code requested, email sent or financial records changed.
