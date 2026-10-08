// Migrering av en befintlig användares data när appen startar: inget försvinner, den gamla lagringen (v1) rörs aldrig,
// ändringar efter migreringen sparas i v2, trasig lagring faller tillbaka rent, och rollback går att göra.
import test from 'node:test';
import assert from 'node:assert/strict';
import M from '../public/js/core/model.js';
import { loadApp, v1State, item } from './helpers/app.mjs';
import { fixtures } from './support/v1-fixtures.mjs';

const V1 = 'buketraknare.v1', V2 = 'buketraknare.v2';
const TODAY = '2026-10-07';
const ROS = ['Röd ros', 'Blommor', 10, 120, 'pack', TODAY];
const TULPAN = ['Tulpan', 'Blommor', 10, 55, 'bunt', '2026-09-20'];
const mine = () => v1State({
  items: [item(ROS), item(TULPAN), item(['Nejlika', 'Blommor', 20, 0, 'bunt'])],
  buketter: [{ items: { 'Röd ros': 7, 'Tulpan': 3, 'Pelargon': 2 } }, { size: 'stor', qty: 2, items: { 'Röd ros': 12 } }],
  hemma: { 'Röd ros': 2 }, recipes: [{ name: 'Min', items: { 'Tulpan': 5 } }], kalla: 'egen',
  wholesaler: { namn: 'Min grossist', url: 'https://g.example', ai: 'claude', mode: 'skarm', readCode: 'kod' }
});
const withV1 = async (st, extra = {}) => { const raw = JSON.stringify(st); return { raw, app: await loadApp({ storage: { [V1]: raw }, ...extra }) }; };

test('första start efter uppgradering: v2 skrivs, v1 ligger kvar helt orörd', async () => {
  const { raw, app } = await withV1(mine());
  const s = app.storage();
  assert.equal(s[V1], raw, 'v1-nyckeln är byte för byte densamma');
  const v2 = JSON.parse(s[V2]);
  assert.equal(v2.v, 2);
  assert.ok(v2.migratedFromV1At);
  assert.equal(v2.products.length, 3);
  app.close();
});

test('migreringen syns inte för användaren: samma varor, priser, buketter, recept och inställningar', async () => {
  const st = mine();
  const { app } = await withV1(st);
  const view = JSON.parse(JSON.stringify(app.hook.state()));
  assert.deepEqual(view.priceList.items.map(({ id, ...r }) => r), st.priceList.items);
  assert.deepEqual(view.settings, st.settings);
  assert.deepEqual(view.wholesaler, st.wholesaler);
  assert.deepEqual(view.order.buketter.map(b => [b.id, b.size, b.qty]), [['b1', 'medel', 1], ['b2', 'stor', 2]]);
  assert.match(app.text('#chips'), /Bukett 1 · Medel.*Bukett 2 · Stor ×2/);
  assert.equal(app.count('Röd ros'), 7);
  assert.match(app.text('#recipes'), /Min/);
  app.click('[data-act="chip"][data-id="b2"]');
  assert.equal(app.count('Röd ros'), 12);
  app.click('[data-act="chip"][data-id="b1"]');
  assert.match(app.text('#editor'), /Finns inte i prislistan: Pelargon \(ta bort\)/, 'borttagen vara behåller sin rad');
  app.close();
});

test('ändringar efter migreringen sparas i v2 och v1 förblir orörd; nästa start läser v2', async () => {
  const { raw, app } = await withV1(mine());
  app.add('Tulpan', 4);
  const stored = app.storage();
  assert.equal(stored[V1], raw, 'v1 ändras aldrig av den nya appen');
  app.close();

  const again = await loadApp({ storage: stored });
  assert.equal(again.count('Tulpan'), 7, 'v2 gäller, inte den äldre v1');
  again.close();
});

test('v2 går före en äldre v1 som blivit kvar', async () => {
  const old = mine();
  const { app } = await withV1(old);
  app.add('Tulpan');
  const stored = app.storage();
  app.close();
  const newer = await loadApp({ storage: { ...stored, [V1]: JSON.stringify(v1State({ items: [item(ROS)] })) } });
  assert.equal(newer.count('Tulpan'), 4);
  newer.close();
});

test('trasig v2: användaren faller tillbaka på sin v1 i stället för att tappa allt, och v2 repareras', async () => {
  for (const bad of ['{ej json', 'null', '{"v":2}', '{"v":2,"products":[],"order":{"buketter":[]}}', '{"v":3,"products":[]}']) {
    const raw = JSON.stringify(mine());
    const app = await loadApp({ storage: { [V1]: raw, [V2]: bad } });
    assert.equal(app.count('Röd ros'), 7, 'v1-data finns kvar för: ' + bad);
    assert.equal(JSON.parse(app.storage()[V2]).v, 2, 'v2 skrevs om');
    assert.equal(app.storage()[V1], raw);
    app.close();
  }
});

test('ingenting sparat, eller allt trasigt: ren tom start', async () => {
  for (const storage of [{}, { [V1]: '{ej json' }, { [V2]: '{ej json', [V1]: '[]' }]) {
    const app = await loadApp({ storage });
    assert.equal(app.$$('#tiles .tile-name').length, 21);
    assert.match(app.text('#fresh'), /Inga priser än/);
    app.close();
  }
});

test('full lagring (QuotaExceeded) när v2 ska skrivas: appen fungerar ändå och v1 är intakt', async () => {
  const raw = JSON.stringify(mine());
  const app = await loadApp({ storage: { [V1]: raw }, failWrite: V2 });
  assert.equal(app.count('Röd ros'), 7);
  app.add('Tulpan');
  assert.equal(app.count('Tulpan'), 4, 'går att arbeta i minnet');
  assert.equal(app.storage()[V1], raw);
  assert.equal(app.storage()[V2], undefined);
  app.close();
});

test('id:n är stabila: samma v1 ger samma id:n varje gång, och de ändras inte av omstart eller namnbyte', async () => {
  const st = mine();
  const a = await withV1(st), b = await withV1(st);
  const ids = x => [...x.app.hook.model().products.map(p => p.id)];
  assert.deepEqual(ids(a), ids(b));
  const before = ids(a);
  a.app.tab('prislista');
  a.app.set('input[data-pl="namn"][data-i="0"]', 'Freedom');
  const stored = a.app.storage();
  a.app.close(); b.app.close();
  const c = await loadApp({ storage: stored });
  assert.deepEqual([...c.hook.model().products.map(p => p.id)], before, 'samma id:n trots nytt namn och omstart');
  assert.equal(c.count('Freedom'), 7);
  c.close();
});

test('alla handbyggda tillstånd migreras och går att starta utan fel', async () => {
  for (const [name, st] of Object.entries(fixtures())) {
    const app = await loadApp({ storage: { [V1]: JSON.stringify(st) } });
    assert.equal(app.hook.model().v, 2, name);
    assert.equal(app.hook.state().priceList.items.length, st.priceList.items.length, name);
    app.close();
  }
});

test('rollback: v2 kan skrivas tillbaka som v1, och den gamla formen visar samma sak', async () => {
  const { app } = await withV1(mine());
  app.add('Tulpan', 2);
  app.tab('prislista');
  app.set('input[data-pl="pris"][data-i="1"]', '60');
  const downgraded = JSON.parse(JSON.stringify(app.hook.rollbackV1()));
  const shown = app.calc().purchaseSum;
  app.close();
  assert.equal(downgraded.v, 1);
  assert.equal(downgraded.priceList.items.find(i => i.namn === 'Tulpan').pris, 60);
  // en gammal version av appen (som bara läser v1) och den nya ger samma resultat på den nedgraderade datan
  const back = await loadApp({ storage: { [V1]: JSON.stringify(downgraded) } });
  assert.equal(back.calc().purchaseSum, shown);
  assert.equal(back.count('Tulpan'), 5);
  back.close();
});

// ---------- en andra källa: räknemotor och skärmar är oförändrade ----------

function seedWithSupplier(status = 'connected') {
  const st = M.migrateV1toV2(mine());
  M.upsertConnection(st, { id: 'conn_a', supplierId: 'fake-a', authKind: 'feedUrl', status });
  M.ingestSupplierData(st, 'conn_a', {
    products: [{ supplierProductId: 'A-200', name: 'Freedom Red 60 cm', colour: 'röd', stemsPerPack: 20, packUnit: 'kartong' }],
    quotes: [{ supplierProductId: 'A-200', packPrice: 200, currency: 'SEK', priceIncludesVat: false, fetchedAt: '2026-10-07T05:00:00.000Z', strategy: 'feed' }]
  }, { today: TODAY, now: '2026-10-07T05:00:01.000Z' });
  M.confirmMatch(st, { productId: st.products.find(p => p.name === 'Röd ros').id, connectionId: 'conn_a', supplierProductId: 'A-200' });
  return st;
}

test('en ansluten grossist styr pris och förpackning, utan att räknemotor eller skärm behöver veta något om den', async () => {
  const app = await loadApp({ storage: { [V2]: JSON.stringify(seedWithSupplier()) } });
  assert.match(app.tileText('Röd ros'), /^Röd ros10 kr\/st · kartong à 20/, '200 kr / 20 stjälkar, färskt idag');
  const b = Object.values(app.calc().buy).find(x => x.it.namn === 'Röd ros');
  assert.equal(b.it.paket, 20);
  assert.equal(b.it.pris, 200);
  // behov: 7 (bukett 1) + 12 × 2 (bukett 2, två stycken) = 31. Hemma 2 → köp 29 → 2 kartonger om 20 = 400 kr, 11 över.
  assert.deepEqual([b.need, b.have, b.toBuy, b.packs, b.cost, b.leftover], [31, 2, 29, 2, 400, 11]);
  app.close();
});

test('bortkopplad grossist: appen faller tillbaka på den egna listan, aldrig på 0 kr', async () => {
  const app = await loadApp({ storage: { [V2]: JSON.stringify(seedWithSupplier('disconnected')) } });
  assert.match(app.tileText('Röd ros'), /^Röd ros12 kr\/st · 10-pack/);
  app.close();
});

test('[dokumenterat] medan en ansluten grossist har pris på varan ändrar en manuell inläsning inte det visade priset', async () => {
  const app = await loadApp({ storage: { [V2]: JSON.stringify(seedWithSupplier()) } });
  app.click('[data-act="open-update"]');
  await app.settle();
  app.set('#upd-in', 'Namn;Antal per förp;Pris per förp\nRöd ros;10;999', 'input');
  app.click('[data-act="parse-update"]');
  app.click('[data-act="apply-update"]');
  await app.settle();
  assert.match(app.tileText('Röd ros'), /10 kr\/st · kartong à 20/, 'grossistens pris gäller fortfarande');
  const own = app.hook.model().quotes.filter(q => q.connectionId === 'conn_manual' && q.packPrice === 999);
  assert.equal(own.length, 1, 'men den manuella inläsningen sparades och gäller om grossisten kopplas bort');
  app.close();
});
