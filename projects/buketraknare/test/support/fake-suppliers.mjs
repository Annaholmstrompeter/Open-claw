// Två falska grossister med helt olika dataformat. De visar att båda kan översättas till samma gemensamma format,
// och används av kontraktssviten och av testerna som visar att en andra grossist inte kräver ändringar någon annanstans.
import { ConnectorError, createReadOnlyHttp, requireShape } from '../../src/suppliers/contract.js';

const res = (status, body, headers = {}) => {
  const text = typeof body === 'string' ? body : JSON.stringify(body);
  return { status, headers: { get: k => headers[k.toLowerCase()] ?? null }, json: async () => JSON.parse(text), text: async () => text };
};

/** En liten falsk webbserver. Reglagen simulerar vanliga problem: utgången inloggning, spärr, driftstopp och ändrad sida. */
export function makeBackend(route) {
  const ctl = { expired: false, limitedSeconds: null, down: false, garbled: false };
  const requests = [];
  const fetchImpl = async (url, init) => {
    requests.push({ method: init && init.method, url: String(url) });
    if (ctl.down) return res(503, 'Underhåll');
    if (ctl.limitedSeconds != null) return res(429, 'För många anrop', { 'retry-after': String(ctl.limitedSeconds) });
    const u = new URL(url);
    const out = route(u, init || {}, ctl);
    if (out === 'auth' || ctl.expired) return res(401, 'Inte inloggad');
    if (out === undefined) return res(404, 'Finns inte');
    return ctl.garbled ? res(200, '<html><body>Vi har ändrat sidan</body></html>') : res(200, out);
  };
  return { ctl, requests, fetchImpl };
}

const rank = name => String(name).toLowerCase();

// ---------- A: personlig prisfil (JSON-feed på svenska), SEK per förpackning exklusive moms ----------
const FEED_A = {
  generated: '2026-10-07T05:00:00Z',
  items: [
    { artnr: 'A-100', benamning: 'Avalanche White 50 cm', sort: 'Avalanche', art: 'Rosa', farg: 'vit', langd_cm: 50, klass: 'A1', stjalkar_per_forp: 10, enhet: 'pack', pris_per_forp_sek: 129, moms_inkl: false, lager: 'ja' },
    { artnr: 'A-200', benamning: 'Freedom Red 60 cm', art: 'Rosa', farg: 'röd', langd_cm: 60, klass: 'A1', stjalkar_per_forp: 10, enhet: 'pack', pris_per_forp_sek: 149, moms_inkl: false, lager: 'lite' },
    { artnr: 'A-300', benamning: 'Tulpan Strong Gold', art: 'Tulipa', farg: 'gul', stjalkar_per_forp: 10, enhet: 'bunt', pris_per_forp_sek: 55, moms_inkl: false, lager: 'slut' }
  ]
};
const A_AVAIL = { ja: 'in_stock', lite: 'low', slut: 'sold_out' };

export function createBackendA() {
  return makeBackend((u) => (u.hostname === 'feed.a.example' && u.pathname === '/prices.json' ? (u.searchParams.get('token') === 'GOD' ? FEED_A : 'auth') : undefined));
}
export function createFakeA({ http }) {
  const feed = async conn => requireShape(await http.getJson(conn.credentials.feedUrl), ['generated', 'items'], 'feeden');
  const product = r => {
    requireShape(r, ['artnr', 'benamning', 'stjalkar_per_forp'], 'feedrad');
    return { supplierProductId: r.artnr, name: r.benamning, genus: r.art, cultivar: r.sort, colour: r.farg, stemLengthCm: r.langd_cm, grade: r.klass, stemsPerPack: r.stjalkar_per_forp, packUnit: r.enhet, category: 'Blommor' };
  };
  return {
    id: 'fake-a', displayName: 'Feed-grossisten',
    capabilities: { authKinds: ['feedUrl'], strategies: ['feed'], searchCatalog: true, bulkPrices: true, availabilityByDate: false },
    async startConnect() { return { kind: 'feedUrlForm', fields: ['feedUrl'] }; },
    async completeConnect({ feedUrl }) { const conn = { credentials: { feedUrl } }; await feed(conn); return { authKind: 'feedUrl', credentials: conn.credentials }; },
    async status(conn) {
      if (!conn || !conn.credentials) return { status: 'disconnected', lastVerifiedAt: null };
      try { const f = await feed(conn); return { status: 'connected', lastVerifiedAt: new Date(f.generated).toISOString() }; }
      catch (e) { if (e.code === 'AUTH_EXPIRED') return { status: 'needsReauth', lastVerifiedAt: null }; if (e.code === 'UNAVAILABLE' || e.code === 'RATE_LIMITED') return { status: 'degraded', lastVerifiedAt: null }; throw e; }
    },
    async disconnect() {},
    async searchProducts(conn, query, { limit = 20, cursor } = {}) {
      const all = (await feed(conn)).items.filter(r => !query || rank(r.benamning).includes(rank(query)));
      const from = Number(cursor || 0);
      const items = all.slice(from, from + limit).map(product);
      return { items, nextCursor: from + limit < all.length ? String(from + limit) : null };
    },
    async getProducts(conn, ids) { return (await feed(conn)).items.filter(r => ids.includes(r.artnr)).map(product); },
    async getPrices(conn, ids) {
      const f = await feed(conn);
      return f.items.filter(r => ids.includes(r.artnr)).map(r => {
        requireShape(r, ['pris_per_forp_sek', 'moms_inkl'], 'feedrad');
        return { supplierProductId: r.artnr, packPrice: r.pris_per_forp_sek, currency: 'SEK', priceIncludesVat: r.moms_inkl, availability: A_AVAIL[r.lager] || 'unknown', fetchedAt: new Date(f.generated).toISOString(), strategy: 'feed' };
      });
    }
  };
}

// ---------- B: officiellt API (OAuth, engelska fält), euro per stjälk i cent ----------
const API_B = [
  { id: 'B-1', title: 'Rose Avalanche White 50cm', genus: 'Rosa', cultivar: 'Avalanche', colour: 'white', stem_length: 50, grade: 'A1', stems_per_bunch: 10, unit: 'bunch', origin: 'EC', price: { amount_cents: 119, currency: 'EUR', per: 'stem', vat_included: false }, stock: { status: 'IN_STOCK' } },
  { id: 'B-2', title: 'Rose Freedom Red 60cm', genus: 'Rosa', colour: 'red', stem_length: 60, grade: 'A1', stems_per_bunch: 10, unit: 'bunch', price: { amount_cents: 145, currency: 'EUR', per: 'stem', vat_included: false }, stock: { status: 'LOW' } },
  { id: 'B-3', title: 'Tulip Strong Gold', genus: 'Tulipa', colour: 'yellow', stems_per_bunch: 10, unit: 'bunch', price: { amount_cents: 4500, currency: 'EUR', per: 'bunch', vat_included: true }, stock: { status: 'OUT' } }
];
const B_AVAIL = { IN_STOCK: 'in_stock', LOW: 'low', OUT: 'sold_out' };

export function createBackendB() {
  return makeBackend((u, init) => {
    if (u.hostname !== 'api.b.example') return undefined;
    if (u.pathname === '/oauth/token') return u.searchParams.get('code') === 'KOD' ? { access_token: 'tok-1' } : 'auth';
    if (!init.headers || init.headers.authorization !== 'Bearer tok-1') return 'auth';
    if (u.pathname === '/v2/products') {
      const ids = u.searchParams.get('ids'), q = u.searchParams.get('q');
      let rows = API_B;
      if (ids) rows = rows.filter(r => ids.split(',').includes(r.id));
      if (q) rows = rows.filter(r => rank(r.title).includes(rank(q)));
      const from = Number(u.searchParams.get('cursor') || 0), limit = Number(u.searchParams.get('limit') || 20);
      return { data: rows.slice(from, from + limit), next: from + limit < rows.length ? String(from + limit) : null };
    }
    if (u.pathname === '/v2/prices') {
      const ids = (u.searchParams.get('ids') || '').split(',');
      return { as_of: '2026-10-07T06:30:00Z', data: API_B.filter(r => ids.includes(r.id)).map(r => ({ id: r.id, price: r.price, stock: r.stock, stems_per_bunch: r.stems_per_bunch })) };
    }
    return undefined;
  });
}
export function createFakeB({ http }) {
  const auth = conn => ({ headers: { authorization: 'Bearer ' + conn.credentials.accessToken } });
  const product = r => {
    requireShape(r, ['id', 'title', 'stems_per_bunch'], 'produkt');
    return { supplierProductId: r.id, name: r.title, genus: r.genus, cultivar: r.cultivar, colour: r.colour, stemLengthCm: r.stem_length, grade: r.grade, origin: r.origin, stemsPerPack: r.stems_per_bunch, packUnit: r.unit === 'bunch' ? 'bunt' : r.unit, category: 'Blommor' };
  };
  const list = async (conn, qs) => requireShape(await http.getJson('https://api.b.example/v2/products?' + qs, auth(conn)), ['data'], 'produktlista');
  return {
    id: 'fake-b', displayName: 'API-grossisten',
    capabilities: { authKinds: ['oauth'], strategies: ['api'], searchCatalog: true, bulkPrices: true, availabilityByDate: true },
    async startConnect() { return { kind: 'redirect', url: 'https://api.b.example/oauth/authorize?client_id=buketraknare' }; },
    async completeConnect({ code }) {
      const t = requireShape(await http.getJson('https://api.b.example/oauth/token?code=' + encodeURIComponent(code)), ['access_token'], 'token');
      return { authKind: 'oauth', credentials: { accessToken: t.access_token } };
    },
    async status(conn) {
      if (!conn || !conn.credentials) return { status: 'disconnected', lastVerifiedAt: null };
      try { await list(conn, 'limit=1'); return { status: 'connected', lastVerifiedAt: '2026-10-07T06:30:00.000Z' }; }
      catch (e) { if (e.code === 'AUTH_EXPIRED') return { status: 'needsReauth', lastVerifiedAt: null }; if (e.code === 'UNAVAILABLE' || e.code === 'RATE_LIMITED') return { status: 'degraded', lastVerifiedAt: null }; throw e; }
    },
    async disconnect() {},
    async searchProducts(conn, query, { limit = 20, cursor } = {}) {
      const r = await list(conn, `q=${encodeURIComponent(query || '')}&limit=${limit}&cursor=${cursor || 0}`);
      return { items: r.data.map(product), nextCursor: r.next || null };
    },
    async getProducts(conn, ids) { return (await list(conn, 'ids=' + ids.join(','))).data.map(product); },
    async getPrices(conn, ids, { deliveryDate } = {}) {
      const r = requireShape(await http.getJson('https://api.b.example/v2/prices?ids=' + ids.join(',') + (deliveryDate ? '&date=' + deliveryDate : ''), auth(conn)), ['as_of', 'data'], 'prislista');
      return r.data.map(p => {
        requireShape(p, ['id', 'price', 'stems_per_bunch'], 'pris');
        const perPack = p.price.per === 'stem' ? (p.price.amount_cents / 100) * p.stems_per_bunch : p.price.amount_cents / 100;
        return { supplierProductId: p.id, packPrice: Math.round(perPack * 100) / 100, currency: p.price.currency, priceIncludesVat: p.price.vat_included, availability: B_AVAIL[p.stock && p.stock.status] || 'unknown',
          forDeliveryDate: deliveryDate || null, fetchedAt: new Date(r.as_of).toISOString(), strategy: 'api' };
      });
    }
  };
}

/** Bygger en adapter med en skrivskyddad HTTP-hjälpare mot en falsk server. */
export function makeSupplier(factory, backend, allowHosts) {
  const rejected = [];
  const http = createReadOnlyHttp({ allowHosts, fetchImpl: backend.fetchImpl });
  const guarded = {
    getJson: (u, o) => http.getJson(u, o).catch(e => { if (e.code === 'UNSUPPORTED') rejected.push(String(u)); throw e; }),
    getText: (u, o) => http.getText(u, o).catch(e => { if (e.code === 'UNSUPPORTED') rejected.push(String(u)); throw e; })
  };
  return { connector: factory({ http: guarded }), backend, http: guarded, rejected };
}
export const FAKES = {
  a: { label: 'fake-a (personlig prisfil, SEK)', make: () => makeSupplier(createFakeA, createBackendA(), ['feed.a.example']), connect: { feedUrl: 'https://feed.a.example/prices.json?token=GOD' }, bad: { feedUrl: 'https://feed.a.example/prices.json?token=FEL' }, ids: ['A-100', 'A-200'], unknown: 'Z-9', query: 'red', queryHits: 1 },
  b: { label: 'fake-b (API med OAuth, EUR)', make: () => makeSupplier(createFakeB, createBackendB(), ['api.b.example']), connect: { code: 'KOD' }, bad: { code: 'FEL' }, ids: ['B-1', 'B-2'], unknown: 'Z-9', query: 'red', queryHits: 1 }
};
export { ConnectorError };
