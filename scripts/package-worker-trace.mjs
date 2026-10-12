import { cp, readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';

// Next traces the CJS entry. OpenNext 1.20.9's middleware bundler selects ESM.
// Add the existing package's ESM files to the build artifact, not node_modules.
const tracePath = resolve('.next/server/middleware.js.nft.json');
const trace = JSON.parse(await readFile(tracePath, 'utf8'));
const esm = resolve('node_modules/@opentelemetry/api/build/esm');
const files = (await readdir(esm, { recursive: true })).filter(file => file.endsWith('.js'));
trace.files = [...new Set([...trace.files, ...files.map(file => relative(dirname(tracePath), join(esm, file)))])].sort();
await writeFile(tracePath, JSON.stringify(trace));
// The adapter copies traced files from Next's standalone tree, created before
// this trace augmentation. Mirror the added dependency files there as well.
await cp(esm, resolve('.next/standalone/node_modules/@opentelemetry/api/build/esm'), { recursive: true });
console.log('Packaged middleware ESM dependency tracing.');
