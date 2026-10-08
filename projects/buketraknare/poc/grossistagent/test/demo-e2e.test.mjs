// Hela kedjan i DEMO-läget, i samma process: kontrollsidan → "Starta DEMO" → Chrome → människan loggar in → instruktion → AI-kopplingen (riktiga SDK:n över riktig HTTP)
// → verktygen → den påhittade butiken → strukturerade produkter → vår packberäkning. Svaren från "AI:n" är ett manus (se test/support/fake-anthropic.mjs):
// testet bevisar maskineriet, nyckelhanteringen och skydden, inte modellens omdöme.
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildApp } from '../src/launcher.mjs';
import { startControlServer } from '../src/server.mjs';
import { saveKey } from '../src/secrets.mjs';
import { PROFILES } from '../src/limits.mjs';
import { startFakeAnthropic } from './support/fake-anthropic.mjs';
import { toolUse, endTurn, parse } from './support/fake-client.mjs';
import { CHROME, humanLogin } from './support/browser.mjs';

import crypto from 'node:crypto';
const rnd = tag => 'sk-ant-api03-' + tag + '-' + crypto.randomBytes(18).toString('hex');            // slumpad vid varje körning, så att sökningen i filerna inte kan träffa testkoden själv
const KEY = rnd('E2E');
const FIELDS = { id: 'artikelnr', name: 'benamning', variant: 'sort', color: 'farg', lengthCm: 'langd_cm', packSize: 'forpackning.antal', price: 'pris.belopp', priceUnit: 'pris.per', priceIncludesVat: 'pris.inklmoms', currency: 'pris.valuta', availability: 'lager.status', offer: 'kampanj' };
const call = (srv, method, p, body) => new Promise((resolve, reject) => {
  const req = http.request({ host: '127.0.0.1', port: srv.port, method, path: p, headers: { 'x-poc-token': srv.token, ...(body !== undefined ? { 'content-type': 'application/json' } : {}) } }, res => {
    let d = ''; res.on('data', c => { d += c; }); res.on('end', () => { let j = null; try { j = JSON.parse(d); } catch (e) { /* html */ } resolve({ status: res.statusCode, text: d, json: j }); });
  });
  req.on('error', reject); if (body !== undefined) req.write(JSON.stringify(body)); req.end();
});
const here = path.dirname(fileURLToPath(import.meta.url));
const pocRoot = path.join(here, '..');

function filesContaining(root, needle, skip = new Set(['node_modules', '.git'])) {
  const hits = [];
  (function walk(d) {
    let list; try { list = fs.readdirSync(d, { withFileTypes: true }); } catch (e) { return; }
    for (const e of list) {
      if (skip.has(e.name)) continue;
      const f = path.join(d, e.name);
      if (e.isDirectory()) walk(f);
      else if (e.isFile()) { try { if (fs.statSync(f).size < 20e6 && fs.readFileSync(f).includes(needle)) hits.push(f); } catch (e2) { /* oläsbar */ } }
    }
  })(root);
  return hits;
}

/** Chrome-processerna som hör till den här sessionen (Linux): deras miljö får inte innehålla någon nyckel. */
function chromeEnvironments(tmpParent) {
  if (process.platform !== 'linux') return null;
  const out = [];
  for (const pid of fs.readdirSync('/proc').filter(x => /^\d+$/.test(x))) {
    try {
      const cmd = fs.readFileSync('/proc/' + pid + '/cmdline', 'utf8');
      if (cmd.includes(tmpParent)) out.push({ pid, env: fs.readFileSync('/proc/' + pid + '/environ', 'utf8') });
    } catch (e) { /* processen försvann eller är inte läsbar */ }
  }
  return out;
}

test('DEMO med riktig AI-koppling från start till slut: AI ansluten ✓, Starta DEMO, inloggning, instruktion, status, produkter, packberäkning, avslut och radering; nyckeln syns ingenstans', async () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'ga-e2e-home-'));
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'ga-e2e-out-'));
  const env = { GROSSISTAGENT_HOME: path.join(home, '.grossistagent') };
  saveKey(KEY, env);
  const decoy = rnd('DECOY');
  const savedDecoy = process.env.ANTHROPIC_API_KEY; process.env.ANTHROPIC_API_KEY = decoy;          // en nyckel i datorns miljö: Chrome får inte ärva den
  let ids = {};
  const api = await startFakeAnthropic({ key: KEY, steps: [
    endTurn('OK'),                                                                                           // AI-kontrollen vid start
    toolUse('observe', {}, 'MODELLENS RESONEMANG SOM INTE SKA VISAS'),
    toolUse('search', { text: 'vit ros' }),
    (body, results) => { ids.j = parse(results[0]).json_svar.at(-1).id; return toolUse('inspect_json', { response_id: ids.j, path: 'resultat.artiklar' }); },
    (body, results) => { assert.ok(!/118|126|104/.test(results[0].text.replace(/"artikelnr":"[^"]*"/g, '')) || /exempel/.test(results[0].text), 'bara två exempelrader'); return toolUse('set_extraction', { source: 'json', response_id: ids.j, items_path: 'resultat.artiklar', fields: FIELDS }); },
    toolUse('find_products', { text: 'ros', color: 'vit', sort: 'length' }),
    toolUse('report_candidates', { picks: [{ id: 'R-1001', reason: 'Ren vit, 60 cm, klassisk till brudbukett', needed: 25 }, { id: 'R-1003', reason: 'Krämvit, romantisk' }], summary: 'Två passande sorter.' })
  ] });
  const app = buildApp({ env, baseURL: api.url, chromePath: CHROME, headless: true, extraArgs: ['--no-sandbox'] });
  let ended = false;
  const srv = await startControlServer({ ai: app.ai, begin: app.begin, chrome: app.chrome, saveDir: out, onEnd: async () => { ended = true; await app.closeDemo(); } });
  const polled = [];
  const state = async () => { const r = await call(srv, 'GET', '/api/state'); polled.push(r.text); return r.json; };
  try {
    // START: AI kontrolleras innan något annat är möjligt
    let st = await state();
    assert.equal(st.stage, 'start'); assert.equal(st.ai.kind, 'ej_kontrollerad'); assert.deepEqual(st.chrome, { ok: true });
    assert.equal(st.modes.demo.limits.maxTaskTokens, PROFILES.demo.maxTaskTokens); assert.equal(st.modes.real.limits.maxProductsPerTask, 20);
    const early = await call(srv, 'POST', '/api/begin', { mode: 'demo' });
    assert.equal(early.status, 409); assert.match(early.json.error, /inte kontrollerad/);
    const chk = await call(srv, 'POST', '/api/ai-check', {});
    assert.deepEqual([chk.json.ok, chk.json.message], [true, 'AI ansluten ✓']);
    st = await state(); assert.equal(st.ai.ok, true); assert.equal(st.ai.source, 'den sparade filen i din användarmapp'); assert.equal(st.ai.model, 'claude-sonnet-5-5');
    assert.equal((await call(srv, 'POST', '/api/begin', { mode: 'annat' })).status, 400);
    assert.equal((await call(srv, 'POST', '/api/begin', { mode: 'real', shopUrl: 'http://osakert.example/' })).status, 400);
    assert.equal((await call(srv, 'POST', '/api/begin', { mode: 'real', shopUrl: 'ingen adress' })).status, 400);
    assert.equal((await call(srv, 'POST', '/api/begin', { mode: 'real', shopUrl: 'http://127.0.0.1:9/' })).status, 400, 'RIKTIG GROSSIST kräver https, även för en lokal adress');
    assert.equal(srv.session(), null, 'ingen Chrome ska ha startats av felaktiga adresser');

    // STARTA DEMO → Chrome öppnas på den påhittade butikens inloggning
    const begin = await call(srv, 'POST', '/api/begin', { mode: 'demo' });
    assert.equal(begin.status, 200, begin.text);
    const session = srv.session();
    assert.equal((await call(srv, 'POST', '/api/begin', { mode: 'demo' })).status, 409, 'bara en session i taget');
    st = await state(); assert.deepEqual([st.stage, st.mode, st.phase, st.consentText], ['session', 'demo', 'login', null]);
    const env1 = chromeEnvironments(session.tmpParent);
    if (env1) { assert.ok(env1.length >= 1, 'hittade Chrome-processerna'); for (const e of env1) assert.ok(!e.env.includes('sk-ant') && !/ANTHROPIC/.test(e.env), 'Chrome ärvde en nyckel från miljön (pid ' + e.pid + ')'); }

    // människan loggar in direkt i Chrome (testet gör det med de påhittade uppgifterna)
    await humanLogin(session.page, new URL(session.page.url()).origin);
    assert.equal((await call(srv, 'POST', '/api/ask', { instruction: 'för tidigt' })).status, 400);
    const li = await call(srv, 'POST', '/api/logged-in', {});
    assert.equal(li.status, 200, li.text); assert.equal(li.json.popupCheck, true);

    // instruktionen, som Anna skulle skriva den
    const ask = await call(srv, 'POST', '/api/ask', { instruction: 'Hitta vita rosor till en romantisk brudbukett. Jag behöver ungefär 25.' });
    assert.equal(ask.status, 202); assert.equal((await call(srv, 'POST', '/api/ask', { instruction: 'en till' })).status, 409);
    await srv.idle();
    st = await state();
    assert.equal(st.last.stop, 'klar', st.last.error);
    const [av, vendela] = st.last.picks.picks;
    assert.deepEqual([av.product.id, av.product.packSize, av.product.packPrice, av.plan.packs, av.plan.bought, av.plan.leftover, av.plan.cost], ['R-1001', 20, '118.00', 2, 40, 15, '236 kr']);        // räknat av vår kod, inte av AI:n
    assert.equal(vendela.plan, null); assert.equal(st.last.picks.summary, 'Två passande sorter.');
    // korta statusrader, aldrig modellens text
    const lines = st.events.filter(e => e.type === 'status').map(e => e.message);
    assert.deepEqual(lines, ['Tittar på sidan…', 'Söker efter «vit ros»…', 'Sökningen är gjord…', 'Läser produktinformation…', 'Läser ut produkterna på sidan…', 'Läste ut 5 produkter…', 'Filtrerar produkterna…', 'Hittade 5 produkter…', 'Sammanställer förslag…', 'Klart ✓']);
    assert.ok(!polled.join('\n').includes('MODELLENS RESONEMANG'), 'modellens text får inte visas');
    // gränser och kostnad syns
    assert.ok(st.usage.input_tokens > 5000 && st.costUsd > 0 && st.costUsd < 0.05);
    assert.equal(st.limits.maxTaskTokens, PROFILES.demo.maxTaskTokens); assert.ok(st.budget.requests.used > 0 && st.budget.requests.used < st.budget.requests.max);

    // protokollet mot API:t
    assert.deepEqual(api.violations, [], 'protokollbrott: ' + api.violations.join('; '));
    assert.equal(api.requests.length, 1 + 6, 'ett kontrollanrop och sex uppdragsanrop');
    for (const r of api.requests) assert.equal(r.headers['x-api-key'], KEY);
    assert.ok(api.requests.slice(1).every(r => r.body.tools.length === 9 && r.body.output_config.effort === 'low' && r.body.model === 'claude-sonnet-5-5'));
    // AI:n fick aldrig se priserna i listorna eller något lösenord
    const toApi = api.requests.map(r => r.raw).join('\n');
    assert.ok(!toApi.includes('hemligt-123'), 'lösenordet gick till AI:n'); assert.ok(!/cookie|sid=/i.test(toApi), 'cookie gick till AI:n'); assert.ok(!toApi.includes(KEY), 'nyckeln i en kropp');
    // skrivskydd: ingenting muterande nådde butiken
    assert.deepEqual(app.demoShop().mutations(), [], 'butikens server fick ett muterande anrop');
    assert.equal(app.demoShop().requests.filter(r => r.path.includes('selftest')).length, 0, 'popup-självkontrollen nådde aldrig butiken');

    // nyckeln finns ingenstans där den inte ska: inte i något svar, inte i rapporten, inte i filer i repot, rapportmappen eller webbläsarens tillfälliga mapp
    const rep = await call(srv, 'POST', '/api/save-report', { includeProducts: true });
    const all = polled.join('\n') + (await call(srv, 'GET', '/api/products')).text + fs.readFileSync(rep.json.fil, 'utf8') + JSON.stringify(session.state()) + (await call(srv, 'GET', '/?t=' + srv.token).catch(() => ({ text: '' }))).text;
    for (const secret of [KEY, decoy, 'sk-ant']) assert.ok(!all.includes(secret), 'hemlighet i svar eller rapport: ' + secret);
    assert.deepEqual(filesContaining(pocRoot, KEY), [], 'nyckeln i repots filer'); assert.deepEqual(filesContaining(out, KEY), []); assert.deepEqual(filesContaining(session.tmpParent, KEY), [], 'nyckeln i webbläsarens mapp');
    assert.deepEqual(filesContaining(pocRoot, decoy), []);
    assert.deepEqual(filesContaining(home, KEY), [path.join(home, '.grossistagent', 'anthropic-key.txt')], 'nyckeln finns på exakt ett ställe, utanför repot');
    assert.ok(!path.join(home, '.grossistagent').startsWith(pocRoot));

    // AVSLUTA: sessionen raderas och vi är tillbaka på start
    const tmp = session.tmpParent;
    const end = await call(srv, 'POST', '/api/end', {});
    assert.equal(end.json.wiped, true); assert.ok(!fs.existsSync(tmp));
    await new Promise(r => setTimeout(r, 300)); assert.equal(ended, true);
    st = await state(); assert.equal(st.stage, 'start'); assert.equal(srv.session(), null);
    assert.equal((await call(srv, 'POST', '/api/ask', { instruction: 'x' })).status, 400);
  } finally {
    if (srv.session()) await srv.session().end().catch(() => {});
    await srv.close(); await app.closeDemo(); await api.close();
    if (savedDecoy === undefined) delete process.env.ANTHROPIC_API_KEY; else process.env.ANTHROPIC_API_KEY = savedDecoy;
    fs.rmSync(home, { recursive: true, force: true }); fs.rmSync(out, { recursive: true, force: true });
  }
});

test('utan nyckel: tydligt fel på startskärmen, och ingen session kan startas', async () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'ga-e2e-nokey-'));
  const saved = process.env.ANTHROPIC_API_KEY; delete process.env.ANTHROPIC_API_KEY;
  const app = buildApp({ env: { GROSSISTAGENT_HOME: path.join(home, '.grossistagent') }, chromePath: CHROME, headless: true });
  const srv = await startControlServer({ ai: app.ai, begin: app.begin, chrome: app.chrome });
  try {
    const chk = await call(srv, 'POST', '/api/ai-check', {});
    assert.deepEqual([chk.json.ok, chk.json.kind], [false, 'nokey']); assert.match(chk.json.message, /AI ej ansluten: ingen API-nyckel hittades.*1-SETUP/);
    const b = await call(srv, 'POST', '/api/begin', { mode: 'demo' });
    assert.equal(b.status, 409); assert.match(b.json.error, /1-SETUP/); assert.equal(srv.session(), null);
    const noChrome = buildApp({ env: { GROSSISTAGENT_HOME: path.join(home, 'x') }, chromePath: null, baseURL: undefined });
    assert.equal(noChrome.chrome.ok, false);
  } finally { await srv.close(); fs.rmSync(home, { recursive: true, force: true }); if (saved !== undefined) process.env.ANTHROPIC_API_KEY = saved; }
});
