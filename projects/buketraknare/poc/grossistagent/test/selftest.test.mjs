// Självtestet ("Kör självtest" på startskärmen): fem uppgifter med den riktiga modellen mot den påhittade butiken, och kontroller som bygger på butikens egna data.
// Här provas dels kontrollerna (verifyTask) med doktorerade utfall, så att varje sorts fel faktiskt fångas, dels hela kedjan via kontrollsidans API med ett MANUS i stället för en modell
// (test/support/scripted-model.mjs). Manuset bevisar maskineriet och kontrollerna, inte modellens omdöme: första riktiga körningen sker när Anna lägger in sin nyckel.
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { JSDOM } from 'jsdom';
import { buildApp } from '../src/launcher.mjs';
import { startControlServer, PAGE } from '../src/server.mjs';
import { saveKey } from '../src/secrets.mjs';
import { PROFILES, SELFTEST_LIMITS } from '../src/limits.mjs';
import { PRODUCTS } from '../src/demo-shop.mjs';
import { SELFTEST_TASKS, expectedPlan, fmtOren, verifyTask, verdictOf } from '../src/selftest.mjs';
import { startFakeAnthropic } from './support/fake-anthropic.mjs';
import { endTurn, toolUse } from './support/fake-client.mjs';
import { selftestSteps, GOOD_SPECS } from './support/scripted-model.mjs';
import { CHROME } from './support/browser.mjs';

const KEY = 'sk-ant-api03-SELFTEST-' + crypto.randomBytes(18).toString('hex');
const T = Object.fromEntries(SELFTEST_TASKS.map(t => [t.id, t]));
const shopOf = id => PRODUCTS.find(p => p.artikelnr === id);

/** Det som session.ask ger för ett förslag, byggt ur butikens egna data (så som verktygen och vår packräkning skulle ge det). */
function pick(id, needed = null, over = {}) {
  const s = shopOf(id) || shopOf('E-4001'), e = needed ? expectedPlan(s, needed) : null;
  return { product: { id, name: s.benamning, variant: s.sort, color: s.farg, lengthCm: s.langd_cm, packSize: s.antal, packPrice: s.pris.toFixed(2), offer: s.kampanj ? s.kampanj.text : null, ...(over.product || {}) }, reason: 'x', needed,
    plan: over.plan === null ? null : e ? { status: 'ok', needed, packs: e.packs, bought: e.bought, leftover: e.leftover, cost: e.cost, ...(over.plan || {}) } : null };
}
const outcome = (picks, over = {}) => ({ last: { stop: 'klar', picks: { picks, notFound: [], summary: 's', ...(over.picks || {}) }, ...(over.last || {}) }, tools: over.tools || ['observe', 'search', 'inspect_json', 'set_extraction', 'find_products', 'report_candidates'], mutations: over.mutations ?? 0, read: over.read ?? 5 });
const fails = r => r.checks.filter(c => !c.ok).map(c => (c.hard ? 'FEL: ' : 'ANM: ') + c.text);

test('oberoende packräkning (heltal, ören): samma exempel som i README, och ogiltiga värden ger null', () => {
  assert.deepEqual(expectedPlan(shopOf('R-1001'), 25), { packs: 2, bought: 40, leftover: 15, cost: '236 kr', costOren: 23600 });
  assert.deepEqual(expectedPlan(shopOf('E-4001'), 30), { packs: 3, bought: 30, leftover: 0, cost: '192 kr', costOren: 19200 });
  assert.equal(expectedPlan(shopOf('R-1003'), 21).cost, '253 kr');                  // 2 × 126,50
  assert.equal(expectedPlan(shopOf('R-1003'), 1).cost, '126,50 kr');
  assert.equal(expectedPlan(shopOf('R-1001'), 0), null); assert.equal(expectedPlan(shopOf('R-1001'), 2.5), null);
  assert.equal(fmtOren(5), '0,05 kr'); assert.equal(fmtOren(100), '1 kr'); assert.equal(fmtOren(12650), '126,50 kr');
});

test('kontrollerna godkänner ett korrekt utfall för varje uppgift (och bara anmärkningar för sådant som är ett omdöme)', () => {
  assert.deepEqual(fails(verifyTask(T.t1, outcome([pick('R-1001', 25), pick('R-1003', 25)]))), []);
  assert.deepEqual(fails(verifyTask(T.t2, outcome([pick('R-1001'), pick('R-1003')]))), []);
  assert.deepEqual(fails(verifyTask(T.t3, outcome([pick('R-1003'), pick('E-4001')]))), []);
  assert.deepEqual(fails(verifyTask(T.t4, outcome([pick('R-1005')]))), []);
  assert.deepEqual(fails(verifyTask(T.t5, outcome([pick('E-4001', 30)]))), []);
  const ok = verifyTask(T.t5, outcome([pick('E-4001', 30)]));
  assert.equal(ok.status, 'ok'); assert.ok(ok.checks.some(c => /vår kod räknade, och en oberoende räkning ger samma/.test(c.text)));
  // modellen får välja annorlunda: bara en bedömning, inget fel
  const other = verifyTask(T.t1, outcome([pick('R-1002', 25)]));          // Mondial är också en vit ros
  assert.equal(other.status, 'ok');
  const red = verifyTask(T.t1, outcome([pick('R-1004', 25)]));            // röd ros till vit brudbukett: anmärkning, inte fel
  assert.equal(red.status, 'anmärkning'); assert.ok(fails(red).some(t => /^ANM: .*annan färg än vit/.test(t)), fails(red).join('|'));
  assert.equal(verifyTask(T.t4, outcome([pick('R-1001')])).status, 'anmärkning');       // missade erbjudandet
  assert.equal(verifyTask(T.t3, outcome([pick('R-1001')])).status, 'anmärkning');       // inget grönt
});

test('kontrollerna FÅNGAR: påhittade artiklar, ändrat artikelnummer, ändrad förpackning, ändrat pris, felräknad plan, saknad plan, muterande anrop, fel verktyg och uttryckliga krav som bröts', () => {
  const hard = (task, o, re) => { const r = verifyTask(task, o); assert.equal(r.status, 'fel', fails(r).join(' | ')); assert.ok(fails(r).some(t => re.test(t)), 'väntade ' + re + ' i: ' + fails(r).join(' | ')); };
  hard(T.t5, outcome([pick('E-9999', 30, { product: { id: 'E-9999' } })]), /finns inte i butikens data \(påhittad\)/);
  hard(T.t5, outcome([pick('E-4001', 30)], { picks: { notFound: ['E-9999'] } }), /nämnde artikel\(ar\) som inte finns/);
  hard(T.t5, outcome([pick('E-4001', 30, { product: { packSize: 12 } })]), /förpackning \(12 mot 10\)/);
  hard(T.t5, outcome([pick('E-4001', 30, { product: { packPrice: '60.00' } })]), /pris \(60\.00 mot 64\)/);
  hard(T.t5, outcome([pick('E-4001', 30, { product: { name: 'Eukalyptus Populus' } })]), /avviker från butikens data i namn/);
  hard(T.t5, outcome([pick('E-4001', 30, { product: { color: 'Röd' } })]), /i färg/);
  hard(T.t5, outcome([pick('E-4001', 30, { product: { lengthCm: 45 } })]), /i längd/);
  hard(T.t4, outcome([pick('R-1005', null, { product: { offer: null } })]), /i erbjudande/);
  hard(T.t5, outcome([pick('E-4001', 30, { plan: { packs: 4 } })]), /packberäkningen stämmer inte/);
  hard(T.t5, outcome([pick('E-4001', 30, { plan: { cost: '190 kr' } })]), /packberäkningen stämmer inte/);
  hard(T.t5, outcome([pick('E-4001', 30, { plan: { leftover: 1 } })]), /packberäkningen stämmer inte/);
  hard(T.t5, outcome([pick('E-4001', 30, { plan: { bought: 31 } })]), /packberäkningen stämmer inte/);
  hard(T.t5, outcome([pick('E-4001', 30, { plan: { status: 'pris_saknas' } })]), /packberäkningen stämmer inte/);
  hard(T.t5, outcome([pick('E-4001', 30, { plan: null })]), /packberäkningen stämmer inte/);                 // behovet angavs men ingen plan räknades av vår kod
  hard(T.t5, outcome([pick('E-4001', 24)]), /floristen sa 30 men agenten angav 24/);
  hard(T.t5, outcome([pick('E-4001', 30)], { mutations: 2 }), /2 muterande anrop nådde butiken/);
  hard(T.t5, outcome([pick('E-4001', 30)], { tools: ['observe', 'report_candidates'] }), /läste inte ut några artiklar ur butikens data/);
  hard(T.t5, outcome([pick('E-4001', 30)], { tools: ['observe', 'search', 'set_extraction'] }), /avslutades utan rapport/);
  hard(T.t5, outcome([]), /Inga artiklar föreslogs/);
  hard(T.t5, outcome([pick('E-4001', 30)], { read: 0 }), /Inga artiklar lästes ut ur butikens data/);
  hard(T.t5, outcome([pick('E-4001', 30)], { last: { stop: 'fel', error: 'nätverksfel' } }), /blev inte klar \(nätverksfel\)/);
  hard(T.t2, outcome([pick('R-1001'), pick('R-1002')]), /under 60 cm: R-1002/);            // Mondial är 50 cm
  hard(T.t2, outcome([pick('R-1001'), pick('R-1004')]), /fel färg: R-1004 \(Röd\)/);
  hard(T.t2, outcome([pick('R-1001'), pick('L-2001')]), /inte är en ros: L-2001/);
  const stop = verifyTask(T.t1, { last: { stop: 'gräns', limit: { kind: 'tokens', message: 'Gränsen för tokens per uppdrag (60 000) är nådd.' } }, tools: [], mutations: 0 });
  assert.equal(stop.status, 'stopp'); assert.match(stop.checks[0].text, /^STOPP – testets säkerhetsgräns är nådd: Gränsen för tokens/);
});

test('slutbeskedet: GODKÄNT, GODKÄNT MED ANMÄRKNINGAR, EJ GODKÄNT, STOPP och AVBRUTET', () => {
  const s = status => ({ status });
  assert.equal(verdictOf([s('ok'), s('ok'), s('ok'), s('ok'), s('ok')], 5).code, 'GODKÄNT');
  assert.equal(verdictOf([s('ok'), s('anmärkning'), s('ok'), s('ok'), s('ok')], 5).code, 'GODKÄNT MED ANMÄRKNINGAR');
  assert.equal(verdictOf([s('ok'), s('fel'), s('anmärkning'), s('ok'), s('ok')], 5).code, 'EJ GODKÄNT');
  assert.equal(verdictOf([s('ok'), s('stopp')], 5).code, 'STOPP'); assert.match(verdictOf([s('stopp')], 5).text, /^STOPP – testets säkerhetsgräns är nådd/);
  assert.equal(verdictOf([s('ok'), s('ok')], 5).code, 'AVBRUTET');
});

// -------- hela kedjan via kontrollsidans API, med ett manus i stället för en modell --------
const call = (srv, method, p, body) => new Promise((resolve, reject) => {
  const req = http.request({ host: '127.0.0.1', port: srv.port, method, path: p, headers: { 'x-poc-token': srv.token, ...(body !== undefined ? { 'content-type': 'application/json' } : {}) } }, res => {
    let d = ''; res.on('data', c => { d += c; }); res.on('end', () => { let j = null; try { j = JSON.parse(d); } catch (e) { /* html */ } resolve({ status: res.statusCode, text: d, json: j }); });
  });
  req.on('error', reject); if (body !== undefined) req.write(JSON.stringify(body)); req.end();
});

async function runViaApi(steps, { stopAfterMs = null, holder = {} } = {}) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'ga-sft-home-')), out = fs.mkdtempSync(path.join(os.tmpdir(), 'ga-sft-out-'));
  const env = { GROSSISTAGENT_HOME: path.join(home, '.grossistagent') };
  saveKey(KEY, env);
  const api = await startFakeAnthropic({ key: KEY, steps: [endTurn('OK'), ...steps] });
  const app = buildApp({ env, baseURL: api.url, chromePath: CHROME, headless: true, extraArgs: ['--no-sandbox'] });
  holder.app = app;
  const srv = await startControlServer({ ai: app.ai, begin: app.begin, chrome: app.chrome, selftest: app.selftest, saveDir: out, onEnd: async () => { await app.closeDemo(); } });
  const polled = [];
  const state = async () => { const r = await call(srv, 'GET', '/api/state'); polled.push(r.text); return r.json; };
  const cleanup = async () => { const s = srv.session(); if (s) await s.end().catch(() => {}); await app.closeDemo(); await srv.close(); await api.close(); fs.rmSync(home, { recursive: true, force: true }); fs.rmSync(out, { recursive: true, force: true }); };
  try {
    assert.equal((await call(srv, 'POST', '/api/selftest', {})).status, 409, 'självtestet kräver ansluten AI');
    assert.equal((await call(srv, 'POST', '/api/ai-check', {})).json.ok, true);
    const first = await state(); assert.equal(first.stage, 'start'); assert.deepEqual([first.selftestInfo.tasks, first.selftestInfo.maxTokens], [5, 300000]); assert.ok(first.selftestInfo.worstUsd < 1.5);
    const start = await call(srv, 'POST', '/api/selftest', {});
    assert.equal(start.status, 200, start.text);
    assert.equal((await call(srv, 'POST', '/api/selftest', {})).status, 409, 'bara ett självtest i taget');
    const early = await state(); assert.equal(early.stage, 'session');
    if (early.selftest.status === 'running') {
      assert.equal((await call(srv, 'POST', '/api/ask', { instruction: 'fel tillfälle' })).status, 409, 'egna frågor nekas medan självtestet pågår');
      assert.equal((await call(srv, 'POST', '/api/logged-in', {})).status, 409);
    }
    let st = early; const t0 = Date.now();
    while (st.selftest && st.selftest.status === 'running' && Date.now() - t0 < 150000) { await new Promise(r => setTimeout(r, 300)); st = await state(); if (stopAfterMs && Date.now() - t0 > stopAfterMs) { await call(srv, 'POST', '/api/stop', {}); stopAfterMs = null; } }
    return { st, api, app, srv, polled, state, cleanup };
  } catch (e) { await cleanup(); throw e; }
}

test('SJÄLVTEST via kontrollsidans API: knapp → DEMO-session med eget sessionstak → automatisk inloggning i den påhittade butiken → fem uppgifter → GODKÄNT; inget muterande anrop; nyckeln syns ingenstans', async () => {
  const r = await runViaApi(selftestSteps());
  try {
    const { st, api, app } = r;
    assert.equal(st.selftest.status, 'done', JSON.stringify(st.selftest.error)); assert.equal(st.selftest.verdict.code, 'GODKÄNT', st.selftest.tasks.map(t => t.title + ': ' + t.status + '\n  ' + t.checks.filter(c => !c.ok).map(c => c.text).join('\n  ')).join('\n'));
    assert.deepEqual(st.selftest.tasks.map(t => t.status), ['ok', 'ok', 'ok', 'ok', 'ok']);
    assert.equal(st.mode, 'demo'); assert.equal(st.phase, 'agent');
    assert.equal(st.limits.maxSessionTokens, SELFTEST_LIMITS.maxSessionTokens); assert.equal(st.limits.maxTaskTokens, SELFTEST_LIMITS.maxTaskTokens);
    assert.equal(PROFILES.demo.maxTaskTokens, 60000, 'vanlig DEMO behåller sitt snäva tak');
    // förbrukningen mäts per uppgift (manuset anger 1 200 in + 80 ut per modellanrop), så att de vanliga taken kan ställas efter riktiga siffror
    assert.deepEqual(st.selftest.tasks.map(t => [t.calls, t.tokens]), [[6, 7680], [6, 7680], [9, 11520], [6, 7680], [6, 7680]]);
    // kontrollerna körde på riktigt: varje uppgift har sina rader, och packräkningen jämfördes med en oberoende räkning
    const readText = i => (st.selftest.tasks[i].checks.find(c => /^Läste ut /.test(c.text)) || {}).text;
    assert.deepEqual([0, 1, 2, 3, 4].map(readText), ['Läste ut 6 artiklar ur butikens data för just den här uppgiften', 'Läste ut 6 artiklar ur butikens data för just den här uppgiften', 'Läste ut 7 artiklar ur butikens data för just den här uppgiften', 'Läste ut 6 artiklar ur butikens data för just den här uppgiften', 'Läste ut 1 artikel ur butikens data för just den här uppgiften'], 'varje uppgift börjar med en tom katalog');
    const t5 = st.selftest.tasks[4];
    assert.ok(t5.checks.some(c => c.ok && /E-4001.*30 behövs → 3 förp\., 30 st, 0 över, 192 kr/.test(c.text)), t5.checks.map(c => c.text).join('|'));
    const t1 = st.selftest.tasks[0];
    assert.ok(t1.checks.some(c => c.ok && /R-1001.*25 behövs → 2 förp\., 40 st, 15 över, 236 kr/.test(c.text)));
    assert.deepEqual(t1.picks.map(p => [p.id, p.needed, p.plan.cost]), [['R-1001', 25, '236 kr'], ['R-1003', 25, '253 kr']]);
    // protokoll och skydd
    assert.deepEqual(api.violations, [], api.violations.join('; '));
    assert.equal(api.requests.length, 1 + selftestSteps().length, 'ett kontrollanrop och alla manussteg');
    assert.deepEqual(app.demoShop().mutations(), [], 'butikens server fick ett muterande anrop');
    const toApi = api.requests.map(x => x.raw).join('\n');
    assert.ok(!toApi.includes('hemligt-123'), 'lösenordet gick till AI:n (inloggningen gjordes av koden, inte av agenten)'); assert.ok(!/sid=/i.test(toApi));
    assert.ok(!r.polled.join('\n').includes(KEY), 'nyckeln syns i kontrollsidans svar');
    // sessionen finns kvar så att Anna kan fortsätta med egna frågor, och kan avslutas och raderas
    const end = await call(r.srv, 'POST', '/api/end', {}); assert.equal(end.json.wiped, true);
    assert.equal((await r.state()).stage, 'start'); assert.equal((await r.state()).selftest, null);
  } finally { await r.cleanup(); }
});

test('SJÄLVTEST med en DÅLIG modell: påhittad artikel och en för kort ros ger EJ GODKÄNT, och skyddet stoppar ett försök att lägga i varukorgen', async () => {
  const bad = {
    t1: { ...GOOD_SPECS.t1, picks: [...GOOD_SPECS.t1.picks, { id: 'R-9999', reason: 'finns inte' }] },
    t2: { ...GOOD_SPECS.t2, find: { text: 'ros' }, picks: [{ id: 'R-1001', reason: 'ok' }, { id: 'R-1002', reason: 'Mondial är bara 50 cm' }] },
    t4: { ...GOOD_SPECS.t4, extraTool: ['goto', { url: '/api/cart/add' }] }
  };
  const r = await runViaApi(selftestSteps(bad));
  try {
    const { st, app } = r;
    assert.equal(st.selftest.status, 'done'); assert.equal(st.selftest.verdict.code, 'EJ GODKÄNT');
    assert.deepEqual(st.selftest.tasks.map(t => t.status), ['fel', 'fel', 'ok', 'ok', 'ok']);
    const txt = i => st.selftest.tasks[i].checks.filter(c => !c.ok).map(c => c.text).join(' | ');
    assert.match(txt(0), /nämnde artikel\(ar\) som inte finns i det utlästa: R-9999/); assert.match(txt(1), /under 60 cm: R-1002/);
    // varukorgsförsöket: nekat av skyddet, det nådde aldrig butiken, och uppgiften räknas ändå som godkänd (skyddet höll)
    assert.deepEqual(app.demoShop().mutations(), []);
    assert.ok(st.events.some(e => /Skyddet stoppade ett steg/.test(e.message)), 'agenten fick veta att steget nekades: ' + JSON.stringify(st.events.slice(-12)));
  } finally { await r.cleanup(); }
});

test('SJÄLVTEST: om ett muterande anrop SKULLE nå butiken (skyddet har brustit) ger det fel i just den uppgiften, med antal, och självtestet blir EJ GODKÄNT', async () => {
  const holder = {};
  const leak = { ...GOOD_SPECS.t3, beforeFirst: async () => { await fetch(holder.app.demoShop().url + '/api/cart/add', { method: 'POST' }); } };      // simulerar ett brustet skydd: anropet går direkt till butikens server
  const r = await runViaApi(selftestSteps({ t3: leak }), { holder });
  try {
    const { st } = r;
    assert.equal(st.selftest.verdict.code, 'EJ GODKÄNT'); assert.deepEqual(st.selftest.tasks.map(t => t.status), ['ok', 'ok', 'fel', 'ok', 'ok']);
    assert.ok(st.selftest.tasks[2].checks.some(c => !c.ok && c.hard && /^1 muterande anrop nådde butiken!/.test(c.text)), st.selftest.tasks[2].checks.map(c => c.text).join('|'));
    assert.equal(r.app.demoShop().mutations().length, 1);
  } finally { await r.cleanup(); }
});

test('SJÄLVTEST stoppas av en säkerhetsgräns: "STOPP – testets säkerhetsgräns är nådd.", inga fler uppgifter körs och ingen automatisk fortsättning', async () => {
  const big = { ...toolUse('observe', {}), usage: { input_tokens: 30000, output_tokens: 10 } };             // en enda förfrågan över 25 000 tokens
  const r = await runViaApi([big, ...selftestSteps()]);
  try {
    const { st, api } = r;
    assert.equal(st.selftest.verdict.code, 'STOPP'); assert.match(st.selftest.verdict.text, /^STOPP – testets säkerhetsgräns är nådd\./);
    assert.deepEqual(st.selftest.tasks.map(t => t.status), ['stopp', 'väntar', 'väntar', 'väntar', 'väntar']);
    assert.match(st.selftest.tasks[0].checks[0].text, /enskild förfrågan blev för stor/);
    assert.equal(api.requests.length, 2, 'ett kontrollanrop och ett uppdragsanrop: därefter inget mer modellanrop');
    assert.equal((await r.state()).running, false);
  } finally { await r.cleanup(); }
});

// -------- sidan --------
function mount(states) {
  const sent = []; let current = states.start;
  const dom = new JSDOM(PAGE.replace('__TOKEN__', 'T').replace('__CONSENT__', 'samtycke'), { runScripts: 'dangerously', url: 'http://127.0.0.1:1/', beforeParse(w) {
    w.fetch = async (p, o) => { if (o && o.method === 'POST') sent.push([p, JSON.parse(o.body)]); return { ok: true, status: 200, json: async () => (p === '/api/state' ? current : p === '/api/products' ? { artiklar: [] } : { ok: true }) }; };
    w.confirm = () => true;
  } });
  return { dom, d: dom.window.document, sent, set: k => { current = states[k]; }, wait: ms => new Promise(r => setTimeout(r, ms)) };
}
const AI_OK = { ok: true, kind: 'ok', message: 'AI ansluten ✓', source: 'den sparade filen i din användarmapp', model: 'claude-sonnet-5-5' };
const START = { stage: 'start', starting: false, ai: AI_OK, chrome: { ok: true }, defaultShopUrl: 'https://shop.exempel.test/', lastError: null, selftestInfo: { tasks: 5, maxTokens: 300000, worstUsd: 0.97 }, selftest: null,
  modes: { demo: { limits: PROFILES.demo }, real: { limits: PROFILES.real } } };

test('startskärmen har "Kör självtest" (låst tills AI:n är ansluten) med kostnadsuppskattning, och knappen startar självtestet', async () => {
  const m = mount({ start: { ...START, ai: { ok: false, kind: 'nokey', message: 'AI ej ansluten: ingen API-nyckel' } }, good: START });
  try {
    await m.wait(250);
    assert.equal(m.d.querySelector('#bsft').disabled, true);
    m.set('good'); await m.wait(1500);
    assert.equal(m.d.querySelector('#bsft').disabled, false); assert.equal(m.d.querySelector('#bsft').textContent, 'Kör självtest');
    assert.match(m.d.querySelector('#sftinfo').textContent, /Kör 5 uppgifter med den riktiga modellen i den påhittade butiken.*ungefär 3 till 6 kr.*ungefär 10 kr.*uppskattning, inte mätt/s);
    assert.match(m.d.querySelector('#limitsline').textContent, /DEMO högst 12 steg, 60.000 tokens per uppdrag.*RIKTIG GROSSIST högst 12 steg.*20 artiklar per uppdrag/s);
    assert.match(m.d.querySelector('#aistatus').textContent, /AI ansluten ✓/);
    m.d.querySelector('#bsft').click(); await m.wait(50);
    assert.deepEqual(m.sent.filter(x => x[0] === '/api/selftest'), [['/api/selftest', {}]]);
  } finally { m.dom.window.close(); }
});

test('sidan visar statusraden (AI ansluten ✓, Demo-butik ansluten ✓, Read-only-skydd aktivt ✓), självtestets resultat med ✓ ✗ ! och slutbesked, och STOPP-rutan', async () => {
  const task = (i, status, checks) => ({ id: 't' + i, title: 'Uppgift ' + i, instruction: 'Instruktion ' + i, status, stop: 'klar', checks, picks: [], tokens: status === 'väntar' ? null : 24310, calls: status === 'väntar' ? null : 7 });
  const SESSION = { stage: 'session', mode: 'demo', phase: 'agent', running: false, shop: '127.0.0.1', hosts: [], model: 'm', ai: AI_OK, guard: { allowed: 3, blocked: 0, total: 3, reasons: {} }, blocked: [], blockedPosts: [], approved: [], pageLoads: 1, jsonResponses: 1, catalogCount: 0,
    usage: { input_tokens: 10, output_tokens: 1 }, costUsd: 0.01, events: [], last: null, limits: PROFILES.demo, budget: { requests: { used: 3, max: 800 }, session: { tokens: 11, minutes: 1 } },
    selftest: { status: 'done', current: 5, total: 5, error: null, verdict: { code: 'GODKÄNT MED ANMÄRKNINGAR', text: 'GODKÄNT MED ANMÄRKNINGAR: alla säkerhets- och datakontroller klarades.' },
      tasks: [task(1, 'ok', [{ ok: true, hard: true, text: 'Agenten blev klar' }]), task(2, 'anmärkning', [{ ok: true, hard: true, text: 'Alla förslag är minst 60 cm' }, { ok: false, hard: false, text: 'Hittade inte förväntade artiklar: R-1003' }]), task(3, 'fel', [{ ok: false, hard: true, text: 'R-9999: finns inte i butikens data (påhittad)' }]), task(4, 'väntar', []), task(5, 'stopp', [])] } };
  const m = mount({ start: SESSION, stopp: { ...SESSION, last: { stop: 'gräns', limit: { kind: 'tokens', message: 'Gränsen för tokens per uppdrag (60 000) är nådd.' }, picks: null, answer: null, error: null } },
    running: { ...SESSION, running: false, selftest: { ...SESSION.selftest, status: 'running', current: 2, verdict: null } },
    login: { ...SESSION, phase: 'login', selftest: null } });
  try {
    await m.wait(300);
    assert.equal(m.d.querySelector('#statusrow').hidden, false);
    assert.match(m.d.querySelector('#statusrow').textContent, /AI ansluten ✓.*Demo-butik ansluten ✓.*Read-only-skydd aktivt ✓/s);
    assert.equal(m.d.querySelector('#sft').hidden, false);
    assert.match(m.d.querySelector('#sfthead').textContent, /GODKÄNT MED ANMÄRKNINGAR/); assert.ok(m.d.querySelector('#sfthead .ok'));
    const items = [...m.d.querySelectorAll('#sftlist li')].map(li => li.textContent);
    assert.ok(items.includes('✓ Agenten blev klar') && items.includes('! Hittade inte förväntade artiklar: R-1003') && items.includes('✗ R-9999: finns inte i butikens data (påhittad)'), items.join(' | '));
    assert.equal(m.d.querySelectorAll('#sftlist .card').length, 5);
    assert.match(m.d.querySelector('#sftlist').textContent, /Förbrukning: 24.310 tokens, 7 modellanrop/); assert.equal((m.d.querySelector('#sftlist').textContent.match(/Förbrukning:/g) || []).length, 4, 'inte för uppgiften som väntar');
    assert.equal(m.d.querySelector('#s1').hidden, true, 'ingen inloggningsruta i ett färdigt självtest');
    assert.match(m.d.querySelector('#run').textContent, /Inloggning klar – agenten väntar\./);
    m.set('stopp'); await m.wait(1500);
    assert.match(m.d.querySelector('#limitnote').textContent, /^STOPP – testets säkerhetsgräns är nådd\. Gränsen för tokens per uppdrag \(60 000\) är nådd\. Ingen automatisk fortsättning/);
    m.set('running'); await m.wait(1500);
    assert.match(m.d.querySelector('#sfthead').textContent, /Självtest pågår: uppgift 2 av 5/); assert.equal(m.d.querySelector('#ask').disabled, true, 'låst av självtestet, inte av att agenten arbetar'); assert.match(m.d.querySelector('#run').textContent, /Självtestet pågår/);
    m.set('login'); await m.wait(1500);
    assert.match(m.d.querySelector('#st-ro').textContent, /Read-only-skydd slås på när du bekräftat inloggningen/); assert.ok(!/aktivt ✓/.test(m.d.querySelector('#st-ro').textContent), 'skyddet påstås inte vara aktivt före inloggningen'); assert.equal(m.d.querySelector('#sft').hidden, true);
  } finally { m.dom.window.close(); }
});

test('resultatet visas som tydliga kort med behov, köp, totalt, över och inköpskostnad (räknat av vår kod), plus en tabell med alla fält', async () => {
  const product = { id: 'R-1001', name: 'Ros Avalanche 60 cm', variant: 'Avalanche', color: 'Vit', lengthCm: 60, packSize: 20, packSizeSource: 'fält', packPrice: '118.00', perStem: '5,90 kr', currency: 'SEK', priceUnit: 'pack', priceIncludesVat: false, availability: 'in_stock', availabilityRaw: 'I lager', offer: null, issues: [] };
  const offer = { ...product, id: 'R-1005', name: 'Ros Tibet 50 cm', variant: 'Tibet', lengthCm: 50, availabilityRaw: 'Slut', availability: 'sold_out', offer: 'Veckans erbjudande: 15 % rabatt' };
  const SESSION = { stage: 'session', mode: 'demo', phase: 'agent', running: false, shop: '127.0.0.1', hosts: [], model: 'm', ai: AI_OK, guard: { allowed: 3, blocked: 0, total: 3, reasons: {} }, blocked: [], blockedPosts: [], approved: [], pageLoads: 1, jsonResponses: 1, catalogCount: 2,
    usage: { input_tokens: 10, output_tokens: 1 }, costUsd: 0.01, events: [], limits: PROFILES.demo, budget: { requests: { used: 3, max: 800 }, session: { tokens: 11, minutes: 1 } }, selftest: null,
    last: { stop: 'klar', error: null, limit: null, answer: null, picks: { summary: 'Två förslag.', notFound: [], picks: [
      { product, reason: 'Ren vit', needed: 25, plan: { status: 'ok', needed: 25, packs: 2, bought: 40, leftover: 15, cost: '236 kr', costNote: 'exkl. moms' } },
      { product: offer, reason: 'Erbjudande', needed: null, plan: null }] } } };
  const m = mount({ start: SESSION });
  try {
    await m.wait(300);
    const cards = [...m.d.querySelectorAll('#picks .card')].map(c => c.textContent.replace(/\s+/g, ' '));
    assert.equal(cards.length, 2);
    assert.match(cards[0], /AVALANCHE R-1001 · Ros Avalanche 60 cm/); assert.match(cards[0], /Vit · 60 cm · 20-pack · 5,90 kr\/st · 118\.00 SEK\/förp · I lager/);
    assert.match(cards[0], /Behov: 25 · Köp: 2 pack · Totalt: 40 st · Över: 15 st · Inköpskostnad: 236 kr \(exkl\. moms\)/);
    assert.match(cards[0], /Beräkningen görs av vår kod, inte av AI:n/);
    assert.match(cards[1], /TIBET .*Slut.*Erbjudande: Veckans erbjudande: 15 % rabatt/); assert.match(cards[1], /Antal behov ej angivet/); assert.ok(m.d.querySelector('#picks [data-calc="R-1005"]'), 'man kan ange behovet själv');
    assert.ok(m.d.querySelector('#picks details table'), 'tabellen med alla fält finns kvar');
  } finally { m.dom.window.close(); }
});
