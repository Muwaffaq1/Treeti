# Cloudflare adapter validation — 8 October 2026

## Decision before implementation

Trial `@opennextjs/cloudflare` 1.20.9 with Wrangler 4.149.0, retaining Next.js 16.4 and the existing local development/build commands. OpenNext's published peer range includes this installed Next.js version. Cloudflare currently recommends vinext for new applications, but vinext reimplements the Next.js API and is in beta. Preserving the existing framework and testing an adapter first is the narrower change for this application.

This is a validation choice, not a production-compatibility claim. OpenNext's documented Node middleware limitation is material to `proxy.ts`; verify session refresh and private response headers before accepting the adapter. If the adapter cannot run the app correctly, record the failure and the next runtime decision before changing conventions or the framework. Do not downgrade authentication or replace server transactions with client writes.

Private records remain in Supabase. Configure no R2/ISR cache for authenticated content. Disable file-backed demonstration storage in hosted environments. Local Workers tests must use synthetic fixtures and must not expose test endpoints or credentials in the deployed app. Database sockets must be scoped to each Workers request and closed safely, without changing transaction semantics. Preserve finalized PDF bytes; test font packaging and rendering explicitly.

## Packaging findings before runtime changes

The first OpenNext trial reached the Node middleware bundle but failed because Next traced the CommonJS OpenTelemetry entry while the adapter resolves its ESM entry. Next's route tracing includes do not fix the middleware trace. The adapter-specific build command adds that existing dependency's ESM files to the generated middleware trace, without editing installed dependencies or removing session middleware. Pin adapter versions and retain this compatibility check in CI. The installed adapter also explicitly labels Node middleware support experimental; passing local tests will not remove that maintenance risk.

PDF fonts currently load from filesystem paths. Workers do not provide the project's source directory at runtime. Bundle the same licensed TTF bytes into data URLs at build time and retain the original font files/licenses. No external font request or public font endpoint is introduced. This changes packaging, not witness wording or finalized evidence. Existing stored artifacts continue to be downloaded verbatim.

Use Next's documented `--webpack` flag for the adapter trial; the sandboxed Turbopack attempt did not finish. Standard local development remains unchanged.

The first bundled runtime returned 500 because Next 16.4 added `server/preview-props.json`, which the adapter's manifest inliner does not recognize. After bundling, embed this build's generated preview manifest into its sole manifest loader. Validate the manifest shape and loader match and fail the build on changes. Never swallow unknown manifest reads. This compatibility shim edits only generated output; pin versions and run Workers HTTP smoke tests in CI. Reassess it when upgrading the adapter. These two shims and experimental Node middleware remain explicit maintenance risks and hosted sign-in is still a launch gate.

The isolated PDF probe identified PDFKit 0.20.1's lazy `#standard-fonts/*` module loads as another Workers packaging limitation. Inline its fourteen unchanged standard font metric objects in both the generated application bundle and isolated probe; validate the loader count and reject unresolved aliases. Retain the Node renderer, PDF metadata, QR and font content. The browser PDFKit experiment did not complete and is not adopted. Local-only session randomness is generated on use rather than module initialization, which Workers prohibit; production still requires the configured stable secret.

Yoga 3.2.1 embeds its Wasm as base64 and compiles it at runtime, which Workers prohibit. Extract that same binary at build time, validate it and import it as a precompiled Wasm module. Replace only the single Yoga instantiate call, preserving the expected instance/module result. Fail packaging if that signature changes. Both runtime probes and the application bundle use this shim. See [Workers WebAssembly restrictions](https://developers.cloudflare.com/workers/runtime-apis/webassembly/). No WASM compilation happens on the user's device or through an external service.

## Validation and remaining gates

The complete `cf:build` command succeeds, including all packaging hooks. `test:workers` checks routes/CSP, private API caching, cross-origin writes, disabled demo access and unsigned job rejection. Its isolated synthetic probe renders a PDF in workerd and checks the byte hash, signed sessions and encrypted delivery payloads. Sign-in is inspected at 375/390/430/1366/1920 pixels in both themes. PDF pages were rendered with Poppler and visually inspected. The Node demonstration's complete create/invite/approve/attest/finalize/repay/settle browser journey also passed after the font packaging change.

OpenNext logs a nonfatal `Failed to copy .../color-string` message. That installed package has a string `exports` value; the adapter's condition scanner uses the `in` operator on it and catches the resulting error under that message. No `workerd` override is needed for that package. Builds and PDF probes pass, but reassess this upstream scanner issue on adapter upgrades rather than editing dependencies or hiding build output.

Hosted Supabase Auth refresh, actual transaction-pooler connections, private Storage and signed Inngest/Resend delivery still need staging accounts. Request-scoped database reuse/isolation and cleanup have unit coverage, not a live database test. Free-plan CPU limits are unproven. Local validation is not a production launch sign-off.

Dependency audit on 8 October reports no production advisories; five high-severity development dependency findings share the unpatched `braces` stack-exhaustion advisory GHSA-vfj7-8cjw-p6xm through ESLint's globbing chain. Do not use `npm audit fix --force` to downgrade the Next ESLint integration. Track the upstream fix and reassess before launch.

## Reference links

- [Cloudflare OpenNext setup](https://developers.cloudflare.com/workers/framework-guides/web-apps/opennext/)
- [OpenNext supported versions and runtimes](https://opennext.js.org/cloudflare)
- [Cloudflare's current Next.js guidance](https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/)
