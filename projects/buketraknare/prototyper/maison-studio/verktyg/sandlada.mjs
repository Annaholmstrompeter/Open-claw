// Flödestest i en sandlåde-iframe som liknar artefaktvisaren: ingen lagring, inga formulärinskick, ingen frågesträng, begränsad historik.
// Kör: node verktyg/sandlada.mjs FIL.html   (den byggda artefaktsidan, se bygg-artefakt.mjs)
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import { launch, suite, SE, N, pure } from './lib/test-lib.mjs';
import { hostFor } from './lib/sandlada-lib.mjs';
const FILE = path.resolve(process.argv[2] || ''); if (!process.argv[2] || !fs.existsSync(FILE)) { console.error('Ange artefaktsidan: node verktyg/sandlada.mjs FIL.html'); process.exit(2); }
const T = suite('sandlåda'); const { ok, eq } = T;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'sandlada-'));
const b = await launch();
for (const [label, W, H, touch] of [['MOBIL 390×664', 390, 664, true], ['DATOR 1440×900', 1440, 900, false]]) {
  console.log('\n=== ' + label + ' ===');
  const single = W < 900;
  const ctx = await b.newContext({ viewport: { width: W, height: H }, hasTouch: touch, isMobile: touch, locale: 'sv-SE', reducedMotion: 'reduce' });
  const page = await ctx.newPage(); const errs = [];
  page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error' && !/net::|Failed to load resource|Refused to|Content Security/.test(m.text())) errs.push(m.text()); });
  await page.goto('file://' + hostFor(FILE, 1, TMP)); await page.waitForTimeout(700);
  const f = page.frames().find(x => x !== page.mainFrame()); ok(!!f, 'sidan laddas i en sandlåda');
  const click = async sel => { await f.click(sel, { timeout: 4000 }); await f.waitForTimeout(90); };
  const bar = () => f.$eval('#bar .bar-price', e => window.N ? window.N(e.textContent) : e.textContent.replace(/ /g, ' ').replace(/\s+/g, ' ').trim());
  const info = await f.evaluate(() => { let ls = 'ok'; try { window.localStorage.getItem('x'); } catch (e) { ls = 'KASTAR ' + e.name; } const fm = document.createElement('form'); return { ls, jobs: document.querySelectorAll('.job').length, persisted: window.__studio.F.isPersisted(), w: innerWidth }; });
  ok(info.ls !== 'ok', 'lagring är blockerad som i visaren: ' + info.ls); eq(info.jobs, 4, 'Hem visar fyra jobb trots blockerad lagring'); eq(info.w, W, 'sidan får skärmens bredd (' + info.w + ')');
  ok(info.persisted === false, 'prototypen vet att favoriterna inte sparas permanent här');
  // kärnflödet utan frågesträng: Ny bukett, fem favoriter, ändra antal, lägg till fler, inköp
  await click('[data-act=new]');
  const five = await f.$$eval('.pk-pick', es => es.slice(0, 5).map(e => e.dataset.id));
  const E5 = SE.create(); const d5 = E5.draft();
  for (const id of five) { await f.click('.pk-pick[data-id="' + id + '"]'); E5.addFlower(d5.arrId, id); } await f.waitForTimeout(90);
  eq(await f.$$eval('.pk-pick[aria-checked=true]', es => es.length), 5, 'fem blommor valda med fem tryck');
  eq(pure(await bar()), N(E5.arrangement(d5.eventId, d5.arrId).price), 'kundpriset i prisfältet = motorn');
  if (single) await click('#bar .bar-go');
  await f.click('.row [data-act=item-inc] >> nth=0'); await f.waitForTimeout(60); E5.setQty(E5.arrangement(d5.eventId, d5.arrId).items[0].id, 2);
  eq(pure(await bar()), N(E5.arrangement(d5.eventId, d5.arrId).price), 'efter ändrat antal: pris = motorn');
  // eget material och namnbyte utan formulärinskick (knappar och Enter)
  await click('[data-act=own-toggle]'); await f.fill('#ownform [name=n]', 'Band'); await f.fill('#ownform [name=c]', '40'); await click('#ownform [data-act=own-add]');
  ok(await f.$$eval('.row .nm', es => es.some(e => /Band/.test(e.textContent))), 'Lägg till eget material fungerar utan formulärinskick');
  await click('[data-act=own-toggle]'); await f.fill('#ownform [name=n]', 'Snöre'); await f.fill('#ownform [name=c]', '12,50'); await f.press('#ownform [name=c]', 'Enter'); await f.waitForTimeout(90);
  ok(await f.$$eval('.row .nm', es => es.some(e => /Snöre/.test(e.textContent))), 'Enter i eget material fungerar');
  await click('[data-act=rename]'); await f.fill('#arr-name', 'Min bukett'); await click('[data-act=rename-save]');
  eq(await f.$eval('.bq-title', e => e.textContent), 'Min bukett', 'Spara byter namn');
  await click('[data-act=rename]'); await f.fill('#arr-name', 'Enter-namn'); await f.press('#arr-name', 'Enter'); await f.waitForTimeout(90);
  eq(await f.$eval('.bq-title', e => e.textContent), 'Enter-namn', 'Enter sparar namnet');
  // lägg till fler: alla val kvar
  if (single) await click('#bar .bar-go');
  eq(await f.$$eval('.pk-pick[aria-checked=true]', es => es.length), 5, 'tillbaka i blomvalet: de fem är fortfarande markerade');
  // favoriter i minnet
  const favs0 = await f.evaluate(() => window.__studio.F.count());
  await click(single ? '.selbtn-view' : '.chip[data-id=rosor]'); if (single) await click('.tile[data-id=rosor]');
  const rid = await f.$eval('.pk-fav[aria-pressed=false]', e => e.dataset.id); await click('.pk-fav[data-id="' + rid + '"]');
  eq(await f.evaluate(() => window.__studio.F.count()), favs0 + 1, 'favorit läggs till i minnet (lagring saknas)');
  await f.fill('#pk-q', 'gips'); await f.waitForTimeout(120); ok((await f.$$eval('.pk-nm', es => es.length)) >= 1, 'sök filtrerar medan man skriver');
  await f.fill('#pk-q', '');
  // Ångra
  const pickedId = await f.$eval('.pk-pick[aria-checked=true]', e => e.dataset.id);
  await f.evaluate(() => { const i = document.querySelector('[data-act=pk-clear]'); }); 
  await click(single ? '.selbtn-view' : '.chip[data-id=fav]'); if (single) await click('.tile[data-id=fav]');
  await f.click('.pk-pick[aria-checked=true] >> nth=0'); await f.waitForTimeout(90);
  ok(await f.$('.toast') !== null, 'bortval visar Ångra'); await click('[data-act=toast-action]');
  eq(await f.$$eval('.pk-pick[aria-checked=true]', es => es.length) >= 5, true, 'Ångra ger tillbaka blomman');
  // Inköp och Hem
  await click('.nav [data-act=nav-inkop]');
  const sum = await f.$eval('.ik-bar .bar-price', e => e.textContent.replace(/ /g, ' ').trim()); ok(/kr$/.test(sum), 'Inköp visar en summa: ' + sum);
  await click('.nav [data-act=nav-hem]'); eq(await f.$$eval('.job', es => es.length), 5, 'det nya jobbet syns på Hem');
  eq(await f.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth) <= 0, true, 'inget sidledes överflöd');
  ok(errs.length === 0, 'inga skriptfel i sandlådan: ' + errs.join(' | '));
  await page.screenshot({ path: path.join(TMP, 'sand-' + W + '.png') });
  await ctx.close();
}
fs.rmSync(TMP, { recursive: true, force: true });
T.done(b);
