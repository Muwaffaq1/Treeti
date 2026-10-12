import { readFile, writeFile } from 'node:fs/promises';
import { packagePDFFonts } from './package-pdf-fonts.mjs';
import { packageYogaWasm } from './package-yoga-wasm.mjs';

// Next 16.4 added a separate preview-props manifest. OpenNext 1.20.9's
// manifest inliner does not yet recognize it. Embed this build's manifest.
const manifest = JSON.parse(await readFile('.next/server/preview-props.json', 'utf8'));
if (!manifest || !['previewModeId', 'previewModeSigningKey', 'previewModeEncryptionKey'].every(key => typeof manifest[key] === 'string')) throw new Error('Unexpected preview manifest format. Revalidate the adapter.');
const file = '.open-next/server-functions/default/handler.mjs';
const source = await readFile(file, 'utf8');
const pattern = /function loadManifest\((\w+)[^)]*\)\{/g;
if ([...source.matchAll(pattern)].length !== 1) throw new Error('Unexpected adapter manifest loader. Revalidate the adapter.');
await writeFile(file, source.replace(pattern, (match, path) => `${match}if(${path}.endsWith('/preview-props.json'))return ${JSON.stringify(manifest)};`));
console.log('Packaged Next 16.4 preview manifest.');
await packagePDFFonts(file);
console.log('Packaged PDFKit standard font metrics.');
await packageYogaWasm(file);
console.log('Packaged precompiled Yoga WebAssembly module.');
