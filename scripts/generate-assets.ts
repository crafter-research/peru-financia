import sharp from "sharp";
import { writeFileSync } from "fs";
import { join } from "path";

const OUT = join(import.meta.dir, "..", "apps", "web", "public");

const BG = "#0a0a0a";
const ACCENT = "#c084fc";
const ACCENT2 = "#60a5fa";
const TEXT = "#ededed";
const MUTED = "#888888";
const BORDER = "#1f1f1f";

function ogSvg(width: number, height: number): Buffer {
  const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${width}" height="${height}" fill="${BG}"/>
    <rect x="0" y="0" width="${width}" height="3" fill="${ACCENT}" opacity="0.6"/>

    <!-- Subtle grid -->
    ${Array.from({ length: 12 }, (_, i) => {
      const x = 100 + i * 100;
      return `<line x1="${x}" y1="80" x2="${x}" y2="${height - 80}" stroke="${BORDER}" stroke-width="1"/>`;
    }).join("")}
    ${Array.from({ length: 6 }, (_, i) => {
      const y = 120 + i * 80;
      return `<line x1="60" y1="${y}" x2="${width - 60}" y2="${y}" stroke="${BORDER}" stroke-width="1"/>`;
    }).join("")}

    <!-- Sankey flow lines (abstract) -->
    <path d="M 160 200 C 400 200, 350 320, 600 300" stroke="${ACCENT}" stroke-width="4" fill="none" opacity="0.5"/>
    <path d="M 160 260 C 400 260, 400 360, 700 340" stroke="${ACCENT2}" stroke-width="3" fill="none" opacity="0.4"/>
    <path d="M 160 320 C 350 320, 500 400, 800 380" stroke="${ACCENT}" stroke-width="5" fill="none" opacity="0.3"/>
    <path d="M 160 380 C 300 380, 450 280, 650 260" stroke="${ACCENT2}" stroke-width="2" fill="none" opacity="0.35"/>
    <path d="M 160 440 C 400 440, 500 350, 900 330" stroke="${ACCENT}" stroke-width="3" fill="none" opacity="0.25"/>

    <!-- Source nodes -->
    <rect x="100" y="185" width="60" height="30" rx="4" fill="${ACCENT}" fill-opacity="0.15" stroke="${ACCENT}" stroke-width="1" stroke-opacity="0.3"/>
    <rect x="100" y="245" width="60" height="30" rx="4" fill="${ACCENT2}" fill-opacity="0.15" stroke="${ACCENT2}" stroke-width="1" stroke-opacity="0.3"/>
    <rect x="100" y="305" width="60" height="30" rx="4" fill="${ACCENT}" fill-opacity="0.1" stroke="${ACCENT}" stroke-width="1" stroke-opacity="0.2"/>
    <rect x="100" y="365" width="60" height="30" rx="4" fill="${ACCENT2}" fill-opacity="0.1" stroke="${ACCENT2}" stroke-width="1" stroke-opacity="0.2"/>

    <!-- Target nodes -->
    <rect x="900" y="270" width="60" height="40" rx="4" fill="${ACCENT}" fill-opacity="0.15" stroke="${ACCENT}" stroke-width="1" stroke-opacity="0.3"/>
    <rect x="900" y="330" width="60" height="30" rx="4" fill="${ACCENT2}" fill-opacity="0.1" stroke="${ACCENT2}" stroke-width="1" stroke-opacity="0.2"/>

    <!-- Title -->
    <text x="${width / 2}" y="${height - 130}" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="48" font-weight="700" fill="${TEXT}">
      <tspan fill="${TEXT}">peru</tspan><tspan fill="${ACCENT}">-financia</tspan>
    </text>
    <text x="${width / 2}" y="${height - 85}" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="20" fill="${MUTED}">
      ¿Quién financia la política peruana?
    </text>
    <text x="${width / 2}" y="${height - 55}" text-anchor="middle" font-family="ui-monospace, monospace" font-size="14" fill="${MUTED}" opacity="0.5">
      Datos ONPE 1995–2026 · Open Source · AGPL-3.0
    </text>
  </svg>`;
  return Buffer.from(svg);
}

function faviconSvg(size: number): Buffer {
  const svg = `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${size}" height="${size}" rx="${size * 0.15}" fill="${BG}"/>
    <rect x="0" y="0" width="${size}" height="${size * 0.06}" rx="${size * 0.03}" fill="${ACCENT}" opacity="0.8"/>
    <text x="${size / 2}" y="${size * 0.72}" text-anchor="middle" font-family="system-ui, sans-serif" font-size="${size * 0.55}" font-weight="800" fill="${ACCENT}">F</text>
  </svg>`;
  return Buffer.from(svg);
}

console.log("Generating OG image (1200x630)...");
await sharp(ogSvg(1200, 630)).png({ quality: 90 }).toFile(join(OUT, "og.png"));

console.log("Generating Twitter image (1200x600)...");
await sharp(ogSvg(1200, 600)).png({ quality: 90 }).toFile(join(OUT, "og-twitter.png"));

console.log("Generating favicon.ico (multi-size)...");
const sizes = [16, 32, 48];
const pngs = await Promise.all(
  sizes.map((s) => sharp(faviconSvg(s)).resize(s, s).png().toBuffer())
);

const ico = buildIco(pngs, sizes);
writeFileSync(join(OUT, "favicon.ico"), ico);

console.log("Generating favicon.svg...");
writeFileSync(join(OUT, "favicon.svg"), faviconSvg(32).toString());

console.log("Done. Assets in apps/web/public/");

function buildIco(images: Buffer[], dims: number[]): Buffer {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);

  const dirSize = 16 * images.length;
  let offset = 6 + dirSize;

  const dirs: Buffer[] = [];
  for (let i = 0; i < images.length; i++) {
    const dir = Buffer.alloc(16);
    dir.writeUInt8(dims[i] < 256 ? dims[i] : 0, 0);
    dir.writeUInt8(dims[i] < 256 ? dims[i] : 0, 1);
    dir.writeUInt8(0, 2);
    dir.writeUInt8(0, 3);
    dir.writeUInt16LE(1, 4);
    dir.writeUInt16LE(32, 6);
    dir.writeUInt32LE(images[i].length, 8);
    dir.writeUInt32LE(offset, 12);
    dirs.push(dir);
    offset += images[i].length;
  }

  return Buffer.concat([header, ...dirs, ...images]);
}
