// Tar skärmbilderna av de tre huvudvyerna och flödet, på telefon (390×664, 2×) och dator (1440×900), samt 150 % teckenstorlek.
// Kör: node verktyg/capture.mjs [utmapp] [filter-regex]
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { launch, ROOT, PAGE } from './lib/test-lib.mjs';
import { makeZoomedCopy } from './lib/granska-lib.mjs';
const OUT = path.resolve(process.argv[2] || path.join(ROOT, 'skarmbilder'));
const only = process.argv[3] ? new RegExp(process.argv[3]) : null;
fs.mkdirSync(OUT, { recursive: true });
const b = await launch();
let zoomRoot = null;
const go = ms => new Promise(r => setTimeout(r, ms));
async function snap(name, { w, h, dpr = 1, q = '', steps, zoom }) {
  if (only && !only.test(name)) return;
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dpr, locale: 'sv-SE', hasTouch: w < 700, isMobile: w < 700, reducedMotion: 'reduce' });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/net::|Failed to load resource/.test(m.text())) errs.push(m.text()); });
  const base = zoom ? 'file://' + (zoomRoot = zoomRoot || makeZoomedCopy(ROOT, zoom, path.join(os.tmpdir(), 'cap-zoom'))) + '/index.html' : PAGE();
  await p.goto(base + q); await p.evaluate(() => document.fonts.ready); await go(450);
  if (steps) await steps(p);
  await go(250);
  const ov = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  await p.screenshot({ path: `${OUT}/${name}.png` });
  console.log(name.padEnd(44), errs.length ? 'FEL: ' + errs.join(' | ') : 'ok', ov > 0 ? 'SIDLEDES ÖVERFLÖD ' + ov : '');
  await ctx.close();
}
const M = { w: 390, h: 664, dpr: 2 }, D = { w: 1440, h: 900, dpr: 1 };
const click = async (p, sel) => { await p.click(sel); await go(120); };
const five = async p => { const ids = await p.$$eval('.pk-pick', es => es.slice(0, 5).map(e => e.dataset.id)); for (const id of ids) await click(p, '.pk-pick[data-id="' + id + '"]'); };
const single = p => p.evaluate(() => !matchMedia('(min-width:900px) and (min-height:540px)').matches);

// de tre huvudvyerna
await snap('1-hem-mobil', { ...M });
await snap('1-hem-dator', { ...D });
await snap('2-bukett-mobil', { ...M, q: '?bukett=1' });
await snap('2-bukett-dator', { ...D, q: '?bukett=1' });
await snap('3-inkop-mobil', { ...M, q: '?inkop=1' });
await snap('3-inkop-dator', { ...D, q: '?inkop=1' });
// flödet: ny bukett med fem favoriter
await snap('4-ny-bukett-favoriter-mobil', { ...M, q: '?ny=1' });
await snap('5-ny-bukett-fem-valda-mobil', { ...M, q: '?ny=1', steps: five });
await snap('6-ny-bukett-visa-buketten-mobil', { ...M, q: '?ny=1', steps: async p => { await five(p); await click(p, '#bar .bar-go'); } });
await snap('7-kategorier-mobil', { ...M, q: '?blommor=1', steps: async p => { await click(p, '.selbtn-view'); } });
await snap('8-sok-mobil', { ...M, q: '?blommor=1', steps: async p => { await p.fill('#pk-q', 'ros'); await go(150); } });
await snap('9-kvitto-mobil', { ...M, q: '?bukett=1', steps: async p => { await click(p, '[data-act=receipt]'); await p.evaluate(() => document.querySelector('#receipt').scrollIntoView({ block: 'end' })); } });
await snap('4-ny-bukett-fem-valda-dator', { ...D, q: '?ny=1', steps: five });
await snap('7-kategori-dator', { ...D, q: '?ny=1', steps: async p => { await five(p); await click(p, '.chip[data-id=huvud]'); } });
// andra storlekar och större text
await snap('10-bukett-surfplatta-768', { w: 768, h: 1024, dpr: 1, q: '?bukett=1' });
await snap('10-bukett-dator-1920', { w: 1920, h: 1080, dpr: 1, q: '?bukett=1' });
await snap('10-bukett-liten-telefon-320', { w: 320, h: 568, dpr: 2, q: '?bukett=1' });
await snap('11-bukett-mobil-text-150', { ...M, q: '?bukett=1', zoom: 1.5 });
await snap('11-blomval-mobil-text-150', { ...M, q: '?blommor=1', zoom: 1.5 });
await b.close();
if (zoomRoot) fs.rmSync(zoomRoot, { recursive: true, force: true });
