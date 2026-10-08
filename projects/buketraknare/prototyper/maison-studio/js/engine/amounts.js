/* Buketträknaren: belopp med moms uppdelad (Amounts).
 *
 * Ett Amounts-värde bär samma uppgift på alla ställen där ett pris förekommer (inköp, försäljning, rad, faktura):
 *   exVat     belopp utan moms          Money eller null (okänt)
 *   vatRate   momssats i hundradels %   heltal eller null (okänd)
 *   vat       momsbelopp                Money eller null
 *   incVat    belopp med moms           Money eller null
 *   basis     'ex' | 'inc' | 'stated'   vilket tal som var det observerade. Resten härleds av koden, aldrig av AI.
 *   currency, source, verifiedAt, ruleSetRef
 *
 * Okänt är okänt: saknas satsen får man inte ett påhittat momsbelopp. Då är vat och det andra beloppet null.
 * Invariant: exVat + vat = incVat exakt, när alla tre är kända (kontrolleras av validate).
 *
 * Härledning:  moms ur exkl. moms     vat = HALF_UP(exVat × sats)
 *              exkl. moms ur inkl.    exVat = HALF_UP(incVat ÷ (1 + sats)),  vat = incVat − exVat
 * Inkl. moms är sanningen när det är det som är angivet (till exempel kundpriset), så att summan alltid stämmer.
 * Hur moms avrundas på en faktura (per rad eller per sats) avgörs när reglerna verifierats, inte här.
 */
(function (root, factory) {
  var dep = (typeof module === 'object' && module.exports) ? require('./money.js') : root.BRMoney;
  var api = factory(dep);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.BRAmounts = api;
})(typeof self !== 'undefined' ? self : this, function (M) {
  'use strict';
  const { Money, Frac, Rate, ROUNDING, EconomyError } = M;

  const BASES = ['ex', 'inc', 'stated'];

  function meta(m) {
    m = m || {};
    return { source: m.source === undefined ? null : m.source, verifiedAt: m.verifiedAt === undefined ? null : m.verifiedAt, ruleSetRef: m.ruleSetRef === undefined ? null : m.ruleSetRef };
  }
  function money(x, what) { if (!(x instanceof Money)) throw new EconomyError('not_money', what + ' måste vara ett Money-värde'); return x; }
  function rateOk(r) { return r === null || r === undefined ? null : Rate.check(r, 'momssatsen'); }
  const onePlus = bp => Frac.of(1n).add(Rate.toFrac(bp));

  function build(basis, currency, ex, rate, vat, inc, m) {
    return Object.freeze({ exVat: ex, vatRate: rate, vat, incVat: inc, basis, currency, ...meta(m) });
  }

  /** Från belopp exkl. moms. Utan sats blir moms och inkl. moms okända (null). */
  function fromEx(exVat, rateBp, m) {
    money(exVat, 'exVat'); const r = rateOk(rateBp);
    if (r === null) return build('ex', exVat.currency, exVat, null, null, null, m);
    const vat = Money.fromFrac(exVat.toFrac().mul(Rate.toFrac(r)), ROUNDING.HALF_UP, exVat.currency);
    return build('ex', exVat.currency, exVat, r, vat, exVat.add(vat), m);
  }

  /** Från belopp inkl. moms (till exempel kundpriset). Utan sats blir exkl. moms och moms okända (null). */
  function fromInc(incVat, rateBp, m) {
    money(incVat, 'incVat'); const r = rateOk(rateBp);
    if (r === null) return build('inc', incVat.currency, null, null, null, incVat, m);
    const exVat = Money.fromFrac(incVat.toFrac().div(onePlus(r)), ROUNDING.HALF_UP, incVat.currency);
    return build('inc', incVat.currency, exVat, r, incVat.sub(exVat), incVat, m);
  }

  /** Belopp precis som en leverantör eller ett dokument anger dem. Minst två av de tre beloppen krävs, och de måste stämma. */
  function fromStated({ exVat = null, vat = null, incVat = null, vatRate = null, currency }, m) {
    const known = [exVat, vat, incVat].filter(x => x !== null);
    if (known.length < 2 && !(known.length === 1 && (exVat !== null || incVat !== null))) throw new EconomyError('too_little', 'minst ett belopp (exkl. eller inkl. moms) krävs');
    known.forEach(x => money(x, 'beloppet'));
    const cur = currency || (known[0] && known[0].currency);
    let ex = exVat, v = vat, inc = incVat;
    if (ex !== null && v !== null && inc === null) inc = ex.add(v);
    else if (inc !== null && v !== null && ex === null) ex = inc.sub(v);
    else if (inc !== null && ex !== null && v === null) v = inc.sub(ex);
    const a = build('stated', cur, ex, rateOk(vatRate), v, inc, m);
    const problems = validate(a);
    if (problems.length) throw new EconomyError('inconsistent_amounts', problems.join('; '), problems);
    return a;
  }

  /** Lista med fel (tom = bra). Okända värden är tillåtna. Fel är inte tillåtna. */
  function validate(a, opts) {
    const tol = (opts && opts.tolerance) || Money.of(1n, a.currency); // ett öre
    const p = [];
    for (const k of ['exVat', 'vat', 'incVat']) {
      if (a[k] !== null && !(a[k] instanceof Money)) p.push(k + ' måste vara Money eller null');
      else if (a[k] !== null && a[k].currency !== a.currency) p.push(k + ' har fel valuta');
    }
    if (a.vatRate !== null && !(Number.isSafeInteger(a.vatRate) && a.vatRate >= 0)) p.push('vatRate måste vara ett heltal i hundradels procent');
    if (!BASES.includes(a.basis)) p.push('okänt basis: ' + a.basis);
    if (p.length) return p;
    if (a.exVat && a.vat && a.incVat && !a.exVat.add(a.vat).eq(a.incVat)) p.push('exVat + vat är inte incVat');
    if (a.exVat && a.vat && a.vatRate !== null) {
      const exact = a.exVat.toFrac().mul(Rate.toFrac(a.vatRate));
      if (a.vat.toFrac().sub(exact).abs().gt(tol.toFrac())) p.push('momsbeloppet stämmer inte med satsen');
    }
    return p;
  }

  /**
   * Inköpskostnaden som kalkylen ska räkna med: exkl. AVDRAGSGILL moms.
   * Avdragsgill ingående moms är ingen kostnad. Ej avdragsgill moms är en kostnad (då räknas beloppet inkl. moms).
   * Ger { cost: Money|null, reason } där reason är null, 'amount_missing' eller 'vat_unknown'. Ett okänt värde blir aldrig 0.
   */
  function costBasis(a, opts) {
    const deductible = !opts || opts.vatDeductible !== false;
    if (!deductible) return a.incVat ? { cost: a.incVat, reason: null } : (a.exVat && a.vatRate !== null ? { cost: fromEx(a.exVat, a.vatRate).incVat, reason: null } : { cost: null, reason: a.exVat || a.incVat ? 'vat_unknown' : 'amount_missing' });
    if (a.exVat) return { cost: a.exVat, reason: null };
    if (a.incVat && a.vatRate !== null) return { cost: fromInc(a.incVat, a.vatRate).exVat, reason: null };
    return { cost: null, reason: a.incVat ? 'vat_unknown' : 'amount_missing' };
  }

  function toJSON(a) {
    return { exVat: a.exVat && a.exVat.toJSON(), vatRate: a.vatRate, vat: a.vat && a.vat.toJSON(), incVat: a.incVat && a.incVat.toJSON(), basis: a.basis, currency: a.currency, source: a.source, verifiedAt: a.verifiedAt, ruleSetRef: a.ruleSetRef };
  }
  function fromJSON(o) {
    const mm = x => (x === null || x === undefined ? null : Money.fromJSON(x));
    const a = build(o.basis, o.currency, mm(o.exVat), o.vatRate === undefined ? null : o.vatRate, mm(o.vat), mm(o.incVat), o);
    const problems = validate(a);
    if (problems.length) throw new EconomyError('inconsistent_amounts', problems.join('; '), problems);
    return a;
  }

  return { BASES, fromEx, fromInc, fromStated, validate, costBasis, toJSON, fromJSON };
});
