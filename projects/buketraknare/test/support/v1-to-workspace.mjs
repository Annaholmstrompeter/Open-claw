// Testhjälpare: bygger en ny arbetsyta (kund, jobb, arrangemang, rader) av ett sparat tillstånd i det gamla formatet (v1-vyn),
// så att den nya kedjan (rader → inköpsplan → pris) kan jämföras med den gamla räknemotorn calc() på samma tillstånd.
// Returnerar null med en orsak när den gamla inställningen inte går att uttrycka exakt i den nya modellen.
import M from '../../public/js/core/money.js';
import W from '../../public/js/core/workspace.js';

const { Money, Rate } = M;
export const TODAY = '2026-10-07';
const dec = x => Money.fromDecimal(String(x));
const ctxFor = () => { let n = 0, t = 0; return { now: () => new Date(Date.UTC(2026, 9, 7, 10, 0, t++)).toISOString(), newId: p => p + '_' + String(++n).padStart(4, '0') }; };

export function workspaceFromV1(view) {
  const S = view.settings;
  try {
    const pricing = {
      markupBp: Rate.fromPercent(String(S.markupPct)),
      hourlyLaborRate: dec(S.hourly).toJSON(), defaultLaborFee: null,
      rounding: S.roundStep > 0 ? { step: dec(S.roundStep).toJSON(), mode: 'CEIL' } : { step: dec(1).toJSON(), mode: 'HALF_UP' },   // calc(): steg 0 = närmaste hela krona
      packMode: S.mode === 'whole' ? 'WHOLE_PACKS' : 'USED_ONLY',
      shipping: { fee: S.shipFee > 0 ? dec(S.shipFee).toJSON() : null, freeFrom: S.freeFrom > 0 ? dec(S.freeFrom).toJSON() : null },
      legacyVatPercent: String(S.vatPct)
    };
    const ctx = ctxFor();
    const st = W.createWorkspace(ctx, { pricing });
    const customer = W.addCustomer(st, ctx, { name: 'Testkund' });
    const ev = W.createEvent(st, ctx, { name: 'Min order', customerId: customer.id });
    const catalog = {};
    for (const it of view.priceList.items) {
      const paket = Math.max(1, Math.round(+it.paket || 1)), pris = Math.max(0, +it.pris || 0);
      catalog['conn_manual:' + it.id] = { name: it.namn, packSize: paket, packPrice: pris > 0 ? dec(pris) : null, source: { kind: it.uppd === TODAY ? 'LIVE' : 'STALE' } };
    }
    const onHand = {};
    for (const [k, v] of Object.entries(view.order.hemma || {})) { const n = Math.max(0, Math.round(+v || 0)); if (n > 0) onHand['conn_manual:' + k] = n; }
    W.updateEvent(st, ctx, ev.id, { onHand });
    for (const b of view.order.buketter) {
      if (!Number.isSafeInteger(b.qty) || b.qty < 1) return { skip: 'antal' };
      const size = S.sizes.find(s => s.id === b.size) || S.sizes[0];
      const entries = Object.entries(b.items).filter(([, n]) => n > 0);
      if (entries.some(([, n]) => !Number.isSafeInteger(n))) return { skip: 'antal per arrangemang' };
      if (entries.length && (!Number.isSafeInteger(size.minutes) || size.minutes < 0)) return { skip: 'minuter' };
      const arr = W.addArrangement(st, ctx, ev.id, { name: 'Bukett ' + b.id, quantity: b.qty, estimatedMinutes: entries.length ? size.minutes : null });
      for (const [k, n] of entries) W.addItem(st, ctx, arr.id, { source: 'SUPPLIER', name: k, articleRef: { connectionId: 'conn_manual', supplierProductId: k }, quantity: n });
      if (entries.length && +size.wrap > 0) W.addItem(st, ctx, arr.id, { source: 'OWN_STOCK', kind: 'packaging', name: 'Emballage', pricing: { mode: 'STANDARD_MARKUP', unitCostBasis: dec(size.wrap).toJSON() } });
    }
    return { st, ev, catalog, ctx };
  } catch (e) {
    return { skip: String(e && e.message || e) };
  }
}
