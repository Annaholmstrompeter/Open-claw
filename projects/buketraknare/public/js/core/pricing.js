/* Buketträknaren: exakt prismotor (PricingEngine).
 *
 * En ren funktion: indata och regeluppsättningar in, belopp med full uppdelning ut. Ingen AI, inga flyttal, inget läsande av
 * webbläsarens tillstånd. Den gamla räknemotorn calc() i index.html ligger kvar orörd som REFERENSMOTOR. Den här motorn jämförs mot
 * den i tester där samma affärsregel faktiskt jämförs, och avvikelser dokumenteras i docs/EKONOMIREGLER.md. Är calc() fel
 * någonstans ska den här motorn inte upprepa felet.
 *
 * Framåt (COST → CUSTOMER PRICE), för ett arrangemang:
 *   inköpskostnad exkl. avdragsgill moms        (costLines, hela förpackningar räknas av den som anropar)
 *   + påslag (markup) på de rader som har markup  (påslag är inte marginal: 100 kr + 120 % = 220 kr)
 *   + arbete (fast avgift eller minuter × timpris, ej med påslag)
 *   + andra avgifter (ej med påslag)
 *   = försäljningspris exkl. moms
 *   + utgående moms per komponent (sats ur TaxRuleSet för kategori och datum)
 *   = pris inkl. moms före avrundning
 *   → avrundat till floristens steg = KUNDPRIS inkl. moms  (det kunden ska betala, och sanningen)
 * Exkl. moms och moms per sats härleds ur det avrundade kundpriset så att de summerar exakt.
 *
 * Bakåt (TARGET CUSTOMER PRICE → AVAILABLE MATERIAL BUDGET): budgetForTarget räknar hur stor råvarubudget som finns kvar efter
 * moms, arbete, avgifter och påslag. Samma ekvationer, andra hållet.
 *
 * Prisstatus: ESTIMATED (≈, minst en underliggande prissättning är inte livekontrollerad) eller CONFIRMED (✓).
 * PriceBreakdown bär vilken typ av pris som användes per rad: LIVE, RECENT, STALE, HISTORICAL_ESTIMATE eller MANUAL.
 * Kundtyp (PRIVATE/BUSINESS) ändrar bara hur huvudpriset presenteras (headline), aldrig beräkningen.
 *
 * Okänt är okänt: saknas ett inköpspris eller en momssats ger motorn status INCOMPLETE och inget pris. Aldrig 0 kr och aldrig en gissad sats.
 */
(function (root, factory) {
  var d = (typeof module === 'object' && module.exports) ? { M: require('./money.js'), T: require('./tax.js'), A: require('./amounts.js') } : { M: root.BRMoney, T: root.BRTax, A: root.BRAmounts };
  var api = factory(d.M, d.T, d.A);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.BRPricing = api;
})(typeof self !== 'undefined' ? self : this, function (M, T, A) {
  'use strict';
  const { Money, Frac, Rate, ROUNDING, EconomyError, roundToStep } = M;

  const PRICE_SOURCE_KINDS = Object.freeze(['LIVE', 'RECENT', 'STALE', 'HISTORICAL_ESTIMATE', 'MANUAL']);
  const PRICE_STATUS = Object.freeze({ CONFIRMED: 'CONFIRMED', ESTIMATED: 'ESTIMATED', INCOMPLETE: 'INCOMPLETE' });
  /** Tecken för gränssnittet senare: ≈ uppskattat, ✓ bekräftat. Själva visningen byggs inte nu. */
  const STATUS_MARK = Object.freeze({ ESTIMATED: '≈', CONFIRMED: '✓' });
  const CUSTOMER_KINDS = Object.freeze(['PRIVATE', 'BUSINESS']);
  const COST_KINDS = Object.freeze(['flowers', 'accessories', 'packaging', 'freight', 'other']);
  /** LIVE (livekontrollerat) och MANUAL (floristens eget beslut) gör priset bekräftat. Allt annat är en uppskattning. */
  const CONFIRMING = Object.freeze(['LIVE', 'MANUAL']);
  const WEAKNESS = Object.freeze({ LIVE: 0, MANUAL: 1, RECENT: 2, STALE: 3, HISTORICAL_ESTIMATE: 4 });

  const ZERO = Frac.of(0n);
  const ONE = Frac.of(1n);
  const onePlus = bp => ONE.add(Rate.toFrac(bp));
  const problem = (code, extra) => Object.assign({ code }, extra || {});

  /** Money eller Frac (i ören) till Frac. Money måste ha rätt valuta. */
  function amt(x, currency, what) {
    if (x instanceof Money) { if (x.currency !== currency) throw new EconomyError('currency_mismatch', what + ' har valutan ' + x.currency + ', väntade ' + currency); return x.toFrac(); }
    if (x instanceof Frac) return x;
    throw new EconomyError('not_money', what + ' måste vara Money eller Frac');
  }
  function nonNeg(f, what) { if (f.isNegative()) throw new EconomyError('negative_amount', what + ' får inte vara negativt'); return f; }
  function frac(x, what) { try { return Frac.from(x); } catch (e) { throw new EconomyError('bad_number', what + ' måste vara ett tal'); } }

  // ---------- påslag och marginal ----------
  /** Marginal ur påslag: m = p ÷ (1 + p). 120 % påslag → 54,5 % marginal. Exakt bråk. */
  function marginFromMarkup(markupBp) { const p = Rate.toFrac(Rate.check(markupBp, 'påslaget')); return p.div(ONE.add(p)); }
  /** Påslag ur marginal: p = m ÷ (1 − m). Marginalen måste vara under 100 %. Exakt bråk. */
  function markupFromMargin(marginBp) {
    const m = Rate.toFrac(Rate.check(marginBp, 'marginalen'));
    if (m.gte(ONE)) throw new EconomyError('bad_margin', 'marginalen måste vara under 100 %');
    return m.div(ONE.sub(m));
  }
  /** Som ovan men som förslag på påslag i hundradels procent (avrundat), för en räknehjälp. Påslaget är det som lagras, aldrig marginalen. */
  function suggestMarkupBpFromMarginBp(marginBp) { return M.toSafeInt(M.roundInt(markupFromMargin(marginBp).mul(10000n), ROUNDING.HALF_UP)); }

  // ---------- arbetskostnad ----------
  /** Ett arbete som exakt belopp i ören. fixed: fast avgift. timed: minuter × timpris ÷ 60. none: inget arbete. */
  function laborExact(labor, currency) {
    if (!labor || labor.mode === 'none') return { mode: 'none', amount: ZERO };
    if (labor.mode === 'fixed') return { mode: 'fixed', amount: nonNeg(amt(labor.fee, currency, 'arbetsavgiften'), 'arbetsavgiften') };
    if (labor.mode === 'timed') {
      const minutes = nonNeg(frac(labor.minutes, 'minuterna'), 'minuterna');
      const rate = nonNeg(amt(labor.hourlyRate, currency, 'timpriset'), 'timpriset');
      return { mode: 'timed', amount: minutes.mul(rate).div(60n), minutes, hourlyRate: rate };
    }
    throw new EconomyError('bad_labor', 'okänt arbetsläge: ' + String(labor.mode));
  }

  /**
   * Väljer arbetet för ett arrangemang: överstyrning > tid (uppskattade minuter × timpris) > standardavgift > inget.
   * defaults: { defaultLaborFee?, hourlyLaborRate? }   arrangement: { laborOverride?, estimatedMinutes? }
   * MVP räcker standardavgiften med överstyrning. Tidsbaserat finns i modellen så att det går att ta i bruk senare.
   */
  function resolveLabor(defaults, arrangement) {
    const d = defaults || {}, a = arrangement || {};
    if (a.laborOverride) return a.laborOverride;
    if (a.estimatedMinutes !== undefined && a.estimatedMinutes !== null && d.hourlyLaborRate) return { mode: 'timed', minutes: a.estimatedMinutes, hourlyRate: d.hourlyLaborRate };
    if (d.defaultLaborFee) return { mode: 'fixed', fee: d.defaultLaborFee };
    return { mode: 'none' };
  }

  // ---------- prisstatus ----------
  /** Är priset uppskattat eller bekräftat? Bekräftat kräver att varje inköpsrad är LIVE eller MANUAL. */
  function classifyPriceStatus(costLines) {
    const reasons = []; let weakest = null, incomplete = false, estimated = false;
    for (const l of costLines || []) {
      if (l.cost === null || l.cost === undefined) { incomplete = true; reasons.push(problem('cost_missing', { id: l.id })); continue; }
      const kind = l.source && l.source.kind;
      if (!PRICE_SOURCE_KINDS.includes(kind)) { estimated = true; reasons.push(problem('source_unknown', { id: l.id })); weakest = 'UNKNOWN'; continue; }
      if (!CONFIRMING.includes(kind)) { estimated = true; reasons.push(problem('not_live', { id: l.id, kind })); }
      if (weakest !== 'UNKNOWN' && (weakest === null || WEAKNESS[kind] > WEAKNESS[weakest])) weakest = kind;
    }
    return { status: incomplete ? PRICE_STATUS.INCOMPLETE : estimated ? PRICE_STATUS.ESTIMATED : PRICE_STATUS.CONFIRMED, weakest, reasons };
  }

  // ---------- gemensamt: skatter och komponenter ----------
  function checkCommon(input) {
    const cur = input.currency || 'SEK';
    if (!input.taxDate) throw new EconomyError('no_tax_date', 'taxDate (datum som styr momssatsen) saknas');
    Rate.check(input.markupBp === undefined ? 0 : input.markupBp, 'påslaget');
    const kind = input.customerKind || 'PRIVATE';
    if (!CUSTOMER_KINDS.includes(kind)) throw new EconomyError('bad_customer_kind', 'okänd kundtyp: ' + kind);
    const rounding = input.rounding || {};
    const step = rounding.step === undefined ? Money.of(1n, cur) : rounding.step;
    if (!(step instanceof Money) || step.currency !== cur || !step.toFrac().gt(0n)) throw new EconomyError('bad_step', 'avrundningssteget måste vara ett positivt Money-värde i ' + cur);
    const mode = rounding.mode || ROUNDING.CEIL;
    if (!Object.values(ROUNDING).includes(mode)) throw new EconomyError('unknown_rounding', 'okänt avrundningsläge: ' + mode);
    return { cur, kind, step: step.toFrac(), mode, markupBp: input.markupBp === undefined ? 0 : input.markupBp };
  }

  /** Läser inköpsraderna. Ger exakta belopp i ören och en lista över rader som saknar pris. */
  function readCostLines(lines, cur) {
    const out = [], missing = [];
    (lines || []).forEach((l, i) => {
      const id = l.id === undefined ? 'rad' + (i + 1) : l.id;
      if (l.cost === null || l.cost === undefined) { missing.push(id); out.push({ id, kind: l.kind || 'other', cost: null, markup: l.markup !== false, source: l.source || null }); return; }
      if (l.kind !== undefined && !COST_KINDS.includes(l.kind)) throw new EconomyError('bad_cost_kind', 'okänd typ av inköpsrad: ' + l.kind);
      out.push({ id, kind: l.kind || 'other', cost: nonNeg(amt(l.cost, cur, 'inköpskostnaden ' + id), 'inköpskostnaden ' + id), markup: l.markup !== false, source: l.source || null });
    });
    return { lines: out, missing };
  }

  function resolveAll(input, wanted) {
    const resolved = {}, unknown = [];
    for (const cat of wanted) {
      if (resolved[cat] || unknown.some(u => u.category === cat)) continue;
      const r = T.resolveRate(input.ruleSets || [], cat, input.taxDate);
      if (r.ok) resolved[cat] = r; else unknown.push(problem('tax_unknown', { category: cat, reason: r.reason }));
    }
    return { resolved, unknown };
  }

  function groupByRate(components) {
    const map = new Map();
    for (const c of components) { const g = map.get(c.rateBp) || { rateBp: c.rateBp, ex: ZERO }; g.ex = g.ex.add(c.ex); map.set(c.rateBp, g); }
    return [...map.values()].sort((a, b) => a.rateBp - b.rateBp).map(g => ({ rateBp: g.rateBp, ex: g.ex, inc: g.ex.mul(onePlus(g.rateBp)) }));
  }

  /** Delar ett heltal P över bråkdelar som summerar till P, så att varje del blir ett helt öre och summan stämmer (största resten först). */
  function allocateWhole(shares, P) {
    const floors = shares.map(f => f.floor());
    let remaining = P - floors.reduce((a, b) => a + b, 0n);
    const order = shares.map((f, i) => ({ i, rem: f.sub(Frac.of(floors[i])) })).sort((a, b) => { const c = b.rem.cmp(a.rem); return c !== 0 ? c : a.i - b.i; });
    const out = floors.slice();
    for (let k = 0; k < order.length && remaining > 0n; k++) { out[order[k].i] += 1n; remaining -= 1n; }
    return out;
  }

  const refsOf = list => [...new Set(list.map(r => r.ruleSetRef))];

  // ---------- COST → CUSTOMER PRICE ----------
  /**
   * Prissätter ett arrangemang. Se filhuvudet. Indata:
   *   currency, taxDate ('ÅÅÅÅ-MM-DD', datumet som styr momssatsen), ruleSets[]
   *   costLines[]   { id, kind, cost: Money|Frac|null (exkl. avdragsgill moms), markup: true|false, source: { kind: LIVE|RECENT|STALE|HISTORICAL_ESTIMATE|MANUAL, asOf, ref } }
   *   markupBp      påslag i hundradels procent på rader med markup (12000 = 120 %)
   *   labor         { mode:'fixed', fee } | { mode:'timed', minutes, hourlyRate } | { mode:'none' }
   *   fees[]        { id, kind, amount (exkl. moms), taxCategory }, tas inte med påslag
   *   goodsTaxCategory ('arrangement_goods'), laborTaxCategory ('labor')
   *   rounding      { step: Money (till exempel 5 kr), mode: 'CEIL' | 'FLOOR' | 'HALF_UP' }
   *   customerKind  'PRIVATE' | 'BUSINESS'
   * Ger status 'OK', 'EMPTY' eller 'INCOMPLETE'. INCOMPLETE har inget pris och listar orsakerna.
   */
  function priceArrangement(input) {
    const c = checkCommon(input);
    const { lines, missing } = readCostLines(input.costLines, c.cur);
    const goodsCat = input.goodsTaxCategory || 'arrangement_goods', laborCat = input.laborTaxCategory || 'labor';
    const labor = laborExact(input.labor, c.cur);
    const fees = (input.fees || []).map((f, i) => ({ id: f.id === undefined ? 'avgift' + (i + 1) : f.id, kind: f.kind || 'other', category: f.taxCategory || 'other', ex: nonNeg(amt(f.amount, c.cur, 'avgiften'), 'avgiften') }));
    const statusInfo = classifyPriceStatus(lines);

    const reasons = missing.map(id => problem('cost_missing', { id }));
    const wanted = [goodsCat, laborCat, ...fees.map(f => f.category)];
    const { resolved, unknown } = resolveAll(input, wanted);
    reasons.push(...unknown);
    if (reasons.length) return { status: 'INCOMPLETE', priceStatus: PRICE_STATUS.INCOMPLETE, currency: c.cur, customerKind: c.kind, reasons, customerPrice: null };

    const hasContent = lines.length > 0 || !labor.amount.isZero() || fees.some(f => !f.ex.isZero());
    // inköp, påslag, arbete, avgifter
    let markupBase = ZERO, noMarkup = ZERO;
    for (const l of lines) { if (l.markup) markupBase = markupBase.add(l.cost); else noMarkup = noMarkup.add(l.cost); }
    const markupAmount = markupBase.mul(Rate.toFrac(c.markupBp));
    const goodsEx = markupBase.add(markupAmount).add(noMarkup);
    const components = [
      { key: 'goods', category: goodsCat, rateBp: resolved[goodsCat].rateBp, ex: goodsEx },
      { key: 'labor', category: laborCat, rateBp: resolved[laborCat].rateBp, ex: labor.amount },
      ...fees.map(f => ({ key: 'fee:' + f.id, category: f.category, rateBp: resolved[f.category].rateBp, ex: f.ex }))
    ];
    const groups = groupByRate(components);
    const incExact = Frac.sum(groups.map(g => g.inc));
    const P = roundToStep(incExact, c.step, c.mode);            // kundpriset inkl. moms i ören, exakt ett helt antal steg
    const shares = groups.map(g => (incExact.isZero() ? ZERO : g.inc.mul(P).div(incExact)));
    const incInt = allocateWhole(shares, P.n);
    const byRate = groups.map((g, i) => {
      const inc = Money.of(incInt[i], c.cur);
      const a = A.fromInc(inc, g.rateBp);
      return { rateBp: g.rateBp, exVat: a.exVat, vat: a.vat, incVat: a.incVat };
    });
    const sumM = k => byRate.reduce((s, r) => s.add(r[k]), Money.zero(c.cur));
    const customerPrice = sumM('incVat'), saleExVat = sumM('exVat'), vat = sumM('vat');
    const saleExVatExact = Frac.sum(shares.map((s, i) => s.div(onePlus(groups[i].rateBp))));
    const costTotal = Frac.sum(lines.map(l => l.cost));
    const margin = saleExVatExact.gt(0n) ? saleExVatExact.sub(costTotal).div(saleExVatExact) : null;

    const resolvedList = Object.values(resolved);
    const status = hasContent ? 'OK' : 'EMPTY';
    const priceStatus = hasContent ? statusInfo.status : null;
    return {
      status, currency: c.cur, customerKind: c.kind,
      priceStatus, statusMark: priceStatus ? STATUS_MARK[priceStatus] : null,
      customerPrice, saleExVat, vat, vatByRate: byRate,
      rounding: P.sub(incExact),
      margin,
      headline: c.kind === 'BUSINESS' ? { kind: 'EX_VAT_PLUS_VAT', exVat: saleExVat, vat, incVat: customerPrice } : { kind: 'INC_VAT', amount: customerPrice },
      breakdown: {
        costLines: lines.map(l => ({ id: l.id, kind: l.kind, cost: l.cost, markup: l.markup, source: l.source })),
        priceSources: { weakest: statusInfo.weakest, counts: PRICE_SOURCE_KINDS.reduce((o, k) => { o[k] = lines.filter(l => l.source && l.source.kind === k).length; return o; }, {}), reasons: statusInfo.reasons },
        materials: { markupBase, noMarkup, total: costTotal },
        markup: { bp: c.markupBp, amount: markupAmount },
        labor: { mode: labor.mode, amount: labor.amount, minutes: labor.minutes || null, hourlyRate: labor.hourlyRate || null },
        fees: fees.map(f => ({ id: f.id, kind: f.kind, category: f.category, exVat: f.ex })),
        goodsExVat: goodsEx,
        components: components.map(x => ({ key: x.key, category: x.category, rateBp: x.rateBp, exVat: x.ex })),
        rule: { refs: refsOf(resolvedList), allVerified: resolvedList.every(r => r.verification === 'verified'), verification: Object.fromEntries(resolvedList.map(r => [r.category, { ruleSetRef: r.ruleSetRef, verification: r.verification, sourceKind: r.sourceKind }])) },
        taxDate: input.taxDate
      },
      exact: { incVatBeforeRounding: incExact, saleExVatBeforeRounding: Frac.sum(groups.map(g => g.ex)), vatBeforeRounding: incExact.sub(Frac.sum(groups.map(g => g.ex))), saleExVatExact, costTotal }
    };
  }

  // ---------- TARGET CUSTOMER PRICE → AVAILABLE MATERIAL BUDGET ----------
  /**
   * Hur stor råvarubudget (exkl. moms) finns kvar när kunden vill betala `target` inkl. moms?
   * Indata som priceArrangement, men costLines är de FASTA inköpsraderna (sådant som redan är bestämt), och:
   *   target            Money, kundens slutpris inkl. moms
   *   budget.markup     true (standard) om råvarubudgeten får påslag
   * Bara avrundningsläget CEIL stöds. Det slutpris som kan nås är det största stegvisa pris som är högst `target`.
   * Ger { status: 'OK' | 'NEGATIVE' | 'INCOMPLETE', materialBudget (Frac), materialBudgetMoney (Money, avrundad nedåt), effectiveTarget, shortfall }.
   */
  function budgetForTarget(input) {
    const c = checkCommon(input);
    if (c.mode !== ROUNDING.CEIL) throw new EconomyError('unsupported_rounding', 'budgetForTarget stöder bara avrundning uppåt (CEIL)');
    if (!(input.target instanceof Money) || input.target.currency !== c.cur) throw new EconomyError('bad_target', 'target måste vara ett Money-värde i ' + c.cur);
    const { lines, missing } = readCostLines(input.costLines, c.cur);
    const goodsCat = input.goodsTaxCategory || 'arrangement_goods', laborCat = input.laborTaxCategory || 'labor';
    const labor = laborExact(input.labor, c.cur);
    const fees = (input.fees || []).map((f, i) => ({ id: f.id === undefined ? 'avgift' + (i + 1) : f.id, category: f.taxCategory || 'other', ex: nonNeg(amt(f.amount, c.cur, 'avgiften'), 'avgiften') }));
    const reasons = missing.map(id => problem('cost_missing', { id }));
    const { resolved, unknown } = resolveAll(input, [goodsCat, laborCat, ...fees.map(f => f.category)]);
    reasons.push(...unknown);
    if (reasons.length) return { status: 'INCOMPLETE', reasons, currency: c.cur };

    const effectiveTarget = roundToStep(input.target.toFrac(), c.step, ROUNDING.FLOOR);   // största stegvisa pris som är högst målet
    let fixedMarked = ZERO, fixedPlain = ZERO;
    for (const l of lines) { if (l.markup) fixedMarked = fixedMarked.add(l.cost); else fixedPlain = fixedPlain.add(l.cost); }
    const laborInc = labor.amount.mul(onePlus(resolved[laborCat].rateBp));
    const feesInc = Frac.sum(fees.map(f => f.ex.mul(onePlus(resolved[f.category].rateBp))));
    const goodsExAllowed = effectiveTarget.sub(laborInc).sub(feesInc).div(onePlus(resolved[goodsCat].rateBp));
    const m = Rate.toFrac(c.markupBp);
    const budgetMarkup = !input.budget || input.budget.markup !== false;
    const material = budgetMarkup
      ? goodsExAllowed.sub(fixedPlain).div(ONE.add(m)).sub(fixedMarked)
      : goodsExAllowed.sub(fixedPlain).sub(fixedMarked.mul(ONE.add(m)));
    const breakdown = { effectiveTarget, laborIncVat: laborInc, feesIncVat: feesInc, goodsExVatAllowed: goodsExAllowed, fixedMarked, fixedPlain, markup: { bp: c.markupBp, appliesToBudget: budgetMarkup } };
    if (material.isNegative()) return { status: 'NEGATIVE', currency: c.cur, effectiveTarget: Money.fromFrac(effectiveTarget, ROUNDING.FLOOR, c.cur), shortfall: material.neg(), materialBudget: material, materialBudgetMoney: null, breakdown };
    return { status: 'OK', currency: c.cur, effectiveTarget: Money.fromFrac(effectiveTarget, ROUNDING.FLOOR, c.cur), materialBudget: material, materialBudgetMoney: Money.fromFrac(material, ROUNDING.FLOOR, c.cur), shortfall: null, breakdown };
  }

  // ---------- ett jobb: flera arrangemang och jobbavgifter ----------
  /**
   * Summerar ett jobb. lines: [{ id, qty, arrangement: <indata till priceArrangement> }] och fees: [{ id, basis: 'ex'|'inc', amount, taxCategory }].
   * Varje arrangemang avrundas för sig (som i dag), och antal multipliceras på de redan avrundade beloppen.
   * Momsen per sats är summan av raderna ('line'). Avrundning per sats ('rate_summary') är inte byggd och avvisas uttryckligen.
   * Gemensamma fält (currency, taxDate, ruleSets, rounding, customerKind) ärvs av raderna om de inte anger egna.
   */
  function priceJob(job) {
    const cur = job.currency || 'SEK', kind = job.customerKind || 'PRIVATE';
    if (!CUSTOMER_KINDS.includes(kind)) throw new EconomyError('bad_customer_kind', 'okänd kundtyp: ' + kind);
    const sel = T.selectRuleSet(job.ruleSets || [], job.taxDate);
    if (sel.ok && sel.ruleSet.roundingLevel !== 'line') throw new EconomyError('unsupported_rounding_level', 'momsavrundning per sats (rate_summary) är inte byggd ännu');
    const common = { currency: cur, taxDate: job.taxDate, ruleSets: job.ruleSets, rounding: job.rounding, customerKind: kind };
    const results = [], reasons = [];
    for (const l of job.lines || []) {
      if (!Number.isSafeInteger(l.qty) || l.qty < 1) throw new EconomyError('bad_qty', 'antalet måste vara ett heltal från 1');
      const r = priceArrangement({ ...common, ...l.arrangement });
      results.push({ id: l.id, qty: l.qty, result: r });
      if (r.status === 'INCOMPLETE') reasons.push(problem('line_incomplete', { id: l.id, reasons: r.reasons }));
    }
    const feeAmounts = [];
    for (const [i, f] of (job.fees || []).entries()) {
      const id = f.id === undefined ? 'avgift' + (i + 1) : f.id, cat = f.taxCategory || 'other';
      const r = T.resolveRate(job.ruleSets || [], cat, job.taxDate);
      if (!r.ok) { reasons.push(problem('tax_unknown', { id, category: cat, reason: r.reason })); continue; }
      if (!(f.amount instanceof Money) || f.amount.currency !== cur) throw new EconomyError('bad_fee', 'avgiften måste vara Money i ' + cur);
      feeAmounts.push({ id, category: cat, basis: f.basis === 'inc' ? 'inc' : 'ex', amounts: f.basis === 'inc' ? A.fromInc(f.amount, r.rateBp) : A.fromEx(f.amount, r.rateBp), ruleSetRef: r.ruleSetRef, verification: r.verification });
    }
    if (reasons.length) return { status: 'INCOMPLETE', priceStatus: PRICE_STATUS.INCOMPLETE, currency: cur, reasons };

    const byRate = new Map();
    const add = (rateBp, ex, vat, inc) => { const g = byRate.get(rateBp) || { rateBp, exVat: Money.zero(cur), vat: Money.zero(cur), incVat: Money.zero(cur) }; g.exVat = g.exVat.add(ex); g.vat = g.vat.add(vat); g.incVat = g.incVat.add(inc); byRate.set(rateBp, g); };
    const times = (m, n) => Money.of(m.amount * BigInt(n), cur);
    for (const r of results) for (const g of r.result.vatByRate) add(g.rateBp, times(g.exVat, r.qty), times(g.vat, r.qty), times(g.incVat, r.qty));
    for (const f of feeAmounts) add(f.amounts.vatRate, f.amounts.exVat, f.amounts.vat, f.amounts.incVat);
    const vatByRate = [...byRate.values()].sort((a, b) => a.rateBp - b.rateBp);
    const sum = k => vatByRate.reduce((s, g) => s.add(g[k]), Money.zero(cur));
    const lineStatuses = results.filter(r => r.result.status === 'OK').map(r => r.result.priceStatus);
    const priceStatus = lineStatuses.length === 0 ? null : lineStatuses.every(s => s === PRICE_STATUS.CONFIRMED) ? PRICE_STATUS.CONFIRMED : PRICE_STATUS.ESTIMATED;
    const refs = [...new Set([...results.flatMap(r => r.result.status === 'OK' ? r.result.breakdown.rule.refs : []), ...feeAmounts.map(f => f.ruleSetRef)])];
    const allVerified = results.every(r => r.result.status !== 'OK' || r.result.breakdown.rule.allVerified) && feeAmounts.every(f => f.verification === 'verified');
    const totalExVat = sum('exVat'), totalVat = sum('vat'), totalIncVat = sum('incVat');
    return {
      status: 'OK', currency: cur, customerKind: kind, priceStatus, statusMark: priceStatus ? STATUS_MARK[priceStatus] : null,
      lines: results.map(r => ({ id: r.id, qty: r.qty, result: r.result, lineIncVat: r.result.customerPrice ? times(r.result.customerPrice, r.qty) : Money.zero(cur) })),
      fees: feeAmounts.map(f => ({ id: f.id, category: f.category, amounts: f.amounts })),
      vatByRate, totalExVat, totalVat, totalIncVat,
      headline: kind === 'BUSINESS' ? { kind: 'EX_VAT_PLUS_VAT', exVat: totalExVat, vat: totalVat, incVat: totalIncVat } : { kind: 'INC_VAT', amount: totalIncVat },
      rule: { refs, allVerified, roundingLevel: 'line' }
    };
  }

  return {
    PRICE_SOURCE_KINDS, PRICE_STATUS, STATUS_MARK, CUSTOMER_KINDS, COST_KINDS,
    marginFromMarkup, markupFromMargin, suggestMarkupBpFromMarginBp,
    resolveLabor, laborExact, classifyPriceStatus,
    priceArrangement, budgetForTarget, priceJob
  };
});
