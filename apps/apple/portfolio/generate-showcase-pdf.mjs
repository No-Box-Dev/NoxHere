#!/usr/bin/env node
// Render the NoxBoxDev technical showcase HTML to PDF.
// - Embeds the real brand fonts (Aeonik / Arbeit) as base64 data URIs.
// - Injects the REAL NoxBoxDev logo (read verbatim from logo-white.svg,
//   themed via currentColor, unique clip-id per use) — no hand-typed paths.
import puppeteer from 'puppeteer';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const htmlPath = join(__dirname, 'noboxdev-showcase.html');
const outPath = join(__dirname, 'NoxBoxDev-Technical-Showcase.pdf');
const ASSETS = '/Users/jaspermiddendorp/noboxdev/codebase/noboxdev/public';
const fontDir = join(ASSETS, 'fonts');
const logoPath = join(ASSETS, 'images/logo-white.svg');

let html = readFileSync(htmlPath, 'utf8');

// --- Fonts: file:// → base64 data URI (guaranteed to load in headless Chrome)
const FONTS = [
  ['Aeonik-regular.ttf', 'font/ttf'],
  ['Arbeit-Regular.otf', 'font/otf'],
  ['Arbeit-Bold.otf', 'font/otf'],
];
for (const [file, mime] of FONTS) {
  const abs = join(fontDir, file);
  const b64 = readFileSync(abs).toString('base64');
  html = html.split(`url('file://${abs}')`).join(`url('data:${mime};base64,${b64}')`);
}

// --- Logo: replace each <svg class="logo">…</svg> with the real verbatim logo
const logoInner = readFileSync(logoPath, 'utf8').match(/<svg[^>]*>([\s\S]*)<\/svg>/)[1];
let logoUse = 0;
const realLogo = () => {
  logoUse += 1;
  const clipId = `nbd-clip-${logoUse}`;
  const inner = logoInner
    .split('fill="white"').join('fill="currentColor"')
    .split('clip0_5193_8945').join(clipId);
  return `<svg class="logo" viewBox="0 0 1822 275" fill="none" xmlns="http://www.w3.org/2000/svg">${inner}</svg>`;
};
html = html.replace(/<svg class="logo"[\s\S]*?<\/svg>/g, () => realLogo());

const browser = await puppeteer.launch({ headless: true });
const page = await browser.newPage();
await page.setContent(html, { waitUntil: 'load' });
await page.evaluate(() => document.fonts && document.fonts.ready);
await new Promise(r => setTimeout(r, 300));
await page.pdf({ path: outPath, format: 'A4', printBackground: true, preferCSSPageSize: true, margin: { top: 0, right: 0, bottom: 0, left: 0 } });
await browser.close();
console.log('wrote', outPath);
