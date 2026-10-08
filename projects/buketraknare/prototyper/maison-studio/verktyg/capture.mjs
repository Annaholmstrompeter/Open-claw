import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const OUT = process.argv[2] || path.join(ROOT, 'skarmbilder');
const only = process.argv[3] ? new RegExp(process.argv[3]) : null;
const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
const URL = q => 'file://' + ROOT + '/index.html' + (q || '');
async function snap(name, { w, h, dpr = 1, q = '', steps, fit = false, clip }) {
  if (only && !only.test(name)) return;
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dpr, locale: 'sv-SE', hasTouch: w < 600, isMobile: w < 600, reducedMotion: 'reduce' });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/net::|Failed to load resource/.test(m.text())) errs.push(m.text()); });
  await p.goto(URL(q)); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(500);
  if (steps) await steps(p);
  await p.waitForTimeout(250);
  if (fit) { const H = await p.evaluate(() => document.documentElement.scrollHeight); await p.setViewportSize({ width: w, height: Math.max(h, H) }); await p.waitForTimeout(350); }
  const ov = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  await p.screenshot({ path: `${OUT}/${name}.png`, clip });
  console.log(name.padEnd(34), errs.length ? 'FEL: ' + errs.join(' | ') : 'ok', ov > 0 ? 'SIDLEDES ÖVERFLÖD ' + ov : '');
  await ctx.close();
}
const M = { w: 390, h: 844, dpr: 2 }, D = { w: 1440, h: 900, dpr: 1 };
await snap('hem-mobil-390', { ...M, fit: true });
await snap('hem-desktop-1440', { ...D });
await snap('hem-desktop-1440-med-fotoplats', { ...D, q: '?foto=1' });
await snap('hem-mobil-390-med-fotoplats', { ...M, q: '?foto=1', fit: true });
await snap('bygg-mobil-390', { ...M, q: '?bygg=1' });
await snap('bygg-mobil-390-hela-sidan', { ...M, q: '?bygg=1', fit: true });
await snap('bygg-desktop-1440', { ...D, q: '?bygg=1' });
await snap('bygg-mobil-390-kvitto', { ...M, q: '?bygg=1', steps: async p => { await p.click('.pb-how'); } });
await snap('bygg-desktop-1440-kvitto', { ...D, q: '?bygg=1', steps: async p => { await p.click('.pb-how'); } });
await snap('bygg-mobil-390-blomval', { ...M, q: '?bygg=1', steps: async p => { await p.click('.addflowers'); await p.waitForTimeout(400); } });
await snap('bygg-mobil-390-ny-bukett', { ...M, q: '#/jobb/ny', fit: false });
await snap('inkop-mobil-390', { ...M, q: '?inkop=1', fit: true });
await snap('inkop-desktop-1440', { ...D, q: '?inkop=1' });
const elva = async (p) => { for (let i = 0; i < 5; i++) await p.click('.ledger .row:has-text("Rosa ros") [data-act="item-inc"]'); };
await snap('bygg-desktop-1440-11-rosor', { ...D, q: '?bygg=1', steps: elva });
await snap('bygg-mobil-390-11-rosor', { ...M, q: '?bygg=1', fit: true, steps: elva });
await b.close();
