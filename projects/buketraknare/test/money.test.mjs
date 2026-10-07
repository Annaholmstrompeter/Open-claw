// Ekonomigrunden: Money, exakta bråk, avrundning, decimaltal och procentsatser. Inga flyttal i ny ekonomikod.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import M from '../public/js/core/money.js';
import { rng, intIn, pickOf } from './support/rng.mjs';

const { Frac, Money, Rate, ROUNDING, EconomyError, roundInt, roundToStep, parseDecimal } = M;
const F = (n, d = 1n) => Frac.of(BigInt(n), BigInt(d));
const code = fn => { try { fn(); } catch (e) { return e instanceof EconomyError ? e.code : 'other:' + e.message; } return null; };

// ---------- Frac ----------
test('Frac: normaliseras och räknar exakt', () => {
  assert.equal(F(2, 4).toString(), '1/2');
  assert.equal(F(3, -6).toString(), '-1/2');
  assert.equal(F(0, 7).toString(), '0');
  assert.equal(F(1, 3).add(F(1, 6)).toString(), '1/2');
  assert.equal(F(1, 3).mul(F(3)).toString(), '1');
  assert.equal(F(1).div(F(3)).mul(F(3)).toString(), '1');        // 1 ÷ 3 × 3 blir exakt 1, vilket flyttal inte klarar
  assert.equal(F(186).div(F(12)).toString(), '31/2');            // 186 ÷ 12 = 15,5
  assert.equal(F(100).div(F(3)).sub(F(100, 3)).toString(), '0'); // 100 ÷ 3 tappar ingenting
  assert.equal(code(() => F(1).div(F(0))), 'division_by_zero');
  assert.equal(code(() => Frac.of(1n, 0n)), 'division_by_zero');
});

test('Frac: jämförelse och golv/tak även för negativa tal', () => {
  assert.equal(F(1, 3).cmp(F(2, 6)), 0);
  assert.equal(F(1, 3).cmp(F(1, 2)), -1);
  assert.equal(F(-7, 2).floor(), -4n);
  assert.equal(F(-7, 2).ceil(), -3n);
  assert.equal(F(7, 2).floor(), 3n);
  assert.equal(F(7, 2).ceil(), 4n);
  assert.equal(F(6, 2).floor(), 3n);
  assert.equal(F(6, 2).ceil(), 3n);
  assert.equal(F(-1, 3).sign(), -1);
  assert.ok(F(4, 2).isInteger() && !F(1, 2).isInteger());
});

test('Frac: heltal som inte är heltal avvisas, flyttal tas inte emot som tal i täljaren', () => {
  assert.equal(code(() => Frac.of(1.5)), 'not_integer');
  assert.equal(code(() => Frac.of(NaN)), 'not_integer');
  assert.equal(code(() => Frac.of('abc')), 'not_integer');
  assert.equal(Frac.of('12').toString(), '12');
});

// ---------- avrundning ----------
test('roundInt: namngivna lägen, hälften avrundas bort från noll', () => {
  assert.equal(roundInt(F(5, 2), ROUNDING.HALF_UP), 3n);
  assert.equal(roundInt(F(3, 2), ROUNDING.HALF_UP), 2n);
  assert.equal(roundInt(F(1, 2), ROUNDING.HALF_UP), 1n);
  assert.equal(roundInt(F(49, 100), ROUNDING.HALF_UP), 0n);
  assert.equal(roundInt(F(-1, 2), ROUNDING.HALF_UP), -1n);
  assert.equal(roundInt(F(-3, 2), ROUNDING.HALF_UP), -2n);
  assert.equal(roundInt(F(-49, 100), ROUNDING.HALF_UP), 0n);
  assert.equal(roundInt(F(7, 3), ROUNDING.FLOOR), 2n);
  assert.equal(roundInt(F(7, 3), ROUNDING.CEIL), 3n);
  assert.equal(roundInt(F(-7, 3), ROUNDING.FLOOR), -3n);
  assert.equal(roundInt(F(-7, 3), ROUNDING.CEIL), -2n);
  assert.equal(code(() => roundInt(F(1, 2), 'ROUND')), 'unknown_rounding');
});

test('roundToStep: uppåt till steg utan flyttalsbrus, exakta multipler lämnas orörda', () => {
  assert.equal(roundToStep(F(66775), F(500), ROUNDING.CEIL).toString(), '67000');   // 667,75 kr till närmaste 5 kr uppåt = 670 kr
  assert.equal(roundToStep(F(67000), F(500), ROUNDING.CEIL).toString(), '67000');   // exakt multipel: oförändrad
  assert.equal(roundToStep(F(67001), F(500), ROUNDING.CEIL).toString(), '67500');   // ett öre över: nästa steg
  assert.equal(roundToStep(F(66775), F(500), ROUNDING.FLOOR).toString(), '66500');
  assert.equal(roundToStep(F(66749), F(500), ROUNDING.HALF_UP).toString(), '66500');
  assert.equal(roundToStep(F(66750), F(500), ROUNDING.HALF_UP).toString(), '67000');
  assert.equal(code(() => roundToStep(F(1), F(0), ROUNDING.CEIL)), 'bad_step');
  assert.equal(code(() => roundToStep(F(1), F(-5), ROUNDING.CEIL)), 'bad_step');
});

// ---------- decimaltal i text ----------
test('parseDecimal: svenska och engelska tal, tusentalsmellanrum, exponent', () => {
  assert.equal(parseDecimal('186').toString(), '186');
  assert.equal(parseDecimal('186,50').toString(), '373/2');
  assert.equal(parseDecimal('186.5').toString(), '373/2');
  assert.equal(parseDecimal('1 234,5').toString(), '2469/2');
  assert.equal(parseDecimal('1 234,5').toString(), '2469/2');
  assert.equal(parseDecimal('-0.5').toString(), '-1/2');
  assert.equal(parseDecimal('+2').toString(), '2');
  assert.equal(parseDecimal('1e3').toString(), '1000');
  assert.equal(parseDecimal('1E-2').toString(), '1/100');
  assert.equal(parseDecimal('0,125').toString(), '1/8');
  assert.equal(parseDecimal('.5').toString(), '1/2');
  assert.equal(parseDecimal(12.5).toString(), '25/2');
});

test('parseDecimal: det som inte är ett tal avvisas', () => {
  for (const bad of ['', ' ', '.', ',', '1.2.3', '12abc', 'abc', '1e', 'e5', '--1', Infinity, NaN, null, undefined, {}, '1e99'])
    assert.equal(code(() => parseDecimal(bad)), 'bad_decimal', 'borde avvisas: ' + String(bad));
});

// ---------- Money ----------
test('Money: hela ören, text in och ut, valuta', () => {
  assert.equal(Money.fromDecimal('186,50').amount, 18650n);
  assert.equal(Money.fromDecimal('186').toDecimalString(), '186.00');
  assert.equal(Money.fromDecimal('0,05').toDecimalString(), '0.05');
  assert.equal(Money.fromDecimal('-0,05').toDecimalString(), '-0.05');
  assert.equal(Money.fromDecimal('-12,3').toDecimalString(), '-12.30');
  assert.equal(Money.of(5n).toString(), '0.05 SEK');
  assert.equal(Money.of(18650n, 'EUR').currency, 'EUR');
  assert.equal(code(() => Money.of(1n, 'sek')), 'bad_currency');
  assert.equal(code(() => Money.of(1n, 'SE')), 'bad_currency');
});

test('Money: fler än två decimaler avrundas aldrig tyst, och flyttalsbrus avvisas', () => {
  assert.equal(code(() => Money.fromDecimal('1,005')), 'too_many_decimals');
  assert.equal(code(() => Money.fromDecimal(0.1 + 0.2)), 'too_many_decimals');   // 0.30000000000000004
  assert.equal(Money.fromDecimal(0.1).amount, 10n);                              // men ett tal som skrivs som 0.1 är 10 öre
  assert.equal(Money.fromDecimal(14.5).amount, 1450n);
  assert.equal(Money.fromDecimal(1234.56).amount, 123456n);
});

test('Money: räkning, jämförelse och blandade valutor', () => {
  const a = Money.fromDecimal('10,10'), b = Money.fromDecimal('0,20');
  assert.equal(a.add(b).toDecimalString(), '10.30');
  assert.equal(a.sub(b).toDecimalString(), '9.90');
  assert.equal(b.sub(a).toDecimalString(), '-9.90');
  assert.equal(a.cmp(b), 1);
  assert.ok(b.lt(a) && a.gte(a) && a.eq(Money.of(1010n)));
  assert.equal(Money.sum([a, b, b]).toDecimalString(), '10.50');
  assert.equal(code(() => a.add(Money.of(1n, 'EUR'))), 'currency_mismatch');
  assert.equal(code(() => a.cmp(Money.of(1n, 'EUR'))), 'currency_mismatch');
  assert.equal(code(() => a.add(5)), 'not_money');
});

test('Money.fromFrac: avrundar med ett uttalat läge', () => {
  assert.equal(Money.fromFrac(F(5, 2), ROUNDING.HALF_UP).amount, 3n);
  assert.equal(Money.fromFrac(F(5, 2), ROUNDING.FLOOR).amount, 2n);
  assert.equal(Money.fromFrac(F(5, 2), ROUNDING.CEIL).amount, 3n);
  assert.equal(code(() => Money.fromFrac(F(5, 2))), 'unknown_rounding');          // läge måste anges
});

test('Money: JSON utan flyttal och utan BigInt-fel', () => {
  const m = Money.fromDecimal('123456789012,34');
  const s = JSON.stringify({ m });
  assert.equal(s, '{"m":{"amount":"12345678901234","currency":"SEK"}}');
  assert.ok(Money.fromJSON(JSON.parse(s).m).eq(m));
  const f = F(1, 3);
  assert.ok(Frac.fromJSON(JSON.parse(JSON.stringify(f))).eq(f));
});

// ---------- procentsatser ----------
test('Rate: hundradels procent som heltal', () => {
  assert.equal(Rate.fromPercent('25'), 2500);
  assert.equal(Rate.fromPercent(120), 12000);
  assert.equal(Rate.fromPercent('12,5'), 1250);
  assert.equal(Rate.fromPercent(0), 0);
  assert.equal(Rate.toFrac(2500).toString(), '1/4');
  assert.equal(Rate.toFrac(12000).toString(), '6/5');
  assert.equal(Rate.toPercentString(2500), '25');
  assert.equal(Rate.toPercentString(1250), '12.5');
  assert.equal(Rate.toPercentString(5), '0.05');
  assert.equal(Rate.toPercentString(1210), '12.1');
  assert.equal(Rate.toPercentString(1205), '12.05');
  assert.equal(Rate.toPercentString(0), '0');
  assert.equal(code(() => Rate.fromPercent('0,005')), 'bad_rate');
  assert.equal(code(() => Rate.fromPercent('-1')), 'bad_rate');
  assert.equal(code(() => Rate.check(12.5)), 'bad_rate');
  assert.equal(code(() => Rate.check(-1)), 'bad_rate');
});

// ---------- egenskapstester (återskapningsbara) ----------
test('egenskaper: text ↔ Money, summa och avrundning (3 000 slumpade fall)', () => {
  const r = rng(7), int = intIn(r), pick = pickOf(r);
  for (let i = 0; i < 3000; i++) {
    const a = Money.of(BigInt(int(-99999999, 99999999)), 'SEK'), b = Money.of(BigInt(int(-99999999, 99999999)), 'SEK');
    assert.ok(Money.fromDecimal(a.toDecimalString()).eq(a));
    assert.ok(a.add(b).sub(b).eq(a));
    const x = Frac.of(BigInt(int(-5000000, 5000000)), BigInt(int(1, 997)));
    const step = Frac.of(BigInt(pick([1, 5, 10, 100, 500, 1000])));
    const up = roundToStep(x, step, ROUNDING.CEIL), down = roundToStep(x, step, ROUNDING.FLOOR), near = roundToStep(x, step, ROUNDING.HALF_UP);
    assert.ok(up.gte(x) && up.sub(x).lt(step), 'CEIL ligger i [x, x+steg)');
    assert.ok(down.lte(x) && x.sub(down).lt(step), 'FLOOR ligger i (x−steg, x]');
    assert.ok(near.sub(x).abs().lte(step.div(F(2))), 'HALF_UP ligger högst ett halvt steg bort');
    for (const v of [up, down, near]) assert.ok(v.div(step).isInteger(), 'multipel av steget');
  }
});

// ---------- statisk kontroll: inga flyttal i ny ekonomikod ----------
const CORE = ['money.js', 'amounts.js', 'tax.js', 'pricing.js'];
function code_only(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')
    .replace(/'(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*"|`(?:\\.|[^`\\])*`/g, "''");
}
test('ny ekonomikod innehåller inga flyttalsanrop eller decimaltal i koden', () => {
  for (const f of CORE) {
    const src = code_only(fs.readFileSync(new URL('../public/js/core/' + f, import.meta.url), 'utf8'));
    for (const [re, what] of [[/\bMath\./, 'Math.'], [/\bparseFloat\b/, 'parseFloat'], [/\btoFixed\b/, 'toFixed'], [/\bNumber\(/, 'Number('], [/\b\d+\.\d+\b/, 'decimaltal'], [/(^|[^\w.])\.\d+\b/, 'decimaltal utan heltalsdel'], [/\b\d+e[+-]?\d+\b/i, 'tal med exponent'], [/\bBigInt\(\s*[^)]*\.\d/, 'BigInt av decimaltal']])
      assert.ok(!re.test(src), f + ' innehåller ' + what);
  }
});

test('ny ekonomikod rör inte appens tillstånd, webbläsaren eller klockan', () => {
  for (const f of CORE) {
    const src = code_only(fs.readFileSync(new URL('../public/js/core/' + f, import.meta.url), 'utf8'));
    for (const [re, what] of [[/\bwindow\b/, 'window'], [/\bdocument\b/, 'document'], [/\blocalStorage\b/, 'localStorage'], [/\bfetch\b/, 'fetch'], [/\bnew Date\b/, 'new Date'], [/\bDate\.now\b/, 'Date.now'], [/\bMath\.random\b/, 'Math.random']])
      assert.ok(!re.test(src), f + ' använder ' + what);
  }
});
