// Plockar ut det som spelar roll ur ett calc()-resultat, oberoende av om varor nycklas på namn (gamla appen) eller id (nya).
import { keyOf } from '../helpers/app.mjs';

const r6 = x => (typeof x === 'number' ? Math.round(x * 1e6) / 1e6 : x);

export function extractCalc(C, toKey = k => k) {
  const buy = {};
  for (const b of Object.values(C.buy)) {
    buy[keyOf(b.it.namn)] = { need: b.need, have: b.have, toBuy: b.toBuy, packs: b.packs, bought: b.bought, cost: r6(b.cost), used: r6(b.used), leftover: b.leftover, hasPrice: b.hasPrice, fresh: b.fresh };
  }
  return {
    rows: C.rows.map(w => ({ price: w.price, lineTotal: w.lineTotal, approx: w.approx, incomplete: w.incomplete, empty: w.empty, stems: w.stems, flowers: r6(w.flowers), shipShare: r6(w.shipShare || 0), margin: r6(w.margin || 0) })),
    total: C.total, purchaseSum: r6(C.purchaseSum), ship: C.ship, count: C.count, incomplete: C.incomplete, approx: C.approx,
    leftoverStems: C.leftoverStems, leftoverValue: r6(C.leftoverValue),
    missing: C.missing.map(toKey).sort(), noPrice: C.noPrice.map(toKey).sort(), buy
  };
}

/** id → namnnyckel, som labelOf() i appen (etikett först, annars varans namn, annars id). */
export function toKeyFor(app) {
  const st = app.hook.state();
  const byId = new Map(st.priceList.items.map(i => [i.id, i.namn]));
  return id => keyOf(st.labels[id] !== undefined ? st.labels[id] : (byId.get(id) !== undefined ? byId.get(id) : id));
}

export const GOLDEN_FUZZ = 50;
export const GOLDEN_CLEAN = 90;
