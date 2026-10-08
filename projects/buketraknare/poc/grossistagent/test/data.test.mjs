// Datadelen: tolkning av tal, extraktion, normalisering, grossistkontraktet och den exakta inköpsberäkningen. Allt är påhittad data.
import test from 'node:test';
import assert from 'node:assert/strict';
import { shapeOf, getPath } from '../src/capture.mjs';
import { parseMoneyValue, parseLengthCm, parsePackSize, normalizeAvailability, applyJsonMapping, normalizeRows, toSupplierData } from '../src/extract.mjs';
import { purchasePlan, kr } from '../src/plan.mjs';
import { PRODUCTS } from './support/mock-shop.mjs';

const dec = m => (m === null ? null : m.toDecimalString());

test('belopp tolkas exakt, och allt som inte är ett exakt belopp blir null (okänt förblir okänt)', () => {
  for (const [input, want] of [['118,00 kr', '118.00'], ['1 234,50', '1234.50'], ['1.234,50', '1234.50'], [126.5, '126.50'], [118, '118.00'], ['118.00', '118.00'], ['  64 kr ', '64.00'], ['0,5', '0.50']])
    assert.equal(dec(parseMoneyValue(input)), want, String(input));
  for (const bad of [58.650000000000006, '105,555', '', null, undefined, 'abc', NaN, Infinity, '12e3', '-5', '1,2,3', '118 kr/förp extra', {}]) assert.equal(parseMoneyValue(bad), null, String(bad));
});

test('längd, förpackning och tillgänglighet tolkas försiktigt', () => {
  for (const [i, w] of [['60 cm', 60], ['0,6 m', 60], ['ca 70', 70], [50, 50], ['70cm', 70]]) assert.equal(parseLengthCm(i), w, String(i));
  for (const bad of ['', null, 'lång', '600 cm', '0 cm']) assert.equal(parseLengthCm(bad), null, String(bad));
  for (const [i, w] of [[20, 20], ['20', 20], ['20-pack', 20], ['Eukalyptus Cinerea 10-pack', 10], ['bunt à 10', 10], ['10 st/bunt', 10], ['förp 25', 25]]) assert.equal(parsePackSize(i), w, String(i));
  for (const bad of ['Ros Avalanche 60 cm', '', null, 0, 1001, 2.5, 'pack']) assert.equal(parsePackSize(bad), null, String(bad));
  for (const [i, w] of [['I lager', 'in_stock'], ['Slut', 'sold_out'], ['Ej i lager', 'sold_out'], ['Få kvar', 'low'], [120, 'in_stock'], [0, 'sold_out'], ['', 'unknown'], [null, 'unknown'], ['kanske', 'unknown']])
    assert.equal(normalizeAvailability(i), w, String(i));
});

const FIELDS = { id: 'artikelnr', name: 'benamning', variant: 'sort', color: 'farg', lengthCm: 'langd_cm', packSize: 'forpackning.antal', price: 'pris.belopp', priceUnit: 'pris.per', priceIncludesVat: 'pris.inklmoms', currency: 'pris.valuta', availability: 'lager.status', offer: 'kampanj' };
const shopJson = () => ({ resultat: { antal: PRODUCTS.length, artiklar: PRODUCTS.map(p => ({ artikelnr: p.artikelnr, benamning: p.benamning, sort: p.sort, farg: p.farg, langd_cm: p.langd_cm, forpackning: { antal: p.antal, enhet: 'st' }, pris: { belopp: p.pris, per: 'förp', valuta: 'SEK', inklmoms: false }, lager: { status: p.lager }, kampanj: p.kampanj })) } });

test('JSON-svar → rader → normaliserade artiklar med alla fält som finns, och inget som saknas hittas på', () => {
  const { rows, issues } = applyJsonMapping(shopJson(), { itemsPath: 'resultat.artiklar', fields: FIELDS });
  assert.equal(rows.length, 8); assert.deepEqual(issues, []);
  const { products, skipped } = normalizeRows(rows, {});
  assert.deepEqual(skipped, { noId: 0, noName: 0, duplicate: 0 });
  const av = products.find(p => p.id === 'R-1001');
  assert.deepEqual([av.name, av.variant, av.color, av.lengthCm, av.packSize, av.packSizeSource, dec(av.packPrice), av.priceUnit, av.priceDerived, av.priceIncludesVat, av.currency, av.currencyAssumed, av.availability, av.offer, av.issues],
    ['Ros Avalanche 60 cm', 'Avalanche', 'Vit', 60, 20, 'fält', '118.00', 'pack', false, false, 'SEK', false, 'in_stock', null, []]);
  const tibet = products.find(p => p.id === 'R-1005');
  assert.equal(tibet.availability, 'sold_out'); assert.match(tibet.offer, /Veckans erbjudande: 15 % rabatt/); assert.equal(dec(tibet.packPrice), '69.00');
  assert.equal(dec(products.find(p => p.id === 'R-1003').packPrice), '126.50');                      // inget flyttalsbrus
  assert.equal(products.find(p => p.id === 'E-4001').packSize, 10);
});

test('extraktionens fel och luckor ger anmärkningar, aldrig gissningar', () => {
  const rows = [
    { id: 'A', name: 'Utan pris', packSize: 10 },
    { id: 'B', name: 'Pris utan enhet', packSize: 10, price: 50 },
    { id: 'C', name: 'Pris per styck', packSize: 10, price: 4.5, priceUnit: 'st' },
    { id: 'D', name: 'Pris per styck utan förpackning', price: 4.5, priceUnit: 'st' },
    { id: 'E', name: 'Fel pris', packSize: 10, price: '12,345', priceUnit: 'förp' },
    { id: 'F', name: 'Förpackning i namnet 20-pack', price: '99', priceUnit: 'förp' },
    { id: 'A', name: 'Dubblett', price: 1 }, { name: 'Saknar id' }, { id: 'G' }, { id: ' ', name: 'Blankt id' },
    { id: 'H', name: 'Extra', extras: { sort: 'X', tom: '', nej: null, obj: { a: 1 } }, price: 10, priceUnit: 'förp', packSize: 5, priceIncludesVat: 'Inkl. moms', currency: 'eur' }
  ];
  const { products, skipped } = normalizeRows(rows, {});
  assert.deepEqual(skipped, { noId: 2, noName: 1, duplicate: 1 });
  const by = id => products.find(p => p.id === id);
  assert.equal(by('A').packPrice, null); assert.deepEqual(by('A').issues, ['pris saknas']);
  assert.equal(by('B').packPrice, null); assert.match(by('B').issues[0], /prisenhet okänd/);
  assert.equal(dec(by('C').packPrice), '45.00'); assert.equal(by('C').priceDerived, true);          // 4,50 × 10, exakt
  assert.equal(by('D').packPrice, null); assert.match(by('D').issues.join(), /pris per styck men förpackningsstorlek okänd/);
  assert.equal(by('E').packPrice, null); assert.match(by('E').issues.join(), /går inte att läsa exakt/);
  assert.deepEqual([by('F').packSize, by('F').packSizeSource, dec(by('F').packPrice)], [20, 'namn', '99.00']);
  assert.deepEqual(by('H').extras, { sort: 'X', obj: '{"a":1}' }); assert.equal(by('H').priceIncludesVat, true); assert.equal(by('H').currency, 'eur');
  assert.equal(by('A').priceIncludesVat, null); assert.equal(by('A').currencyAssumed, true);        // momsstatus okänd, valuta antagen och märkt som antagen
  const m = normalizeRows([{ id: 'X', name: 'Konstant', price: 10, packSize: 2 }], { priceUnit: 'pack', priceIncludesVat: false, currency: 'SEK' }).products[0];
  assert.deepEqual([dec(m.packPrice), m.priceIncludesVat, m.currencyAssumed], ['10.00', false, false]);
  assert.deepEqual(applyJsonMapping({ a: 1 }, { itemsPath: 'a', fields: {} }).issues, [{ code: 'items_not_array', path: 'a' }]);
  assert.equal(applyJsonMapping(shopJson(), { itemsPath: 'resultat.artiklar', fields: { id: 'finns.inte' } }).rows[0].id, undefined);
});

test('resultatet är i den form grossistkontraktet (model.js) tar emot, och kontraktet godkänner det', () => {
  const { products } = normalizeRows(applyJsonMapping(shopJson(), { itemsPath: 'resultat.artiklar', fields: FIELDS }).rows, {});
  const data = toSupplierData(products, { fetchedAt: '2026-10-08T10:00:00.000Z' });
  assert.equal(data.products.length, 8); assert.equal(data.quotes.length, 8);
  const q = data.quotes.find(x => x.supplierProductId === 'R-1001');
  assert.deepEqual([q.packPrice, q.currency, q.priceIncludesVat, q.availability, q.strategy, q.verification], [118, 'SEK', false, 'in_stock', 'browser', 'live']);
  assert.equal(data.products.find(x => x.supplierProductId === 'R-1001').stemsPerPack, 20);
  // en artikel utan förpackning och pris tas emot som okänd (null), inte som noll
  const odd = toSupplierData(normalizeRows([{ id: 'Z', name: 'Okänd' }], {}).products, { fetchedAt: '2026-10-08T10:00:00.000Z' });
  assert.equal(odd.quotes[0].packPrice, null); assert.equal(odd.products[0].stemsPerPack, 1);
});

test('inköpsberäkningen görs av vår exakta kod: Avalanche 60 cm, 20-pack, 25 behövs → 2 förpackningar, 40 st, 15 över', () => {
  const { products } = normalizeRows(applyJsonMapping(shopJson(), { itemsPath: 'resultat.artiklar', fields: FIELDS }).rows, {});
  const p = purchasePlan(products.find(x => x.id === 'R-1001'), 25);
  assert.deepEqual([p.status, p.packs, p.bought, p.leftover, p.packPrice, p.cost, p.costExact, p.perStem, p.costNote], ['ok', 2, 40, 15, '118 kr', '236 kr', '23600', '5,90 kr', 'exkl. moms']);
  const v = purchasePlan(products.find(x => x.id === 'R-1003'), 41);              // 126,50 × 3 = 379,50
  assert.deepEqual([v.packs, v.bought, v.leftover, v.cost], [3, 60, 19, '379,50 kr']);
  assert.equal(purchasePlan(products.find(x => x.id === 'R-1001'), 40).leftover, 0);
  assert.equal(purchasePlan(products.find(x => x.id === 'R-1001'), 20).packs, 1);
  assert.equal(purchasePlan(products.find(x => x.id === 'R-1001'), 21).packs, 2);
});

test('inköpsberäkningen gissar aldrig: okänd förpackning, saknat pris och ogiltigt antal ger ingen kostnad', () => {
  const [a] = normalizeRows([{ id: 'A', name: 'Utan förpackning', price: 10, priceUnit: 'förp' }], {}).products;
  assert.equal(purchasePlan(a, 25).status, 'förpackning_okänd'); assert.equal(purchasePlan(a, 25).cost, undefined);
  const [b] = normalizeRows([{ id: 'B', name: 'Utan pris', packSize: 10 }], {}).products;
  const pb = purchasePlan(b, 25); assert.deepEqual([pb.status, pb.packs, pb.bought, pb.leftover, pb.cost], ['pris_saknas', 3, 30, 5, undefined]);
  for (const bad of [0, -1, 2.5, '25', null, NaN]) assert.equal(purchasePlan(b, bad).status, 'ogiltigt_antal', String(bad));
});

test('egenskap: för 400 slumpade fall är förpackningar × pris exakt kostnaden och överskottet exakt', () => {
  let s = 12345; const r = () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
  for (let i = 0; i < 400; i++) {
    const pack = 1 + Math.floor(r() * 30), needed = 1 + Math.floor(r() * 200), cents = BigInt(100 + Math.floor(r() * 90000));
    const [p] = normalizeRows([{ id: 'X', name: 'X', packSize: pack, price: (Number(cents) / 100).toFixed(2), priceUnit: 'förp' }], {}).products;
    const pl = purchasePlan(p, needed);
    const packs = Math.ceil(needed / pack);
    assert.equal(pl.packs, packs); assert.equal(pl.bought, packs * pack); assert.equal(pl.leftover, packs * pack - needed);
    assert.equal(pl.costExact, String(BigInt(packs) * cents));
  }
});

test('shapeOf och getPath: bara nyckelnamn och typer, och sökvägar kör ingen kod', () => {
  const j = { resultat: { antal: 2, artiklar: [{ nr: 'A', pris: { belopp: 1.5 } }, { nr: 'B' }] }, tom: [], nul: null };
  assert.deepEqual(shapeOf(j), { resultat: { antal: 'number', artiklar: [{ nr: 'string', pris: { belopp: 'number' } }, '×2'] }, tom: ['tom'], nul: 'null' });
  assert.ok(!JSON.stringify(shapeOf(j)).includes('"A"'));
  assert.equal(getPath(j, 'resultat.artiklar[0].pris.belopp'), 1.5); assert.equal(getPath(j, 'resultat.artiklar[1].nr'), 'B'); assert.equal(getPath(j, ''), j);
  for (const bad of ['resultat.finns.inte', 'resultat.artiklar[5]', 'resultat.antal.x', 'constructor', '__proto__', 'resultat.artiklar.0', 'a[b]', 'toString', 'resultat..antal']) assert.equal(getPath(j, bad), undefined, bad);
  assert.ok(kr(null) === null);
});
