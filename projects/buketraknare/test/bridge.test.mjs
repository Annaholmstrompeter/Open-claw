// Bryggan mellan den nuvarande appen (prislista, inställningar, order) och den nya arbetsytan.
// Katalog, inställningar, "Min order" som jobb (en gång), vägen tillbaka och en differens mot calc() på samma 145 tillstånd som övriga differenstester.
// Alla momssatser här är floristens egen inställning i testdata (aldrig verifierade).
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadApp, v1State, item } from './helpers/app.mjs';
import { fixtures, randomV1State, randomCleanV1State } from './support/v1-fixtures.mjs';
import { GOLDEN_FUZZ, GOLDEN_CLEAN } from './support/calc-extract.mjs';
import { floatFromFrac } from './support/exact-float.mjs';
import M from '../public/js/core/money.js';
import W from '../public/js/core/workspace.js';
import B from '../public/js/core/bridge.js';

const { Money } = M;
const TODAY = '2026-10-07';
const K = s => Money.fromDecimal(s);
const mj = s => K(s).toJSON();
const s = x => x.toDecimalString();
const near = (a, b) => Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));
const kr = f => floatFromFrac(f) / 100;
const clone = o => JSON.parse(JSON.stringify(o));
function makeCtx() { let n = 0, t = 0; return { now: () => new Date(Date.UTC(2026, 9, 7, 10, 0, t++)).toISOString(), newId: p => p + '_' + String(++n).padStart(4, '0') }; }
function deepFreeze(o) { if (o && typeof o === 'object' && !Object.isFrozen(o)) { Object.freeze(o); Object.values(o).forEach(deepFreeze); } return o; }

/** Den gamla appens vy (BRModel.viewOf) av ett sparat v1-tillstånd, med fast klocka 2026-10-07. */
async function viewAndCalc(v1) {
  const app = await loadApp({ storage: { 'buketraknare.v1': JSON.stringify(v1) } });
  const out = { view: clone(app.hook.state()), C: app.calc() };
  app.close();
  return out;
}
const IDS = view => view.priceList.items.map(i => i.id);
const sample = () => v1State({
  items: [item(['Röd ros', 'Blommor', 10, 120, 'pack', TODAY]), item(['Tulpan', 'Blommor', 10, 55, 'bunt', '2026-09-01']), item(['Pion', 'Blommor', 5, 0, '']), item(['Eukalyptus', 'Grönt', 10, 65, 'bunt', TODAY])],
  buketter: [{ size: 'medel', qty: 2, items: { 'Röd ros': 5, 'Eukalyptus': 2 } }, { size: 'liten', qty: 1, items: { 'Tulpan': 6 } }, { size: 'stor', qty: 1, items: {} }],
  hemma: { 'Röd ros': 2 }
});

// ---------- 1. katalog ----------
test('katalog: prislistan blir en grossistkatalog, pris som saknas är null (aldrig 0 kr), källan följer dagen', async () => {
  const { view } = await viewAndCalc(sample());
  const { catalog, warnings } = B.catalogFromView(deepFreeze(clone(view)), { today: TODAY });            // fryst vy: bryggan får inte ändra den
  assert.deepEqual(warnings, []);
  const id = name => view.priceList.items.find(i => i.namn === name).id;
  const ros = catalog[B.articleKey(id('Röd ros'))], tulpan = catalog[B.articleKey(id('Tulpan'))], pion = catalog[B.articleKey(id('Pion'))];
  assert.ok(B.articleKey(id('Röd ros')).startsWith('conn_manual:'));
  assert.equal(s(ros.packPrice), '120.00'); assert.equal(ros.packSize, 10); assert.equal(ros.source.kind, 'MANUAL');         // verifierat idag
  assert.equal(s(tulpan.packPrice), '55.00'); assert.equal(tulpan.source.kind, 'STALE');                                      // äldre pris: ungefärligt
  assert.equal(pion.packPrice, null); assert.equal(pion.packSize, 5); assert.equal(pion.source.kind, 'STALE');               // pris saknas: null, inte 0
  assert.equal(Object.keys(catalog).length, 4);
  assert.equal(B.productIdOf(B.articleKey('fp_x')), 'fp_x'); assert.equal(B.productIdOf('conn_x:fp_x'), null);
});

test('katalog: ett pris som inte är ett exakt belopp (tre decimaler) räknas som saknat och rapporteras, inget avrundas tyst', () => {
  const view = { priceList: { items: [{ id: 'a', namn: 'A', paket: 10, pris: 105.555, uppd: TODAY }, { id: 'b', namn: 'B', paket: 0, pris: '12,5', uppd: TODAY }, { id: 'c', namn: 'C', paket: 3.6, pris: 99.5 }] } };
  const { catalog, warnings } = B.catalogFromView(view, { today: TODAY });
  assert.equal(catalog['conn_manual:a'].packPrice, null); assert.deepEqual(warnings.map(w => [w.code, w.where]), [['bad_price', 'a']]);
  assert.equal(catalog['conn_manual:b'].packPrice, null); assert.equal(catalog['conn_manual:b'].packSize, 1);                  // som calc(): paket minst 1, ogiltigt pris = inget pris
  assert.equal(catalog['conn_manual:c'].packSize, 4); assert.equal(s(catalog['conn_manual:c'].packPrice), '99.50');           // som calc(): paket avrundas
});

// ---------- 2. inställningar ----------
test('inställningar: den gamla appens standardvärden blir arbetsytans prissättning, med samma avrundning som calc()', async () => {
  const { view } = await viewAndCalc(sample());
  const r = B.pricingFromSettings(view.settings);
  assert.equal(r.ok, true);
  assert.equal(r.pricing.markupBp, 5000); assert.equal(r.pricing.legacyVatPercent, '25');
  assert.deepEqual(r.pricing.rounding, { step: mj('5'), mode: 'CEIL' }); assert.equal(r.pricing.packMode, 'WHOLE_PACKS');
  assert.deepEqual(r.pricing.shipping, { fee: null, freeFrom: null }); assert.deepEqual(r.pricing.hourlyLaborRate, mj('250'));
  const used = B.pricingFromSettings({ ...view.settings, roundStep: 0, mode: 'used', shipFee: 79, freeFrom: 600, markupPct: 62.5 });
  assert.deepEqual(used.pricing.rounding, { step: mj('1'), mode: 'HALF_UP' });                                                // steg 0 = närmaste hela krona, som calc()
  assert.equal(used.pricing.packMode, 'USED_ONLY'); assert.equal(used.pricing.markupBp, 6250);
  assert.deepEqual(used.pricing.shipping, { fee: mj('79'), freeFrom: mj('600') });
});

test('inställningar: ett värde som inte går att uttrycka exakt ger problem, inte ett undantag och inte en tyst avrundning', () => {
  const base = { mode: 'whole', markupPct: 50, hourly: 250, vatPct: 25, roundStep: 5, shipFee: 0, freeFrom: 0 };
  const bad = patch => B.pricingFromSettings({ ...base, ...patch });
  for (const [patch, where] of [[{ markupPct: 12.345 }, 'påslaget'], [{ markupPct: -1 }, 'påslaget'], [{ markupPct: NaN }, 'påslaget'], [{ hourly: 250.123 }, 'timpriset'], [{ hourly: -5 }, 'timpriset'], [{ vatPct: 'x' }, 'momsen'], [{ roundStep: 'x' }, 'avrundningen'], [{ shipFee: 1e21 }, 'frakten'], [{ freeFrom: undefined }, 'frakten']]) {
    const r = bad(patch);
    assert.equal(r.ok, false, JSON.stringify(patch)); assert.ok(r.problems.some(p => p.where === where), JSON.stringify(patch) + ' → ' + JSON.stringify(r.problems));
  }
  assert.equal(B.pricingFromSettings(undefined).ok, false);
});

test('syncSettings: ändrar bara det som skiljer sig, och lämnar arbetsytan som den var om något inte går att uttrycka', async () => {
  const { view } = await viewAndCalc(sample());
  const ctx = makeCtx(), st = W.createWorkspace(ctx, {});
  assert.deepEqual(B.syncSettings(st, ctx, view.settings), { status: 'unchanged' });                // appens standardvärden är arbetsytans standardvärden
  const mine = { ...view.settings, markupPct: 80, roundStep: 10 };
  const first = B.syncSettings(st, ctx, mine);
  assert.equal(first.status, 'updated'); assert.deepEqual(first.changed.sort(), ['markupBp', 'rounding']);
  assert.equal(st.shop.pricing.markupBp, 8000); assert.deepEqual(st.shop.pricing.rounding.step, mj('10'));
  const rev = st.shop.rev;
  assert.deepEqual(B.syncSettings(st, ctx, mine), { status: 'unchanged' }); assert.equal(st.shop.rev, rev);       // inget ändras, ingen ny version
  const r = B.syncSettings(st, ctx, { ...mine, markupPct: 60, shipFee: 59 });
  assert.equal(r.status, 'updated'); assert.deepEqual(r.changed.sort(), ['markupBp', 'shipping']); assert.ok(st.shop.rev > rev);
  assert.equal(st.shop.pricing.markupBp, 6000); assert.deepEqual(st.shop.pricing.shipping.fee, mj('59'));
  const before = clone(st.shop.pricing);
  const bad = B.syncSettings(st, ctx, { ...mine, markupPct: 12.345 });
  assert.equal(bad.status, 'unsupported'); assert.deepEqual(st.shop.pricing, before);               // orört
  assert.deepEqual(W.validateWorkspace(st), []);
});

test('en ändring av inställningarna ändrar aldrig en redan skapad offert eller kundorder', async () => {
  const { view } = await viewAndCalc(sample());
  const ctx = makeCtx(), st = W.createWorkspace(ctx, {});
  B.syncSettings(st, ctx, view.settings);
  const cu = W.addCustomer(st, ctx, { name: 'K' }), ev = W.createEvent(st, ctx, { name: 'J', customerId: cu.id, eventDate: '2026-12-01' }), a = W.addArrangement(st, ctx, ev.id, { name: 'A' });
  W.addItem(st, ctx, a.id, { source: 'OWN_STOCK', name: 'Eget', quantity: 1, pricing: { mode: 'STANDARD_MARKUP', unitCostBasis: mj('100') } });
  const q = W.createQuote(st, ctx, ev.id, { today: TODAY }), o = W.acceptQuote(st, ctx, q.id, { approvedBy: 'Anna' });
  const frozenQ = JSON.stringify(q), frozenO = JSON.stringify(o);
  B.syncSettings(st, ctx, { ...view.settings, markupPct: 200, vatPct: 12, roundStep: 10 });
  assert.equal(JSON.stringify(st.quotes[0]), frozenQ); assert.equal(JSON.stringify(st.orders[0]), frozenO);
  assert.deepEqual(W.checkImmutability({ quotes: [JSON.parse(frozenQ)], orders: [JSON.parse(frozenO)] }, st), []);
});

// ---------- 3. order → jobb ----------
test('"Min order": den nuvarande ordern blir ett jobb med arrangemang, rader och hemmalager, och den gamla vyn rörs inte', async () => {
  const { view } = await viewAndCalc(sample());
  const frozen = deepFreeze(clone(view)), ctx = makeCtx(), st = W.createWorkspace(ctx, {});
  const r = B.connect(st, ctx, frozen);                                                         // en fryst vy: ett skrivförsök skulle kasta
  assert.equal(r.order.status, 'imported'); assert.equal(r.settings.status, 'unchanged');
  const ev = st.events[0];
  assert.equal(ev.name, 'Min order'); assert.equal(ev.customerId, null); assert.equal(ev.origin.kind, 'legacy_order');
  assert.equal(r.order.eventId, ev.id); assert.equal(st.arrangements.length, 3); assert.deepEqual(st.arrangements.map(a => [a.name, a.quantity, a.estimatedMinutes]), [['Bukett 1', 2, 25], ['Bukett 2', 1, 15], ['Bukett 3', 1, null]]);
  assert.deepEqual(st.arrangements.map(a => a.origin.bouquetId), ['b1', 'b2', 'b3']); assert.equal(st.arrangements[0].notes, 'Storlek: Medel');
  const rose = view.priceList.items.find(i => i.namn === 'Röd ros').id;
  assert.deepEqual(ev.onHand, { [B.articleKey(rose)]: 2 });
  const first = W.itemsOf(st, st.arrangements[0].id);
  assert.deepEqual(first.map(i => [i.source, i.name, i.quantity, i.articleRef && i.articleRef.connectionId]), [['SUPPLIER', 'Röd ros', '5', 'conn_manual'], ['SUPPLIER', 'Eukalyptus', '2', 'conn_manual'], ['OWN_STOCK', 'Emballage', '1', null]]);   // antal sparas som text, exakt
  assert.equal(first[2].kind, 'packaging'); assert.equal(first[2].pricing.mode, 'STANDARD_MARKUP'); assert.deepEqual(first[2].pricing.unitCostBasis, mj('25'));      // medel: 25 kr emballage
  assert.equal(W.itemsOf(st, st.arrangements[2].id).length, 0);                                  // en tom bukett ger ett tomt arrangemang, utan emballage
  assert.deepEqual(W.validateWorkspace(st), []);
  assert.deepEqual(view, JSON.parse(JSON.stringify(frozen)));                                    // vyn är oförändrad
});

test('"Min order" skapas bara en gång: ett jobb som redan finns, även ett borttaget, gör att inget importeras igen', async () => {
  const { view } = await viewAndCalc(sample());
  const ctx = makeCtx(), st = W.createWorkspace(ctx, {});
  const first = B.importLegacyOrder(st, ctx, view);
  assert.equal(first.status, 'imported');
  const snapshot = JSON.stringify(st);
  const again = B.importLegacyOrder(st, ctx, view);
  assert.deepEqual([again.status, again.eventId], ['exists', first.eventId]); assert.equal(JSON.stringify(st), snapshot);        // inget ändrades
  W.removeEvent(st, ctx, first.eventId);                                                          // floristen tar bort jobbet
  const after = JSON.stringify(st);
  assert.equal(B.importLegacyOrder(st, ctx, view).status, 'exists'); assert.equal(JSON.stringify(st), after);                    // och det kommer inte tillbaka av sig själv
  assert.equal(st.events.length, 1);
});

test('en tom order ger inget jobb, och en order som inte går att flytta över exakt flyttas inte alls', async () => {
  const empty = await viewAndCalc(v1State({ items: [item(['Röd ros', 'Blommor', 10, 120, 'pack', TODAY])] }));
  const ctx = makeCtx(), st = W.createWorkspace(ctx, {});
  assert.deepEqual(B.importLegacyOrder(st, ctx, empty.view), { status: 'nothing_to_import' }); assert.equal(st.events.length, 0);
  const onlyHome = await viewAndCalc(v1State({ items: [item(['Röd ros', 'Blommor', 10, 120, 'pack', TODAY])], hemma: { 'Röd ros': 3 } }));
  assert.equal(B.importLegacyOrder(makeWs(), makeCtx(), onlyHome.view).status, 'imported');       // bara hemmalager räknas som en order
  // bråkantal och orimliga antal kan inte uttryckas exakt
  const { view } = await viewAndCalc(sample());
  for (const [name, mutate] of [['bråkantal blommor', v => { v.order.buketter[0].items[IDS(v)[0]] = 2.5; }], ['bråkantal buketter', v => { v.order.buketter[0].qty = 1.5; }], ['noll buketter', v => { v.order.buketter[0].qty = 0; }],
    ['minuter', v => { v.settings.sizes[1].minutes = 12.5; }], ['emballage med tre decimaler', v => { v.settings.sizes[1].wrap = 25.123; }]]) {
    const v = clone(view); mutate(v);
    const c = makeCtx(), w = W.createWorkspace(c, {}), before = JSON.stringify(w);
    const r = B.importLegacyOrder(w, c, v);
    assert.equal(r.status, 'unsupported', name); assert.ok(r.problems.length > 0, name); assert.equal(JSON.stringify(w), before, name + ': arbetsytan ska vara orörd');
  }
});
function makeWs() { return W.createWorkspace(makeCtx(), {}); }

// ---------- 4. differens mot calc() ----------
const NAMES = [
  ...Object.keys(fixtures()).map(n => ['fixtur: ' + n, () => fixtures()[n]]),
  ...Array.from({ length: GOLDEN_FUZZ }, (_, n) => ['slump ' + n, () => randomV1State(n)]),
  ...Array.from({ length: GOLDEN_CLEAN }, (_, n) => ['ren ' + n, () => randomCleanV1State(n)])
];

test('differens: bryggan (katalog + inställningar + "Min order") ger samma inköp, frakt och priser som calc() i de 145 tillstånden, och vägen tillbaka ger tillbaka ordern', async t => {
  let states = 0, unsupported = 0, nothing = 0, rows = 0, jobs = 0, roundTrips = 0, maxDev = 0;
  const diffs = [], cmp = (name, what, want, got) => { if (!near(want, got)) diffs.push(`${name}: ${what} calc() ${want} ≠ brygga ${got}`); else maxDev = Math.max(maxDev, Math.abs(want - got)); };
  for (const [name, make] of NAMES) {
    const { view, C } = await viewAndCalc(make());
    const frozen = deepFreeze(clone(view));
    const ctx = makeCtx(), st = W.createWorkspace(ctx, {});
    const rep = B.connect(st, ctx, frozen);
    if (rep.settings.status === 'unsupported') { unsupported++; continue; }
    if (rep.order.status === 'nothing_to_import') { nothing++; continue; }
    if (rep.order.status === 'unsupported') { unsupported++; continue; }
    assert.equal(rep.order.status, 'imported', name);
    states++;
    const { catalog } = B.catalogFromView(frozen, { today: TODAY });
    const res = W.priceEvent(st, rep.order.eventId, { catalog, today: TODAY });
    assert.deepEqual([...Object.keys(C.buy)].map(k => B.articleKey(k)).sort(), res.plan.requirements.map(r => r.key).sort(), name + ': samma artiklar');
    assert.deepEqual([...C.missing].map(k => B.articleKey(k)).sort(), [...res.plan.missing].sort(), name + ': samma artiklar som saknas');
    assert.deepEqual([...C.noPrice].map(k => B.articleKey(k)).sort(), [...res.plan.noPrice].sort(), name + ': samma artiklar utan pris');
    cmp(name, 'purchaseSum', C.purchaseSum, kr(res.plan.purchaseSum)); cmp(name, 'ship', C.ship, kr(res.plan.shipping.total));
    C.rows.forEach((r, i) => {
      const a = res.arrangements[i].result;
      rows++;
      if (r.empty) { if (a.status !== 'EMPTY') diffs.push(`${name} rad ${i}: tom`); return; }
      if (r.incomplete) { if (a.status !== 'INCOMPLETE') diffs.push(`${name} rad ${i}: ska vara ofullständig`); return; }
      if (a.status !== 'OK') { diffs.push(`${name} rad ${i}: calc() ger pris, brygga ger ${a.status}`); return; }
      if (BigInt(Math.round(r.price * 100)) !== a.customerPrice.amount) diffs.push(`${name} rad ${i}: kundpris calc() ${r.price} ≠ brygga ${s(a.customerPrice)}`);
      if (r.approx !== (a.priceStatus === 'ESTIMATED')) diffs.push(`${name} rad ${i}: ca-markering calc() ${r.approx} ≠ brygga ${a.priceStatus}`);
    });
    if (!C.incomplete) { jobs++; if (BigInt(Math.round(C.total * 100)) !== res.job.totalIncVat.amount) diffs.push(`${name}: jobbets summa calc() ${C.total} ≠ brygga ${s(res.job.totalIncVat)}`); }
    else assert.equal(res.status, 'INCOMPLETE', name + ': ofullständigt jobb');

    // vägen tillbaka: samma order som den gamla appen hade
    const back = B.legacyOrderFromWorkspace(st, rep.order.eventId, view.settings);
    const o = view.order, keep = items => Object.fromEntries(Object.entries(items || {}).filter(([, n]) => n > 0));
    const want = {
      buketter: o.buketter.map(b => ({ id: b.id, size: b.size, qty: b.qty, items: keep(b.items) })),
      hemma: Object.fromEntries(Object.entries(o.hemma || {}).map(([k, v]) => [k, Math.max(0, Math.round(+v || 0))]).filter(([, n]) => n > 0)),
      active: o.active, seq: Math.max(o.seq || o.buketter.length, o.buketter.length)
    };
    assert.deepEqual(back.lost, [], name + ': inget ska gå förlorat på vägen tillbaka');
    assert.deepEqual(JSON.parse(JSON.stringify(back.order)), want, name + ': ordern ska komma tillbaka som den var');
    roundTrips++;
    assert.deepEqual(view, JSON.parse(JSON.stringify(frozen)), name + ': den gamla vyn ska vara orörd');
  }
  t.diagnostic(`jämförde ${states} av ${NAMES.length} tillstånd (${unsupported} kunde inte flyttas över exakt, ${nothing} hade ingen order), ${rows} rader, ${jobs} jobbsummor, ${roundTrips} rundturer, största avvikelse ${maxDev} kr`);
  assert.deepEqual(diffs, [], 'avvikelser mellan calc() och bryggan:\n' + diffs.slice(0, 25).join('\n'));
  assert.ok(states >= 90 && rows >= 150 && jobs >= 60 && roundTrips === states, `testet ska jämföra mycket: tillstånd ${states}, rader ${rows}, jobb ${jobs}`);
  assert.ok(maxDev < 1e-6, 'största avvikelse: ' + maxDev);
});

// ---------- 5. vägen tillbaka ----------
test('vägen tillbaka: ett jobb som floristen byggt om i den nya vyn säger vad som inte kan uttryckas i den gamla ordern', async () => {
  const { view } = await viewAndCalc(sample());
  const ctx = makeCtx(), st = W.createWorkspace(ctx, {});
  const rep = B.connect(st, ctx, view), evId = rep.order.eventId, first = st.arrangements[0];
  const rose = view.priceList.items.find(i => i.namn === 'Röd ros').id;
  W.addItem(st, ctx, first.id, { source: 'HOME_GROWN', name: 'Kvistar från egen trädgård', quantity: 3, pricing: { mode: 'INCLUDED' } });
  W.updateArrangement(st, ctx, first.id, { laborOverride: { mode: 'fixed', fee: mj('125') } });
  const own = W.addArrangement(st, ctx, evId, { name: 'Corsage', quantity: 4, estimatedMinutes: 15 });                            // eget arrangemang, utan ursprung
  W.addItem(st, ctx, own.id, { source: 'SUPPLIER', name: 'Röd ros', articleRef: { connectionId: 'conn_manual', supplierProductId: rose }, quantity: 1 });
  W.addItem(st, ctx, own.id, { source: 'SUPPLIER', name: 'Annan', articleRef: { connectionId: 'conn_other', supplierProductId: 'x1' }, quantity: 2 });
  const back = B.legacyOrderFromWorkspace(st, evId, view.settings);
  assert.deepEqual(back.lost.map(l => l.code).sort(), ['labor_not_representable', 'not_representable', 'not_representable', 'size_guessed']);
  const last = back.order.buketter[3];
  assert.deepEqual([last.id, last.size, last.qty, last.items], ['b4', 'liten', 4, { [rose]: 1 }]);                                  // 15 minuter = liten
  assert.deepEqual(back.order.buketter[0].items, { [rose]: 5, [view.priceList.items.find(i => i.namn === 'Eukalyptus').id]: 2 });
  assert.equal(back.order.seq, 4); assert.equal(back.order.active, 'b1');
  assert.throws(() => B.legacyOrderFromWorkspace(st, 'evt_finns_inte', view.settings), /finns inte/);
});
