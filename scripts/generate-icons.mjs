// Generates the PWA icons from the GabesVideos logo glyph (a rounded play mark
// in the accent color). Run with: npm run icons
// Produces 192/512 "any" icons, a 512 maskable icon with a safe zone, and an
// apple-touch-icon. Keep the accent in sync with ACCENT_HEX in constants.ts.
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const ACCENT = '#f2555a';
const PUBLIC = 'public';
const ICONS_DIR = join(PUBLIC, 'icons');
mkdirSync(ICONS_DIR, { recursive: true });

function glyphPath(size, scale) {
  const cx = size / 2;
  const cy = size / 2;
  const g = size * scale; // half height of the play triangle
  const left = cx - g * 0.8;
  const right = cx + g;
  const top = cy - g;
  const bottom = cy + g;
  return `<path d="M${left} ${top} L${right} ${cy} L${left} ${bottom} Z" fill="#ffffff"/>`;
}

function svg(size, { rounded, glyphScale }) {
  const r = rounded ? size * 0.22 : 0;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <rect width="${size}" height="${size}" rx="${r}" fill="${ACCENT}"/>
    ${glyphPath(size, glyphScale)}
  </svg>`;
}

async function render(markup, size, outPath) {
  await sharp(Buffer.from(markup)).resize(size, size).png().toFile(outPath);
  console.log('wrote', outPath);
}

async function main() {
  // "any" icons: rounded square, glyph at ~22 percent.
  await render(svg(192, { rounded: true, glyphScale: 0.22 }), 192, join(ICONS_DIR, 'icon-192.png'));
  await render(svg(512, { rounded: true, glyphScale: 0.22 }), 512, join(ICONS_DIR, 'icon-512.png'));
  // maskable: full bleed square (any mask shows accent), glyph kept small inside
  // the safe zone.
  await render(svg(512, { rounded: false, glyphScale: 0.16 }), 512, join(ICONS_DIR, 'maskable-512.png'));
  // apple-touch-icon: iOS rounds it itself, so a full square works best.
  await render(svg(180, { rounded: false, glyphScale: 0.22 }), 180, join(PUBLIC, 'apple-touch-icon.png'));
  console.log('Icons generated.');
}

main().catch((err) => {
  console.error('Icon generation failed:', err);
  process.exit(1);
});
