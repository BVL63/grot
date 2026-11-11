import sharp from 'sharp';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

// Multi-resolution PNG-in-ICO for Windows 10/11 (16, 24, 32, 48, 64, 128, 256).
const source = resolve('IMG_0637.jpeg');
const sizes = [16, 24, 32, 48, 64, 128, 256];
const icons = [];
for (const size of sizes) {
  const png = await sharp(source)
    .resize(size, size, { fit: 'contain', background: { r: 11, g: 27, b: 58, alpha: 1 } })
    .png()
    .toBuffer();
  icons.push({size, png});
}
const header = Buffer.alloc(6 + sizes.length * 16);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(sizes.length, 4);
let offset = header.length;
icons.forEach(({size,png}, i) => {
  const at = 6 + i * 16;
  header[at] = size === 256 ? 0 : size;
  header[at+1] = size === 256 ? 0 : size;
  header[at+2] = 0;
  header[at+3] = 0;
  header.writeUInt16LE(1, at+4);
  header.writeUInt16LE(32, at+6);
  header.writeUInt32LE(png.length, at+8);
  header.writeUInt32LE(offset, at+12);
  offset += png.length;
});
await mkdir(resolve('build'), {recursive: true});
await writeFile(resolve('build/icon.ico'), Buffer.concat([header,...icons.map(i=>i.png)]));
await writeFile(resolve('build/icon.png'), icons[icons.length-1].png);
console.log('Generated build/icon.ico and build/icon.png from the GROT logo.');
