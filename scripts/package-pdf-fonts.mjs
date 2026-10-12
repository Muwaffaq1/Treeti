import { createRequire } from 'node:module';
import { readFile, writeFile } from 'node:fs/promises';
const require = createRequire(import.meta.url);

// PDFKit 0.20.1 lazily requires package aliases that workerd cannot resolve.
// Inline its unchanged, pure standard font metrics into generated bundles.
export async function packagePDFFonts(file) {
  const source = await readFile(file, 'utf8');
  const pattern = /(?<![\w$])[\w$]{1,80}\(['"]#standard-fonts\/(\w+)['"]\)/g;
  const matches = [...source.matchAll(pattern)];
  if (matches.length !== 14) throw new Error('Unexpected PDFKit font loader format. Revalidate Workers packaging.');
  const packaged = source.replace(pattern, (_, name) => `(${JSON.stringify(require(`pdfkit/standard-fonts/${name}`))})`);
  if (packaged.includes('#standard-fonts/')) throw new Error('Unresolved PDFKit font loaders remain.');
  await writeFile(file, packaged);
}
