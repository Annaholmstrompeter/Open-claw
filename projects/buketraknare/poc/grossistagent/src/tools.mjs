// Agentens verktyg. Agenten har inget verktyg för att köra egen kod, klicka på koordinater, skriva lösenord eller göra något i en varukorg.
// Verktygen är en andra försvarslinje: nätverksskyddet (guard.mjs) gäller ändå för allt som faktiskt skickas.
import { RISKY_TEXT_RE, denyReason, hostMatches } from './guard.mjs';
import { shapeOf, getPath } from './capture.mjs';
import { applyJsonMapping, applyDomMapping, normalizeRows, compact } from './extract.mjs';
import { purchasePlan, kr } from './plan.mjs';

const norm = s => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const cap = (s, n) => { const t = typeof s === 'string' ? s : JSON.stringify(s); return t.length > n ? t.slice(0, n) + '…[avkortat]' : t; };

export const TOOL_DEFS = [
  { name: 'observe', description: 'Beskriver sidan som visas just nu: adress, rubrik, synliga länkar, knappar och fält (utan värden) samt de JSON-svar sidan själv har hämtat (id, adress, struktur). Börja alltid här.', input_schema: { type: 'object', properties: { include_text: { type: 'boolean', description: 'Ta med ett utdrag av sidans synliga text (bara om det behövs).' } } } },
  { name: 'goto', description: 'Öppnar en adress (GET) på den godkända webbplatsen. Adresser till varukorg, kassa, beställning och utloggning nekas.', input_schema: { type: 'object', properties: { url: { type: 'string' } }, required: ['url'] } },
  { name: 'click', description: 'Klickar på ett element från senaste observe (ref). Klick på något som liknar köp, varukorg, kassa, beställning, spara eller utloggning nekas.', input_schema: { type: 'object', properties: { ref: { type: 'integer' } }, required: ['ref'] } },
  { name: 'search', description: 'Skriver en sökterm i webbplatsens sökfält och trycker Enter. Skriver aldrig i lösenordsfält.', input_schema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] } },
  { name: 'inspect_json', description: 'Visar struktur och de två första raderna av ett JSON-svar (response_id från observe), eventuellt under en sökväg som "resultat.artiklar".', input_schema: { type: 'object', properties: { response_id: { type: 'string' }, path: { type: 'string' } }, required: ['response_id'] } },
  { name: 'dom_outline', description: 'Hittar upprepade rader på den visade sidan (till exempel en artikeltabell) och visar ett exempel så att du kan välja CSS-väljare. Använd bara om det inte finns något JSON-svar med artiklarna.', input_schema: { type: 'object', properties: {} } },
  { name: 'set_extraction', description: 'Ange HUR artiklar ska läsas ut. Koden läser sedan ALLA rader, tolkar pris, förpackning och tillgänglighet exakt, och sparar dem. Du räknar eller skriver aldrig om några värden. Fält: id (artikelnummer), name, variant, color, lengthCm, packSize, price, priceUnit, priceIncludesVat, currency, availability, offer. För JSON anges sökvägar relativt varje rad, för DOM CSS-väljare (eller {selector, attr}).', input_schema: { type: 'object', properties: {
    source: { type: 'string', enum: ['json', 'dom'] }, response_id: { type: 'string' }, items_path: { type: 'string', description: 'JSON: sökväg till listan med artiklar' }, row_selector: { type: 'string', description: 'DOM: väljare för en artikelrad' },
    fields: { type: 'object', description: 'fältnamn → sökväg eller väljare' }, extras: { type: 'object', description: 'valfria extra fält (namn → sökväg eller väljare) som bara sparas' },
    price_unit: { type: 'string', enum: ['pack', 'stem'], description: 'Bara om sidan tydligt visar om priset gäller per förpackning eller per styck och det inte finns i ett fält' },
    price_includes_vat: { type: 'boolean' }, currency: { type: 'string' } }, required: ['source', 'fields'] } },
  { name: 'find_products', description: 'Filtrerar de artiklar som lästs ut (deterministiskt). Priser visas inte för dig, men finns i resultatet till floristen.', input_schema: { type: 'object', properties: { text: { type: 'string' }, color: { type: 'string' }, min_length_cm: { type: 'integer' }, max_length_cm: { type: 'integer' }, availability: { type: 'array', items: { type: 'string', enum: ['in_stock', 'low', 'sold_out', 'unknown'] } }, sort: { type: 'string', enum: ['name', 'price_asc', 'price_desc', 'length'] }, limit: { type: 'integer' } } } },
  { name: 'report_candidates', description: 'Avslutar uppdraget. Ange de artiklar (id) som passar och varför. Ange needed (heltal) bara om floristen själv sagt hur många hon behöver av just den artikeln. Koden räknar förpackningar, överskott och kostnad.', input_schema: { type: 'object', properties: { picks: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, reason: { type: 'string' }, needed: { type: 'integer' } }, required: ['id', 'reason'] } }, summary: { type: 'string' } }, required: ['picks'] } }
];

const COLLECT = () => {
  const vis = el => { const r = el.getBoundingClientRect(), st = getComputedStyle(el); return r.width > 0 && r.height > 0 && st.visibility !== 'hidden' && st.display !== 'none'; };
  const els = Array.from(document.querySelectorAll('a[href],button,[role=button],input,[role=searchbox],select')).filter(el => !(el.tagName === 'INPUT' && ['password', 'hidden', 'file'].includes(el.type)) && vis(el)).slice(0, 80);
  return els.map(el => ({
    tag: el.tagName.toLowerCase(), type: el.type || null, text: String(el.tagName === 'SELECT' ? '' : (el.innerText || (el.tagName === 'INPUT' && ['submit', 'button', 'reset'].includes(el.type) ? el.value : '') || el.getAttribute('aria-label') || el.title || '')).replace(/\s+/g, ' ').trim().slice(0, 80),
    href: el.tagName === 'A' ? el.href : null, target: el.target || null, name: el.name || null, id: el.id || null, placeholder: el.getAttribute('placeholder') || null,
    aria: el.getAttribute('aria-label') || null, cls: String(el.className && el.className.baseVal !== undefined ? el.className.baseVal : el.className || '').slice(0, 80),
    formAction: el.form ? el.form.action : null, formMethod: el.form ? el.form.method : null
  }));
};

export function createToolbox({ page, guard, capture, limits = {}, sleep = ms => new Promise(r => setTimeout(r, ms)), now = () => Date.now() }) {
  const lim = { maxPageLoads: 100, minGapMs: 2000, maxToolCalls: 80, maxProductsPerTask: 1000, ...limits };
  const st = { catalog: new Map(), refs: [], pageLoads: 0, lastLoadAt: 0, calls: 0, taskAdded: 0, blockedSeen: 0, final: null, lastSource: null };

  const hostAllowed = url => { try { return guard.hosts().some(h => hostMatches(new URL(url).hostname, h)); } catch (e) { return false; } };
  const riskyEl = d => RISKY_TEXT_RE.test([d.text, d.aria, d.name, d.id, d.cls, d.href && new URL(d.href).pathname].filter(Boolean).join(' ')) || (d.href && denyReason(d.href)) || (d.formAction && denyReason(d.formAction));

  // Playwrights networkidle väntar inte på nya anrop efter laddning, så vi håller räkningen själva: klart när inga anrop pågått på 500 ms (högst 6 s)
  let inflight = 0; const tick = ms => new Promise(r => setTimeout(r, ms));
  page.on('request', () => { inflight++; });
  page.on('requestfinished', () => { inflight = Math.max(0, inflight - 1); });
  page.on('requestfailed', () => { inflight = Math.max(0, inflight - 1); });
  async function settle() {
    const t0 = Date.now(); await tick(400);
    let idleSince = Date.now();
    while (Date.now() - t0 < 6000) { if (inflight > 0) idleSince = Date.now(); else if (Date.now() - idleSince >= 500) break; await tick(100); }
    await capture.whenIdle();
  }
  async function politeLoad(fn) {
    if (st.pageLoads >= lim.maxPageLoads) throw new Error('Gränsen för antal sidhämtningar (' + lim.maxPageLoads + ') är nådd. Avsluta uppdraget och rapportera.');
    const wait = st.lastLoadAt + lim.minGapMs - now(); if (wait > 0) await sleep(wait);
    st.pageLoads++; st.lastLoadAt = now();
    await fn(); await settle();
  }
  const blockedNote = () => { const b = guard.summary().blocked; const n = b - st.blockedSeen; st.blockedSeen = b; return n > 0 ? { nekade_anrop_sedan_sist: n, rad: 'Skyddet nekade ' + n + ' anrop. Berätta för floristen om något du behövde nekades. Du kan inte godkänna det själv.' } : {}; };

  async function observe(input) {
    const els = await page.evaluate(COLLECT);
    st.refs = els;
    const heads = await page.evaluate(() => Array.from(document.querySelectorAll('h1,h2,h3')).map(h => h.innerText.replace(/\s+/g, ' ').trim()).filter(Boolean).slice(0, 10));
    const body = await page.evaluate(() => document.body ? document.body.innerText : '');
    const out = {
      url: page.url(), title: await page.title(), rubriker: heads, loggaUtSynlig: /logga ut|sign out|log out/i.test(body),
      element: els.map((d, i) => ({ ref: i, slag: d.tag + (d.type ? ':' + d.type : ''), text: d.text || d.placeholder || d.aria || '', ...(d.href ? { href: d.href.replace(/\?.*$/, '') } : {}), ...(d.name ? { name: d.name } : {}), ...(riskyEl(d) ? { riskabel: true } : {}) })).slice(0, 60),
      json_svar: capture.list().slice(-12), ...blockedNote()
    };
    if (input && input.include_text) out.text = cap(body.replace(/\s+/g, ' '), 1500);
    return out;
  }

  async function goto(input) {
    const url = String(input.url || '');
    let u; try { u = new URL(url, page.url()); } catch (e) { throw new Error('Ogiltig adress.'); }
    if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error('Bara http och https.');
    if (!hostAllowed(u.href)) throw new Error('Adressen ligger utanför den godkända webbplatsen.');
    const why = denyReason(u.href); if (why) throw new Error('Nekad: ' + why + '.');
    await politeLoad(() => page.goto(u.href, { waitUntil: 'domcontentloaded', timeout: 20000 }));
    return { url: page.url(), title: await page.title(), ...blockedNote() };
  }

  async function click(input) {
    const d = st.refs[input.ref];
    if (!d) throw new Error('Okänd ref. Kör observe först.');
    if (riskyEl(d)) throw new Error('Nekad: elementet "' + (d.text || d.aria || d.name || d.id || d.tag) + '" liknar köp, varukorg, kassa, beställning, spara eller utloggning.');
    if (d.tag === 'a' && d.href && (d.target === '_blank' || d.target === '_new')) return goto({ url: d.href });      // nya fönster är blockerade, så länken öppnas i samma flik efter samma kontroller
    const fresh = await page.evaluate(COLLECT);
    if (!fresh[input.ref] || fresh[input.ref].text !== d.text || fresh[input.ref].href !== d.href) throw new Error('Sidan har ändrats sedan observe. Kör observe igen.');
    const list = await page.evaluateHandle(COLLECT_ELEMENTS);
    const el = (await list.getProperty(String(input.ref))).asElement();
    if (!el) throw new Error('Hittar inte elementet. Kör observe igen.');
    await politeLoad(async () => { await el.click(); });
    return { url: page.url(), title: await page.title(), ...blockedNote() };
  }

  async function search(input) {
    const text = String(input.text || '').slice(0, 120);
    if (!text.trim()) throw new Error('Söktermen är tom.');
    const sel = await page.evaluate(() => {
      const cands = Array.from(document.querySelectorAll('input,[role=searchbox]')).filter(el => !['password', 'hidden', 'file', 'checkbox', 'radio', 'submit', 'button', 'email', 'tel', 'number'].includes(el.type));
      const score = el => { const s = [el.type, el.name, el.id, el.placeholder, el.getAttribute('aria-label')].join(' ').toLowerCase(); return (el.type === 'search' ? 4 : 0) + (el.getAttribute('role') === 'searchbox' ? 4 : 0) + (/(^|\W)(q|query|search|sok|sök|s|keyword|term)(\W|$)|sök|search/.test(s) ? 3 : 0); };
      const best = cands.map(el => [score(el), el]).filter(x => x[0] > 0).sort((a, b) => b[0] - a[0])[0];
      if (!best) return null;
      const el = best[1], r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 ? Array.from(document.querySelectorAll('input,[role=searchbox]')).indexOf(el) : null;
    });
    if (sel === null) throw new Error('Hittar inget sökfält. Använd observe och goto/click.');
    const inputs = await page.$$('input,[role=searchbox]'); const box = inputs[sel];
    const type = await box.evaluate(e => e.type); if (type === 'password') throw new Error('Nekad: lösenordsfält.');
    await box.click({ clickCount: 3 }); await box.fill(text);
    await politeLoad(async () => { await page.keyboard.press('Enter'); });
    return { url: page.url(), title: await page.title(), json_svar: capture.list().slice(-5), ...blockedNote() };
  }

  function inspectJson(input) {
    const e = capture.get(String(input.response_id));
    if (!e) throw new Error('Okänt response_id. Kör observe.');
    const v = getPath(e.json, input.path || '');
    if (v === undefined) throw new Error('Sökvägen finns inte i svaret.');
    const arr = Array.isArray(v);
    return { id: e.id, path: input.path || '', struktur: shapeOf(v), antal: arr ? v.length : undefined, exempel: arr ? v.slice(0, 2) : cap(v, 1500) };
  }

  async function domOutline() {
    const groups = await page.evaluate(() => {
      const map = new Map();
      for (const el of Array.from(document.body.querySelectorAll('*'))) {
        if (['script', 'style', 'html', 'body', 'head', 'option', 'br', 'svg', 'path'].includes(el.tagName.toLowerCase())) continue;
        const cls = Array.from(el.classList).sort().join('.'), key = el.tagName.toLowerCase() + (cls ? '.' + cls : '');
        const g = map.get(key) || { key, count: 0, el }; g.count++; map.set(key, g);
      }
      const trim = h => h.replace(/>([^<]{40})[^<]*</g, '>$1…<').replace(/\s+/g, ' ').slice(0, 1200);
      return [...map.values()].filter(g => g.count >= 3 && g.count <= 400 && (g.el.innerText || '').trim().length > 15).sort((a, b) => b.count - a.count).slice(0, 6).map(g => ({ selector: g.key, antal: g.count, exempel: trim(g.el.outerHTML) }));
    });
    return { kandidater: groups };
  }

  async function setExtraction(input) {
    const fields = input.fields || {};
    if (!fields.id || !fields.name) throw new Error('fields måste innehålla id (artikelnummer) och name.');
    const allow = new Set(['id', 'name', 'variant', 'color', 'lengthCm', 'packSize', 'price', 'priceUnit', 'priceIncludesVat', 'currency', 'availability', 'offer']);
    for (const k of Object.keys(fields)) if (!allow.has(k)) throw new Error('Okänt fält: ' + k + '. Använd extras för övrigt.');
    const extras = input.extras || {};
    const all = { ...fields }; const extraNames = Object.keys(extras).slice(0, 12); for (const n of extraNames) all['extra:' + n] = extras[n];
    let mapped;
    if (input.source === 'json') {
      const e = capture.get(String(input.response_id)); if (!e) throw new Error('Okänt response_id.');
      mapped = applyJsonMapping(e.json, { itemsPath: input.items_path || '', fields: all });
      st.lastSource = { kind: 'json', endpoint: e.method + ' ' + e.host + e.path.replace(/\?.*$/, ''), itemsPath: input.items_path || '' };
    } else if (input.source === 'dom') {
      if (!input.row_selector) throw new Error('row_selector krävs för dom.');
      mapped = await applyDomMapping(page, { rowSelector: input.row_selector, fields: all });
      st.lastSource = { kind: 'dom', rowSelector: input.row_selector };
    } else throw new Error('source måste vara json eller dom.');
    if (!mapped.rows.length) return { antal: 0, anmarkningar: mapped.issues };
    const rows = mapped.rows.map(r => { const x = { extras: {} }; for (const [k, v] of Object.entries(r)) { if (k.startsWith('extra:')) x.extras[k.slice(6)] = v; else x[k] = v; } return x; });
    const parsed = normalizeRows(rows, { priceUnit: input.price_unit, priceIncludesVat: input.price_includes_vat, currency: input.currency });
    // Tak per uppdrag: i första testet mot en riktig grossist läses högst N artiklar ut. Redan kända artiklar uppdateras utan att räknas.
    const room = Math.max(0, lim.maxProductsPerTask - st.taskAdded);
    const known = parsed.products.filter(p => st.catalog.has(p.id)), fresh = parsed.products.filter(p => !st.catalog.has(p.id));
    const accepted = [...known, ...fresh.slice(0, room)];
    const dropped = fresh.length - Math.min(fresh.length, room);
    for (const p of accepted) st.catalog.set(p.id, { ...p, source: st.lastSource });
    st.taskAdded += Math.min(fresh.length, room);
    const products = accepted, skipped = parsed.skipped;
    const issues = {}; for (const p of products) for (const i of p.issues) issues[i] = (issues[i] || 0) + 1;
    return { antal: products.length, hoppadeOver: skipped, medPris: products.filter(p => p.packPrice).length, medFörpackning: products.filter(p => p.packSize).length, anmarkningar: issues, exempel: products.slice(0, 3).map(compact),
      ...(dropped > 0 ? { begransad: true, utanforTaket: dropped, rad: 'Taket för testet (' + lim.maxProductsPerTask + ' artiklar per uppdrag) är nått. ' + dropped + ' artiklar lästes inte ut. Avsluta med report_candidates, eller sök mer specifikt i ett nytt uppdrag.' } : {}) };
  }

  function findProducts(input) {
    let list = [...st.catalog.values()];
    if (input.text) { const words = norm(input.text).split(/\s+/).filter(Boolean); list = list.filter(p => { const hay = norm([p.name, p.variant, p.color, ...Object.values(p.extras)].join(' ')); return words.every(w => hay.includes(w)); }); }
    if (input.color) list = list.filter(p => p.color && norm(p.color).includes(norm(input.color)));
    if (Number.isInteger(input.min_length_cm)) list = list.filter(p => p.lengthCm !== null && p.lengthCm >= input.min_length_cm);
    if (Number.isInteger(input.max_length_cm)) list = list.filter(p => p.lengthCm !== null && p.lengthCm <= input.max_length_cm);
    if (Array.isArray(input.availability) && input.availability.length) list = list.filter(p => input.availability.includes(p.availability));
    const price = p => (p.packPrice ? p.packPrice.amount : null);
    const by = { name: (a, b) => a.name.localeCompare(b.name, 'sv'), length: (a, b) => (a.lengthCm ?? 1e9) - (b.lengthCm ?? 1e9),
      price_asc: (a, b) => (price(a) === null) - (price(b) === null) || (price(a) < price(b) ? -1 : price(a) > price(b) ? 1 : 0), price_desc: (a, b) => (price(a) === null) - (price(b) === null) || (price(a) > price(b) ? -1 : price(a) < price(b) ? 1 : 0) };
    if (input.sort && by[input.sort]) list.sort(by[input.sort]);
    const limit = Math.min(Number.isInteger(input.limit) ? input.limit : 30, 30);
    return { traffar: list.length, visar: Math.min(list.length, limit), artiklar: list.slice(0, limit).map(compact), totalt_utlasta: st.catalog.size };
  }

  function reportCandidates(input) {
    const picks = [], notFound = [];
    for (const pk of Array.isArray(input.picks) ? input.picks.slice(0, 20) : []) {
      const p = st.catalog.get(String(pk.id));
      if (!p) { notFound.push(String(pk.id)); continue; }
      const needed = Number.isInteger(pk.needed) ? pk.needed : null;
      picks.push({ product: p, reason: cap(pk.reason || '', 400), needed, plan: needed ? purchasePlan(p, needed) : null });
    }
    st.final = { picks, notFound, summary: cap(input.summary || '', 800) };
    return { mottaget: picks.length, hittadesInte: notFound };
  }

  const impl = { observe, goto, click, search, inspect_json: inspectJson, dom_outline: domOutline, set_extraction: setExtraction, find_products: findProducts, report_candidates: reportCandidates };
  return {
    definitions: TOOL_DEFS, state: st,
    /** Nollställer det som räknas per uppdrag (verktygsanrop och nyutlästa artiklar) och det föregående resultatet. Sidhämtningar räknas per session. */
    beginTask() { st.calls = 0; st.taskAdded = 0; st.final = null; },
    /** Kör ett verktyg. Fel blir ett vanligt resultat med is_error, så att agenten kan rätta sig. */
    async execute(name, input) {
      st.calls++;
      if (st.calls > lim.maxToolCalls) return { is_error: true, content: 'Gränsen för antal verktygsanrop är nådd. Avsluta med report_candidates.' };
      if (!impl[name]) return { is_error: true, content: 'Okänt verktyg: ' + name };
      try { return { is_error: false, content: cap(await impl[name](input || {}), 7000) }; }
      catch (e) { return { is_error: true, content: cap(String(e && e.message || e), 600) }; }
    }
  };
}

/** Elementen i samma ordning som COLLECT, som handtag (för verkliga klick). */
const COLLECT_ELEMENTS = () => {
  const vis = el => { const r = el.getBoundingClientRect(), st = getComputedStyle(el); return r.width > 0 && r.height > 0 && st.visibility !== 'hidden' && st.display !== 'none'; };
  return Array.from(document.querySelectorAll('a[href],button,[role=button],input,[role=searchbox],select')).filter(el => !(el.tagName === 'INPUT' && ['password', 'hidden', 'file'].includes(el.type)) && vis(el)).slice(0, 80);
};
export { kr };
