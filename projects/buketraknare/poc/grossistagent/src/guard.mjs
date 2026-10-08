// Skrivskydd för PoC:n. Ren logik utan webbläsare, så att den går att testa på djupet.
//
// Två faser:
//   login  Människan styr webbläsaren och loggar in. Inget nekas (inloggning kräver POST och ibland andra värdar). Agenten gör ingenting.
//   agent  Allt agenten gör går genom skyddet. Standard är NEKA för allt som kan ändra något:
//            1. adress- och sökvägsregler för varukorg, kassa, beställning, utloggning, borttagning (gäller ALLA metoder, även GET)
//            2. bara läsande metoder (GET, HEAD, OPTIONS) släpps igenom. POST, PUT, PATCH och DELETE nekas som standard
//            3. undantag för sådant som visar sig vara läsande sökning: GraphQL-frågor (aldrig "mutation") och mönster som operatören själv
//               godkänt efter att ha sett vad som nekades. Ett mönster kan aldrig upphäva regel 1
//            4. sidan lämnas aldrig: navigering till en värd som inte är godkänd nekas, och även hämtning av data (xhr/fetch) till främmande värdar
//            5. bilder, media och typsnitt hämtas inte (sparar trafik, påverkar inte datan)
//
// Skyddet loggar bara metod, värd, sökväg (utan frågevärden) och orsak. Aldrig rubriker, cookies eller innehåll i anrop.

const SEG = '(?:cart|basket|varukorg|varukorgen|kundvagn|korgen|checkout|kassa|kassan|betala|betalning|pay|payment|payments|order|orders|bestall|bestalla|bestallning|purchase|buy|logout|signout|sign-out|logga-ut|loggaut|delete|remove|ta-bort|unsubscribe)';
export const DENY_PATH_RE = new RegExp('(?:^|[/_.\\-])' + SEG + '(?:$|[/_.\\-?&=#])', 'i');
export const DENY_QUERY_RE = /(?:^|&)(?:add[-_]?to[-_]?(?:cart|basket)|addtocart|add|buy|checkout|remove|delete)(?:=|&|$)|(?:^|&)(?:action|cmd|do|act|task|op)=(?:add|buy|order|checkout|delete|remove|update|submit|purchase|pay)/i;

/** Text som gör att agenten inte får klicka på ett element, hur det än är kopplat. Andra försvarslinjen, bakom nätverksskyddet. */
export const RISKY_TEXT_RE = /(köp|kop(?:a|\b)|lägg[\s_-]*i|lagg[\s_-]*i|varukorg|kundvagn|kassa|beställ|bestall|betala|checkout|add[\s_-]*to|buy\b|place[\s_-]*order|order\b|bekräfta|bekrafta|slutför|slutfor|ta[\s_-]*bort|radera|spara|ändra|andra[\s_-]+uppg|logga[\s_-]*ut|log[\s_-]*out|sign[\s_-]*out|submit|skicka|prenumer|subscribe)/i;

const norm = s => String(s == null ? '' : s).normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase();
const READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const HEAVY = new Set(['image', 'media', 'font']);
const STATIC = new Set(['script', 'stylesheet']);

export function hostMatches(host, pattern) {
  const h = String(host).toLowerCase(), p = String(pattern).toLowerCase();
  if (p.startsWith('*.')) return h.endsWith(p.slice(1)) && h.length > p.length - 1;
  return h === p;
}

/** Sökväg + frågenamn för logg: frågevärden tas bort (de kan innehålla nycklar). */
export function safePath(u) {
  const names = [...new Set([...u.searchParams.keys()])].slice(0, 8);
  const p = u.pathname.length > 120 ? u.pathname.slice(0, 120) + '…' : u.pathname;
  return p + (names.length ? '?' + names.map(n => n + '=…').join('&') : '');
}

const DENY_OPERATION_RE = /(cart|basket|checkout|order|purchase|payment|delete|remove|submit|mutation|logout|signout)/i;

/** Läsande GraphQL: JSON med query-text som inte innehåller mutation. Allt annat nekas. */
export function isReadOnlyGraphql(postData) {
  if (typeof postData !== 'string' || postData.length > 200000) return false;
  let j; try { j = JSON.parse(postData); } catch (e) { return false; }
  const ops = Array.isArray(j) ? j : [j];
  if (!ops.length) return false;
  return ops.every(o => o && typeof o === 'object' && typeof o.query === 'string'
    && /^\s*(?:query\b|\{)/.test(o.query) && !/\bmutation\b/i.test(o.query) && !/\bsubscription\b/i.test(o.query)
    && !(typeof o.operationName === 'string' && DENY_OPERATION_RE.test(norm(o.operationName))));
}

export function createGuard(opts = {}) {
  const hosts = new Set((opts.hosts || []).map(h => String(h).toLowerCase()));
  const allowPost = [];                                   // [{ host, pathRegex(string) }] godkända av operatören
  const audit = [];
  const counts = { total: 0, allowed: 0, blocked: 0 };
  const reasons = {};
  let phase = 'login';
  const cfg = { blockHeavy: opts.blockHeavy !== false, allowThirdPartyStatic: opts.allowThirdPartyStatic !== false, maxAudit: opts.maxAudit || 800 };
  const now = opts.now || (() => new Date().toISOString());

  function record(entry) {
    counts.total++; entry.allow ? counts.allowed++ : counts.blocked++;
    reasons[entry.reason] = (reasons[entry.reason] || 0) + 1;
    if (audit.length >= cfg.maxAudit) audit.shift();
    audit.push({ t: now(), ...entry });
  }

  /** req: { method, url, resourceType, isNavigation, postData } → { allow, reason, entry } */
  function decide(req) {
    let u;
    try { u = new URL(req.url); } catch (e) { return finish(req, null, false, 'ogiltig adress'); }
    if (phase !== 'agent') { counts.total++; counts.allowed++; return { allow: true, reason: 'inloggningsfasen: människan styr' }; }
    const method = String(req.method || 'GET').toUpperCase(), type = req.resourceType || 'other';
    if (u.protocol === 'data:' || u.protocol === 'blob:' || u.protocol === 'about:') return finish(req, u, true, 'lokal data');
    if (u.protocol !== 'http:' && u.protocol !== 'https:' && u.protocol !== 'ws:' && u.protocol !== 'wss:') return finish(req, u, false, 'okänt protokoll');

    // 1. sökvägsregler först, för alla metoder och alla värdar
    const path = norm(decodeURIComponentSafe(u.pathname)), query = norm(decodeURIComponentSafe(u.search.replace(/^\?/, '')));
    if (DENY_PATH_RE.test(path)) return finish(req, u, false, 'varukorg, kassa, beställning eller utloggning (sökväg)');
    if (DENY_QUERY_RE.test(query)) return finish(req, u, false, 'åtgärd i adressen (lägg till, köp, ta bort)');

    // 5. tunga resurser
    if (cfg.blockHeavy && HEAVY.has(type)) return finish(req, u, false, 'bilder, media och typsnitt hämtas inte');

    // 4. värdar
    const hostOk = [...hosts].some(p => hostMatches(u.hostname, p));
    if (!hostOk) {
      if (STATIC.has(type) && cfg.allowThirdPartyStatic && method === 'GET') return finish(req, u, true, 'skript eller stilmall från annan värd (GET)');
      return finish(req, u, false, req.isNavigation || type === 'document' ? 'lämnar den godkända sidan' : 'dataanrop till en värd som inte är godkänd');
    }

    // 2–3. metoder
    if (READ_METHODS.has(method)) return finish(req, u, true, 'läsande metod');
    if (isReadOnlyGraphql(req.postData)) return finish(req, u, true, 'läsande GraphQL-fråga');
    const approved = allowPost.find(a => hostMatches(u.hostname, a.host) && new RegExp(a.pathRegex).test(u.pathname));
    if (approved) return finish(req, u, true, 'godkänt av operatören som läsande sökning');
    return finish(req, u, false, 'skrivande metod (' + method + ') nekas som standard');
  }

  function finish(req, u, allow, reason) {
    const entry = { method: String(req.method || 'GET').toUpperCase(), host: u ? u.hostname : '?', path: u ? safePath(u) : '?', type: req.resourceType || 'other', allow, reason };
    record(entry);
    return { allow, reason, entry };
  }

  return {
    decide,
    get phase() { return phase; },
    setPhase(p) { if (p !== 'login' && p !== 'agent') throw new Error('okänd fas: ' + p); phase = p; },
    addHost(h) { hosts.add(String(h).toLowerCase()); },
    hosts: () => [...hosts],
    /** Operatörens beslut efter att ha sett ett nekat anrop. Ett mönster kan aldrig upphäva sökvägsreglerna. */
    allowPostPattern({ host, pathRegex }) {
      if (typeof host !== 'string' || !host) throw new Error('värd krävs');
      new RegExp(pathRegex);                                                  // kastar om mönstret är ogiltigt
      if (DENY_PATH_RE.test('/' + norm(String(pathRegex).replace(/[\\^$.*+?()[\]{}|]/g, '/'))) ) throw new Error('mönstret liknar varukorg, kassa eller beställning och kan inte godkännas');
      allowPost.push({ host: host.toLowerCase(), pathRegex });
      record({ method: 'POST', host, path: String(pathRegex), type: 'operatör', allow: true, reason: 'OPERATÖRSBESLUT: läsande sökning godkänd' });
    },
    approvedPosts: () => allowPost.map(a => ({ ...a })),
    noteBlockedWebSocket(url) { let host = '?', pth = '?'; try { const u = new URL(url); host = u.hostname; pth = safePath(u); } catch (e) { /* okänd */ } record({ method: 'WS', host, path: pth, type: 'websocket', allow: false, reason: 'websocket nekas i agentfasen' }); },
    audit: () => audit.slice(),
    blocked: () => audit.filter(a => !a.allow),
    summary: () => ({ ...counts, reasons: { ...reasons } })
  };
}

/** Förhandskontroll av en adress mot sökvägsreglerna (samma regler som nätverksskyddet). Ger orsaken eller null. */
export function denyReason(url) {
  let u; try { u = new URL(url); } catch (e) { return 'ogiltig adress'; }
  const path = norm(decodeURIComponentSafe(u.pathname)), query = norm(decodeURIComponentSafe(u.search.replace(/^\?/, '')));
  if (DENY_PATH_RE.test(path)) return 'varukorg, kassa, beställning eller utloggning (sökväg)';
  if (DENY_QUERY_RE.test(query)) return 'åtgärd i adressen (lägg till, köp, ta bort)';
  return null;
}

function decodeURIComponentSafe(s) { try { return decodeURIComponent(s); } catch (e) { return s; } }

/**
 * Kopplar skyddet till HELA webbläsarkontexten (Playwright): varje flik, popup-fönster och worker går genom det från sitt allra första anrop.
 * (Det går inte att garantera med sidvis skydd: ett popup-fönster hinner göra ett anrop innan ett sådant skydd sitter på. Det bevisades i testerna.)
 * WebSockets nekas i agentfasen. I inloggningsfasen släpps allt igenom. Service workers är avstängda när kontexten skapas.
 */
export async function attachGuard(context, guard) {
  await context.route('**/*', async route => {
    const req = route.request();
    let postData; try { postData = req.postData() || undefined; } catch (e) { postData = undefined; }
    const d = guard.decide({ method: req.method(), url: req.url(), resourceType: req.resourceType(), isNavigation: req.isNavigationRequest(), postData });
    if (d.allow) await route.continue().catch(() => {}); else await route.abort('blockedbyclient').catch(() => {});
  });
  await context.routeWebSocket(/.*/, ws => {
    if (guard.phase !== 'agent') { ws.connectToServer(); return; }
    guard.noteBlockedWebSocket(ws.url());
    ws.close({ code: 1008, reason: 'blockerad av skrivskyddet' });
  });
}
