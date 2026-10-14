// One list of browser security headers, shared by Next (pages the Worker renders)
// and by the ready-made public pages Cloudflare serves without running the Worker.
import {analytics} from './analytics-config.mjs';
// Usage statistics are sent straight to PostHog's regional address; nothing else is opened.
const statistics=analytics.key&&/^https:\/\/(eu|us)\.i\.posthog\.com$/.test(analytics.host)?` ${analytics.host}`:'';
export const securityHeaders=(development=false)=>[
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'no-referrer' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  { key: 'Content-Security-Policy', value: `default-src 'self'; script-src 'self' 'unsafe-inline'${development?" 'unsafe-eval'":''}; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self' https://*.supabase.co${statistics}; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'` },
];
