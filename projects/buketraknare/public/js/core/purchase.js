/* Buketträknaren: inköpsplan i exakt aritmetik (hela förpackningar, delning mellan arrangemang, hemmalager och frakt).
 *
 * Det här är den första halvan av den gamla räknemotorn calc(), flyttad till exakta tal. calc() ligger kvar orörd som referensmotor
 * och motorerna jämförs mot varandra i test/purchase-differential.test.mjs på de 145 sparade tillstånden.
 *
 * VAD SOM ANVÄNDS I ARRANGEMANGET är en sak. VAD SOM MÅSTE BESTÄLLAS är en annan. Den här planen får bara de rader som faktiskt
 * ska anskaffas från en grossist (arrangemangsrader med requiresPurchase). Egna tillägg, material från eget lager och blommor från
 * egen trädgård kommer aldrig hit och skapar därför aldrig något inköpsbehov.
 *
 * Indata:
 *   currency
 *   arrangements[]  { id, quantity (heltal från 1), nonEmpty?, items[] { id, articleKey, quantity (heltal från 1, antal per arrangemang) } }
 *   catalog         { [articleKey]: { name?, packSize (heltal från 1), packPrice: Money | null, source?: { kind, asOf, ref } } }
 *   onHand          { [articleKey]: antal hemma (heltal från 0) }
 *   packMode        'WHOLE_PACKS' (hela förpackningar räknas in i priset) | 'USED_ONLY' (bara det som används)
 *   shipping        { fee: Money | null, freeFrom: Money | null }
 * En artikel utan pris (packPrice null eller 0) eller som saknas i katalogen ger en rad utan pris. Aldrig 0 kr.
 *
 * Alla belopp ut är Frac i ören (exakta bråk), så att ingenting avrundas på vägen. Antal är vanliga heltal. Hela resultatet går att
 * spara som JSON.
 */
(function (root, factory) {
  var dep = (typeof module === 'object' && module.exports) ? require('./money.js') : root.BRMoney;
  var api = factory(dep);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.BRPurchase = api;
})(typeof self !== 'undefined' ? self : this, function (M) {
  'use strict';
  const { Money, Frac, EconomyError, toSafeInt } = M;

  const PACK_MODES = Object.freeze(['WHOLE_PACKS', 'USED_ONLY']);
  const ZERO = Frac.of(0n);

  function posInt(x, what, min) {
    let f;
    try { f = Frac.from(x); } catch (e) { throw new EconomyError('bad_quantity', what + ' måste vara ett heltal'); }
    if (!f.isInteger() || f.n < BigInt(min)) throw new EconomyError('bad_quantity', what + ' måste vara ett heltal från ' + min);
    return f.n;
  }
  const pos = m => m instanceof Money && m.amount > 0n;

  /** Räknar ut vad som ska köpas, vad det kostar och hur kostnaden fördelas på arrangemang och rader. */
  function planPurchase(input) {
    const cur = input.currency || 'SEK';
    const packMode = input.packMode === undefined ? 'WHOLE_PACKS' : input.packMode;
    if (!PACK_MODES.includes(packMode)) throw new EconomyError('bad_pack_mode', 'okänt läge för förpackningar: ' + String(packMode));
    const catalog = input.catalog || {}, onHand = input.onHand || {};
    const ship = input.shipping || {};
    for (const m of [ship.fee, ship.freeFrom]) if (m !== null && m !== undefined && (!(m instanceof Money) || m.currency !== cur)) throw new EconomyError('bad_shipping', 'frakten måste vara Money i ' + cur);

    // behov per artikel: antal per arrangemang × antal arrangemang, summerat över alla arrangemang
    const arrangements = (input.arrangements || []).map(a => ({ id: a.id, qty: posInt(a.quantity, 'antalet arrangemang', 1), nonEmpty: a.nonEmpty === undefined ? (a.items || []).length > 0 : !!a.nonEmpty,
      items: (a.items || []).map(it => ({ id: it.id, key: it.articleKey, n: posInt(it.quantity, 'antalet per arrangemang', 1) })) }));
    const need = new Map();
    for (const a of arrangements) for (const it of a.items) need.set(it.key, (need.get(it.key) || 0n) + it.n * a.qty);

    const requirements = [], byKey = new Map(), missing = [], noPrice = [];
    for (const [key, needed] of need) {
      const art = catalog[key];
      if (!art) { missing.push(key); continue; }
      const packSize = posInt(art.packSize, 'förpackningsstorleken för ' + key, 1);
      if (art.packPrice !== null && art.packPrice !== undefined && (!(art.packPrice instanceof Money) || art.packPrice.currency !== cur || art.packPrice.isNegative())) throw new EconomyError('bad_price', 'priset för ' + key + ' måste vara ett icke-negativt Money i ' + cur);
      const hasPrice = pos(art.packPrice);
      if (!hasPrice) noPrice.push(key);
      const hand = onHand[key] === undefined ? 0n : posInt(onHand[key], 'antalet hemma för ' + key, 0);
      const have = hand < needed ? hand : needed;
      const toBuy = needed - have;
      const packs = (toBuy + packSize - 1n) / packSize;                        // hela förpackningar uppåt
      const bought = packs * packSize;
      const packPrice = hasPrice ? art.packPrice.toFrac() : ZERO;
      const perUnit = packPrice.div(Frac.of(packSize));
      const cost = Frac.of(packs).mul(packPrice);
      const used = packMode === 'WHOLE_PACKS' ? cost : Frac.of(toBuy).mul(perUnit);
      // antal är vanliga heltal i resultatet (så att planen går att spara som JSON), beloppen är exakta bråk
      const row = { key, name: art.name || key, needed: toSafeInt(needed), onHand: toSafeInt(have), toBuy: toSafeInt(toBuy), packSize: toSafeInt(packSize), packs: toSafeInt(packs), bought: toSafeInt(bought), leftover: toSafeInt(bought - toBuy),
        packPrice: hasPrice ? art.packPrice : null, hasPrice, perUnit, cost, usedCost: used, leftoverValue: Frac.of(bought - toBuy).mul(perUnit), source: art.source || null };
      requirements.push(row); byKey.set(key, row);
    }
    const purchaseSum = Frac.sum(requirements.map(r => r.cost));

    // frakt: avgift, fri frakt från ett visst inköpsbelopp, ingen frakt utan inköp
    const fee = ship.fee ? ship.fee.toFrac() : ZERO, freeFrom = ship.freeFrom ? ship.freeFrom.toFrac() : ZERO;
    let shipping = ZERO, shippingRule = 'NONE';
    if (fee.gt(0n) && purchaseSum.gt(0n)) {
      if (freeFrom.gt(0n) && purchaseSum.gte(freeFrom)) shippingRule = 'FREE_FROM_REACHED';
      else { shipping = fee; shippingRule = 'CHARGED'; }
    }

    // kostnad per arrangemang (en enhet): varje rad bär sin andel av förpackningskostnaden efter hur mycket den används
    const per = arrangements.map(a => {
      const items = a.items.map(it => {
        const r = byKey.get(it.key);
        if (!r) return { itemId: it.id, articleKey: it.key, status: 'missing', cost: null, source: null };
        if (!r.hasPrice) return { itemId: it.id, articleKey: it.key, status: 'no_price', cost: null, source: r.source };
        return { itemId: it.id, articleKey: it.key, status: 'ok', cost: Frac.of(it.n).mul(r.usedCost).div(Frac.of(r.needed)), source: r.source };
      });
      return { id: a.id, quantity: toSafeInt(a.qty), nonEmpty: a.nonEmpty, items, materialCost: Frac.sum(items.filter(i => i.cost !== null).map(i => i.cost)), complete: items.every(i => i.status === 'ok') };
    });
    const flowersAll = Frac.sum(per.map(a => a.materialCost.mul(Frac.of(a.quantity))));
    if (shipping.gt(0n) && !flowersAll.gt(0n)) throw new EconomyError('inconsistent_plan', 'frakt utan kostnad att fördela på (kan inte inträffa med giltiga indata)');
    for (const a of per) a.freightShare = shipping.gt(0n) ? shipping.mul(a.materialCost).div(flowersAll) : ZERO;

    return {
      packMode, requirements, missing, noPrice, purchaseSum,
      shipping: { total: shipping, rule: shippingRule },
      arrangements: per,
      leftover: { stems: requirements.reduce((s, r) => s + (r.hasPrice ? r.leftover : 0), 0), value: Frac.sum(requirements.map(r => r.leftoverValue)) }
    };
  }

  return { PACK_MODES, planPurchase };
});
