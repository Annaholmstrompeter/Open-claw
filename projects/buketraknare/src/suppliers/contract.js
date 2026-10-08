// Gränssnittet som varje grossistadapter uppfyller. Resten av appen känner bara till det här och till det gemensamma
// dataformatet (public/js/core/model.js), aldrig till en enskild grossist.
//
// En adapter är ett objekt med:
//   id, displayName, capabilities
//   startConnect(input)            -> { kind: 'redirect' | 'liveView' | 'feedUrlForm', ... }  hur floristen ansluter
//   completeConnect(payload)       -> { authKind, credentials }   credentials är hemliga och hör hemma i valvet, aldrig i modellen
//   status(conn)                   -> { status: 'connected' | 'needsReauth' | 'degraded' | 'disconnected', lastVerifiedAt }
//   disconnect(conn)               -> void
//   searchProducts(conn, query, { limit, cursor }) -> { items: SupplierProduct[], nextCursor: string | null }
//   getProducts(conn, ids)         -> SupplierProduct[]       okända id:n utelämnas
//   getPrices(conn, ids, { deliveryDate }) -> PriceQuote[]    okända id:n utelämnas
//
// "conn" är { credentials }. Adaptern får bara göra LÄSANDE anrop: den får en HTTP-hjälpare som saknar post/put/delete
// och som bara når grossistens egna domäner. Det går därför inte att lägga en beställning av misstag.
import Model from '../../public/js/core/model.js';

export const AUTH_KINDS = ['oauth', 'feedUrl', 'remoteBrowser', 'manual'];
export const CONNECT_KINDS = ['redirect', 'liveView', 'feedUrlForm'];
export const ERROR_CODES = ['AUTH_EXPIRED', 'MFA_REQUIRED', 'CAPTCHA', 'RATE_LIMITED', 'SITE_CHANGED', 'NOT_FOUND', 'UNAVAILABLE', 'UNSUPPORTED'];
const METHODS = ['startConnect', 'completeConnect', 'status', 'disconnect', 'searchProducts', 'getProducts', 'getPrices'];

/** MFA_REQUIRED och CAPTCHA betyder alltid "be floristen göra det själv". Vi försöker aldrig komma runt dem. */
export class ConnectorError extends Error {
  constructor(code, message, { retryAfterMs, cause } = {}) {
    if (!ERROR_CODES.includes(code)) throw new Error('okänd felkod: ' + code);
    super(message || code);
    this.name = 'ConnectorError';
    this.code = code;
    if (retryAfterMs !== undefined) this.retryAfterMs = retryAfterMs;
    if (cause) this.cause = cause;
  }
}

export function assertConnector(c) {
  const problems = [];
  if (!c || typeof c !== 'object') throw new Error('adaptern saknas');
  if (!/^[a-z][a-z0-9-]*$/.test(c.id || '')) problems.push('id måste vara gemener, siffror och bindestreck');
  if (!c.displayName || typeof c.displayName !== 'string') problems.push('displayName saknas');
  const cap = c.capabilities || {};
  if (!Array.isArray(cap.authKinds) || !cap.authKinds.length || cap.authKinds.some(k => !AUTH_KINDS.includes(k))) problems.push('capabilities.authKinds måste vara en lista av ' + AUTH_KINDS.join(', '));
  if (!Array.isArray(cap.strategies) || !cap.strategies.length || cap.strategies.some(k => !Model.STRATEGIES.includes(k))) problems.push('capabilities.strategies måste vara en lista av ' + Model.STRATEGIES.join(', '));
  for (const f of ['searchCatalog', 'bulkPrices', 'availabilityByDate']) if (typeof cap[f] !== 'boolean') problems.push(`capabilities.${f} måste vara true eller false`);
  for (const m of METHODS) if (typeof c[m] !== 'function') problems.push(`metoden ${m} saknas`);
  if (problems.length) throw new Error(`Ogiltig adapter "${c && c.id}": ${problems.join('; ')}`);
  return c;
}

/**
 * Den enda sättet en adapter når nätet: bara GET, bara mot tillåtna domäner, och alla fel blir ConnectorError.
 * fetchImpl byts ut i tester. onRequest kan användas för att logga varje anrop.
 */
export function createReadOnlyHttp({ allowHosts, fetchImpl = globalThis.fetch, onRequest = () => {} }) {
  async function get(url, { headers } = {}) {
    const u = new URL(url);
    if (u.protocol !== 'https:') throw new ConnectorError('UNSUPPORTED', 'bara https: ' + u.origin);
    if (!allowHosts.includes(u.hostname)) throw new ConnectorError('UNSUPPORTED', 'domänen är inte tillåten: ' + u.hostname);
    onRequest({ method: 'GET', url: String(url) });
    let res;
    try { res = await fetchImpl(String(url), { method: 'GET', headers }); }
    catch (e) { throw new ConnectorError('UNAVAILABLE', 'nätverksfel', { cause: e }); }
    if (res.status === 401 || res.status === 403) throw new ConnectorError('AUTH_EXPIRED', 'inte inloggad (' + res.status + ')');
    if (res.status === 404) throw new ConnectorError('NOT_FOUND', 'finns inte: ' + u.pathname);
    if (res.status === 429) {
      const ra = Number(res.headers && res.headers.get && res.headers.get('retry-after'));
      throw new ConnectorError('RATE_LIMITED', 'för många anrop', { retryAfterMs: Number.isFinite(ra) && ra > 0 ? ra * 1000 : undefined });
    }
    if (res.status >= 500) throw new ConnectorError('UNAVAILABLE', 'grossisten svarar inte (' + res.status + ')');
    if (res.status < 200 || res.status >= 300) throw new ConnectorError('UNAVAILABLE', 'oväntat svar ' + res.status);
    return res;
  }
  return {
    async getJson(url, opts) {
      const res = await get(url, opts);
      try { return await res.json(); }
      catch (e) { throw new ConnectorError('SITE_CHANGED', 'svaret är inte JSON', { cause: e }); }
    },
    async getText(url, opts) { return (await get(url, opts)).text(); }
  };
}

/** Kontrollerar att ett svar från grossisten har de fält adaptern förväntar sig. Annars har sidan eller API:et ändrats. */
export function requireShape(obj, fields, what) {
  if (!obj || typeof obj !== 'object') throw new ConnectorError('SITE_CHANGED', `${what}: oväntat svar`);
  for (const f of fields) if (obj[f] === undefined) throw new ConnectorError('SITE_CHANGED', `${what}: fältet "${f}" saknas`);
  return obj;
}
