import '../scripts/build-assets.mjs';
import { build } from 'esbuild';
import { packagePDFFonts } from './package-pdf-fonts.mjs';
import { packageYogaWasm } from './package-yoga-wasm.mjs';
await build({ entryPoints: ['tests/cloudflare/probe-worker.ts'], outfile: '.wrangler/probe/worker.mjs', bundle: true, platform: 'node', format: 'esm', mainFields: ['main', 'module'], external: ['node:*'], define: { 'import.meta.url': '"file:///bundle/worker.mjs"' }, banner: { js: 'import { createRequire as ahdProbeRequire } from "node:module"; const require = ahdProbeRequire("file:///bundle/worker.mjs");' } });
await packagePDFFonts('.wrangler/probe/worker.mjs');
await packageYogaWasm('.wrangler/probe/worker.mjs');
