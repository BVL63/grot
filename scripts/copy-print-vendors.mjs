import {copyFile, mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';

const pairs = [
  ['node_modules/html2canvas/dist/html2canvas.min.js','dist/vendor/html2canvas.min.js'],
  ['node_modules/jspdf/dist/jspdf.umd.min.js','dist/vendor/jspdf.umd.min.js']
];
await mkdir(resolve('dist/vendor'), {recursive: true});
for (const [source, target] of pairs) {
  await copyFile(resolve(source), resolve(target));
  console.log('Copied offline printing library:', target);
}
