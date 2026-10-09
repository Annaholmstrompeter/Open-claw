/* Buketträknaren: ArrangementItem, en rad i ett arrangemang. Grossistartiklar OCH egna material.
 *
 * Allt som används i ett arrangemang kommer inte från den aktuella grossistbeställningen. Floristen använder också sidenband som
 * redan finns i butiken, en vas, oasis, tråd, torkat material, blommor från egen trädgård och överblivet material. Därför kräver en
 * rad ingen SupplierProduct. Två saker hålls isär:
 *
 *   VAD SOM ANVÄNDS I ARRANGEMANGET     alla rader. De påverkar kundpriset.
 *   VAD SOM MÅSTE BESTÄLLAS             bara rader med requiresPurchase. Bara de kan bli ett inköpsbehov hos en grossist.
 *
 * source (var materialet kommer ifrån):
 *   SUPPLIER    en artikel hos en grossist (articleRef krävs). requiresPurchase är alltid sant.
 *   OWN_STOCK   finns redan i butiken (sidenband, vas, oasis). Beställs inte.
 *   HOME_GROWN  egen trädgård eller odling. Beställs inte.
 *   MANUAL      något annat floristen skriver in (kan kräva inköp någon annanstans, requiresPurchase är då sant).
 *   LEFTOVER    reserverad plats för överblivet material från tidigare inköp. Inte aktiverad, avvisas tills vidare.
 *
 * Prissättning (pricing.mode):
 *   STANDARD_MARKUP   kalkylkostnaden (unitCostBasis, eller grossistens pris för SUPPLIER) får butikens vanliga påslag.
 *   FIXED_SALE_PRICE  floristen anger kundens pris direkt (unitSalePrice, med eller utan moms). Kräver ingen inköpskostnad.
 *   INCLUDED          uttryckligt val: "ingår utan extra kostnad". Ett giltigt kundpris på 0 kr ("kvistar från egen trädgård").
 *
 * PRICE_MISSING är något annat än EXPLICITLY_INCLUDED. Ett pris som saknas (ingen kalkylkostnad för ett standardpåslag, inget belopp för ett
 * fast pris, inget grossistpris) ger en ofullständig kalkyl. Bara INCLUDED är ett uttryckligt "0 kr".
 *
 * Fast pris anges med en uttrycklig prisbas: basis 'inc' (INC_VAT, inkl. moms) eller 'ex' (EX_VAT, exkl. moms). INC_VAT och EX_VAT godtas vid
 * inmatning. Anges ingen bas används den som kundtypen normalt har (privatkund inkl. moms, företagskund exkl. moms), men det som sparas har alltid en bas.
 *
 * NOLL INKÖPSKOSTNAD BETYDER INTE NOLL VÄRDE. En blomma från egen trädgård har kanske ingen extern inköpskostnad (unitExternalCost
 * är 0), men ett värde. Därför är tre saker olika fält: unitExternalCost (vad det kostar att skaffa utifrån, ändrar inte priset),
 * unitCostBasis (kalkylkostnaden som påslaget räknas på) och unitSalePrice (ett fast kundpris). Ett eget tillägg med standardpåslag
 * måste ha en kalkylkostnad större än noll. Annars väljer floristen ett fast kundpris, och 0 kr som kundpris är då hennes uttryckliga val.
 *
 * Moms: varje rad kan få en egen taxCategory oavsett source. Att något kommer från eget lager gör det inte momsfritt. Ingen sats gissas.
 *
 * Raden är enkel JSON (belopp som { amount: "ören som text", currency }), så att den kan sparas som den är.
 * "Mina material" (sparade egna material som återanvänds) finns som fältet materialRef. Det byggs inte nu.
 */
(function (root, factory) {
  var d = (typeof module === 'object' && module.exports) ? { M: require('./money.js'), T: require('./tax.js') } : { M: root.BRMoney, T: root.BRTax };
  var api = factory(d.M, d.T);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.BRItems = api;
})(typeof self !== 'undefined' ? self : this, function (M, T) {
  'use strict';
  const { Money, parseDecimal } = M;

  const SOURCES = Object.freeze(['SUPPLIER', 'OWN_STOCK', 'HOME_GROWN', 'MANUAL']);
  const RESERVED_SOURCES = Object.freeze(['LEFTOVER']);
  const PRICING_MODES = Object.freeze(['STANDARD_MARKUP', 'FIXED_SALE_PRICE', 'INCLUDED']);
  const PRICE_BASIS = Object.freeze({ INC_VAT: 'inc', EX_VAT: 'ex' });
  const PRICE_STATE = Object.freeze({ MISSING: 'PRICE_MISSING', INCLUDED: 'EXPLICITLY_INCLUDED', MARKUP: 'MARKUP', FIXED: 'FIXED_PRICE' });
  const normalizeBasis = b => (b === 'inc' || b === 'INC_VAT' ? 'inc' : b === 'ex' || b === 'EX_VAT' ? 'ex' : undefined);
  /** Prisbasen som kundtypen normalt har: privatkund inkl. moms, företagskund exkl. moms. */
  const defaultPriceBasis = customerKind => (customerKind === 'BUSINESS' ? 'ex' : 'inc');
  const KINDS = Object.freeze(['flowers', 'accessories', 'packaging', 'freight', 'other']);
  const DEFAULT_KIND = Object.freeze({ SUPPLIER: 'flowers', HOME_GROWN: 'flowers', OWN_STOCK: 'accessories', MANUAL: 'accessories' });

  class ItemValidationError extends Error {
    constructor(problems) {
      super('ogiltig rad i arrangemanget: ' + problems.map(p => p.message).join('; '));
      this.name = 'ItemValidationError';
      this.problems = problems;
    }
  }
  const prob = (code, message, field) => ({ code, message, field: field || null });

  const clone = o => (o === undefined ? undefined : JSON.parse(JSON.stringify(o)));
  const articleKey = ref => ref.connectionId + ':' + ref.supplierProductId;

  /** Belopp som enkel JSON → Money, eller null. Kastar inte, ger ett problem. */
  function readMoney(json, field, problems, opts) {
    if (json === null || json === undefined) return null;
    try {
      const m = Money.fromJSON(json);
      if (m.isNegative()) { problems.push(prob('negative_amount', field + ' får inte vara negativt', field)); return null; }
      if (opts && opts.currency && m.currency !== opts.currency) { problems.push(prob('currency_mismatch', field + ' har fel valuta', field)); return null; }
      return m;
    } catch (e) { problems.push(prob('bad_money', field + ' måste vara ett belopp { amount, currency }', field)); return null; }
  }

  /** Kontrollerar en rad (som enkel JSON). Ger en lista med problem, tom om raden är giltig. */
  function validateItem(item, opts) {
    const p = [];
    const it = item || {};
    const cur = opts && opts.currency;
    if (typeof it.id !== 'string' || !it.id) p.push(prob('bad_id', 'raden saknar id', 'id'));
    if (RESERVED_SOURCES.includes(it.source)) p.push(prob('source_not_enabled', 'källan ' + it.source + ' är reserverad men inte aktiverad än', 'source'));
    else if (!SOURCES.includes(it.source)) p.push(prob('bad_source', 'källan måste vara en av ' + SOURCES.join(', '), 'source'));
    if (!KINDS.includes(it.kind)) p.push(prob('bad_kind', 'typen måste vara en av ' + KINDS.join(', '), 'kind'));
    if (typeof it.requiresPurchase !== 'boolean') p.push(prob('bad_requires_purchase', 'requiresPurchase måste vara sant eller falskt', 'requiresPurchase'));

    let qty = null;
    try { qty = parseDecimal(it.quantity); } catch (e) { p.push(prob('bad_quantity', 'antalet måste vara ett tal', 'quantity')); }
    if (qty && !qty.gt(0n)) p.push(prob('bad_quantity', 'antalet måste vara större än noll', 'quantity'));
    if (qty && it.source === 'SUPPLIER' && !qty.isInteger()) p.push(prob('bad_quantity', 'antalet av en grossistartikel måste vara ett heltal', 'quantity'));

    const pr = it.pricing || {};
    if (!PRICING_MODES.includes(pr.mode)) p.push(prob('bad_pricing_mode', 'prissättningen måste vara en av ' + PRICING_MODES.join(', '), 'pricing.mode'));
    const cost = readMoney(pr.unitCostBasis, 'pricing.unitCostBasis', p, { currency: cur });
    readMoney(pr.unitExternalCost, 'pricing.unitExternalCost', p, { currency: cur });
    if (pr.mode === 'INCLUDED' && pr.unitSalePrice !== null && pr.unitSalePrice !== undefined) p.push(prob('included_has_price', 'ett pris som ingår har inget kundpris (välj ett fast pris om kunden ska betala)', 'pricing.unitSalePrice'));
    if (pr.unitSalePrice !== null && pr.unitSalePrice !== undefined) {
      if (pr.unitSalePrice.basis !== 'inc' && pr.unitSalePrice.basis !== 'ex') p.push(prob('bad_sale_basis', 'kundpriset måste anges med eller utan moms (inc eller ex)', 'pricing.unitSalePrice.basis'));
      readMoney(pr.unitSalePrice.amount, 'pricing.unitSalePrice.amount', p, { currency: cur });
    }
    if (it.taxCategory !== null && it.taxCategory !== undefined && !T.TAX_CATEGORIES.includes(it.taxCategory)) p.push(prob('bad_tax_category', 'okänd momskategori: ' + it.taxCategory, 'taxCategory'));

    if (it.source === 'SUPPLIER') {
      const r = it.articleRef;
      if (!r || typeof r.connectionId !== 'string' || !r.connectionId || typeof r.supplierProductId !== 'string' || !r.supplierProductId) p.push(prob('supplier_needs_article', 'en grossistartikel måste peka på en artikel (connectionId och supplierProductId)', 'articleRef'));
      if (it.requiresPurchase !== true) p.push(prob('requires_purchase_conflict', 'en grossistartikel ska alltid beställas (requiresPurchase = sant)', 'requiresPurchase'));
      if (pr.unitCostBasis !== null && pr.unitCostBasis !== undefined) p.push(prob('supplier_cost_from_quote', 'kostnaden för en grossistartikel kommer från grossistens pris, inte från raden', 'pricing.unitCostBasis'));
    } else if (SOURCES.includes(it.source)) {
      if (it.articleRef !== null && it.articleRef !== undefined) p.push(prob('article_on_non_supplier', 'bara en grossistartikel pekar på en artikel', 'articleRef'));
      if ((it.source === 'OWN_STOCK' || it.source === 'HOME_GROWN') && it.requiresPurchase === true) p.push(prob('requires_purchase_conflict', 'material från eget lager eller egen trädgård beställs inte (requiresPurchase = falskt)', 'requiresPurchase'));
      if (typeof it.name !== 'string' || !it.name.trim()) p.push(prob('bad_name', 'ett eget material behöver ett namn', 'name'));
      if (pr.mode === 'STANDARD_MARKUP') {
        if (cost === null && (pr.unitCostBasis === null || pr.unitCostBasis === undefined)) p.push(prob('cost_basis_missing', 'ett eget material med standardpåslag behöver en kalkylkostnad, eller välj ett fast kundpris', 'pricing.unitCostBasis'));
        else if (cost && cost.isZero()) p.push(prob('zero_cost_needs_value', 'noll inköpskostnad betyder inte noll värde: ange en kalkylkostnad större än noll, eller välj ett fast kundpris (0 kr som kundpris är ett uttryckligt val)', 'pricing.unitCostBasis'));
      }
    }
    if (pr.mode === 'FIXED_SALE_PRICE' && (pr.unitSalePrice === null || pr.unitSalePrice === undefined)) p.push(prob('sale_price_missing', 'ett fast kundpris saknas', 'pricing.unitSalePrice'));
    return p;
  }

  /** Ett fast pris med en uttrycklig prisbas (inc/ex). priceBasis och INC_VAT/EX_VAT godtas. Saknas basen används opts.defaultBasis. */
  function normalizeSalePrice(sp, opts) {
    if (sp === undefined || sp === null) return null;
    const out = clone(sp);
    const given = sp.basis !== undefined ? sp.basis : sp.priceBasis;
    delete out.priceBasis;
    const n = normalizeBasis(given);
    out.basis = n !== undefined ? n : (given === undefined && opts && opts.defaultBasis ? normalizeBasis(opts.defaultBasis) : given);
    return out;
  }

  /**
   * Gör en rad av indata: lägger på standardvärden och kontrollerar. Kastar ItemValidationError med alla problem.
   * Standardvärden: requiresPurchase är sant för SUPPLIER och falskt för övriga, typen följer källan, prissättningen är STANDARD_MARKUP.
   */
  function normalizeItem(raw, opts) {
    const r = raw || {};
    const source = r.source;
    const pr = r.pricing || {};
    const item = {
      id: r.id,
      source,
      kind: r.kind === undefined ? DEFAULT_KIND[source] || 'other' : r.kind,
      name: r.name === undefined || r.name === null ? '' : String(r.name),
      articleRef: r.articleRef === undefined ? null : clone(r.articleRef),
      materialRef: r.materialRef === undefined ? null : r.materialRef,
      quantity: r.quantity === undefined ? '1' : String(r.quantity).trim().replace(',', '.'),
      unit: r.unit === undefined ? 'st' : String(r.unit),
      requiresPurchase: r.requiresPurchase === undefined ? source === 'SUPPLIER' : r.requiresPurchase,
      pricing: {
        mode: pr.mode === undefined ? 'STANDARD_MARKUP' : pr.mode,
        unitCostBasis: pr.unitCostBasis === undefined ? null : clone(pr.unitCostBasis),
        unitExternalCost: pr.unitExternalCost === undefined ? (source === 'SUPPLIER' ? null : Money.zero((opts && opts.currency) || 'SEK').toJSON()) : clone(pr.unitExternalCost),
        unitSalePrice: normalizeSalePrice(pr.unitSalePrice, opts),
        markup: pr.markup !== false
      },
      taxCategory: r.taxCategory === undefined ? null : r.taxCategory,
      note: r.note === undefined || r.note === null ? '' : String(r.note)
    };
    const problems = validateItem(item, opts);
    if (problems.length) throw new ItemValidationError(problems);
    return item;
  }

  /**
   * Behöver raden anskaffas? 'WHOLESALER' = ska in i en grossistbeställning. 'ELSEWHERE' = ska köpas någon annanstans (MANUAL).
   * null = används i arrangemanget men beställs inte. Bara 'WHOLESALER' kan någonsin bli en rad i grossistens varukorg.
   */
  function purchaseNeed(item) {
    if (!item.requiresPurchase) return null;
    return item.source === 'SUPPLIER' ? 'WHOLESALER' : 'ELSEWHERE';
  }

  const quantityOf = item => parseDecimal(item.quantity);

  /** Vilken sorts pris raden har: PRICE_MISSING (kalkylen blir ofullständig), EXPLICITLY_INCLUDED (ett giltigt 0 kr), MARKUP eller FIXED_PRICE. */
  function priceState(item, planned) {
    const pr = item.pricing;
    if (pr.mode === 'INCLUDED') return PRICE_STATE.INCLUDED;
    if (pr.mode === 'FIXED_SALE_PRICE') return pr.unitSalePrice ? PRICE_STATE.FIXED : PRICE_STATE.MISSING;
    if (item.source === 'SUPPLIER') return planned && planned.status === 'ok' ? PRICE_STATE.MARKUP : PRICE_STATE.MISSING;
    return pr.unitCostBasis ? PRICE_STATE.MARKUP : PRICE_STATE.MISSING;
  }

  /**
   * Raden som motorn (PricingEngine) förstår. För en grossistartikel kommer kostnaden ur inköpsplanen (planned: { status, cost, source }).
   * För egna material kommer den ur raden själv. Priset beror aldrig på unitExternalCost.
   */
  function itemToCostLine(item, planned) {
    const qty = quantityOf(item), pr = item.pricing;
    const line = { id: item.id, kind: item.kind, pricing: pr.mode, markup: pr.markup !== false, taxCategory: item.taxCategory || undefined, origin: item.source };
    if (item.source === 'SUPPLIER') {
      line.cost = planned && planned.status === 'ok' ? planned.cost : null;
      line.externalCost = line.cost;                                                   // grossistens pris är den externa kostnaden
      line.source = planned && planned.source ? planned.source : null;
    } else {
      line.cost = pr.unitCostBasis ? Money.fromJSON(pr.unitCostBasis).toFrac().mul(qty) : null;                       // kalkylkostnad (calculationCost)
      line.externalCost = pr.unitExternalCost ? Money.fromJSON(pr.unitExternalCost).toFrac().mul(qty) : null;          // vad det kostar att skaffa utifrån idag (purchaseCostToday)
      line.source = { kind: 'MANUAL', ref: 'own:' + item.source };
    }
    if (pr.mode === 'FIXED_SALE_PRICE' && pr.unitSalePrice) {
      line.salePrice = { amount: Money.fromJSON(pr.unitSalePrice.amount).toFrac().mul(qty), basis: pr.unitSalePrice.basis };
    }
    return line;
  }

  return { SOURCES, RESERVED_SOURCES, PRICING_MODES, PRICE_BASIS, PRICE_STATE, KINDS, ItemValidationError, articleKey, validateItem, normalizeItem, purchaseNeed, quantityOf, priceState, itemToCostLine, defaultPriceBasis, normalizeBasis };
});
