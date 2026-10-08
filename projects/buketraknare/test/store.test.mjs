// Lagringsgränssnittet för arbetsytan: öppna, ändra atomärt, full lagring, trasig lagring och två flikar som ändrar samma sak.
import test from 'node:test';
import assert from 'node:assert/strict';
import M from '../public/js/core/money.js';
import I from '../public/js/core/items.js';
import W from '../public/js/core/workspace.js';
import S from '../public/js/core/store.js';

const { Money } = M;
const mj = s => Money.fromDecimal(s).toJSON();
function makeCtx() { let n = 0, t = 0; return { now: () => new Date(Date.UTC(2026, 9, 7, 10, 0, t++)).toISOString(), newId: p => p + '_' + String(++n).padStart(3, '0') }; }

/** En låtsas-localStorage som kommer ihåg vilka nycklar som rörts, och som kan göras "full". */
function fakeStorage(initial = {}) {
  const data = new Map(Object.entries(initial)), touched = new Set();
  const api = {
    full: false, broken: false,
    getItem(k) { touched.add(k); if (api.broken) throw new Error('lagringen går inte att läsa'); return data.has(k) ? data.get(k) : null; },
    setItem(k, v) { touched.add(k); if (api.full) { const e = new Error('full'); e.name = 'QuotaExceededError'; throw e; } data.set(k, String(v)); },
    raw: k => (data.has(k) ? data.get(k) : null), touched, data
  };
  return api;
}
const OLD_KEYS = ['buketraknare.v1', 'buketraknare.v2'];
const oldApp = () => Object.fromEntries(OLD_KEYS.map(k => [k, '{"gammal":"app"}']));
const addCustomer = name => (d, ctx) => W.addCustomer(d, ctx, { name }).id;

test('första gången skapas en tom arbetsyta och sparas', async () => {
  const mem = S.createMemoryAdapter(), st = S.createWorkspaceStore(mem, W, makeCtx());
  const o = await st.open();
  assert.equal(o.ok, true); assert.equal(o.created, true); assert.equal(o.saved, true);
  assert.equal(o.state.customers.length, 0); assert.equal(o.state.rev, 1);
  assert.deepEqual(JSON.parse(mem.raw()), o.state);
});

test('en ändring sparas och finns kvar när arbetsytan öppnas igen', async () => {
  const mem = S.createMemoryAdapter(), ctx = makeCtx();
  const a = S.createWorkspaceStore(mem, W, ctx); await a.open();
  const r = await a.update(addCustomer('Emma'));
  assert.equal(r.ok, true); assert.equal(r.saved, true); assert.equal(r.state.rev, 2); assert.equal(r.result.startsWith('cus_'), true);
  const b = S.createWorkspaceStore(mem, W, ctx), o = await b.open();
  assert.equal(o.created, false); assert.equal(o.state.customers[0].name, 'Emma'); assert.equal(o.state.rev, 2);
});

test('en ändring som kastar eller ger ogiltigt resultat sparar ingenting', async () => {
  const mem = S.createMemoryAdapter(), st = S.createWorkspaceStore(mem, W, makeCtx()); await st.open();
  await st.update(addCustomer('Emma'));
  const saved = mem.raw();
  const thrown = await st.update(d => { W.addCustomer(d, makeCtx(), { name: 'Halv' }); W.addCustomer(d, makeCtx(), { name: ' ' }); });   // andra anropet kastar
  assert.equal(thrown.ok, false); assert.equal(thrown.reason, 'error'); assert.equal(thrown.problems[0].code, 'required');
  assert.equal(mem.raw(), saved); assert.equal(st.state().customers.length, 1);                 // den första halvfärdiga ändringen finns inte heller
  const invalid = await st.update(d => { d.events.push({ id: 'evt_x', shopId: W.SHOP_ID, customerId: 'cus_999', name: 'Trasig', type: 'other', rev: 1, deletedAt: null, fees: [], onHand: {} }); });
  assert.equal(invalid.ok, false); assert.equal(invalid.reason, 'invalid'); assert.ok(invalid.problems.some(p => p.code === 'dangling'));
  assert.equal(mem.raw(), saved);
  const badItem = await st.update((d, ctx) => { const e = W.createEvent(d, ctx, { name: 'J' }); const a = W.addArrangement(d, ctx, e.id, { name: 'A' }); W.addItem(d, ctx, a.id, { source: 'OWN_STOCK', name: 'x', pricing: { mode: 'STANDARD_MARKUP', unitCostBasis: mj('0') } }); });
  assert.equal(badItem.ok, false); assert.ok(badItem.error instanceof I.ItemValidationError);
  assert.equal(mem.raw(), saved);
});

test('ändringar körs en i taget även när de startas samtidigt', async () => {
  const mem = S.createMemoryAdapter(), st = S.createWorkspaceStore(mem, W, makeCtx()); await st.open();
  const results = await Promise.all(Array.from({ length: 10 }, (_, i) => st.update(addCustomer('Kund ' + i))));
  assert.ok(results.every(r => r.ok && r.saved));
  const final = JSON.parse(mem.raw());
  assert.equal(final.customers.length, 10); assert.equal(final.rev, 11);
  assert.deepEqual(final.customers.map(c => c.name), Array.from({ length: 10 }, (_, i) => 'Kund ' + i));
});

test('trasig lagring skrivs aldrig över: open() ger ett fel och originalet är orört', async () => {
  const garbage = '{trasig json';
  const storage = fakeStorage({ 'buketraknare.workspace.v1': garbage, ...oldApp() });
  const st = S.createWorkspaceStore(S.createLocalStorageAdapter(storage), W, makeCtx());
  const o = await st.open();
  assert.equal(o.ok, false); assert.equal(o.reason, 'corrupt'); assert.equal(o.raw, garbage);
  assert.equal(storage.raw('buketraknare.workspace.v1'), garbage);
  assert.equal((await st.update(addCustomer('x'))).reason, 'not_open');                          // inget kan sparas över det trasiga
  assert.equal(storage.raw('buketraknare.workspace.v1'), garbage);
});

test('ogiltig men läsbar lagring avvisas med orsaker och lämnas orörd', async () => {
  const bad = JSON.stringify({ ...W.createWorkspace(makeCtx()), v: 99 });
  const storage = fakeStorage({ 'buketraknare.workspace.v1': bad });
  const o = await S.createWorkspaceStore(S.createLocalStorageAdapter(storage), W, makeCtx()).open();
  assert.equal(o.ok, false); assert.equal(o.reason, 'invalid'); assert.ok(o.problems.some(p => p.code === 'bad_version'));
  assert.equal(storage.raw('buketraknare.workspace.v1'), bad);
});

test('full lagring: arbetet fortsätter i minnet, användaren får veta att det inte sparades, och det sparas när det går igen', async () => {
  const storage = fakeStorage();
  const st = S.createWorkspaceStore(S.createLocalStorageAdapter(storage), W, makeCtx()); await st.open();
  storage.full = true;
  const r = await st.update(addCustomer('Emma'));
  assert.equal(r.ok, true); assert.equal(r.saved, false); assert.equal(r.writeError, 'write_failed');
  assert.equal(st.state().customers.length, 1);                                                     // finns kvar i minnet
  assert.equal(JSON.parse(storage.raw('buketraknare.workspace.v1')).customers.length, 0);           // men inte i lagringen
  storage.full = false;
  const r2 = await st.update(addCustomer('Anna'));
  assert.equal(r2.ok, true); assert.equal(r2.saved, true);                                          // ingen falsk konflikt efter ett misslyckat skrivförsök
  assert.deepEqual(JSON.parse(storage.raw('buketraknare.workspace.v1')).customers.map(c => c.name), ['Emma', 'Anna']);
});

test('lagring som inte går att läsa ger ett fel utan att kasta', async () => {
  const storage = fakeStorage(); storage.broken = true;
  const o = await S.createWorkspaceStore(S.createLocalStorageAdapter(storage), W, makeCtx()).open();
  assert.equal(o.ok, false); assert.equal(o.reason, 'unavailable');
});

test('två flikar som ändrar samma arbetsyta: den som kommer sist får en konflikt, ingen tyst överskrivning', async () => {
  const storage = fakeStorage();
  const ctx = makeCtx();
  const tab1 = S.createWorkspaceStore(S.createLocalStorageAdapter(storage), W, ctx), tab2 = S.createWorkspaceStore(S.createLocalStorageAdapter(storage), W, ctx);
  await tab1.open(); await tab2.open();
  assert.equal((await tab1.update(addCustomer('Från flik 1'))).ok, true);
  const late = await tab2.update(addCustomer('Från flik 2'));
  assert.equal(late.ok, false); assert.equal(late.reason, 'conflict'); assert.equal(late.currentRev, 2);
  assert.deepEqual(JSON.parse(storage.raw('buketraknare.workspace.v1')).customers.map(c => c.name), ['Från flik 1']);
  const re = await tab2.reload();
  assert.equal(re.ok, true); assert.equal(re.state.customers.length, 1);
  assert.equal((await tab2.update(addCustomer('Från flik 2'))).ok, true);                          // nu går det
  assert.deepEqual(JSON.parse(storage.raw('buketraknare.workspace.v1')).customers.map(c => c.name), ['Från flik 1', 'Från flik 2']);
});

test('samma sak i minnesadaptern', async () => {
  const mem = S.createMemoryAdapter(), ctx = makeCtx();
  const a = S.createWorkspaceStore(mem, W, ctx), b = S.createWorkspaceStore(mem, W, ctx);
  await a.open(); await b.open();
  await a.update(addCustomer('A'));
  assert.equal((await b.update(addCustomer('B'))).reason, 'conflict');
});

test('lagringen använder bara sin egen nyckel och rör aldrig den gamla appens lagring', async () => {
  const storage = fakeStorage(oldApp());
  const st = S.createWorkspaceStore(S.createLocalStorageAdapter(storage), W, makeCtx());
  await st.open(); await st.update(addCustomer('Emma')); await st.reload();
  assert.deepEqual([...storage.touched], [S.DEFAULT_KEY]);
  assert.equal(S.DEFAULT_KEY, 'buketraknare.workspace.v1');
  for (const k of OLD_KEYS) assert.equal(storage.raw(k), '{"gammal":"app"}');
});

test('hela flödet via lagringen: kund, jobb, arrangemang, rader, och priset efter att arbetsytan öppnats igen', async () => {
  const storage = fakeStorage(), ctx = makeCtx();
  const a = S.createWorkspaceStore(S.createLocalStorageAdapter(storage), W, ctx, { create: { pricing: { defaultLaborFee: mj('125') } } }); await a.open();
  const ids = (await a.update((d, c) => {
    const cu = W.addCustomer(d, c, { name: 'Emma' }), ev = W.createEvent(d, c, { name: 'Bröllop', customerId: cu.id, deliveryDate: '2026-06-11' });
    const ar = W.addArrangement(d, c, ev.id, { name: 'Brud' });
    W.addItem(d, c, ar.id, { source: 'OWN_STOCK', name: 'Sidenband', pricing: { mode: 'FIXED_SALE_PRICE', unitSalePrice: { amount: mj('75'), basis: 'inc' } } });
    return ev.id;
  })).result;
  const b = S.createWorkspaceStore(S.createLocalStorageAdapter(storage), W, ctx), o = await b.open();
  const priced = W.priceEvent(o.state, ids, {});
  assert.equal(priced.status, 'OK');
  assert.equal(priced.job.totalIncVat.toDecimalString(), '235.00');                                  // (60 + 125) exkl. moms = 185 × 1,25 = 231,25 → 235
  assert.doesNotThrow(() => JSON.stringify(priced));                                                  // hela resultatet går att spara som JSON
});
