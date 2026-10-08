// Delat för testerna: starta Chromium, öppna prototypen med telefon- eller datorprofil, enkla kontroller och jämförelse med Node-motorn.
import { chromium } from 'playwright-core';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import path from 'node:path';
const require = createRequire(import.meta.url);
export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const SE = require(ROOT + '/js/studio-engine.js');          // samma motor i Node: facit för jämförelserna
export const CHROMIUM = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
export const launch = () => chromium.launch({ executablePath: CHROMIUM, args: ['--no-sandbox'] });
/** Sida att testa. SIDA=… pekar på en annan fil (till exempel den byggda enfilsversionen). */
export const PAGE = () => 'file://' + ROOT + '/' + (process.env.SIDA || 'index.html');

export function suite(name) {
  let pass = 0, fail = 0; const bad = [];
  const ok = (c, m) => { if (c) pass++; else { fail++; bad.push(m); console.log('  FEL:', m); } };
  const eq = (a, e, m) => ok(a === e, m + ' (fick ' + JSON.stringify(a) + ', väntade ' + JSON.stringify(e) + ')');
  const done = async b => { console.log('\nRESULTAT ' + name + ': ' + pass + ' ok, ' + fail + ' fel'); if (fail) console.log(bad.join('\n')); if (b) await b.close(); process.exit(fail ? 1 : 0); };
  return { ok, eq, done, count: () => ({ pass, fail }) };
}
/** Normaliserar text: hårda mellanslag blir vanliga, och dolda skärmläsartexter plus ✓/≈ tas bort så att bara beloppet återstår. */
export const N = s => String(s).replace(/ /g, ' ').replace(/\s+/g, ' ').trim();
export const pure = s => N(s).replace(/(Bekräftat|Ungefärligt) pris ?/g, '').replace(/[✓≈] ?/g, '').trim();

export async function open(b, w, h, q = '', o = {}) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, locale: 'sv-SE', hasTouch: w < 700, isMobile: w < 700, reducedMotion: 'reduce', ...o });
  const p = await ctx.newPage(); p.errs = [];
  p.on('pageerror', e => p.errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/net::|Failed to load resource/.test(m.text())) p.errs.push(m.text()); });
  await p.goto(PAGE() + q); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(200);
  await p.evaluate(`window.N = s => String(s).replace(/\\u00A0/g,' ').replace(/\\s+/g,' ').trim();`);
  return p;
}
export const tap = async (p, sel) => { await p.click(sel); await p.waitForTimeout(90); };
/** Är elementet synligt på riktigt (inte display:none, inte utanför sin rullyta)? */
export const visible = (p, sel) => p.evaluate(s => { const e = document.querySelector(s); if (!e) return false; for (let a = e; a && a !== document.documentElement; a = a.parentElement) { const c = getComputedStyle(a); if (c.display === 'none' || c.visibility === 'hidden' || a.hasAttribute('hidden')) return false; } const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; }, sel);
export const barPrice = p => p.evaluate(() => { const e = document.querySelector('#bar .bar-price'); return e ? window.N(e.textContent) : ''; });
