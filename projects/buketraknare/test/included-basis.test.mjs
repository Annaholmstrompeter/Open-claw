// Preciseringar: PRICE_MISSING är inte EXPLICITLY_INCLUDED, fast pris med uttrycklig prisbas (INC_VAT / EX_VAT), kalkylkostnad trots noll i extern
// kostnad, underlag för lönsamhet (bara data) och delning av ett överenskommet pris. Alla satser är TESTDATA, inga verifierade regler.
import test from 'node:test';
import assert from 'node:assert/strict';
import M from '../public/js/core/money.js';
import T from '../public/js/core/tax.js';
import I from '../public/js/core/items.js';
import P from '../public/js/core/pricing.js';
import W from '../public/js/core/workspace.js';
import { fixtureFlat } from './support/tax-fixtures.mjs';
import { rng, intIn, pickOf } from './support/rng.mjs';

const { Money, Frac, ROUNDING, EconomyError } = M;
const K = s => Money.fromDecimal(s);
const mj = s => K(s).toJSON();
const F = (n, d = 1n) => Frac.of(BigInt(n), BigInt(d));
const s = x => x.toDecimalString();
const code = fn => { try { fn(); } catch (e) { return e instanceof EconomyError ? e.code : e && e.problems ? e.problems[0].code : 'other:' + e.message; } return null; };
const RS = [fixtureFlat(2500)];
const input = (over = {}) => ({ currency: 'SEK', taxDate: '2026-10-07', ruleSets: RS, markupBp: 12000, labor: null, costLines: [], rounding: { step: K('5'), mode: ROUNDING.CEIL }, ...over });
const std = (id, cost, over = {}) => ({ id, kind: 'flowers', cost, source: { kind: 'LIVE' }, ...over });
function makeCtx() { let n = 0, t = 0; return { now: () => new Date(Date.UTC(2026, 9, 7, 10, 0, t++)).toISOString(), newId: p => p + '_' + String(++n).padStart(3, '0') }; }
const own = (source, over = {}) => ({ source, name: 'Eget', quantity: 1, ...over });

// ---------- 1. saknat pris är något annat än uttryckligt "ingår / 0 kr" ----------
test('PRICE_MISSING ≠ EXPLICITLY_INCLUDED: ett pris som saknas ger en ofullständig kalkyl, "ingår" är ett giltigt 0 kr', () => {
  const missing = P.priceArrangement(input({ costLines: [std('kvistar', null)] }));
  assert.equal(missing.status, 'INCOMPLETE'); assert.equal(missing.customerPrice, null);
  assert.deepEqual(missing.reasons, [{ code: 'cost_missing', id: 'kvistar' }]); assert.deepEqual(missing.priceMissing, ['kvistar']);
  const noSale = P.priceArrangement(input({ costLines: [{ id: 'vas', kind: 'accessories', pricing: 'FIXED_SALE_PRICE' }] }));
  assert.equal(noSale.status, 'INCOMPLETE'); assert.deepEqual(noSale.priceMissing, ['vas']);

  const included = P.priceArrangement(input({ costLines: [{ id: 'kvistar', kind: 'flowers', pricing: 'INCLUDED', origin: 'HOME_GROWN' }] }));
  assert.equal(included.status, 'OK');                                                              // inte ofullständigt
  assert.equal(s(included.customerPrice), '0.00');                                                  // ett giltigt kundpris på 0 kr
  assert.equal(included.priceStatus, 'CONFIRMED');                                                  // floristens uttryckliga val
  assert.equal(included.breakdown.costLines[0].priceState, P.PRICE_STATE.INCLUDED);
  assert.equal(P.PRICE_STATE.INCLUDED, 'EXPLICITLY_INCLUDED'); assert.equal(P.PRICE_STATE.MISSING, 'PRICE_MISSING');
  assert.equal(included.priceMissing, undefined);
});

test('"ingår" bredvid andra rader: kunden debiteras 0 kr extra, och kostnaden finns kvar som underlag', () => {
  const base = P.priceArrangement(input({ labor: { mode: 'fixed', fee: K('125') }, costLines: [std('rosor', K('186'))] }));
  const withIncluded = P.priceArrangement(input({ labor: { mode: 'fixed', fee: K('125') }, costLines: [std('rosor', K('186')), { id: 'kvistar', kind: 'flowers', pricing: 'INCLUDED', cost: K('30'), origin: 'HOME_GROWN' }] }));
  assert.equal(s(withIncluded.customerPrice), s(base.customerPrice));                               // inget extra på kundpriset
  assert.equal(snapshot(withIncluded.calculated), snapshot(base.calculated));
  assert.equal(withIncluded.breakdown.profitabilityInputs.calculationCost.total.toString(), '21600');   // men 30 kr kalkylkostnad är med i underlaget
  assert.equal(P.priceArrangement(input({ costLines: [std('rosor', K('186')), { id: 'k', kind: 'flowers', pricing: 'INCLUDED' }] })).marginComplete, false);   // okänd kostnad: marginalen är ofullständig
  assert.equal(withIncluded.marginComplete, true);
});
const snapshot = x => JSON.stringify(x);

test('"ingår" kräver ingen momskategori: en kategori utan regel stoppar inte en rad som kostar 0 kr, men väl ett pris', () => {
  const partial = [T.createRuleSet({ id: 'p', version: 1, validFrom: '2000-01-01', rates: { arrangement_goods: 2500, labor: 2500 }, source: { kind: 'fixture' } })];
  const included = P.priceArrangement(input({ ruleSets: partial, costLines: [std('a', K('10')), { id: 'k', kind: 'flowers', pricing: 'INCLUDED', taxCategory: 'plants' }] }));
  assert.equal(included.status, 'OK');
  const priced = P.priceArrangement(input({ ruleSets: partial, costLines: [std('a', K('10')), std('k', K('5'), { taxCategory: 'plants' })] }));
  assert.equal(priced.status, 'INCOMPLETE');
});

test('rad: ingår är ett eget prissättningssätt, och ett pris som saknas har en egen status', () => {
  const kvistar = I.normalizeItem(own('HOME_GROWN', { id: 'i1', name: 'Kvistar från trädgården', quantity: 1, pricing: { mode: 'INCLUDED' } }), { currency: 'SEK' });
  assert.equal(kvistar.pricing.mode, 'INCLUDED'); assert.equal(kvistar.requiresPurchase, false); assert.equal(I.purchaseNeed(kvistar), null);
  assert.equal(I.priceState(kvistar), 'EXPLICITLY_INCLUDED');
  assert.equal(I.itemToCostLine(kvistar).pricing, 'INCLUDED'); assert.equal(I.itemToCostLine(kvistar).cost, null);
  const withCost = I.normalizeItem(own('HOME_GROWN', { id: 'i2', pricing: { mode: 'INCLUDED', unitCostBasis: mj('0') } }), { currency: 'SEK' });   // noll kalkylkostnad är tillåtet när det ingår
  assert.equal(I.itemToCostLine(withCost).cost.toString(), '0');
  const bad = spec => { try { I.normalizeItem(spec, { currency: 'SEK' }); return null; } catch (e) { return e.problems.map(p => p.code); } };
  assert.deepEqual(bad(own('HOME_GROWN', { id: 'i3', pricing: { mode: 'INCLUDED', unitSalePrice: { amount: mj('5'), basis: 'inc' } } })), ['included_has_price']);
  // saknat pris: standardpåslag utan kalkylkostnad, fast pris utan belopp
  assert.deepEqual(bad(own('HOME_GROWN', { id: 'i4', pricing: { mode: 'STANDARD_MARKUP' } })), ['cost_basis_missing']);
  assert.deepEqual(bad(own('HOME_GROWN', { id: 'i5', pricing: { mode: 'FIXED_SALE_PRICE' } })), ['sale_price_missing']);
  const sup = I.normalizeItem({ id: 's', source: 'SUPPLIER', articleRef: { connectionId: 'c', supplierProductId: 'p' }, quantity: 3 }, { currency: 'SEK' });
  assert.equal(I.priceState(sup, { status: 'no_price', cost: null }), 'PRICE_MISSING');
  assert.equal(I.priceState(sup, { status: 'ok', cost: F(100) }), 'MARKUP');
  assert.equal(I.priceState(sup), 'PRICE_MISSING');
  assert.deepEqual(Object.values(I.PRICE_STATE).sort(), Object.values(P.PRICE_STATE).sort());     // samma ord i båda modulerna
  // en rad som inte klarat kontrollen (fast pris utan belopp) ska aldrig kallas ett pris
  assert.equal(I.priceState({ source: 'OWN_STOCK', pricing: { mode: 'FIXED_SALE_PRICE', unitSalePrice: null } }), 'PRICE_MISSING');
  assert.equal(I.priceState({ source: 'OWN_STOCK', pricing: { mode: 'STANDARD_MARKUP', unitCostBasis: null } }), 'PRICE_MISSING');
});

test('arbetsyta: "Kvistar från egen trädgård" ingår, beställs inte och ger ett fullständigt pris', () => {
  const ctx = makeCtx(), st = W.createWorkspace(ctx, { pricing: { defaultLaborFee: mj('125') } });
  const ev = W.createEvent(st, ctx, { name: 'Födelsedag' }), a = W.addArrangement(st, ctx, ev.id, { name: 'Bukett' });
  W.addItem(st, ctx, a.id, own('OWN_STOCK', { name: 'Sidenband', pricing: { mode: 'FIXED_SALE_PRICE', unitSalePrice: { amount: mj('75'), basis: 'inc' } } }));
  const before = W.priceEvent(st, ev.id, { today: '2026-10-07' });
  const k = W.addItem(st, ctx, a.id, own('HOME_GROWN', { name: 'Kvistar från trädgården', pricing: { mode: 'INCLUDED' } }));
  const after = W.priceEvent(st, ev.id, { today: '2026-10-07' });
  assert.equal(after.status, 'OK'); assert.equal(s(after.job.totalIncVat), s(before.job.totalIncVat));
  assert.equal(after.needs.wholesaler.length, 0); assert.equal(after.needs.notOrdered.some(x => x.itemId === k.id), true);
  assert.equal(after.purchaseComplete, true);
  // ett grossistpris som SAKNAS gör däremot kalkylen ofullständig (PRICE_MISSING), till skillnad från "ingår"
  W.addItem(st, ctx, a.id, { source: 'SUPPLIER', name: 'Saknas', articleRef: { connectionId: 'conn_manual', supplierProductId: 'fp_saknas' }, quantity: 3 });
  const miss = W.priceEvent(st, ev.id, { today: '2026-10-07', catalog: {} });
  assert.equal(miss.status, 'INCOMPLETE'); assert.equal(miss.arrangements[0].result.customerPrice, null);
  assert.deepEqual(miss.arrangements[0].result.priceMissing.length, 1);
});

// ---------- 2. fast pris med uttrycklig prisbas ----------
test('fast pris INC_VAT: sidenband +75 kr är exakt 75 kr inkl. moms, momsen räknas bakom kulisserna', () => {
  for (const basis of ['inc', 'INC_VAT']) {
    const r = P.priceArrangement(input({ costLines: [{ id: 'band', kind: 'accessories', pricing: 'FIXED_SALE_PRICE', salePrice: { amount: K('75'), basis } }] }));
    assert.equal(s(r.customerPrice), '75.00', basis); assert.equal(s(r.saleExVat), '60.00'); assert.equal(s(r.vat), '15.00');
  }
  const viaPriceBasis = P.priceArrangement(input({ costLines: [{ id: 'band', kind: 'accessories', pricing: 'FIXED_SALE_PRICE', salePrice: { amount: K('75'), priceBasis: 'INC_VAT' } }] }));
  assert.equal(s(viaPriceBasis.customerPrice), '75.00');
});

test('fast pris EX_VAT: samma belopp exkl. moms ger ett högre kundpris inkl. moms', () => {
  for (const basis of ['ex', 'EX_VAT']) {
    const r = P.priceArrangement(input({ rounding: { step: Money.of(1n), mode: ROUNDING.CEIL }, costLines: [{ id: 'band', kind: 'accessories', pricing: 'FIXED_SALE_PRICE', salePrice: { amount: K('75'), basis } }] }));
    assert.equal(s(r.saleExVat), '75.00', basis); assert.equal(s(r.vat), '18.75'); assert.equal(s(r.customerPrice), '93.75');
  }
  assert.equal(code(() => P.priceArrangement(input({ costLines: [{ id: 'b', kind: 'accessories', pricing: 'FIXED_SALE_PRICE', salePrice: { amount: K('75'), basis: 'kanske' } }] }))), 'bad_sale_basis');
  assert.equal(code(() => P.priceArrangement(input({ costLines: [{ id: 'b', kind: 'accessories', pricing: 'FIXED_SALE_PRICE', salePrice: { amount: K('75') } }] }))), 'bad_sale_basis');   // basen måste anges uttryckligen
  assert.deepEqual({ ...P.PRICE_BASIS }, { INC_VAT: 'inc', EX_VAT: 'ex' });
});

test('rad: prisbasen lagras alltid uttryckligt, och synonymerna normaliseras', () => {
  const norm = sp => I.normalizeItem(own('OWN_STOCK', { id: 'x', pricing: { mode: 'FIXED_SALE_PRICE', unitSalePrice: sp } }), { currency: 'SEK' }).pricing.unitSalePrice;
  assert.deepEqual(norm({ amount: mj('75'), basis: 'inc' }), { amount: mj('75'), basis: 'inc' });
  assert.deepEqual(norm({ amount: mj('75'), basis: 'INC_VAT' }), { amount: mj('75'), basis: 'inc' });
  assert.deepEqual(norm({ amount: mj('75'), priceBasis: 'EX_VAT' }), { amount: mj('75'), basis: 'ex' });
  assert.equal('priceBasis' in norm({ amount: mj('75'), priceBasis: 'EX_VAT' }), false);                // ett enda fält sparas
  assert.throws(() => norm({ amount: mj('75') }), e => e.problems[0].code === 'bad_sale_basis');          // utan standard måste basen anges
  assert.throws(() => norm({ amount: mj('75'), basis: 'moms' }), e => e.problems[0].code === 'bad_sale_basis');
  const d = I.normalizeItem(own('OWN_STOCK', { id: 'x', pricing: { mode: 'FIXED_SALE_PRICE', unitSalePrice: { amount: mj('75') } } }), { currency: 'SEK', defaultBasis: 'INC_VAT' });
  assert.equal(d.pricing.unitSalePrice.basis, 'inc');
  assert.equal(I.defaultPriceBasis('PRIVATE'), 'inc'); assert.equal(I.defaultPriceBasis('BUSINESS'), 'ex'); assert.equal(I.defaultPriceBasis(undefined), 'inc');
});

test('arbetsyta: privatkund får inkl. moms som standard, företagskund exkl. moms, och datamodellen är inte låst till inkl. moms', () => {
  const ctx = makeCtx(), st = W.createWorkspace(ctx);
  const priv = W.addCustomer(st, ctx, { name: 'Emma', customerKind: 'PRIVATE' }), biz = W.addCustomer(st, ctx, { name: 'Firma AB', customerKind: 'BUSINESS' });
  const noCustomer = W.createEvent(st, ctx, { name: 'Min order' });
  const mk = (cust) => { const ev = W.createEvent(st, ctx, { name: 'J', customerId: cust ? cust.id : null }); return W.addArrangement(st, ctx, ev.id, { name: 'A' }); };
  const add = a => W.addItem(st, ctx, a.id, own('OWN_STOCK', { name: 'Sidenband', pricing: { mode: 'FIXED_SALE_PRICE', unitSalePrice: { amount: mj('75') } } }));
  assert.equal(add(mk(priv)).pricing.unitSalePrice.basis, 'inc');
  assert.equal(add(mk(biz)).pricing.unitSalePrice.basis, 'ex');
  assert.equal(add(mk(null)).pricing.unitSalePrice.basis, 'inc');
  assert.ok(noCustomer.id);
  // uttryckligt val vinner över standarden, åt båda hållen
  const a = mk(priv);
  assert.equal(W.addItem(st, ctx, a.id, own('OWN_STOCK', { name: 'x', pricing: { mode: 'FIXED_SALE_PRICE', unitSalePrice: { amount: mj('75'), basis: 'EX_VAT' } } })).pricing.unitSalePrice.basis, 'ex');
  // priset i kronor blir olika beroende på basen
  const price = basis => { const c2 = makeCtx(), w2 = W.createWorkspace(c2, { pricing: { rounding: { step: Money.of(1n).toJSON(), mode: 'CEIL' } } }); const e2 = W.createEvent(w2, c2, { name: 'J' }), a2 = W.addArrangement(w2, c2, e2.id, { name: 'A' });
    W.addItem(w2, c2, a2.id, own('OWN_STOCK', { name: 'x', pricing: { mode: 'FIXED_SALE_PRICE', unitSalePrice: { amount: mj('75'), basis } } })); return W.priceEvent(w2, e2.id, { today: '2026-10-07' }).job.totalIncVat; };
  assert.equal(s(price('INC_VAT')), '75.00'); assert.equal(s(price('EX_VAT')), '93.75');
});

// ---------- 3. kalkylkostnad trots noll i extern kostnad ----------
test('egenodlat får ett ekonomiskt värde: kalkylkostnad 25 kr trots att dagens externa inköpskostnad är 0 kr', () => {
  const ctx = makeCtx(), st = W.createWorkspace(ctx);                                  // standardpåslag 50 %, inget arbete
  const ev = W.createEvent(st, ctx, { name: 'J' }), a = W.addArrangement(st, ctx, ev.id, { name: 'Dahlior' });
  const d = W.addItem(st, ctx, a.id, own('HOME_GROWN', { name: 'Dahlia egen odling', quantity: 5, pricing: { mode: 'STANDARD_MARKUP', unitCostBasis: mj('25'), unitExternalCost: mj('0') } }));
  assert.equal(d.pricing.unitExternalCost.amount, '0');                                // purchaseCostToday = 0
  assert.equal(d.pricing.unitCostBasis.amount, '2500');                                // calculationCost = 25 kr
  const r = W.priceEvent(st, ev.id, { today: '2026-10-07' }).arrangements[0].result;
  assert.equal(s(Money.fromFrac(r.calculated.exVat, ROUNDING.HALF_UP, 'SEK')), '187.50');         // 5 × 25 × 1,5, inte 0
  assert.equal(s(r.customerPrice), '235.00');                                          // 234,375 inkl. moms → 235
  const inputs = r.breakdown.profitabilityInputs;
  assert.equal(inputs.calculationCost.total.toString(), '12500');                      // egenodlat värderat till 125 kr
  assert.equal(inputs.externalCost.total.toString(), '0'); assert.equal(inputs.externalCost.complete, true);   // men det kostade ingenting utifrån
  assert.deepEqual(Object.keys(inputs.calculationCost.byOrigin), ['HOME_GROWN']);
  // en kalkylkostnad på noll godtas inte tyst för standardpåslag (det vore noll värde)
  assert.throws(() => W.addItem(st, ctx, a.id, own('HOME_GROWN', { name: 'Gratis', pricing: { mode: 'STANDARD_MARKUP', unitCostBasis: mj('0') } })), e => e.problems[0].code === 'zero_cost_needs_value');
  // samma sak för eget lager
  const o = W.addItem(st, ctx, a.id, own('OWN_STOCK', { name: 'Sidenband', pricing: { mode: 'STANDARD_MARKUP', unitCostBasis: mj('20'), unitExternalCost: mj('0') } }));
  assert.equal(o.pricing.unitExternalCost.amount, '0');
  const r2 = W.priceEvent(st, ev.id, { today: '2026-10-07' }).arrangements[0].result;
  assert.equal(s(Money.fromFrac(r2.calculated.exVat, ROUNDING.HALF_UP, 'SEK')), '217.50');            // + 20 × 1,5 = 30
  assert.equal(r2.breakdown.profitabilityInputs.externalCost.total.toString(), '0');
});

// ---------- 5. underlag för lönsamhet: bara data ----------
test('underlag för lönsamhet: kundpris, material/kalkylkostnad, arbete och övrigt finns som data, men ingen vinst är definierad', () => {
  const r = P.priceArrangement(input({ markupBp: 5000, labor: { mode: 'fixed', fee: K('250') }, fees: [{ id: 'lev', kind: 'delivery', amount: K('40'), taxCategory: 'delivery' }],
    costLines: [std('rosor', K('300'), { origin: 'SUPPLIER', externalCost: K('300') }), std('band', K('110'), { kind: 'accessories', origin: 'OWN_STOCK', externalCost: K('0'), source: { kind: 'MANUAL' } })] }));
  const pi = r.breakdown.profitabilityInputs;
  assert.equal(pi.status, 'DATA_ONLY');
  assert.equal(pi.calculationCost.total.toString(), '41000');                                    // material/kalkylkostnad 410 kr
  assert.deepEqual(Object.fromEntries(Object.entries(pi.calculationCost.byKind).map(([k, v]) => [k, v.toString()])), { flowers: '30000', accessories: '11000', packaging: '0', freight: '0', other: '0' });
  assert.deepEqual(Object.fromEntries(Object.entries(pi.calculationCost.byOrigin).map(([k, v]) => [k, v.toString()])), { SUPPLIER: '30000', OWN_STOCK: '11000' });
  assert.equal(pi.charged.laborExVat.toString(), '25000'); assert.equal(pi.charged.feesExVat.toString(), '4000');      // arbete 250 kr, övrigt 40 kr
  assert.equal(pi.charged.goodsExVat.toString(), '61500');                                       // 410 × 1,5
  assert.equal(pi.customerPrice.presentedIncVat, r.customerPrice); assert.equal(pi.customerPrice.calculatedExVat.toString(), '90500');   // 615 + 250 + 40 = 905 kr exkl. moms
  assert.equal(pi.calculationCost.complete, true); assert.equal(pi.externalCost.total.toString(), '30000'); assert.equal(pi.externalCost.complete, true);
  assert.deepEqual(pi.calculationCost.missingLineIds, []);
  assert.equal(pi.charged.includedLines, 0);
  const withIncluded = P.priceArrangement(input({ costLines: [std('a', K('100')), { id: 'k1', kind: 'flowers', pricing: 'INCLUDED' }, { id: 'k2', kind: 'accessories', pricing: 'INCLUDED', cost: K('0') }] }));
  assert.equal(withIncluded.breakdown.profitabilityInputs.charged.includedLines, 2);            // två rader ingår, och det syns i underlaget
});
test('underlag för lönsamhet: okända kostnader redovisas som okända, aldrig som noll, och inga definierade "vinst"-fält finns', () => {
  const r = P.priceArrangement(input({ costLines: [std('a', K('100')), { id: 'vas', kind: 'accessories', pricing: 'FIXED_SALE_PRICE', salePrice: { amount: K('250'), basis: 'inc' } }] }));
  const pi = r.breakdown.profitabilityInputs;
  assert.equal(pi.calculationCost.complete, false); assert.deepEqual(pi.calculationCost.missingLineIds, ['vas']);
  assert.equal(pi.externalCost.complete, false); assert.deepEqual(pi.externalCost.missingLineIds, ['a', 'vas']);
  const names = [];
  (function walk(o) { for (const [k, v] of Object.entries(o || {})) { names.push(k); if (v && typeof v === 'object' && !(v instanceof Frac) && !(v instanceof Money)) walk(v); } })(pi);
  assert.equal(names.some(n => /profit|vinst|tackning|täckning|contribution/i.test(n)), false, 'inga definierade vinstbegrepp: ' + names.join(','));
});

// ---------- delning av ett överenskommet pris ----------
const presentedOf = (spec) => spec.map(([rateBp, inc]) => ({ rateBp, incVat: K(inc) }));
test('överenskommet pris delas på moms: lägre och högre än det presenterade, och exkl. moms + moms = överenskommet exakt', () => {
  const one = presentedOf([[2500, '670']]);
  const lower = P.allocateAgreed({ agreedIncVat: K('650'), presentedByRate: one });
  assert.deepEqual([s(lower.incVat), s(lower.exVat), s(lower.vat)], ['650.00', '520.00', '130.00']);
  const higher = P.allocateAgreed({ agreedIncVat: K('700'), presentedByRate: one });
  assert.deepEqual([s(higher.incVat), s(higher.exVat), s(higher.vat)], ['700.00', '560.00', '140.00']);
  const same = P.allocateAgreed({ agreedIncVat: K('670'), presentedByRate: one });
  assert.deepEqual([s(same.exVat), s(same.vat)], ['536.00', '134.00']);
  const odd = P.allocateAgreed({ agreedIncVat: K('651,33'), presentedByRate: one });
  assert.equal(s(odd.exVat.add(odd.vat)), '651.33');
  assert.equal(code(() => P.allocateAgreed({ agreedIncVat: K('-1'), presentedByRate: one })), 'negative_amount');
  assert.equal(code(() => P.allocateAgreed({ agreedIncVat: 650, presentedByRate: one })), 'not_money');
});
test('överenskommet pris på flera satser följer det presenterade prisets fördelning, och 0 kr eller ett presenterat pris på 0 hanteras', () => {
  const multi = presentedOf([[600, '53.40'], [1200, '225.67'], [2500, '125.93']]);        // presenterat 405,00
  const r = P.allocateAgreed({ agreedIncVat: K('400'), presentedByRate: multi });
  assert.equal(s(r.incVat), '400.00'); assert.equal(r.byRate.length, 3);
  for (const g of r.byRate) assert.equal(s(g.exVat.add(g.vat)), s(g.incVat));
  assert.equal(s(r.byRate.reduce((a, g) => a.add(g.incVat), Money.zero('SEK'))), '400.00');
  const zero = P.allocateAgreed({ agreedIncVat: K('0'), presentedByRate: multi });
  assert.equal(s(zero.incVat), '0.00'); assert.equal(s(zero.exVat), '0.00');
  assert.equal(code(() => P.allocateAgreed({ agreedIncVat: K('100'), presentedByRate: [] })), 'no_rate_for_agreed');
  const fb = P.allocateAgreed({ agreedIncVat: K('100'), presentedByRate: [], fallbackRateBp: 2500 });
  assert.deepEqual([s(fb.exVat), s(fb.vat)], ['80.00', '20.00']);
  assert.deepEqual(P.allocateAgreed({ agreedIncVat: K('0'), presentedByRate: [] }).byRate, []);
});
test('egenskaper: överenskommet pris delas alltid exakt (800 slumpade fall)', () => {
  const r = rng(555), int = intIn(r), pick = pickOf(r);
  for (let i = 0; i < 800; i++) {
    const groups = Array.from({ length: int(1, 4) }, () => ({ rateBp: pick([0, 600, 1200, 2500, 1234]), incVat: Money.of(BigInt(int(0, 5000000)), 'SEK') }));
    const agreed = Money.of(BigInt(int(0, 6000000)), 'SEK');
    const out = P.allocateAgreed({ agreedIncVat: agreed, presentedByRate: groups, fallbackRateBp: 2500 });
    assert.ok(out.incVat.eq(agreed) && out.exVat.add(out.vat).eq(agreed));
    for (const g of out.byRate) { assert.ok(g.exVat.add(g.vat).eq(g.incVat)); assert.ok(!g.exVat.isNegative() && !g.vat.isNegative()); }
    assert.deepEqual(out.byRate.map(g => g.rateBp), [...new Set(out.byRate.map(g => g.rateBp))].sort((a, b) => a - b));
  }
});

// ---------- tillägg efter mutationstestning ----------
test('bakåt: en rad som ingår är 0 kr och påverkar varken budgeten eller kräver ett pris', () => {
  const back = (over = {}) => ({ ...input({ labor: { mode: 'fixed', fee: K('125') }, ...over }), target: K('800') });
  const plain = P.budgetForTarget(back());
  const withIncluded = P.budgetForTarget(back({ costLines: [{ id: 'kvistar', kind: 'flowers', pricing: 'INCLUDED' }] }));
  assert.equal(withIncluded.status, 'OK');
  assert.equal(withIncluded.materialBudget.toString(), plain.materialBudget.toString());
  assert.equal(withIncluded.breakdown.goodsExVatAllowed.toString(), plain.breakdown.goodsExVatAllowed.toString());
});

test('överenskommet pris delas på satserna i proportion till det presenterade priset, inte lika', () => {
  // presenterat: 200 kr med 6 % moms och 800 kr med 25 % moms. Överenskommet 1 000 kr delas 20/80, inte 50/50.
  const r = P.allocateAgreed({ agreedIncVat: K('1000'), presentedByRate: [{ rateBp: 600, exVat: K('188.68'), vat: K('11.32'), incVat: K('200') }, { rateBp: 2500, exVat: K('640'), vat: K('160'), incVat: K('800') }] });
  assert.deepEqual(r.byRate.map(g => [g.rateBp, s(g.incVat), s(g.exVat), s(g.vat)]), [[600, '200.00', '188.68', '11.32'], [2500, '800.00', '640.00', '160.00']]);
  assert.equal(s(r.exVat), '828.68'); assert.equal(s(r.vat), '171.32'); assert.equal(s(r.incVat), '1000.00');
  const half = P.allocateAgreed({ agreedIncVat: K('500'), presentedByRate: [{ rateBp: 600, exVat: K('188.68'), vat: K('11.32'), incVat: K('200') }, { rateBp: 2500, exVat: K('640'), vat: K('160'), incVat: K('800') }] });
  assert.deepEqual(half.byRate.map(g => s(g.incVat)), ['100.00', '400.00']);
});

test('negativt överenskommet pris avvisas redan i delningen', () => {
  assert.equal(code(() => P.allocateAgreed({ agreedIncVat: K('-1'), presentedByRate: [{ rateBp: 2500, exVat: K('80'), vat: K('20'), incVat: K('100') }] })), 'negative_amount');
});

test('updatePricing: en ogiltig ändring avvisas och lämnar inställningarna som de var', () => {
  const ctx = makeCtx(), st = W.createWorkspace(ctx, {});
  const before = JSON.stringify(st.shop.pricing), rev = st.shop.rev;
  for (const patch of [{ markupBp: -1 }, { markupBp: 12.5 }, { rounding: { step: mj('0'), mode: 'CEIL' } }, { packMode: 'ALLA' }, { legacyVatPercent: 'x' }]) {
    assert.throws(() => W.updatePricing(st, ctx, patch), e => e.problems && e.problems.length > 0, JSON.stringify(patch));
    assert.equal(JSON.stringify(st.shop.pricing), before, JSON.stringify(patch)); assert.equal(st.shop.rev, rev);
  }
  W.updatePricing(st, ctx, { markupBp: 8000 });
  assert.equal(st.shop.pricing.markupBp, 8000); assert.equal(st.shop.rev, rev + 1); assert.deepEqual(W.validateWorkspace(st), []);
});
