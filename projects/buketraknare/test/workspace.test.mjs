// Arbetsytan: kund, jobb (Event), arrangemang och rader (ArrangementItem). Egna tillägg i priset, men aldrig i inköpet.
// Alla momssatser är TESTDATA (floristens egen inställning "legacy-user-setting", aldrig verifierad).
import test from 'node:test';
import assert from 'node:assert/strict';
import M from '../public/js/core/money.js';
import T from '../public/js/core/tax.js';
import I from '../public/js/core/items.js';
import W from '../public/js/core/workspace.js';
import { fixtureMixed } from './support/tax-fixtures.mjs';

const { Money } = M;
const K = s => Money.fromDecimal(s);
const mj = s => K(s).toJSON();
const s = x => x.toDecimalString();
const kr = f => s(Money.fromFrac(f, 'HALF_UP', 'SEK'));

/** Klocka och id:n som är återskapningsbara: samma åtgärder ger exakt samma tillstånd. */
function makeCtx() { let n = 0, t = 0; return { now: () => new Date(Date.UTC(2026, 9, 7, 10, 0, t++)).toISOString(), newId: p => p + '_' + String(++n).padStart(3, '0') }; }
const A60 = { connectionId: 'conn_manual', supplierProductId: 'fp_avalanche-60' };
const A50 = { connectionId: 'conn_manual', supplierProductId: 'fp_avalanche-50' };
const catalog = (kind = 'LIVE') => ({
  'conn_manual:fp_avalanche-60': { name: 'Avalanche 60 cm', packSize: 10, packPrice: K('100'), source: { kind } },
  'conn_manual:fp_avalanche-50': { name: 'Avalanche 50 cm', packSize: 10, packPrice: K('80'), source: { kind } }
});
const own = (source, over = {}) => ({ source, name: 'Eget', quantity: 1, ...over });
const fixedPrice = (amount, basis = 'inc', extra = {}) => ({ mode: 'FIXED_SALE_PRICE', unitSalePrice: { amount: mj(amount), basis }, ...extra });

/** Emma & Johan: brudbukett (Avalanche, sidenband ur eget lager, dahlior ur egen trädgård) och 8 bordsdekorationer. */
function wedding(pricingOver = {}) {
  const ctx = makeCtx();
  const st = W.createWorkspace(ctx, { name: 'Blommor & Co', pricing: { defaultLaborFee: mj('125'), ...pricingOver } });
  const emma = W.addCustomer(st, ctx, { name: 'Emma Svensson', email: 'emma@example.test', phone: '070-0000000' });
  const ev = W.createEvent(st, ctx, { name: 'Emma & Johan', customerId: emma.id, type: 'wedding', eventDate: '2026-06-12', deliveryDate: '2026-06-11' });
  const bride = W.addArrangement(st, ctx, ev.id, { name: 'Brudbukett', quantity: 1 });
  const table = W.addArrangement(st, ctx, ev.id, { name: 'Bordsdekoration', quantity: 8 });
  const items = {
    avalanche: W.addItem(st, ctx, bride.id, { source: 'SUPPLIER', name: 'Avalanche 60 cm', articleRef: A60, quantity: 12 }),
    sidenband: W.addItem(st, ctx, bride.id, own('OWN_STOCK', { name: 'Sidenband', pricing: fixedPrice('75', 'inc', { unitCostBasis: mj('20') }) })),
    dahlia: W.addItem(st, ctx, bride.id, own('HOME_GROWN', { name: 'Dahlia från egen trädgård', quantity: 5, pricing: fixedPrice('25', 'inc', { unitExternalCost: mj('0') }) })),
    tableAv: W.addItem(st, ctx, table.id, { source: 'SUPPLIER', name: 'Avalanche 60 cm', articleRef: A60, quantity: 3 })
  };
  return { ctx, st, emma, ev, bride, table, items };
}
const price = (w, opts = {}) => W.priceEvent(w.st, w.ev.id, { catalog: catalog(), today: '2026-10-07', ...opts });
const arrOf = (res, id) => res.arrangements.find(a => a.arrangementId === id).result;

// ---------- Emma & Johan ----------
test('Emma & Johan: kundpriset räknas med både grossistartiklar och egna material', () => {
  const w = wedding();
  const r = price(w);
  assert.equal(r.status, 'OK');
  // Avalanche: 12 + 3 × 8 = 36 stjälkar, 4 förpackningar à 100 kr = 400 kr. Brudbuketten bär 12/36 av det: 133,33 kr × 1,5 = 200 kr
  // + sidenband 75 kr inkl. moms (60 exkl.) + dahlior 5 × 25 = 125 kr inkl. moms (100 exkl.) + arbete 125 kr = 485 kr exkl. moms
  const bride = arrOf(r, w.bride.id);
  assert.equal(kr(bride.calculated.exVat), '485.00');
  assert.equal(kr(bride.calculated.incVat), '606.25');
  assert.equal(s(bride.customerPrice), '610.00');
  assert.equal(kr(bride.presented.rounding), '3.75');
  // bordsdekoration: 3 av 36 stjälkar = 33,33 kr × 1,5 = 50 kr + arbete 125 = 175 kr exkl. moms = 218,75 kr inkl. moms → 220 kr
  assert.equal(kr(arrOf(r, w.table.id).calculated.incVat), '218.75');
  assert.equal(s(arrOf(r, w.table.id).customerPrice), '220.00');
  assert.equal(s(r.job.totalIncVat), '2370.00');                         // 610 + 8 × 220
  assert.equal(kr(r.job.calculated.incVat), '2356.25');                  // 606,25 + 8 × 218,75
  assert.equal(kr(r.job.presented.rounding), '13.75');
  assert.equal(r.job.priceStatus, 'CONFIRMED');
});

test('VAD SOM ANVÄNDS och VAD SOM MÅSTE BESTÄLLAS hålls isär: bara Avalanche blir ett inköpsbehov', () => {
  const w = wedding();
  const needs = W.purchaseNeeds(w.st, w.ev.id);
  assert.equal(needs.used.length, 4);                                   // allt som används i arrangemangen
  assert.deepEqual(needs.wholesaler.map(x => x.articleKey), ['conn_manual:fp_avalanche-60']);   // bara grossistartikeln ska beställas
  assert.deepEqual(needs.notOrdered.map(x => x.source), ['OWN_STOCK', 'HOME_GROWN']);          // sidenband och dahlior används men beställs inte
});
test('inköpsbehovet summerar antal per arrangemang över alla arrangemang (12 × 1 + 3 × 8 = 36)', () => {
  const w = wedding();
  const needs = W.purchaseNeeds(w.st, w.ev.id);
  assert.equal(needs.wholesaler.length, 1);
  assert.equal(needs.wholesaler[0].needed.toString(), '36');
  assert.deepEqual(needs.notOrdered.map(x => [x.name, x.source, x.quantity.toString()]), [['Sidenband', 'OWN_STOCK', '1'], ['Dahlia från egen trädgård', 'HOME_GROWN', '5']]);
  assert.equal(needs.elsewhere.length, 0);
  const r = price(w);
  assert.deepEqual(r.plan.requirements.map(q => [q.key, q.needed, q.packs, q.bought, q.leftover]), [['conn_manual:fp_avalanche-60', 36, 4, 40, 4]]);
  assert.equal(kr(r.plan.purchaseSum), '400.00');
});

test('egna tillägg ändrar kundpriset direkt men aldrig inköpsplanen', () => {
  const w = wedding();
  const before = price(w);
  const vase = W.addItem(w.st, w.ctx, w.bride.id, own('MANUAL', { name: 'Antik vas', pricing: fixedPrice('250') }));   // +250 kr, utan påhittat inköpspris
  const after = price(w);
  assert.equal(kr(arrOf(after, w.bride.id).calculated.incVat), '856.25');          // (485 + 200) exkl. moms × 1,25
  assert.equal(s(arrOf(after, w.bride.id).customerPrice), '860.00');
  assert.equal(s(after.job.totalIncVat), '2620.00');                                // 860 + 8 × 220
  assert.equal(JSON.stringify(after.plan.requirements), JSON.stringify(before.plan.requirements));   // samma inköp
  assert.equal(JSON.stringify(after.needs.wholesaler), JSON.stringify(before.needs.wholesaler));
  assert.equal(after.needs.wholesaler.length, 1);
  assert.equal(after.needs.notOrdered.some(x => x.itemId === vase.id), true);
  // ta bort sidenbandet: priset går ner direkt, inköpet är fortfarande detsamma
  W.removeItem(w.st, w.ctx, w.items.sidenband.id);
  const removed = price(w);
  assert.equal(kr(arrOf(removed, w.bride.id).calculated.incVat), '781.25');          // (685 − 60) × 1,25
  assert.equal(JSON.stringify(removed.plan.requirements), JSON.stringify(before.plan.requirements));
});

test('ett eget tillägg med noll inköpskostnad får ändå ett värde, och noll kalkylkostnad godtas inte tyst', () => {
  const w = wedding();
  assert.equal(w.items.dahlia.pricing.unitExternalCost.amount, '0');
  assert.equal(price(w).job.totalIncVat.amount > 0n, true);
  const solo = W.addArrangement(w.st, w.ctx, w.ev.id, { name: 'Bara dahlior' });
  W.addItem(w.st, w.ctx, solo.id, own('HOME_GROWN', { name: 'Dahlia', quantity: 5, pricing: fixedPrice('25') }));
  const r = arrOf(price(w), solo.id);
  assert.equal(kr(r.calculated.incVat), '281.25');                                   // dahlior 125 kr inkl. moms (100 exkl.) + arbete 125 kr exkl. moms = 225 × 1,25
  assert.throws(() => W.addItem(w.st, w.ctx, solo.id, own('HOME_GROWN', { name: 'Dahlia', quantity: 5, pricing: { mode: 'STANDARD_MARKUP', unitCostBasis: mj('0') } })), e => e instanceof I.ItemValidationError && e.problems[0].code === 'zero_cost_needs_value');
});

test('Avalanche 50 och 60 är olika inköpsrader med olika pris', () => {
  const w = wedding();
  W.addItem(w.st, w.ctx, w.table.id, { source: 'SUPPLIER', name: 'Avalanche 50 cm', articleRef: A50, quantity: 5 });
  const r = price(w);
  assert.deepEqual(r.plan.requirements.map(q => [q.key, q.needed]), [['conn_manual:fp_avalanche-60', 36], ['conn_manual:fp_avalanche-50', 40]]);   // 5 × 8 = 40
  assert.equal(W.purchaseNeeds(w.st, w.ev.id).wholesaler.length, 2);
});

test('hemmalager för ett jobb minskar inköpet (färre förpackningar)', () => {
  const w = wedding();
  W.setOnHand(w.st, w.ctx, w.ev.id, 'conn_manual:fp_avalanche-60', 16);
  const r = price(w);
  assert.deepEqual([r.plan.requirements[0].onHand, r.plan.requirements[0].toBuy, r.plan.requirements[0].packs], [16, 20, 2]);
  assert.equal(kr(r.plan.purchaseSum), '200.00');
  assert.throws(() => W.setOnHand(w.st, w.ctx, w.ev.id, 'k', -1), e => e instanceof W.WorkspaceError && e.problems[0].code === 'bad_on_hand');
});

test('frakt: avgiften fördelas på arrangemangen efter hur mycket grossistblommor de innehåller och ingår i kundpriset', () => {
  const w = wedding({ shipping: { fee: mj('79'), freeFrom: mj('600') } });
  const r = price(w);
  assert.equal(r.plan.shipping.rule, 'CHARGED'); assert.equal(kr(r.plan.shipping.total), '79.00');     // inköpet är 400 kr, under gränsen för fri frakt
  // brudbukettens andel: 79 kr × 133,33 ÷ 400 = 26,33 kr. Bordsdekorationens andel per styck: 79 kr × 33,33 ÷ 400 = 6,58 kr
  assert.equal(kr(r.plan.arrangements[0].freightShare), '26.33'); assert.equal(kr(r.plan.arrangements[1].freightShare), '6.58');
  assert.equal(kr(arrOf(r, w.bride.id).breakdown.materials.total), '179.67');                        // 133,33 + 26,33 frakt + 20 (sidenbandets kalkylkostnad, som inte påverkar priset)
  // brudbukett: (133,33 + 26,33 = 159,67) × 1,5 = 239,50 + 60 + 100 + 125 arbete = 524,50 exkl. moms = 655,625 inkl. moms → 660 kr
  assert.equal(s(arrOf(r, w.bride.id).customerPrice), '660.00');
  // bordsdekoration: (33,33 + 6,58) × 1,5 = 59,875 + 125 = 184,875 exkl. moms = 231,09375 inkl. moms → 235 kr
  assert.equal(s(arrOf(r, w.table.id).customerPrice), '235.00');
  assert.equal(s(r.job.totalIncVat), '2540.00');                                                      // 660 + 8 × 235
  const allocated = M.Frac.sum(r.plan.arrangements.map(a => a.freightShare.mul(M.Frac.of(BigInt(a.quantity)))));
  assert.equal(allocated.toString(), '7900');                                                         // hela frakten (7 900 ören) fördelas, exakt
  const free = price(wedding({ shipping: { fee: mj('79'), freeFrom: mj('400') } }));                  // exakt på gränsen: fri frakt
  assert.equal(free.plan.shipping.rule, 'FREE_FROM_REACHED'); assert.equal(s(free.job.totalIncVat), '2370.00');
});

test('prisstatus: ≈ när grossistpriset inte är livekontrollerat, ✓ när det är det, och egna material påverkar inte', () => {
  const w = wedding();
  const live = price(w), stale = price(w, { catalog: catalog('STALE') });
  assert.equal(arrOf(live, w.bride.id).priceStatus, 'CONFIRMED'); assert.equal(arrOf(live, w.bride.id).statusMark, '✓');
  assert.equal(arrOf(stale, w.bride.id).priceStatus, 'ESTIMATED'); assert.equal(arrOf(stale, w.bride.id).statusMark, '≈');
  assert.equal(stale.job.priceStatus, 'ESTIMATED');
  // ett arrangemang med bara egna material är bekräftat även när grossistpriserna är gamla
  const ownOnly = W.addArrangement(w.st, w.ctx, w.ev.id, { name: 'Bara eget' });
  W.addItem(w.st, w.ctx, ownOnly.id, own('OWN_STOCK', { pricing: fixedPrice('75') }));
  assert.equal(arrOf(price(w, { catalog: catalog('STALE') }), ownOnly.id).priceStatus, 'CONFIRMED');
});

test('saknat grossistpris: arrangemanget blir ofullständigt, men en rad med fast kundpris behöver inget inköpspris', () => {
  const w = wedding();
  const r = price(w, { catalog: { 'conn_manual:fp_avalanche-60': { packSize: 10, packPrice: null, source: { kind: 'LIVE' } } } });
  assert.equal(r.status, 'INCOMPLETE'); assert.equal(arrOf(r, w.bride.id).status, 'INCOMPLETE'); assert.equal(r.purchaseComplete, false);
  assert.deepEqual(r.plan.noPrice, ['conn_manual:fp_avalanche-60']);
  assert.equal(arrOf(r, w.bride.id).customerPrice, null);                          // aldrig 0 kr
  // en grossistartikel som säljs till ett fast pris kan prissättas även när grossistens pris saknas, men inköpet är ofullständigt
  const w2 = wedding();
  const solo = W.addArrangement(w2.st, w2.ctx, w2.ev.id, { name: 'Fast pris' });
  W.addItem(w2.st, w2.ctx, solo.id, { source: 'SUPPLIER', name: 'Sällsynt', articleRef: { connectionId: 'conn_manual', supplierProductId: 'fp_sallsynt' }, quantity: 3, pricing: fixedPrice('45') });
  const r2 = price(w2);
  assert.equal(arrOf(r2, solo.id).status, 'OK'); assert.equal(kr(arrOf(r2, solo.id).calculated.incVat), '291.25');   // 3 × 45 = 135 inkl. moms (108 exkl.) + arbete 125 exkl. = 233 × 1,25
  assert.equal(r2.purchaseComplete, false); assert.deepEqual(r2.plan.missing, ['conn_manual:fp_sallsynt']);
});

test('moms gäller även egna tillägg: kategori per rad, och ingen sats gissas när regeln saknas', () => {
  const w = wedding();
  const kruka = W.addItem(w.st, w.ctx, w.bride.id, own('OWN_STOCK', { name: 'Kruka', taxCategory: 'plants', pricing: fixedPrice('112') }));
  const partial = [T.createRuleSet({ id: 'p', version: 1, validFrom: '2000-01-01', rates: { arrangement_goods: 2500, labor: 2500 }, source: { kind: 'fixture' } })];
  const missing = price(w, { ruleSets: partial });
  assert.equal(missing.status, 'INCOMPLETE');
  assert.ok(arrOf(missing, w.bride.id).reasons.some(x => x.category === 'plants' && x.reason === 'rate_missing'));
  const rules = [fixtureMixed({ plants: 1200 })];                                      // påhittad sats, testdata
  const ok = price(w, { ruleSets: rules });
  assert.equal(ok.status, 'OK');
  assert.deepEqual(arrOf(ok, w.bride.id).vatByRate.map(g => g.rateBp), [1200, 2500]);
  assert.equal(kruka.taxCategory, 'plants');
});

test('kundtyp följer kunden och ändrar bara presentationen', () => {
  const w = wedding();
  W.updateCustomer(w.st, w.ctx, w.emma.id, { customerKind: 'BUSINESS' });
  const biz = price(w), priv = price(w, { customerKind: 'PRIVATE' });
  assert.equal(biz.customerKind, 'BUSINESS'); assert.equal(biz.job.headline.kind, 'EX_VAT_PLUS_VAT'); assert.equal(priv.job.headline.kind, 'INC_VAT');
  assert.equal(s(biz.job.totalIncVat), s(priv.job.totalIncVat));
});

test('jobbavgifter (leverans) ingår i summan, med eller utan moms', () => {
  const w = wedding();
  W.updateEvent(w.st, w.ctx, w.ev.id, { fees: [{ id: 'lev', kind: 'delivery', label: 'Leverans', amount: mj('125'), basis: 'inc', taxCategory: 'delivery' }] });
  const r = price(w);
  assert.equal(s(r.job.totalIncVat), '2495.00');                                      // 2370 + 125
  assert.throws(() => W.updateEvent(w.st, w.ctx, w.ev.id, { fees: [{ amount: mj('125'), basis: 'ungefär', taxCategory: 'delivery' }] }), e => e.problems[0].code === 'bad_fee');
});

test('tomma arrangemang kostar 0 kr, utan att arbetsavgiften läggs på', () => {
  const w = wedding();
  const empty = W.addArrangement(w.st, w.ctx, w.ev.id, { name: 'Tom' });
  const r = arrOf(price(w), empty.id);
  assert.equal(r.status, 'EMPTY'); assert.equal(s(r.customerPrice), '0.00');
});

test('tid i stället för standardavgift: minuter × timpris, och överstyrning per arrangemang', () => {
  const w = wedding();
  W.updateArrangement(w.st, w.ctx, w.table.id, { estimatedMinutes: 30 });             // 30 min × 250 kr/h = 125 kr (samma som standardavgiften)
  assert.equal(kr(arrOf(price(w), w.table.id).breakdown.labor.amount), '125.00');
  W.updateArrangement(w.st, w.ctx, w.table.id, { estimatedMinutes: 60 });
  assert.equal(kr(arrOf(price(w), w.table.id).breakdown.labor.amount), '250.00');
  W.updateArrangement(w.st, w.ctx, w.table.id, { laborOverride: { mode: 'fixed', fee: mj('90') } });
  assert.equal(kr(arrOf(price(w), w.table.id).breakdown.labor.amount), '90.00');
  W.updateArrangement(w.st, w.ctx, w.table.id, { markupOverrideBp: 10000 });
  assert.equal(arrOf(price(w), w.table.id).breakdown.markup.bp, 10000);
  assert.throws(() => W.updateArrangement(w.st, w.ctx, w.table.id, { laborOverride: { mode: 'daily' } }), e => e.problems[0].code === 'bad_labor');
});

// ---------- grundläggande hantering ----------
test('allt är enkel JSON och samma åtgärder ger exakt samma tillstånd', () => {
  const a = wedding(), b = wedding();
  assert.equal(JSON.stringify(a.st), JSON.stringify(b.st));
  assert.deepEqual(JSON.parse(JSON.stringify(a.st)), a.st);
  assert.deepEqual(W.validateWorkspace(a.st), []);
  for (const e of [...a.st.customers, ...a.st.events, ...a.st.arrangements, ...a.st.items]) {
    assert.equal(e.shopId, W.SHOP_ID); assert.equal(e.rev, 1); assert.equal(e.deletedAt, null); assert.ok(e.createdAt && e.updatedAt);
  }
});

test('uppdatering höjer rev och updatedAt, och en ogiltig uppdatering ändrar ingenting', () => {
  const w = wedding();
  const it = w.items.avalanche, before = JSON.stringify(it);
  W.updateItem(w.st, w.ctx, it.id, { quantity: 14 });
  assert.equal(it.quantity, '14'); assert.equal(it.rev, 2); assert.ok(it.updatedAt > it.createdAt);
  const mid = JSON.stringify(it);
  assert.notEqual(mid, before);
  assert.throws(() => W.updateItem(w.st, w.ctx, it.id, { requiresPurchase: false }), e => e instanceof I.ItemValidationError);
  assert.equal(JSON.stringify(it), mid);                                              // oförändrad
  assert.throws(() => W.updateItem(w.st, w.ctx, 'finns_inte', {}), e => e.problems[0].code === 'not_found');
  W.updateItem(w.st, w.ctx, w.items.sidenband.id, { pricing: { mode: 'STANDARD_MARKUP', unitCostBasis: mj('20') } });
  assert.equal(w.items.sidenband.pricing.mode, 'STANDARD_MARKUP');
  assert.equal(w.items.sidenband.pricing.unitSalePrice.basis, 'inc');                  // fältet finns kvar men används inte i det läget
});

test('mjuk radering: raderat finns kvar i tillståndet men syns inte och räknas inte', () => {
  const w = wedding();
  W.removeArrangement(w.st, w.ctx, w.table.id);
  assert.equal(w.st.arrangements.length, 2);                                          // finns kvar
  assert.equal(W.arrangementsOf(w.st, w.ev.id).length, 1);
  assert.equal(w.st.items.filter(i => i.arrangementId === w.table.id && i.deletedAt === null).length, 0);
  const r = price(w);
  assert.equal(r.arrangements.length, 1);
  assert.equal(r.plan.requirements[0].needed, 12);                                   // bordsdekorationens Avalanche räknas inte längre
  W.removeEvent(w.st, w.ctx, w.ev.id);
  assert.equal(W.eventsOf(w.st).length, 0);
  assert.throws(() => W.priceEvent(w.st, w.ev.id, { catalog: catalog(), today: '2026-10-07' }), e => e.problems[0].code === 'not_found');
  assert.deepEqual(W.validateWorkspace(w.st), []);
});

test('kontroll av indata: kund, jobb, arrangemang', () => {
  const ctx = makeCtx(), st = W.createWorkspace(ctx);
  const code = fn => { try { fn(); } catch (e) { return e.problems ? e.problems[0].code : 'other:' + e.message; } return null; };
  assert.equal(code(() => W.addCustomer(st, ctx, { name: ' ' })), 'required');
  assert.equal(code(() => W.addCustomer(st, ctx, { name: 'A', customerKind: 'STAT' })), 'bad_customer_kind');
  assert.equal(code(() => W.createEvent(st, ctx, { name: 'x', customerId: 'cus_999' })), 'not_found');
  assert.equal(code(() => W.createEvent(st, ctx, { name: 'x', eventDate: '12 juni' })), 'bad_date');
  assert.equal(code(() => W.createEvent(st, ctx, { name: 'x', type: 'fest' })), 'bad_event_type');
  assert.equal(code(() => W.createEvent(st, ctx, { name: 'x', usage: { horizon: 'snart' } })), 'bad_usage');
  assert.equal(code(() => W.createEvent(st, ctx, { name: '' })), 'required');
  const ev = W.createEvent(st, ctx, { name: 'Min order' });                            // utan kund (som "Min order" vid migrering)
  assert.equal(ev.customerId, null);
  assert.equal(code(() => W.addArrangement(st, ctx, ev.id, { name: 'a', quantity: 0 })), 'bad_quantity');
  assert.equal(code(() => W.addArrangement(st, ctx, ev.id, { name: 'a', quantity: 1.5 })), 'bad_quantity');
  assert.equal(code(() => W.addArrangement(st, ctx, ev.id, { name: 'a', estimatedMinutes: -5 })), 'bad_minutes');
  assert.equal(code(() => W.addArrangement(st, ctx, ev.id, { name: 'a', markupOverrideBp: 12.5 })), 'bad_markup');
  assert.equal(code(() => W.addArrangement(st, ctx, 'evt_999', { name: 'a' })), 'not_found');
  assert.equal(code(() => W.addItem(st, ctx, 'arr_999', own('OWN_STOCK', { pricing: fixedPrice('1') }))), 'not_found');
  assert.equal(W.customers(st).length, 0);
  assert.deepEqual(W.validateWorkspace(st), []);                                      // inget halvfärdigt sparades av de avvisade anropen
});

test('validateWorkspace: hittar trasiga referenser, dubbletter, andra butiker och ogiltiga rader', () => {
  const codes = mutate => { const w = wedding(); const st = JSON.parse(JSON.stringify(w.st)); mutate(st, w); return W.validateWorkspace(st).map(p => p.code); };
  assert.deepEqual(codes(() => {}), []);
  assert.ok(codes(st => { st.events[0].customerId = 'cus_999'; }).includes('dangling'));
  assert.ok(codes(st => { st.arrangements[0].eventId = 'evt_999'; }).includes('dangling'));
  assert.ok(codes(st => { st.items[0].arrangementId = 'arr_999'; }).includes('dangling'));
  assert.ok(codes(st => { st.items[1].id = st.items[0].id; }).includes('duplicate_id'));
  assert.ok(codes(st => { st.customers[0].shopId = 'shop_annan'; }).includes('bad_shop'));
  assert.ok(codes(st => { st.items[0].requiresPurchase = false; }).includes('requires_purchase_conflict'));
  assert.ok(codes(st => { st.items[1].pricing.mode = 'GRATIS'; }).includes('bad_pricing_mode'));
  assert.ok(codes(st => { st.items[1].articleRef = A60; }).includes('article_on_non_supplier'));
  assert.ok(codes(st => { st.arrangements[0].quantity = 0; }).includes('bad_quantity'));
  assert.ok(codes(st => { st.v = 99; }).includes('bad_version'));
  assert.ok(codes(st => { st.shop.pricing.rounding.step = mj('0'); }).includes('bad_pricing'));
  assert.ok(codes(st => { st.shop.pricing.rounding.mode = 'RUNDA'; }).includes('bad_pricing'));
  assert.ok(codes(st => { delete st.items[0].deletedAt; }).includes('bad_state'));
  assert.ok(codes(st => { st.customers = {}; }).includes('bad_state'));
  assert.deepEqual(W.validateWorkspace(null).map(p => p.code), ['bad_state']);
});

test('inget i arbetsytan bär en momssats, och egna rader skapar aldrig en SupplierProduct', () => {
  const w = wedding();
  const text = JSON.stringify(w.st);
  assert.equal(/rateBp|vatRate|"vat"/.test(text), false);
  assert.equal(w.st.items.filter(i => i.source !== 'SUPPLIER').every(i => i.articleRef === null), true);
  assert.deepEqual(w.st.materials, []);                                                // Mina material: reserverad plats, inte byggd
});

test('priset beror inte på extern inköpskostnad: den är bara en uppgift', () => {
  const w = wedding();
  const before = price(w).job.totalIncVat;
  W.updateItem(w.st, w.ctx, w.items.dahlia.id, { pricing: { unitExternalCost: mj('500') } });
  assert.equal(s(price(w).job.totalIncVat), s(before));
});

test('jobbet kan prissättas utan kund, och datumet för momsen kommer från leveransdatum, eventdatum eller today', () => {
  const ctx = makeCtx(), st = W.createWorkspace(ctx, { pricing: { defaultLaborFee: mj('125') } });
  const ev = W.createEvent(st, ctx, { name: 'Min order' });
  const a = W.addArrangement(st, ctx, ev.id, { name: 'Bukett' });
  W.addItem(st, ctx, a.id, own('OWN_STOCK', { pricing: fixedPrice('75') }));
  assert.throws(() => W.priceEvent(st, ev.id, {}), e => e.problems[0].code === 'no_tax_date');
  assert.equal(W.priceEvent(st, ev.id, { today: '2026-10-07' }).taxDate, '2026-10-07');
  W.updateEvent(st, ctx, ev.id, { eventDate: '2026-06-12' });
  assert.equal(W.priceEvent(st, ev.id, { today: '2026-10-07' }).taxDate, '2026-06-12');
  W.updateEvent(st, ctx, ev.id, { deliveryDate: '2026-06-11' });
  assert.equal(W.priceEvent(st, ev.id, { today: '2026-10-07' }).taxDate, '2026-06-11');
});

test('regeluppsättningen utan egna regler är floristens egen inställning, aldrig verifierad', () => {
  const w = wedding();
  const r = price(w);
  assert.deepEqual(r.job.rule.refs, ['legacy-user-setting@1']);
  assert.equal(r.job.rule.allVerified, false);
  assert.equal(arrOf(r, w.bride.id).breakdown.rule.verification.labor.sourceKind, 'user_setting');
});
