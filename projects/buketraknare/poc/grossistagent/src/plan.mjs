// Inköpsberäkningen. Den görs av Buketträknarens egen exakta kod (purchase.js), aldrig av AI:n.
// Exempel: Avalanche 60 cm, 20-pack, 25 behövs → 2 förpackningar, 40 st, 15 över, kostnad = 2 × förpackningspriset.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { Money, ROUNDING } = require('../../../public/js/core/money.js');
const PU = require('../../../public/js/core/purchase.js');

export const kr = m => { if (!m) return null; const a = m.amount < 0n ? -m.amount : m.amount, w = String(a / 100n), o = a % 100n; return (m.amount < 0n ? '-' : '') + w + (o === 0n ? '' : ',' + String(o).padStart(2, '0')) + ' kr'; };

export function purchasePlan(product, needed) {
  const base = { id: product.id, name: product.name, needed };
  if (!Number.isSafeInteger(needed) || needed < 1) return { ...base, status: 'ogiltigt_antal', note: 'Antalet måste vara ett heltal från 1.' };
  if (!product.packSize) return { ...base, status: 'förpackning_okänd', note: 'Förpackningsstorleken är okänd, så ingen beräkning görs.' };
  const key = 'poc:' + product.id;
  const plan = PU.planPurchase({
    currency: product.packPrice ? product.packPrice.currency : 'SEK', packMode: 'WHOLE_PACKS',
    catalog: { [key]: { name: product.name, packSize: product.packSize, packPrice: product.packPrice || null, source: { kind: 'LIVE' } } }, onHand: {},
    arrangements: [{ id: 'a', quantity: 1, items: [{ id: 'i', articleKey: key, quantity: needed }] }], shipping: {}
  });
  const r = plan.requirements[0];
  const out = { ...base, status: product.packPrice ? 'ok' : 'pris_saknas', packSize: product.packSize, packs: r.packs, bought: r.bought, leftover: r.leftover, packPrice: product.packPrice ? kr(product.packPrice) : null };
  if (product.packPrice) {
    const cost = Money.fromFrac(r.cost, ROUNDING.HALF_UP, product.packPrice.currency);
    out.cost = kr(cost); out.costExact = r.cost.toString(); out.costNote = product.priceIncludesVat === true ? 'inkl. moms' : product.priceIncludesVat === false ? 'exkl. moms' : 'momsstatus okänd';
    out.perStem = kr(Money.fromFrac(r.perUnit, ROUNDING.HALF_UP, product.packPrice.currency));
  } else out.note = 'Priset saknas, så ingen kostnad räknas.';
  return out;
}
