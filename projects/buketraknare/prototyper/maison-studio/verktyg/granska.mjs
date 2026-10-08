// Granskningsmatris: öppnar varje vy och varje läge i Maison Studio på många skärmstorlekar och teckenstorlekar i riktig Chromium
// och letar efter det som en florist ser som "trasigt": kapad text, text som överlappar text eller knappar, kontroller som något
// annat täcker, för små tryckytor och text, och rullning i sidled. Noll fynd krävs.
//
//   node verktyg/granska.mjs                      alla storlekar, teckenstorlek 100 %, 130 %, 150 % (och 200 % på ett urval)
//   node verktyg/granska.mjs --zoom=1 --snabb     bara 100 % och färre storlekar
//   node verktyg/granska.mjs --sandlada=FIL.html  samma matris mot den byggda artefaktsidan i en sandlåde-iframe som artefaktvisaren
//   node verktyg/granska.mjs --lage=namn          bara lägen vars namn matchar uttrycket
//   node verktyg/granska.mjs --json=ut.json       skriv alla fynd till en fil
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { launch, ROOT } from './lib/test-lib.mjs';
import { audit, makeZoomedCopy } from './lib/granska-lib.mjs';
import { hostFor as hostFor0 } from './lib/sandlada-lib.mjs';
const hostFor = (f, k) => hostFor0(f, k, TMP);

const arg = (k, d) => { const a = process.argv.find(x => x.startsWith('--' + k + '=')); return a ? a.split('=').slice(1).join('=') : d; };
const flag = k => process.argv.includes('--' + k);
const FAST = flag('snabb');
const LAGE = arg('lage', null) ? new RegExp(arg('lage')) : null;
const SAND = arg('sandlada', null);
const ZOOMS = arg('zoom', FAST ? '1' : '1,1.3,1.5,2').split(',').map(Number);
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'granska-'));

// [namn, bredd, höjd, tryck(telefon)?, teckenstorlekar som körs]
const PHONES = [['iPhone SE 320×568', 320, 568], ['Android 360×740', 360, 740], ['iPhone 8 375×667', 375, 667], ['iPhone 14 390×664', 390, 664], ['iPhone 14 390×844', 390, 844], ['Pixel 7 412×839', 412, 839], ['Stor telefon 430×739', 430, 739]];
const SIZES = [
  ...PHONES.map(([n, w, h]) => ({ n, w, h, touch: true })),
  { n: 'Telefon liggande 667×375', w: 667, h: 375, touch: true },
  { n: 'Telefon liggande 844×390', w: 844, h: 390, touch: true },
  { n: 'Telefon + tangentbord 390×330', w: 390, h: 330, touch: true, keyboard: true, only: /sök|Ny bukett: favoriter|Ny bukett: fem valda$/ },
  { n: 'Telefon + tangentbord 320×300', w: 320, h: 300, touch: true, keyboard: true, only: /sök|Ny bukett: favoriter|Ny bukett: fem valda$/ },
  { n: 'Surfplatta 768×1024', w: 768, h: 1024, touch: true },
  { n: 'Surfplatta liggande 1024×768', w: 1024, h: 768, touch: true },
  { n: 'Smal dator 900×600', w: 900, h: 600 },
  { n: 'Dator 1180×700', w: 1180, h: 700 },
  { n: 'Dator 1280×720', w: 1280, h: 720 },
  { n: 'Dator 1440×900', w: 1440, h: 900 },
  { n: 'Dator 1920×1080', w: 1920, h: 1080 },
];
const ZOOM2 = /360×740|390×664|768×1024/;   // 200 % körs på ett urval av telefoner och surfplattor (större än vad inställningarna normalt ger)
const sizes = (FAST ? SIZES.filter(s => /320×568|390×664|768×1024|1440×900/.test(s.n)) : SIZES);

const clickAll = async (p, sel, n) => { const ids = await p.$$eval(sel, es => es.map(e => e.dataset.id)); for (const id of ids.slice(0, n)) await p.click(sel + '[data-id="' + id + '"]'); };
const isSingle = (w, h) => !(w >= 900 && h >= 540);
const has = async (p, sel) => p.evaluate(s => { const e = document.querySelector(s); if (!e) return false; for (let a = e; a && a !== document.documentElement; a = a.parentElement) { const c = getComputedStyle(a); if (c.display === 'none' || c.visibility === 'hidden' || a.hasAttribute('hidden')) return false; } return e.getBoundingClientRect().width > 0; }, sel);
const click = async (p, sel) => { await p.click(sel, { timeout: 4000 }); await p.waitForTimeout(80); };
const toPicker = async (p, s) => { if (s) await click(p, '#bar .bar-go'); };
// [namn, sökväg, steg(p, single), bara i 'single'|'split']
const STATES = [
  ['Hem', '', async () => {}],
  ['Bukett: Brudbukett', '?bukett=1', async () => {}],
  ['Bukett: kvitto öppet', '?bukett=1', async p => { await click(p, '[data-act=receipt]'); }],
  ['Bukett: eget material', '?bukett=1', async p => { await click(p, '[data-act=own-toggle]'); }],
  ['Bukett: byt namn', '?bukett=1', async p => { await click(p, '[data-act=rename]'); }],
  ['Bukett: långt namn', '?bukett=1', async p => { await click(p, '[data-act=rename]'); await p.fill('#arr-name', 'Brudbukett med extra långt namn för Emma och Johan i Storkyrkan'); await click(p, '#renameform [data-act=rename-save]'); }],
  ['Bukett: ta bort?', '?bukett=1', async p => { await click(p, '[data-act=del]'); }],
  ['Bukett: ogiltigt arbete', '?bukett=1', async p => { await p.fill('#labor', 'abc'); await p.waitForTimeout(80); }],
  ['Bukett: arrangemangsmeny', '?bukett=1', async p => { if (!(await has(p, '[data-act=menu-arr]'))) return 'hoppa'; await click(p, '[data-act=menu-arr]'); }],
  ['Bukett: Bordsdekoration ×8', '?bukett=1', async p => { if (await has(p, '[data-act=menu-arr]')) { await click(p, '[data-act=menu-arr]'); await click(p, '.menu [data-act=arr] >> nth=1'); } else await click(p, '.arrs [data-act=arr] >> nth=1'); }],
  ['Bukett: tom (ny bukett, bukettvy)', '?ny=1', async (p, s) => { if (s) await clickAll(p, '.pk-pick', 1), await click(p, '#bar .bar-go'); }, 'single'],
  ['Bukett: ångra-meddelande', '?blommor=1', async (p, s) => { await click(p, '.pk-pick[aria-checked=true]'); }],
  ['Ny bukett: favoriter', '?ny=1', async () => {}],
  ['Ny bukett: fem valda', '?ny=1', async p => { await clickAll(p, '.pk-pick', 5); await p.waitForTimeout(80); }],
  ['Ny bukett: fem valda, bukettvy', '?ny=1', async (p, s) => { await clickAll(p, '.pk-pick', 5); if (s) await click(p, '#bar .bar-go'); }],
  ['Blomval: kategorimeny', '?blommor=1', async p => { if (!(await has(p, '.selbtn-view'))) return 'hoppa'; await click(p, '.selbtn-view'); }, 'single'],
  ['Blomval: kategori Huvudblommor', '?blommor=1', async (p, s) => { if (s) { await click(p, '.selbtn-view'); await click(p, '.tile[data-id=huvud]'); } else await click(p, '.chip[data-id=huvud]'); }],
  ['Blomval: Alla blommor', '?blommor=1', async (p, s) => { if (s) { await click(p, '.selbtn-view'); await click(p, '.tile[data-id=all]'); } else await click(p, '.chip[data-id=all]'); }],
  ['Blomval: sök', '?blommor=1', async p => { await p.fill('#pk-q', 'ros'); await p.waitForTimeout(120); }],
  ['Blomval: sök, fokus i fältet', '?blommor=1', async p => { await p.focus('#pk-q'); await p.fill('#pk-q', 'gipsort'); await p.waitForTimeout(120); }],
  ['Blomval: sök utan träff', '?blommor=1', async p => { await p.fill('#pk-q', 'qqqq'); await p.waitForTimeout(120); }],
  ['Blomval: favoriter + förklaring', '?ny=1', async p => { await click(p, '[data-act=pk-about]'); }],
  ['Blomval: inga favoriter', '?ny=1', async p => { await click(p, '[data-act=pk-about]'); await click(p, '[data-act=pk-fav-clear]'); }],
  ['Inköp', '?inkop=1', async () => {}],
  ['Inköp: jobbmeny', '?inkop=1', async p => { await click(p, '[data-act=menu-job]'); }],
  ['Inköp: Restaurang (exkl. moms)', '?inkop=1', async p => { await click(p, '[data-act=menu-job]'); await click(p, '.menu [data-act=pick-job] >> nth=3'); }],
];

const b = await launch();
const result = {}; let cells = 0, bad = 0, skipped = 0; const kinds = {};
const jobs = [];
for (const k of ZOOMS) for (const sz of sizes) { if (k === 2 && !ZOOM2.test(sz.n)) continue; if (k > 1 && /tangentbord/.test(sz.n) && k > 1.5) continue; jobs.push({ k, sz }); }

const roots = {};
const rootFor = k => (roots[k] = roots[k] || (SAND ? null : k === 1 ? ROOT : makeZoomedCopy(ROOT, k, path.join(TMP, 'z' + k))));
for (const k of ZOOMS) rootFor(k);
const hosts = {}; if (SAND) for (const k of ZOOMS) hosts[k] = hostFor(SAND, k);

async function runJob({ k, sz }) {
  const ctx = await b.newContext({ viewport: { width: sz.w, height: sz.h }, deviceScaleFactor: 2, hasTouch: !!sz.touch, isMobile: !!sz.touch && sz.w < 900, locale: 'sv-SE', reducedMotion: 'reduce' });
  const single = isSingle(sz.w, sz.h);
  for (const [sn, q, step, only] of STATES) {
    if (sz.only && !sz.only.test(sn)) continue;
    if (LAGE && !LAGE.test(sn)) continue;
    if (only === 'single' && !single) continue; if (only === 'split' && single) continue;
    const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
    let p = page;
    if (SAND) {
      await page.goto('file://' + hosts[k] + (q ? '' : '')); await page.waitForTimeout(600);
      p = page.frames().find(f => f !== page.mainFrame());
      // frågesträngen når inte sidan i sandlådan: samma lägen nås med tryck, som en florist gör
      if (q === '?bukett=1') await click(p, '.job >> nth=0');
      else if (q === '?blommor=1') { await click(p, '.job >> nth=0'); if (single) await click(p, '#bar .bar-go'); }
      else if (q === '?ny=1') await click(p, '[data-act=new]');
      else if (q === '?inkop=1') await click(p, '.nav [data-act=nav-inkop]');
    } else {
      await page.goto('file://' + rootFor(k) + '/index.html' + q); await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(220);
    }
    let key = `${k * 100} %|${sz.n}|${sn}`, found = [];
    try {
      const r = await step(p, single);
      if (r === 'hoppa') { skipped++; await page.close(); continue; }
      if (sz.keyboard && await has(p, '#pk-q')) await p.focus('#pk-q');   // tangentbordet är uppe: markören står i sökfältet
      await page.waitForTimeout(80);
      found = await audit(p);
    } catch (e) { found = [{ kind: 'testfel', what: sn, detail: String(e.message).split('\n')[0] }]; }
    if (errs.length) found.push({ kind: 'skriptfel', what: sn, detail: errs.join(' | ') });
    cells++; result[key] = found; if (found.length) { bad++; for (const f of found) kinds[f.kind] = (kinds[f.kind] || 0) + 1; }
    await page.close();
  }
  await ctx.close();
}

const t0 = Date.now(); let next = 0; const W = Math.min(3, os.cpus().length);
await Promise.all(Array.from({ length: W }, async () => { while (next < jobs.length) { const j = jobs[next++]; await runJob(j); process.stdout.write('.'); } }));
console.log('\n');
const out = arg('json', null); if (out) fs.writeFileSync(out, JSON.stringify(result, null, 1));
for (const [key, f] of Object.entries(result)) if (f.length) { console.log(key); for (const x of f.slice(0, 6)) console.log('    ' + x.kind + ': ' + x.what + ' — ' + x.detail); if (f.length > 6) console.log('    … och ' + (f.length - 6) + ' till'); }
console.log(`\nGRANSKNING${SAND ? ' (sandlåda)' : ''}: ${cells} rutor (${jobs.length} storlek/teckenstorlek × lägen, ${skipped} lägen finns inte på den storleken), ${bad} med fynd, ${Object.values(kinds).reduce((a, c) => a + c, 0)} fynd ${JSON.stringify(kinds)}  [${Math.round((Date.now() - t0) / 1000)} s]`);
fs.rmSync(TMP, { recursive: true, force: true });
await b.close(); process.exit(bad ? 1 : 0);
