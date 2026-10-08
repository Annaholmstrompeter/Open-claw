// Offert (QuoteSnapshot) och kundorder (CustomerOrder): tre prisnivåer (beräknat, presenterat, överenskommet), oföränderlighet och sparat/öppnat igen.
// Alla satser är TESTDATA (floristens egen momsinställning 25 %, aldrig verifierad). Exemplet 186 kr + 120 % påslag + 125 kr arbete är pedagogiskt.
import test from 'node:test';
import assert from 'node:assert/strict';
import M from '../public/js/core/money.js';
import W from '../public/js/core/workspace.js';
import S from '../public/js/core/store.js';
import { fixtureMixed } from './support/tax-fixtures.mjs';

const { Money, Frac } = M;
const K = s => Money.fromDecimal(s);
const mj = s => K(s).toJSON();
const s = x => x.toDecimalString();
const TODAY = { today: '2026-10-07' };
const err = fn => { try { fn(); } catch (e) { return e.problems ? e.problems[0].code : 'other:' + e.message; } return null; };
function makeCtx() { let n = 0, t = 0; return { now: () => new Date(Date.UTC(2026, 9, 7, 10, 0, t++)).toISOString(), newId: p => p + '_' + String(++n).padStart(3, '0') }; }
const own = (source, over = {}) => ({ source, name: 'Eget', quantity: 1, ...over });

/** Bordsdekoration ×1 (186 kr + 120 % påslag + 125 kr arbete = 667,75 kr inkl. moms, presenterat 670 kr) och corsage ×4 (75 kr inkl. moms + arbete = 231,25, presenterat 235 kr). */
function job(pricing = {}) {
  const ctx = makeCtx(), st = W.createWorkspace(ctx, { pricing: { markupBp: 12000, defaultLaborFee: mj('125'), ...pricing } });
  const emma = W.addCustomer(st, ctx, { name: 'Emma Svensson' });
  const ev = W.createEvent(st, ctx, { name: 'Emma & Johan', customerId: emma.id, type: 'wedding', eventDate: '2026-06-12' });
  const table = W.addArrangement(st, ctx, ev.id, { name: 'Bordsdekoration', quantity: 1 });
  W.addItem(st, ctx, table.id, own('OWN_STOCK', { name: 'Material', pricing: { mode: 'STANDARD_MARKUP', unitCostBasis: mj('186') } }));
  const corsage = W.addArrangement(st, ctx, ev.id, { name: 'Corsage', quantity: 4 });
  W.addItem(st, ctx, corsage.id, own('OWN_STOCK', { name: 'Sidenband', pricing: { mode: 'FIXED_SALE_PRICE', unitSalePrice: { amount: mj('75') } } }));
  return { ctx, st, emma, ev, table, corsage };
}
const lineOf = (doc, id) => doc.lines.find(l => l.arrangementId === id);

// ---------- offerten fryser beräknat och presenterat ----------
test('offert: både det beräknade (exakta) och det presenterade (avrundade) priset fryses, med avrundningsregel och regelversion', () => {
  const j = job();
  const q = W.createQuote(j.st, j.ctx, j.ev.id, TODAY);
  assert.equal(q.status, 'draft'); assert.equal(q.version, 1); assert.equal(q.sentAt, null);
  const t = lineOf(q, j.table.id);
  assert.equal(Frac.fromJSON(t.calculated.incVat).toString(), '66775');                    // beräknat 667,75 kr (i ören)
  assert.equal(s(Money.fromJSON(t.presented.incVat)), '670.00');                          // presenterat 670 kr
  assert.equal(Frac.fromJSON(t.presented.rounding).toString(), '225');                    // skillnaden 2,25 kr, sparad
  assert.equal(Frac.fromJSON(t.presented.roundingRule.step).toString(), '500'); assert.equal(t.presented.roundingRule.mode, 'CEIL');
  assert.equal(s(Money.fromJSON(t.presented.exVat)), '536.00'); assert.equal(s(Money.fromJSON(t.presented.vat)), '134.00');
  assert.equal(t.priceStatus, 'CONFIRMED'); assert.deepEqual(t.ruleSetRefs, ['legacy-user-setting@1']); assert.equal(t.allVerified, false);
  const c = lineOf(q, j.corsage.id);
  assert.equal(c.quantity, 4); assert.equal(s(Money.fromJSON(c.presented.incVat)), '235.00'); assert.equal(Frac.fromJSON(c.calculated.incVat).toString(), '23125');
  assert.equal(Frac.fromJSON(q.totals.calculated.incVat).toString(), '159275');           // 667,75 + 4 × 231,25
  assert.equal(s(Money.fromJSON(q.totals.presented.incVat)), '1610.00');                  // 670 + 4 × 235
  assert.equal(q.taxDate, '2026-06-12'); assert.equal(q.customerKind, 'PRIVATE'); assert.equal(q.currency, 'SEK');
  assert.deepEqual(W.validateWorkspace(j.st), []);
  assert.doesNotThrow(() => JSON.stringify(j.st));
  assert.equal(t.profitabilityInputs.status, 'DATA_ONLY');                                // underlag för lönsamhet följer med, men bara som data
});

test('offerten är en ögonblicksbild: senare ändringar av jobbet ändrar den inte, och en ny version ersätter den gamla', () => {
  const j = job();
  const q1 = W.createQuote(j.st, j.ctx, j.ev.id, TODAY), frozen = JSON.stringify(q1);
  W.addItem(j.st, j.ctx, j.table.id, own('OWN_STOCK', { name: 'Vas', pricing: { mode: 'FIXED_SALE_PRICE', unitSalePrice: { amount: mj('250') } } }));
  W.updateArrangement(j.st, j.ctx, j.corsage.id, { quantity: 6 });
  assert.equal(JSON.stringify(q1), frozen);                                               // oförändrad
  const q2 = W.createQuote(j.st, j.ctx, j.ev.id, TODAY);
  assert.equal(q2.version, 2); assert.equal(q1.status, 'superseded'); assert.ok(q1.supersededAt);
  assert.equal(s(Money.fromJSON(q2.totals.presented.incVat)), '2330.00');                 // 920 (bordsdekoration med vas) + 6 × 235; räkningen står i nästa test
  assert.equal(Frac.fromJSON(lineOf(q1, j.table.id).calculated.incVat).toString(), '66775');   // den gamla offerten visar fortfarande 667,75
});
test('ny offertversion: priset följer jobbet vid skapandet', () => {
  const j = job();
  W.createQuote(j.st, j.ctx, j.ev.id, TODAY);
  W.addItem(j.st, j.ctx, j.table.id, own('OWN_STOCK', { name: 'Vas', pricing: { mode: 'FIXED_SALE_PRICE', unitSalePrice: { amount: mj('250') } } }));
  W.updateArrangement(j.st, j.ctx, j.corsage.id, { quantity: 6 });
  const q2 = W.createQuote(j.st, j.ctx, j.ev.id, TODAY);
  // bordsdekoration: 409,20 + 200 (250 inkl. moms) + 125 = 734,20 exkl. moms = 917,75 inkl. moms → 920. Corsage: 6 × 235 = 1410. Totalt 2330.
  assert.equal(s(Money.fromJSON(lineOf(q2, j.table.id).presented.incVat)), '920.00');
  assert.equal(s(Money.fromJSON(q2.totals.presented.incVat)), '2330.00');
  assert.deepEqual(W.quotesOf(j.st, j.ev.id).map(q => [q.version, q.status]), [[1, 'superseded'], [2, 'draft']]);
});

test('offert kan inte skapas medan priset är ofullständigt eller när jobbet är tomt', () => {
  const j = job();
  const sup = W.addItem(j.st, j.ctx, j.table.id, { source: 'SUPPLIER', name: 'Avalanche', articleRef: { connectionId: 'conn_manual', supplierProductId: 'fp_avalanche' }, quantity: 3 });
  assert.equal(err(() => W.createQuote(j.st, j.ctx, j.ev.id, TODAY)), 'incomplete_price');         // grossistpriset saknas
  assert.equal(W.quotesOf(j.st, j.ev.id).length, 0);
  const catalog = { 'conn_manual:fp_avalanche': { packSize: 10, packPrice: K('100'), source: { kind: 'LIVE' } } };
  assert.equal(W.createQuote(j.st, j.ctx, j.ev.id, { ...TODAY, catalog }).status, 'draft');
  W.removeItem(j.st, j.ctx, sup.id);
  const ctx = makeCtx(), st = W.createWorkspace(ctx), ev = W.createEvent(st, ctx, { name: 'Tom' });
  assert.equal(err(() => W.createQuote(st, ctx, ev.id, TODAY)), 'empty_job');
});

// ---------- kundordern fryser det överenskomna priset ----------
test('BERÄKNAT ≠ PRESENTERAT ≠ ÖVERENSKOMMET: 667,75 kr, 670 kr och sålt för 650 kr', () => {
  const j = job();
  const q = W.createQuote(j.st, j.ctx, j.ev.id, TODAY);
  const o = W.acceptQuote(j.st, j.ctx, q.id, { approvedBy: 'Anna', agreed: { [j.table.id]: mj('650') } });
  const lv = W.priceLevels(lineOf(o, j.table.id));
  assert.equal(lv.calculatedIncVat.toString(), '66775');                                  // beräknat 667,75
  assert.equal(s(lv.presentedIncVat), '670.00');                                          // rekommenderat/presenterat 670
  assert.equal(s(lv.agreedIncVat), '650.00');                                             // sålt för 650
  assert.equal(s(lv.adjustmentIncVat), '-20.00');                                         // 650 − 670
  assert.equal(lv.agreedVsCalculated.toString(), '-1775');                                // 650 − 667,75 = −17,75 kr
  assert.ok(!lv.agreedIncVat.toFrac().eq(lv.calculatedIncVat) && !lv.presentedIncVat.toFrac().eq(lv.calculatedIncVat) && !lv.agreedIncVat.eq(lv.presentedIncVat));   // alla tre är olika
  const l = lineOf(o, j.table.id);
  assert.deepEqual([s(Money.fromJSON(l.agreed.unitExVat)), s(Money.fromJSON(l.agreed.unitVat))], ['520.00', '130.00']);      // moms delad bakom kulisserna
  // offerten är orörd: den visar fortfarande det presenterade priset
  assert.equal(s(Money.fromJSON(lineOf(q, j.table.id).presented.incVat)), '670.00'); assert.equal(q.status, 'accepted');
  assert.equal(o.status, 'active'); assert.equal(o.version, 1); assert.equal(o.approvedBy, 'Anna'); assert.equal(o.quoteId, q.id);
  assert.deepEqual(W.validateWorkspace(j.st), []);
});

test('överenskommet pris kan vara både lägre och högre än det presenterade, och corsagen utan eget pris följer det presenterade', () => {
  const j = job();
  const q = W.createQuote(j.st, j.ctx, j.ev.id, TODAY);
  const o = W.acceptQuote(j.st, j.ctx, q.id, { approvedBy: 'Anna', agreed: { [j.table.id]: mj('650'), [j.corsage.id]: mj('250') } });
  assert.equal(s(W.priceLevels(lineOf(o, j.table.id)).adjustmentIncVat), '-20.00');
  assert.equal(s(W.priceLevels(lineOf(o, j.corsage.id)).adjustmentIncVat), '15.00');      // 250 − 235
  assert.equal(s(Money.fromJSON(o.totals.agreedIncVat)), '1650.00');                      // 650 + 4 × 250
  assert.equal(s(Money.fromJSON(o.totals.presentedIncVat)), '1610.00');
  assert.equal(Frac.fromJSON(o.totals.calculatedIncVat).toString(), '159275');            // det beräknade är oförändrat: 1 592,75
  assert.equal(s(Money.fromJSON(o.totals.adjustmentIncVat)), '40.00');                    // −20 + 4 × 15
  assert.deepEqual([s(Money.fromJSON(o.totals.agreedExVat)), s(Money.fromJSON(o.totals.agreedVat))], ['1320.00', '330.00']);
  const j2 = job();
  const q2 = W.createQuote(j2.st, j2.ctx, j2.ev.id, TODAY);
  const o2 = W.acceptQuote(j2.st, j2.ctx, q2.id, { approvedBy: 'Anna', agreed: { [j2.table.id]: mj('650') } });   // corsagen: inget överenskommet pris
  assert.equal(s(W.priceLevels(lineOf(o2, j2.corsage.id)).agreedIncVat), '235.00'); assert.equal(s(W.priceLevels(lineOf(o2, j2.corsage.id)).adjustmentIncVat), '0.00');
  assert.equal(s(Money.fromJSON(o2.totals.agreedIncVat)), '1590.00');                     // 650 + 4 × 235
  // utan något överenskommet pris gäller allt det presenterade
  const j3 = job(), o3 = W.acceptQuote(j3.st, j3.ctx, W.createQuote(j3.st, j3.ctx, j3.ev.id, TODAY).id, { approvedBy: 'Anna' });
  assert.equal(s(Money.fromJSON(o3.totals.agreedIncVat)), s(Money.fromJSON(o3.totals.presentedIncVat))); assert.equal(s(Money.fromJSON(o3.totals.adjustmentIncVat)), '0.00');
});

test('kontroll vid godkännande: vem, giltig offert och giltigt belopp', () => {
  const j = job();
  const q = W.createQuote(j.st, j.ctx, j.ev.id, TODAY);
  assert.equal(err(() => W.acceptQuote(j.st, j.ctx, q.id, {})), 'required');                                             // vem godkände?
  assert.equal(err(() => W.acceptQuote(j.st, j.ctx, q.id, { approvedBy: ' ' })), 'required');
  assert.equal(err(() => W.acceptQuote(j.st, j.ctx, q.id, { approvedBy: 'A', agreed: { arr_999: mj('1') } })), 'bad_agreed');
  assert.equal(err(() => W.acceptQuote(j.st, j.ctx, q.id, { approvedBy: 'A', agreed: { [j.table.id]: mj('-1') } })), 'bad_agreed');
  assert.equal(err(() => W.acceptQuote(j.st, j.ctx, q.id, { approvedBy: 'A', agreed: { [j.table.id]: Money.of(100n, 'EUR').toJSON() } })), 'bad_agreed');
  assert.equal(err(() => W.acceptQuote(j.st, j.ctx, q.id, { approvedBy: 'A', agreed: { [j.table.id]: 650 } })), 'bad_agreed');
  assert.equal(W.ordersOf(j.st, j.ev.id).length, 0); assert.equal(q.status, 'draft');                                // inget halvfärdigt sparades
  assert.equal(W.sendQuote(j.st, j.ctx, q.id).status, 'sent');
  assert.equal(err(() => W.sendQuote(j.st, j.ctx, q.id)), 'bad_transition');                                            // bara ett utkast kan skickas
  assert.equal(W.acceptQuote(j.st, j.ctx, q.id, { approvedBy: 'Anna' }).status, 'active');                              // godkännande av en skickad offert
  assert.equal(err(() => W.acceptQuote(j.st, j.ctx, q.id, { approvedBy: 'Anna' })), 'bad_transition');                  // redan godkänd
  const old = W.createQuote(j.st, j.ctx, j.ev.id, TODAY), newer = W.createQuote(j.st, j.ctx, j.ev.id, TODAY);
  assert.equal(old.status, 'superseded'); assert.equal(err(() => W.acceptQuote(j.st, j.ctx, old.id, { approvedBy: 'Anna' })), 'bad_transition');   // en ersatt offert kan inte godkännas
  assert.equal(newer.version, 3);
});

test('ny kundorder ersätter den gamla (ny version), och en order kan avbrytas', () => {
  const j = job();
  const q1 = W.createQuote(j.st, j.ctx, j.ev.id, TODAY);
  const o1 = W.acceptQuote(j.st, j.ctx, q1.id, { approvedBy: 'Anna', agreed: { [j.table.id]: mj('650') } });
  assert.equal(W.activeOrderOf(j.st, j.ev.id).id, o1.id);
  W.updateArrangement(j.st, j.ctx, j.corsage.id, { quantity: 6 });
  const q2 = W.createQuote(j.st, j.ctx, j.ev.id, TODAY);
  const o2 = W.acceptQuote(j.st, j.ctx, q2.id, { approvedBy: 'Anna', agreed: { [j.table.id]: mj('640') } });
  assert.equal(o2.version, 2); assert.equal(o1.status, 'superseded'); assert.ok(o1.supersededAt); assert.equal(q1.status, 'superseded'); assert.equal(q2.status, 'accepted');
  assert.equal(W.activeOrderOf(j.st, j.ev.id).id, o2.id);
  assert.equal(s(W.priceLevels(lineOf(o1, j.table.id)).agreedIncVat), '650.00');             // den gamla ordern visar fortfarande vad som gällde då
  assert.equal(W.cancelOrder(j.st, j.ctx, o2.id).status, 'cancelled'); assert.equal(W.activeOrderOf(j.st, j.ev.id), null);
  assert.equal(err(() => W.cancelOrder(j.st, j.ctx, o2.id)), 'bad_transition');
  assert.deepEqual(W.validateWorkspace(j.st), []);
});

test('moms på flera satser och jobbavgifter följer med ända till ordern', () => {
  const j = job();
  W.updateEvent(j.st, j.ctx, j.ev.id, { fees: [{ id: 'lev', kind: 'delivery', label: 'Leverans', amount: mj('125'), basis: 'inc', taxCategory: 'delivery' }] });
  const rules = [fixtureMixed({ labor: 600, delivery: 1200 })];                          // påhittade satser (testdata)
  const q = W.createQuote(j.st, j.ctx, j.ev.id, { ...TODAY, ruleSets: rules });
  const o = W.acceptQuote(j.st, j.ctx, q.id, { approvedBy: 'Anna', agreed: { [j.table.id]: mj('640'), [j.corsage.id]: mj('230') } });
  const rates = o.totals.vatByRate.map(g => g.rateBp);
  assert.deepEqual(rates, [600, 1200, 2500]);                                                // arbete 6 %, leverans 12 %, varor 25 % (testsatser)
  const sum = k => o.totals.vatByRate.reduce((a, g) => a.add(Money.fromJSON(g[k])), Money.zero('SEK'));
  assert.equal(s(sum('incVat')), s(Money.fromJSON(o.totals.agreedIncVat)));
  assert.equal(s(sum('exVat').add(sum('vat'))), s(Money.fromJSON(o.totals.agreedIncVat)));
  // Med 6 % på arbete och 12 % på leverans (testsatser) ändras de presenterade priserna: bordsdekoration 644,00 → 645 kr, corsage 207,50 → 210 kr.
  assert.deepEqual(q.lines.map(l => s(Money.fromJSON(l.presented.incVat))), ['645.00', '210.00']);
  assert.equal(s(Money.fromJSON(o.totals.presentedIncVat)), '1610.00');                      // 645 + 4 × 210 + 125 avgift
  assert.equal(s(Money.fromJSON(o.totals.agreedIncVat)), '1685.00');                         // 640 + 4 × 230 + 125 avgift
  assert.equal(s(Money.fromJSON(o.totals.adjustmentIncVat)), '75.00');                       // −5 + 4 × 20 (avgiften är oförändrad)
  assert.equal(o.fees.length, 1);
  assert.deepEqual(W.validateWorkspace(j.st), []);
});

// ---------- oföränderlighet ----------
const clone = o => JSON.parse(JSON.stringify(o));
test('checkImmutability: innehållet i en offert och en kundorder ändras aldrig, bara status går framåt, och inget raderas', () => {
  const j = job();
  const q = W.createQuote(j.st, j.ctx, j.ev.id, TODAY), o = W.acceptQuote(j.st, j.ctx, q.id, { approvedBy: 'Anna', agreed: { [j.table.id]: mj('650') } });
  const base = clone(j.st);
  const problems = fn => { const after = clone(base); fn(after); return W.checkImmutability(base, after); };
  assert.deepEqual(problems(() => {}), []);
  assert.ok(problems(a => { a.quotes[0].lines[0].presented.incVat = mj('1'); }).length > 0);                 // ändra presenterat pris
  assert.ok(problems(a => { a.quotes[0].lines[0].calculated.incVat = { n: '1', d: '1' }; }).length > 0);     // ändra beräknat pris
  assert.ok(problems(a => { a.orders[0].lines[0].agreed.unitIncVat = mj('1'); }).length > 0);                // ändra överenskommet pris
  assert.ok(problems(a => { a.orders[0].approvedBy = 'Någon annan'; }).length > 0);
  assert.ok(problems(a => { a.quotes.pop(); }).length > 0);                                                  // radera offert
  assert.ok(problems(a => { a.orders.pop(); }).length > 0);                                                  // radera order
  assert.ok(problems(a => { a.orders[0].status = 'active'; a.orders[0].lines.pop(); }).length > 0);
  assert.ok(problems(a => { a.quotes[0].status = 'draft'; }).length > 0);                                    // accepted → draft är inte tillåtet
  assert.ok(problems(a => { a.orders[0].status = 'cancelled'; a.orders[0].supersededAt = a.orders[0].supersededAt || '2026-10-08T00:00:00.000Z'; }).length === 0);   // active → cancelled är tillåtet
  assert.ok(problems(a => { a.quotes[0].status = 'superseded'; }).length === 0);                              // accepted → superseded är tillåtet
  assert.equal(o.status, 'active');
  // en skickad offert: tidpunkten för skickandet ändras aldrig i efterhand
  const k = job(), kq = W.createQuote(k.st, k.ctx, k.ev.id, TODAY); W.sendQuote(k.st, k.ctx, kq.id);
  const sent = clone(k.st), after = clone(sent); after.quotes[0].sentAt = '2030-01-01T00:00:00.000Z';
  assert.ok(sent.quotes[0].sentAt);
  assert.equal(W.checkImmutability(sent, after).length, 1);
});

test('lagringen avvisar ändringar av en offert eller order, men släpper igenom tillåtna statusövergångar', async () => {
  const mem = S.createMemoryAdapter(), ctx = makeCtx(), store = S.createWorkspaceStore(mem, W, ctx, { create: { pricing: { markupBp: 12000, defaultLaborFee: mj('125') } } });
  await store.open();
  const ids = (await store.update((d, c) => {
    const ev = W.createEvent(d, c, { name: 'J', eventDate: '2026-06-12' }), a = W.addArrangement(d, c, ev.id, { name: 'A' });
    W.addItem(d, c, a.id, own('OWN_STOCK', { name: 'M', pricing: { mode: 'STANDARD_MARKUP', unitCostBasis: mj('186') } }));
    return { ev: ev.id, a: a.id };
  })).result;
  const qid = (await store.update((d, c) => W.createQuote(d, c, ids.ev, TODAY).id)).result;
  const saved = mem.raw();
  const edit = await store.update(d => { d.quotes[0].lines[0].presented.incVat = mj('1'); });
  assert.equal(edit.ok, false); assert.equal(edit.reason, 'invalid');                                           // räkningen stämmer inte längre
  const sneaky = await store.update(d => { const l = d.quotes[0].lines[0]; l.presented.incVat = mj('700'); l.presented.exVat = mj('560'); l.presented.vat = mj('140'); l.presented.byRate = [{ rateBp: 2500, exVat: mj('560'), vat: mj('140'), incVat: mj('700') }];
    d.quotes[0].totals.presented.incVat = mj('700'); d.quotes[0].totals.presented.exVat = mj('560'); d.quotes[0].totals.presented.vat = mj('140'); l.presented.rounding = { n: '3225', d: '1' }; });   // 700 − 667,75 = 32,25 kr: allt stämmer ihop, men det är en ändring
  assert.equal(sneaky.ok, false); assert.equal(sneaky.reason, 'immutable');                                     // även en konsekvent ändring avvisas
  assert.equal(mem.raw(), saved);
  assert.equal((await store.update((d, c) => W.sendQuote(d, c, qid))).ok, true);                                // draft → sent är tillåtet
  const accepted = await store.update((d, c) => W.acceptQuote(d, c, qid, { approvedBy: 'Anna', agreed: { [ids.a]: mj('650') } }));
  assert.equal(accepted.ok, true);
  assert.equal((await store.update(d => { d.orders[0].lines[0].agreed.unitIncVat = mj('1'); })).ok, false);
  assert.equal((await store.update(d => { d.orders.pop(); })).reason, 'immutable');
});

test('validateWorkspace upptäcker en offert eller order vars summor inte stämmer', () => {
  const j = job();
  const q = W.createQuote(j.st, j.ctx, j.ev.id, TODAY), o = W.acceptQuote(j.st, j.ctx, q.id, { approvedBy: 'Anna', agreed: { [j.table.id]: mj('650') } });
  const codes = fn => { const st = clone(j.st); fn(st); return W.validateWorkspace(st).map(p => p.code); };
  assert.deepEqual(codes(() => {}), []);
  assert.ok(codes(st => { st.quotes[0].totals.presented.incVat = mj('1'); }).includes('bad_quote'));
  assert.ok(codes(st => { st.quotes[0].lines[0].presented.vat = mj('1'); }).includes('bad_quote'));
  assert.ok(codes(st => { st.quotes[0].lines[0].calculated.vat = { n: '1', d: '1' }; }).includes('bad_quote'));
  assert.ok(codes(st => { st.quotes[0].status = 'klar'; }).includes('bad_quote'));
  assert.ok(codes(st => { st.orders[0].totals.agreedIncVat = mj('1'); }).includes('bad_order'));
  assert.ok(codes(st => { st.orders[0].lines[0].adjustment.unitIncVat = mj('1'); }).includes('bad_order'));
  assert.ok(codes(st => { st.orders[0].lines[0].agreed.unitVat = mj('1'); }).includes('bad_order'));
  assert.ok(codes(st => { st.orders[0].approvedBy = ''; }).includes('bad_order'));
  assert.ok(codes(st => { st.orders[0].quoteId = 'qte_999'; }).includes('dangling'));
  assert.ok(codes(st => { st.quotes[0].eventId = 'evt_999'; }).includes('dangling'));
  assert.ok(codes(st => { st.orders.push({ ...clone(st.orders[0]), id: 'ord_dup' }); }).includes('duplicate_version'));
  assert.ok(codes(st => { st.orders = {}; }).includes('bad_state'));
  assert.equal(o.status, 'active');
});

// ---------- sparad och återöppnad order ----------
function fakeStorage() { const data = new Map(); return { getItem: k => (data.has(k) ? data.get(k) : null), setItem: (k, v) => { data.set(k, String(v)); }, data }; }
test('sparad och återöppnad order behåller alla tre prisnivåerna, exakt', async () => {
  const storage = fakeStorage(), ctx = makeCtx();
  const a = S.createWorkspaceStore(S.createLocalStorageAdapter(storage), W, ctx, { create: { pricing: { markupBp: 12000, defaultLaborFee: mj('125') } } });
  await a.open();
  const ids = (await a.update((d, c) => {
    const cu = W.addCustomer(d, c, { name: 'Emma' }), ev = W.createEvent(d, c, { name: 'Bröllop', customerId: cu.id, eventDate: '2026-06-12' });
    const t = W.addArrangement(d, c, ev.id, { name: 'Bordsdekoration' });
    W.addItem(d, c, t.id, own('OWN_STOCK', { name: 'Material', pricing: { mode: 'STANDARD_MARKUP', unitCostBasis: mj('186') } }));
    return { ev: ev.id, t: t.id };
  })).result;
  const orderId = (await a.update((d, c) => { const q = W.createQuote(d, c, ids.ev, TODAY); W.sendQuote(d, c, q.id); return W.acceptQuote(d, c, q.id, { approvedBy: 'Anna', agreed: { [ids.t]: mj('650') } }).id; })).result;
  const before = clone(a.state());
  // en helt ny session öppnar arbetsytan igen
  const b = S.createWorkspaceStore(S.createLocalStorageAdapter(storage), W, makeCtx());
  const opened = await b.open();
  assert.equal(opened.ok, true); assert.equal(opened.created, false);
  assert.deepEqual(opened.state, before);                                                          // allt är exakt som det var
  const order = opened.state.orders.find(o => o.id === orderId), line = order.lines[0];
  const lv = W.priceLevels(line);
  assert.equal(lv.calculatedIncVat.toString(), '66775');                                           // beräknat 667,75 kr, exakt bråk
  assert.equal(s(lv.presentedIncVat), '670.00');                                                   // presenterat
  assert.equal(s(lv.agreedIncVat), '650.00');                                                      // överenskommet
  assert.equal(s(lv.adjustmentIncVat), '-20.00'); assert.equal(lv.agreedVsCalculated.toString(), '-1775');
  const quote = opened.state.quotes.find(q => q.id === order.quoteId);
  assert.equal(quote.status, 'accepted'); assert.equal(Frac.fromJSON(quote.lines[0].calculated.incVat).toString(), '66775'); assert.equal(s(Money.fromJSON(quote.lines[0].presented.incVat)), '670.00');
  assert.equal(Frac.fromJSON(order.totals.calculatedIncVat).toString(), '66775'); assert.equal(s(Money.fromJSON(order.totals.presentedIncVat)), '670.00'); assert.equal(s(Money.fromJSON(order.totals.agreedIncVat)), '650.00');
  assert.equal(W.activeOrderOf(opened.state, ids.ev).id, orderId);
  // underlaget för lönsamhet följer med som data, men inget fält säger 'vinst' eller 'täckningsbidrag'
  const keys = new Set(); (function walk(x) { if (x && typeof x === 'object') for (const k of Object.keys(x)) { keys.add(k); walk(x[k]); } })(opened.state);
  assert.deepEqual([...keys].filter(k => /vinst|profit(?!abilityInputs)|margin|marginal|täckning|contribution/i.test(k)), []);
});
