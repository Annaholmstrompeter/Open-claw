// AI-kopplingen och nyckelhanteringen. Här används den RIKTIGA @anthropic-ai/sdk över riktig HTTP mot en lokal, Anthropic-kompatibel testserver
// (test/support/fake-anthropic.mjs). Det bevisar rubriker, felhantering, att nyckeln bara går i x-api-key, och att meddelandeprotokollet följs.
// Det bevisar INTE modellens omdöme (svaren är ett manus) och inte att nyckeln fungerar hos Anthropic (det kan bara ske med en riktig nyckel).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createAiClient, createAiService, checkAi, mapError, AiError, API_BASE } from '../src/ai.mjs';
import { runAgent } from '../src/agent.mjs';
import { TOOL_DEFS } from '../src/tools.mjs';
import { looksLikeKey, loadKey, saveKey, deleteKey, redact, envWithoutSecrets, keyPaths } from '../src/secrets.mjs';
import { startFakeAnthropic } from './support/fake-anthropic.mjs';
import { toolUse, endTurn } from './support/fake-client.mjs';

const KEY = 'sk-ant-api03-TESTKEY-0123456789abcdefghijklmnop';
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'ga-secret-'));
const noBox = () => ({ definitions: TOOL_DEFS, state: { final: null }, async execute(name) { return { is_error: false, content: JSON.stringify({ ok: true, name }) }; } });

test('nyckeln går bara i rubriken x-api-key till den adress som är låst, aldrig i kroppen, adressen eller någon annan rubrik, och miljön kan inte styra om den', async () => {
  const api = await startFakeAnthropic({ steps: [endTurn('OK')] });
  const saved = { b: process.env.ANTHROPIC_BASE_URL, t: process.env.ANTHROPIC_AUTH_TOKEN, k: process.env.ANTHROPIC_API_KEY, h: process.env.ANTHROPIC_CUSTOM_HEADERS };
  process.env.ANTHROPIC_BASE_URL = 'https://evil.example'; process.env.ANTHROPIC_AUTH_TOKEN = 'sk-ant-OAUTH-TOKEN-should-not-be-used'; process.env.ANTHROPIC_API_KEY = 'sk-ant-api03-OTHER-KEY-from-the-environment-000000';
  try {
    const client = createAiClient({ apiKey: KEY, baseURL: api.url });
    await client.messages.create({ model: 'claude-sonnet-5-5', max_tokens: 16, messages: [{ role: 'user', content: 'hej' }] });
    const r = api.requests[0];
    assert.equal(r.headers['x-api-key'], KEY);
    assert.ok(r.headers['anthropic-version']); assert.equal(r.headers.authorization, undefined, 'ingen annan inloggning får följa med');
    for (const [name, value] of Object.entries(r.headers)) if (name !== 'x-api-key') assert.ok(!String(value).includes(KEY) && !String(value).includes('OTHER-KEY') && !String(value).includes('OAUTH-TOKEN'), 'nyckeln i rubriken ' + name);
    assert.ok(!r.url.includes('sk-ant') && !r.raw.includes('sk-ant'), 'nyckeln i adress eller kropp');
    assert.deepEqual(api.violations, []);
    // standardadressen är Anthropic, även om miljön säger något annat; en främmande adress accepteras inte, och inte heller http utanför den egna datorn
    assert.equal(createAiClient({ apiKey: KEY }).baseURL, API_BASE);
    for (const bad of ['https://evil.example', 'http://evil.example', 'http://127.0.0.1.evil.example', 'https://api.anthropic.com.evil.example']) assert.throws(() => createAiClient({ apiKey: KEY, baseURL: bad }), e => e instanceof AiError && e.kind === 'adress', bad);
    assert.throws(() => createAiClient({ apiKey: '' }), e => e.kind === 'nokey');
  } finally {
    for (const [k, v] of [['ANTHROPIC_BASE_URL', saved.b], ['ANTHROPIC_AUTH_TOKEN', saved.t], ['ANTHROPIC_API_KEY', saved.k], ['ANTHROPIC_CUSTOM_HEADERS', saved.h]]) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
    await api.close();
  }
});

test('felen blir ett tydligt svenskt besked med rätt typ, och nyckeln kan aldrig komma med i meddelandet, ens om servern ekar den', async () => {
  const cases = [
    [{ error: { status: 401, type: 'authentication_error', message: 'invalid x-api-key ' + KEY } }, 'auth', /godkändes inte \(401\)/],
    [{ error: { status: 403, type: 'permission_error', message: 'nej ' + KEY } }, 'behorighet', /behörighet/],
    [{ error: { status: 404, type: 'not_found_error', message: 'model: claude-finns-inte' } }, 'modell', /Modellen finns inte/],
    [{ error: { status: 429, type: 'rate_limit_error', message: 'slow down' } }, 'tak', /utgiftstaket|För många anrop/],
    [{ error: { status: 400, type: 'invalid_request_error', message: 'Your credit balance is too low to access the Anthropic API.' } }, 'saldo', /tillgodohavande/],
    [{ error: { status: 400, type: 'invalid_request_error', message: 'messages: fel ' + KEY } }, 'forfragan', /avvisade anropet/],
    [{ error: { status: 529, type: 'overloaded_error', message: 'Overloaded' } }, 'tillfalligt', /tillfälliga problem/]
  ];
  for (const [step, kind, re] of cases) {
    const api = await startFakeAnthropic({ steps: [step, step, step] });
    try {
      const client = createAiClient({ apiKey: KEY, baseURL: api.url, maxRetries: 0 });
      await assert.rejects(() => client.messages.create({ model: 'm', max_tokens: 16, messages: [{ role: 'user', content: 'x' }] }), e => {
        assert.ok(e instanceof AiError, 'AiError för ' + kind); assert.equal(e.kind, kind); assert.match(e.message, re);
        assert.ok(!e.message.includes(KEY) && !e.message.includes('sk-ant-api03'), 'nyckeln i felet: ' + e.message);
        assert.ok(!JSON.stringify({ ...e, message: e.message, stack: undefined }).includes(KEY));
        return true;
      }, kind);
    } finally { await api.close(); }
  }
  // ingen kontakt alls: porten är stängd
  const dead = await startFakeAnthropic({}); const url = dead.url; await dead.close();
  await assert.rejects(() => createAiClient({ apiKey: KEY, baseURL: url, maxRetries: 0 }).messages.create({ model: 'm', max_tokens: 16, messages: [{ role: 'user', content: 'x' }] }), e => e.kind === 'natverk' && /Ingen kontakt/.test(e.message));
  assert.equal(mapError(new Error('Överraskning ' + KEY), KEY).message.includes(KEY), false);
});

test('checkAi: "AI ansluten ✓" med samma modell, verktyg och parametrar som uppdragen; tydligt fel för fel nyckel, saknad nyckel och nätverk', async () => {
  const api = await startFakeAnthropic({ steps: [{ stop_reason: 'max_tokens', content: [{ type: 'text', text: 'OK' }], usage: { input_tokens: 1800, output_tokens: 16 } }] });
  try {
    const ok = await checkAi({ client: createAiClient({ apiKey: KEY, baseURL: api.url }), model: 'claude-sonnet-5-5' });
    assert.deepEqual([ok.ok, ok.message], [true, 'AI ansluten ✓']);
    const b = api.requests[0].body;
    assert.deepEqual([b.model, b.max_tokens, b.output_config, b.tools.length, typeof b.system], ['claude-sonnet-5-5', 16, { effort: 'low' }, TOOL_DEFS.length, 'string']);
    assert.deepEqual(api.violations, []);
    const bad = await checkAi({ client: createAiClient({ apiKey: 'sk-ant-api03-FEL-NYCKEL-0123456789abcdefghijk', baseURL: api.url, maxRetries: 0 }) });
    assert.deepEqual([bad.ok, bad.kind], [false, 'auth']); assert.match(bad.message, /^AI ej ansluten: API-nyckeln godkändes inte/); assert.ok(!bad.message.includes('FEL-NYCKEL'));
    // tjänsten som kontrollsidan använder: saknad nyckel → tydligt besked, och aldrig nyckeln i statusen
    const home = tmp(); const env = { GROSSISTAGENT_HOME: home };
    const svc = createAiService({ env, baseURL: api.url });
    assert.equal((await svc.check()).kind, 'nokey'); assert.match(svc.status().message, /1-SETUP/);
    assert.throws(() => svc.makeClient(), e => e.kind === 'nokey');
    saveKey(KEY, env);
    api.steps.push({ stop_reason: 'end_turn', content: [{ type: 'text', text: 'OK' }], usage: { input_tokens: 1800, output_tokens: 3 } });
    const st = await svc.check();
    assert.deepEqual([st.ok, st.message, st.source], [true, 'AI ansluten ✓', 'den sparade filen i din användarmapp']);
    assert.ok(!JSON.stringify(svc.status()).includes(KEY) && !JSON.stringify(svc.status()).includes('sk-ant'), 'statusen får aldrig innehålla nyckeln');
    fs.rmSync(home, { recursive: true, force: true });
  } finally { await api.close(); }
});

test('avvisar modellen parametern effort provas anropet en gång utan den, och resten av sessionen går utan', async () => {
  const api = await startFakeAnthropic({ rejectEffort: true, steps: [endTurn('ett'), endTurn('två')] });
  try {
    const client = createAiClient({ apiKey: KEY, baseURL: api.url, maxRetries: 0 });
    const body = { model: 'm', max_tokens: 16, messages: [{ role: 'user', content: 'x' }], output_config: { effort: 'low' } };
    assert.equal((await client.messages.create(body)).content[0].text, 'ett');
    assert.equal((await client.messages.create(body)).content[0].text, 'två');
    assert.equal(api.effortRejections(), 1, 'bara ett avvisat anrop');
    assert.ok(api.requests.slice(1).every(r => !r.body.output_config));
  } finally { await api.close(); }
});

test('hela agentslingan över riktig SDK och HTTP: tänkande-block skickas tillbaka oförändrade, varje tool_use besvaras, och protokollet följs', async () => {
  const api = await startFakeAnthropic({ steps: [
    { stop_reason: 'tool_use', usage: { input_tokens: 1500, output_tokens: 90 }, content: [{ type: 'thinking', thinking: 'jag funderar', signature: 'sig-abc' }, { type: 'text', text: 'Jag börjar.' }, { type: 'tool_use', id: 'toolu_01', name: 'observe', input: {} }, { type: 'tool_use', id: 'toolu_02', name: 'goto', input: { url: '/x' } }] },
    (body, results) => { assert.equal(results.length, 2); return toolUse('report_candidates', { picks: [] }); },
    endTurn('klart')
  ] });
  try {
    const tb = noBox();
    tb.execute = (orig => async function (n, i) { const r = await orig.call(this, n, i); if (n === 'report_candidates') this.state.final = { picks: [], notFound: [], summary: '' }; return r; })(tb.execute);
    const res = await runAgent({ client: createAiClient({ apiKey: KEY, baseURL: api.url }), model: 'claude-sonnet-5-5', instruction: 'Hitta rosor', toolbox: tb });
    assert.equal(res.stop, 'klar', res.error); assert.equal(res.turns, 2);
    assert.deepEqual(api.violations, []);
    assert.equal(api.requests.length, 2);
    assert.deepEqual(api.requests[1].body.messages[1].content[0], { type: 'thinking', thinking: 'jag funderar', signature: 'sig-abc' });
    assert.deepEqual(res.usage, { input_tokens: 2700, output_tokens: 170, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 });
  } finally { await api.close(); }
});

test('Stoppa avbryter ett pågående modellanrop direkt, och ett fel från API:t ger stop "fel" utan nyckel', async () => {
  const slow = await startFakeAnthropic({ delayMs: 3000, steps: [endTurn('för sent')] });
  try {
    const ctl = new AbortController(); setTimeout(() => ctl.abort(), 150);
    const t0 = Date.now();
    const res = await runAgent({ client: createAiClient({ apiKey: KEY, baseURL: slow.url, maxRetries: 0 }), model: 'm', instruction: 'x', toolbox: noBox(), signal: ctl.signal });
    assert.equal(res.stop, 'avbruten'); assert.ok(Date.now() - t0 < 2000, 'avbröts snabbt: ' + (Date.now() - t0));
  } finally { await slow.close(); }
  const bad = await startFakeAnthropic({ steps: [{ error: { status: 401, type: 'authentication_error', message: 'invalid ' + KEY } }] });
  try {
    const res = await runAgent({ client: createAiClient({ apiKey: KEY, baseURL: bad.url, maxRetries: 0 }), model: 'm', instruction: 'x', toolbox: noBox() });
    assert.equal(res.stop, 'fel'); assert.match(res.error, /godkändes inte/); assert.ok(!res.error.includes(KEY));
  } finally { await bad.close(); }
});

test('även ett oväntat fel från en annan klient visar aldrig nyckeln i agentens felmeddelande', async () => {
  const res = await runAgent({ client: { messages: { create: async () => { throw new Error('boom ' + KEY + ' och sk-ant-oat01-ABCDEFGHIJKLMNOP'); } } }, model: 'm', instruction: 'x', toolbox: noBox() });
  assert.equal(res.stop, 'fel'); assert.ok(!res.error.includes(KEY) && !res.error.includes('sk-ant-oat01'), res.error); assert.match(res.error, /boom sk-ant-…\[dold\]/);
});

test('nyckelfilen: sparas utanför repot med bara ägarens rättigheter, läses färskt, raderas, och miljön går före filen', () => {
  const home = tmp(); const env = { GROSSISTAGENT_HOME: path.join(home, '.grossistagent') };
  try {
    assert.deepEqual(loadKey(env), { key: null, source: null });
    for (const bad of ['', 'abc', 'sk-ant-kort', 'sk-xyz-' + 'a'.repeat(40), KEY + ' extra', 'x'.repeat(10)]) assert.throws(() => saveKey(bad, env), /ser inte ut som en Anthropic-nyckel/, bad);
    const file = saveKey(' ' + KEY + ' \n', env);
    assert.equal(file, keyPaths(env).file);
    if (process.platform !== 'win32') { assert.equal(fs.statSync(file).mode & 0o777, 0o600); assert.equal(fs.statSync(path.dirname(file)).mode & 0o777, 0o700); }
    assert.equal(fs.readFileSync(file, 'utf8'), KEY + '\n');
    assert.deepEqual(loadKey(env), { key: KEY, source: 'den sparade filen i din användarmapp' });
    const other = 'sk-ant-api03-FRAN-MILJON-0123456789abcdefghijklm';
    assert.deepEqual(loadKey({ ...env, ANTHROPIC_API_KEY: other }), { key: other, source: 'miljövariabeln ANTHROPIC_API_KEY' });
    assert.equal(loadKey({ ...env, ANTHROPIC_API_KEY: 'skräp' }).key, KEY);
    assert.equal(deleteKey(env), true); assert.ok(!fs.existsSync(file)); assert.equal(loadKey(env).key, null); assert.equal(deleteKey(env), false);
    // aldrig inne i repot
    const here = path.dirname(new URL(import.meta.url).pathname);
    assert.throws(() => saveKey(KEY, { GROSSISTAGENT_HOME: path.join(here, '..', 'out-nyckel') }), /inte sparas inne i repot/);
    assert.ok(!fs.existsSync(path.join(here, '..', 'out-nyckel')));
  } finally { fs.rmSync(home, { recursive: true, force: true }); }
});

test('redact och envWithoutSecrets: nycklar och hemligheter tas bort ur texter och ur miljön som Chrome får', () => {
  assert.equal(redact('fel med ' + KEY + ' och sk-ant-oat01-ABCDEFGHIJKLMNOP', KEY), 'fel med sk-ant-…[dold] och sk-ant-…[dold]');
  assert.equal(redact('inget hemligt här'), 'inget hemligt här'); assert.equal(redact(undefined), '');
  assert.ok(looksLikeKey(KEY) && !looksLikeKey('sk-ant-') && !looksLikeKey(KEY + '\n\nextra'));
  const clean = envWithoutSecrets({ PATH: '/usr/bin', HOME: '/h', ANTHROPIC_API_KEY: KEY, ANTHROPIC_BASE_URL: 'x', OPENAI_API_KEY: 'y', MY_TOKEN: 't', GITHUB_PAT: 'p', DB_PASSWORD: 'z', LUGN: 'ok ' + KEY, TMPDIR: '/tmp/x', DISPLAY: ':0' });
  assert.deepEqual(clean, { PATH: '/usr/bin', HOME: '/h', TMPDIR: '/tmp/x', DISPLAY: ':0' });
});
