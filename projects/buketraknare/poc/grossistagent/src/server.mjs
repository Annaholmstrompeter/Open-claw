// Kontrollsidan som operatören (Anna) och floristen använder: en liten lokal webbsida i den vanliga webbläsaren, aldrig i den styrda.
// Lyssnar bara på 127.0.0.1, kräver en slumpad nyckel och kontrollerar värdnamnet (skydd mot att andra sidor eller program styr den).
// Sidan har två lägen: START (välj DEMO eller RIKTIG GROSSIST, visar om AI:n är ansluten) och SESSION (logga in, ge agenten uppdrag, avsluta).
// API-nyckeln finns aldrig här: servern får bara en AI-tjänst som svarar ok/fel, och sidan får aldrig nyckeln.
import http from 'node:http';
import crypto from 'node:crypto';
import { redact } from './secrets.mjs';
import { CONSENT_TEXT } from './session.mjs';
import { PROFILES } from './limits.mjs';
import { PAGE } from './page.mjs';

const MAX_BODY = 20000;
export const DEFAULT_REAL_SHOP = 'https://shop.blomstergrossisten.net/';           // ej verifierad; kontrolleras i floristens webbläsare

/**
 * session: en färdig session (tester) eller utelämnad. begin(mode, { shopUrl }) startar en session (Chrome, skydd) och ger den. ai: { status(), check() }.
 * onEnd(mode) efter att en session avslutats (programmet fortsätter), onQuit() när programmet ska stängas.
 */
export async function startControlServer({ session = null, saveDir = './out', onEnd = () => {}, onQuit = () => {}, token = crypto.randomBytes(18).toString('base64url'), ai = null, begin = null, chrome = { ok: true } }) {
  let port = 0, lastError = null, askPromise = null, starting = false, current = session;
  const json = (res, code, o) => { res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }); res.end(JSON.stringify(o)); };
  const hostOk = h => { const m = String(h || '').match(/^(127\.0\.0\.1|localhost):(\d+)$/); return !!m && Number(m[2]) === port; };
  const need = () => { if (!current) throw new Error('Ingen session. Starta DEMO eller RIKTIG GROSSIST först.'); return current; };
  const modes = () => ({ demo: { label: PROFILES.demo.label, limits: PROFILES.demo }, real: { label: PROFILES.real.label, limits: PROFILES.real } });
  const safe = e => redact(String(e && e.message || e)).slice(0, 300);

  const server = http.createServer((req, res) => {
    if (!hostOk(req.headers.host)) return json(res, 403, { error: 'fel värdnamn' });
    if (req.headers.origin && !hostOk(String(req.headers.origin).replace(/^https?:\/\//, ''))) return json(res, 403, { error: 'fel ursprung' });
    const u = new URL(req.url, 'http://127.0.0.1');
    if (req.method === 'GET' && u.pathname === '/') {
      if (u.searchParams.get('t') !== token) return json(res, 403, { error: 'nyckel saknas' });
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'content-security-policy': "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'" });
      return res.end(PAGE.replace('__TOKEN__', token).replace('__CONSENT__', CONSENT_TEXT.replace(/&/g, '&amp;').replace(/</g, '&lt;')));
    }
    if (req.headers['x-poc-token'] !== token) return json(res, 403, { error: 'nyckel saknas' });
    let body = '', over = false;
    req.on('data', c => { body += c; if (body.length > MAX_BODY) { over = true; req.destroy(); } });
    req.on('end', async () => {
      if (over) return;
      let input = {}; if (body) { try { input = JSON.parse(body); } catch (e) { return json(res, 400, { error: 'ogiltig JSON' }); } }
      try {
        if (req.method === 'GET' && u.pathname === '/api/state') {
          const aiStatus = ai ? ai.status() : null;
          if (!current) return json(res, 200, { stage: 'start', starting, ai: aiStatus, chrome, modes: modes(), defaultShopUrl: DEFAULT_REAL_SHOP, lastError });
          return json(res, 200, { stage: 'session', ...current.state(), ai: aiStatus, lastError });
        }
        if (req.method === 'GET' && u.pathname === '/api/products') return json(res, 200, { artiklar: current ? current.products() : [] });
        if (req.method !== 'POST') return json(res, 404, { error: 'finns inte' });
        if (u.pathname === '/api/ai-check') { if (!ai) return json(res, 400, { error: 'Ingen AI-tjänst.' }); return json(res, 200, await ai.check()); }
        if (u.pathname === '/api/begin') {
          if (current) return json(res, 409, { error: 'En session pågår redan. Avsluta den först.' });
          if (starting) return json(res, 409, { error: 'Startar redan.' });
          if (!begin) return json(res, 400, { error: 'Start är inte tillgänglig här.' });
          if (ai && !ai.status().ok) return json(res, 409, { error: ai.status().message });                  // ingen session utan fungerande AI: då skulle inloggningen vara förgäves
          if (chrome && chrome.ok === false) return json(res, 409, { error: chrome.message });
          const mode = input.mode === 'demo' ? 'demo' : input.mode === 'real' ? 'real' : null;
          if (!mode) return json(res, 400, { error: 'Välj DEMO eller RIKTIG GROSSIST.' });
          starting = true; lastError = null;
          try { current = await begin(mode, { shopUrl: String(input.shopUrl || '') }); } finally { starting = false; }
          return json(res, 200, { ok: true });
        }
        if (u.pathname === '/api/quit') { if (current) { try { await current.end(); } catch (e) { /* redan stängd */ } current = null; } json(res, 200, { ok: true }); setTimeout(() => { server.close(); onQuit(); }, 200); return; }
        const s = need();
        if (u.pathname === '/api/logged-in') return json(res, 200, await s.confirmLogin({ consent: input.consent === true }));
        if (u.pathname === '/api/ask') {
          const st = s.state();
          if (st.phase !== 'agent') return json(res, 400, { error: 'Bekräfta inloggningen först.' });
          if (st.running) return json(res, 409, { error: 'Agenten arbetar redan.' });
          if (!String(input.instruction || '').trim()) return json(res, 400, { error: 'Skriv en instruktion.' });
          lastError = null;
          askPromise = s.ask(String(input.instruction || '')).catch(e => { lastError = safe(e); });
          return json(res, 202, { startad: true });
        }
        if (u.pathname === '/api/stop') { s.stop(); return json(res, 200, { ok: true }); }
        if (u.pathname === '/api/calc') return json(res, 200, s.calc(String(input.id || ''), Number.isInteger(input.needed) ? input.needed : NaN));
        if (u.pathname === '/api/allow-post') { s.allowBlockedPost(Number(input.index)); return json(res, 200, { ok: true }); }
        if (u.pathname === '/api/allow-host') { s.allowHost(String(input.host || '')); return json(res, 200, { ok: true }); }
        if (u.pathname === '/api/save-report') return json(res, 200, { fil: s.saveReport(saveDir, { includeProducts: !!input.includeProducts }) });
        if (u.pathname === '/api/end') { const mode = s.state().mode; const r = await s.end(); current = null; lastError = null; json(res, 200, r); setTimeout(() => onEnd(mode), 100); return; }
        return json(res, 404, { error: 'finns inte' });
      } catch (e) { return json(res, 400, { error: safe(e) }); }
    });
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  port = server.address().port;
  return { port, host: server.address().address, token, url: 'http://127.0.0.1:' + port + '/?t=' + token, close: () => new Promise(r => { server.closeAllConnections?.(); server.close(() => r()); }), idle: () => askPromise, session: () => current };
}

export { PAGE };
