// Blomväljarens flöden i riktig Chromium (mobil och dator): favoriter, kategorier, global sök, flerval, ångra, historik, florister, layout.
// Priserna jämförs mot samma prismotor körd i Node. Kör: node verktyg/blomval.mjs
import { chromium } from 'playwright-core';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import path from 'node:path';
const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SE = require(ROOT + '/js/studio-engine.js'), D = require(ROOT + '/js/studio-data.js');
const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  FEL:', m); } };
const eq = (a, e, m) => ok(JSON.stringify(a) === JSON.stringify(e), m + ' (fick ' + JSON.stringify(a) + ', väntade ' + JSON.stringify(e) + ')');
const N = s => String(s).replace(/ /g, ' ').replace(/\s+/g, ' ').trim();
const flowerId = (E, name) => E.flowers().find(f => f.name === name).id;

async function open(w, h, q = '', ctxOpts = {}) {
  const ctx = ctxOpts.ctx || await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, locale: 'sv-SE', hasTouch: w < 600, isMobile: w < 600, reducedMotion: 'reduce', ...ctxOpts });
  const p = await ctx.newPage(); p.errs = []; p.taps = 0;
  p.on('pageerror', e => p.errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/net::|Failed to load resource/.test(m.text())) p.errs.push(m.text()); });
  await p.addInitScript(`window.N = s => String(s).replace(/\\u00A0/g,' ').replace(/\\s+/g,' ').trim();`);   // finns kvar efter omladdning
  await p.goto('file://' + ROOT + '/' + (process.env.SIDA || 'index.html') + q); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(250);
  return p;
}
const tap = async (p, sel) => { p.taps++; await p.click(sel); await p.waitForTimeout(60); };
const barPrice = p => p.evaluate(() => window.N(document.querySelector('#picker .pk-price').textContent).replace(/Bekräftat pris |Ungefärligt pris /g, ''));
const rows = p => p.evaluate(() => [...document.querySelectorAll('#picker .pk-row')].map(r => ({ id: r.querySelector('[data-act="pk-toggle"]').dataset.id, on: r.querySelector('[data-act="pk-toggle"]').getAttribute('aria-checked') === 'true', fav: r.querySelector('.pk-fav').getAttribute('aria-pressed') === 'true', h: r.getBoundingClientRect().height, name: window.N(r.querySelector('.pk-nm').textContent) })));
const overflowX = p => p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
const rect = (p, sel) => p.evaluate(s => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, w: r.width, h: r.height }; }, sel);
const disjointY = (a, c) => a && c && a.bottom <= c.top + 0.5;      // a ligger helt ovanför c

// ===================================================================== MOBIL 390 × 844
console.log('\n=== MOBIL 390 ===');
{
  const E = SE.create(); let p = await open(390, 844, '?bygg=1');
  // ---- 1. Översikten: sök, favoriter och kategorier, utan att något klipps
  await tap(p, '.addflowers');
  eq(await p.evaluate(() => document.querySelector('#picker').getAttribute('role')), 'dialog', 'blomvalet är en dialog på mobil');
  const hub = await p.evaluate(() => ({ search: !!document.querySelector('#pk-q'), favN: document.querySelector('#pk-fav-h .n').textContent, chips: document.querySelectorAll('.chip[data-act="pk-toggle"]').length, tiles: [...document.querySelectorAll('.pk-cat .nm')].map(e => e.textContent), sh: document.querySelector('.pk-scroll').scrollHeight, ch: document.querySelector('.pk-scroll').clientHeight, title: document.querySelector('#pk-h').textContent, to: document.querySelector('.pk-to').textContent }));
  ok(hub.search, 'sökfältet finns i översikten'); eq(hub.favN, '8', 'åtta favoriter'); eq(hub.chips, 8, 'åtta favoritknappar'); eq(hub.tiles, ['Rosor', 'Huvudblommor', 'Lökblommor', 'Utfyllnad', 'Grönt', 'Kvistar & bär', 'Torkat', 'Alla blommor'], 'sju kategorier och Alla blommor');
  ok(hub.sh <= hub.ch + 1, 'hela översikten ryms utan att rulla på 390 × 844 (innehåll ' + hub.sh + ' px, yta ' + hub.ch + ' px)');
  eq(hub.to, 'Till Brudbukett', 'blomvalet säger vilken bukett man lägger till i');
  const hr = await rect(p, '.pk-head'), sr = await rect(p, '.pk-search'), mr = await rect(p, '.pk-main'), br = await rect(p, '.pk-bar'), pr = await rect(p, '#picker');
  ok(disjointY(hr, sr) && disjointY(sr, mr) && disjointY(mr, br) && br.bottom <= pr.bottom + 0.5 && hr.top >= pr.top - 0.5, 'rubrik, sök, innehåll och prisfält ligger ovanför varandra utan överlapp');
  eq(await overflowX(p), 0, 'inget sidledes överflöd');
  // ---- 2. Favoriter: ett tryck per blomma, pris = motorn
  eq(await p.evaluate(() => [...document.querySelectorAll('.chip[data-act="pk-toggle"]')].filter(c => c.getAttribute('aria-checked') === 'true').map(c => c.textContent.trim()).sort()), ['Eukalyptus', 'Lisianthus', 'Pion', 'Rosa ros 50 cm'], 'favoriter som redan finns i buketten är markerade');
  const Ea = SE.create(), ja = Ea.jobs()[0], aa = Ea.job(ja.id).arrangements[0];
  await tap(p, '.chip[data-id="' + flowerId(E, 'Tulpan') + '"]'); Ea.addFlower(aa.id, flowerId(E, 'Tulpan'));
  eq(await p.getAttribute('.chip[data-id="' + flowerId(E, 'Tulpan') + '"]', 'aria-checked'), 'true', 'ett tryck markerar Tulpan');
  ok((await barPrice(p)).endsWith(N(Ea.arrangement(ja.id, aa.id).price)), 'prisfältet följer med: ' + await barPrice(p) + ' = motorn ' + Ea.arrangement(ja.id, aa.id).price);
  eq(await p.evaluate(() => document.querySelector('.pk-n').textContent), '5 sorter', 'prisfältet räknar sorter');
  await tap(p, '.chip[data-id="' + flowerId(E, 'Tulpan') + '"]'); Ea.removeItem(Ea.arrangement(ja.id, aa.id).items.find(i => i.name === 'Tulpan').id);
  eq(await p.getAttribute('.chip[data-id="' + flowerId(E, 'Tulpan') + '"]', 'aria-checked'), 'false', 'ett tryck till avmarkerar');
  ok(await p.evaluate(() => /Tulpan borttagen/.test(document.querySelector('#toast').textContent) && !document.querySelector('#toast').hidden), 'borttagningen bekräftas med ett meddelande');
  // ---- 3. Ångra
  // ---- 3. Ångra: Pion har 10 stjälkar i buketten. Ett tryck tar bort den, Ångra ger tillbaka den med alla 10.
  const pionId = flowerId(E, 'Pion'), priceBefore = N(Ea.arrangement(ja.id, aa.id).price);
  await p.evaluate(() => { document.querySelector('#toast').hidden = true; });
  await tap(p, '.chip[data-id="' + pionId + '"]');
  eq(await p.getAttribute('.chip[data-id="' + pionId + '"]', 'aria-checked'), 'false', 'ett tryck på en vald favorit tar bort Pion');
  await tap(p, '#toast [data-act="toast-action"]');
  eq(await p.getAttribute('.chip[data-id="' + pionId + '"]', 'aria-checked'), 'true', 'Ångra markerar Pion igen');
  await tap(p, '.pk-go');
  eq(await p.evaluate(() => [...document.querySelectorAll('.ledger .row')].filter(r => /Pion/.test(r.textContent)).map(r => r.querySelector('.stp output').textContent)), ['10'], 'Pion är tillbaka med alla 10 stjälkar');
  ok((await p.evaluate(() => window.N(document.querySelector('#pb-price').textContent))).replace(/Bekräftat pris |Ungefärligt pris /g, '').includes('1 615 kr'), 'priset är tillbaka på 1 615 kr efter Ångra');
  await p.context().close();
}

// ---- 4. Fem vanliga blommor på några tryck, utan att skrolla (ny bukett)
{
  const E = SE.create(); const p = await open(390, 844, '#/jobb/ny');
  await tap(p, '.addflowers');
  const want = ['Rosa ros 50 cm', 'Pion', 'Lisianthus', 'Eukalyptus', 'Gipsört'];
  const inView = await p.evaluate(names => names.map(n => { const c = [...document.querySelectorAll('.chip')].find(x => x.textContent.trim() === n); if (!c) return false; const r = c.getBoundingClientRect(), s = document.querySelector('.pk-scroll').getBoundingClientRect(); return r.top >= s.top && r.bottom <= s.bottom; }), want);
  eq(inView, [true, true, true, true, true], 'alla fem favoriter syns utan att rulla');
  const before = p.taps;
  for (const n of want) await tap(p, '.chip[data-id="' + flowerId(E, n) + '"]');
  await tap(p, '.pk-go');
  eq(p.taps, 7, 'ny bukett med fem blommor tar sju tryck: öppna, fem blommor, Visa mina valda blommor');
  eq(await p.evaluate(() => document.querySelector('#picker').hidden), true, 'blomvalet är stängt');
  const E5 = SE.create(), d5 = E5.draft(); for (const n of want) E5.addFlower(d5.arrId, flowerId(E5, n));
  eq(await p.evaluate(() => [...document.querySelectorAll('.ledger .row .nm')].map(e => e.firstChild.textContent === '' ? e.textContent : e.textContent.replace(/Grossist.*/, '')).length >= 5), true, 'fem rader i bukettöversikten');
  eq(await p.evaluate(() => window.N(document.querySelector('#pb-price').textContent).replace(/Bekräftat pris |Ungefärligt pris /g, '')), N(E5.arrangement(d5.eventId, d5.arrId).price), 'pris = motorn för de fem blommorna (' + E5.arrangement(d5.eventId, d5.arrId).price + ')');
  eq(await p.evaluate(() => [...document.querySelectorAll('.ledger [data-act="item-inc"]')].length), 5, 'plus/minus för antal stjälkar finns för alla fem');
  eq(await p.evaluate(() => [...document.querySelectorAll('.ledger .stp output')].map(o => o.textContent)), ['1', '1', '1', '1', '1'], 'varje blomma börjar med en stjälke (antalet ändras i bukettöversikten)');
  eq(await p.evaluate(() => document.activeElement && document.activeElement.dataset.fk), 'open-picker', 'fokus är tillbaka på Lägg till blommor');
  eq(await p.evaluate(() => document.querySelectorAll('.ledger .row.fresh').length), 5, 'de fem nya blommorna markeras kort i bukettöversikten');
  ok(await p.evaluate(() => { const r = document.querySelector('.ledger .row.fresh').getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; }), 'och den första nya blomman syns i bild');
  await p.waitForTimeout(2800); eq(await p.evaluate(() => document.querySelectorAll('.row.fresh').length), 0, 'markeringen försvinner av sig själv');
  // ---- 5. Tillbaka till blomvalet utan att förlora något
  await tap(p, '.ledger .row:has-text("Pion") [data-act="item-inc"]'); await tap(p, '.ledger .row:has-text("Pion") [data-act="item-inc"]');
  await tap(p, '.addflowers');
  const r = await rows(p); eq(r.length, 0, 'översikten har inga rader (bara favoritknappar)');
  eq(await p.evaluate(() => [...document.querySelectorAll('.chip')].filter(c => c.getAttribute('aria-checked') === 'true').map(c => c.textContent.trim()).sort()), want.slice().sort(), 'de fem tidigare valen är markerade när blomvalet öppnas igen');
  await tap(p, '.pk-cat[data-id="huvud"]');
  const pion = (await rows(p)).find(x => x.name === 'Pion'); ok(pion && pion.on, 'Pion är markerad i sin kategori');
  eq(await p.evaluate(() => document.querySelector('.pk-row.on .pk-stems').textContent), '3 stjälkar', 'raden visar antal stjälkar i buketten (3), inte antal förpackningar');
  await tap(p, '.pk-go');
  eq(await p.evaluate(() => [...document.querySelectorAll('.ledger .stp output')].map(o => o.textContent).sort().join()), '1,1,1,1,3', 'tidigare antal är kvar (3 Pion, övriga 1)');
  ok(p.errs.length === 0, 'inga konsolfel: ' + p.errs.join(' | '));
  await p.context().close();
}

// ---- 6. Kategorier, undergrupper och radhöjd (mobil)
{
  const E = SE.create(); const p = await open(390, 844, '?bygg=1&blommor=1');
  await tap(p, '.pk-cat[data-id="rosor"]');
  eq(await p.evaluate(() => window.N(document.querySelector('#pk-h').textContent)), 'Rosor13', 'rubriken visar kategorin och antalet');
  eq((await rows(p)).length, 13, '13 rosor');
  eq(await p.evaluate(() => [...document.querySelectorAll('.pk-grp span:first-child')].map(e => e.textContent)), ['Storblommiga', 'Grenrosor', 'Trädgårdsrosor'], 'grupprubriker i listan');
  const hs = (await rows(p)).map(x => x.h); const avg = hs.reduce((s, x) => s + x, 0) / hs.length;
  ok(Math.max(...hs) <= 64 && Math.min(...hs) >= 44, 'radhöjd på mobil 44 till 64 px (min ' + Math.round(Math.min(...hs)) + ', max ' + Math.round(Math.max(...hs)) + ', snitt ' + avg.toFixed(1) + ' px)');
  const visible = await p.evaluate(() => { const s = document.querySelector('.pk-scroll').getBoundingClientRect(); return [...document.querySelectorAll('.pk-row')].filter(r => { const q = r.getBoundingClientRect(); return q.top >= s.top - 1 && q.bottom <= s.bottom + 1; }).length; });
  ok(visible >= 8, 'minst åtta rader syns samtidigt på 390 × 844 (' + visible + ')');
  await tap(p, '.pk-tabs [data-id="gren"]'); eq((await rows(p)).map(x => x.name), ['Grenros persika', 'Grenros rosa', 'Grenros vit'], 'undergruppen Grenrosor visar tre rader');
  eq(await p.evaluate(() => document.querySelectorAll('.pk-grp').length), 0, 'ingen grupprubrik när en enda undergrupp visas');
  await tap(p, '.pk-tabs [data-id="alla"]'); eq((await rows(p)).length, 13, 'Alla visar alla 13 igen');
  eq(await p.evaluate(() => document.querySelectorAll('.pk-tabs').length), 1, 'undergruppsflikar finns i en stor kategori');
  await tap(p, '.pk-back'); eq(await p.evaluate(() => !!document.querySelector('.pk-cats')), true, 'pilen tillbaka går till översikten');
  await tap(p, '.pk-cat[data-id="torkat"]'); eq(await p.evaluate(() => document.querySelectorAll('.pk-tabs').length), 0, 'små kategorier (7 sorter) har inga undergruppsflikar');
  await tap(p, '.pk-back'); await tap(p, '.pk-cat[data-id="all"]'); eq((await rows(p)).length, 82, 'Alla blommor visar hela sortimentet (82)');
  eq(await p.evaluate(() => [...document.querySelectorAll('.pk-grp span:first-child')].map(e => e.textContent)), ['Rosor', 'Huvudblommor', 'Lökblommor', 'Utfyllnad', 'Grönt', 'Kvistar & bär', 'Torkat'], 'Alla blommor är grupperat per kategori i fast ordning');
  const ids = (await rows(p)).map(x => x.id); eq(new Set(ids).size, 82, 'ingen blomma visas två gånger i Alla blommor');
  await p.context().close();
}

// ---- 7. Sök: hela sortimentet, medan man skriver, oavsett kategori
{
  const E = SE.create(); const p = await open(390, 844, '?bygg=1&blommor=1');
  await tap(p, '.pk-cat[data-id="rosor"]');
  await p.focus('#pk-q'); const counts = [];
  for (const ch of 'gipsort') { await p.keyboard.type(ch); await p.waitForTimeout(40); counts.push((await rows(p)).length); }
  eq(counts, 'gipsort'.split('').map((_, i) => E.search('gipsort'.slice(0, i + 1)).length), 'träfflistan följer sökningen för varje tecken: ' + counts.join(' → '));
  ok(counts.every((c, i) => i === 0 || c <= counts[i - 1]), 'träfflistan krymper bara när man skriver mer');
  eq((await rows(p)).map(x => x.name), ['Gipsört', 'Torkad gipsört'], 'gipsort (utan ö) hittar Gipsört och Torkad gipsört');
  eq(await p.evaluate(() => [...document.querySelectorAll('.pk-crumb')].map(e => e.textContent)), ['Utfyllnad', 'Torkat'], 'varje träff visar vilken kategori den bor i (och sökningen gick över kategorigränsen från Rosor)');
  eq(await p.evaluate(() => [...document.querySelectorAll('.pk-nm mark')].map(e => e.textContent)), ['Gipsört', 'gipsört'], 'träffen markeras i namnet');
  eq(await p.evaluate(() => window.N(document.querySelector('#pk-h').textContent)), 'Sökresultat2', 'rubriken visar antal träffar');
  eq(await p.evaluate(() => document.querySelector('.pk-clear').hidden), false, 'rensa-knappen syns');
  await p.evaluate(() => { document.querySelector('#pk-q').__same = true; });
  await tap(p, '#picker .pk-row:first-child [data-act="pk-toggle"]');
  eq(await p.evaluate(() => document.querySelector('#pk-q').__same === true), true, 'sökfältet byts aldrig ut när man väljer en träff (tangentbordet och markören blir kvar)');
  eq(await p.evaluate(() => document.querySelector('#pk-q').value), 'gipsort', 'sökordet står kvar efter att man valt en blomma, så man kan välja flera träffar');
  eq((await rows(p)).filter(x => x.on).map(x => x.name), ['Gipsört'], 'blomman markeras i träfflistan');
  await tap(p, '.pk-clear'); eq(await p.evaluate(() => window.N(document.querySelector('#pk-h').textContent)), 'Rosor13', 'rensa återgår till vyn man kom från (Rosor)');
  await p.fill('#pk-q', 'brudslöja'); await p.waitForTimeout(60); ok((await rows(p)).some(x => x.name === 'Gipsört'), 'synonym: brudslöja hittar Gipsört');
  await p.fill('#pk-q', 'qzxq'); await p.waitForTimeout(60); ok(await p.evaluate(() => /Ingen blomma matchar/.test(document.querySelector('.pk-none').textContent)), 'tomt resultat förklaras');
  await p.fill('#pk-q', 'ros'); await p.waitForTimeout(60); const rr = await rows(p); eq(rr.length, E.search('ros').length, 'ros: ' + rr.length + ' träffar i hela sortimentet');
  await tap(p, '.pk-back'); eq(await p.evaluate(() => document.querySelector('#pk-q').value), '', 'pilen rensar sökningen'); eq(await p.evaluate(() => window.N(document.querySelector('#pk-h').textContent)), 'Rosor13', '...och visar vyn man kom från');
  ok(p.errs.length === 0, 'inga konsolfel: ' + p.errs.join(' | '));
  await p.context().close();
}

// ---- 8. Hjärtan: favoriter, sparas lokalt, bort-och-tillbaka utan att raderna hoppar
{
  const E = SE.create(); let ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, locale: 'sv-SE', hasTouch: true, isMobile: true, reducedMotion: 'reduce' });
  let p = await open(390, 844, '?bygg=1&blommor=1', { ctx });
  await tap(p, '.pk-cat[data-id="rosor"]');
  const gul = flowerId(E, 'Gul ros 50 cm');
  eq((await rows(p)).find(x => x.id === gul).fav, false, 'Gul ros är inte favorit');
  await tap(p, '#picker [data-act="pk-fav"][data-id="' + gul + '"]');
  eq((await rows(p)).find(x => x.id === gul).fav, true, 'ett tryck på hjärtat gör den till favorit');
  eq((await rows(p)).find(x => x.id === gul).on, false, 'hjärtat väljer inte blomman i buketten');
  await tap(p, '.pk-back'); eq(await p.evaluate(() => document.querySelector('#pk-fav-h .n').textContent), '9', 'översikten visar nio favoriter');
  { const ids = new Set([...D.FLORISTS[0].favorites, gul]); const want8 = E.flowers().filter(f => ids.has(f.id)).map(f => f.name).slice(0, 8); eq(await p.evaluate(() => [...document.querySelectorAll('.chip[data-act="pk-toggle"]')].map(c => c.textContent.trim())), want8, 'favoritknapparna visas i kategoriordning, de första åtta'); }
  ok(await p.evaluate(() => [...document.querySelectorAll('.chip')].some(c => c.textContent.trim() === '+ 1 till')), 'fler än åtta favoriter: knappen "+ 1 till" leder till hela listan');
  await tap(p, '.chip--more'); eq(await p.evaluate(() => window.N(document.querySelector('#pk-h').textContent)), 'Mina favoriter9', 'hela favoritlistan');
  const order = (await rows(p)).map(x => x.name); const sorted = E.flowers().filter(f => (new Set(order)).has(f.name)).map(f => f.name); eq(order, sorted, 'favoriter sorteras i kategoriordning');
  // ta bort ett hjärta: raden ligger kvar tills man lämnar vyn
  await tap(p, '#picker [data-act="pk-fav"][data-id="' + gul + '"]');
  const afterOff = await rows(p); ok(afterOff.some(x => x.id === gul && !x.fav), 'borttagen favorit ligger kvar (tom hjärtikon) så att raderna inte hoppar');
  await tap(p, '#picker [data-act="pk-fav"][data-id="' + gul + '"]'); ok((await rows(p)).some(x => x.id === gul && x.fav), 'ett tryck till ångrar borttagningen');
  await tap(p, '#picker [data-act="pk-fav"][data-id="' + gul + '"]'); await tap(p, '.pk-back'); await tap(p, '.pk-sec .link');
  ok(!(await rows(p)).some(x => x.id === gul), 'efter att man lämnat och kommit tillbaka är den borttagna favoriten borta');
  // sparas lokalt: ladda om
  await tap(p, '#picker [data-act="pk-fav"][data-id="' + flowerId(E, 'Pion') + '"]'); await tap(p, '#picker [data-act="pk-fav"][data-id="' + flowerId(E, 'Pion') + '"]');
  await tap(p, '.pk-back'); await tap(p, '.pk-cat[data-id="huvud"]'); await tap(p, '#picker [data-act="pk-fav"][data-id="' + flowerId(E, 'Hortensia') + '"]');
  await p.reload(); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(200);
  eq(await p.evaluate(() => document.querySelector('#pk-fav-h .n').textContent), '9', 'favoriterna finns kvar efter omladdning (Hortensia tillagd, Gul ros borttagen: 9)');
  ok(await p.evaluate(() => [...document.querySelectorAll('.chip')].some(c => c.textContent.trim() === 'Hortensia') || [...document.querySelectorAll('.chip')].some(c => /till/.test(c.textContent))), 'Hortensia finns i favoriterna');
  // florister
  await tap(p, '.pk-sec .link'); await tap(p, '[data-act="pk-about"]');
  eq(await p.evaluate(() => document.querySelector('[data-act="pk-about"]').getAttribute('aria-expanded')), 'true', 'förklaringen öppnas');
  ok(await p.evaluate(() => /En lista per florist/.test(document.querySelector('.pk-about').textContent) && /Pekar på artikeln/.test(document.querySelector('.pk-about').textContent)), 'förklaringen beskriver att favoriter sparas per florist och pekar på artikeln');
  await tap(p, '[data-act="pk-florist"][data-id="mia"]');
  eq((await rows(p)).length, D.FLORISTS[1].favorites.length, 'Mia har sin egen lista (' + D.FLORISTS[1].favorites.length + ' favoriter)');
  eq(await p.evaluate(() => document.querySelector('.pk-cap b').textContent), 'Mia', 'visar vems lista det är');
  await tap(p, '[data-act="pk-florist"][data-id="elsa"]'); eq((await rows(p)).length, 9, 'Elsas lista är oförändrad när man byter tillbaka');
  await tap(p, '[data-act="pk-fav-clear"]'); eq((await rows(p)).length, 0, 'Töm listan'); ok(await p.evaluate(() => /inga favoriter än/i.test(document.querySelector('.pk-none').textContent)), 'tom lista förklarar hur man lägger till favoriter');
  await tap(p, '[data-act="pk-fav-reset"]'); eq((await rows(p)).length, 8, 'Återställ ger startlistan (8)');
  await p.keyboard.press('Escape'); eq(await p.evaluate(() => document.querySelector('[data-act="pk-about"]').getAttribute('aria-expanded')), 'false', 'Escape stänger förklaringen först');
  ok(p.errs.length === 0, 'inga konsolfel: ' + p.errs.join(' | '));
  await ctx.close();
}

// ---- 9. Historik: tillbaka-knappen stegar tillbaka i blomvalet innan den lämnar bygget
{
  const p = await open(390, 844, '?bygg=1');
  await p.evaluate(() => { const S = window.__studio, j = S.E.jobs()[0]; S.go({ name: 'bygg', ev: j.id, arr: S.E.job(j.id).arrangements[0].id }); });
  const url0 = await p.evaluate(() => location.hash);
  ok(/^#\/jobb\/.+\/.+/.test(url0), 'bygget har en egen adress: ' + url0);
  await tap(p, '.addflowers'); await tap(p, '.pk-cat[data-id="gront"]');
  eq(await p.evaluate(() => window.N(document.querySelector('#pk-h').textContent)), 'Grönt10', 'i kategorin Grönt');
  await p.goBack(); await p.waitForTimeout(150);
  eq(await p.evaluate(() => !!document.querySelector('.pk-cats') && !document.querySelector('#picker').hidden), true, 'tillbaka (svep) går till översikten, blomvalet är kvar öppet');
  await p.goBack(); await p.waitForTimeout(150);
  eq(await p.evaluate(() => document.querySelector('#picker').hidden), true, 'tillbaka igen stänger blomvalet');
  eq(await p.evaluate(() => location.hash), url0, 'och man är kvar i samma bukett (adressen oförändrad)');
  eq(await p.evaluate(() => document.body.classList.contains('locked')), false, 'sidan är inte längre låst');
  await tap(p, '.addflowers'); await tap(p, '.pk-go'); await p.waitForTimeout(150);
  eq(await p.evaluate(() => location.hash), url0, 'Visa mina valda blommor lämnar adressen oförändrad');
  await p.goBack(); await p.waitForTimeout(250);
  eq(await p.evaluate(() => !!document.querySelector('.hem') || location.hash === '#/hem' || location.hash === ''), true, 'efter Visa mina valda blommor lämnar tillbaka bygget helt (ingen kvarglömd blomvalspost): ' + await p.evaluate(() => location.hash));
  ok(p.errs.length === 0, 'inga konsolfel: ' + p.errs.join(' | '));
  await p.context().close();
}

// ---- 10. Tangentbord (mobilens fokusfälla) och Escape
{
  const p = await open(390, 844, '?bygg=1&blommor=1');
  eq(await p.evaluate(() => document.activeElement.id), 'pk-h', 'fokus flyttas till blomvalets rubrik');
  await p.keyboard.press('Tab'); eq(await p.evaluate(() => document.activeElement.className), 'pk-x', 'Tab går vidare till Stäng');
  await p.keyboard.press('Escape'); await p.waitForTimeout(200); eq(await p.evaluate(() => document.querySelector('#picker').hidden), true, 'Escape stänger blomvalet');
  await tap(p, '.addflowers'); await p.fill('#pk-q', 'pion'); await p.keyboard.press('Escape'); await p.waitForTimeout(100);
  eq(await p.evaluate(() => document.querySelector('#pk-q').value + '|' + document.querySelector('#picker').hidden), '|false', 'första Escape rensar sökningen, blomvalet är kvar');
  await p.keyboard.press('Escape'); await p.waitForTimeout(100); eq(await p.evaluate(() => document.querySelector('#picker').hidden), true, 'andra Escape stänger');
  await tap(p, '.addflowers'); await p.evaluate(() => document.activeElement.blur()); await p.keyboard.press('/'); eq(await p.evaluate(() => document.activeElement.id), 'pk-q', 'snedstreck flyttar fokus till sökfältet');
  await p.context().close();
}

// ---- 11. Smala och breda mobiler: inget överlappar eller klipps
for (const [w, h] of [[320, 568], [360, 740], [390, 844], [430, 932], [768, 1024], [844, 390]]) {
  const p = await open(w, h, '?bygg=1&blommor=1');
  const probe = async label => {
    const r = await p.evaluate(() => {
      const out = { ov: document.documentElement.scrollWidth - document.documentElement.clientWidth, clipped: [], scrollOv: 0 };
      const pk = document.querySelector('#picker'), pr = pk.getBoundingClientRect(), sc = document.querySelector('.pk-scroll');
      out.scrollOv = sc.scrollWidth - sc.clientWidth;
      for (const e of pk.querySelectorAll('button,input,h2,h3,.pk-tabs,.pk-cap,.pk-sum,.pk-go')) { const q = e.getBoundingClientRect(); if (!q.width || e.closest('[hidden]') || getComputedStyle(e).display === 'none') continue; if (e.closest('.pk-scroll')) { const s = sc.getBoundingClientRect(); if (q.left < s.left - 1 || q.right > s.right + 1) out.clipped.push((e.className || e.tagName) + ' ' + Math.round(q.left) + '–' + Math.round(q.right)); } else if (q.left < pr.left - 1 || q.right > pr.right + 1) out.clipped.push((e.className || e.tagName) + ' ' + Math.round(q.left) + '–' + Math.round(q.right)); }
      const parts = ['.pk-head', '.pk-search', '.pk-main', '.pk-bar'].map(s => { const e = document.querySelector(s).getBoundingClientRect(); return [e.top, e.bottom]; });
      out.stack = parts.every((x, i) => i === 0 || parts[i - 1][1] <= x[0] + 0.5) && parts[3][1] <= pr.bottom + 0.5;
      out.listH = sc.clientHeight;
      return out;
    });
    ok(r.ov <= 0 && r.scrollOv <= 0 && r.clipped.length === 0 && r.stack && r.listH >= 60, `${w}×${h} ${label}: överflöd ${r.ov}/${r.scrollOv}, klippt ${r.clipped.join(',') || 'inget'}, staplade delar ${r.stack}, listhöjd ${r.listH}`);
  };
  await probe('översikt');
  await tap(p, '.pk-cat[data-id="huvud"]'); await probe('kategori');
  await p.fill('#pk-q', 'trädgårdsros'); await p.waitForTimeout(60); await probe('sök');
  await tap(p, '.pk-clear'); await tap(p, '.pk-back'); await tap(p, '.pk-sec .link'); await tap(p, '[data-act="pk-about"]'); await probe('favoriter med förklaring');
  ok(p.errs.length === 0, `${w}×${h}: inga konsolfel ${p.errs.join(' | ')}`);
  await p.context().close();
}

// ===================================================================== DATOR
for (const [W, H, cols] of [[1000, 800, 1], [1280, 800, 2], [1440, 900, 2], [1920, 1080, 3]]) {
  console.log(`\n=== DATOR ${W} ===`);
  const E = SE.create(); const p = await open(W, H, '?bygg=1');
  eq(await p.evaluate(() => getComputedStyle(document.querySelector('#picker')).display), 'none', 'blomvalet är dolt tills man öppnar det (bukettytan använder hela bredden)');
  await tap(p, '.addflowers');
  eq(await p.evaluate(() => document.querySelector('.ws').classList.contains('is-picking')), true, 'blomvalet ersätter bukettytan');
  eq(await p.evaluate(() => getComputedStyle(document.querySelector('.p-active')).display), 'none', 'bukettytan är dold medan man väljer');
  ok(await p.evaluate(() => document.querySelector('.p-job').getBoundingClientRect().width > 200), 'jobbpanelen är kvar till vänster');
  eq(await p.evaluate(() => document.activeElement.id), 'pk-q', 'sökfältet har fokus direkt');
  eq(await p.evaluate(() => [...document.querySelectorAll('.pk-rail .rail-i .nm')].map(e => N(e.textContent)).join('|')), ['Mina favoriter', 'Rosor', 'Huvudblommor', 'Lökblommor', 'Utfyllnad', 'Grönt', 'Kvistar & bär', 'Torkat', 'Alla blommor'].join('|'), 'kategorispalten har favoriter, sju kategorier och Alla blommor');
  eq(await p.evaluate(() => document.querySelector('.rail-i[aria-current]').dataset.id), 'fav', 'listan börjar med Mina favoriter');
  ok(await p.evaluate(() => /^Mina favoriter/.test(window.N(document.querySelector('.pk-vt').textContent))), 'rubriken över listan visar vyn');
  const lefts = async () => p.evaluate(() => [...new Set([...document.querySelectorAll('#picker .pk-row')].map(r => Math.round(r.getBoundingClientRect().left)))].length);
  await tap(p, '.rail-i[data-id="lok"]');
  eq(await lefts(), cols, `listan har ${cols} spalt(er) vid ${W} px`);
  eq((await rows(p)).length, 16, 'Lökblommor: 16 rader');
  eq(await p.evaluate(() => [...document.querySelectorAll('.pk-grp span:first-child')].map(e => e.textContent)), ['Vårblommor', 'Liljor och kalla', 'Sommarknölar'], 'grupprubriker spänner över alla spalter');
  ok(await p.evaluate(() => [...document.querySelectorAll('.pk-grp')].every(g => g.getBoundingClientRect().width > document.querySelector('#picker .pk-row').getBoundingClientRect().width * 0.9)), 'grupprubrikerna är minst lika breda som en rad');
  const dh = (await rows(p)).map(x => x.h); ok(Math.max(...dh) <= 76 && Math.min(...dh) >= 44, 'radhöjd 44 till 76 px, den högre när prisraden bryts i smal spalt (' + Math.round(Math.min(...dh)) + '–' + Math.round(Math.max(...dh)) + ')');
  ok(await p.evaluate(() => document.querySelector('#picker .pk-scroll').clientHeight > 380), 'listytan är minst 380 px hög (' + await p.evaluate(() => document.querySelector('#picker .pk-scroll').clientHeight) + ')');
  // flerval med ett klick per blomma, bar och pris
  const Ed = SE.create(), jd = Ed.jobs()[0], ad = Ed.job(jd.id).arrangements[0];
  await tap(p, '.rail-i[data-id="fav"]');
  const sel = ['Tulpan', 'Ranunkel', 'Gipsört', 'Ruscus']; for (const n of sel) { await tap(p, '#picker [data-act="pk-toggle"][data-id="' + flowerId(E, n) + '"]'); Ed.addFlower(ad.id, flowerId(E, n)); }
  eq(await p.evaluate(() => document.querySelector('.pk-n').textContent), '8 sorter', 'prisfältet räknar åtta sorter');
  ok((await barPrice(p)).endsWith(N(Ed.arrangement(jd.id, ad.id).price)), 'pris = motorn efter fyra klick: ' + await barPrice(p) + ' / ' + Ed.arrangement(jd.id, ad.id).price);
  // sök över kategorier
  await tap(p, '.rail-i[data-id="gront"]'); await p.fill('#pk-q', 'tulp'); await p.waitForTimeout(60);
  eq((await rows(p)).map(x => x.name), ['Tulpan', 'Tulpan rosa', 'Tulpan vit'], 'sök hittar tulpanerna trots att Grönt är valt');
  eq(await p.evaluate(() => document.querySelector('.rail-i[aria-current]') === null), true, 'ingen kategori är markerad medan man söker');
  await p.keyboard.press('Escape'); await p.waitForTimeout(80); eq(await p.evaluate(() => document.querySelector('#pk-q').value), '', 'Escape rensar sökningen'); eq(await p.evaluate(() => document.querySelector('.rail-i[aria-current]').dataset.id), 'gront', '...och kategorin är tillbaka');
  // layout: inget överlappar
  const L = await p.evaluate(() => { const g = s => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { t: r.top, b: r.bottom, l: r.left, r: r.right }; }; return { head: g('.pk-head'), search: g('.pk-search'), rail: g('.pk-rail'), main: g('.pk-main'), bar: g('.pk-bar'), vw: innerWidth, vh: innerHeight, ov: document.documentElement.scrollWidth - innerWidth }; });
  ok(L.ov <= 0 && L.bar.b <= L.vh + 0.5 && L.rail.r <= L.main.l + 0.5 && L.head.b <= L.rail.t + 0.5 && L.main.b <= L.bar.t + 0.5 && L.search.r <= L.vw, `rail, lista, sök och prisfält överlappar inte och ryms (${W}×${H})`);
  await tap(p, '.pk-go'); await p.waitForTimeout(100);
  eq(await p.evaluate(() => getComputedStyle(document.querySelector('.p-active')).display !== 'none' && getComputedStyle(document.querySelector('#picker')).display === 'none'), true, 'Visa mina valda blommor visar bukettöversikten igen');
  eq(await p.evaluate(() => document.querySelectorAll('.ledger [data-act="item-inc"]').length), 9, 'nio rader med plus/minus: fyra tidigare blommor, eget material och fyra nya blommor, inget förlorat');
  ok((await p.evaluate(() => window.N(document.querySelector('#pb-price').textContent))).replace(/Bekräftat pris |Ungefärligt pris /g, '').includes(N(Ed.arrangement(jd.id, ad.id).price)), 'bukettöversikten visar samma pris som motorn');
  ok(p.errs.length === 0, 'inga konsolfel: ' + p.errs.join(' | '));
  await p.context().close();
}
console.log('\nRESULTAT: ' + pass + ' ok, ' + fail + ' fel'); await b.close(); process.exit(fail ? 1 : 0);
