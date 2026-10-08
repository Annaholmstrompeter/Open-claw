// En session: människan loggar in själv i webbläsaren, därefter arbetar agenten skrivskyddat i den inloggade sessionen.
// Inget sparas: sessionen avslutas, profilmappen raderas och allt i minnet töms. Ingen cookie, inget lösenord och ingen anropskropp lagras någonsin av oss.
import fs from 'node:fs';
import path from 'node:path';
import { createGuard, attachGuard } from './guard.mjs';
import { createCapture } from './capture.mjs';
import { createToolbox } from './tools.mjs';
import { runAgent } from './agent.mjs';
import { purchasePlan } from './plan.mjs';
import { launchLocal } from './launch.mjs';

const PRICES_TENTH_MICRO_USD = { 'claude-sonnet-5-5': { in: 20, out: 100, cacheRead: 2 }, 'claude-opus-5-5': { in: 40, out: 200, cacheRead: 2 } };   // $2/$10 respektive $4/$20 per miljon tokens (cache $0,20)

export function estimateCostUsd(model, usage) {
  const p = PRICES_TENTH_MICRO_USD[model]; if (!p) return null;
  const t = BigInt(usage.input_tokens + usage.cache_creation_input_tokens) * BigInt(p.in) + BigInt(usage.output_tokens) * BigInt(p.out) + BigInt(usage.cache_read_input_tokens) * BigInt(p.cacheRead);
  return Number(t) / 1e7;                                       // bara en uppskattning att visa, aldrig ett belopp som räknas vidare
}

const plainProduct = p => ({ id: p.id, name: p.name, variant: p.variant, color: p.color, lengthCm: p.lengthCm, packSize: p.packSize, packSizeSource: p.packSizeSource,
  packPrice: p.packPrice ? p.packPrice.toDecimalString() : null, currency: p.currency, currencyAssumed: p.currencyAssumed, priceUnit: p.priceUnit, priceDerived: p.priceDerived, priceIncludesVat: p.priceIncludesVat,
  availability: p.availability, availabilityRaw: p.availabilityRaw, offer: p.offer, extras: p.extras, issues: p.issues, källa: p.source || null });

export async function createSession({ shopUrl, launch = launchLocal, executablePath, headless = false, extraArgs = [], client, makeClient, model = 'claude-sonnet-5-5', limits = {}, effort = 'low', sleep = ms => new Promise(r => setTimeout(r, ms)), now = () => new Date() } = {}) {
  const url = new URL(shopUrl);
  if (url.protocol !== 'https:' && !/^(127\.0\.0\.1|localhost)$/.test(url.hostname)) throw new Error('Webbplatsen måste använda https.');
  const { browser, context, page, tmpParent } = await launch({ executablePath, headless, extraArgs });
  /** Webbläsarens tillfälliga profilmappar som finns kvar i vår egen föräldramapp (ska vara noll efter avslut). */
  const profileDirsLeft = () => { try { return fs.readdirSync(tmpParent).filter(n => n.startsWith('playwright_chromiumdev_profile-')); } catch (e) { return []; } };
  const guard = createGuard({ hosts: [url.hostname] });
  const capture = createCapture();
  await attachGuard(context, guard);                         // på hela kontexten från start. I inloggningsfasen släpper skyddet igenom allt, men det finns redan på plats
  capture.attach(page);
  let toolbox = createToolbox({ page, guard, capture, limits, sleep });
  const events = [], startedAt = now().toISOString();
  let consentGiven = null, phase = 'login', running = false, abort = null, last = null, usage = { input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 }, popupCheck = null;
  const push = e => { events.push({ t: now().toISOString(), ...e }); if (events.length > 200) events.shift(); };
  let popups = 0;
  context.on('page', p => { if (p === page) return; popups++; capture.attach(p); if (guard.phase === 'agent') p.close().catch(() => {}); });      // popup-fönster stängs direkt i agentfasen (och deras anrop går ändå genom skyddet)
  await page.goto(url.href, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(e => push({ type: 'varning', message: 'Kunde inte öppna startsidan: ' + String(e.message).slice(0, 120) }));
  push({ type: 'start', message: 'Webbläsaren är öppen. Logga in själv i fönstret.' });

  /** Provar att ett popup-fönster (öppnat med ett riktigt klick) går genom skyddet från sitt första anrop. Godkänt om skyddet såg och nekade det, eller om inget fönster alls öppnades. */
  async function popupSelfTest() {
    const origin = new URL(page.url()).origin, blockedBefore = guard.summary().blocked, popupsBefore = popups;
    await page.evaluate(o => { const b = document.createElement('button'); b.id = '__grossistagent_selftest'; b.style.cssText = 'position:fixed;top:0;left:0;width:12px;height:12px;z-index:2147483647'; b.onclick = () => window.open(o + '/__grossistagent-selftest/cart'); document.body.appendChild(b); }, origin).catch(() => {});
    await page.click('#__grossistagent_selftest', { timeout: 3000 }).catch(() => {});
    await sleep(600);
    const opened = popups > popupsBefore;
    const seen = guard.summary().blocked > blockedBefore;
    for (const p of context.pages()) if (p !== page) await p.close().catch(() => {});
    await page.evaluate(() => { const b = document.getElementById('__grossistagent_selftest'); if (b) b.remove(); }).catch(() => {});
    return !opened || seen;
  }

  const api = {
    get phase() { return phase; },
    page, browser, context, guard, capture, get toolbox() { return toolbox; }, profileDirsLeft, get tmpParent() { return tmpParent; },

    /** Människan säger att hon är inloggad. Kontrollerar att popup-skyddet verkligen är på, och startar sedan agentfasen. */
    async confirmLogin({ consent, termsChecked } = {}) {
      if (phase !== 'login') throw new Error('Inloggningen är redan bekräftad.');
      if (consent !== true) throw new Error('Floristen måste själv ha samtyckt och använda sitt eget konto.');
      if (termsChecked !== true) throw new Error('Titta på webbplatsens publika villkor först. Förbjuder de uttryckligen den här sortens test ska du avbryta.');
      consentGiven = { consent: true, termsChecked: true, at: now().toISOString() };
      const cur = new URL(page.url());
      if (cur.protocol.startsWith('http')) guard.addHost(cur.hostname);       // värden där den inloggade butiken ligger
      guard.setPhase('agent');
      popupCheck = await popupSelfTest();
      if (!popupCheck) { guard.setPhase('login'); throw new Error('Skyddet fångade inte ett popup-fönsters första anrop, så agenten startas inte. Se README.'); }
      phase = 'agent';
      capture.clear(); toolbox.state.blockedSeen = guard.summary().blocked;      // självkontrollens nekade anrop ska inte rapporteras till agenten
      push({ type: 'inloggad', message: 'Agentfasen: skrivskydd på, popup-skydd kontrollerat.' });
      return { ok: true, host: cur.hostname, hosts: guard.hosts(), popupCheck };
    },

    async ask(instruction, { onEvent } = {}) {
      if (phase !== 'agent') throw new Error('Bekräfta inloggningen först.');
      if (running) throw new Error('Agenten arbetar redan.');
      const text = String(instruction || '').trim().slice(0, 2000);
      if (!text) throw new Error('Skriv en instruktion.');
      let c = client;
      if (!c) { if (!makeClient) throw new Error('Ingen AI-koppling. Sätt ANTHROPIC_API_KEY.'); c = makeClient(); }
      running = true; abort = new AbortController(); toolbox.state.final = null;
      push({ type: 'fråga', message: text });
      try {
        const res = await runAgent({ client: c, model, instruction: text, toolbox, effort, signal: abort.signal, onEvent: e => { if (e.type === 'usage') usage = e.usage; if (e.type === 'verktyg') push({ type: 'verktyg', message: e.name + (e.fel ? ' (nekades eller misslyckades)' : ''), ms: e.ms }); if (e.type === 'text') push({ type: 'agent', message: e.text.slice(0, 600) }); if (e.type === 'fel') push({ type: 'fel', message: e.message }); if (onEvent) onEvent(e); } });
        last = { stop: res.stop, turns: res.turns, text: res.text, error: res.error || null, picks: res.final ? serializeFinal(res.final) : null };
        return last;
      } finally { running = false; abort = null; }
    },
    stop() { if (abort) abort.abort(); },

    /** Deterministisk inköpsberäkning för en utläst artikel. Ingen AI. */
    calc(id, needed) {
      const p = toolbox.state.catalog.get(String(id));
      if (!p) throw new Error('Okänd artikel.');
      return purchasePlan(p, needed);
    },
    /** Operatörens beslut: godkänn en nekad POST som läsande sökning, med exakt den sökvägen. Bara anrop som faktiskt nekats kan godkännas. */
    allowBlockedPost(index) {
      const b = guard.blocked().filter(x => x.method === 'POST')[index];
      if (!b) throw new Error('Det anropet finns inte i listan över nekade.');
      const pathOnly = b.path.replace(/\?.*$/, '');
      guard.allowPostPattern({ host: b.host, pathRegex: '^' + pathOnly.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$' });
      push({ type: 'operatör', message: 'Godkände läsande sökning: POST ' + b.host + pathOnly });
    },
    allowHost(host) { guard.addHost(host); push({ type: 'operatör', message: 'Godkände värd: ' + host }); },

    state() {
      return {
        phase, running, shop: url.hostname, hosts: guard.hosts(), popupCheck, startedAt, model,
        guard: guard.summary(), blocked: guard.blocked().slice(-30).map(b => ({ ...b })), blockedPosts: guard.blocked().filter(b => b.method === 'POST').map((b, index) => ({ index, host: b.host, path: b.path.replace(/\?.*$/, ''), t: b.t })), approved: guard.approvedPosts(),
        pageLoads: toolbox.state.pageLoads, jsonResponses: capture.list().length, catalogCount: toolbox.state.catalog.size,
        usage, costUsd: estimateCostUsd(model, usage), events: events.slice(-80), last
      };
    },
    products: () => [...toolbox.state.catalog.values()].map(plainProduct),

    /** Sanerad rapport: adressmönster, JSON-struktur (nycklar och typer, inga värden) och antal. Artiklar bara om operatören ber om det. */
    report({ includeProducts = false } = {}) {
      const r = { skapad: now().toISOString(), webbplats: url.hostname, start: startedAt, samtycke: consentGiven, popupSkydd: popupCheck, skrivskydd: guard.summary(), nekade: guard.blocked().slice(-50), godkändaOperatörsbeslut: guard.approvedPosts(),
        struktur: capture.structure(), artiklarUtlästa: toolbox.state.catalog.size, sidhämtningar: toolbox.state.pageLoads, tokens: usage, uppskattadKostnadUsd: estimateCostUsd(model, usage) };
      if (includeProducts) r.artiklar = api.products();
      return r;
    },
    saveReport(dir, opts) { fs.mkdirSync(dir, { recursive: true }); const f = path.join(dir, 'rapport-' + now().toISOString().replace(/[:.]/g, '-') + '.json'); fs.writeFileSync(f, JSON.stringify(api.report(opts), null, 2)); return f; },

    /** Avslutar: rensar webbläsarens data, stänger, raderar profilmappen och tömmer minnet. Ingen session sparas. */
    async end() {
      if (phase === 'ended') return { wiped: true };
      api.stop();
      try { await context.clearCookies(); } catch (e) { /* kontexten kan redan vara stängd */ }
      await browser.close().catch(() => {});
      capture.clear(); toolbox.state.catalog.clear(); toolbox.state.refs = []; toolbox.state.final = null; events.length = 0; last = null;
      phase = 'ended';
      if (tmpParent) fs.rmSync(tmpParent, { recursive: true, force: true });           // allt webbläsaren lämnat i vår tillfälliga mapp
      const left = profileDirsLeft();
      return { wiped: left.length === 0 && !(tmpParent && fs.existsSync(tmpParent)), profileDirsLeft: left };
    }
  };
  return api;
}

function serializeFinal(f) {
  return { summary: f.summary, notFound: f.notFound, picks: f.picks.map(p => ({ product: plainProduct(p.product), reason: p.reason, needed: p.needed, plan: p.plan })) };
}
