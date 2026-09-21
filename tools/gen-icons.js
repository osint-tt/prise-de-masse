// Génère les PNG des icônes à partir des SVG, en les rendant avec Chromium (Playwright).
// Usage : npm run icons

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const iconsDir = path.join(root, 'icons');

const JOBS = [
  { source: 'icon.svg', out: 'icon-192.png', size: 192 },
  { source: 'icon.svg', out: 'icon-512.png', size: 512 },
  { source: 'icon.svg', out: 'apple-touch-icon-180.png', size: 180 },
  { source: 'icon-maskable.svg', out: 'icon-maskable-192.png', size: 192 },
  { source: 'icon-maskable.svg', out: 'icon-maskable-512.png', size: 512 },
];

const browser = await chromium.launch();
const page = await browser.newPage();

for (const job of JOBS) {
  const svg = await fs.readFile(path.join(iconsDir, job.source), 'utf8');
  await page.setViewportSize({ width: job.size, height: job.size });
  await page.setContent(
    `<!doctype html><html><head><meta charset="utf-8"><style>
       html,body{margin:0;padding:0;background:#000;}
       svg{display:block;width:${job.size}px;height:${job.size}px;}
     </style></head><body>${svg}</body></html>`,
    { waitUntil: 'load' }
  );
  await page.screenshot({
    path: path.join(iconsDir, job.out),
    omitBackground: false,
    clip: { x: 0, y: 0, width: job.size, height: job.size },
  });
  console.log(`icons/${job.out} (${job.size}px)`);
}

await browser.close();
