// En session: människan loggar in själv i webbläsaren, därefter arbetar agenten skrivskyddat i den inloggade sessionen.
// Inget sparas: sessionen avslutas, profilmappen raderas och allt i minnet töms. Ingen cookie, inget lösenord och ingen anropskropp lagras någonsin av oss.
import fs from 'node:fs';
import path from 'node:path';
import { createGuard, attachGuard } from './guard.mjs';
import { createCapture } from './capture.mjs';
import { createToolbox } from './tools.mjs';
import { runAgent } from './agent.mjs';
import { purchasePlan, perStemOf } from './plan.mjs';
import { launchLocal } from './launch.mjs';
import { profileFor, createBudget } from './limits.mjs';
import { redact } from './secrets.mjs';

/** Det samtycke floristen/kontoinnehavaren ger i RIKTIG GROSSIST-läget. Orden är beslutade av Anna; ändra dem inte utan henne. */
export const CONSENT_TEXT = 'Kontoinnehavaren samtycker till detta begränsade read-only-test med sitt eget konto. Testet får inte genomföra köp eller ändra konto/order.';

const PRICES_TENTH_MICRO_USD = { 'claude-sonnet-5-5': { in: 20, out: 100, cacheRead: 2 }, 'claude-opus-5-5': { in: 40, out: 200, cacheRead: 2 } };   // $2/$10 respektive $4/$20 per miljon tokens (cache $0,20)

export function estimateCostUsd(model, usage) {
  const p = PRICES_TENTH_MICRO_USD[model]; if (!p) return null;
  const t = BigInt(usage.input_tokens + usage.cache_creation_input_tokens) * BigInt(p.in) + BigInt(usage.output_tokens) * BigInt(p.out) + BigInt(usage.cache_read_input_tokens) * BigInt(p.cacheRead);
  return Number(t) / 1e7;                                       // bara en uppskattning att visa, aldrig ett belopp som räknas vidare
}

/** Klartext när modellen stoppar av annat skäl än att den blev klar (visas som fel på kontrollsidan). */
const STOP_TEXT = { max_tokens: 'Modellens svar blev för långt och avkortades. Försök igen, gärna med en enklare fråga.', avvisad: 'Modellen avvisade uppgiften.', max_turer: 'Agenten hann inte klart inom stegtaket. Försök med en enklare fråga.' };

const plainProduct = p => ({ id: p.id, name: p.name, variant: p.variant, color: p.color, lengthCm: p.lengthCm, packSize: p.packSize, packSizeSource: p.packSizeSource,
  packPrice: p.packPrice ? p.packPrice.toDecimalString() : null, perStem: perStemOf(p), currency: p.currency, currencyAssumed: p.currencyAssumed, priceUnit: p.priceUnit, priceDerived: p.priceDerived, priceIncludesVat: p.priceIncludesVat,
  availability: p.availability, availabilityRaw: p.availabilityRaw, offer: p.offer, extras: p.extras, issues: p.issues, källa: p.source || null });

/**
 * mode: 'real' (en riktig grossist: samtycke krävs, smalare gränser) eller 'demo' (den påhittade butiken: inget konto, inget samtycke behövs).
 * limits skriver över enskilda värden i profilen (se limits.mjs). client eller makeClient ger AI-kopplingen (makeClient anropas vid varje uppdrag).
 */
export async function createSession({ shopUrl, mode = 'real', launch = launchLocal, executablePath, headless = false, extraArgs = [], client, makeClient, model = 'claude-sonnet-5-5', limits = {}, effort = 'low', sleep = ms => new Promise(r => setTimeout(r, ms)), now = () => new Date() } = {}) {
  if (mode !== 'real' && mode !== 'demo') throw new Error('Okänt läge: ' + mode);
  const L = profileFor(mode, limits);
  const url = new URL(shopUrl);
  if (url.protocol !== 'https:' && !/^(127\.0\.0\.1|localhost)$/.test(url.hostname)) throw new Error('Webbplatsen måste använda https.');
  const { browser, context, page, tmpParent } = await launch({ executablePath, headless, extraArgs });
  /** Webbläsarens tillfälliga profilmappar som finns kvar i vår egen föräldramapp (ska vara noll efter avslut). */
  const profileDirsLeft = () => { try { return fs.readdirSync(tmpParent).filter(n => n.startsWith('playwright_chromiumdev_profile-')); } catch (e) { return []; } };
  const guard = createGuard({ hosts: [url.hostname], maxRequests: L.maxRequests });
  const capture = createCapture();
  const budget = createBudget(L, { now: () => now().getTime(), external: () => { const r = guard.requests(); return r.exhausted ? { kind: 'webblasaranrop', message: 'Gränsen för antal webbläsaranrop (' + r.max + ') är nådd.' } : null; } });
  await attachGuard(context, guard);                         // på hela kontexten från start. I inloggningsfasen släpper skyddet igenom allt, men det finns redan på plats
  capture.attach(page);
  let toolbox = createToolbox({ page, guard, capture, limits: L, sleep });
  const clearCatalog = () => { toolbox.state.catalog.clear(); toolbox.state.refs = []; toolbox.state.final = null; };
  const events = [], startedAt = now().toISOString();
  let consentGiven = null, sessionLimit = null, phase = 'login', running = false, abort = null, last = null, usage = { input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 }, popupCheck = null;
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
    async confirmLogin({ consent } = {}) {
      if (phase !== 'login') throw new Error('Inloggningen är redan bekräftad.');
      if (mode === 'real' && consent !== true) throw new Error('Kontoinnehavaren måste ha samtyckt till testet (kryssa i rutan).');
      consentGiven = mode === 'real' ? { text: CONSENT_TEXT, at: now().toISOString() } : null;
      const cur = new URL(page.url());
      if (cur.protocol.startsWith('http')) guard.addHost(cur.hostname);       // värden där den inloggade butiken ligger
      guard.setPhase('agent');
      popupCheck = await popupSelfTest();
      if (!popupCheck) { guard.setPhase('login'); throw new Error('Skyddet fångade inte ett popup-fönsters första anrop, så agenten startas inte. Se README.'); }
      phase = 'agent';
      budget.startSession();
      capture.clear(); toolbox.state.blockedSeen = guard.summary().blocked;      // självkontrollens nekade anrop ska inte rapporteras till agenten
      push({ type: 'inloggad', message: 'Inloggning klar – agenten väntar på din första uppgift. Skrivskydd på, popup-skydd kontrollerat.' });
      return { ok: true, host: cur.hostname, hosts: guard.hosts(), popupCheck };
    },

    async ask(instruction, { onEvent } = {}) {
      if (phase !== 'agent') throw new Error('Bekräfta inloggningen först.');
      if (running) throw new Error('Agenten arbetar redan.');
      const text = String(instruction || '').trim().slice(0, 2000);
      if (!text) throw new Error('Skriv en instruktion.');
      if (sessionLimit) {                                                          // en sessionsgräns är nådd: inget nytt modellanrop och inget mer i webbläsaren
        push({ type: 'gräns', message: sessionLimit.message });
        last = { stop: 'gräns', turns: 0, limit: { ...sessionLimit }, error: null, picks: null, answer: null };
        return last;
      }
      let c = client;
      if (!c) { if (!makeClient) throw new Error('Ingen AI-koppling. Kör 1-SETUP och lägg in nyckeln.'); c = makeClient(); }
      running = true; abort = new AbortController(); toolbox.beginTask(); budget.beginTask();
      push({ type: 'fråga', message: text });
      try {
        const res = await runAgent({ client: c, model, instruction: text, toolbox, effort, budget, maxTokens: L.maxOutputTokens, signal: abort.signal,
          onEvent: e => {
            if (e.type === 'usage') usage = e.usage;
            if (e.type === 'status') push({ type: 'status', message: e.text });
            if (e.type === 'gräns') push({ type: 'gräns', message: e.message });
            if (e.type === 'fel') push({ type: 'fel', message: e.message });
            if (onEvent) onEvent(e);
          } });
        const tripped = budget.tripped();
        if (tripped && (tripped.kind === 'sessionstid' || tripped.kind === 'webblasaranrop' || tripped.kind === 'sessionstokens')) { sessionLimit = { ...tripped }; guard.expire(tripped.message); }      // sessionens tak: inget mer får hända i webbläsaren
        if (res.stop === 'klar' && !res.final) push({ type: 'status', message: 'Klart ✓' });
        if (res.stop === 'avbruten') push({ type: 'status', message: 'Avbruten.' });
        last = { stop: res.stop, turns: res.turns, limit: res.limit || null, error: res.error ? redact(res.error) : (STOP_TEXT[res.stop] || null), picks: res.final ? serializeFinal(res.final) : null,
          // modellens egen text visas bara som svar när den avslutade utan att rapportera artiklar (aldrig löpande resonemang)
          answer: res.final ? null : (res.stop === 'klar' ? String(res.text || '').slice(0, 1200) : null) };
        return last;
      } finally { running = false; abort = null; }
    },
    stop() { if (abort) abort.abort(); },

    /** Tömmer de utlästa artiklarna (självtestet gör det mellan uppgifterna, så att varje uppgift visar vad just den läste ut). */
    clearCatalog,

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
        phase, running, mode, modeLabel: L.label, shop: url.hostname, hosts: guard.hosts(), popupCheck, startedAt, model, consentText: mode === 'real' ? CONSENT_TEXT : null,
        limits: { ...budget.snapshot().limits }, budget: { session: budget.snapshot().session, task: budget.snapshot().task, tripped: budget.tripped(), requests: guard.requests() },
        guard: guard.summary(), blocked: guard.blocked().slice(-30).map(b => ({ ...b })), blockedPosts: guard.blocked().filter(b => b.method === 'POST').map((b, index) => ({ index, host: b.host, path: b.path.replace(/\?.*$/, ''), t: b.t })), approved: guard.approvedPosts(),
        pageLoads: toolbox.state.pageLoads, jsonResponses: capture.list().length, catalogCount: toolbox.state.catalog.size,
        usage, costUsd: estimateCostUsd(model, usage), events: events.slice(-80), last
      };
    },
    products: () => [...toolbox.state.catalog.values()].map(plainProduct),

    /** Sanerad rapport: adressmönster, JSON-struktur (nycklar och typer, inga värden) och antal. Artiklar bara om operatören ber om det. */
    report({ includeProducts = false } = {}) {
      const r = { skapad: now().toISOString(), läge: mode, webbplats: url.hostname, start: startedAt, samtycke: consentGiven, gränser: L, gränsNådd: budget.tripped(), popupSkydd: popupCheck, skrivskydd: guard.summary(), nekade: guard.blocked().slice(-50), godkändaOperatörsbeslut: guard.approvedPosts(),
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
