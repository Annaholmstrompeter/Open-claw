// Prismotorn och egna tillägg: fast kundpris, noll inköpskostnad betyder inte noll värde, momskategori per rad och
// skillnaden mellan BERÄKNAT pris (exakt) och PRESENTERAT kundpris (avrundat). Alla satser är TESTDATA, inga verifierade regler.
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
const snap = r => JSON.stringify(r);

const RS = [fixtureFlat(2500)];
const input = (over = {}) => ({ currency: 'SEK', taxDate: '2026-10-07', ruleSets: RS, markupBp: 12000, labor: null, costLines: [], rounding: { step: K('5'), mode: ROUNDING.CEIL }, ...over });
const std = (id, cost, over = {}) => ({ id, kind: 'flowers', cost, source: { kind: 'LIVE' }, ...over });
const fixed = (id, amount, basis, over = {}) => ({ id, kind: 'accessories', pricing: 'FIXED_SALE_PRICE', salePrice: { amount, basis }, source: { kind: 'MANUAL' }, ...over });

// ---------- egna tillägg med fast kundpris ----------
test('eget tillägg: sidenband, kostnad 20 kr, pris till kund 75 kr (inkl. moms)', () => {
  const r = P.priceArrangement(input({ costLines: [fixed('sidenband', K('75'), 'inc', { cost: K('20') })] }));
  assert.equal(r.status, 'OK');
  assert.equal(s(r.customerPrice), '75.00');                           // priset kommer av kundpriset, inte av kostnaden
  assert.equal(s(r.saleExVat), '60.00'); assert.equal(s(r.vat), '15.00');
  assert.equal(r.margin.toString(), '2/3');                            // (60 − 20) ÷ 60
  assert.equal(r.marginComplete, true);
  assert.deepEqual(r.breakdown.components.map(c => c.key), ['goods', 'labor', 'fixed:sidenband']);
  assert.equal(r.breakdown.costLines[0].pricing, 'FIXED_SALE_PRICE');
});

test('fast kundpris beror inte på kostnaden: samma pris vid 5 kr, 20 kr, 0 kr och okänd kostnad', () => {
  const at = cost => P.priceArrangement(input({ costLines: [fixed('x', K('75'), 'inc', cost === undefined ? {} : { cost })] }));
  for (const c of [K('5'), K('20'), K('0'), null, undefined]) assert.equal(s(at(c).customerPrice), '75.00');
  assert.equal(at(K('5')).margin.toString(), '11/12');
  assert.equal(at(null).marginComplete, false);                        // okänd kostnad: marginalen är inte fullständig
  assert.equal(at(K('20')).marginComplete, true);
});

test('NOLL INKÖPSKOSTNAD BETYDER INTE NOLL VÄRDE: dahlior från egen trädgård med extern kostnad 0 kr får ändå ett pris', () => {
  // 5 dahlior, extern inköpskostnad 0, floristen anger 25 kr per stjälk inkl. moms
  const asFixed = P.priceArrangement(input({ costLines: [fixed('dahlia', K('125'), 'inc', { kind: 'flowers', cost: K('0') })] }));
  assert.equal(s(asFixed.customerPrice), '125.00');
  assert.notEqual(asFixed.customerPrice.amount, 0n);
  // eller en kalkylkostnad på 8 kr per stjälk som får butikens påslag (120 %): 40 × 2,2 = 88 kr exkl. moms, 110 kr inkl. moms
  const asStandard = P.priceArrangement(input({ costLines: [std('dahlia', F(4000), { source: { kind: 'MANUAL' } })] }));
  assert.equal(s(asStandard.customerPrice), '110.00');
  // ett fast pris på 0 kr är ett uttryckligt val ("ingår") och ger 0 kr
  const free = P.priceArrangement(input({ costLines: [fixed('ingar', K('0'), 'inc')] }));
  assert.equal(s(free.customerPrice), '0.00'); assert.equal(free.status, 'OK');
});

test('antik vas +250 kr utan påhittat inköpspris', () => {
  const r = P.priceArrangement(input({ costLines: [fixed('vas', K('250'), 'inc')] }));
  assert.equal(s(r.customerPrice), '250.00'); assert.equal(s(r.saleExVat), '200.00'); assert.equal(s(r.vat), '50.00');
  assert.equal(r.marginComplete, false);                               // ingen kalkylkostnad känd
  assert.equal(r.priceStatus, 'CONFIRMED');                            // floristens eget pris, inget gammalt grossistpris
});

test('fast kundpris exkl. moms: momsen läggs på', () => {
  const r = P.priceArrangement(input({ costLines: [fixed('x', K('200'), 'ex')] }));
  assert.equal(s(r.customerPrice), '250.00'); assert.equal(s(r.saleExVat), '200.00');
});

test('fast pris och vanligt inköp i samma arrangemang: ett pris, avrundat en gång', () => {
  const r = P.priceArrangement(input({ labor: { mode: 'fixed', fee: K('125') }, costLines: [std('rosor', K('186')), fixed('sidenband', K('75'), 'inc', { cost: K('20') })] }));
  // 186 × 2,2 = 409,20 + 60 (75 inkl. moms) + 125 arbete = 594,20 exkl. moms → 742,75 inkl. moms → 745 kr
  assert.equal(kr(r.calculated.exVat), '594.20');
  assert.equal(kr(r.calculated.incVat), '742.75');
  assert.equal(s(r.presented.incVat), '745.00');
  assert.equal(kr(r.presented.rounding), '2.25');
  assert.deepEqual(r.breakdown.components.map(c => c.key), ['goods', 'labor', 'fixed:sidenband']);
  assert.equal(r.marginComplete, true);
});
function kr(frac) { return s(Money.fromFrac(frac, ROUNDING.HALF_UP, 'SEK')); }

test('okänt förblir okänt: ett fast pris utan belopp ger inget pris, fel indata avvisas', () => {
  const r = P.priceArrangement(input({ costLines: [{ id: 'x', kind: 'accessories', pricing: 'FIXED_SALE_PRICE' }] }));
  assert.equal(r.status, 'INCOMPLETE'); assert.deepEqual(r.reasons, [{ code: 'sale_price_missing', id: 'x' }]); assert.equal(r.customerPrice, null);
  const r2 = P.priceArrangement(input({ costLines: [{ id: 'x', kind: 'accessories', pricing: 'FIXED_SALE_PRICE', salePrice: { amount: null, basis: 'inc' } }] }));
  assert.equal(r2.reasons[0].code, 'sale_price_missing');
  assert.equal(code(() => P.priceArrangement(input({ costLines: [fixed('x', K('75'), 'kanske')] }))), 'bad_sale_basis');
  assert.equal(code(() => P.priceArrangement(input({ costLines: [fixed('x', 75, 'inc')] }))), 'not_money');
  assert.equal(code(() => P.priceArrangement(input({ costLines: [fixed('x', K('-1'), 'inc')] }))), 'negative_amount');
  assert.equal(code(() => P.priceArrangement(input({ costLines: [{ ...fixed('x', K('1'), 'inc'), pricing: 'GRATIS' }] }))), 'bad_pricing_mode');
  assert.deepEqual([...P.PRICING_MODES], ['STANDARD_MARKUP', 'FIXED_SALE_PRICE', 'INCLUDED']);
});

test('prisstatus: ett fast kundpris påverkas inte av hur gammalt inköpspriset är, ett vanligt pris gör det', () => {
  const stale = { kind: 'STALE' };
  assert.equal(P.priceArrangement(input({ costLines: [fixed('x', K('75'), 'inc', { cost: K('20'), source: stale })] })).priceStatus, 'CONFIRMED');
  assert.equal(P.priceArrangement(input({ costLines: [std('x', K('20'), { source: stale })] })).priceStatus, 'ESTIMATED');
  assert.equal(P.priceArrangement(input({ costLines: [std('a', K('20')), fixed('x', K('75'), 'inc', { source: stale })] })).priceStatus, 'CONFIRMED');
});

// ---------- moms per rad, oberoende av var materialet kommer ifrån ----------
test('momskategori per rad: varje rad kan få sin egen kategori och sats (satserna är testdata)', () => {
  const rules = [fixtureMixed({ accessories: 600 })];                  // arrangemangets varor 25 %, tillbehör 6 % (påhittade)
  const r = P.priceArrangement(input({ ruleSets: rules, markupBp: 0, rounding: { step: K('1'), mode: ROUNDING.CEIL },
    costLines: [std('rosor', K('100')), fixed('band', K('106'), 'inc', { taxCategory: 'accessories' })] }));
  assert.deepEqual(r.vatByRate.map(g => [g.rateBp, s(g.exVat), s(g.vat), s(g.incVat)]), [[600, '100.00', '6.00', '106.00'], [2500, '100.00', '25.00', '125.00']]);
  assert.equal(s(r.customerPrice), '231.00');
});

test('momskategori på en vanlig rad ger en egen varukomponent (standardkategorin behåller nyckeln "goods"), handräknat belopp', () => {
  const rules = [fixtureMixed({ plants: 1200 })];
  const r = P.priceArrangement(input({ ruleSets: rules, markupBp: 10000, rounding: { step: Money.of(1n), mode: ROUNDING.CEIL },
    costLines: [std('rosor', K('100')), std('kruka', K('50'), { taxCategory: 'plants' })] }));
  assert.deepEqual(r.breakdown.components.map(c => [c.key, c.category, c.rateBp]), [['goods', 'arrangement_goods', 2500], ['goods:plants', 'plants', 1200], ['labor', 'labor', 2500]]);
  assert.equal(kr(r.calculated.incVat), '362.00');                      // 200 × 1,25 + 100 × 1,12
  assert.equal(s(r.customerPrice), '362.00');
  assert.deepEqual(r.vatByRate.map(g => [g.rateBp, s(g.exVat), s(g.vat)]), [[1200, '100.00', '12.00'], [2500, '200.00', '50.00']]);
});

test('momskategori som saknas i regeln ger INCOMPLETE med kategorin, aldrig en gissad sats', () => {
  const partial = [T.createRuleSet({ id: 'p', version: 1, validFrom: '2000-01-01', rates: { arrangement_goods: 2500, labor: 2500 }, source: { kind: 'fixture' } })];
  const r = P.priceArrangement(input({ ruleSets: partial, costLines: [std('rosor', K('10')), fixed('kruka', K('50'), 'inc', { taxCategory: 'plants' })] }));
  assert.equal(r.status, 'INCOMPLETE');
  assert.deepEqual(r.reasons.map(x => [x.code, x.category, x.reason]), [['tax_unknown', 'plants', 'rate_missing']]);
  assert.equal(code(() => P.priceArrangement(input({ costLines: [std('x', K('1'), { taxCategory: 'rosor' })] }))), null);   // okänd kategori ger INCOMPLETE, inte ett kast
  assert.equal(P.priceArrangement(input({ costLines: [std('x', K('1'), { taxCategory: 'rosor' })] })).reasons[0].reason, 'unknown_category');
});

// ---------- BERÄKNAT och PRESENTERAT pris ----------
test('beräknat pris (exakt) och presenterat kundpris (avrundat) behålls båda', () => {
  const lines = [std('rosor', K('186'))];
  const at = rounding => P.priceArrangement(input({ costLines: lines, labor: { mode: 'fixed', fee: K('125') }, rounding }));
  const five = at({ step: K('5'), mode: ROUNDING.CEIL });
  assert.equal(kr(five.calculated.incVat), '667.75');                   // motorn räknar fram 667,75 kr
  assert.equal(s(five.presented.incVat), '670.00');                     // butikens avrundningsregel presenterar 670 kr
  assert.equal(kr(five.calculated.exVat), '534.20'); assert.equal(kr(five.calculated.vat), '133.55');
  assert.equal(s(five.presented.exVat), '536.00'); assert.equal(s(five.presented.vat), '134.00');
  assert.equal(five.presented.rounding.toString(), '225');               // 2,25 kr i ören: presenterat minus beräknat
  assert.deepEqual(five.presented.roundingRule, { step: F(500), mode: 'CEIL' });
  assert.equal(five.customerPrice, five.presented.incVat);              // customerPrice är det presenterade priset
  // avrundningsregeln ändrar aldrig det beräknade: exakt samma beräknade belopp vid helt andra regler
  for (const rounding of [{ step: Money.of(1n), mode: ROUNDING.CEIL }, { step: K('1'), mode: ROUNDING.HALF_UP }, { step: K('50'), mode: ROUNDING.CEIL }, { step: K('5'), mode: ROUNDING.FLOOR }]) {
    const x = at(rounding);
    assert.equal(snap(x.calculated), snap(five.calculated), JSON.stringify(rounding));
    assert.ok(x.presented.incVat.toFrac().sub(x.calculated.incVat).eq(x.presented.rounding));
  }
  assert.equal(s(at({ step: Money.of(1n), mode: ROUNDING.CEIL }).presented.incVat), '667.75');   // utan avrundning är de lika
});

test('beräknat pris per momssats är exakt och summerar till det beräknade totalet', () => {
  const rules = [fixtureMixed({ arrangement_goods: 1200, labor: 2500, delivery: 600 })];
  const r = P.priceArrangement(input({ ruleSets: rules, markupBp: 10000, labor: { mode: 'fixed', fee: K('100') }, costLines: [std('x', K('100'))],
    fees: [{ id: 'l', amount: K('50'), taxCategory: 'delivery' }], rounding: { step: K('5'), mode: ROUNDING.CEIL } }));
  assert.deepEqual(r.calculated.byRate.map(g => [g.rateBp, kr(g.exVat), kr(g.vat), kr(g.incVat)]), [[600, '50.00', '3.00', '53.00'], [1200, '200.00', '24.00', '224.00'], [2500, '100.00', '25.00', '125.00']]);
  assert.equal(kr(r.calculated.incVat), '402.00');
  assert.equal(s(r.presented.incVat), '405.00');
  assert.ok(Frac.sum(r.calculated.byRate.map(g => g.incVat)).eq(r.calculated.incVat));
  assert.ok(Frac.sum(r.presented.byRate.map(g => g.incVat.toFrac())).eq(r.presented.incVat.toFrac()));
});

test('jobb: beräknat och presenterat summeras var för sig, och skillnaden är avrundningen', () => {
  const arr = { costLines: [std('a', K('186'))], markupBp: 12000, labor: { mode: 'fixed', fee: K('125') } };
  const job = P.priceJob({ currency: 'SEK', taxDate: '2026-10-07', ruleSets: RS, rounding: { step: K('5'), mode: 'CEIL' }, lines: [{ id: 'a', qty: 8, arrangement: arr }],
    fees: [{ id: 'leverans', basis: 'inc', amount: K('125'), taxCategory: 'delivery' }] });
  assert.equal(kr(job.calculated.incVat), '5467.00');                    // 8 × 667,75 = 5 342 + 125 avgift
  assert.equal(s(job.presented.incVat), '5485.00');                      // 8 × 670 = 5 360 + 125
  assert.equal(kr(job.presented.rounding), '18.00');                     // 8 × 2,25 (avgiften avrundas inte)
  assert.equal(kr(job.calculated.exVat), '4373.60');                     // 8 × 534,20 = 4 273,60 + 100
  assert.equal(job.totalIncVat, job.presented.incVat);
  assert.equal(s(job.presented.exVat.add(job.presented.vat)), '5485.00');
});

// ---------- baklänges med egna tillägg ----------
const back = (over = {}) => ({ ...input({ labor: { mode: 'fixed', fee: K('125') } }), target: K('800'), ...over });

test('bakåt: ett fast tillägg minskar råvarubudgeten med sitt pris inkl. moms', () => {
  const none = P.budgetForTarget(back());
  assert.equal(none.materialBudget.toString(), '257500/11');
  const withBand = P.budgetForTarget(back({ costLines: [fixed('band', K('75'), 'inc')] }));
  // (800 − 125 × 1,25 − 75) ÷ 1,25 = 455 kr varor inkl. påslag, och 455 ÷ 2,2 = 206,8181… kr
  assert.equal(withBand.materialBudget.toString(), '227500/11');
  assert.equal(s(withBand.materialBudgetMoney), '206.81');
  assert.equal(s(withBand.effectiveTarget), '800.00');
  const at = m => P.priceArrangement(input({ labor: { mode: 'fixed', fee: K('125') }, costLines: [fixed('band', K('75'), 'inc'), std('budget', m)] })).customerPrice;
  assert.equal(s(at(withBand.materialBudgetMoney)), '800.00');
  assert.equal(s(at(withBand.materialBudgetMoney.add(Money.of(1n)))), '805.00');
  assert.equal(P.budgetForTarget(back({ costLines: [fixed('band', K('200'), 'ex')] })).materialBudget.toString(), P.budgetForTarget(back({ costLines: [fixed('band', K('250'), 'inc')] })).materialBudget.toString());
  assert.equal(P.budgetForTarget(back({ costLines: [fixed('vas', K('900'), 'inc')] })).status, 'NEGATIVE');
  assert.equal(P.budgetForTarget(back({ costLines: [{ id: 'x', kind: 'accessories', pricing: 'FIXED_SALE_PRICE' }] })).status, 'INCOMPLETE');
});

// ---------- egenskapstest ----------
test('egenskaper: beräknat pris är oberoende av avrundningen, även med egna tillägg och flera momskategorier (1 000 fall)', () => {
  const r = rng(314), int = intIn(r), pick = pickOf(r);
  const rules = [fixtureMixed({ arrangement_goods: 1200, labor: 2500, delivery: 600, accessories: 600, plants: 0, other: 1234 })];
  let ok = 0;
  for (let i = 0; i < 1000; i++) {
    const lines = Array.from({ length: int(0, 4) }, (_, k) => pick([
      std('s' + k, Money.of(BigInt(int(0, 500000)), 'SEK'), { markup: pick([true, false]), taxCategory: pick([undefined, 'plants', 'accessories']) }),
      fixed('f' + k, Money.of(BigInt(int(0, 500000)), 'SEK'), pick(['inc', 'ex']), { cost: pick([undefined, null, Money.of(BigInt(int(0, 100000)), 'SEK')]), taxCategory: pick([undefined, 'plants', 'accessories', 'other']) })
    ]));
    const common = { markupBp: int(0, 30000), labor: pick([null, { mode: 'fixed', fee: Money.of(BigInt(int(0, 30000)), 'SEK') }]), ruleSets: rules };
    const a = P.priceArrangement(input({ ...common, costLines: lines, rounding: { step: Money.of(BigInt(pick([1, 100, 500, 1000])), 'SEK'), mode: ROUNDING.CEIL } }));
    const b = P.priceArrangement(input({ ...common, costLines: lines, rounding: { step: Money.of(1n), mode: ROUNDING.CEIL } }));
    if (a.status === 'EMPTY') continue;
    assert.equal(a.status, 'OK');
    assert.equal(snap(a.calculated), snap(b.calculated), 'det beräknade ändras inte av avrundningen');
    assert.ok(Frac.sum(a.calculated.byRate.map(g => g.incVat)).eq(a.calculated.incVat));
    assert.ok(a.calculated.exVat.add(a.calculated.vat).eq(a.calculated.incVat));
    assert.ok(a.presented.incVat.toFrac().sub(a.calculated.incVat).eq(a.presented.rounding));
    assert.ok(a.presented.rounding.gte(F(0)) && a.presented.rounding.lt(a.presented.roundingRule.step));
    assert.ok(a.presented.exVat.add(a.presented.vat).eq(a.presented.incVat));
    assert.ok(b.presented.rounding.gte(F(0)) && b.presented.rounding.lt(F(1)), 'med ett steg på ett öre skiljer presenterat och beräknat mindre än ett öre');
    ok++;
  }
  assert.ok(ok > 800, 'de flesta fallen ska vara icke-tomma: ' + ok);
});

test('egenskaper: bakåt och framåt hör ihop när raderna är blandade vanliga och fasta, med flera kategorier (800 fall)', () => {
  const r = rng(2718), int = intIn(r), pick = pickOf(r);
  const rules = [fixtureMixed({ arrangement_goods: 1200, labor: 2500, delivery: 600, accessories: 600, plants: 0, other: 1234 })];
  let ok = 0, neg = 0;
  for (let i = 0; i < 800; i++) {
    const lines = Array.from({ length: int(0, 3) }, (_, k) => pick([
      std('s' + k, Money.of(BigInt(int(0, 300000)), 'SEK'), { markup: pick([true, false]), taxCategory: pick([undefined, 'plants', 'accessories']) }),
      fixed('f' + k, Money.of(BigInt(int(0, 300000)), 'SEK'), pick(['inc', 'ex']), { taxCategory: pick([undefined, 'plants', 'other']) })
    ]));
    const step = Money.of(BigInt(pick([1, 100, 500, 1000])), 'SEK');
    const common = { markupBp: int(0, 30000), labor: pick([null, { mode: 'fixed', fee: Money.of(BigInt(int(0, 30000)), 'SEK') }]), ruleSets: rules, rounding: { step, mode: ROUNDING.CEIL } };
    const target = Money.of(BigInt(int(0, 900000)), 'SEK'), budgetMarkup = pick([true, false]);
    const b = P.budgetForTarget({ ...input(common), costLines: lines, target, budget: { markup: budgetMarkup } });
    const fwd = m => P.priceArrangement(input({ ...common, costLines: [...lines, std('budget', m, { markup: budgetMarkup })] }));
    if (b.status === 'OK') {
      ok++;
      assert.ok(fwd(b.materialBudgetMoney).customerPrice.lte(target));
      assert.ok(fwd(b.materialBudgetMoney.add(Money.of(1n))).customerPrice.gt(target));
    } else {
      assert.equal(b.status, 'NEGATIVE'); neg++;
      assert.ok(fwd(Money.zero('SEK')).customerPrice.gt(target));
    }
  }
  assert.ok(ok > 150 && neg > 20, `ok=${ok} negativ=${neg}`);
});
