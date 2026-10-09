import { chromium } from 'playwright-core';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import path from 'node:path';
const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SE = require(ROOT + '/js/studio-engine.js');      // samma motor i Node: facit för jämförelserna
const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
let pass = 0, fail = 0; const bad = [];
const ok = (c, m) => { if (c) pass++; else { fail++; bad.push(m); console.log('  FEL:', m); } };
const eq = (a, e, m) => ok(a === e, m + ' (fick ' + JSON.stringify(a) + ', väntade ' + JSON.stringify(e) + ')');
const NB = ' '; const norm = s => String(s).replace(/ /g, ' ').replace(/\s+/g, ' ').trim();
async function open(w, h, q = '', opts = {}) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, locale: 'sv-SE', hasTouch: w < 600, isMobile: w < 600, reducedMotion: 'reduce', ...opts });
  const p = await ctx.newPage(); p.errs = [];
  p.on('pageerror', e => p.errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/net::|Failed to load resource/.test(m.text())) p.errs.push(m.text()); });
  await p.goto('file://' + ROOT + '/index.html' + q); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(250); return p;
}
const priceText = p => p.evaluate(() => norm(document.querySelector('#pb-price').textContent));
const normPage = `window.norm = s => String(s).replace(/\\u00A0/g,' ').replace(/\\s+/g,' ').trim();`;
const jobsText = p => p.evaluate(() => [...document.querySelectorAll('.job')].map(j => window.norm(j.querySelector('.nm').textContent) + ' | ' + window.norm(j.querySelector('.price').textContent)));

for (const [label, W, H] of [['MOBIL 390', 390, 844], ['DATOR 1440', 1440, 900]]) {
  console.log('\n=== ' + label + ' ===');
  const mobile = W < 1000;
  // ---- 1. Hem: fyra jobb med exakt samma belopp som i appen och i Node-motorn
  let p = await open(W, H); await p.evaluate(normPage);
  const ref = SE.create(); const refJobs = ref.jobs().map(j => norm(j.name) + ' | ' + norm((j.price.mark ? j.price.mark + ' ' : '') + j.price.text + ' ' + j.price.basis));
  const got = (await jobsText(p)).map(s => s.replace(/Bekräftat pris |Ungefärligt pris /g, '').replace(/ +/g, ' '));
  eq(got.length, 4, 'Hem visar fyra jobb');
  got.forEach((g, i) => eq(norm(g).replace(/^(.*?) \| (.*)$/, '$1 | $2'), refJobs[i], 'Hem rad ' + (i + 1) + ' = motorns pris'));
  eq(await p.evaluate(() => [...document.querySelectorAll('.job .price')].map(e => window.norm(e.textContent).replace(/Bekräftat pris |Ungefärligt pris /g, '').replace(/ +/g, ' ')).join(' ; ')),
     '≈ 5 115 kr inkl. moms ; ≈ 1 615 kr inkl. moms ; ✓ 705 kr inkl. moms ; ✓ 448 kr exkl. moms', 'Hem: 5 115 / 1 615 / 705 / 448 exkl. moms som i appen');
  ok(p.errs.length === 0, 'inga konsolfel på Hem: ' + p.errs.join(' | '));
  // ---- 2. Öppna Emma → Brudbukett exakt som i appen
  await p.click('.job >> nth=0'); await p.waitForTimeout(200);
  eq(await p.evaluate(() => location.hash.startsWith('#/jobb/')), true, 'öppnar jobbet (adress ändras)');
  let pr = await priceText(p); ok(/1 615 kr/.test(norm(pr)), 'Brudbukett kostar 1 615 kr: ' + pr);
  await p.click('#pb .pb-main'); await p.waitForTimeout(150);
  const rc = await p.evaluate(() => window.norm(document.querySelector('#receipt').textContent));
  for (const s of ['627,86 kr', '313,93 kr', '350 kr', '1 291,79 kr', '322,95 kr', '1 614,73 kr', '0,27 kr', '1 615 kr']) ok(rc.includes(s), 'kvittot innehåller ' + s);
  await p.keyboard.press('Escape'); await p.waitForTimeout(100);
  eq(await p.evaluate(() => document.querySelector('#receipt').hidden), true, 'Escape stänger kvittot');
  // ---- 3. Plus på Pion ändrar priset som motorn, och Hem visar samma efter Klart
  const E2 = SE.create(); const ev = E2.jobs()[0]; const arr = E2.job(ev.id).arrangements[0]; const pion = E2.arrangement(ev.id, arr.id).items.find(i => i.name === 'Pion');
  E2.setQty(pion.id, 11); const want = E2.arrangement(ev.id, arr.id).price;
  const incSel = '.ledger [data-act="item-inc"] >> nth=0';
  await p.click(incSel); await p.waitForTimeout(120);
  eq(norm(await priceText(p)).replace(/Bekräftat pris |Ungefärligt pris /g, ''), norm(want), 'plus på Pion ger motorns pris ' + want);
  const wantJob = E2.job(ev.id).price.text;
  await p.click('.pb-done'); await p.waitForTimeout(250);
  eq(await p.evaluate(() => location.hash), '#/hem', 'Klart går till Hem');
  const first = (await jobsText(p))[0]; ok(norm(first).includes(norm(wantJob)), 'Hem visar jobbets nya pris ' + wantJob + ': ' + first);
  // ---- 4. Egen sort: lägg till via blomval (mobil: skärm, dator: kolumn)
  await p.click('.job >> nth=0'); await p.waitForTimeout(150);
  if (mobile) { await p.click('.addflowers'); await p.waitForTimeout(350); eq(await p.evaluate(() => document.querySelector('#picker').classList.contains('open')), true, 'blomvalet öppnas på mobil'); }
  const E3 = SE.create(); const ev3 = E3.jobs()[0]; const a3 = E3.job(ev3.id).arrangements[0]; const flowerId = E3.flowers().find(f => f.name === 'Ranunkel').id; E3.setQty(E3.arrangement(ev3.id, a3.id).items.find(i => i.name === 'Pion').id, 11); E3.addFlower(a3.id, flowerId);
  await p.click('#picker [data-act="pk-inc"][data-id="' + flowerId + '"]'); await p.waitForTimeout(150);
  eq(norm(await priceText(p)).replace(/Bekräftat pris |Ungefärligt pris /g, ''), norm(E3.arrangement(ev3.id, a3.id).price), 'tillägg av Ranunkel: pris = motorn (' + E3.arrangement(ev3.id, a3.id).price + ')');
  eq(await p.evaluate(() => document.querySelectorAll('#picker .pk-row.on').length), 5, 'raden markeras som vald (5 sorter i buketten nu)');
  // sök och filter
  await p.fill('#pk-q', 'ros'); await p.waitForTimeout(100);
  eq(await p.evaluate(() => document.querySelectorAll('#pk-list .pk-row').length), 4, 'sökning "ros" ger 4 träffar (3 rosor + Ruscus)');
  await p.fill('#pk-q', ''); await p.click('#picker [data-act="filter"][data-id="Grönt"]'); await p.waitForTimeout(100);
  eq(await p.evaluate(() => document.querySelectorAll('#pk-list .pk-row').length), 3, 'filter Grönt ger 3');
  await p.click('#picker [data-act="filter"][data-id="Alla"]');
  if (mobile) { await p.click('#picker .pk-close'); await p.waitForTimeout(350); eq(await p.evaluate(() => document.querySelector('#picker').classList.contains('open')), false, 'blomvalet stängs'); }
  // ---- 5. Arbete: giltigt och ogiltigt värde
  E3.setLabor(a3.id, '400');
  await p.fill('#labor', '400'); await p.waitForTimeout(100);
  eq(norm(await priceText(p)).replace(/Bekräftat pris |Ungefärligt pris /g, ''), norm(E3.arrangement(ev3.id, a3.id).price), 'arbete 400 kr: pris = motorn');
  const before = norm(await priceText(p)); await p.fill('#labor', 'abc'); await p.waitForTimeout(100);
  eq(await p.getAttribute('#labor', 'aria-invalid'), 'true', 'ogiltigt arbete markeras som fel'); eq(norm(await priceText(p)), before, 'ogiltigt arbete ändrar inte priset');
  await p.fill('#labor', '400');
  // ---- 6. Eget material
  E3.addOwn(a3.id, 'Band', '45');
  await p.click('[data-act="own-toggle"]'); await p.fill('#ownform [name="n"]', 'Band'); await p.fill('#ownform [name="c"]', '45'); await p.click('#ownform button[type="submit"]'); await p.waitForTimeout(150);
  eq(norm(await priceText(p)).replace(/Bekräftat pris |Ungefärligt pris /g, ''), norm(E3.arrangement(ev3.id, a3.id).price), 'eget material Band 45 kr: pris = motorn');
  eq(await p.evaluate(() => [...document.querySelectorAll('.ledger .nm')].some(e => /Band/.test(e.textContent))), true, 'Band finns i listan');
  // ---- 7. Antal likadana
  E3.setCount(a3.id, 2); await p.click('.a-count [data-act="cnt-inc"]'); await p.waitForTimeout(120);
  const arrTxt = await p.evaluate(() => window.norm(document.querySelector('.arr[aria-current] .arr-pr').textContent));
  ok(/× 2/.test(arrTxt), 'arrangemangets rad visar × 2: ' + arrTxt);
  // ---- 8. Ny bukett skapas först vid första blomman
  await p.click('.brand'); await p.waitForTimeout(150);
  const nJobs = (await jobsText(p)).length;
  await p.click('[data-act="new-bouquet"]'); await p.waitForTimeout(150);
  eq(await p.evaluate(() => location.hash), '#/jobb/ny', 'ny bukett öppnas som utkast');
  eq((await p.evaluate(() => window.__studio.E.jobs().length)), nJobs, 'utkastet skapar inget jobb förrän första blomman');
  if (mobile) { await p.click('.addflowers'); await p.waitForTimeout(350); }
  const pion2 = SE.create().flowers().find(f => f.name === 'Pion').id;
  await p.click('#picker [data-act="pk-inc"][data-id="' + pion2 + '"]'); await p.waitForTimeout(150); await p.click('#picker .stp [data-act="pk-inc"]'); await p.waitForTimeout(150);
  const E4 = SE.create(); const d4 = E4.draft(); E4.addFlower(d4.arrId, pion2); E4.addFlower(d4.arrId, pion2);
  eq((await p.evaluate(() => window.__studio.E.jobs().length)), nJobs + 1, 'första blomman skapar jobbet');
  ok(norm(await priceText(p)).replace(/Bekräftat pris |Ungefärligt pris /g, '') === norm(E4.arrangement(d4.eventId, d4.arrId).price), 'ny bukett med 2 Pion: pris = motorn (' + E4.arrangement(d4.eventId, d4.arrId).price + ')');
  // ---- 9. Ta bort (två steg)
  if (mobile) { await p.click('#picker .pk-close'); await p.waitForTimeout(350); }
  await p.click('[data-act="del"]'); await p.waitForTimeout(100);
  eq(await p.evaluate(() => !!document.querySelector('[data-act="del-yes"]')), true, 'bekräftelse visas före borttagning');
  await p.click('[data-act="del-no"]'); await p.waitForTimeout(100);
  eq(await p.evaluate(() => !!document.querySelector('[data-act="del"]')), true, 'Avbryt behåller arrangemanget');
  await p.click('[data-act="del"]'); await p.click('[data-act="del-yes"]'); await p.waitForTimeout(200);
  ok(p.errs.length === 0, 'inga konsolfel under hela flödet: ' + p.errs.join(' | '));
  await p.context().close();

  // ---- 10. Inköpsenhet först, styckpris bara som räknat värde i parentes (nytt krav)
  p = await open(W, H, '?bygg=1'); await p.evaluate(normPage);
  if (mobile) { await p.click('.addflowers'); await p.waitForTimeout(350); }
  const rowTxt = async name => p.evaluate(n => { const r = [...document.querySelectorAll('#picker .pk-row')].find(x => x.querySelector('.nm').textContent.trim().startsWith(n)); return r ? [r.querySelector('.u').textContent.trim(), (r.querySelector('.d') || {}).textContent.trim()] : null; }, name);
  eq((await rowTxt('Pion')).join(' | ').replace(/ /g, ' '), '165 kr/bunt | Bunt om 5 st · (33 kr/st)', 'blomlista Pion: 165 kr/bunt, Bunt om 5 st · (33 kr/st)');
  eq((await rowTxt('Rosa ros')).join(' | ').replace(/ /g, ' '), '99 kr/10-pack | (9,90 kr/st)', 'blomlista Rosa ros: 99 kr/10-pack, (9,90 kr/st)');
  eq((await rowTxt('Hortensia')).join(' | ').replace(/ /g, ' '), '39 kr/st | Säljs styckvis', 'blomlista Hortensia: 39 kr/st, Säljs styckvis');
  const offenders = await p.evaluate(() => { const bad = []; for (const e of document.querySelectorAll('#picker .sub, .ledger .sub, .ik .sub')) { const u = window.norm((e.querySelector('.u') || {}).textContent || ''), all = window.norm(e.textContent); const rest = all.replace(/\([^)]*\)/g, '').replace(u, ''); if (/kr\/st/.test(rest)) bad.push(all); if (/kr\/st$/.test(u) && !/Säljs styckvis/.test(all)) bad.push('styckpris utan "Säljs styckvis": ' + all); } return bad; });
  eq(offenders.length, 0, 'styckpris visas aldrig utanför parentes (utom där varan verkligen säljs styckvis): ' + offenders.slice(0, 2).join(' || '));
  if (mobile) await p.click('#picker .pk-close');
  await p.waitForTimeout(350);
  const buyOf = async name => p.evaluate(n => { const r = [...document.querySelectorAll('.ledger .row')].find(x => x.querySelector('.nm') && x.querySelector('.nm').textContent.trim().startsWith(n)); return r ? window.norm((r.querySelector('.buy') || {}).textContent || '') : null; }, name);
  const price0 = norm(await priceText(p));
  eq(await buyOf('Rosa ros'), 'Köper 1 × 10-pack · 99 kr', '6 rosor: inköp av ett helt 10-pack');
  // stepper: 6 → 10 rosor (4 klick), pris och inköp oförändrade
  for (let i = 0; i < 4; i++) await p.click('.ledger .row:has-text("Rosa ros") [data-act="item-inc"]');
  eq(await buyOf('Rosa ros'), 'Köper 1 × 10-pack · 99 kr', '10 rosor: fortfarande ett 10-pack');
  eq(norm(await priceText(p)), price0, '10 rosor kostar lika som 6 (hela förpackningen räknas)');
  await p.click('.ledger .row:has-text("Rosa ros") [data-act="item-inc"]');
  eq(await buyOf('Rosa ros'), 'Köper 2 × 10-pack · 198 kr', '11 rosor: två 10-pack');
  ok(norm(await priceText(p)) !== price0, '11 rosor ger högre pris: ' + norm(await priceText(p)));
  eq(await p.evaluate(() => window.norm(document.querySelector('.ledger-h span').textContent)), 'Antal stjälkar', 'liggaren säger att siffrorna är antal stjälkar');
  // delad förpackning
  eq(await buyOf('Eukalyptus'), 'Hela jobbet köper 1 bunt · 79 kr', 'delad bunt visas som inköp för hela jobbet');
  // ---- 11. Inköpsöversikten = appens plan
  await p.click(mobile ? '.jobline .link' : '.jobtotal .link'); await p.waitForTimeout(200);
  eq(await p.evaluate(() => location.hash.startsWith('#/inkop/')), true, 'inköpsöversikten öppnas');
  const ik = await p.evaluate(() => ({ rows: [...document.querySelectorAll('.ik-row')].map(r => window.norm(r.textContent)), sum: window.norm(document.querySelector('.ik-total').textContent), notes: [...document.querySelectorAll('.ik-note')].map(e => window.norm(e.textContent)) }));
  eq(ik.rows.length, 8, 'inköp: åtta varor');
  ok(ik.rows[0].includes('Pion') && ik.rows[0].includes('165 kr/bunt') && ik.rows[0].includes('Köper 2 buntar (10 st)') && ik.rows[0].includes('330 kr'), 'inköp Pion: 2 buntar (10 st), 330 kr: ' + ik.rows[0]);
  ok(ik.rows[1].includes('Rosa ros') && /Köper 2 × 10-pack \(20 st\)/.test(ik.rows[1]) && ik.rows[1].includes('198 kr'), 'inköp Rosa ros (11 st): 2 × 10-pack, 198 kr: ' + ik.rows[1]);
  ok(/Summa inköp/i.test(await p.evaluate(() => document.querySelector('.ik-sum').textContent)), 'inköp har en summa');
  ok(ik.notes.some(n => /Det ingår i kundpriset/.test(n)) && ik.notes.some(n => /Sidenband/.test(n)), 'inköp förklarar överskottet och eget material');
  ok(p.errs.length === 0, 'inga konsolfel i inköpsflödet: ' + p.errs.join(' | '));
  await p.context().close();
  // ---- 12. Inköpsöversikten i grundtillståndet = appens siffror (1 611 kr, 36 stjälkar, 365 kr)
  p = await open(W, H, '#/hem'); await p.evaluate(normPage);
  await p.evaluate(() => { const j = window.__studio.E.jobs()[0]; window.__studio.go({ name: 'inkop', ev: j.id }); }); await p.waitForTimeout(200);
  const ik2 = await p.evaluate(() => ({ sum: window.norm(document.querySelector('.ik-total').textContent), note: window.norm(document.querySelector('.ik-note').textContent) }));
  eq(ik2.sum, '1 611 kr', 'summa inköp 1 611 kr som i appen'); ok(/36 stjälkar, värde 365 kr/.test(ik2.note), 'överskott 36 stjälkar, 365 kr som i appen: ' + ik2.note);
  await p.context().close();
}
console.log('\nRESULTAT: ' + pass + ' ok, ' + fail + ' fel'); if (fail) console.log(bad.join('\n'));
await b.close(); process.exit(fail ? 1 : 0);
