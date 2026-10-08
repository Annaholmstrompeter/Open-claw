// Differenstest, hela kedjan: rader i arrangemang → exakt inköpsplan (hela förpackningar, delning, hemmalager, frakt) → exakt pris.
// Den jämförs med den gamla räknemotorn calc() (referensmotorn, flyttal) på samma 145 sparade tillstånd som övriga differenstester.
// Där calc() och den nya kedjan avviker medvetet står det i docs/EKONOMIREGLER.md. Den nya kedjan rättar sig inte efter ett fel i calc().
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadApp } from './helpers/app.mjs';
import { fixtures, randomV1State, randomCleanV1State } from './support/v1-fixtures.mjs';
import { GOLDEN_FUZZ, GOLDEN_CLEAN } from './support/calc-extract.mjs';
import { floatFromFrac } from './support/exact-float.mjs';
import { workspaceFromV1, TODAY } from './support/v1-to-workspace.mjs';
import W from '../public/js/core/workspace.js';

const near = (a, b) => Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));
const kr = f => floatFromFrac(f) / 100;                       // bråk i ören till kronor (flyttal, bara för jämförelsen)

const NAMES = [
  ...Object.keys(fixtures()).map(n => ['fixtur: ' + n, () => fixtures()[n]]),
  ...Array.from({ length: GOLDEN_FUZZ }, (_, n) => ['slump ' + n, () => randomV1State(n)]),
  ...Array.from({ length: GOLDEN_CLEAN }, (_, n) => ['ren ' + n, () => randomCleanV1State(n)])
];

test('differens: den nya kedjan (rader → inköpsplan → pris) ger samma inköp, överskott, frakt och priser som calc() i de 145 tillstånden', async t => {
  let states = 0, skipped = 0, buys = 0, rows = 0, jobs = 0, maxDev = 0;
  const seen = { whole: 0, used: 0, shipping: 0, onHand: 0, shared: 0 };
  const diffs = [];
  const cmp = (name, what, want, got) => { if (!near(want, got)) diffs.push(`${name}: ${what} calc() ${want} ≠ ny ${got}`); else maxDev = Math.max(maxDev, Math.abs(want - got)); };
  for (const [name, make] of NAMES) {
    const app = await loadApp({ storage: { 'buketraknare.v1': JSON.stringify(make()) } });
    const C = app.calc(), view = app.hook.state();
    app.close();
    const w = workspaceFromV1(view);
    if (w.skip) { skipped++; continue; }
    states++;
    if (view.settings.mode === 'whole') seen.whole++; else seen.used++;
    if (C.ship > 0) seen.shipping++;
    if (Object.values(C.buy).some(b => b.have > 0)) seen.onHand++;
    if (Object.values(C.buy).some(b => b.leftover > 0) && C.rows.filter(r => !r.empty).length > 1) seen.shared++;
    const res = W.priceEvent(w.st, w.ev.id, { catalog: w.catalog, today: TODAY });
    const plan = res.plan;

    // inköp: samma artiklar, samma antal förpackningar, samma kostnad
    assert.deepEqual([...Object.keys(C.buy)].map(k => 'conn_manual:' + k).sort(), plan.requirements.map(r => r.key).sort(), name + ': samma artiklar');
    assert.deepEqual([...C.missing].map(k => 'conn_manual:' + k).sort(), [...plan.missing].sort(), name + ': samma artiklar som saknas');
    assert.deepEqual([...C.noPrice].map(k => 'conn_manual:' + k).sort(), [...plan.noPrice].sort(), name + ': samma artiklar utan pris');
    for (const [k, b] of Object.entries(C.buy)) {
      const r = plan.requirements.find(x => x.key === 'conn_manual:' + k);
      buys++;
      for (const [f, a, g] of [['need', b.need, r.needed], ['have', b.have, r.onHand], ['toBuy', b.toBuy, r.toBuy], ['packs', b.packs, r.packs], ['bought', b.bought, r.bought], ['leftover', b.leftover, r.leftover]])
        if (a !== g) diffs.push(`${name}: ${k} ${f} calc() ${a} ≠ ny ${g}`);
      if (b.hasPrice !== r.hasPrice) diffs.push(`${name}: ${k} hasPrice`);
      cmp(name, k + ' cost', b.cost, kr(r.cost)); cmp(name, k + ' used', b.used, kr(r.usedCost)); cmp(name, k + ' leftoverValue', b.leftoverValue, kr(r.leftoverValue));
    }
    cmp(name, 'purchaseSum', C.purchaseSum, kr(plan.purchaseSum));
    cmp(name, 'ship', C.ship, kr(plan.shipping.total));
    cmp(name, 'leftoverValue', C.leftoverValue, kr(plan.leftover.value));
    if (C.leftoverStems !== plan.leftover.stems) diffs.push(`${name}: leftoverStems calc() ${C.leftoverStems} ≠ ny ${plan.leftover.stems}`);

    // rad för rad
    C.rows.forEach((r, i) => {
      const a = res.arrangements[i].result;
      rows++;
      if (r.empty) { if (a.status !== 'EMPTY' || a.customerPrice.amount !== 0n) diffs.push(`${name} rad ${i}: tom rad ska vara 0 kr`); return; }
      if (r.incomplete) { if (a.status !== 'INCOMPLETE') diffs.push(`${name} rad ${i}: ska vara ofullständig`); return; }
      if (a.status !== 'OK') { diffs.push(`${name} rad ${i}: calc() ger pris, ny ger ${a.status}`); return; }
      const p = plan.arrangements[i];
      if (BigInt(Math.round(r.price * 100)) !== a.customerPrice.amount) diffs.push(`${name} rad ${i}: kundpris calc() ${r.price} ≠ ny ${a.customerPrice.toDecimalString()}`);
      cmp(name, `rad ${i} flowers`, r.flowers, kr(p.materialCost)); cmp(name, `rad ${i} shipShare`, r.shipShare || 0, kr(p.freightShare));
      cmp(name, `rad ${i} base`, r.base, kr(a.breakdown.materials.total)); cmp(name, `rad ${i} markup`, r.markup, kr(a.breakdown.markup.amount)); cmp(name, `rad ${i} labor`, r.labor, kr(a.breakdown.labor.amount));
      cmp(name, `rad ${i} exVat`, r.exVat, kr(a.calculated.exVat)); cmp(name, `rad ${i} vat`, r.vat, kr(a.calculated.vat)); cmp(name, `rad ${i} rounding`, r.rounding, kr(a.presented.rounding));
      cmp(name, `rad ${i} priceExVat`, r.priceExVat, kr(Frac_sum(a))); cmp(name, `rad ${i} margin`, r.margin, a.margin === null ? 0 : floatFromFrac(a.margin));
      if (r.approx !== (a.priceStatus === 'ESTIMATED')) diffs.push(`${name} rad ${i}: ca-markering calc() ${r.approx} ≠ ny ${a.priceStatus}`);
    });
    if (!C.incomplete) { jobs++; if (BigInt(Math.round(C.total * 100)) !== res.job.totalIncVat.amount) diffs.push(`${name}: jobbets summa calc() ${C.total} ≠ ny ${res.job.totalIncVat.toDecimalString()}`); }
    else assert.equal(res.status, 'INCOMPLETE', name + ': ofullständigt jobb');
  }
  t.diagnostic(`jämförde ${states} av ${NAMES.length} tillstånd (${skipped} hoppades över; läge hela/använt ${seen.whole}/${seen.used}, med frakt ${seen.shipping}, med hemmalager ${seen.onHand}), ${buys} inköpsrader, ${rows} arrangemangsrader, ${jobs} jobbsummor, största avvikelse ${maxDev} kr`);
  assert.deepEqual(diffs, [], 'avvikelser mellan calc() och den nya kedjan:\n' + diffs.slice(0, 25).join('\n'));
  assert.ok(states >= 100 && buys >= 150 && rows >= 150 && jobs >= 60, `testet ska jämföra mycket: tillstånd ${states}, inköpsrader ${buys}, rader ${rows}, jobb ${jobs}`);
  assert.ok(seen.whole > 20 && seen.used > 5 && seen.shipping > 5 && seen.onHand > 5 && seen.shared > 5, 'täckning: ' + JSON.stringify(seen));   // hela förpackningar och bara det som används, med frakt, hemmalager och delade förpackningar
  assert.ok(skipped < 30, 'för många tillstånd hoppades över: ' + skipped);
  assert.ok(maxDev < 1e-6, 'största avvikelse: ' + maxDev);
});
function Frac_sum(a) { return a.exact.saleExVatExact; }
