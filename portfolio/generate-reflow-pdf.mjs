#!/usr/bin/env node
import puppeteer from 'puppeteer';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const htmlPath = join(__dirname, 'reflow-jasper.html');
const outPath = join(__dirname, 'Reflow-Jasper-Middendorp.pdf');

const browser = await puppeteer.launch({ headless: true });
const page = await browser.newPage();
await page.goto('file://' + htmlPath, { waitUntil: 'load' });
await page.evaluate(() => document.fonts && document.fonts.ready);
await page.pdf({ path: outPath, format: 'A4', printBackground: true, preferCSSPageSize: true, margin: { top: 0, right: 0, bottom: 0, left: 0 } });
await browser.close();
console.log('wrote', outPath);
