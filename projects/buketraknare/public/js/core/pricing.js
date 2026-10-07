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
  /** Hur en rad prissätts: butikens vanliga påslag på kalkylkostnaden, eller ett fast pris till kunden (egna tillägg). */
  const PRICING_MODES = Object.freeze(['STANDARD_MARKUP', 'FIXED_SALE_PRICE', 'INCLUDED']);
  /** Ett fast pris anges med eller utan moms. Internt lagras 'inc' och 'ex'. INC_VAT och EX_VAT godtas som synonymer vid inmatning. */
  const PRICE_BASIS = Object.freeze({ INC_VAT: 'inc', EX_VAT: 'ex' });
  /** Skillnaden mellan ett pris som SAKNAS (ofullständig kalkyl) och ett som uttryckligen INGÅR (ett giltigt kundpris på 0 kr). */
  const PRICE_STATE = Object.freeze({ MISSING: 'PRICE_MISSING', INCLUDED: 'EXPLICITLY_INCLUDED', MARKUP: 'MARKUP', FIXED: 'FIXED_PRICE' });
  function normalizeBasis(b) { return b === 'inc' || b === 'INC_VAT' ? 'inc' : b === 'ex' || b === 'EX_VAT' ? 'ex' : undefined; }
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
      const mode = l.mode || l.pricing;
      if (mode === 'FIXED_SALE_PRICE' || mode === 'INCLUDED') {
        // Kundpriset är floristens eget beslut (ett fast pris eller "ingår") och beror inte på inköpspriset, så inköpets färskhet påverkar inte statusen.
        if (mode === 'FIXED_SALE_PRICE' && !l.sale && !l.salePrice) { incomplete = true; reasons.push(problem('sale_price_missing', { id: l.id })); }
        continue;
      }
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

  /**
   * Läser raderna. En rad prissätts på ett av två sätt (pricing):
   *   STANDARD_MARKUP (standard)  kalkylkostnaden (cost) får butikens påslag. Saknad kostnad = rad utan pris.
   *   FIXED_SALE_PRICE            floristen anger kundens pris direkt: salePrice { amount, basis: 'inc' | 'ex' } (INC_VAT och EX_VAT godtas). Kalkylkostnaden är
   *                               valfri (för marginalen). Noll inköpskostnad betyder aldrig noll värde: priset kommer av salePrice, aldrig av cost.
   *   INCLUDED                    uttryckligt val: "ingår utan extra kostnad". Ett giltigt kundpris på 0 kr. Kalkylkostnaden är valfri (för marginalen).
   * Ett pris som SAKNAS (ingen kostnad för ett standardpris, inget belopp för ett fast pris) är något annat än INCLUDED: det ger en ofullständig kalkyl.
   * externalCost (valfri) är vad det kostar att skaffa utifrån idag, origin (valfri) var materialet kommer ifrån. De påverkar aldrig priset och finns för analys.
   * Varje rad kan ha en egen taxCategory, annars gäller arrangemangets standard för varor. Ger exakta belopp i ören.
   */
  function readCostLines(lines, cur) {
    const out = [], missing = [];
    (lines || []).forEach((l, i) => {
      const id = l.id === undefined ? 'rad' + (i + 1) : l.id;
      const mode = l.pricing === undefined ? 'STANDARD_MARKUP' : l.pricing;
      if (!PRICING_MODES.includes(mode)) throw new EconomyError('bad_pricing_mode', 'okänt prissättningssätt: ' + String(l.pricing));
      if (l.kind !== undefined && !COST_KINDS.includes(l.kind)) throw new EconomyError('bad_cost_kind', 'okänd typ av inköpsrad: ' + l.kind);
      const known = l.cost !== null && l.cost !== undefined;
      const cost = known ? nonNeg(amt(l.cost, cur, 'inköpskostnaden ' + id), 'inköpskostnaden ' + id) : null;
      const externalCost = l.externalCost === null || l.externalCost === undefined ? null : nonNeg(amt(l.externalCost, cur, 'den externa kostnaden ' + id), 'den externa kostnaden ' + id);
      let sale = null;
      if (mode === 'FIXED_SALE_PRICE') {
        const sp = l.salePrice;
        if (!sp || sp.amount === null || sp.amount === undefined) missing.push({ id, code: 'sale_price_missing' });
        else {
          const basis = normalizeBasis(sp.basis !== undefined ? sp.basis : sp.priceBasis);
          if (basis === undefined) throw new EconomyError('bad_sale_basis', 'salePrice.basis måste vara inc eller ex (INC_VAT eller EX_VAT, med eller utan moms)');
          sale = { amount: nonNeg(amt(sp.amount, cur, 'försäljningspriset ' + id), 'försäljningspriset ' + id), basis };
        }
      } else if (mode === 'STANDARD_MARKUP' && !known) missing.push({ id, code: 'cost_missing' });
      out.push({ id, kind: l.kind || 'other', cost, externalCost, origin: l.origin === undefined ? null : l.origin, markup: l.markup !== false, source: l.source || null, mode, sale, taxCategory: l.taxCategory || null });
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

  /**
   * Underlag för att senare kunna visa lönsamhet per jobb (till exempel: kundpris, material/kalkylkostnad, arbete, övrigt).
   * Det är bara DATA. Inget täckningsbidrag, ingen vinst och ingen marginalprocent definieras här, eftersom de måste definieras
   * korrekt först (vad som räknas som kostnad, om arbetet är en kostnad eller en intäkt, om egenodlat värderas, om moms ingår).
   * Alla belopp är exkl. moms om inget annat står. Frac i ören är exakta. Okända kostnader redovisas som okända, aldrig som noll.
   */
  function profitabilityInputs(x) {
    const byKind = Object.fromEntries(COST_KINDS.map(k => [k, ZERO]));
    const byOrigin = {};
    const missingCalc = [], missingExt = [];
    let ext = ZERO;
    for (const l of x.lines) {
      if (l.cost === null) missingCalc.push(l.id);
      else { byKind[l.kind] = byKind[l.kind].add(l.cost); const o = l.origin === null ? 'UNKNOWN' : l.origin; byOrigin[o] = (byOrigin[o] || ZERO).add(l.cost); }
      if (l.externalCost === null) missingExt.push(l.id); else ext = ext.add(l.externalCost);
    }
    return {
      status: 'DATA_ONLY',
      note: 'Underlag. Inget täckningsbidrag, ingen vinst och ingen marginalprocent är definierad än.',
      customerPrice: { presentedIncVat: x.customerPrice, presentedExVat: x.saleExVat, presentedVat: x.vat, calculatedExVat: x.exExact, calculatedIncVat: x.incExact },
      charged: { goodsExVat: x.goodsEx, fixedPriceExVat: Frac.sum(x.fixedComponents.map(c => c.ex)), laborExVat: x.labor.amount, feesExVat: Frac.sum(x.fees.map(f => f.ex)), includedLines: x.lines.filter(l => l.mode === 'INCLUDED').length },
      calculationCost: { byKind, byOrigin, total: x.costTotal, complete: missingCalc.length === 0, missingLineIds: missingCalc },
      externalCost: { total: ext, complete: missingExt.length === 0, missingLineIds: missingExt }
    };
  }

  // ---------- COST → CUSTOMER PRICE ----------
  /**
   * Prissätter ett arrangemang. Se filhuvudet. Indata:
   *   currency, taxDate ('ÅÅÅÅ-MM-DD', datumet som styr momssatsen), ruleSets[]
   *   costLines[]   { id, kind, pricing, cost, markup, salePrice, taxCategory, source }
   *       pricing   'STANDARD_MARKUP' (standard): cost (exkl. avdragsgill moms, Money|Frac) får påslag om markup inte är false
   *                 'FIXED_SALE_PRICE': salePrice { amount, basis: 'inc'|'ex' } är kundens pris direkt. cost är valfri och används bara för marginalen
   *       taxCategory  radens momskategori. Utan den gäller goodsTaxCategory. Satsen slås alltid upp, den gissas aldrig
   *       source    { kind: LIVE|RECENT|STALE|HISTORICAL_ESTIMATE|MANUAL, asOf, ref }
   *   markupBp      påslag i hundradels procent på rader med markup (12000 = 120 %)
   *   labor         { mode:'fixed', fee } | { mode:'timed', minutes, hourlyRate } | { mode:'none' }
   *   fees[]        { id, kind, amount (exkl. moms), taxCategory }, tas inte med påslag
   *   goodsTaxCategory ('arrangement_goods'), laborTaxCategory ('labor')
   *   rounding      { step: Money (till exempel 5 kr), mode: 'CEIL' | 'FLOOR' | 'HALF_UP' }
   *   customerKind  'PRIVATE' | 'BUSINESS'
   * Ger status 'OK', 'EMPTY' eller 'INCOMPLETE'. INCOMPLETE har inget pris och listar orsakerna.
   *
   * BERÄKNAT och PRESENTERAT pris är två skilda saker och båda behålls:
   *   calculated  det exakta beloppet före avrundning (Frac i ören, exkl. moms, moms, inkl. moms, per sats). Ändras aldrig av avrundningsregeln
   *   presented   det avrundade kundpriset (Money) som floristen säger till kunden, med exkl. moms och moms härledda ur det
   * customerPrice, saleExVat, vat och vatByRate är det presenterade priset (kvar under sina gamla namn). Vilket belopp som blir den
   * överenskomna försäljningen avgörs av kundordern, inte av motorn (MASTER-PLAN 8.6).
   */
  function priceArrangement(input) {
    const c = checkCommon(input);
    const { lines, missing } = readCostLines(input.costLines, c.cur);
    const goodsCat = input.goodsTaxCategory || 'arrangement_goods', laborCat = input.laborTaxCategory || 'labor';
    const labor = laborExact(input.labor, c.cur);
    const fees = (input.fees || []).map((f, i) => ({ id: f.id === undefined ? 'avgift' + (i + 1) : f.id, kind: f.kind || 'other', category: f.taxCategory || 'other', ex: nonNeg(amt(f.amount, c.cur, 'avgiften'), 'avgiften') }));
    const statusInfo = classifyPriceStatus(lines);

    const catOf = l => l.taxCategory || goodsCat;
    const reasons = missing.map(m => problem(m.code, { id: m.id }));
    const { resolved, unknown } = resolveAll(input, [goodsCat, laborCat, ...lines.filter(l => l.mode !== 'INCLUDED').map(catOf), ...fees.map(f => f.category)]);
    reasons.push(...unknown);
    if (reasons.length) return { status: 'INCOMPLETE', priceStatus: PRICE_STATUS.INCOMPLETE, currency: c.cur, customerKind: c.kind, reasons, priceMissing: missing.map(m => m.id), customerPrice: null };

    const hasContent = lines.length > 0 || !labor.amount.isZero() || fees.some(f => !f.ex.isZero());
    // inköp med påslag (per momskategori), fasta kundpriser, arbete, avgifter
    const byCat = new Map([[goodsCat, { markupBase: ZERO, noMarkup: ZERO }]]);
    for (const l of lines) {
      if (l.mode !== 'STANDARD_MARKUP') continue;
      const g = byCat.get(catOf(l)) || { markupBase: ZERO, noMarkup: ZERO };
      if (l.markup) g.markupBase = g.markupBase.add(l.cost); else g.noMarkup = g.noMarkup.add(l.cost);
      byCat.set(catOf(l), g);
    }
    const mk = Rate.toFrac(c.markupBp);
    let markupBase = ZERO, noMarkup = ZERO, markupAmount = ZERO, goodsEx = ZERO;
    const goodsComponents = [goodsCat, ...[...byCat.keys()].filter(k => k !== goodsCat).sort()].map(cat => {
      const g = byCat.get(cat), amount = g.markupBase.mul(mk), ex = g.markupBase.add(amount).add(g.noMarkup);
      markupBase = markupBase.add(g.markupBase); noMarkup = noMarkup.add(g.noMarkup); markupAmount = markupAmount.add(amount); goodsEx = goodsEx.add(ex);
      return { key: cat === goodsCat ? 'goods' : 'goods:' + cat, category: cat, rateBp: resolved[cat].rateBp, ex };
    });
    const fixedComponents = lines.filter(l => l.mode === 'FIXED_SALE_PRICE').map(l => {
      const r = resolved[catOf(l)];
      // ett fast pris inkl. moms är exakt det beloppet inkl. moms: exkl. moms härleds ur det utan avrundning
      return { key: 'fixed:' + l.id, category: catOf(l), rateBp: r.rateBp, ex: l.sale.basis === 'inc' ? l.sale.amount.div(onePlus(r.rateBp)) : l.sale.amount };
    });
    const components = [
      ...goodsComponents,
      { key: 'labor', category: laborCat, rateBp: resolved[laborCat].rateBp, ex: labor.amount },
      ...fixedComponents,
      ...fees.map(f => ({ key: 'fee:' + f.id, category: f.category, rateBp: resolved[f.category].rateBp, ex: f.ex }))
    ];
    const groups = groupByRate(components);
    const incExact = Frac.sum(groups.map(g => g.inc));
    const exExact = Frac.sum(groups.map(g => g.ex));
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
    const known = lines.filter(l => l.cost !== null);
    const costTotal = Frac.sum(known.map(l => l.cost));
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
      // marginalen är fullständig bara när alla rader har en känd kalkylkostnad (ett fast kundpris kan sakna den)
      marginComplete: known.length === lines.length,
      headline: c.kind === 'BUSINESS' ? { kind: 'EX_VAT_PLUS_VAT', exVat: saleExVat, vat, incVat: customerPrice } : { kind: 'INC_VAT', amount: customerPrice },
      calculated: { exVat: exExact, vat: incExact.sub(exExact), incVat: incExact, byRate: groups.map(g => ({ rateBp: g.rateBp, exVat: g.ex, vat: g.inc.sub(g.ex), incVat: g.inc })) },
      presented: { incVat: customerPrice, exVat: saleExVat, vat, byRate, rounding: P.sub(incExact), roundingRule: { step: c.step, mode: c.mode } },
      breakdown: {
        costLines: lines.map(l => ({ id: l.id, kind: l.kind, pricing: l.mode, priceState: l.mode === 'INCLUDED' ? PRICE_STATE.INCLUDED : l.mode === 'FIXED_SALE_PRICE' ? PRICE_STATE.FIXED : PRICE_STATE.MARKUP,
          cost: l.cost, externalCost: l.externalCost, origin: l.origin, markup: l.markup, salePrice: l.sale, taxCategory: catOf(l), source: l.source })),
        priceSources: { weakest: statusInfo.weakest, counts: PRICE_SOURCE_KINDS.reduce((o, k) => { o[k] = lines.filter(l => l.source && l.source.kind === k).length; return o; }, {}), reasons: statusInfo.reasons },
        materials: { markupBase, noMarkup, total: costTotal },
        markup: { bp: c.markupBp, amount: markupAmount },
        labor: { mode: labor.mode, amount: labor.amount, minutes: labor.minutes || null, hourlyRate: labor.hourlyRate || null },
        fees: fees.map(f => ({ id: f.id, kind: f.kind, category: f.category, exVat: f.ex })),
        goodsExVat: goodsEx,
        fixedPrice: { exVat: Frac.sum(fixedComponents.map(x => x.ex)), lines: fixedComponents.map(x => x.key.slice(6)) },
        components: components.map(x => ({ key: x.key, category: x.category, rateBp: x.rateBp, exVat: x.ex })),
        rule: { refs: refsOf(resolvedList), allVerified: resolvedList.every(r => r.verification === 'verified'), verification: Object.fromEntries(resolvedList.map(r => [r.category, { ruleSetRef: r.ruleSetRef, verification: r.verification, sourceKind: r.sourceKind }])) },
        taxDate: input.taxDate,
        profitabilityInputs: profitabilityInputs({ lines, labor, fees, goodsEx, fixedComponents, customerPrice, saleExVat, vat, exExact, incExact, costTotal })
      },
      exact: { incVatBeforeRounding: incExact, saleExVatBeforeRounding: exExact, vatBeforeRounding: incExact.sub(exExact), saleExVatExact, costTotal }
    };
  }

  // ---------- TARGET CUSTOMER PRICE → AVAILABLE MATERIAL BUDGET ----------
  /**
   * Hur stor råvarubudget (exkl. moms) finns kvar när kunden vill betala `target` inkl. moms?
   * Indata som priceArrangement, men costLines är de FASTA raderna (sådant som redan är bestämt, inklusive egna tillägg med fast
   * kundpris), och:
   *   target            Money, kundens slutpris inkl. moms
   *   budget.markup     true (standard) om råvarubudgeten får påslag
   * Råvarubudgeten ligger i varornas standardkategori (goodsTaxCategory).
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
    const catOf = l => l.taxCategory || goodsCat;
    const reasons = missing.map(m => problem(m.code, { id: m.id }));
    const { resolved, unknown } = resolveAll(input, [goodsCat, laborCat, ...lines.filter(l => l.mode !== 'INCLUDED').map(catOf), ...fees.map(f => f.category)]);
    reasons.push(...unknown);
    if (reasons.length) return { status: 'INCOMPLETE', reasons, currency: c.cur };

    const m = Rate.toFrac(c.markupBp);
    const effectiveTarget = roundToStep(input.target.toFrac(), c.step, ROUNDING.FLOOR);   // största stegvisa pris som är högst målet
    let fixedMarked = ZERO, fixedPlain = ZERO, otherInc = ZERO;                           // bestämt inom standardkategorin, och bestämt utanför den
    for (const l of lines) {
      if (l.mode === 'INCLUDED') continue;                                               // "ingår" bidrar med 0 kr
      const r = onePlus(resolved[catOf(l)].rateBp);
      if (l.mode === 'FIXED_SALE_PRICE') { otherInc = otherInc.add(l.sale.basis === 'inc' ? l.sale.amount : l.sale.amount.mul(r)); continue; }
      if (catOf(l) === goodsCat) { if (l.markup) fixedMarked = fixedMarked.add(l.cost); else fixedPlain = fixedPlain.add(l.cost); }
      else otherInc = otherInc.add((l.markup ? l.cost.mul(ONE.add(m)) : l.cost).mul(r));
    }
    const laborInc = labor.amount.mul(onePlus(resolved[laborCat].rateBp));
    const feesInc = Frac.sum(fees.map(f => f.ex.mul(onePlus(resolved[f.category].rateBp))));
    const goodsExAllowed = effectiveTarget.sub(laborInc).sub(feesInc).sub(otherInc).div(onePlus(resolved[goodsCat].rateBp));
    const budgetMarkup = !input.budget || input.budget.markup !== false;
    const material = budgetMarkup
      ? goodsExAllowed.sub(fixedPlain).div(ONE.add(m)).sub(fixedMarked)
      : goodsExAllowed.sub(fixedPlain).sub(fixedMarked.mul(ONE.add(m)));
    const breakdown = { effectiveTarget, laborIncVat: laborInc, feesIncVat: feesInc, otherIncVat: otherInc, goodsExVatAllowed: goodsExAllowed, fixedMarked, fixedPlain, markup: { bp: c.markupBp, appliesToBudget: budgetMarkup } };
    if (material.isNegative()) return { status: 'NEGATIVE', currency: c.cur, effectiveTarget: Money.fromFrac(effectiveTarget, ROUNDING.FLOOR, c.cur), shortfall: material.neg(), materialBudget: material, materialBudgetMoney: null, breakdown };
    return { status: 'OK', currency: c.cur, effectiveTarget: Money.fromFrac(effectiveTarget, ROUNDING.FLOOR, c.cur), materialBudget: material, materialBudgetMoney: Money.fromFrac(material, ROUNDING.FLOOR, c.cur), shortfall: null, breakdown };
  }

  // ---------- överenskommet pris ----------
  /**
   * Delar ett ÖVERENSKOMMET pris (inkl. moms) på momssatser, så att exkl. moms och moms summerar exakt till det överenskomna beloppet.
   * Det överenskomna priset kan vara lägre eller högre än det presenterade (beräknat 667,75 kr, presenterat 670 kr, sålt för 650 kr).
   * Fördelningen följer det presenterade prisets fördelning per sats (presentedByRate). Är det presenterade priset 0 används fallbackRateBp
   * (satsen för varor), annars inget överenskommet belopp över 0. Den ursprungliga kalkylen ändras aldrig av detta.
   * Ger { incVat, exVat, vat, byRate[{ rateBp, exVat, vat, incVat }] } (Money).
   */
  function allocateAgreed(spec) {
    const agreed = spec.agreedIncVat;
    if (!(agreed instanceof Money)) throw new EconomyError('not_money', 'agreedIncVat måste vara Money');
    if (agreed.isNegative()) throw new EconomyError('negative_amount', 'ett överenskommet pris får inte vara negativt');
    const cur = agreed.currency;
    const groups = (spec.presentedByRate || []).filter(g => g.incVat.amount > 0n);
    let shares, rates;
    if (groups.length) {
      const total = Frac.sum(groups.map(g => g.incVat.toFrac()));
      shares = groups.map(g => agreed.toFrac().mul(g.incVat.toFrac()).div(total));
      rates = groups.map(g => g.rateBp);
    } else if (agreed.isZero()) {
      return { incVat: agreed, exVat: Money.zero(cur), vat: Money.zero(cur), byRate: [] };
    } else {
      if (spec.fallbackRateBp === undefined || spec.fallbackRateBp === null) throw new EconomyError('no_rate_for_agreed', 'det presenterade priset är 0 och ingen momssats finns för det överenskomna beloppet');
      shares = [agreed.toFrac()]; rates = [Rate.check(spec.fallbackRateBp, 'momssatsen')];
    }
    const inc = allocateWhole(shares, agreed.amount);
    const merged = new Map();
    rates.forEach((r, i) => {
      const a = A.fromInc(Money.of(inc[i], cur), r);
      const g = merged.get(r) || { rateBp: r, exVat: Money.zero(cur), vat: Money.zero(cur), incVat: Money.zero(cur) };
      g.exVat = g.exVat.add(a.exVat); g.vat = g.vat.add(a.vat); g.incVat = g.incVat.add(a.incVat); merged.set(r, g);
    });
    const byRate = [...merged.values()].sort((a, b) => a.rateBp - b.rateBp);
    const sum = k => byRate.reduce((s, g) => s.add(g[k]), Money.zero(cur));
    return { incVat: sum('incVat'), exVat: sum('exVat'), vat: sum('vat'), byRate };
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
    // beräknat (exakt, före avrundning) mot presenterat (avrundat per arrangemang). Jobbavgifter är exakta belopp och avrundas inte.
    const qtyFrac = n => Frac.of(BigInt(n));
    const calcInc = Frac.sum([...results.filter(r => r.result.status !== 'EMPTY').map(r => r.result.calculated.incVat.mul(qtyFrac(r.qty))), ...feeAmounts.map(f => f.amounts.incVat.toFrac())]);
    const calcEx = Frac.sum([...results.filter(r => r.result.status !== 'EMPTY').map(r => r.result.calculated.exVat.mul(qtyFrac(r.qty))), ...feeAmounts.map(f => f.amounts.exVat.toFrac())]);
    return {
      status: 'OK', currency: cur, customerKind: kind, priceStatus, statusMark: priceStatus ? STATUS_MARK[priceStatus] : null,
      lines: results.map(r => ({ id: r.id, qty: r.qty, result: r.result, lineIncVat: r.result.customerPrice ? times(r.result.customerPrice, r.qty) : Money.zero(cur) })),
      fees: feeAmounts.map(f => ({ id: f.id, category: f.category, amounts: f.amounts })),
      vatByRate, totalExVat, totalVat, totalIncVat,
      calculated: { exVat: calcEx, vat: calcInc.sub(calcEx), incVat: calcInc },
      presented: { exVat: totalExVat, vat: totalVat, incVat: totalIncVat, rounding: totalIncVat.toFrac().sub(calcInc) },
      headline: kind === 'BUSINESS' ? { kind: 'EX_VAT_PLUS_VAT', exVat: totalExVat, vat: totalVat, incVat: totalIncVat } : { kind: 'INC_VAT', amount: totalIncVat },
      rule: { refs, allVerified, roundingLevel: 'line' }
    };
  }

  return {
    PRICE_SOURCE_KINDS, PRICE_STATUS, STATUS_MARK, CUSTOMER_KINDS, COST_KINDS, PRICING_MODES, PRICE_BASIS, PRICE_STATE, normalizeBasis,
    marginFromMarkup, markupFromMargin, suggestMarkupBpFromMarginBp,
    resolveLabor, laborExact, classifyPriceStatus,
    priceArrangement, budgetForTarget, priceJob, allocateAgreed
  };
});
