# Ahd design system — Cash App study

Source: Mobbin screen and flow research, 8 October 2026. These are observed visual patterns, not Cash App's proprietary component source, exact spacing measurements or licensed brand typeface. The original PRD's agreement, consent and witnessing rules stay authoritative.

## Sources and observations

- [Cash App money home](https://mobbin.com/screens/a94b5872-01a9-4cc6-a8ed-b838dfc3b1ef): a large balance leads the page; pill actions precede softly rounded modules on a neutral surface. The navigation is a floating capsule.
- [Cash App cash balance details](https://mobbin.com/screens/0f13550c-4d54-450f-a992-5c5295e2f603): a single amount anchors the screen, with clearly separated detail rows and circular icon controls.
- [Cash App request review](https://mobbin.com/screens/01d77788-8ab4-4b46-a1eb-9aac06a9f1eb): recipient, amount and reason are repeated immediately before one prominent rounded action.
- [Cash App request confirmation](https://mobbin.com/screens/3ff31ca4-bc64-42e3-bf07-5f64b3dc264a): a green check disc, a precise outcome and one next action.
- [Cash App requesting money](https://mobbin.com/flows/b2f45ae3-719a-482c-9f1f-1162e6e33318): recipient → amount → context → review → confirmation. The tool provided preview samples, so findings are limited to the visible samples.

The web query returned other products rather than Cash App. It is not evidence of a Cash App desktop system; Ahd's desktop adaptations are our own.

## Ahd primitives and twist

| Primitive | Ahd implementation |
| --- | --- |
| Color | Warm paper and neutral surfaces in light mode; near-black canvas and charcoal surfaces in dark mode. Primary actions use #9C62F8 with page-black labels in dark mode and a close, deeper #8541DF with paper-light labels in light mode. Purple selection/focus/link variants meet contrast on each theme. Amber is reserved for pending states; red for errors. |
| Type | Self-hosted Geist Sans 400/500/600/700 (updated at the user’s request). Sans-serif headings and tabular financial figures. Lora remains only in the identity wordmark and document artifacts. |
| Spacing | 4, 8, 12, 16, 24, 32, 48 and 64px. At least 16px between an input icon and its border; 12px between icon and text. |
| Controls | 48px minimum touch height, pill primary actions, 16px field radius, 24px card/sheet radius. Explicit labels and visible keyboard focus. |
| Icons | Lucide outline icons, 20px standard, consistent 1.8–2px stroke; circular utility containers. Icons are decorative where text supplies the name. |
| Money | Remaining amount first, original and paid values second. Independent totals per currency. Long amounts wrap without truncation. |
| Navigation | Floating mobile capsule with text labels and safe-area clearance; quieter desktop rail. |
| Sheets | Bold heading, short explanation, inset controls, explicit outcome and one primary action. |
| Motion | Short feedback and sheet entrances only; reduced-motion preference honored. |

## Scope additions

The requested PWA adds a manifest, original app icons, install guidance, a service worker and an offline connection screen. Private financial responses and pages are never stored in the service-worker cache. Production installation requires HTTPS; localhost is suitable for development. Follow [Next.js PWA guidance](https://nextjs.org/docs/app/guides/progressive-web-apps) and [MDN installability guidance](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable).

Personal debt reminders extend the owner-only ledger, independent of shared agreement reminder rules. A reminder has one timestamp and the chosen IANA time zone. It appears in My debts when due, supports rescheduling/cancellation, and can be exported to a calendar with an alert. Configured production email delivery uses the owner's verified email only and omits the creditor and amount. Clearing the balance suppresses future reminders. Demo reminders never send real messages. Background email requires Supabase, Resend and the existing Inngest worker; calendar alerts are delivered by the user's calendar application.
