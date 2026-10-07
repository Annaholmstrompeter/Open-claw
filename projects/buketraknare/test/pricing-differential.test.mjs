// Differenstest: den exakta prismotorn jämförs mot den gamla räknemotorn calc() (referensmotorn, flyttal) på samma 145 sparade
// tillstånd som calc-differential.test.mjs använder. Det som jämförs är den ekonomiska definitionen från inköpskostnad
// (flowers + frakt + emballage per arrangemang, så som calc() räknat fram dem) till kundpris: påslag, arbete, moms, avrundning,
// exkl. moms och marginal. Förpackningslogiken och fraktfördelningen (calc():s första halva) är inte med här.
//
// Där calc() har en annan definition än den nya motorn står avvikelsen i docs/EKONOMIREGLER.md och testas uttryckligen nedan.
// Den nya motorn rättar sig inte efter calc() om calc() har fel. Om dessa tester visar skillnader utreds de en och en.
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadApp } from './helpers/app.mjs';
import { fixtures, randomV1State, randomCleanV1State } from './support/v1-fixtures.mjs';
import { GOLDEN_FUZZ, GOLDEN_CLEAN } from './support/calc-extract.mjs';
import { fracFromFloat, floatFromFrac } from './support/exact-float.mjs';
import M from '../public/js/core/money.js';
import T from '../public/js/core/tax.js';
import P from '../public/js/core/pricing.js';

const { Money, Rate, ROUNDING } = M;
const kr100 = x => fracFromFloat(x).mul(100n);                 // kronor (flyttal) till exakt bråk i ören
const near = (a, b) => Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));

/** Översätter calc():s inställningar till den nya motorns begrepp. Ger null för värden som den nya motorn avvisar. */
function settingsFor(S) {
  const markupBp = Rate.fromPercent(String(S.markupPct));
  const rules = [T.legacyUserSettingRuleSet(String(S.vatPct))];
  // calc(): roundStep större än noll = uppåt till steget. Noll eller mindre = närmaste hela krona (Math.round).
  const rounding = S.roundStep > 0 ? { step: Money.fromDecimal(String(S.roundStep)), mode: ROUNDING.CEIL } : { step: Money.fromDecimal('1'), mode: ROUNDING.HALF_UP };
  return { markupBp, rules, rounding };
}

function arrangementFor(row, S, cfg) {
  const kind = id => ({ id, source: { kind: 'LIVE' }, markup: true });
  return {
    costLines: [
      { ...kind('blommor'), kind: 'flowers', cost: kr100(row.flowers) },
      { ...kind('frakt'), kind: 'freight', cost: kr100(row.shipShare || 0) },
      { ...kind('emballage'), kind: 'packaging', cost: kr100(row.wrap) }
    ],
    markupBp: cfg.markupBp,
    labor: { mode: 'timed', minutes: fracFromFloat(row.size.minutes), hourlyRate: kr100(S.hourly) }
  };
}

const NAMES = [
  ...Object.keys(fixtures()).map(n => ['fixtur: ' + n, () => fixtures()[n]]),
  ...Array.from({ length: GOLDEN_FUZZ }, (_, n) => ['slump ' + n, () => randomV1State(n)]),
  ...Array.from({ length: GOLDEN_CLEAN }, (_, n) => ['ren ' + n, () => randomCleanV1State(n)])
];

test('differens: priserna i de 145 tillstånden räknas exakt som calc() räknar dem, rad för rad', async t => {
  let rows = 0, jobs = 0, skipped = 0, maxDev = 0;
  const diffs = [];
  for (const [name, make] of NAMES) {
    const app = await loadApp({ storage: { 'buketraknare.v1': JSON.stringify(make()) } });
    const C = app.calc(), S = app.hook.state().settings;
    app.close();
    let cfg;
    try { cfg = settingsFor(S); } catch (e) { skipped++; continue; }      // en inställning som den nya motorn inte kan representera exakt
    const date = '2026-10-07';
    const jobLines = [];
    for (const r of C.rows) {
      if (r.empty || r.incomplete) continue;
      const input = { currency: 'SEK', taxDate: date, ruleSets: cfg.rules, rounding: cfg.rounding, ...arrangementFor(r, S, cfg) };
      const res = P.priceArrangement(input);
      rows++;
      jobLines.push({ id: 'r' + r.idx, qty: r.b.qty, arrangement: input });
      const got = {
        base: floatFromFrac(res.breakdown.materials.total) / 100,
        markup: floatFromFrac(res.breakdown.markup.amount) / 100,
        labor: floatFromFrac(res.breakdown.labor.amount) / 100,
        exVat: floatFromFrac(res.exact.saleExVatBeforeRounding) / 100,
        vat: floatFromFrac(res.exact.vatBeforeRounding) / 100,
        rounding: floatFromFrac(res.rounding) / 100,
        priceExVat: floatFromFrac(res.exact.saleExVatExact) / 100,
        margin: res.margin === null ? 0 : floatFromFrac(res.margin)
      };
      const want = { base: r.base, markup: r.markup, labor: r.labor, exVat: r.exVat, vat: r.vat, rounding: r.rounding, priceExVat: r.priceExVat, margin: r.margin };
      if (BigInt(Math.round(r.price * 100)) !== res.customerPrice.amount) diffs.push(`${name} rad ${r.idx}: kundpris calc() ${r.price} ≠ ny ${res.customerPrice.toDecimalString()}`);
      for (const k of Object.keys(want)) {
        const dev = Math.abs(got[k] - want[k]);
        if (!near(got[k], want[k])) diffs.push(`${name} rad ${r.idx}: ${k} calc() ${want[k]} ≠ ny ${got[k]}`);
        else maxDev = Math.max(maxDev, dev);
      }
      assert.equal(res.priceStatus, 'CONFIRMED');                         // alla rader var LIVE här
      assert.equal(res.saleExVat.add(res.vat).amount, res.customerPrice.amount);
    }
    if (!C.incomplete && jobLines.length) {
      const job = P.priceJob({ currency: 'SEK', taxDate: date, ruleSets: cfg.rules, rounding: cfg.rounding, lines: jobLines });
      jobs++;
      if (BigInt(Math.round(C.total * 100)) !== job.totalIncVat.amount) diffs.push(`${name}: jobbets summa calc() ${C.total} ≠ ny ${job.totalIncVat.toDecimalString()}`);
      assert.equal(job.totalExVat.add(job.totalVat).amount, job.totalIncVat.amount);
    }
  }
  t.diagnostic(`jämförde ${rows} rader och ${jobs} jobbsummor i ${NAMES.length - skipped} av ${NAMES.length} tillstånd (${skipped} hoppades över), största avvikelse ${maxDev} kr`);
  assert.deepEqual(diffs, [], 'avvikelser mellan calc() och den exakta motorn:\n' + diffs.slice(0, 20).join('\n'));
  assert.ok(rows >= 100, 'testet ska jämföra många rader, jämförde ' + rows);
  assert.ok(jobs >= 30, 'testet ska jämföra många jobbsummor, jämförde ' + jobs);
  assert.ok(maxDev < 1e-6, 'största avvikelse i kronor: ' + maxDev);
  assert.ok(skipped < 20, 'för många tillstånd hoppades över: ' + skipped);
});

test('differens: de tillstånd som testet faktiskt täcker innehåller olika påslag, moms och avrundningar', async () => {
  const seen = { markup: new Set(), vat: new Set(), step: new Set(), hourly: new Set() };
  for (const [, make] of NAMES.slice(0, 60)) {
    const app = await loadApp({ storage: { 'buketraknare.v1': JSON.stringify(make()) } });
    const S = app.hook.state().settings;
    app.close();
    seen.markup.add(S.markupPct); seen.vat.add(S.vatPct); seen.step.add(S.roundStep); seen.hourly.add(S.hourly);
  }
  assert.ok(seen.markup.size >= 2 && seen.vat.size >= 2 && seen.step.size >= 2, JSON.stringify([...seen.markup, '|', ...seen.vat, '|', ...seen.step]));
});

// ---------- uttryckliga avvikelser: där calc() och den exakta motorn medvetet är olika ----------
test('avvikelse 1: calc() räknar med flyttal och en tolerans (1e-9 steg) i ceilTo, den nya motorn är exakt', () => {
  // 100,0000000001 kr till närmaste 5 kr uppåt: flyttalsmotorn avrundar ner (inom toleransen), den exakta uppåt.
  const input = { currency: 'SEK', taxDate: '2026-10-07', ruleSets: [T.legacyUserSettingRuleSet(0)], markupBp: 0, labor: null, rounding: { step: Money.fromDecimal('5'), mode: ROUNDING.CEIL },
    costLines: [{ id: 'x', kind: 'flowers', cost: M.Frac.of(10000000000001n, 1000000000n), markup: true, source: { kind: 'LIVE' } }] };
  const r = P.priceArrangement(input);
  const ceilTo = (x, step) => Math.ceil(x / step - 1e-9) * step;                  // calc():s ceilTo, ordagrant kopierad
  assert.equal(ceilTo(100.0000000001, 5), 100);                                   // gamla motorn
  assert.equal(r.customerPrice.toDecimalString(), '105.00');                      // exakta motorn: 100,0000000001 är över 100
});

test('avvikelse 2: calc() tillåter avrundningssteg noll (hela kronor), den nya motorn kräver ett positivt steg', () => {
  const input = { currency: 'SEK', taxDate: '2026-10-07', ruleSets: [T.legacyUserSettingRuleSet(25)], markupBp: 0, labor: null, rounding: { step: Money.of(0n), mode: 'CEIL' }, costLines: [] };
  assert.throws(() => P.priceArrangement(input), e => e.code === 'bad_step');
});

test('avvikelse 3: calc() ger marginal 0 när priset är 0, den nya motorn ger okänd (null)', () => {
  const r = P.priceArrangement({ currency: 'SEK', taxDate: '2026-10-07', ruleSets: [T.legacyUserSettingRuleSet(25)], costLines: [], markupBp: 0, labor: null, rounding: { step: Money.fromDecimal('1'), mode: 'CEIL' } });
  assert.equal(r.margin, null);
});
