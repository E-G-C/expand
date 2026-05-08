import sharp from 'sharp';
import { writeFileSync, mkdirSync, existsSync } from 'fs';

/**
 * Generate extension icons and store logos.
 *
 * Design: a rounded-square brand tile in a blue gradient with a bold white
 * "expand to fullscreen" glyph (four corner arrows). The mark matches the
 * product name ("Expand") and the toolbar metaphor, and stays legible all
 * the way down to 16x16.
 *
 * Outputs:
 *   icons/icon-16.png        - extension toolbar
 *   icons/icon-48.png        - extensions page
 *   icons/icon-128.png       - extension store / install dialog
 *   assets/store/logo-300.png - Microsoft Partner Center store logo (required)
 *   assets/store/logo-512.png - general marketing / high-res use
 *   assets/store/logo.svg     - source vector, for listings that accept SVG
 *
 * Store assets live under assets/ so they are not bundled into the
 * shipped extension zip (which ships the icons/ folder verbatim).
 */

// Designed at a 128 viewBox; sharp resizes to each target size.
const VIEW = 128;

function buildSVG() {
  return `
<svg xmlns="http://www.w3.org/2000/svg" width="${VIEW}" height="${VIEW}" viewBox="0 0 ${VIEW} ${VIEW}">
  <defs>
    <linearGradient id="tile" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%"  stop-color="#3a7bc8"/>
      <stop offset="100%" stop-color="#1f4f8f"/>
    </linearGradient>
    <linearGradient id="sheen" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%"  stop-color="#ffffff" stop-opacity="0.18"/>
      <stop offset="60%" stop-color="#ffffff" stop-opacity="0"/>
    </linearGradient>
  </defs>

  <!-- Brand tile -->
  <rect x="4" y="4" width="120" height="120" rx="22" ry="22" fill="url(#tile)"/>
  <rect x="4" y="4" width="120" height="120" rx="22" ry="22" fill="url(#sheen)"/>

  <!-- Expand glyph: four corner arrows pointing outward.
       Bold strokes so the mark survives at 16x16. -->
  <g fill="none" stroke="#ffffff" stroke-width="10" stroke-linecap="round" stroke-linejoin="round">
    <!-- Top-left -->
    <polyline points="44,28 28,28 28,44"/>
    <line x1="28" y1="28" x2="54" y2="54"/>
    <!-- Top-right -->
    <polyline points="84,28 100,28 100,44"/>
    <line x1="100" y1="28" x2="74" y2="54"/>
    <!-- Bottom-left -->
    <polyline points="44,100 28,100 28,84"/>
    <line x1="28" y1="100" x2="54" y2="74"/>
    <!-- Bottom-right -->
    <polyline points="84,100 100,100 100,84"/>
    <line x1="100" y1="100" x2="74" y2="74"/>
  </g>
</svg>`;
}

async function render(svg, size, outPath) {
  const png = await sharp(Buffer.from(svg))
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  writeFileSync(outPath, png);
  console.log(`Generated ${outPath} (${png.length} bytes)`);
}

async function main() {
  const svg = buildSVG();

  if (!existsSync('icons')) mkdirSync('icons');
  if (!existsSync('assets/store')) mkdirSync('assets/store', { recursive: true });

  // Extension icons (shipped in the package)
  await render(svg, 16,  'icons/icon-16.png');
  await render(svg, 48,  'icons/icon-48.png');
  await render(svg, 128, 'icons/icon-128.png');

  // Store / marketing logos (not shipped in the package)
  await render(svg, 300, 'assets/store/logo-300.png');
  await render(svg, 512, 'assets/store/logo-512.png');

  // Source SVG for vector use in listings
  writeFileSync('assets/store/logo.svg', svg.trim() + '\n');
  console.log('Wrote assets/store/logo.svg');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
