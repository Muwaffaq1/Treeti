import './build-assets.mjs';
import { spawnSync } from 'node:child_process';
const build = spawnSync(process.execPath, ['node_modules/next/dist/bin/next', 'build', '--webpack'], { stdio: 'inherit', env: process.env });
if (build.error || build.status !== 0) process.exit(build.status ?? 1);
await import('./package-worker-trace.mjs');
