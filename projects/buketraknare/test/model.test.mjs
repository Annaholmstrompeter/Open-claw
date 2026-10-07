// Datamodell v2: stabila id:n, produkt / leverantörsprodukt / pris / matchning, migrering från v1 och rollback.
// Skrivna före modellen. Migreringen får inte användas av appen förrän allt här är grönt.
import test from 'node:test';
import assert from 'node:assert/strict';
import M from '../public/js/core/model.js';
import { loadApp, v1State, item, keyOf } from './helpers/app.mjs';
import { fixtures, randomV1State } from './support/v1-fixtures.mjs';

const clone = o => JSON.parse(JSON.stringify(o));
const deepFreeze = o => { if (o && typeof o === 'object' && !Object.isFrozen(o)) { Object.freeze(o); Object.values(o).forEach(deepFreeze); } return o; };

/** v1 jämförs utan "föräldralösa" etiketter: etiketter som inte hör till någon vara, order, hemma eller recept är skräp. */
function canonV1(v1) {
  const c = clone(v1);
  const used = new Set(c.priceList.items.map(i => keyOf(i.namn)));
  c.order.buketter.forEach(b => Object.keys(b.items).forEach(k => used.add(k)));
  Object.keys(c.order.hemma || {}).forEach(k => used.add(k));
  (c.recipes || []).forEach(r => Object.keys(r.items).forEach(k => used.add(k)));
  for (const k of Object.keys(c.labels || {})) if (!used.has(k)) delete c.labels[k];
  return c;
}
const itemsOf = v1 => v1.priceList.items.map(i => ({ ...i }));
const viewItemsNoId = st => M.viewOf(st).priceList.items.map(({ id, ...rest }) => rest);

// ---------- migrering v1 → v2 ----------

test('migrering ändrar inte indata och är deterministisk', () => {
  for (const [name, v1] of Object.entries(fixtures())) {
    const frozen = deepFreeze(clone(v1));
    const a = M.migrateV1toV2(frozen, { now: '2026-10-07T10:00:00.000Z' });
    const b = M.migrateV1toV2(frozen, { now: '2026-10-07T10:00:00.000Z' });
    assert.deepEqual(a, b, name + ': samma indata ger samma id:n');
    assert.equal(a.v, 2);
  }
});

test('migrering: varor, priser och förpackningar finns kvar exakt som förut', () => {
  for (const [name, v1] of Object.entries(fixtures())) {
    const st = M.migrateV1toV2(v1);
    assert.deepEqual(viewItemsNoId(st), itemsOf(v1), name + ': vyn av v2 är samma varor som v1');
    assert.deepEqual(M.viewOf(st).priceList.meta, v1.priceList.meta, name);
  }
});

test('migrering: id:n är unika, stabila och inte namn; order, hemma och recept pekar på id:n', () => {
  for (const [name, v1] of Object.entries(fixtures())) {
    const st = M.migrateV1toV2(v1);
    const ids = st.products.map(p => p.id);
    assert.equal(new Set(ids).size, ids.length, name + ': unika id:n');
    for (const id of ids) assert.match(id, /^fp_[a-z0-9-]+$/, name);
    const known = new Set([...ids, ...Object.keys(st.labels)]);
    const refs = [...st.order.buketter.flatMap(b => Object.keys(b.items)), ...Object.keys(st.order.hemma), ...st.recipes.flatMap(r => Object.keys(r.items))];
    for (const r of refs) assert.ok(known.has(r), `${name}: ${r} är ett id med etikett`);
    for (const r of refs) assert.match(r, /^fp_/, name + ': inga namnnycklar kvar i ordern');
  }
  // samma namn ger samma id på olika enheter (förberedelse för synk), och byte av namn ändrar det inte
  const a = M.migrateV1toV2(v1State({ items: [item(['Röd ros', 'Blommor', 10, 120, 'pack'])] }));
  const b = M.migrateV1toV2(v1State({ items: [item(['Röd ros', 'Blommor', 10, 999, 'pack'])] }));
  assert.equal(a.products[0].id, b.products[0].id);
  assert.equal(a.products[0].id, 'fp_rod-ros');
});

test('migrering: varje vara blir PRODUKT + LEVERANTÖRSPRODUKT + MATCHNING (+ PRIS när det finns ett)', () => {
  const st = M.migrateV1toV2(fixtures()['egen lista med order, hemma och recept']);
  assert.equal(st.products.length, 6);
  assert.equal(st.supplierProducts.length, 6);
  assert.equal(st.matches.length, 6);
  assert.deepEqual(st.connections.map(c => c.id), ['conn_manual']);
  assert.ok(st.matches.every(m => m.status === 'confirmed' && m.method === 'manual'));
  const ros = st.products.find(p => p.name === 'Röd ros');
  const sp = st.supplierProducts.find(s => s.supplierProductId === ros.id);
  assert.equal(sp.stemsPerPack, 10);
  assert.equal(sp.packUnit, 'pack');
  const q = st.quotes.filter(x => x.supplierProductId === ros.id);
  assert.equal(q.length, 1);
  assert.equal(q[0].packPrice, 120);
  assert.equal(q[0].verifiedOn, '2026-10-07');
  assert.equal(q[0].currency, 'SEK');
  assert.equal(q[0].priceIncludesVat, false);
  assert.equal(q[0].verification, 'manual');
  // en vara helt utan pris och dag får ingen prisnotering alls (aldrig 0 kr)
  const pion = st.products.find(p => p.name === 'Pion');
  assert.equal(st.quotes.filter(x => x.supplierProductId === pion.id).length, 0);
  // priset är aldrig 0, det är null när det saknas
  assert.ok(st.quotes.every(x => x.packPrice === null || x.packPrice > 0));
});

test('migrering: varor som ligger i ordern men inte i prislistan behåller sin rad och sin etikett', () => {
  const v1 = fixtures()['egen lista med order, hemma och recept'];
  const st = M.migrateV1toV2(v1);
  const ghostIds = Object.keys(st.order.buketter[1].items).filter(id => !st.products.some(p => p.id === id));
  assert.equal(ghostIds.length, 1);
  assert.equal(st.labels[ghostIds[0]], 'Pelargon');
  assert.equal(st.order.buketter[1].items[ghostIds[0]], 2);
  assert.equal(st.order.hemma[ghostIds[0]], 1, 'hemma pekar på samma id som ordern');
});

test('migrering: en ghost-nyckel utan etikett visas på samma sätt som förut', () => {
  const v1 = v1State({ items: [item(['Röd ros', 'Blommor', 10, 120, 'pack'])], buketter: [{ items: { 'Röd ros': 1 } }] });
  v1.order.buketter[0].items['okänd vara'] = 2; // ingen etikett, som en gammal rest
  const st = M.migrateV1toV2(v1);
  const id = Object.keys(st.order.buketter[0].items).find(k => k !== 'fp_rod-ros');
  assert.equal(st.labels[id], 'okänd vara', 'etiketten faller tillbaka på den gamla nyckeln, som labelOf() gjorde');
  assert.equal(M.downgradeV2toV1(st).order.buketter[0].items['okänd vara'], 2);
});

test('migrering: inställningar, grossistval, buketter, antal, recept och hemma är oförändrade', () => {
  const v1 = fixtures()['egen lista med order, hemma och recept'];
  const st = M.migrateV1toV2(v1);
  assert.deepEqual(st.settings, v1.settings);
  assert.deepEqual(st.wholesaler, v1.wholesaler);
  assert.equal(st.order.buketter.length, 2);
  assert.deepEqual(st.order.buketter.map(b => [b.id, b.size, b.qty]), v1.order.buketter.map(b => [b.id, b.size, b.qty]));
  assert.equal(st.order.active, v1.order.active);
  assert.equal(st.order.seq, v1.order.seq);
  assert.deepEqual(st.recipes.map(r => [r.id, r.name, r.size]), v1.recipes.map(r => [r.id, r.name, r.size]));
});

test('migrering: dubbletter av samma namn bevaras och ordern följer den senaste, som förut', () => {
  const v1 = fixtures()['dubbletter av samma namn'];
  const st = M.migrateV1toV2(v1);
  assert.equal(st.products.length, 2);
  assert.notEqual(st.products[0].id, st.products[1].id);
  const orderId = Object.keys(st.order.buketter[0].items)[0];
  assert.equal(orderId, st.products[1].id, 'indexList() lät den sista vinna');
});

// ---------- rollback v2 → v1 ----------

test('rollback: migrering följd av rollback ger tillbaka exakt samma data som förut', () => {
  for (const [name, v1] of Object.entries(fixtures())) {
    const back = M.downgradeV2toV1(M.migrateV1toV2(v1));
    assert.deepEqual(canonV1(back), canonV1(v1), name);
  }
});

test('rollback: ändringar gjorda efter migreringen följer med tillbaka', () => {
  const v1 = fixtures()['egen lista med order, hemma och recept'];
  const st = M.migrateV1toV2(v1);
  const rosId = st.products.find(p => p.name === 'Röd ros').id;
  M.setManualPrice(st, rosId, { pris: 135, paket: 10 }, { today: '2026-10-08', now: '2026-10-08T08:00:00.000Z' });
  M.renameProduct(st, rosId, 'Röd ros Freedom');
  const newId = M.addProduct(st, { name: 'Dahlia', category: 'Blommor' }, { today: '2026-10-08' });
  st.order.buketter[0].items[newId] = 2;
  const back = M.downgradeV2toV1(st);
  const r = back.priceList.items.find(i => i.namn === 'Röd ros Freedom');
  assert.equal(r.pris, 135);
  assert.equal(r.uppd, '2026-10-08');
  assert.equal(back.order.buketter[0].items['röd ros freedom'], 3, 'orderns rad följde med namnbytet');
  assert.equal(back.order.buketter[0].items['dahlia'], 2);
  assert.equal(back.labels['dahlia'], 'Dahlia');
  assert.equal(back.hemma, undefined);
  assert.equal(back.order.hemma['röd ros freedom'], 4);
});

test('rollback: v1 efter rollback går att migrera igen och ger samma resultat (rundtur två gånger)', () => {
  for (const [name, v1] of Object.entries(fixtures())) {
    const once = M.migrateV1toV2(v1);
    const twice = M.migrateV1toV2(M.downgradeV2toV1(once));
    assert.deepEqual(viewItemsNoId(twice), viewItemsNoId(once), name);
    assert.deepEqual(canonV1(M.downgradeV2toV1(twice)), canonV1(v1), name);
  }
});

// ---------- slumpade tillstånd (fuzz) ----------

test('slumpade tillstånd: migrering och rollback tappar aldrig något (1 000 st)', () => {
  for (let n = 0; n < 1000; n++) {
    const v1 = randomV1State(n);
    const st = M.migrateV1toV2(v1);
    assert.deepEqual(viewItemsNoId(st), itemsOf(v1), 'fuzz ' + n + ' varor');
    assert.deepEqual(canonV1(M.downgradeV2toV1(st)), canonV1(v1), 'fuzz ' + n + ' rollback');
    const ids = st.products.map(p => p.id);
    assert.equal(new Set(ids).size, ids.length, 'fuzz ' + n + ' unika id:n');
  }
});

test('migrering klarar trasiga och ofullständiga v1-tillstånd utan att kasta', () => {
  const broken = [
    { v: 1, priceList: { meta: {}, items: [] }, order: { buketter: [{ id: 'b1', size: 'medel', qty: 1, items: {} }], hemma: {}, active: 'b1', seq: 1 } },
    { v: 1, priceList: { meta: {}, items: [{ namn: 'X' }] }, order: { buketter: [{ id: 'b1', size: 'medel', qty: 1, items: { x: 2 } }] } },
    { v: 1, priceList: { items: [] }, order: { buketter: [{ id: 'b1', items: { a: 1 } }] }, labels: null, recipes: null }
  ];
  for (const b of broken) {
    const st = M.migrateV1toV2(b);
    assert.equal(st.v, 2);
    assert.ok(Array.isArray(st.products) && Array.isArray(st.matches));
    M.downgradeV2toV1(st);
  }
});

// ---------- skriv-API: allt som appen ändrar går via modellen ----------

const fresh = () => M.migrateV1toV2(v1State({ items: [item(['Röd ros', 'Blommor', 10, 120, 'pack', '2026-10-01']), item(['Tulpan', 'Blommor', 10, 55, 'bunt', '2026-10-01'])], buketter: [{ items: { 'Röd ros': 5 } }] }));
const byName = (st, n) => M.viewOf(st).priceList.items.find(i => i.namn === n);

test('nytt pris läggs till som en ny notering, med dagen, och den gamla finns kvar som historik', () => {
  const st = fresh();
  const id = byName(st, 'Röd ros').id;
  M.setManualPrice(st, id, { pris: 129, paket: 10, enhet: 'pack' }, { today: '2026-10-08', now: '2026-10-08T07:00:00.000Z' });
  const it = byName(st, 'Röd ros');
  assert.equal(it.pris, 129);
  assert.equal(it.uppd, '2026-10-08');
  const hist = st.quotes.filter(q => q.supplierProductId === id);
  assert.deepEqual(hist.map(q => [q.packPrice, q.verifiedOn]), [[120, '2026-10-01'], [129, '2026-10-08']]);
});

test('samma dag ersätter dagens notering i stället för att lägga till en ny, och historiken kapas', () => {
  const st = fresh();
  const id = byName(st, 'Röd ros').id;
  M.setManualPrice(st, id, { pris: 130 }, { today: '2026-10-08' });
  M.setManualPrice(st, id, { pris: 131 }, { today: '2026-10-08' });
  assert.equal(st.quotes.filter(q => q.supplierProductId === id).length, 2, 'gamla + dagens');
  assert.equal(byName(st, 'Röd ros').pris, 131);
  for (let d = 1; d <= 30; d++) M.setManualPrice(st, id, { pris: 100 + d }, { today: '2026-11-' + String(d).padStart(2, '0') });
  assert.equal(st.quotes.filter(q => q.supplierProductId === id).length, M.MAX_QUOTES_PER_PRODUCT);
  assert.equal(byName(st, 'Röd ros').pris, 130, 'senaste behålls');
});

test('pris 0 betyder "saknas": ingen 0 kr kan sparas som pris', () => {
  const st = fresh();
  const id = byName(st, 'Röd ros').id;
  M.setManualPrice(st, id, { pris: 0 }, { today: '2026-10-08' });
  assert.equal(byName(st, 'Röd ros').pris, 0);
  assert.equal(st.quotes.filter(q => q.supplierProductId === id).at(-1).packPrice, null);
});

test('byta namn ändrar inga id:n och orderns rader följer med', () => {
  const st = fresh();
  const id = byName(st, 'Röd ros').id;
  M.renameProduct(st, id, 'Freedom');
  assert.equal(byName(st, 'Freedom').id, id);
  assert.equal(st.order.buketter[0].items[id], 5);
  assert.equal(st.labels[id], 'Freedom');
});

test('ny vara får ett id som inte krockar, även när namnet är upptaget av en borttagen vara', () => {
  const st = fresh();
  const a = M.addProduct(st, { name: 'Pion' }, { today: '2026-10-08' });
  const b = M.addProduct(st, { name: 'Pion' }, { today: '2026-10-08' });
  assert.notEqual(a, b);
  assert.equal(M.viewOf(st).priceList.items.find(i => i.id === a).pris, 0, 'ingen påhittad prisnotering');
  assert.equal(st.quotes.filter(q => q.supplierProductId === a).length, 0);
});

test('ta bort en vara som används lämnar en spökrad, och samma namn igen kopplar ihop den igen (som i v1)', () => {
  const st = fresh();
  const id = byName(st, 'Röd ros').id;
  M.removeProduct(st, id);
  assert.equal(byName(st, 'Röd ros'), undefined);
  assert.equal(st.order.buketter[0].items[id], 5, 'orderns rad finns kvar');
  assert.equal(st.labels[id], 'Röd ros', 'och går att visa');
  assert.equal(st.matches.some(m => m.productId === id), false);
  assert.equal(st.quotes.some(q => q.supplierProductId === id), false);
  const again = M.addProduct(st, { name: 'röd  ros' }, { today: '2026-10-08' });
  assert.equal(again, id, 'samma id, så ordern hittar varan igen');
});

test('import: återanvänder id:n för varor med samma namn, tar bort de som försvann, och märker allt som idag', () => {
  const st = fresh();
  const ros = byName(st, 'Röd ros').id;
  const tulpan = byName(st, 'Tulpan').id;
  M.replaceFromImport(st, [
    { namn: 'Röd ros', kategori: 'Blommor', enhet: 'pack', paket: 10, pris: 130, farg: '' },
    { namn: 'Pion', kategori: 'Blommor', enhet: 'bunt', paket: 5, pris: 90, farg: '' }
  ], { today: '2026-10-08', name: 'lista.csv' });
  assert.equal(byName(st, 'Röd ros').id, ros, 'samma id');
  assert.equal(byName(st, 'Röd ros').pris, 130);
  assert.equal(byName(st, 'Röd ros').uppd, '2026-10-08');
  assert.equal(byName(st, 'Tulpan'), undefined);
  assert.equal(st.supplierProducts.some(s => s.supplierProductId === tulpan), false, 'inga lösa rester');
  assert.deepEqual(M.viewOf(st).priceList.meta, { namn: 'lista.csv', datum: '2026-10-08', kalla: 'import' });
  assert.equal(st.labels[ros], 'Röd ros');
  assert.equal(st.order.buketter[0].items[ros], 5, 'ordern är orörd');
});

test('import utan pris (0) ger en notering med dag men utan pris, aldrig 0 kr', () => {
  const st = fresh();
  M.replaceFromImport(st, [{ namn: 'Gräs', kategori: 'Grönt', enhet: 'bunt', paket: 1, pris: 0, farg: '' }], { today: '2026-10-08', name: 'x' });
  const it = byName(st, 'Gräs');
  assert.equal(it.pris, 0);
  assert.equal(it.uppd, '2026-10-08');
  assert.equal(st.quotes.at(-1).packPrice, null);
});

// ---------- matchning ----------

function withSupplier() {
  const st = fresh();
  M.upsertConnection(st, { id: 'conn_a', supplierId: 'fake-a', authKind: 'feedUrl', status: 'connected' });
  M.ingestSupplierData(st, 'conn_a', {
    products: [
      { supplierProductId: 'A-100', name: 'Avalanche White 50 cm', genus: 'Rosa', cultivar: 'Avalanche', colour: 'vit', stemLengthCm: 50, grade: 'A1', stemsPerPack: 10, packUnit: 'pack' },
      { supplierProductId: 'A-200', name: 'Freedom Red 60 cm', genus: 'Rosa', colour: 'röd', stemLengthCm: 60, stemsPerPack: 10, packUnit: 'pack' }
    ],
    quotes: [
      { supplierProductId: 'A-100', packPrice: 129, currency: 'SEK', priceIncludesVat: false, fetchedAt: '2026-10-08T06:00:00.000Z', strategy: 'feed' },
      { supplierProductId: 'A-200', packPrice: 149, currency: 'SEK', priceIncludesVat: false, fetchedAt: '2026-10-08T06:00:00.000Z', strategy: 'feed' }
    ]
  }, { today: '2026-10-08', now: '2026-10-08T06:00:01.000Z' });
  return st;
}

test('matchning: bekräfta en koppling flyttar priset till leverantörens pris och sparas för alltid', () => {
  const st = withSupplier();
  const id = byName(st, 'Röd ros').id;
  assert.equal(M.needsMatching(st, id, 'conn_a'), true, 'ingen verifierad koppling än');
  assert.equal(byName(st, 'Röd ros').pris, 120, 'tills vidare gäller den egna listan');

  const m = M.confirmMatch(st, { productId: id, connectionId: 'conn_a', supplierProductId: 'A-200', method: 'user_picked', confidence: 0.95, now: '2026-10-08T06:05:00.000Z' });
  assert.equal(m.status, 'confirmed');
  assert.equal(M.needsMatching(st, id, 'conn_a'), false, 'verifierad koppling återanvänds, ingen ny matchning');
  const it = byName(st, 'Röd ros');
  assert.equal(it.pris, 149);
  assert.equal(it.paket, 10);
  assert.equal(it.enhet, 'pack');
  assert.equal(it.uppd, '2026-10-08');
  assert.equal(M.getConfirmedMatch(st, id, 'conn_a').supplierProductId, 'A-200');
});

test('matchning: att välja en annan produkt ersätter kopplingen, det blir aldrig två bekräftade', () => {
  const st = withSupplier();
  const id = byName(st, 'Röd ros').id;
  M.confirmMatch(st, { productId: id, connectionId: 'conn_a', supplierProductId: 'A-100' });
  M.confirmMatch(st, { productId: id, connectionId: 'conn_a', supplierProductId: 'A-200' });
  const conf = st.matches.filter(m => m.productId === id && m.connectionId === 'conn_a' && m.status === 'confirmed');
  assert.equal(conf.length, 1);
  assert.equal(conf[0].supplierProductId, 'A-200');
});

test('matchning: avvisat förslag sparas och föreslås inte igen', () => {
  const st = withSupplier();
  const id = byName(st, 'Röd ros').id;
  M.rejectMatch(st, { productId: id, connectionId: 'conn_a', supplierProductId: 'A-100' });
  assert.deepEqual(M.rejectedFor(st, id, 'conn_a'), ['A-100']);
  assert.equal(M.getConfirmedMatch(st, id, 'conn_a'), null);
  assert.equal(M.needsMatching(st, id, 'conn_a'), true);
});

test('matchning: försvinner leverantörens produkt behövs en ny matchning, annars inte', () => {
  const st = withSupplier();
  const id = byName(st, 'Röd ros').id;
  M.confirmMatch(st, { productId: id, connectionId: 'conn_a', supplierProductId: 'A-200' });
  assert.equal(M.needsMatching(st, id, 'conn_a'), false);
  // en komplett hämtning där A-200 inte längre finns
  M.ingestSupplierData(st, 'conn_a', { products: [{ supplierProductId: 'A-100', name: 'Avalanche White 50 cm', stemsPerPack: 10, packUnit: 'pack' }], quotes: [] }, { today: '2026-10-09', now: '2026-10-09T06:00:00.000Z', complete: true });
  assert.equal(M.needsMatching(st, id, 'conn_a'), true, 'produkten har försvunnit');
  assert.equal(st.supplierProducts.find(s => s.supplierProductId === 'A-200').discontinued, true);
  assert.equal(byName(st, 'Röd ros').pris, 120, 'faller tillbaka på den egna listan tills floristen valt om');
  // en ofullständig hämtning (t.ex. en sökning) markerar ingenting som försvunnet
  M.ingestSupplierData(st, 'conn_a', { products: [{ supplierProductId: 'A-100', name: 'Avalanche White 50 cm', stemsPerPack: 10, packUnit: 'pack' }], quotes: [] }, { today: '2026-10-09', now: '2026-10-09T07:00:00.000Z' });
  assert.equal(M.needsMatching(st, byName(st, 'Tulpan').id, 'conn_a'), true);
});

test('prisval: ansluten grossist går före den egna listan, men bara med ett riktigt pris', () => {
  const st = withSupplier();
  const id = byName(st, 'Röd ros').id;
  M.confirmMatch(st, { productId: id, connectionId: 'conn_a', supplierProductId: 'A-200' });
  assert.equal(byName(st, 'Röd ros').pris, 149);
  // leverantören saknar pris just nu → den egna listans pris gäller, aldrig 0
  M.ingestSupplierData(st, 'conn_a', { products: [], quotes: [{ supplierProductId: 'A-200', packPrice: null, priceIncludesVat: false, fetchedAt: '2026-10-09T06:00:00.000Z', strategy: 'feed' }] }, { today: '2026-10-09' });
  assert.equal(byName(st, 'Röd ros').pris, 120);
  // bortkopplad grossist används inte
  M.ingestSupplierData(st, 'conn_a', { products: [], quotes: [{ supplierProductId: 'A-200', packPrice: 155, priceIncludesVat: false, fetchedAt: '2026-10-10T06:00:00.000Z', strategy: 'feed' }] }, { today: '2026-10-10' });
  assert.equal(byName(st, 'Röd ros').pris, 155);
  M.setConnectionStatus(st, 'conn_a', 'disconnected');
  assert.equal(byName(st, 'Röd ros').pris, 120);
});

test('flera grossister: varje koppling är egen, och den första anslutna med pris vinner', () => {
  const st = withSupplier();
  M.upsertConnection(st, { id: 'conn_b', supplierId: 'fake-b', authKind: 'oauth', status: 'connected' });
  M.ingestSupplierData(st, 'conn_b', { products: [{ supplierProductId: 'B-1', name: 'Rose Red', stemsPerPack: 20, packUnit: 'kartong' }], quotes: [{ supplierProductId: 'B-1', packPrice: 200, currency: 'SEK', priceIncludesVat: false, fetchedAt: '2026-10-08T06:00:00.000Z', strategy: 'api' }] }, { today: '2026-10-08' });
  const id = byName(st, 'Röd ros').id;
  M.confirmMatch(st, { productId: id, connectionId: 'conn_b', supplierProductId: 'B-1' });
  M.confirmMatch(st, { productId: id, connectionId: 'conn_a', supplierProductId: 'A-200' });
  assert.equal(byName(st, 'Röd ros').pris, 149, 'conn_a kom först');
  assert.equal(M.getConfirmedMatch(st, id, 'conn_b').supplierProductId, 'B-1');
  M.setConnectionStatus(st, 'conn_a', 'disconnected');
  const it = byName(st, 'Röd ros');
  assert.deepEqual([it.pris, it.paket, it.enhet], [200, 20, 'kartong']);
});

// ---------- inläsning från en grossist ----------

test('inläsning: produkter och priser valideras och sparas i gemensamt format', () => {
  const st = withSupplier();
  const sp = st.supplierProducts.find(s => s.supplierProductId === 'A-100');
  assert.equal(sp.connectionId, 'conn_a');
  assert.equal(sp.colour, 'vit');
  assert.equal(sp.stemLengthCm, 50);
  assert.equal(sp.stemsPerPack, 10);
  const q = st.quotes.find(x => x.connectionId === 'conn_a' && x.supplierProductId === 'A-100');
  assert.equal(q.packPrice, 129);
  assert.equal(q.verifiedOn, '2026-10-08');
  assert.equal(q.fetchedAt, '2026-10-08T06:00:00.000Z');
  assert.equal(q.strategy, 'feed');
  assert.equal(q.verification, 'live');
});

test('inläsning: ogiltiga rader avvisas med en tydlig lista och sparar ingenting alls', () => {
  const st = withSupplier();
  const before = clone(st);
  assert.throws(() => M.ingestSupplierData(st, 'conn_a', {
    products: [{ supplierProductId: '', name: 'x' }, { supplierProductId: 'Z', name: '' }],
    quotes: [{ supplierProductId: 'A-100', packPrice: -5, fetchedAt: 'inte ett datum', strategy: 'gissning' }]
  }, { today: '2026-10-08' }), err => {
    assert.equal(err.name, 'ModelValidationError');
    assert.ok(err.problems.length >= 4, err.problems.join(' | '));
    return true;
  });
  assert.deepEqual(st, before, 'allt-eller-inget: inget halvsparat');
  assert.throws(() => M.ingestSupplierData(st, 'finns_inte', { products: [], quotes: [] }), /okänd anslutning/i);
});

test('normalisering av leverantörsprodukt: krav, standardvärden och rimlighet', () => {
  const p = M.normalizeSupplierProduct({ supplierProductId: 'X', name: ' Röd ros ', stemsPerPack: '10', stemLengthCm: '60', colour: ' röd ' });
  assert.equal(p.name, 'Röd ros');
  assert.equal(p.stemsPerPack, 10);
  assert.equal(p.stemLengthCm, 60);
  assert.equal(p.colour, 'röd');
  assert.equal(p.packUnit, '');
  assert.equal(p.orderMultiple, 1);
  assert.equal(M.normalizeSupplierProduct({ supplierProductId: 'X', name: 'y' }).stemsPerPack, 1);
  for (const bad of [{ name: 'x' }, { supplierProductId: 'a' }, { supplierProductId: 'a', name: 'b', stemsPerPack: 0 }, { supplierProductId: 'a', name: 'b', stemsPerPack: 1.5 }, { supplierProductId: 'a', name: 'b', stemLengthCm: -1 }]) {
    assert.throws(() => M.normalizeSupplierProduct(bad), /ModelValidationError|ogiltig/i, JSON.stringify(bad));
  }
});

test('normalisering av pris: moms får aldrig gissas och tid, valuta och källa måste vara rimliga', () => {
  const base = { supplierProductId: 'X', packPrice: 129, fetchedAt: '2026-10-08T06:00:00.000Z', strategy: 'api' };
  const q = M.normalizeQuote(base);
  assert.equal(q.currency, 'SEK');
  assert.equal(q.priceIncludesVat, null, 'okänt är okänt, inte "utan moms"');
  assert.equal(q.availability, 'unknown');
  assert.equal(q.verification, 'live');
  assert.equal(M.normalizeQuote({ ...base, strategy: 'vision' }).verification, 'ai_read');
  assert.equal(M.normalizeQuote({ ...base, strategy: 'manual' }).verification, 'manual');
  assert.equal(M.normalizeQuote({ ...base, packPrice: null }).packPrice, null);
  assert.equal(M.normalizeQuote({ ...base, packPrice: '129,50' }).packPrice, 129.5, 'text med decimalkomma accepteras');
  for (const bad of [{ packPrice: 0 }, { packPrice: -1 }, { packPrice: 'abc' }, { fetchedAt: 'igår' }, { strategy: 'magi' }, { currency: 'kronor' }, { availability: 'kanske' }, { forDeliveryDate: '8/10' }]) {
    assert.throws(() => M.normalizeQuote({ ...base, ...bad }), /ModelValidationError|ogiltig/i, JSON.stringify(bad));
  }
});

// ---------- läsa in ett lagrat v2-tillstånd ----------

test('loadV2: godkänner ett riktigt tillstånd och avvisar skräp', () => {
  const st = M.migrateV1toV2(fixtures()['egen lista med order, hemma och recept']);
  assert.ok(M.loadV2(JSON.stringify(st)));
  for (const bad of ['{ej json', 'null', '[]', '{"v":1}', '{"v":2}', '{"v":2,"products":[],"order":{"buketter":[]}}']) assert.equal(M.loadV2(bad), null, bad);
  // fält som saknas fylls i, men data tas aldrig bort
  const partial = clone(st); delete partial.quotes; delete partial.connections; delete partial.labels;
  const fixed = M.loadV2(JSON.stringify(partial));
  assert.ok(fixed && Array.isArray(fixed.quotes) && Array.isArray(fixed.connections) && fixed.labels);
  assert.ok(fixed.connections.some(c => c.id === 'conn_manual'), 'den egna listan finns alltid');
});

// ---------- det som appen exponerar som exempel ----------

test('exempeldata från appen migreras utan förlust', async () => {
  const app = await loadApp();
  const ex = JSON.parse(JSON.stringify(app.hook.exampleState()));
  app.close();
  const st = M.migrateV1toV2(ex);
  assert.equal(st.products.length, 13);
  assert.deepEqual(canonV1(M.downgradeV2toV1(st)), canonV1(ex));
});

test('pris i annan valuta, med moms eller med okänd moms används aldrig som kronor utan moms', () => {
  const mk = (extra) => {
    const st = withSupplier();
    const id = byName(st, 'Röd ros').id;
    M.confirmMatch(st, { productId: id, connectionId: 'conn_a', supplierProductId: 'A-200' });
    M.ingestSupplierData(st, 'conn_a', { products: [], quotes: [{ supplierProductId: 'A-200', packPrice: 77, fetchedAt: '2026-10-09T06:00:00.000Z', strategy: 'api', priceIncludesVat: false, ...extra }] }, { today: '2026-10-09' });
    return st;
  };
  assert.equal(byName(mk({}), 'Röd ros').pris, 77, 'kronor utan moms: används');
  assert.equal(byName(mk({ currency: 'EUR' }), 'Röd ros').pris, 120, 'euro: används inte, den egna listan gäller');
  assert.equal(byName(mk({ priceIncludesVat: true }), 'Röd ros').pris, 120, 'inkl. moms: används inte');
  assert.equal(byName(mk({ priceIncludesVat: null }), 'Röd ros').pris, 120, 'okänd moms: används inte');
  assert.equal(M.unusableReason(null), 'no_price');
  assert.equal(M.unusableReason({ packPrice: 5, currency: 'EUR', priceIncludesVat: false }), 'currency');
  assert.equal(M.unusableReason({ packPrice: 5, currency: 'SEK', priceIncludesVat: true }), 'vat_included');
  assert.equal(M.unusableReason({ packPrice: 5, currency: 'SEK', priceIncludesVat: null }), 'vat_unknown');
  assert.equal(M.unusableReason({ packPrice: 5, currency: 'SEK', priceIncludesVat: false }), null);
});
