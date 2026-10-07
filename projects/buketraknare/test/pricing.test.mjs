// Exakt prismotor (PricingEngine): kostnad → kundpris, målpris → råvarubudget, påslag mot marginal, arbete, moms per rad,
// prisstatus, regelversioner och jobbsummering. Alla satser är TESTDATA (fixtures), inga verifierade regler.
// Exemplet 186 kr + 120 % påslag + 125 kr arbete är ett pedagogiskt exempel, inte en regel: det blir 534,20 kr FÖRE moms.
import test from 'node:test';
import assert from 'node:assert/strict';
import M from '../public/js/core/money.js';
import T from '../public/js/core/tax.js';
import P from '../public/js/core/pricing.js';
import { fixtureFlat, fixtureMixed } from './support/tax-fixtures.mjs';
import { rng, intIn, pickOf } from './support/rng.mjs';

const { Money, Frac, ROUNDING, EconomyError } = M;
const K = s => Money.fromDecimal(s);
const F = (n, d = 1n) => Frac.of(BigInt(n), BigInt(d));
const code = fn => { try { fn(); } catch (e) { return e instanceof EconomyError ? e.code : 'other:' + e.message; } return null; };
const s = x => x.toDecimalString();
const kr = frac => s(Money.fromFrac(frac, ROUNDING.HALF_UP, 'SEK'));   // öresbråk till text, för läsbarhet i testerna
const snap = r => JSON.stringify(r);

const flat = bp => [fixtureFlat(bp)];
const line = (id, cost, kind = 'LIVE', over = {}) => ({ id, kind: 'flowers', cost, markup: true, source: { kind }, ...over });
const base = (over = {}) => ({
  currency: 'SEK', taxDate: '2026-10-07', ruleSets: flat(2500),
  costLines: [line('rosor', K('186'))], markupBp: 12000,
  labor: { mode: 'fixed', fee: K('125') }, rounding: { step: K('5'), mode: ROUNDING.CEIL }, ...over
});

// ---------- det korrigerade exemplet ----------
test('exempel: 186 kr + 120 % påslag + 125 kr arbete = 534,20 kr före moms, 670 kr kundpris (25 % är testsats)', () => {
  const r = P.priceArrangement(base());
  assert.equal(r.status, 'OK');
  assert.equal(kr(r.breakdown.markup.amount), '223.20');                 // påslag på 186 kr, inte på arbetet
  assert.equal(kr(r.breakdown.labor.amount), '125.00');
  assert.equal(kr(r.exact.saleExVatBeforeRounding), '534.20');           // INTE 534 inkl. moms
  assert.equal(kr(r.exact.vatBeforeRounding), '133.55');
  assert.equal(kr(r.exact.incVatBeforeRounding), '667.75');
  assert.equal(s(r.customerPrice), '670.00');                            // avrundat uppåt till jämna 5 kr: det kunden betalar
  assert.equal(kr(r.rounding), '2.25');
  assert.equal(s(r.saleExVat), '536.00'); assert.equal(s(r.vat), '134.00');
  assert.equal(s(r.saleExVat.add(r.vat)), s(r.customerPrice));           // exkl. moms + moms = kundpris, exakt
  assert.deepEqual(r.headline, { kind: 'INC_VAT', amount: r.customerPrice });
  assert.equal(r.vatByRate.length, 1);
});

test('exempel: samma kalkyl med andra avrundningar (öre, hela kronor, nedåt)', () => {
  const at = (step, mode) => P.priceArrangement(base({ rounding: { step, mode } }));
  const exact = at(Money.of(1n), ROUNDING.CEIL);
  assert.equal(s(exact.customerPrice), '667.75'); assert.equal(s(exact.saleExVat), '534.20'); assert.equal(s(exact.vat), '133.55'); assert.equal(kr(exact.rounding), '0.00');
  const whole = at(K('1'), ROUNDING.HALF_UP);
  assert.equal(s(whole.customerPrice), '668.00'); assert.equal(s(whole.saleExVat), '534.40'); assert.equal(s(whole.vat), '133.60');
  assert.equal(s(at(K('5'), ROUNDING.FLOOR).customerPrice), '665.00');
  assert.equal(s(at(K('10'), ROUNDING.CEIL).customerPrice), '670.00');
  assert.equal(s(at(K('50'), ROUNDING.CEIL).customerPrice), '700.00');
});

test('avrundning uppåt: exakt multipel lämnas orörd, ett öre över går till nästa steg', () => {
  const at = c => P.priceArrangement({ ...base({ ruleSets: flat(0), markupBp: 0, labor: null }), costLines: [line('x', K(c))] });
  assert.equal(s(at('670').customerPrice), '670.00');
  assert.equal(s(at('670,01').customerPrice), '675.00');
  assert.equal(s(at('669,99').customerPrice), '670.00');
});

// ---------- påslag är inte marginal ----------
test('påslag: 100 kr + 120 % = 220 kr, och marginalen är en härledd uppgift (6/11)', () => {
  const r = P.priceArrangement({ ...base({ ruleSets: flat(0), labor: null, rounding: { step: Money.of(1n), mode: ROUNDING.CEIL } }), costLines: [line('x', K('100'))] });
  assert.equal(s(r.customerPrice), '220.00');
  assert.equal(r.margin.toString(), '6/11');                              // (220 − 100) ÷ 220, inte 120 %
  assert.ok(r.margin.lt(F(1)));
  assert.equal(P.marginFromMarkup(12000).toString(), '6/11');
});

test('påslag och marginal räknas om exakt åt båda håll, och marginalen måste vara under 100 %', () => {
  assert.equal(P.markupFromMargin(5000).toString(), '1');                 // 50 % marginal = 100 % påslag
  assert.equal(P.markupFromMargin(0).toString(), '0');
  assert.equal(P.marginFromMarkup(10000).toString(), '1/2');
  assert.equal(P.marginFromMarkup(0).toString(), '0');
  assert.equal(code(() => P.markupFromMargin(10000)), 'bad_margin');      // 100 % marginal finns inte
  assert.equal(code(() => P.markupFromMargin(12000)), 'bad_margin');      // inte heller 120 % marginal
  assert.equal(P.suggestMarkupBpFromMarginBp(5000), 10000);
  assert.equal(P.suggestMarkupBpFromMarginBp(5454), 11997);              // förslag på påslag i bp, avrundat
  for (let m = 1; m < 10000; m += 37) {
    const p = P.markupFromMargin(m);
    assert.equal(p.div(F(1).add(p)).toString(), F(m, 10000).toString(), 'm = ' + m);   // p ÷ (1+p) = m
  }
});

test('120 % påslag är inte 120 % marginal: priset blir 2,2 gånger kostnaden, aldrig negativt eller oändligt', () => {
  const r = P.priceArrangement({ ...base({ ruleSets: flat(0), labor: null, rounding: { step: Money.of(1n), mode: ROUNDING.CEIL } }), costLines: [line('x', K('50'))] });
  assert.equal(s(r.customerPrice), '110.00');
  const asMargin = P.priceArrangement({ ...base({ ruleSets: flat(0), labor: null, markupBp: P.suggestMarkupBpFromMarginBp(5000), rounding: { step: Money.of(1n), mode: ROUNDING.CEIL } }), costLines: [line('x', K('50'))] });
  assert.equal(s(asMargin.customerPrice), '100.00');                      // 50 % marginal = dubbla kostnaden
  assert.notEqual(s(asMargin.customerPrice), s(r.customerPrice));
});

// ---------- arbete ----------
test('arbete: fast avgift och tid (minuter × timpris) som exakta belopp, utan påslag', () => {
  assert.equal(P.laborExact({ mode: 'timed', minutes: 30, hourlyRate: K('300') }, 'SEK').amount.toString(), '15000');   // 150 kr
  assert.equal(P.laborExact({ mode: 'timed', minutes: 25, hourlyRate: K('250') }, 'SEK').amount.toString(), '31250/3'); // 104,1666… kr, inte avrundat
  assert.equal(P.laborExact({ mode: 'fixed', fee: K('150') }, 'SEK').amount.toString(), '15000');
  assert.equal(P.laborExact(null, 'SEK').amount.toString(), '0');
  assert.equal(P.laborExact({ mode: 'none' }, 'SEK').mode, 'none');
  assert.equal(code(() => P.laborExact({ mode: 'daily' }, 'SEK')), 'bad_labor');
  assert.equal(code(() => P.laborExact({ mode: 'fixed', fee: K('-1') }, 'SEK')), 'negative_amount');
  assert.equal(code(() => P.laborExact({ mode: 'timed', minutes: -5, hourlyRate: K('250') }, 'SEK')), 'negative_amount');
  assert.equal(code(() => P.laborExact({ mode: 'fixed', fee: Money.of(100n, 'EUR') }, 'SEK')), 'currency_mismatch');
});

test('arbete: bryts inte upp i flyttal i priset, och får inget påslag', () => {
  const timed = P.priceArrangement(base({ ruleSets: flat(0), markupBp: 5000, costLines: [line('x', K('100'))], labor: { mode: 'timed', minutes: 25, hourlyRate: K('250') }, rounding: { step: K('1'), mode: ROUNDING.CEIL } }));
  assert.equal(kr(timed.exact.saleExVatBeforeRounding), '254.17');        // 100 × 1,5 + 104,1666…
  assert.equal(s(timed.customerPrice), '255.00');
  const a = P.priceArrangement(base({ markupBp: 0 })), b = P.priceArrangement(base({ markupBp: 12000 }));
  assert.equal(kr(b.exact.saleExVatBeforeRounding.sub(a.exact.saleExVatBeforeRounding)), '223.20');     // bara inköpet fick påslag
  assert.equal(kr(a.breakdown.labor.amount), kr(b.breakdown.labor.amount));
});

test('resolveLabor: överstyrning vinner över tid, tid över standardavgift, och saknas allt är arbetet noll', () => {
  const d = { defaultLaborFee: K('150'), hourlyLaborRate: K('300') };
  assert.deepEqual(P.resolveLabor(d, { laborOverride: { mode: 'fixed', fee: K('99') }, estimatedMinutes: 30 }), { mode: 'fixed', fee: K('99') });
  const timed = P.resolveLabor(d, { estimatedMinutes: 30 });
  assert.equal(timed.mode, 'timed'); assert.equal(timed.minutes, 30); assert.ok(timed.hourlyRate.eq(K('300')));
  assert.deepEqual(P.resolveLabor(d, {}), { mode: 'fixed', fee: K('150') });
  assert.deepEqual(P.resolveLabor({ defaultLaborFee: K('150') }, { estimatedMinutes: 30 }), { mode: 'fixed', fee: K('150') });  // minuter utan timpris räcker inte
  assert.deepEqual(P.resolveLabor({}, {}), { mode: 'none' });
  assert.deepEqual(P.resolveLabor(undefined, undefined), { mode: 'none' });
});

// ---------- tillbehör, avgifter och rader utan påslag ----------
test('tillbehör kan ha påslag eller inte, och avgifter får aldrig påslag', () => {
  const r = P.priceArrangement(base({ ruleSets: flat(0), labor: null, rounding: { step: Money.of(1n), mode: ROUNDING.CEIL },
    costLines: [line('rosor', K('100')), { id: 'vas', kind: 'accessories', cost: K('40'), markup: true, source: { kind: 'LIVE' } }, { id: 'frakt', kind: 'freight', cost: K('20'), markup: false, source: { kind: 'LIVE' } }],
    fees: [{ id: 'leverans', kind: 'delivery', amount: K('100'), taxCategory: 'delivery' }] }));
  assert.equal(kr(r.breakdown.materials.markupBase), '140.00'); assert.equal(kr(r.breakdown.materials.noMarkup), '20.00');
  assert.equal(kr(r.breakdown.markup.amount), '168.00');                  // 140 × 120 %, inte på frakt eller avgift
  assert.equal(s(r.customerPrice), '428.00');                              // 140 + 168 + 20 + 100
  assert.equal(kr(r.exact.costTotal), '160.00');
});

// ---------- moms per rad ----------
test('flera momssatser: moms per komponent, summerad per sats, och summan stämmer exakt', () => {
  const rules = [fixtureMixed({ arrangement_goods: 1200, labor: 2500, delivery: 600 })];      // påhittade satser (TESTDATA)
  const input = step => ({ ...base({ ruleSets: rules, markupBp: 10000, labor: { mode: 'fixed', fee: K('100') }, rounding: { step, mode: ROUNDING.CEIL }, costLines: [line('x', K('100'))] }), fees: [{ id: 'leverans', kind: 'delivery', amount: K('50'), taxCategory: 'delivery' }] });
  const a = P.priceArrangement(input(K('1')));
  assert.equal(s(a.customerPrice), '402.00');                                // 200 × 1,12 + 100 × 1,25 + 50 × 1,06
  assert.deepEqual(a.vatByRate.map(g => [g.rateBp, s(g.exVat), s(g.vat), s(g.incVat)]), [[600, '50.00', '3.00', '53.00'], [1200, '200.00', '24.00', '224.00'], [2500, '100.00', '25.00', '125.00']]);
  assert.equal(s(a.saleExVat), '350.00'); assert.equal(s(a.vat), '52.00');
  const b = P.priceArrangement(input(K('5')));                               // 402 → 405: 3 kr avrundning fördelas i ören, summan är exakt 405
  assert.equal(s(b.customerPrice), '405.00');
  // handräknat i ören: delarna 5300, 22400 och 12500 skalas med 405 ÷ 402 → 5339,55 / 22567,16 / 12593,28.
  // Hela ören nedåt ger 5339 + 22567 + 12593 = 40499, och det saknade ören går till största resten (5339,55 → 5340).
  assert.deepEqual(b.vatByRate.map(g => [g.rateBp, s(g.incVat)]), [[600, '53.40'], [1200, '225.67'], [2500, '125.93']]);
  // exkl. moms ur inkl. moms: 53,40 ÷ 1,06 = 50,377 → 50,38.  225,67 ÷ 1,12 = 201,491 → 201,49.  125,93 ÷ 1,25 = 100,744 → 100,74
  assert.deepEqual(b.vatByRate.map(g => [s(g.exVat), s(g.vat)]), [['50.38', '3.02'], ['201.49', '24.18'], ['100.74', '25.19']]);
  assert.equal(s(b.saleExVat), '352.61'); assert.equal(s(b.vat), '52.39');
  assert.equal(s(b.saleExVat.add(b.vat)), '405.00');
  for (const g of b.vatByRate) assert.equal(s(g.exVat.add(g.vat)), s(g.incVat));
  assert.deepEqual(b.breakdown.components.map(c => [c.key, c.category, c.rateBp]), [['goods', 'arrangement_goods', 1200], ['labor', 'labor', 2500], ['fee:leverans', 'delivery', 600]]);
});

test('samma sats i flera komponenter ger en enda momsrad', () => {
  const r = P.priceArrangement({ ...base(), fees: [{ id: 'a', amount: K('10'), taxCategory: 'setup' }, { id: 'b', amount: K('20'), taxCategory: 'other' }] });
  assert.equal(r.vatByRate.length, 1);
});

// ---------- okänt förblir okänt ----------
test('saknat inköpspris ger INCOMPLETE och inget pris, aldrig 0 kr', () => {
  for (const missing of [null, undefined]) {
    const r = P.priceArrangement(base({ costLines: [line('rosor', K('186')), { id: 'tulpan', kind: 'flowers', cost: missing, source: { kind: 'LIVE' } }] }));
    assert.equal(r.status, 'INCOMPLETE'); assert.equal(r.customerPrice, null); assert.equal(r.priceStatus, 'INCOMPLETE');
    assert.deepEqual(r.reasons, [{ code: 'cost_missing', id: 'tulpan' }]);
  }
});

test('okänd eller saknad momssats ger INCOMPLETE, aldrig en gissad sats', () => {
  assert.deepEqual(P.priceArrangement(base({ ruleSets: [] })).reasons.map(x => [x.code, x.category, x.reason]), [['tax_unknown', 'arrangement_goods', 'no_rule_set'], ['tax_unknown', 'labor', 'no_rule_set']]);
  const limited = [fixtureMixed({}, { rates: { arrangement_goods: 2500 } })];
  const withUnknownCategory = P.priceArrangement(base({ ruleSets: limited, fees: [{ id: 'x', amount: K('10'), taxCategory: 'rosor' }] }));
  assert.equal(withUnknownCategory.status, 'INCOMPLETE');
  assert.ok(withUnknownCategory.reasons.some(x => x.category === 'rosor' && x.reason === 'unknown_category'));
  const before = P.priceArrangement(base({ ruleSets: [fixtureFlat(2500, { validFrom: '2027-01-01' })] }));   // regeln gäller först senare
  assert.equal(before.status, 'INCOMPLETE'); assert.equal(before.reasons[0].reason, 'no_rule_set');
});

test('flyttal och fel indata avvisas i stället för att gissas', () => {
  assert.equal(code(() => P.priceArrangement({ ...base(), costLines: [line('x', 186)] })), 'not_money');
  assert.equal(code(() => P.priceArrangement({ ...base(), taxDate: undefined })), 'no_tax_date');
  assert.equal(code(() => P.priceArrangement({ ...base(), markupBp: 12.5 })), 'bad_rate');
  assert.equal(code(() => P.priceArrangement({ ...base(), markupBp: -1 })), 'bad_rate');
  assert.equal(code(() => P.priceArrangement({ ...base(), costLines: [line('x', K('-1'))] })), 'negative_amount');
  assert.equal(code(() => P.priceArrangement({ ...base(), rounding: { step: Money.of(0n), mode: 'CEIL' } })), 'bad_step');
  assert.equal(code(() => P.priceArrangement({ ...base(), rounding: { step: 5, mode: 'CEIL' } })), 'bad_step');
  assert.equal(code(() => P.priceArrangement({ ...base(), rounding: { step: K('5'), mode: 'ROUND' } })), 'unknown_rounding');
  assert.equal(code(() => P.priceArrangement({ ...base(), customerKind: 'GOVERNMENT' })), 'bad_customer_kind');
  assert.equal(code(() => P.priceArrangement({ ...base(), costLines: [line('x', K('1'), 'LIVE', { kind: 'rosor' })] })), 'bad_cost_kind');
  assert.equal(code(() => P.priceArrangement({ ...base(), costLines: [line('x', Money.of(100n, 'EUR'))] })), 'currency_mismatch');
});

test('tomt arrangemang: status EMPTY, 0 kr och ingen prisstatus (inget att uppskatta)', () => {
  const r = P.priceArrangement(base({ costLines: [], labor: null }));
  assert.equal(r.status, 'EMPTY'); assert.equal(s(r.customerPrice), '0.00'); assert.equal(r.priceStatus, null); assert.equal(r.margin, null);
  assert.equal(P.priceArrangement(base({ costLines: [], labor: { mode: 'fixed', fee: K('125') } })).status, 'OK');   // bara arbete är inte tomt
});

// ---------- prisstatus: ≈ uppskattat, ✓ bekräftat ----------
test('prisstatus: bekräftat kräver att varje inköpsrad är livekontrollerad (eller floristens eget beslut)', () => {
  const st = kinds => P.priceArrangement(base({ costLines: kinds.map((k, i) => line('r' + i, K('10'), k)) }));
  assert.equal(st(['LIVE']).priceStatus, 'CONFIRMED');
  assert.equal(st(['LIVE', 'LIVE']).statusMark, '✓');
  assert.equal(st(['LIVE', 'MANUAL']).priceStatus, 'CONFIRMED');
  assert.equal(st(['MANUAL']).priceStatus, 'CONFIRMED');
  for (const weak of ['RECENT', 'STALE', 'HISTORICAL_ESTIMATE']) {
    const r = st(['LIVE', weak]);
    assert.equal(r.priceStatus, 'ESTIMATED', weak); assert.equal(r.statusMark, '≈', weak);
    assert.equal(r.breakdown.priceSources.weakest, weak);
  }
  assert.equal(st(['RECENT', 'STALE', 'LIVE']).breakdown.priceSources.weakest, 'STALE');
  assert.equal(st(['STALE', 'HISTORICAL_ESTIMATE']).breakdown.priceSources.weakest, 'HISTORICAL_ESTIMATE');
});

test('prisstatus: okänd eller saknad prisbas räknas som uppskattning, aldrig som bekräftad', () => {
  const r = P.priceArrangement(base({ costLines: [{ id: 'x', kind: 'flowers', cost: K('10'), source: { kind: 'RYKTE' } }] }));
  assert.equal(r.priceStatus, 'ESTIMATED');
  const noSource = P.priceArrangement(base({ costLines: [{ id: 'x', kind: 'flowers', cost: K('10') }] }));
  assert.equal(noSource.priceStatus, 'ESTIMATED');
  assert.equal(P.classifyPriceStatus([]).status, 'CONFIRMED');          // inga uppskattade rader finns
});

test('PriceBreakdown: vilken typ av pris som användes följer med, så att kalkylen går att förklara', () => {
  const r = P.priceArrangement(base({ costLines: [
    line('a', K('10'), 'LIVE', { source: { kind: 'LIVE', asOf: '2026-10-07T08:14', ref: 'q1' } }),
    line('b', K('10'), 'HISTORICAL_ESTIMATE', { source: { kind: 'HISTORICAL_ESTIMATE', asOf: '2026-09-01', ref: 'rollup-v37' } }),
    line('c', K('10'), 'MANUAL')] }));
  assert.deepEqual(r.breakdown.priceSources.counts, { LIVE: 1, RECENT: 0, STALE: 0, HISTORICAL_ESTIMATE: 1, MANUAL: 1 });
  assert.equal(r.breakdown.costLines[0].source.ref, 'q1'); assert.equal(r.breakdown.costLines[1].source.kind, 'HISTORICAL_ESTIMATE');
  assert.equal(r.priceStatus, 'ESTIMATED');                                // framtida event bygger på kalkylpris, inte på dagens kampanj
});

// ---------- regelversion och oföränderlighet ----------
test('regelns ursprung och version följer med resultatet, med verifieringsstatus', () => {
  const r = P.priceArrangement(base());
  assert.deepEqual(r.breakdown.rule.refs, ['fixture-flat@1']);
  assert.equal(r.breakdown.rule.allVerified, false);
  assert.equal(r.breakdown.rule.verification.labor.sourceKind, 'fixture');
  assert.equal(r.breakdown.taxDate, '2026-10-07');
  const legacy = P.priceArrangement(base({ ruleSets: [T.legacyUserSettingRuleSet(25)] }));
  assert.equal(legacy.breakdown.rule.allVerified, false);
  assert.equal(s(legacy.customerPrice), s(r.customerPrice));              // en egen inställning på 25 % räknar likadant
  // TESTDATA: en strukturellt giltig verifierad uppsättning (satsen 2500 här är ingen regel)
  const ver = T.createRuleSet({ id: 'v', version: 1, validFrom: '2000-01-01', rates: Object.fromEntries(T.TAX_CATEGORIES.map(c => [c, 2500])), source: { kind: 'official', url: 'https://example.invalid/test' }, verification: { status: 'verified', verifiedBy: 'testperson', verifiedAt: '2026-10-07' } });
  assert.equal(P.priceArrangement(base({ ruleSets: [ver] })).breakdown.rule.allVerified, true);
});

test('historiskt resultat ändras inte av att en ny regelversion läggs till (datum styr)', () => {
  const v1 = fixtureFlat(2500, { id: 'r', version: 1, validFrom: '2026-01-01', validTo: '2026-06-30' });
  const v2 = fixtureFlat(1200, { id: 'r', version: 2, validFrom: '2026-07-01', validTo: null });
  const old = P.priceArrangement(base({ ruleSets: [v1], taxDate: '2026-03-01' }));
  const afterChange = P.priceArrangement(base({ ruleSets: [v1, v2], taxDate: '2026-03-01' }));
  assert.equal(snap(afterChange), snap(old));
  const newer = P.priceArrangement(base({ ruleSets: [v1, v2], taxDate: '2026-08-01' }));
  assert.notEqual(s(newer.customerPrice), s(old.customerPrice));
  assert.deepEqual(newer.breakdown.rule.refs, ['r@2']); assert.deepEqual(old.breakdown.rule.refs, ['r@1']);
});

test('samma indata ger alltid samma resultat och indata ändras inte', () => {
  const input = base({ costLines: [line('a', K('12,34')), line('b', F(1000, 3))], fees: [{ id: 'f', amount: K('9,99'), taxCategory: 'delivery' }] });
  const copy = JSON.stringify(input, (k, v) => (typeof v === 'bigint' ? v.toString() : v));
  assert.equal(snap(P.priceArrangement(input)), snap(P.priceArrangement(input)));
  assert.equal(JSON.stringify(input, (k, v) => (typeof v === 'bigint' ? v.toString() : v)), copy);
});

// ---------- bakåt: målpris → råvarubudget ----------
const back = (over = {}) => ({ ...base({ costLines: [], ...over }), target: K('800') });

test('bakåt: 800 kr inkl. moms ger en råvarubudget efter moms, arbete och påslag', () => {
  const b = P.budgetForTarget(back());
  assert.equal(b.status, 'OK');
  assert.equal(b.materialBudget.toString(), '257500/11');                 // 234,0909… kr, exakt
  assert.equal(s(b.materialBudgetMoney), '234.09');                       // avrundad nedåt till hela ören
  assert.equal(s(b.effectiveTarget), '800.00');
  assert.equal(b.breakdown.goodsExVatAllowed.toString(), '51500');        // (800 − 125 × 1,25) ÷ 1,25 = 515 kr
  // bevis åt andra hållet: budgeten ger ett kundpris som inte överstiger målet, ett öre till gör det
  const at = m => P.priceArrangement(base({ costLines: [line('budget', m)] })).customerPrice;
  assert.equal(s(at(b.materialBudgetMoney)), '800.00');
  assert.equal(s(at(b.materialBudgetMoney.add(Money.of(1n)))), '805.00');
});

test('bakåt: redan bestämda inköp minskar budgeten, och icke-påslagsbelagd råvara räknas utan påslag', () => {
  const marked = P.budgetForTarget(back({ costLines: [line('vas', K('50'))] }));
  assert.equal(marked.materialBudget.toString(), '202500/11');            // 257500/11 − 5000 öre
  const plain = P.budgetForTarget(back({ costLines: [line('frakt', K('50'), 'LIVE', { markup: false })] }));
  assert.equal(plain.breakdown.goodsExVatAllowed.toString(), '51500');
  assert.equal(plain.materialBudget.toString(), '232500/11');             // (51500 − 5000) ÷ 2,2 öre
  const noMarkup = P.budgetForTarget({ ...back(), budget: { markup: false } });
  assert.equal(s(noMarkup.materialBudgetMoney), '515.00');                // utan påslag på råvaran
});

test('bakåt: målet avrundas nedåt till ett pris som går att nå, och för litet mål ger negativ budget', () => {
  const same = P.budgetForTarget({ ...back(), target: K('802') });
  assert.equal(s(same.effectiveTarget), '800.00'); assert.equal(same.materialBudget.toString(), '257500/11');
  const neg = P.budgetForTarget({ ...back(), target: K('100') });
  assert.equal(neg.status, 'NEGATIVE'); assert.equal(neg.materialBudgetMoney, null);
  assert.ok(neg.shortfall.gt(F(0)));
  assert.equal(P.priceArrangement(base({ costLines: [] })).customerPrice.gt(K('100')), true);   // arbetet ensamt överstiger redan målet
  assert.equal(P.budgetForTarget({ ...back(), target: K('0') }).status, 'NEGATIVE');             // arbetet 125 kr finns kvar
  assert.equal(P.budgetForTarget({ ...back({ labor: null }), target: K('0') }).materialBudgetMoney.amount, 0n);
});

test('bakåt: okänt förblir okänt, och bara avrundning uppåt stöds', () => {
  assert.equal(P.budgetForTarget(back({ ruleSets: [] })).status, 'INCOMPLETE');
  assert.equal(P.budgetForTarget(back({ costLines: [{ id: 'x', kind: 'flowers', cost: null }] })).status, 'INCOMPLETE');
  assert.equal(code(() => P.budgetForTarget(back({ rounding: { step: K('5'), mode: 'FLOOR' } }))), 'unsupported_rounding');
  assert.equal(code(() => P.budgetForTarget({ ...back(), target: 800 })), 'bad_target');
  assert.equal(code(() => P.budgetForTarget({ ...back(), target: Money.of(80000n, 'EUR') })), 'bad_target');
});

test('framåt och bakåt hör ihop: egenskapstest över slumpade fall med flera satser (600 fall)', () => {
  const r = rng(23), int = intIn(r), pick = pickOf(r);
  const rules = [fixtureMixed({ arrangement_goods: 1200, labor: 2500, delivery: 600, setup: 0 })];
  let ok = 0, negative = 0;
  for (let i = 0; i < 600; i++) {
    const fixed = Array.from({ length: int(0, 2) }, (_, k) => line('f' + k, Money.of(BigInt(int(0, 30000)), 'SEK'), 'LIVE', { markup: pick([true, false]) }));
    const common = {
      currency: 'SEK', taxDate: '2026-10-07', ruleSets: rules, markupBp: int(0, 30000),
      labor: pick([null, { mode: 'fixed', fee: Money.of(BigInt(int(0, 30000)), 'SEK') }, { mode: 'timed', minutes: int(0, 120), hourlyRate: Money.of(BigInt(int(0, 40000)), 'SEK') }]),
      fees: pick([[], [{ id: 'l', amount: Money.of(BigInt(int(0, 20000)), 'SEK'), taxCategory: pick(['delivery', 'setup']) }]]),
      rounding: { step: Money.of(BigInt(pick([1, 100, 500, 1000])), 'SEK'), mode: ROUNDING.CEIL }
    };
    const target = Money.of(BigInt(int(0, 400000)), 'SEK');
    const budgetMarkup = pick([true, false]);
    const b = P.budgetForTarget({ ...common, costLines: fixed, target, budget: { markup: budgetMarkup } });
    const fwd = m => P.priceArrangement({ ...common, costLines: [...fixed, line('b', m, 'LIVE', { markup: budgetMarkup })] });
    if (b.status === 'OK') {
      ok++;
      assert.ok(fwd(b.materialBudgetMoney).customerPrice.lte(target), 'budgeten ska inte överstiga målet');
      assert.ok(fwd(b.materialBudgetMoney.add(Money.of(1n))).customerPrice.gt(target), 'ett öre till ska överstiga målet');
    } else {
      assert.equal(b.status, 'NEGATIVE'); negative++;
      assert.ok(fwd(Money.zero('SEK')).customerPrice.gt(target) || fwd(Money.zero('SEK')).status === 'EMPTY' && false, 'redan utan råvara överstigs målet');
    }
  }
  assert.ok(ok > 100 && negative > 5, `fördelningen ok=${ok} negativ=${negative}`);
});

// ---------- kundtyp ----------
test('kundtyp ändrar bara presentationen: samma belopp för privat- och företagskund', () => {
  const priv = P.priceArrangement(base({ customerKind: 'PRIVATE' })), biz = P.priceArrangement(base({ customerKind: 'BUSINESS' }));
  assert.deepEqual(priv.headline, { kind: 'INC_VAT', amount: priv.customerPrice });
  assert.equal(biz.headline.kind, 'EX_VAT_PLUS_VAT');
  assert.equal(s(biz.headline.exVat), '536.00'); assert.equal(s(biz.headline.vat), '134.00'); assert.equal(s(biz.headline.incVat), '670.00');
  for (const k of ['customerPrice', 'saleExVat', 'vat']) assert.equal(s(priv[k]), s(biz[k]));
  assert.equal(P.priceArrangement(base()).customerKind, 'PRIVATE');       // standard är privatkund
  assert.deepEqual([...P.CUSTOMER_KINDS], ['PRIVATE', 'BUSINESS']);
});

// ---------- valuta ----------
test('valutan följer indata, och blandade valutor avvisas (omräkning finns inte)', () => {
  const eur = P.priceArrangement({ ...base({ costLines: [line('x', Money.of(18600n, 'EUR'))], labor: { mode: 'fixed', fee: Money.of(12500n, 'EUR') }, rounding: { step: Money.of(500n, 'EUR'), mode: 'CEIL' } }), currency: 'EUR' });
  assert.equal(eur.customerPrice.currency, 'EUR'); assert.equal(s(eur.customerPrice), '670.00');
  assert.equal(code(() => P.priceArrangement({ ...base(), labor: { mode: 'fixed', fee: Money.of(12500n, 'EUR') } })), 'currency_mismatch');
});

// ---------- jobb: flera arrangemang, antal och avgifter ----------
test('jobb: antal multipliceras på avrundade belopp, moms per sats summeras och jobbavgifter tas med', () => {
  const A = { costLines: [line('a', K('186'))], markupBp: 12000, labor: { mode: 'fixed', fee: K('125') } };
  const B = { costLines: [line('b', K('50'))], markupBp: 12000, labor: { mode: 'fixed', fee: K('60') } };
  const job = P.priceJob({ currency: 'SEK', taxDate: '2026-10-07', ruleSets: flat(2500), rounding: { step: K('5'), mode: 'CEIL' },
    lines: [{ id: 'brud', qty: 8, arrangement: A }, { id: 'bord', qty: 4, arrangement: B }],
    fees: [{ id: 'leverans', basis: 'inc', amount: K('125'), taxCategory: 'delivery' }] });
  assert.equal(job.status, 'OK');
  assert.deepEqual(job.lines.map(l => [l.id, s(l.result.customerPrice), s(l.lineIncVat)]), [['brud', '670.00', '5360.00'], ['bord', '215.00', '860.00']]);
  assert.equal(s(job.totalIncVat), '6345.00');                             // 8 × 670 + 4 × 215 + 125
  assert.equal(s(job.totalExVat), '5076.00'); assert.equal(s(job.totalVat), '1269.00');
  assert.equal(job.vatByRate.length, 1);
  assert.equal(s(job.fees[0].amounts.exVat), '100.00'); assert.equal(s(job.fees[0].amounts.vat), '25.00');
  assert.deepEqual(job.headline, { kind: 'INC_VAT', amount: job.totalIncVat });
  assert.equal(s(job.totalExVat.add(job.totalVat)), s(job.totalIncVat));
});

test('jobb: flera satser samma jobb, och fakturans moms per sats är summan av raderna', () => {
  const rules = [fixtureMixed({ delivery: 600 })];
  const job = P.priceJob({ currency: 'SEK', taxDate: '2026-10-07', ruleSets: rules, rounding: { step: K('5'), mode: 'CEIL' },
    lines: [{ id: 'brud', qty: 1, arrangement: { costLines: [line('a', K('186'))], markupBp: 12000, labor: { mode: 'fixed', fee: K('125') } } }],
    fees: [{ id: 'leverans', basis: 'ex', amount: K('100'), taxCategory: 'delivery' }] });
  assert.deepEqual(job.vatByRate.map(g => [g.rateBp, s(g.exVat), s(g.vat), s(g.incVat)]), [[600, '100.00', '6.00', '106.00'], [2500, '536.00', '134.00', '670.00']]);
  assert.equal(s(job.totalIncVat), '776.00');
  assert.equal(s(job.totalExVat.add(job.totalVat)), '776.00');
});

test('jobb: prisstatus, ofullständiga rader, ogiltiga antal och oimplementerad momsavrundning', () => {
  const arr = kind => ({ costLines: [line('x', K('10'), kind)], markupBp: 0 });
  const mk = (a, b) => P.priceJob({ currency: 'SEK', taxDate: '2026-10-07', ruleSets: flat(2500), rounding: { step: K('1'), mode: 'CEIL' }, lines: [{ id: 'a', qty: 1, arrangement: arr(a) }, { id: 'b', qty: 2, arrangement: arr(b) }] });
  assert.equal(mk('LIVE', 'LIVE').priceStatus, 'CONFIRMED');
  assert.equal(mk('LIVE', 'RECENT').priceStatus, 'ESTIMATED');
  assert.equal(mk('LIVE', 'RECENT').statusMark, '≈');
  const incomplete = P.priceJob({ currency: 'SEK', taxDate: '2026-10-07', ruleSets: flat(2500), rounding: { step: K('1'), mode: 'CEIL' }, lines: [{ id: 'a', qty: 1, arrangement: arr('LIVE') }, { id: 'b', qty: 1, arrangement: { costLines: [{ id: 'y', kind: 'flowers', cost: null }], markupBp: 0 } }] });
  assert.equal(incomplete.status, 'INCOMPLETE'); assert.equal(incomplete.reasons[0].code, 'line_incomplete'); assert.equal(incomplete.reasons[0].id, 'b');
  for (const bad of [0, 1.5, '2', -1]) assert.equal(code(() => P.priceJob({ currency: 'SEK', taxDate: '2026-10-07', ruleSets: flat(2500), lines: [{ id: 'a', qty: bad, arrangement: arr('LIVE') }] })), 'bad_qty');
  const perSummary = [fixtureFlat(2500, { roundingLevel: 'rate_summary' })];
  assert.equal(code(() => P.priceJob({ currency: 'SEK', taxDate: '2026-10-07', ruleSets: perSummary, lines: [{ id: 'a', qty: 1, arrangement: arr('LIVE') }] })), 'unsupported_rounding_level');
  const empty = P.priceJob({ currency: 'SEK', taxDate: '2026-10-07', ruleSets: flat(2500), lines: [] });
  assert.equal(s(empty.totalIncVat), '0.00'); assert.equal(empty.priceStatus, null);
});

// ---------- egenskapstest: invarianter över slumpade arrangemang ----------
test('egenskaper: summor, steg, gränser och determinism (1 500 slumpade arrangemang med flera satser)', () => {
  const r = rng(99), int = intIn(r), pick = pickOf(r);
  const rateSets = [[0, 0, 0], [1200, 2500, 600], [1234, 1, 9999], [2500, 2500, 2500], [600, 600, 1200]];
  let nonEmpty = 0;
  for (let i = 0; i < 1500; i++) {
    const [g, l, d] = pick(rateSets);
    const rules = [fixtureMixed({ arrangement_goods: g, labor: l, delivery: d, setup: pick([g, l, d]) })];
    const costLines = Array.from({ length: int(0, 4) }, (_, k) => line('c' + k, pick([Money.of(BigInt(int(0, 5000000)), 'SEK'), F(int(0, 9999999), int(1, 97))]), pick(['LIVE', 'RECENT', 'STALE', 'HISTORICAL_ESTIMATE', 'MANUAL']), { markup: pick([true, false]) }));
    const step = Money.of(BigInt(pick([1, 5, 100, 500, 1000])), 'SEK'), mode = pick([ROUNDING.CEIL, ROUNDING.FLOOR, ROUNDING.HALF_UP]);
    const input = {
      currency: 'SEK', taxDate: '2026-10-07', ruleSets: rules, costLines, markupBp: int(0, 40000),
      labor: pick([null, { mode: 'fixed', fee: Money.of(BigInt(int(0, 4000000)), 'SEK') }, { mode: 'timed', minutes: int(0, 600), hourlyRate: Money.of(BigInt(int(0, 90000)), 'SEK') }]),
      fees: Array.from({ length: int(0, 2) }, (_, k) => ({ id: 'f' + k, amount: Money.of(BigInt(int(0, 900000)), 'SEK'), taxCategory: pick(['delivery', 'setup']) })),
      rounding: { step, mode }, customerKind: pick(['PRIVATE', 'BUSINESS'])
    };
    const res = P.priceArrangement(input);
    assert.equal(snap(P.priceArrangement(input)), snap(res), 'deterministiskt');
    if (res.status === 'EMPTY') { assert.equal(res.customerPrice.amount, 0n); continue; }
    nonEmpty++;
    assert.equal(res.status, 'OK');
    const sum = k => res.vatByRate.reduce((a, x) => a.add(x[k]), Money.zero('SEK'));
    assert.ok(sum('incVat').eq(res.customerPrice) && sum('exVat').eq(res.saleExVat) && sum('vat').eq(res.vat));
    assert.ok(res.saleExVat.add(res.vat).eq(res.customerPrice));
    for (const x of res.vatByRate) { assert.ok(x.exVat.add(x.vat).eq(x.incVat)); assert.ok(!x.exVat.isNegative() && !x.vat.isNegative()); }
    assert.deepEqual(res.vatByRate.map(x => x.rateBp), [...new Set(res.vatByRate.map(x => x.rateBp))].sort((a, b) => a - b), 'en rad per sats, stigande');
    const inc = res.exact.incVatBeforeRounding, P_ = res.customerPrice.toFrac(), st = step.toFrac();
    assert.ok(P_.div(st).isInteger(), 'kundpriset är ett helt antal steg');
    if (mode === ROUNDING.CEIL) assert.ok(P_.gte(inc) && P_.sub(inc).lt(st));
    if (mode === ROUNDING.FLOOR) assert.ok(P_.lte(inc) && inc.sub(P_).lt(st));
    if (mode === ROUNDING.HALF_UP) assert.ok(P_.sub(inc).abs().lte(st.div(F(2))));
    assert.ok(res.rounding.eq(P_.sub(inc)));
    assert.ok(res.margin === null || res.margin.lte(F(1)), 'marginalen är högst 100 % (exakt 100 % när inköpskostnaden är noll)');
    assert.ok(res.exact.saleExVatBeforeRounding.add(res.exact.vatBeforeRounding).eq(inc));
  }
  assert.ok(nonEmpty > 1200, 'de flesta fallen ska vara icke-tomma: ' + nonEmpty);
});
