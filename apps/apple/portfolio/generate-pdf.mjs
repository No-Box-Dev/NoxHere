#!/usr/bin/env node
/**
 * Render the NoxBoxDev case-studies HTML to a polished, print-ready PDF
 * via headless Chromium (puppeteer). Run from the noxfeed-mac dir
 * so `puppeteer` resolves from its node_modules:
 *
 *   cd codebase/noxfeed-mac && node portfolio/generate-pdf.mjs
 */
import puppeteer from 'puppeteer';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const htmlPath = join(__dirname, 'nbx-casestudies.html');
const outPath = join(__dirname, 'NoxBoxDev-Case-Studies.pdf');

const browser = await puppeteer.launch({ headless: true });
const page = await browser.newPage();
// file:// + waitUntil load is enough; fonts are system, no network.
await page.goto('file://' + htmlPath, { waitUntil: 'load' });
await page.evaluate(() => document.fonts && document.fonts.ready);
await page.pdf({
  path: outPath,
  format: 'A4',
  printBackground: true,
  preferCSSPageSize: true,   // honor @page margins (incl. :first full-bleed cover)
  margin: { top: 0, right: 0, bottom: 0, left: 0 },
});
await browser.close();
console.log('wrote', outPath);
