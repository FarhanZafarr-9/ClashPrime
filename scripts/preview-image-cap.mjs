import { mkdirSync, copyFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = dirname(dirname(fileURLToPath(import.meta.url)));

// Must mirror scripts/gen-package-images.mjs so the preview matches production output.
const MAX_EDGE = 128;
const WEBP_OPTS = { quality: 80, effort: 4 };

const srcDir = join(root, 'assets', 'package-images');
const outDir = join(root, 'assets', 'shrink-preview');

const samples = [
  ['equipment icon (2048x2048)', 'images/home/hero-equipment/giant-gauntlet/icon.webp'],
  ['builder hero icon (large)', 'images/builder/heroes/battle-machine/icon.webp'],
  ['hero icon', 'images/home/heroes/archer-queen/icon.webp'],
  ['spell icon', 'images/home/spells/overgrowth-spell/icon.webp'],
  ['barbarian troop icon', 'images/home/troops/barbarian/icon.webp'],
  ['barbarian level-3 sprite (small)', 'images/home/troops/barbarian/normal/level-3.webp'],
  ['cannon level 1 sprite', 'images/home/defenses/cannon/normal/level-1.webp'],
  ['inferno tower level 9 sprite', 'images/home/defenses/inferno-tower/normal/level-9.webp'],
  ['builder hall level 1 (tall sprite)', 'images/builder/builder-hall/normal/level-1.webp'],
  ['town hall level 9 sprite', 'images/home/town-hall/normal/level-9.webp'],
  ['gold resource icon', 'images/other/gold.webp'],
  ['magic item icon', 'images/magic-items/books/book-of-heroes.webp'],
];

mkdirSync(outDir, { recursive: true });

const rows = [];
for (const [label, rel] of samples) {
  const src = join(srcDir, rel);
  if (!existsSync(src)) {
    console.warn(`missing, skipping: ${rel}`);
    continue;
  }
  const meta = await sharp(src).metadata();
  const slug = rel.replace(/^(images\/)?/, '').replace(/\//g, '--').replace(/\.webp$/i, '');

  const orig = join(outDir, `${slug}--orig.webp`);
  const capped = join(outDir, `${slug}--cap${MAX_EDGE}.webp`);
  copyFileSync(src, orig);
  await sharp(src)
    .resize(MAX_EDGE, MAX_EDGE, { fit: 'inside', withoutEnlargement: true, kernel: 'lanczos3' })
    .webp(WEBP_OPTS)
    .toFile(capped);

  const origSize = statSync(orig).size;
  const capSize = statSync(capped).size;
  rows.push({
    label,
    rel,
    origDims: `${meta.width}x${meta.height}`,
    orig,
    capped,
    origSize,
    capSize,
  });
  console.log(
    `${label.padEnd(42)}  ${meta.width}x${meta.height}`.padEnd(64) +
    `orig ${(origSize / 1024).toFixed(1)}K  cap${MAX_EDGE} ${(capSize / 1024).toFixed(1)}K  (${Math.round((1 - capSize / origSize) * 100)}%)`,
  );
}

const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>128px cap preview</title>
  <style>
    body { font: 14px/1.4 system-ui, sans-serif; background: #0e0f11; color: #e6e8eb; margin: 24px; }
    h1 { font-size: 18px; }
    .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; margin-bottom: 8px; }
    figure { margin: 0; }
    .card { border: 1px solid #2a2d31; border-radius: 8px; padding: 10px 12px; margin-bottom: 20px; }
    .card .cap { color: #7ee787; } .card .dim { color: #8b949e; }
    img { width: 96px; height: 96px; object-fit: contain; background: #1b1d21; border-radius: 6px; }
    table { border-collapse: collapse; width: 100%; }
    td, th { border: 1px solid #2a2d31; padding: 6px 8px; text-align: left; }
    th { color: #8b949e; font-weight: 600; }
  </style>
</head>
<body>
  <h1>Package image 128px cap preview (original vs cap)</h1>
  <table>
    <tr><th>Sample</th><th>Original</th><th>Cap ${MAX_EDGE}px</th><th>Source</th><th>Size orig</th><th>Size cap</th></tr>
${rows.map((r) => `    <tr>
      <td>${r.label}<br><span class="dim">${r.origDims}</span></td>
      <td><img src="./${r.orig.split(/[\\/]/).pop()}"></td>
      <td><img src="./${r.capped.split(/[\\/]/).pop()}"></td>
      <td class="dim">${r.rel}</td>
      <td>${(r.origSize / 1024).toFixed(1)}K</td>
      <td><span class="cap">${(r.capSize / 1024).toFixed(1)}K (${Math.round((1 - r.capSize / r.origSize) * 100)}%)</span></td>
    </tr>`).join('\n')}
  </table>
</body>
</html>`;

writeFileSync(join(outDir, 'preview.html'), html);
console.log(`\nGenerated ${rows.length} samples in ${outDir} — open preview.html to compare side by side.`);