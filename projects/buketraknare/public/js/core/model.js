/* Buketträknaren: datamodell v2.
 *
 * Fyra skilda begrepp med stabila id:n (namnet är aldrig nyckel):
 *   PRODUKT            floristens egna ord ("Vit ros")              products[]
 *   LEVERANTÖRSPRODUKT en vara hos en grossist                       supplierProducts[]   (connectionId + supplierProductId)
 *   PRIS               vad den kostar, när det verifierades          quotes[]             (sparas som historik)
 *   MATCHNING          vilken leverantörsprodukt som är floristens  matches[]            (bekräftad en gång, återanvänds)
 *
 * Den egna prislistan (det man skriver in eller läser in från CSV/AI) är en vanlig "anslutning" med id
 * conn_manual. Därför ser en grossist och en manuell lista likadana ut för resten av appen.
 *
 * Ren logik utan webbläsarberoenden: laddas som <script> i appen (window.BRModel) och som modul i Node
 * (tester och server). Räknemotorn känner inte till något av detta. Den får en vy i det gamla formatet
 * (viewOf) med id:n som nycklar.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.BRModel = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const MANUAL = 'conn_manual';
  const MAX_QUOTES_PER_PRODUCT = 10;
  const STRATEGIES = ['api', 'feed', 'xhr', 'browser', 'vision', 'manual'];
  const AVAILABILITY = ['in_stock', 'low', 'sold_out', 'unknown'];
  const VERIFICATION = ['live', 'ai_read', 'manual'];
  const CONNECTION_STATUS = ['connected', 'needsReauth', 'degraded', 'disconnected'];

  // ---------- små hjälpare ----------
  const clone = o => (o === undefined ? undefined : JSON.parse(JSON.stringify(o)));
  const keyOf = s => String(s == null ? '' : s).normalize('NFC').trim().replace(/\s+/g, ' ').toLowerCase();
  const slug = s => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
  function rand(n) {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let out = '';
    const c = typeof globalThis !== 'undefined' && globalThis.crypto && globalThis.crypto.getRandomValues;
    if (c) { const a = new Uint8Array(n); globalThis.crypto.getRandomValues(a); for (let i = 0; i < n; i++) out += chars[a[i] % chars.length]; }
    else for (let i = 0; i < n; i++) out += chars[Math.floor(Math.random() * chars.length)];
    return out;
  }
  function uniqueId(prefix, base, taken) {
    const b = base || 'x' + rand(6);
    let id = prefix + b, n = 2;
    while (taken.has(id)) id = prefix + b + '-' + n++;
    taken.add(id);
    return id;
  }
  const localDate = iso => new Date(iso).toLocaleDateString('sv-SE');

  class ModelValidationError extends Error {
    constructor(problems) {
      super('Ogiltig data: ' + problems.join('; '));
      this.name = 'ModelValidationError';
      this.problems = problems;
    }
  }

  // ---------- normalisering av det en grossist levererar ----------
  const str = v => (v == null ? '' : String(v).trim());
  function intOf(v) {
    if (typeof v === 'string' && /^\s*\d+\s*$/.test(v)) return parseInt(v, 10);
    return typeof v === 'number' && Number.isInteger(v) ? v : NaN;
  }
  function numOf(v) {
    if (typeof v === 'number') return v;
    if (typeof v === 'string' && v.trim() !== '') return Number(v.trim().replace(',', '.').replace(/\s/g, ''));
    return NaN;
  }

  function productProblems(raw) {
    const p = [];
    if (!raw || typeof raw !== 'object') return ['produkt saknas'];
    if (!str(raw.supplierProductId)) p.push('supplierProductId saknas');
    if (!str(raw.name)) p.push('name saknas');
    if (raw.stemsPerPack !== undefined && !(intOf(raw.stemsPerPack) >= 1)) p.push('stemsPerPack måste vara ett heltal ≥ 1');
    if (raw.orderMultiple !== undefined && !(intOf(raw.orderMultiple) >= 1)) p.push('orderMultiple måste vara ett heltal ≥ 1');
    if (raw.stemLengthCm != null && !(numOf(raw.stemLengthCm) > 0)) p.push('stemLengthCm måste vara > 0');
    return p;
  }
  function normalizeSupplierProduct(raw) {
    const problems = productProblems(raw);
    if (problems.length) throw new ModelValidationError(problems);
    return {
      supplierProductId: str(raw.supplierProductId),
      name: str(raw.name),
      variant: str(raw.variant), category: str(raw.category), genus: str(raw.genus), cultivar: str(raw.cultivar),
      colour: str(raw.colour), grade: str(raw.grade), origin: str(raw.origin), imageUrl: str(raw.imageUrl),
      stemLengthCm: raw.stemLengthCm == null ? null : numOf(raw.stemLengthCm),
      stemsPerPack: raw.stemsPerPack === undefined ? 1 : intOf(raw.stemsPerPack),
      packUnit: str(raw.packUnit),
      orderMultiple: raw.orderMultiple === undefined ? 1 : intOf(raw.orderMultiple),
      discontinued: !!raw.discontinued
    };
  }

  function quoteProblems(raw) {
    const p = [];
    if (!raw || typeof raw !== 'object') return ['pris saknas'];
    if (!str(raw.supplierProductId)) p.push('supplierProductId saknas');
    if (raw.packPrice != null && !(numOf(raw.packPrice) > 0)) p.push('packPrice måste vara > 0 eller null (saknas)');
    if (typeof raw.fetchedAt !== 'string' || isNaN(Date.parse(raw.fetchedAt))) p.push('fetchedAt måste vara en tidpunkt (ISO 8601)');
    if (!STRATEGIES.includes(raw.strategy)) p.push('strategy måste vara en av ' + STRATEGIES.join(', '));
    if (raw.currency !== undefined && !/^[A-Z]{3}$/.test(raw.currency)) p.push('currency måste vara en valutakod, till exempel SEK');
    if (raw.availability !== undefined && !AVAILABILITY.includes(raw.availability)) p.push('availability måste vara en av ' + AVAILABILITY.join(', '));
    if (raw.forDeliveryDate != null && !/^\d{4}-\d{2}-\d{2}$/.test(raw.forDeliveryDate)) p.push('forDeliveryDate måste vara ÅÅÅÅ-MM-DD');
    if (raw.priceIncludesVat != null && typeof raw.priceIncludesVat !== 'boolean') p.push('priceIncludesVat måste vara true, false eller utelämnas (okänt)');
    if (raw.verification !== undefined && !VERIFICATION.includes(raw.verification)) p.push('verification måste vara en av ' + VERIFICATION.join(', '));
    if (raw.priceTiers !== undefined) {
      if (!Array.isArray(raw.priceTiers) || raw.priceTiers.some(t => !(intOf(t && t.minQty) >= 1) || !(numOf(t && t.packPrice) > 0))) p.push('priceTiers: varje rad behöver minQty ≥ 1 och packPrice > 0');
    }
    return p;
  }
  function normalizeQuote(raw) {
    const problems = quoteProblems(raw);
    if (problems.length) throw new ModelValidationError(problems);
    return {
      supplierProductId: str(raw.supplierProductId),
      packPrice: raw.packPrice == null ? null : numOf(raw.packPrice),
      currency: raw.currency || 'SEK',
      priceIncludesVat: raw.priceIncludesVat == null ? null : raw.priceIncludesVat, // okänt är okänt, aldrig "utan moms"
      priceTiers: (raw.priceTiers || []).map(t => ({ minQty: intOf(t.minQty), packPrice: numOf(t.packPrice) })),
      availability: raw.availability || 'unknown',
      forDeliveryDate: raw.forDeliveryDate || null,
      fetchedAt: new Date(raw.fetchedAt).toISOString(),
      strategy: raw.strategy,
      verification: raw.verification || (raw.strategy === 'vision' ? 'ai_read' : raw.strategy === 'manual' ? 'manual' : 'live')
    };
  }

  // ---------- tillståndets form ----------
  function manualConnection(now) {
    return { id: MANUAL, supplierId: 'manual', authKind: 'manual', status: 'connected', createdAt: now || null };
  }
  function ensureManual(st) {
    if (!st.connections.some(c => c.id === MANUAL)) st.connections.unshift(manualConnection());
    return st.connections.find(c => c.id === MANUAL);
  }
  function takenIds(st) {
    const t = new Set(st.products.map(p => p.id));
    Object.keys(st.labels).forEach(k => t.add(k));
    st.order.buketter.forEach(b => Object.keys(b.items).forEach(k => t.add(k)));
    Object.keys(st.order.hemma || {}).forEach(k => t.add(k));
    (st.recipes || []).forEach(r => Object.keys(r.items).forEach(k => t.add(k)));
    return t;
  }
  /** Ett id som finns i ordern/etiketterna men inte längre i listan ("spökrad"), vars namn är detsamma. */
  function ghostIdFor(st, nameKey, reserved) {
    const live = new Set(st.products.map(p => p.id));
    for (const id of takenIds(st)) {
      if (live.has(id) || (reserved && reserved.has(id))) continue;
      if (st.labels[id] !== undefined && keyOf(st.labels[id]) === nameKey) return id;
    }
    return null;
  }

  // ---------- migrering v1 → v2 ----------
  function migrateV1toV2(v1, opts) {
    opts = opts || {};
    const now = opts.now || new Date().toISOString();
    const src = clone(v1) || {};
    const items = (src.priceList && Array.isArray(src.priceList.items)) ? src.priceList.items : [];
    const labelsV1 = (src.labels && typeof src.labels === 'object') ? src.labels : {};
    const taken = new Set();
    const products = [], supplierProducts = [], matches = [], quotes = [];
    const keyToId = {};

    for (const it of items) {
      const id = uniqueId('fp_', slug(it.namn), taken);
      keyToId[keyOf(it.namn)] = id;                       // som indexList(): den senaste med samma namn vinner
      products.push({ id, name: it.namn, category: it.kategori, color: it.farg || '' });
      supplierProducts.push({ connectionId: MANUAL, supplierProductId: id, name: it.namn, category: it.kategori, stemsPerPack: it.paket, packUnit: it.enhet });
      matches.push({ id: 'm_' + id, productId: id, connectionId: MANUAL, supplierProductId: id, status: 'confirmed', method: 'manual', confidence: 1, confirmedAt: null });
      if (+it.pris > 0 || it.uppd) {
        quotes.push({ id: 'q_' + id, connectionId: MANUAL, supplierProductId: id, packPrice: +it.pris > 0 ? it.pris : null, currency: 'SEK',
          priceIncludesVat: false, priceTiers: [], availability: 'unknown', forDeliveryDate: null, fetchedAt: null, verifiedOn: it.uppd || '', strategy: 'manual', verification: 'manual' });
      }
    }

    const labels = {};
    for (const it of items) { const k = keyOf(it.namn); if (labelsV1[k] !== undefined) labels[keyToId[k]] = labelsV1[k]; }
    // en nyckel som inte finns i listan (varan är borttagen) får ändå ett id, så att ordern behåller sin rad
    const idOfKey = key => {
      if (keyToId[key] !== undefined) return keyToId[key];
      const id = uniqueId('fp_', slug(labelsV1[key] !== undefined ? labelsV1[key] : key), taken);
      keyToId[key] = id;
      labels[id] = labelsV1[key] !== undefined ? labelsV1[key] : key;
      return id;
    };
    const mapItems = o => {
      const out = {};
      for (const [k, n] of Object.entries(o || {})) { const id = idOfKey(k); out[id] = (out[id] || 0) + n; }
      return out;
    };
    const ord = src.order || {};
    const buketter = (Array.isArray(ord.buketter) && ord.buketter.length ? ord.buketter : [{ id: 'b1', size: 'medel', qty: 1, items: {} }])
      .map(b => ({ ...b, items: mapItems(b.items) }));
    const order = { ...ord, buketter, hemma: mapItems(ord.hemma), active: ord.active || buketter[0].id, seq: ord.seq || buketter.length };
    const recipes = (Array.isArray(src.recipes) ? src.recipes : []).map(r => ({ ...r, items: mapItems(r.items) }));

    return {
      v: 2, migratedFromV1At: now,
      products, connections: [manualConnection(now)], supplierProducts, quotes, matches,
      priceListMeta: (src.priceList && src.priceList.meta) || { namn: 'Min prislista', datum: '', kalla: 'egen' },
      settings: src.settings || {}, labels, wholesaler: src.wholesaler || {}, order, recipes
    };
  }

  // ---------- vy i det gamla formatet: det som räknemotorn och skärmarna läser ----------
  function lastQuotes(st) {
    const m = new Map();
    for (const q of st.quotes) m.set(q.connectionId + '|' + q.supplierProductId, q);
    return m;
  }
  function viewOf(st) {
    const spMap = new Map(st.supplierProducts.map(s => [s.connectionId + '|' + s.supplierProductId, s]));
    const lq = lastQuotes(st);
    const conn = new Map(st.connections.map((c, i) => [c.id, { c, i }]));
    const byProduct = new Map();
    for (const m of st.matches) {
      if (m.status !== 'confirmed') continue;
      if (!byProduct.has(m.productId)) byProduct.set(m.productId, []);
      byProduct.get(m.productId).push(m);
    }
    const items = st.products.map(p => {
      const cands = (byProduct.get(p.id) || [])
        .filter(m => conn.has(m.connectionId) && conn.get(m.connectionId).c.status !== 'disconnected')
        .sort((a, b) => (a.connectionId === MANUAL) - (b.connectionId === MANUAL) || conn.get(a.connectionId).i - conn.get(b.connectionId).i);
      const resolve = m => {
        const key = m.connectionId + '|' + m.supplierProductId;
        return { m, sp: spMap.get(key), q: lq.get(key) };
      };
      const all = cands.map(resolve);
      // 1) första anslutna grossist med ett riktigt pris på en produkt som finns kvar
      let pick = all.find(x => x.m.connectionId !== MANUAL && x.sp && !x.sp.discontinued && x.q && x.q.packPrice > 0);
      // 2) annars den egna listan, 3) annars det första som finns
      if (!pick) pick = all.find(x => x.m.connectionId === MANUAL) || all.find(x => x.sp && !x.sp.discontinued) || all[0];
      const sp = pick && pick.sp, q = pick && pick.q;
      const out = {
        id: p.id, namn: p.name, kategori: p.category,
        enhet: sp ? sp.packUnit : '', paket: sp ? sp.stemsPerPack : 1,
        pris: q && q.packPrice > 0 ? q.packPrice : 0, farg: p.color || ''
      };
      if (q && q.verifiedOn) out.uppd = q.verifiedOn;
      return out;
    });
    return { v: 1, priceList: { meta: st.priceListMeta, items }, settings: st.settings, labels: st.labels, wholesaler: st.wholesaler, order: st.order, recipes: st.recipes };
  }

  // ---------- rollback v2 → v1 ----------
  function downgradeV2toV1(st) {
    const view = viewOf(st);
    const byId = new Map(st.products.map(p => [p.id, p]));
    const idToKey = id => {
      const p = byId.get(id);
      if (p) return keyOf(p.name);
      return keyOf(st.labels[id] !== undefined ? st.labels[id] : id);
    };
    const mapItems = o => {
      const out = {};
      for (const [id, n] of Object.entries(o || {})) { const k = idToKey(id); out[k] = (out[k] || 0) + n; }
      return out;
    };
    const labels = {};
    for (const [id, label] of Object.entries(st.labels || {})) labels[idToKey(id)] = label;
    return clone({
      v: 1,
      priceList: { meta: st.priceListMeta, items: view.priceList.items.map(({ id, ...rest }) => rest) },
      settings: st.settings, labels, wholesaler: st.wholesaler,
      order: { ...st.order, buketter: st.order.buketter.map(b => ({ ...b, items: mapItems(b.items) })), hemma: mapItems(st.order.hemma) },
      recipes: (st.recipes || []).map(r => ({ ...r, items: mapItems(r.items) }))
    });
  }

  // ---------- läsa in ett sparat v2-tillstånd ----------
  function loadV2(raw) {
    let st;
    try { st = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch (e) { return null; }
    if (!st || typeof st !== 'object' || st.v !== 2 || !Array.isArray(st.products)) return null;
    if (!st.order || !Array.isArray(st.order.buketter) || !st.order.buketter.length) return null;
    if (st.products.some(p => !p || typeof p.id !== 'string' || typeof p.name !== 'string')) return null;
    st.connections = Array.isArray(st.connections) ? st.connections : [];
    st.supplierProducts = Array.isArray(st.supplierProducts) ? st.supplierProducts : [];
    st.quotes = Array.isArray(st.quotes) ? st.quotes : [];
    st.matches = Array.isArray(st.matches) ? st.matches : [];
    st.labels = st.labels && typeof st.labels === 'object' ? st.labels : {};
    st.recipes = Array.isArray(st.recipes) ? st.recipes : [];
    st.order.hemma = st.order.hemma || {};
    st.priceListMeta = st.priceListMeta || { namn: 'Min prislista', datum: '', kalla: 'egen' };
    st.settings = st.settings || {};
    st.wholesaler = st.wholesaler || {};
    ensureManual(st);
    return st;
  }

  // ---------- skriv-API: allt som appen ändrar går via de här ----------
  function manualSp(st, id) {
    let sp = st.supplierProducts.find(s => s.connectionId === MANUAL && s.supplierProductId === id);
    if (!sp) {
      const p = st.products.find(x => x.id === id);
      sp = { connectionId: MANUAL, supplierProductId: id, name: p ? p.name : id, category: p ? p.category : '', stemsPerPack: 1, packUnit: '' };
      st.supplierProducts.push(sp);
    }
    if (!st.matches.some(m => m.productId === id && m.connectionId === MANUAL && m.status === 'confirmed')) {
      st.matches.push({ id: 'm_' + id, productId: id, connectionId: MANUAL, supplierProductId: id, status: 'confirmed', method: 'manual', confidence: 1, confirmedAt: null });
    }
    return sp;
  }
  function appendQuote(st, q) {
    const same = x => x.connectionId === q.connectionId && x.supplierProductId === q.supplierProductId;
    let last = -1;
    for (let i = st.quotes.length - 1; i >= 0; i--) if (same(st.quotes[i])) { last = i; break; }
    if (last >= 0 && q.verifiedOn && st.quotes[last].verifiedOn === q.verifiedOn) st.quotes[last] = { ...q, id: st.quotes[last].id };
    else st.quotes.push({ id: 'q_' + rand(10), ...q });
    const idx = [];
    st.quotes.forEach((x, i) => { if (same(x)) idx.push(i); });
    if (idx.length > MAX_QUOTES_PER_PRODUCT) {
      const drop = new Set(idx.slice(0, idx.length - MAX_QUOTES_PER_PRODUCT));
      st.quotes = st.quotes.filter((x, i) => !drop.has(i));
    }
  }
  const lastQuoteOf = (st, conn, spId) => { for (let i = st.quotes.length - 1; i >= 0; i--) { const q = st.quotes[i]; if (q.connectionId === conn && q.supplierProductId === spId) return q; } return null; };

  function addProduct(st, p, opts) {
    opts = opts || {};
    const name = String(p.name);
    const ghost = ghostIdFor(st, keyOf(name));
    const id = ghost || uniqueId('fp_', slug(name), takenIds(st));
    st.products.push({ id, name, category: p.category === undefined ? 'Blommor' : p.category, color: p.color || '' });
    st.labels[id] = name;
    const sp = manualSp(st, id);
    sp.name = name; sp.category = st.products[st.products.length - 1].category;
    sp.stemsPerPack = p.paket === undefined ? 1 : p.paket;
    sp.packUnit = p.enhet === undefined ? '' : p.enhet;
    if (+p.pris > 0 || p.uppd) {
      appendQuote(st, { connectionId: MANUAL, supplierProductId: id, packPrice: +p.pris > 0 ? p.pris : null, currency: 'SEK', priceIncludesVat: false, priceTiers: [],
        availability: 'unknown', forDeliveryDate: null, fetchedAt: opts.now || null, verifiedOn: p.uppd || '', strategy: 'manual', verification: 'manual' });
    }
    return id;
  }
  function renameProduct(st, id, name) {
    const p = st.products.find(x => x.id === id); if (!p) return;
    p.name = name; st.labels[id] = name;
    const sp = st.supplierProducts.find(s => s.connectionId === MANUAL && s.supplierProductId === id); if (sp) sp.name = name;
  }
  function setCategory(st, id, category) {
    const p = st.products.find(x => x.id === id); if (!p) return;
    p.category = category;
    const sp = st.supplierProducts.find(s => s.connectionId === MANUAL && s.supplierProductId === id); if (sp) sp.category = category;
  }
  /** Att skriva pris, förpackning eller enhet för hand (eller läsa in dem) märker alltid varan som verifierad den dagen. */
  function setManualPrice(st, id, f, opts) {
    opts = opts || {};
    const sp = manualSp(st, id);
    if (f.paket !== undefined) sp.stemsPerPack = f.paket;
    if (f.enhet !== undefined) sp.packUnit = f.enhet;
    const prev = lastQuoteOf(st, MANUAL, id);
    const packPrice = f.pris !== undefined ? (+f.pris > 0 ? f.pris : null) : (prev ? prev.packPrice : null);
    appendQuote(st, { connectionId: MANUAL, supplierProductId: id, packPrice, currency: 'SEK', priceIncludesVat: false, priceTiers: [], availability: 'unknown',
      forDeliveryDate: null, fetchedAt: opts.now || null, verifiedOn: opts.today || '', strategy: opts.strategy || 'manual', verification: opts.verification || 'manual' });
  }
  function dropManual(st, id) {
    st.supplierProducts = st.supplierProducts.filter(s => !(s.connectionId === MANUAL && s.supplierProductId === id));
    st.quotes = st.quotes.filter(q => !(q.connectionId === MANUAL && q.supplierProductId === id));
    st.matches = st.matches.filter(m => m.productId !== id);
  }
  function removeProduct(st, id) {
    st.products = st.products.filter(p => p.id !== id);
    dropManual(st, id);                       // etiketten och orderns rad finns kvar: varan visas som "finns inte i prislistan"
  }
  function replaceFromImport(st, items, opts) {
    opts = opts || {};
    const byKey = new Map();
    st.products.forEach(p => { const k = keyOf(p.name); if (!byKey.has(k)) byKey.set(k, []); byKey.get(k).push(p.id); });
    const reserved = new Set();
    const taken = takenIds(st);
    const next = [];
    for (const it of items) {
      const k = keyOf(it.namn);
      const cand = byKey.get(k);
      let id = cand && cand.length ? cand.shift() : ghostIdFor(st, k, reserved);
      if (!id) id = uniqueId('fp_', slug(it.namn), taken);
      reserved.add(id);
      next.push({ id, it });
    }
    const keep = new Set(next.map(x => x.id));
    st.products.filter(p => !keep.has(p.id)).forEach(p => dropManual(st, p.id));
    st.products = next.map(({ id, it }) => ({ id, name: it.namn, category: it.kategori, color: it.farg || '' }));
    for (const { id, it } of next) {
      st.labels[id] = it.namn;
      const sp = manualSp(st, id);
      sp.name = it.namn; sp.category = it.kategori; sp.stemsPerPack = it.paket; sp.packUnit = it.enhet;
      appendQuote(st, { connectionId: MANUAL, supplierProductId: id, packPrice: +it.pris > 0 ? it.pris : null, currency: 'SEK', priceIncludesVat: false, priceTiers: [],
        availability: 'unknown', forDeliveryDate: null, fetchedAt: opts.now || null, verifiedOn: opts.today || '', strategy: 'manual', verification: 'manual' });
    }
    st.priceListMeta = { namn: opts.name, datum: opts.today, kalla: 'import' };
  }

  // ---------- anslutningar och matchning ----------
  function upsertConnection(st, c) {
    if (c.status !== undefined && !CONNECTION_STATUS.includes(c.status)) throw new Error('okänd status: ' + c.status);
    const ex = st.connections.find(x => x.id === c.id);
    if (ex) Object.assign(ex, c); else st.connections.push({ createdAt: null, status: 'connected', ...c });
    return st.connections.find(x => x.id === c.id);
  }
  function setConnectionStatus(st, id, status) {
    if (!CONNECTION_STATUS.includes(status)) throw new Error('okänd status: ' + status);
    const c = st.connections.find(x => x.id === id);
    if (!c) throw new Error('okänd anslutning: ' + id);
    c.status = status;
  }
  const spOf = (st, conn, spId) => st.supplierProducts.find(s => s.connectionId === conn && s.supplierProductId === spId);
  function getConfirmedMatch(st, productId, connectionId) {
    return st.matches.find(m => m.productId === productId && m.connectionId === connectionId && m.status === 'confirmed') || null;
  }
  /** Behövs en (ny) matchning? Nej om en bekräftad koppling finns och leverantörens produkt finns kvar. Då körs ingen matchning om. */
  function needsMatching(st, productId, connectionId) {
    const m = getConfirmedMatch(st, productId, connectionId);
    if (!m) return true;
    const sp = spOf(st, connectionId, m.supplierProductId);
    return !sp || !!sp.discontinued;
  }
  function confirmMatch(st, m) {
    if (!spOf(st, m.connectionId, m.supplierProductId)) throw new Error('okänd leverantörsprodukt: ' + m.supplierProductId);
    st.matches = st.matches.filter(x => !(x.productId === m.productId && x.connectionId === m.connectionId &&
      (x.status === 'confirmed' || (x.status === 'rejected' && x.supplierProductId === m.supplierProductId))));
    const rec = { id: 'm_' + rand(10), productId: m.productId, connectionId: m.connectionId, supplierProductId: m.supplierProductId, status: 'confirmed',
      method: m.method || 'user_picked', confidence: m.confidence === undefined ? 1 : m.confidence, confirmedAt: m.now || null };
    st.matches.push(rec);
    return rec;
  }
  function rejectMatch(st, m) {
    st.matches = st.matches.filter(x => !(x.productId === m.productId && x.connectionId === m.connectionId && x.supplierProductId === m.supplierProductId));
    st.matches.push({ id: 'm_' + rand(10), productId: m.productId, connectionId: m.connectionId, supplierProductId: m.supplierProductId, status: 'rejected', method: 'user_picked', confidence: 0, confirmedAt: null });
  }
  const rejectedFor = (st, productId, connectionId) => st.matches.filter(m => m.productId === productId && m.connectionId === connectionId && m.status === 'rejected').map(m => m.supplierProductId);

  /** Tar emot det en grossist levererar (redan i gemensamt format). Allt eller inget: ogiltig data sparar ingenting. */
  function ingestSupplierData(st, connectionId, data, opts) {
    opts = opts || {};
    if (!st.connections.some(c => c.id === connectionId)) throw new Error('okänd anslutning: ' + connectionId);
    const problems = [], products = [], quotes = [];
    (data.products || []).forEach((raw, i) => { try { products.push(normalizeSupplierProduct(raw)); } catch (e) { problems.push(...(e.problems || [e.message]).map(p => `produkt ${i + 1}: ${p}`)); } });
    (data.quotes || []).forEach((raw, i) => { try { quotes.push(normalizeQuote(raw)); } catch (e) { problems.push(...(e.problems || [e.message]).map(p => `pris ${i + 1}: ${p}`)); } });
    const known = new Set([...products.map(p => p.supplierProductId), ...st.supplierProducts.filter(s => s.connectionId === connectionId).map(s => s.supplierProductId)]);
    quotes.forEach((q, i) => { if (!known.has(q.supplierProductId)) problems.push(`pris ${i + 1}: okänd produkt ${q.supplierProductId}`); });
    if (problems.length) throw new ModelValidationError(problems);

    const now = opts.now || null;
    const seen = new Set();
    for (const p of products) {
      seen.add(p.supplierProductId);
      const ex = spOf(st, connectionId, p.supplierProductId);
      const rec = { connectionId, ...p, discontinued: false, lastSeenAt: now };
      if (ex) Object.assign(ex, rec); else st.supplierProducts.push({ firstSeenAt: now, ...rec });
    }
    if (opts.complete) st.supplierProducts.forEach(s => { if (s.connectionId === connectionId && !seen.has(s.supplierProductId)) s.discontinued = true; });
    for (const q of quotes) appendQuote(st, { connectionId, ...q, verifiedOn: opts.today || localDate(q.fetchedAt) });
  }

  return {
    MANUAL_CONNECTION_ID: MANUAL, MAX_QUOTES_PER_PRODUCT, STRATEGIES, AVAILABILITY, VERIFICATION, CONNECTION_STATUS,
    ModelValidationError, normalizeSupplierProduct, normalizeQuote,
    migrateV1toV2, downgradeV2toV1, loadV2, viewOf,
    addProduct, renameProduct, setCategory, setManualPrice, removeProduct, replaceFromImport,
    upsertConnection, setConnectionStatus, ingestSupplierData,
    getConfirmedMatch, needsMatching, confirmMatch, rejectMatch, rejectedFor,
    keyOf
  };
});
