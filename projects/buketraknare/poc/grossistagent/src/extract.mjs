// Deterministisk extraktion. AI:n får bara föreslå HUR fälten hittas (sökvägar eller väljare). Den här koden hämtar, tolkar och kontrollerar
// alla rader, och tar aldrig ett pris, en förpackning eller ett antal ur AI:ns text.
// Okänt förblir okänt (null och en anmärkning), aldrig en gissning.
import { createRequire } from 'node:module';
import { getPath } from './capture.mjs';

const require = createRequire(import.meta.url);
const { Money } = require('../../../public/js/core/money.js');          // samma exakta pengar som resten av Buketträknaren (läses bara)
const BRModel = require('../../../public/js/core/model.js');

const clean = (v, n = 200) => (v === null || v === undefined ? null : String(v).replace(/\s+/g, ' ').trim().slice(0, n) || null);

/** "1 234,50 kr" och 118 och "118.00" → exakt belopp. Allt annat (tre decimaler, text, flyttalsbrus) → null. */
export function parseMoneyValue(v) {
  if (v === null || v === undefined) return null;
  let s = typeof v === 'number' ? (Number.isFinite(v) ? String(v) : '') : String(v);
  s = s.replace(/[\s ]/g, '').replace(/(kr|sek|:-|\/st|\/förp)$/i, '');
  if (/^\d{1,3}(\.\d{3})+,\d+$/.test(s)) s = s.replace(/\./g, '');
  s = s.replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  try { return Money.fromDecimal(s); } catch (e) { return null; }
}
export function parseLengthCm(v) {
  if (v === null || v === undefined) return null;
  const m = String(v).replace(',', '.').match(/(\d+(?:\.\d+)?)\s*(cm|m)?\b/i);
  if (!m) return null;
  const n = m[2] && m[2].toLowerCase() === 'm' ? Math.round(Number(m[1]) * 100) : Number(m[1]);
  return Number.isFinite(n) && n > 0 && n < 500 ? n : null;
}
export function parsePackSize(v) {
  if (typeof v === 'number') return Number.isInteger(v) && v >= 1 && v <= 1000 ? v : null;
  const t = String(v == null ? '' : v);
  if (/^\s*\d+\s*$/.test(t)) { const n = parseInt(t, 10); return n >= 1 && n <= 1000 ? n : null; }
  for (const re of [/(\d+)\s*-?\s*pack\b/i, /\bpack\s*(?:à|a|om|of)?\s*(\d+)/i, /(?:bunt|knippe|förp\w*|kartong|låda|box)\s*(?:à|a|om|of|\/)?\s*(\d+)/i, /(\d+)\s*(?:st|stk|stjälkar)?\s*\/\s*(?:bunt|knippe|förp\w*|pack|kartong)/i, /(?:^|\s)[aà]\s*(\d+)\b/i]) {
    const m = t.match(re); if (m) { const n = parseInt(m[1], 10); if (n >= 1 && n <= 1000) return n; }
  }
  return null;
}
export function normalizeAvailability(v) {
  if (v === null || v === undefined || v === '') return 'unknown';
  if (typeof v === 'number') return v > 0 ? 'in_stock' : 'sold_out';
  const t = String(v).toLowerCase();
  if (/slut|ej i lager|sold out|out of stock|saknas|utgått/.test(t)) return 'sold_out';
  if (/få|begränsad|low|fåtal/.test(t)) return 'low';
  if (/i lager|finns|tillgänglig|in stock|available|^\d+$/.test(t)) return /^0+$/.test(t) ? 'sold_out' : 'in_stock';
  return 'unknown';
}
const boolish = v => { if (typeof v === 'boolean') return v; const t = String(v == null ? '' : v).toLowerCase(); if (/inkl/.test(t) || t === 'true' || t === 'ja') return true; if (/exkl/.test(t) || t === 'false' || t === 'nej') return false; return null; };
const unitOf = v => { const t = String(v == null ? '' : v).toLowerCase(); if (/förp|pack|bunt|knippe|kartong|låda|box/.test(t)) return 'pack'; if (/^st$|styck|stjälk|\/st\b|per st/.test(t)) return 'stem'; return null; };

/** Rader ur ett JSON-svar. fields är sökvägar relativt varje rad. */
export function applyJsonMapping(json, { itemsPath, fields }) {
  const items = getPath(json, itemsPath);
  if (!Array.isArray(items)) return { rows: [], issues: [{ code: 'items_not_array', path: itemsPath }] };
  const names = Object.keys(fields || {});
  const rows = items.slice(0, 2000).map(it => { const r = {}; for (const n of names) r[n] = getPath(it, fields[n]); return r; });
  return { rows, issues: [] };
}

/** Rader ur den visade sidan. AI:n anger bara väljare (data), koden kör en fast funktion i sidan. */
export async function applyDomMapping(page, { rowSelector, fields, limit = 300 }) {
  const rows = await page.evaluate(({ rowSel, flds, max }) => {
    const out = [];
    for (const row of Array.from(document.querySelectorAll(rowSel)).slice(0, max)) {
      const r = {};
      for (const [name, spec] of Object.entries(flds)) {
        const sel = typeof spec === 'string' ? spec : spec.selector, attr = typeof spec === 'string' ? null : spec.attr;
        const el = sel === ':scope' ? row : row.querySelector(sel);
        r[name] = el ? (attr ? el.getAttribute(attr) : (el.textContent || '').trim()) : null;
      }
      out.push(r);
    }
    return out;
  }, { rowSel: rowSelector, flds: fields, max: limit });
  return { rows, issues: rows.length ? [] : [{ code: 'no_rows', selector: rowSelector }] };
}

/** Råa rader → normaliserade artiklar. meta: { priceUnit, priceIncludesVat, currency, source }. */
export function normalizeRows(rawRows, meta = {}) {
  const products = [], seen = new Set(), skipped = { noId: 0, noName: 0, duplicate: 0 };
  for (const r of rawRows) {
    const id = clean(r.id), name = clean(r.name);
    if (!id) { skipped.noId++; continue; }
    if (!name) { skipped.noName++; continue; }
    if (seen.has(id)) { skipped.duplicate++; continue; }
    seen.add(id);
    const issues = [];
    let packSize = parsePackSize(r.packSize), packSizeSource = packSize ? 'fält' : null;
    if (!packSize) { packSize = parsePackSize(name); packSizeSource = packSize ? 'namn' : null; }
    if (!packSize) issues.push('förpackningsstorlek okänd');
    const unit = unitOf(r.priceUnit) || (['pack', 'stem'].includes(meta.priceUnit) ? meta.priceUnit : null);
    const price = parseMoneyValue(r.price);
    let packPrice = null, priceDerived = false;
    if (r.price === null || r.price === undefined || r.price === '') issues.push('pris saknas');
    else if (!price) issues.push('priset går inte att läsa exakt (' + clean(r.price, 30) + ')');
    else if (!unit) issues.push('prisenhet okänd (per förpackning eller per styck)');
    else if (unit === 'pack') packPrice = price;
    else if (!packSize) issues.push('pris per styck men förpackningsstorlek okänd');
    else { packPrice = Money.of(price.amount * BigInt(packSize), price.currency); priceDerived = true; }
    const offerRaw = r.offer;
    const offerText = offerRaw && typeof offerRaw === 'object' ? clean(Object.values(offerRaw).filter(v => typeof v === 'string').join('; '), 200) : null;
    const offer = offerRaw === null || offerRaw === undefined || offerRaw === '' ? null : typeof offerRaw === 'object' ? clean(JSON.stringify(offerRaw), 300) : clean(offerRaw, 300);
    const extras = {};
    for (const [k, v] of Object.entries(r.extras || {})) if (v !== null && v !== undefined && v !== '') extras[k] = typeof v === 'object' ? clean(JSON.stringify(v), 200) : clean(v);
    const vat = r.priceIncludesVat !== undefined && r.priceIncludesVat !== null ? boolish(r.priceIncludesVat) : (meta.priceIncludesVat === undefined ? null : meta.priceIncludesVat);
    const curField = clean(r.currency, 3);
    products.push({
      id, name, variant: clean(r.variant), color: clean(r.color), lengthCm: parseLengthCm(r.lengthCm), packSize, packSizeSource,
      packPrice, priceUnit: unit, priceDerived, currency: curField || meta.currency || 'SEK', currencyAssumed: !curField && !meta.currency,
      priceIncludesVat: vat, availability: normalizeAvailability(r.availability), availabilityRaw: clean(r.availability, 60), offer, offerText: offerText || (typeof offerRaw === 'string' ? offer : null), extras, issues
    });
  }
  return { products, skipped };
}

/** Artiklarna i den gemensamma form som grossistkontraktet (model.js) tar emot, och som kontrollerar dem. */
export function toSupplierData(products, { fetchedAt }) {
  const sp = [], quotes = [];
  for (const p of products) {
    sp.push({ supplierProductId: p.id, name: p.name, variant: p.variant || '', colour: p.color || '', stemLengthCm: p.lengthCm, ...(p.packSize ? { stemsPerPack: p.packSize } : {}), packUnit: '' });
    quotes.push({ supplierProductId: p.id, packPrice: p.packPrice ? Number(p.packPrice.toDecimalString()) : null, currency: p.currency, priceIncludesVat: p.priceIncludesVat,
      availability: p.availability, fetchedAt, strategy: 'browser', verification: 'live' });
  }
  const checked = { products: sp.map(x => BRModel.normalizeSupplierProduct(x)), quotes: quotes.map(x => BRModel.normalizeQuote(x)) };
  return checked;
}

/** Det agenten får se om en artikel. Inga priser: varken förpackningspris eller ett pris inuti ett erbjudande (bara erbjudandets text). */
export const compact = p => ({
  id: p.id, name: p.name, variant: p.variant, color: p.color, lengthCm: p.lengthCm, packSize: p.packSize, availability: p.availability,
  erbjudande: p.offerText || (p.offer ? 'finns' : null), issues: p.issues
});
