import {readFile,writeFile} from 'node:fs/promises';
import sharp from 'sharp';

const source=await readFile(new URL('../public/icons/treeti.svg',import.meta.url));
for(const [name,size] of [['treeti-192',192],['treeti-512',512],['treeti-apple',180],['treeti-favicon-32',32]]){
  await sharp(source).resize(size,size).png().toFile(new URL(`../public/icons/${name}.png`,import.meta.url).pathname);
}
// Maskable icons keep the whole mark within the central 80% safe region.
const maskable=Buffer.from(source.toString().replace('rx="120"','rx="0"'));
await sharp(maskable).resize(512,512).png().toFile(new URL('../public/icons/treeti-maskable-512.png',import.meta.url).pathname);
const png=await sharp(source).resize(32,32).png().toBuffer();
const header=Buffer.alloc(22);header.writeUInt16LE(1,2);header.writeUInt16LE(1,4);header[6]=32;header[7]=32;header.writeUInt16LE(1,10);header.writeUInt16LE(32,12);header.writeUInt32LE(png.length,14);header.writeUInt32LE(22,18);
await writeFile(new URL('../src/app/favicon.ico',import.meta.url),Buffer.concat([header,png]));
