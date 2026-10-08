// Amounts (exkl. moms / moms / inkl. moms) och TaxRuleSet (versionerade regler som data).
// Alla satser här är TESTDATA (fixtures). Ingen av dem är en verifierad svensk skatteregel.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import M from '../public/js/core/money.js';
import A from '../public/js/core/amounts.js';
import T from '../public/js/core/tax.js';
import { fixtureFlat, fixtureMixed } from './support/tax-fixtures.mjs';
import { rng, intIn, pickOf } from './support/rng.mjs';

const { Money, Frac, EconomyError } = M;
const K = s => Money.fromDecimal(s);
const code = fn => { try { fn(); } catch (e) { return e instanceof EconomyError ? e.code : 'other:' + e.message; } return null; };
const s = x => x.toDecimalString();

// ---------- Amounts ----------
test('Amounts: exkl. moms → moms → inkl. moms', () => {
  const a = A.fromEx(K('100'), 2500);
  assert.equal(s(a.exVat), '100.00'); assert.equal(s(a.vat), '25.00'); assert.equal(s(a.incVat), '125.00');
  assert.equal(a.basis, 'ex'); assert.equal(a.vatRate, 2500);
  const b = A.fromEx(K('33,33'), 2500);                       // 8,3325 → 8,33
  assert.equal(s(b.vat), '8.33'); assert.equal(s(b.incVat), '41.66');
  const c = A.fromEx(K('0,02'), 2500);                        // 0,5 öre → hälften avrundas uppåt
  assert.equal(c.vat.amount, 1n);
  const z = A.fromEx(K('100'), 0);                            // 0 % moms är en känd sats, inte okänd
  assert.equal(z.vat.amount, 0n); assert.equal(s(z.incVat), '100.00');
});

test('Amounts: inkl. moms → exkl. moms, summan stämmer alltid exakt', () => {
  const a = A.fromInc(K('125'), 2500);
  assert.equal(s(a.exVat), '100.00'); assert.equal(s(a.vat), '25.00'); assert.equal(a.basis, 'inc');
  const b = A.fromInc(K('100'), 2500);
  assert.equal(s(b.exVat), '80.00'); assert.equal(s(b.vat), '20.00');
  const c = A.fromInc(K('0,03'), 2500);                       // 3 öre ÷ 1,25 = 2,4 öre → 2 öre, moms 1 öre
  assert.equal(c.exVat.amount, 2n); assert.equal(c.vat.amount, 1n);
  const d = A.fromInc(K('670'), 2500);
  assert.equal(s(d.exVat), '536.00'); assert.equal(s(d.vat), '134.00');
});

test('Amounts: okänd sats ger okänt, aldrig noll eller gissning', () => {
  const a = A.fromEx(K('100'), null);
  assert.equal(a.vat, null); assert.equal(a.incVat, null); assert.equal(a.vatRate, null);
  const b = A.fromInc(K('125'), null);
  assert.equal(b.exVat, null); assert.equal(b.vat, null);
  assert.equal(A.fromEx(K('100')).incVat, null);
});

test('Amounts: bara kända värden, rätt valuta, frysta', () => {
  assert.equal(code(() => A.fromEx(100, 2500)), 'not_money');
  assert.equal(code(() => A.fromEx(K('1'), 25.5)), 'bad_rate');
  assert.equal(code(() => A.fromEx(K('1'), -1)), 'bad_rate');
  const a = A.fromEx(K('100'), 2500);
  assert.throws(() => { a.vat = K('1'); }, TypeError);
  assert.equal(A.fromEx(Money.of(10000n, 'EUR'), 2500).incVat.currency, 'EUR');
});

test('Amounts.fromStated: ett dokuments egna belopp måste stämma', () => {
  const a = A.fromStated({ exVat: K('100'), vat: K('25'), vatRate: 2500 });
  assert.equal(s(a.incVat), '125.00'); assert.equal(a.basis, 'stated');
  assert.equal(s(A.fromStated({ incVat: K('125'), vat: K('25') }).exVat), '100.00');
  assert.equal(s(A.fromStated({ exVat: K('100'), incVat: K('125') }).vat), '25.00');
  assert.equal(code(() => A.fromStated({ exVat: K('100'), vat: K('25'), incVat: K('126') })), 'inconsistent_amounts');
  assert.equal(code(() => A.fromStated({ exVat: K('100'), vat: K('30'), vatRate: 2500 })), 'inconsistent_amounts');  // momsen stämmer inte med satsen
  assert.equal(code(() => A.fromStated({ exVat: K('100'), vat: K('25,01'), vatRate: 2500 })), null);                  // ett öre avrundning tillåts
  assert.equal(code(() => A.fromStated({ vat: K('25') })), 'too_little');
});

test('Amounts.validate: hittar fel och tillåter okänt', () => {
  const ok = A.fromEx(K('100'), 2500);
  assert.deepEqual(A.validate(ok), []);
  assert.deepEqual(A.validate(A.fromEx(K('100'), null)), []);
  const bad = { ...ok, vat: K('26') };
  assert.ok(A.validate(bad).length > 0);
  assert.ok(A.validate({ ...ok, basis: 'maybe' }).length > 0);
  assert.ok(A.validate({ ...ok, vat: Money.of(2500n, 'EUR') }).length > 0);
});

test('Amounts.costBasis: inköpskostnad exkl. avdragsgill moms', () => {
  assert.equal(s(A.costBasis(A.fromEx(K('100'), 2500)).cost), '100.00');
  assert.equal(s(A.costBasis(A.fromInc(K('125'), 2500)).cost), '100.00');
  assert.deepEqual(A.costBasis(A.fromInc(K('125'), null)), { cost: null, reason: 'vat_unknown' });      // satsen okänd: kan inte räkna om
  assert.deepEqual(A.costBasis({ exVat: null, vat: null, incVat: null, vatRate: null, currency: 'SEK' }), { cost: null, reason: 'amount_missing' });
  assert.equal(s(A.costBasis(A.fromEx(K('100'), 2500), { vatDeductible: false }).cost), '125.00');    // ej avdragsgill moms är en kostnad
  assert.equal(s(A.costBasis(A.fromInc(K('125'), 2500), { vatDeductible: false }).cost), '125.00');
  assert.deepEqual(A.costBasis(A.fromEx(K('100'), null), { vatDeductible: false }), { cost: null, reason: 'vat_unknown' });
});

test('Amounts: JSON tur och retur', () => {
  const a = A.fromEx(K('186,50'), 2500, { source: { kind: 'supplier', ref: 'q1' }, verifiedAt: '2026-10-07', ruleSetRef: 'fixture-flat@1' });
  const b = A.fromJSON(JSON.parse(JSON.stringify(A.toJSON(a))));
  assert.deepEqual(A.toJSON(b), A.toJSON(a));
  assert.equal(code(() => A.fromJSON({ ...A.toJSON(a), vat: { amount: '1', currency: 'SEK' } })), 'inconsistent_amounts');
});

test('egenskaper: exkl. + moms = inkl. alltid, och inkl. → exkl. bevarar inkl. (4 000 slumpade fall)', () => {
  const r = rng(11), int = intIn(r), pick = pickOf(r);
  for (let i = 0; i < 4000; i++) {
    const rate = pick([0, 600, 1200, 2500, 1234, 1]);
    const ex = Money.of(BigInt(int(0, 100000000)), 'SEK');
    const a = A.fromEx(ex, rate);
    assert.ok(a.exVat.add(a.vat).eq(a.incVat));
    assert.deepEqual(A.validate(a), []);
    const inc = Money.of(BigInt(int(0, 100000000)), 'SEK');
    const b = A.fromInc(inc, rate);
    assert.ok(b.incVat.eq(inc) && b.exVat.add(b.vat).eq(inc));
    assert.ok(!b.exVat.isNegative() && !b.vat.isNegative());
    assert.deepEqual(A.validate(b), []);
  }
});

// ---------- TaxRuleSet ----------
const spec = (o = {}) => ({ id: 'x', version: 1, validFrom: '2026-01-01', validTo: null, rates: { flowers: 1111, labor: 2222 }, source: { kind: 'fixture' }, verification: { status: 'unverified' }, ...o });

test('TaxRuleSet: giltig uppsättning byggs, fryses och är oföränderlig', () => {
  const rs = T.createRuleSet(spec());
  assert.equal(rs.rates.flowers, 1111);
  assert.ok(Object.isFrozen(rs) && Object.isFrozen(rs.rates) && Object.isFrozen(rs.source) && Object.isFrozen(rs.verification));
  assert.throws(() => { rs.rates.flowers = 1; }, TypeError);
  assert.throws(() => { rs.version = 2; }, TypeError);
  assert.equal(rs.roundingLevel, 'line');
  assert.equal(rs.verification.status, 'unverified');
});

test('TaxRuleSet: ogiltiga uppsättningar avvisas med alla fel', () => {
  const bad = o => code(() => T.createRuleSet(spec(o)));
  assert.equal(bad({ id: '' }), 'bad_rule_set');
  assert.equal(bad({ version: 0 }), 'bad_rule_set');
  assert.equal(bad({ version: 1.5 }), 'bad_rule_set');
  assert.equal(bad({ validFrom: '2026-1-1' }), 'bad_rule_set');
  assert.equal(bad({ validTo: '2025-12-31' }), 'bad_rule_set');
  assert.equal(bad({ rates: { rosor: 1000 } }), 'bad_rule_set');           // okänd kategori
  assert.equal(bad({ rates: { flowers: 10001 } }), 'bad_rule_set');
  assert.equal(bad({ rates: { flowers: 12.5 } }), 'bad_rule_set');
  assert.equal(bad({ rates: { flowers: -1 } }), 'bad_rule_set');
  assert.equal(bad({ rates: null }), 'bad_rule_set');
  assert.equal(bad({ roundingLevel: 'hela' }), 'bad_rule_set');
  assert.equal(bad({ source: { kind: 'wikipedia' } }), 'bad_rule_set');
  assert.equal(bad({ verification: { status: 'ja' } }), 'bad_rule_set');
  assert.equal(code(() => T.createRuleSet(undefined)), 'bad_rule_set');
});

test('TaxRuleSet: bara en officiell källa med länk, person och datum kan vara verifierad', () => {
  const verified = (src, ver) => code(() => T.createRuleSet(spec({ source: src, verification: ver })));
  // TESTDATA: bara för att prova grinden. Satserna i spec() (1111, 2222) är inga riktiga regler.
  assert.equal(verified({ kind: 'official', url: 'https://example.invalid/test' }, { status: 'verified', verifiedBy: 'testperson', verifiedAt: '2026-10-07' }), null);
  assert.equal(verified({ kind: 'fixture' }, { status: 'verified', verifiedBy: 'testperson', verifiedAt: '2026-10-07' }), 'bad_rule_set');
  assert.equal(verified({ kind: 'user_setting' }, { status: 'verified', verifiedBy: 'testperson', verifiedAt: '2026-10-07' }), 'bad_rule_set');
  // även med länk, person och datum kan testdata och en egen inställning aldrig bli verifierade: bara källtypen 'official' räknas
  assert.equal(verified({ kind: 'fixture', url: 'https://example.invalid/test' }, { status: 'verified', verifiedBy: 'testperson', verifiedAt: '2026-10-07' }), 'bad_rule_set');
  assert.equal(verified({ kind: 'user_setting', url: 'https://example.invalid/test' }, { status: 'verified', verifiedBy: 'testperson', verifiedAt: '2026-10-07' }), 'bad_rule_set');
  assert.equal(verified({ kind: 'official' }, { status: 'verified', verifiedBy: 'testperson', verifiedAt: '2026-10-07' }), 'bad_rule_set');      // länk saknas
  assert.equal(verified({ kind: 'official', url: 'https://example.invalid/test' }, { status: 'verified', verifiedAt: '2026-10-07' }), 'bad_rule_set'); // person saknas
  assert.equal(verified({ kind: 'official', url: 'https://example.invalid/test' }, { status: 'verified', verifiedBy: 'testperson' }), 'bad_rule_set'); // datum saknas
});

test('TaxRuleSet: en regel kan inte skapas verifierad av misstag (standard är overifierad)', () => {
  const rs = T.createRuleSet({ id: 'y', version: 1, validFrom: '2026-01-01', rates: { flowers: 100 }, source: { kind: 'official', url: 'https://example.invalid/test' } });
  assert.equal(rs.verification.status, 'unverified');
});

test('resolveRate: giltighetstid, version och aldrig en gissad sats', () => {
  const v1 = T.createRuleSet(spec({ id: 'r', version: 1, validFrom: '2026-01-01', validTo: '2026-06-30', rates: { flowers: 1000, labor: 2000 } }));
  const v2 = T.createRuleSet(spec({ id: 'r', version: 2, validFrom: '2026-07-01', validTo: null, rates: { flowers: 1500 } }));
  const rules = [v1, v2];
  const at = (cat, d) => T.resolveRate(rules, cat, d);
  assert.equal(at('flowers', '2026-06-30').rateBp, 1000);
  assert.equal(at('flowers', '2026-06-30').ruleSetRef, 'r@1');
  assert.equal(at('flowers', '2026-07-01').rateBp, 1500);
  assert.equal(at('flowers', '2026-07-01').ruleSetRef, 'r@2');
  assert.deepEqual(at('flowers', '2025-12-31'), { ok: false, reason: 'no_rule_set', category: 'flowers' });
  assert.equal(at('labor', '2026-07-01').reason, 'rate_missing');          // v2 saknar arbete: ingen sats, inte v1:s sats
  assert.equal(at('rosor', '2026-07-01').reason, 'unknown_category');
  assert.equal(at('flowers', '2026-7-1').reason, 'bad_date');
  assert.equal(T.resolveRate([], 'flowers', '2026-07-01').reason, 'no_rule_set');
  assert.equal(T.resolveRate(undefined, 'flowers', '2026-07-01').reason, 'no_rule_set');
});

test('resolveRate: samma id med högre version vinner, olika id samtidigt är tvetydigt', () => {
  const a = T.createRuleSet(spec({ id: 'a', version: 1, rates: { flowers: 100 } }));
  const a2 = T.createRuleSet(spec({ id: 'a', version: 2, rates: { flowers: 200 } }));
  const b = T.createRuleSet(spec({ id: 'b', version: 1, rates: { flowers: 300 } }));
  assert.equal(T.resolveRate([a, a2], 'flowers', '2026-05-05').rateBp, 200);
  assert.equal(T.resolveRate([a2, a], 'flowers', '2026-05-05').rateBp, 200);       // ordningen spelar ingen roll
  assert.equal(T.resolveRate([a, b], 'flowers', '2026-05-05').reason, 'ambiguous_rule_set');
});

test('resolveRate: ger regelns ursprung och verifieringsstatus med svaret', () => {
  const r = T.resolveRate([fixtureFlat(1234)], 'flowers', '2026-10-07');
  assert.equal(r.ok, true); assert.equal(r.rateBp, 1234);
  assert.equal(r.ruleSetRef, 'fixture-flat@1'); assert.equal(r.verification, 'unverified'); assert.equal(r.sourceKind, 'fixture');
});

test('legacy-user-setting: speglar floristens egen inställning och är aldrig verifierad', () => {
  const rs = T.legacyUserSettingRuleSet(25);
  assert.equal(rs.id, 'legacy-user-setting');
  assert.ok(T.TAX_CATEGORIES.every(c => rs.rates[c] === 2500));
  assert.equal(rs.source.kind, 'user_setting'); assert.equal(rs.verification.status, 'unverified');
  assert.equal(T.legacyUserSettingRuleSet('12,5').rates.labor, 1250);
  assert.equal(code(() => T.legacyUserSettingRuleSet('abc')), 'bad_decimal');
  assert.equal(code(() => T.legacyUserSettingRuleSet(-5)), 'bad_rate');
  assert.equal(T.legacyUserSettingRuleSet(0).rates.flowers, 0);
});

test('en faktura kräver en verifierad regel (assertVerified)', () => {
  const legacy = T.resolveRate([T.legacyUserSettingRuleSet(25)], 'flowers', '2026-10-07');
  assert.equal(code(() => T.assertVerified(legacy)), 'unverified_rule');
  assert.equal(code(() => T.assertVerified(T.resolveRate([fixtureFlat(2500)], 'flowers', '2026-10-07'))), 'unverified_rule');
  assert.equal(code(() => T.assertVerified(T.resolveRate([], 'flowers', '2026-10-07'))), 'no_rule');
  assert.equal(code(() => T.assertVerified(undefined)), 'no_rule');
  // TESTDATA: en strukturellt giltig "verifierad" uppsättning, bara för att se att grinden öppnas. Satsen 1234 är ingen regel.
  const okSet = T.createRuleSet(spec({ id: 'v', rates: { flowers: 1234 }, source: { kind: 'official', url: 'https://example.invalid/test' }, verification: { status: 'verified', verifiedBy: 'testperson', verifiedAt: '2026-10-07' } }));
  assert.equal(T.assertVerified(T.resolveRate([okSet], 'flowers', '2026-10-07')).rateBp, 1234);
});

test('freezeRate: satsen och regelversionen följer med raden och ändras aldrig av en senare regel', () => {
  const v1 = T.createRuleSet(spec({ id: 'r', version: 1, validFrom: '2026-01-01', rates: { flowers: 1000 } }));
  const frozen = T.freezeRate(T.resolveRate([v1], 'flowers', '2026-03-03'));
  const v2 = T.createRuleSet(spec({ id: 'r', version: 2, validFrom: '2026-01-01', rates: { flowers: 9999 } }));
  assert.equal(T.resolveRate([v1, v2], 'flowers', '2026-03-03').rateBp, 9999);       // nya beräkningar får den nya regeln
  assert.equal(frozen.rateBp, 1000); assert.equal(frozen.ruleSetRef, 'r@1');          // det frysta ändras inte
  assert.ok(Object.isFrozen(frozen));
  assert.throws(() => { frozen.rateBp = 1; }, TypeError);
  assert.equal(code(() => T.freezeRate({ ok: false })), 'no_rule');
});

test('mixed fixture: olika satser per kategori', () => {
  const rs = fixtureMixed({ flowers: 1200, labor: 2500, delivery: 600 });
  const get = c => T.resolveRate([rs], c, '2026-10-07').rateBp;
  assert.deepEqual([get('flowers'), get('labor'), get('delivery')], [1200, 2500, 600]);
});

test('produktionsmodulen innehåller inga inbyggda svenska momssatser och inga officiella regeluppsättningar', () => {
  const src = fs.readFileSync(new URL('../public/js/core/tax.js', import.meta.url), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1');
  for (const n of ['2500', '1200', '600', '1250', '2000']) assert.ok(!new RegExp('\\b' + n + '\\b').test(src), 'hittade ' + n);
  assert.ok(!/skatteverket|official'\s*,\s*url/i.test(src.replace(/'official'/g, '')), 'inbyggd officiell källa');
  assert.deepEqual(Object.keys(T).sort(), ['LEGACY_ID', 'ROUNDING_LEVELS', 'SOURCE_KINDS', 'TAX_CATEGORIES', 'assertVerified', 'createRuleSet', 'freezeRate', 'legacyUserSettingRuleSet', 'resolveRate', 'selectRuleSet']);
});
