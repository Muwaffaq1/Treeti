import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

export async function packageYogaWasm(file) {
  const yoga = await readFile('node_modules/yoga-layout/dist/binaries/yoga-wasm-base64-esm.js', 'utf8');
  const encoded = yoga.match(/data:application\/octet-stream;base64,(AGFzb[A-Za-z0-9+/=]+)/)?.[1];
  if (!encoded) throw new Error('Yoga binary format changed. Revalidate Workers packaging.');
  const bytes = Buffer.from(encoded, 'base64');
  if (!WebAssembly.validate(bytes)) throw new Error('Yoga binary is invalid.');
  const source = await readFile(file, 'utf8');
  const pattern = /WebAssembly\.instantiate\((\w+)\s*,\s*(\w+)\)/g;
  if ([...source.matchAll(pattern)].length !== 1) throw new Error('Yoga instantiation changed. Revalidate Workers packaging.');
  // Workers accept precompiled Wasm modules, not dynamic byte compilation.
  const patched = source.replace(pattern, (_, _bytes, imports) => `Promise.resolve({instance:new WebAssembly.Instance(ahdYogaModule,${imports}),module:ahdYogaModule})`);
  await writeFile(join(dirname(file), 'ahd-yoga.wasm'), bytes);
  await writeFile(file, `import ahdYogaModule from './ahd-yoga.wasm';\n${patched}`);
}
