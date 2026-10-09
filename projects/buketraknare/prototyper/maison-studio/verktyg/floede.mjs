// Flödestester för Maison Studio: gör som en florist gör, i riktig Chromium, och jämför varje belopp med prismotorn i Node.
// Körs på mobil (390×664) och dator (1440×900). Kör: node verktyg/floede.mjs
import { launch, open, suite, SE, N, pure, tap, visible, barPrice } from './lib/test-lib.mjs';
const T = suite('flöden'); const { ok, eq } = T;
const b = await launch();

for (const [label, W, H] of [['MOBIL 390×664', 390, 664], ['DATOR 1440×900', 1440, 900]]) {
  console.log('\n=== ' + label + ' ===');
  const single = W < 900;
  const eng = SE.create();
  const refJob = i => { const j = eng.jobs()[i]; return N((j.price.mark ? j.price.mark + ' ' : '') + j.price.text + ' ' + j.price.basis); };

  // ---- 1. Hem: fyra jobb, samma belopp som i appen och i motorn; en tydlig väg till ny bukett
  let p = await open(b, W, H);
  const jobs = await p.$$eval('.job', es => es.map(e => ({ nm: window.N(e.querySelector('.nm').textContent), pr: window.N(e.querySelector('.price').textContent) })));
  eq(jobs.length, 4, 'Hem visar fyra jobb');
  eq(jobs.map(j => pure(j.pr)).join(' ; '), '5 115 kr inkl. moms ; 1 615 kr inkl. moms ; 705 kr inkl. moms ; 448 kr exkl. moms', 'Hem: 5 115 / 1 615 / 705 / 448 exkl. moms som i appen');
  jobs.forEach((j, i) => eq(pure(j.pr), pure(refJob(i)), 'Hem rad ' + (i + 1) + ' = motorns pris'));
  ok(await visible(p, '[data-act=new]'), 'Hem: "Ny bukett" syns direkt utan rullning');
  eq(await p.$$eval('.nav button', es => es.map(e => e.textContent).join(',')), 'Hem,Bukett,Inköp', 'huvudmeny: Hem, Bukett, Inköp');
  eq(await p.$eval('.nav [aria-current]', e => e.textContent), 'Hem', 'Hem är markerad');
  ok(p.errs.length === 0, 'inga konsolfel på Hem: ' + p.errs.join(' | '));

  // ---- 2. Öppna Emma → Brudbukett exakt som i appen, kvittot stämmer
  await tap(p, '.job >> nth=0');
  ok((await p.evaluate(() => location.hash)).startsWith('#/bukett/'), 'öppnar jobbet (adress ändras)');
  eq(await p.$eval('.nav [aria-current]', e => e.textContent), 'Bukett', 'Bukett är markerad');
  ok(/1 615 kr/.test(await barPrice(p)), 'Brudbukett kostar 1 615 kr: ' + await barPrice(p));
  eq(await p.$eval('.bq-title', e => e.textContent), 'Brudbukett', 'rubriken visar arrangemangets namn');
  await tap(p, '[data-act=receipt]');
  const rc = await p.$eval('#receipt', e => window.N(e.textContent));
  for (const s of ['627,86 kr', '313,93 kr', '350 kr', '1 291,79 kr', '322,95 kr', '1 614,73 kr', '0,27 kr', '1 615 kr']) ok(rc.includes(s), 'kvittot innehåller ' + s);
  await tap(p, '[data-act=receipt]');
  eq(await p.$('#receipt'), null, 'kvittot går att stänga');

  // ---- 3. Plus på Pion ändrar priset som motorn, direkt i prisfältet
  const E2 = SE.create(); const ev = E2.jobs()[0]; const arr = E2.job(ev.id).arrangements[0]; const pion = E2.arrangement(ev.id, arr.id).items.find(i => i.name === 'Pion');
  E2.setQty(pion.id, 11); const want = E2.arrangement(ev.id, arr.id).price;
  await tap(p, '.row:has-text("Pion") [data-act=item-inc]');
  eq(pure(await barPrice(p)), N(want), 'plus på Pion ger motorns pris ' + want);
  ok(await visible(p, '#bar'), 'prisfältet syns hela tiden under ändringen');
  const wantJob = E2.job(ev.id).price.text;
  await tap(p, '[data-act=nav-hem]');
  eq(await p.evaluate(() => location.hash), '#/hem', 'Hem-fliken går till Hem');
  ok(N(await p.$eval('.job .price', e => e.textContent)).includes(N(wantJob)), 'Hem visar jobbets nya pris ' + wantJob);

  // ---- 4. Lägg till en blomma via blomvalet; tidigare val finns kvar
  await p.close();
  p = await open(b, W, H, '?bukett=1');
  const ran = SE.create().flowers().find(f => f.name === 'Ranunkel').id;
  const E3b = SE.create(); const e3 = E3b.jobs()[0]; const a3b = E3b.job(e3.id).arrangements[0]; E3b.addFlower(a3b.id, ran);
  if (single) await tap(p, '#bar .bar-go');
  ok(await visible(p, '#pk-q'), single ? 'Lägg till blommor öppnar blomvalet' : 'blomvalet syns bredvid buketten');
  await p.fill('#pk-q', 'ranunk'); await p.waitForTimeout(100);
  await tap(p, '.pk-pick[data-id="' + ran + '"]');
  eq(await p.getAttribute('.pk-pick[data-id="' + ran + '"]', 'aria-checked'), 'true', 'raden markeras som vald');
  if (single) { ok(/Visa min bukett \(\d+\)/.test(await p.$eval('#bar .bar-go', e => e.textContent)), 'kommandot "Visa min bukett" visar antal sorter'); }
  eq(pure(await barPrice(p)), N(E3b.arrangement(e3.id, a3b.id).price), 'prisfältet följer med direkt vid val av Ranunkel (' + E3b.arrangement(e3.id, a3b.id).price + ')');
  if (single) await tap(p, '#bar .bar-go');
  ok(await visible(p, '.bq-title'), 'bukettöversikten syns');
  eq(await p.$$eval('.row .nm', es => es.filter(e => /Ranunkel/.test(e.textContent)).length), 1, 'Ranunkel finns i bukettöversikten');
  eq(await p.$$eval('.row [data-act=item-inc]', es => es.length), 6, 'sex rader med plus/minus (fyra tidigare, Ranunkel, eget material)');
  eq(await p.$$eval('.row.fresh', es => es.length) > 0, true, 'den nya blomman lyfts fram en stund');

  // ---- 5. Arbete: giltigt och ogiltigt värde
  E3b.setLabor(a3b.id, '400');
  await p.fill('#labor', '400'); await p.waitForTimeout(100);
  eq(pure(await barPrice(p)), N(E3b.arrangement(e3.id, a3b.id).price), 'arbete 400 kr: pris = motorn');
  const before = await barPrice(p); await p.fill('#labor', 'abc'); await p.waitForTimeout(100);
  eq(await p.getAttribute('#labor', 'aria-invalid'), 'true', 'ogiltigt arbete markeras som fel'); eq(await barPrice(p), before, 'ogiltigt arbete ändrar inte priset');
  await p.fill('#labor', '400');

  // ---- 6. Eget material
  E3b.addOwn(a3b.id, 'Band', '45');
  await tap(p, '[data-act=own-toggle]'); await p.fill('#ownform [name=n]', 'Band'); await p.fill('#ownform [name=c]', '45'); await tap(p, '#ownform [data-act=own-add]');
  eq(pure(await barPrice(p)), N(E3b.arrangement(e3.id, a3b.id).price), 'eget material Band 45 kr: pris = motorn');
  ok(await p.$$eval('.row .nm', es => es.some(e => /Band/.test(e.textContent))), 'Band finns i listan');
  await tap(p, '[data-act=own-toggle]'); await p.fill('#ownform [name=n]', ''); await tap(p, '#ownform [data-act=own-add]');
  ok(await p.$('.toast') !== null, 'ofullständigt eget material ger ett begripligt meddelande');

  // eget material och namnbyte med Enter (formulär kan vara blockerade i en inbäddad sida: inget får bero på submit)
  if (!(await p.$('#ownform'))) await tap(p, '[data-act=own-toggle]');
  await p.fill('#ownform [name=n]', 'Snöre'); await p.fill('#ownform [name=c]', '12,50'); await p.press('#ownform [name=c]', 'Enter'); await p.waitForTimeout(90);
  ok(await p.$$eval('.row .nm', es => es.some(e => /Snöre/.test(e.textContent))), 'Enter i eget material lägger till raden');
  await tap(p, '[data-act=rename]'); await p.fill('#arr-name', 'Brudbukett lång version'); await p.press('#arr-name', 'Enter'); await p.waitForTimeout(90);
  eq(await p.$eval('.bq-title', e => e.textContent), 'Brudbukett lång version', 'Enter i namnfältet sparar namnet');
  await tap(p, '[data-act=rename]'); await p.fill('#arr-name', 'Brudbukett'); await tap(p, '[data-act=rename-save]');
  eq(await p.$eval('.bq-title', e => e.textContent), 'Brudbukett', 'Spara byter namn');
  await tap(p, '[data-act=rename]'); await p.fill('#arr-name', 'Annat namn'); await tap(p, '[data-act=rename-cancel]');
  eq(await p.$eval('.bq-title', e => e.textContent), 'Brudbukett', 'Avbryt behåller namnet');
  // ---- 7. Antal likadana
  await tap(p, '.row:has-text("Antal likadana") [data-act=cnt-inc]');
  ok(/× 2|Totalt/.test(await p.$eval('.row:has-text("Antal likadana")', e => e.textContent)), 'antal likadana 2 visar totalpris');
  if (!single) ok(/× 2/.test(await p.$eval('.arrs [aria-current]', e => window.N(e.textContent))), 'jobbpanelens rad visar × 2');

  // ---- 8. Ny bukett skapas först vid första blomman
  await tap(p, '[data-act=nav-hem]');
  const nJobs = await p.$$eval('.job', es => es.length);
  await tap(p, '[data-act=new]');
  eq(await p.evaluate(() => location.hash), '#/bukett/ny', 'ny bukett öppnas som utkast');
  eq(await p.evaluate(() => window.__studio.E.jobs().length), nJobs, 'utkastet skapar inget jobb förrän första blomman');
  ok(await visible(p, '#pk-q'), 'Ny bukett öppnar blomvalet direkt (inget tomt läge)');
  if (single) eq(await p.$eval('#bar .bar-go', e => e.disabled), true, '"Visa min bukett" är avstängd innan något är valt');
  const pionId = SE.create().flowers().find(f => f.name === 'Pion').id;
  await p.fill('#pk-q', 'pion'); await p.waitForTimeout(100);
  await tap(p, '.pk-pick[data-id="' + pionId + '"]');
  eq(await p.evaluate(() => window.__studio.E.jobs().length), nJobs + 1, 'första blomman skapar jobbet');
  ok(await p.evaluate(() => /^#\/bukett\/[^/]+\/[^/]+$/.test(location.hash)), 'adressen följer med till det nya jobbet');
  if (single) await tap(p, '#bar .bar-go');
  await tap(p, '.row:has-text("Pion") [data-act=item-inc]');
  const E4 = SE.create(); const d4 = E4.draft(); E4.addFlower(d4.arrId, pionId); E4.addFlower(d4.arrId, pionId);
  eq(pure(await barPrice(p)), N(E4.arrangement(d4.eventId, d4.arrId).price), 'ny bukett med 2 Pion: pris = motorn (' + E4.arrangement(d4.eventId, d4.arrId).price + ')');

  // ---- 9. Ta bort (två steg)
  await tap(p, '[data-act=del]'); ok(await p.$('[data-act=del-yes]') !== null, 'bekräftelse visas före borttagning');
  await tap(p, '[data-act=del-no]'); ok(await p.$('[data-act=del]') !== null, 'Avbryt behåller arrangemanget');
  await tap(p, '[data-act=del]'); await tap(p, '[data-act=del-yes]');
  eq(await p.evaluate(() => location.hash), '#/hem', 'när sista arrangemanget tas bort går appen till Hem');
  eq(await p.$$eval('.job', es => es.length), nJobs, 'jobbet försvann med sitt sista arrangemang');
  ok(p.errs.length === 0, 'inga konsolfel under hela flödet: ' + p.errs.join(' | '));
  await p.context().close();

  // ---- 10. Inköpsenhet först, styckpris bara som räknat värde i parentes; stjälkar och förpackningar hålls isär
  p = await open(b, W, H, '?blommor=1');
  await tap(p, single ? '.selbtn-view' : '.chip[data-id=all]'); if (single) await tap(p, '.tile[data-id=all]');
  const rowTxt = name => p.evaluate(n => { const r = [...document.querySelectorAll('#pk-scroll .pk-row')].find(x => x.querySelector('.pk-nm').textContent.trim().startsWith(n)); return r ? window.N(r.querySelector('.u').textContent + ' | ' + r.querySelector('.d').textContent) : null; }, name);
  eq(await rowTxt('Pion'), '165 kr/bunt | Bunt om 5 st · (33 kr/st)', 'blomlista Pion: 165 kr/bunt, Bunt om 5 st · (33 kr/st)');
  eq(await rowTxt('Rosa ros'), '99 kr/10-pack | (9,90 kr/st)', 'blomlista Rosa ros: 99 kr/10-pack, (9,90 kr/st)');
  eq(await rowTxt('Hortensia'), '39 kr/st | Säljs styckvis', 'blomlista Hortensia: 39 kr/st, Säljs styckvis');
  eq(await rowTxt('Magnolia'), '119 kr/bunt | Bunt om 3 st · (≈ 39,67 kr/st)', 'blomlista Magnolia: styckpriset som inte går jämnt upp markeras med ≈');
  const offenders = await p.evaluate(() => { const bad = []; for (const e of document.querySelectorAll('.pk-l2')) { const u = window.N((e.querySelector('.u') || {}).textContent || ''), all = window.N(e.textContent); const rest = all.replace(/\([^)]*\)/g, '').replace(u, ''); if (/kr\/st/.test(rest)) bad.push(all); if (/kr\/st$/.test(u) && !/Säljs styckvis/.test(all)) bad.push('styckpris utan "Säljs styckvis": ' + all); } return bad; });
  eq(offenders.length, 0, 'styckpris visas aldrig utanför parentes (utom där varan säljs styckvis): ' + offenders.slice(0, 2).join(' || '));
  await p.close();
  p = await open(b, W, H, '?bukett=1');
  const buyOf = name => p.evaluate(n => { const r = [...document.querySelectorAll('.row')].find(x => x.querySelector('.nm') && x.querySelector('.nm').textContent.trim().startsWith(n)); return r ? window.N((r.querySelector('.buy') || {}).textContent || '') : null; }, name);
  const price0 = await barPrice(p);
  eq(await buyOf('Rosa ros'), 'Köper 1 × 10-pack · 99 kr', '6 rosor: inköp av ett helt 10-pack');
  for (let i = 0; i < 4; i++) await p.click('.row:has-text("Rosa ros") [data-act=item-inc]');
  await p.waitForTimeout(60);
  eq(await buyOf('Rosa ros'), 'Köper 1 × 10-pack · 99 kr', '10 rosor: fortfarande ett 10-pack');
  eq(await barPrice(p), price0, '10 rosor kostar lika som 6 (hela förpackningen räknas)');
  await tap(p, '.row:has-text("Rosa ros") [data-act=item-inc]');
  eq(await buyOf('Rosa ros'), 'Köper 2 × 10-pack · 198 kr', '11 rosor: två 10-pack');
  ok(await barPrice(p) !== price0, '11 rosor ger högre pris: ' + await barPrice(p));
  eq(await p.$eval('.bq-h span', e => e.textContent), 'Antal stjälkar', 'översikten säger att siffrorna är antal stjälkar');
  eq(await buyOf('Eukalyptus'), 'Hela jobbet köper 1 bunt · 79 kr', 'delad bunt visas som inköp för hela jobbet');
  eq(await p.$$eval('.row .stp', es => es.filter(e => /^Antal stjälkar/.test(e.getAttribute('aria-label'))).length), 4, 'steppers för varor heter "Antal stjälkar …"');

  // ---- 11. Inköp nås från Bukett (länk och flik) och är jobbets plan
  await tap(p, '.jobline .link');
  ok((await p.evaluate(() => location.hash)).startsWith('#/inkop/'), 'inköpsöversikten öppnas från bukettens jobbrad');
  eq(await p.$eval('.nav [aria-current]', e => e.textContent), 'Inköp', 'Inköp är markerad');
  const ik = await p.evaluate(() => ({ rows: [...document.querySelectorAll('.ik-row')].map(r => window.N(r.textContent)), sum: window.N(document.querySelector('.ik-bar .bar-price').textContent), notes: [...document.querySelectorAll('.ik-note')].map(e => window.N(e.textContent)) }));
  eq(ik.rows.length, 8, 'inköp: åtta varor');
  ok(ik.rows[0].includes('Pion') && ik.rows[0].includes('165 kr/bunt') && ik.rows[0].includes('Köper 2 buntar (10 st)') && ik.rows[0].includes('330 kr'), 'inköp Pion: 2 buntar (10 st), 330 kr: ' + ik.rows[0]);
  ok(ik.rows[1].includes('Rosa ros') && /Köper 2 × 10-pack \(20 st\)/.test(ik.rows[1]) && ik.rows[1].includes('198 kr'), 'inköp Rosa ros (11 st): 2 × 10-pack, 198 kr: ' + ik.rows[1]);
  ok(ik.notes.some(n => /Det ingår i kundpriset/.test(n)) && ik.notes.some(n => /Sidenband/.test(n)), 'inköp förklarar överskottet och eget material');
  ok(await visible(p, '.ik-bar .bar-go'), '"Till bukett" syns på Inköp');
  await tap(p, '.ik-bar .bar-go');
  eq(await p.$eval('.nav [aria-current]', e => e.textContent), 'Bukett', '"Till bukett" går tillbaka till buketten');
  ok(p.errs.length === 0, 'inga konsolfel i inköpsflödet: ' + p.errs.join(' | '));
  await p.context().close();

  // ---- 12. Inköp i grundtillståndet = appens siffror (1 611 kr, 36 stjälkar, 365 kr), också via menyflik och jobbväljare
  p = await open(b, W, H, '');
  await tap(p, '.nav [data-act=nav-inkop]');
  const ik2 = await p.evaluate(() => ({ sum: window.N(document.querySelector('.ik-bar .bar-price').textContent), note: window.N(document.querySelector('.ik-note').textContent) }));
  eq(ik2.sum, '1 611 kr', 'summa inköp 1 611 kr som i appen'); ok(/36 stjälkar, värde 365 kr/.test(ik2.note), 'överskott 36 stjälkar, 365 kr som i appen: ' + ik2.note);
  await tap(p, '[data-act=menu-job]'); ok(await visible(p, '.menu'), 'jobbväljaren öppnas');
  await tap(p, '.menu [data-act=pick-job] >> nth=1');
  ok(/Karin Lindgren/.test(await p.$eval('.selbtn .v', e => e.textContent)), 'Inköp byter jobb via väljaren');
  await p.close();

  // ---- 13. KÄRNFLÖDET: ny bukett, fem favoriter, ändra antal, lägg till fler, inget går förlorat, kundpris och inköp
  p = await open(b, W, H, '');
  await tap(p, '[data-act=new]');
  const favNames = await p.$$eval('.pk-row .pk-nm', es => es.map(e => e.textContent));
  eq(await p.$eval('.selbtn-view .v, .chip[aria-pressed=true]', e => window.N(e.textContent)).then(s => /Favoriter|Mina favoriter/.test(s)), true, 'blomvalet öppnar på Mina favoriter');
  ok(favNames.length >= 5, 'minst fem favoriter att välja bland (' + favNames.length + ')');
  const five = await p.$$eval('.pk-pick', es => es.slice(0, 5).map(e => e.dataset.id));
  const E5 = SE.create(); const d5 = E5.draft();
  for (const id of five) { await p.click('.pk-pick[data-id="' + id + '"]'); E5.addFlower(d5.arrId, id); }
  await p.waitForTimeout(80);
  eq(await p.$$eval('.pk-pick[aria-checked=true]', es => es.length), 5, 'fem blommor markerade med fem tryck (ett tryck per blomma)');
  eq(pure(await barPrice(p)), N(E5.arrangement(d5.eventId, d5.arrId).price), 'prisfältet visar kundpris för de fem: ' + E5.arrangement(d5.eventId, d5.arrId).price);
  if (single) { ok(/Visa min bukett \(5\)/.test(await p.$eval('#bar .bar-go', e => e.textContent)), 'tydligt kommando: "Visa min bukett (5)"'); await tap(p, '#bar .bar-go'); }
  eq(await p.$$eval('.row .nm', es => es.filter(e => e.querySelector('.sw') && !/Antal/.test(e.textContent)).length), 5, 'bukettöversikten visar de fem sorterna');
  // ändra antal: första sorten till 12 stjälkar, andra till 3
  const rows = await p.$$eval('.row', es => es.filter(e => e.querySelector('[data-act=item-inc]') && e.querySelector('.sw')).map(e => ({ id: e.querySelector('[data-act=item-inc]').dataset.id, name: e.querySelector('.nm').textContent.trim() })));
  const items = E5.arrangement(d5.eventId, d5.arrId).items;
  for (let i = 0; i < 11; i++) { await p.click('.row:has([data-act=item-inc][data-id="' + rows[0].id + '"]) [data-act=item-inc]'); }
  for (let i = 0; i < 2; i++) { await p.click('.row:has([data-act=item-inc][data-id="' + rows[1].id + '"]) [data-act=item-inc]'); }
  await p.waitForTimeout(60);
  E5.setQty(items[0].id, 12); E5.setQty(items[1].id, 3);
  eq(pure(await barPrice(p)), N(E5.arrangement(d5.eventId, d5.arrId).price), 'efter ändrade antal visas motorns kundpris direkt: ' + E5.arrangement(d5.eventId, d5.arrId).price);
  // lägg till fler utan att tappa något
  if (single) await tap(p, '#bar .bar-go');
  eq(await p.$$eval('.pk-pick[aria-checked=true]', es => es.length), 5, 'tillbaka i blomvalet: de fem är fortfarande markerade');
  await tap(p, single ? '.selbtn-view' : '.chip[data-id=gront]'); if (single) await tap(p, '.tile[data-id=gront]');
  const grn = await p.$eval('.pk-pick[aria-checked=false]', e => e.dataset.id);
  await tap(p, '.pk-pick[data-id="' + grn + '"]'); E5.addFlower(d5.arrId, grn);
  eq(pure(await barPrice(p)), N(E5.arrangement(d5.eventId, d5.arrId).price), 'en sjätte blomma från annan kategori: pris = motorn');
  if (single) await tap(p, '#bar .bar-go');
  eq(await p.$$eval('.row [data-act=item-inc]', es => es.length), 6, 'alla sex sorter finns kvar, inget har tappats');
  eq(await p.$eval('.row:has([data-act=item-inc][data-id="' + rows[0].id + '"]) output', e => e.textContent), '12', 'antalet 12 stjälkar finns kvar');
  // inköpsbehovet
  await tap(p, '.jobline .link, [data-act=nav-inkop] >> nth=0');
  const pl = E5.purchase(d5.eventId);
  eq(await p.$eval('.ik-bar .bar-price', e => window.N(e.textContent)), N(pl.sum), 'inköpssumman för nya buketten = motorn (' + pl.sum + ')');
  eq(await p.$$eval('.ik-row', es => es.length), pl.rows.length, 'inköpslistan har en rad per vara (' + pl.rows.length + ')');
  ok(p.errs.length === 0, 'inga konsolfel i kärnflödet: ' + p.errs.join(' | '));
  await p.context().close();
}

// ---------- Blomvalet i detalj (mobil och dator) ----------
for (const [label, W, H] of [['MOBIL 390×664', 390, 664], ['DATOR 1440×900', 1440, 900]]) {
  console.log('\n=== Blomval ' + label + ' ===');
  const single = W < 900;
  const eng = SE.create();
  const fl = id => eng.flowers().find(f => f.id === id);
  const pick = async (p, id) => { await p.click('.pk-pick[data-id="' + id + '"]'); await p.waitForTimeout(60); };
  const openCat = async (p, id) => { if (single) { await tap(p, '.selbtn-view'); await tap(p, '.tile[data-id="' + id + '"]'); } else await tap(p, '.chip[data-id="' + id + '"]'); };
  const names = p => p.$$eval('.pk-nm', es => es.map(e => e.textContent.trim()));
  let p = await open(b, W, H, '?blommor=1');
  // kategorier: en hem per blomma, alla 82 finns i Alla, kategorierna är tydliga
  const cats = eng.categories();
  eq(cats.length, 7, 'sju tydliga kategorier');
  eq(cats.reduce((s, c) => s + c.count, 0), eng.flowers().length, 'varje blomma hör till exakt en kategori');
  for (const c of cats) { await openCat(p, c.id); eq((await names(p)).length, c.count, 'kategorin ' + c.name + ' visar ' + c.count + ' blommor'); }
  await openCat(p, 'all'); eq((await names(p)).length, 82, 'Alla visar 82 blommor');
  // global sökning: oberoende av vald kategori, utan diakritik, träffen markeras
  await openCat(p, 'torkat');
  await p.fill('#pk-q', 'gipsort'); await p.waitForTimeout(120);
  ok((await names(p)).includes('Gipsört'), 'sökning "gipsort" hittar Gipsört (utan å/ä/ö) trots att Torkat är vald');
  ok(await p.$('.pk-nm mark') !== null, 'träffen markeras i namnet');
  ok(await p.$$eval('.pk-crumb', es => es.length > 0), 'sökresultat visar vilken kategori varje träff hör till');
  await tap(p, '[data-act=pk-clear]'); eq(await p.$eval('#pk-q', e => e.value), '', 'Rensa tömmer sökfältet'); eq(await p.evaluate(() => document.activeElement.id), 'pk-q', 'fokus blir kvar i sökfältet');
  await p.fill('#pk-q', 'qqqq'); await p.waitForTimeout(120); ok(await visible(p, '.pk-empty'), 'ingen träff ger ett begripligt tomläge');
  await p.keyboard.press('Escape'); await p.waitForTimeout(80); eq(await p.$eval('#pk-q', e => e.value), '', 'Escape rensar sökningen');
  // hjärtan: lägg till, ligger kvar tills man lämnar vyn, per florist, överlever omladdning
  await openCat(p, 'rosor');
  const rid = (await p.$$eval('.pk-pick', es => es.map(e => e.dataset.id)))[0];
  const hearted = async (p, id) => (await p.getAttribute('.pk-fav[data-id="' + id + '"]', 'aria-pressed')) === 'true';
  const was = await hearted(p, rid); await tap(p, '.pk-fav[data-id="' + rid + '"]'); eq(await hearted(p, rid), !was, 'hjärtat växlar favorit');
  await tap(p, '.pk-fav[data-id="' + rid + '"]'); eq(await hearted(p, rid), was, 'hjärtat växlar tillbaka');
  await openCat(p, 'fav'); const favBefore = (await names(p)).length;
  const fid = await p.$eval('.pk-pick', e => e.dataset.id);
  await tap(p, '.pk-fav[data-id="' + fid + '"]');
  eq((await names(p)).length, favBefore, 'bortvald favorit ligger kvar i listan tills du lämnar vyn (inget hoppar)');
  await openCat(p, 'rosor'); await openCat(p, 'fav'); eq((await names(p)).length, favBefore - 1, 'när vyn lämnats är favoriten borta');
  await tap(p, '[data-act=pk-about]'); ok(await visible(p, '#about'), '"Så sparas favoriter" förklarar per-florist-modellen');
  const aboutTxt = await p.$eval('#about', e => window.N(e.textContent)); ok(/En lista per florist/.test(aboutTxt) && /syns på både telefon och dator/.test(aboutTxt), 'förklaringen nämner florist och enheter');
  const first0 = await names(p);
  const fl2 = await p.$$eval('[data-act=pk-florist]', es => es.map(e => ({ id: e.dataset.id, on: e.getAttribute('aria-pressed') })));
  await tap(p, '[data-act=pk-florist][aria-pressed=false]'); const second = await names(p);
  ok(second.join() !== first0.join() || second.length !== first0.length, 'en annan florist har en annan favoritlista');
  await tap(p, '[data-act=pk-fav-reset]'); 
  await p.reload(); await p.waitForTimeout(250); await p.evaluate(() => document.fonts.ready);
  ok(p.errs.length === 0, 'inga konsolfel i blomvalet: ' + p.errs.join(' | '));
  // Ångra
  await p.close(); p = await open(b, W, H, '?bukett=1'); if (single) await tap(p, '#bar .bar-go');
  const pionId = fl(eng.flowers().find(f => f.name === 'Pion').id).id;
  const baseQty = await p.$eval('.row:has-text("Pion") output', e => e.textContent);
  await tap(p, '.pk-pick[data-id="' + pionId + '"]');
  ok(await visible(p, '.toast'), 'bortval visar ett meddelande med Ångra'); ok(/Pion borttagen/.test(await p.$eval('.toast', e => e.textContent)), 'meddelandet säger vad som hänt');
  await tap(p, '[data-act=toast-action]');
  if (single) await tap(p, '#bar .bar-go');
  eq(await p.$eval('.row:has-text("Pion") output', e => e.textContent), baseQty, 'Ångra ger tillbaka Pion med sitt antal (' + baseQty + ')');
  await p.close();

  // ---- navigation: tillbaka-knapp, flikar, djuplänkar
  p = await open(b, W, H, '');
  await tap(p, '.job >> nth=0'); await tap(p, '.nav [data-act=nav-inkop]');
  eq(await p.$eval('.nav [aria-current]', e => e.textContent), 'Inköp', 'fliken Inköp från ett öppet jobb');
  await p.goBack(); await p.waitForTimeout(150);
  eq(await p.$eval('.nav [aria-current]', e => e.textContent), 'Bukett', 'tillbaka-knappen går till föregående vy (Bukett)');
  await p.goBack(); await p.waitForTimeout(150);
  eq(await p.$eval('.nav [aria-current]', e => e.textContent), 'Hem', 'tillbaka igen går till Hem');
  await tap(p, '[data-act=new]'); await tap(p, '.nav [data-act=nav-bukett]');
  eq(await p.evaluate(() => location.hash), '#/bukett/ny', 'att trycka på Bukett när man bygger en ny bukett ligger kvar där');
  await p.close();
  p = await open(b, W, H, '#/inkop/'); eq(await p.evaluate(() => location.hash.startsWith('#/inkop')), true, 'djuplänk till Inköp');
  await p.close();
  // tangentbord
  p = await open(b, W, H, '?blommor=1');
  await p.evaluate(() => document.activeElement.blur()); await p.keyboard.press('/'); eq(await p.evaluate(() => document.activeElement.id), 'pk-q', '"/" hoppar till sökfältet');
  await p.keyboard.press('Escape');
  await p.evaluate(() => document.activeElement.blur());
  const seq = [];
  for (let i = 0; i < 12; i++) { await p.keyboard.press('Tab'); seq.push(await p.evaluate(() => { const e = document.activeElement, s = getComputedStyle(e), f = e.closest('.search'); const ring = (s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) >= 2) || (f && getComputedStyle(f).outlineStyle !== 'none') || (f && /focus/.test(f.className)); return (e.dataset.fk || e.id || e.tagName) + (ring ? '' : ' (SAKNAR FOKUSRING)'); })); }
  ok(!seq.some(s => /SAKNAR/.test(s)), 'Tab genom blomvalet: fokusring överallt: ' + seq.join(' → '));
  await p.close();
}
T.done(b);
