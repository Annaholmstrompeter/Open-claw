// Grossistgränssnittet: kontraktssviten mot två helt olika falska grossister, registret, den skrivskyddade HTTP-hjälparen,
// och beviset att en andra grossist inte kräver ändringar i modellen, räknemotorn eller skärmarna.
import test from 'node:test';
import assert from 'node:assert/strict';
import M from '../public/js/core/model.js';
import { ConnectorError, createReadOnlyHttp, requireShape } from '../src/suppliers/contract.js';
import { createRegistry, registry } from '../src/suppliers/registry.js';
import { defineContractTests } from './support/contract-suite.mjs';
import { FAKES } from './support/fake-suppliers.mjs';
import { loadApp, v1State, item } from './helpers/app.mjs';

for (const f of Object.values(FAKES)) defineContractTests({ label: f.label, make: f.make, connect: f.connect, bad: f.bad, ids: f.ids, unknown: f.unknown, query: f.query, queryHits: f.queryHits });

// ---------- registret ----------

test('registret: lägg till, hämta och lista utan att visa något internt', () => {
  const a = FAKES.a.make().connector, b = FAKES.b.make().connector;
  const reg = createRegistry([a]).register(b);
  assert.deepEqual(reg.list(), [
    { id: 'fake-a', displayName: 'Feed-grossisten', authKinds: ['feedUrl'] },
    { id: 'fake-b', displayName: 'API-grossisten', authKinds: ['oauth'] }
  ]);
  assert.equal(reg.get('fake-b'), b);
  assert.equal(reg.has('fake-c'), false);
  assert.throws(() => reg.get('fake-c'), /okänd grossist/);
  assert.throws(() => reg.register(a), /finns redan/);
  assert.deepEqual(registry.list(), [], 'ingen riktig grossist är registrerad än, pilotgrossisten väljs först');
});

test('registret avvisar en ofullständig adapter med en lista på vad som saknas', () => {
  const reg = createRegistry();
  assert.throws(() => reg.register({ id: 'Dålig Id', capabilities: { authKinds: ['magi'], strategies: [] } }), err => {
    for (const part of ['id måste vara', 'displayName saknas', 'authKinds', 'strategies', 'searchCatalog', 'metoden getPrices saknas']) assert.match(err.message, new RegExp(part));
    return true;
  });
  assert.throws(() => reg.register(null), /adaptern saknas/);
});

// ---------- skrivskyddad HTTP ----------

test('HTTP-hjälparen: bara GET, bara https, bara tillåtna domäner', async () => {
  const seen = [];
  const http = createReadOnlyHttp({ allowHosts: ['ok.example'], fetchImpl: async (u, i) => { seen.push([u, i.method]); return { status: 200, headers: { get: () => null }, json: async () => ({ a: 1 }), text: async () => 'x' }; } });
  assert.deepEqual(Object.keys(http).sort(), ['getJson', 'getText']);
  assert.deepEqual(await http.getJson('https://ok.example/x'), { a: 1 });
  assert.deepEqual(seen, [['https://ok.example/x', 'GET']]);
  for (const bad of ['http://ok.example/x', 'https://annan.example/x', 'https://ok.example.evil.test/x', 'ftp://ok.example/x']) {
    const e = await http.getJson(bad).catch(x => x);
    assert.equal(e.code, 'UNSUPPORTED', bad);
  }
  assert.equal(seen.length, 1, 'nekade anrop lämnade aldrig hjälparen');
});

test('HTTP-hjälparen: svarskoder blir felkoder', async () => {
  const mk = (status, headers = {}, json) => createReadOnlyHttp({ allowHosts: ['ok.example'], fetchImpl: async () => ({ status, headers: { get: k => headers[k] ?? null }, json: json || (async () => ({})), text: async () => '' }) });
  const code = async (http) => (await http.getJson('https://ok.example/x').catch(e => e)).code;
  assert.equal(await code(mk(401)), 'AUTH_EXPIRED');
  assert.equal(await code(mk(403)), 'AUTH_EXPIRED');
  assert.equal(await code(mk(404)), 'NOT_FOUND');
  assert.equal(await code(mk(429, { 'retry-after': '12' })), 'RATE_LIMITED');
  assert.equal((await mk(429, { 'retry-after': '12' }).getJson('https://ok.example/x').catch(e => e)).retryAfterMs, 12000);
  assert.equal(await code(mk(500)), 'UNAVAILABLE');
  assert.equal(await code(mk(302)), 'UNAVAILABLE');
  assert.equal(await code(mk(200, {}, async () => { throw new SyntaxError('x'); })), 'SITE_CHANGED');
  const down = createReadOnlyHttp({ allowHosts: ['ok.example'], fetchImpl: async () => { throw new Error('nätet ligger nere'); } });
  assert.equal(await code(down), 'UNAVAILABLE');
});

test('ConnectorError och requireShape', () => {
  assert.throws(() => new ConnectorError('MAGI'), /okänd felkod/);
  const e = new ConnectorError('MFA_REQUIRED', 'tvåstegsverifiering');
  assert.equal(e.code, 'MFA_REQUIRED');
  assert.ok(e instanceof Error);
  assert.throws(() => requireShape({ a: 1 }, ['a', 'b'], 'rad'), err => err.code === 'SITE_CHANGED' && /"b" saknas/.test(err.message));
  assert.throws(() => requireShape(null, ['a'], 'rad'), err => err.code === 'SITE_CHANGED');
});

// ---------- en andra grossist: inget annat behöver ändras ----------

async function fetchInto(st, connId, fake) {
  const s = fake.make();
  const { credentials } = await s.connector.completeConnect(fake.connect);
  const conn = { credentials };
  const page = await s.connector.searchProducts(conn, '', { limit: 50 });
  const quotes = await s.connector.getPrices(conn, page.items.map(p => p.supplierProductId));
  M.upsertConnection(st, { id: connId, supplierId: s.connector.id, authKind: s.connector.capabilities.authKinds[0], status: 'connected' });
  M.ingestSupplierData(st, connId, { products: page.items, quotes }, { today: '2026-10-07', now: '2026-10-07T07:00:00.000Z', complete: true });
}

test('två grossister med olika format ger samma gemensamma format, och det som saknar användbart pris används inte', async () => {
  const st = M.migrateV1toV2(v1State({ items: [item(['Röd ros', 'Blommor', 10, 120, 'pack', '2026-10-01']), item(['Vit ros', 'Blommor', 10, 100, 'pack', '2026-10-01'])], buketter: [{ items: { 'Röd ros': 5 } }] }));
  await fetchInto(st, 'conn_a', FAKES.a);
  await fetchInto(st, 'conn_b', FAKES.b);
  const prod = n => st.products.find(p => p.name === n).id;
  const view = n => M.viewOf(st).priceList.items.find(i => i.namn === n);

  // båda grossisternas data har exakt samma form
  const shapeOf = o => Object.keys(o).sort().join(',');
  const aP = st.supplierProducts.find(p => p.connectionId === 'conn_a'), bP = st.supplierProducts.find(p => p.connectionId === 'conn_b');
  assert.equal(shapeOf(aP).replace(/,?(firstSeenAt|lastSeenAt)/g, ''), shapeOf(bP).replace(/,?(firstSeenAt|lastSeenAt)/g, ''));
  const aQ = st.quotes.find(q => q.connectionId === 'conn_a'), bQ = st.quotes.find(q => q.connectionId === 'conn_b');
  assert.equal(shapeOf(aQ), shapeOf(bQ));

  // Röd ros → A:s "Freedom Red 60 cm" (149 kr/10, SEK ex moms) och B:s "Rose Freedom Red 60cm" (1,45 € × 10, euro)
  M.confirmMatch(st, { productId: prod('Röd ros'), connectionId: 'conn_b', supplierProductId: 'B-2' });
  assert.deepEqual([view('Röd ros').pris, view('Röd ros').paket], [120, 10], 'bara B (euro) är matchad: används inte, den egna listan gäller');
  M.confirmMatch(st, { productId: prod('Röd ros'), connectionId: 'conn_a', supplierProductId: 'A-200' });
  assert.deepEqual([view('Röd ros').pris, view('Röd ros').paket, view('Röd ros').enhet], [149, 10, 'pack']);
  assert.equal(M.unusableReason(st.quotes.find(q => q.connectionId === 'conn_b' && q.supplierProductId === 'B-2')), 'currency');
  assert.equal(st.quotes.find(q => q.connectionId === 'conn_b' && q.supplierProductId === 'B-2').packPrice, 14.5, '1,45 € per stjälke × 10');
  // en grossist med moms inräknad används inte heller
  assert.equal(M.unusableReason(st.quotes.find(q => q.connectionId === 'conn_b' && q.supplierProductId === 'B-3')), 'currency');
  assert.equal(st.supplierProducts.find(p => p.connectionId === 'conn_b' && p.supplierProductId === 'B-3').stemsPerPack, 10);
  // koppla bort A: faller tillbaka på den egna listan, inte på B
  M.setConnectionStatus(st, 'conn_a', 'disconnected');
  assert.equal(view('Röd ros').pris, 120);
});

test('appen visar en grossists pris utan att räknemotor eller skärmar vet vilken grossist det är', async () => {
  const st = M.migrateV1toV2(v1State({ items: [item(['Röd ros', 'Blommor', 10, 120, 'pack', '2026-10-01'])], buketter: [{ items: { 'Röd ros': 5 } }] }));
  await fetchInto(st, 'conn_a', FAKES.a);
  M.confirmMatch(st, { productId: st.products[0].id, connectionId: 'conn_a', supplierProductId: 'A-200' });
  const app = await loadApp({ storage: { 'buketraknare.v2': JSON.stringify(st) } });
  assert.match(app.tileText('Röd ros'), /^Röd ros14,90 kr\/st · 10-pack/, '149 kr / 10, uppdaterat idag');
  assert.equal(app.calc().purchaseSum, 149);
  assert.doesNotMatch(app.text('body'), /fake-a|Feed-grossisten|conn_a/, 'ingen teknik syns för floristen');
  app.close();
});
