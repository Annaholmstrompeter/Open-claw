// Kostnadsskydd och gränser: steg, tokens, tid, verktygsanrop, webbläsaranrop och artiklar per uppdrag. Varje gräns stoppar agenten (stop "gräns" med orsak),
// och efter en sessionsgräns kan varken AI:n eller webbläsaren göra något mer. Statusraderna visar aldrig modellens egen text.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createBudget, PROFILES, SELFTEST_LIMITS, STOP_HEADLINE, profileFor, worstCaseUsd } from '../src/limits.mjs';
import { statusBefore, statusAfter } from '../src/status.mjs';
import { createGuard } from '../src/guard.mjs';
import { createSession } from '../src/session.mjs';
import { runAgent } from '../src/agent.mjs';
import { TOOL_DEFS } from '../src/tools.mjs';
import { startMockShop } from './support/mock-shop.mjs';
import { CHROME, humanLogin } from './support/browser.mjs';
import { scripted, toolUse, endTurn, parse } from './support/fake-client.mjs';

const FIELDS = { id: 'artikelnr', name: 'benamning', color: 'farg', lengthCm: 'langd_cm', packSize: 'forpackning.antal', price: 'pris.belopp', priceUnit: 'pris.per', availability: 'lager.status' };
const box = (calls = []) => ({ definitions: TOOL_DEFS, state: { final: null }, calls, async execute(name, input) { calls.push(name); return { is_error: false, content: '{"ok":true}' }; } });

async function start(client, over = {}) {
  const shop = await startMockShop();
  const s = await createSession({ shopUrl: shop.url + '/sortiment', executablePath: CHROME, headless: true, extraArgs: ['--no-sandbox'], client, limits: { minGapMs: 0 }, ...over });
  await humanLogin(s.page, shop.url);
  await s.confirmLogin({ consent: true });
  return { shop, s, close: async () => { await s.end(); await shop.close(); } };
}

test('profilerna: konservativa tak för första experimentet (långt under tidigare 120 000/150 000 tokens), RIKTIG GROSSIST minst lika snäv, 20 artiklar och lugn takt, och små belopp i kronor', () => {
  const d = PROFILES.demo, r = PROFILES.real;
  assert.ok(d.maxTaskTokens <= 60000 && r.maxTaskTokens <= 60000, 'högst hälften av de tidigare 120 000 per uppdrag');
  assert.ok(d.maxSessionTokens <= 180000 && r.maxSessionTokens <= 180000, 'sessionstak');
  assert.ok(d.maxTurns <= 12 && r.maxTurns <= 12 && d.maxToolCalls <= 24 && r.maxToolCalls <= 24, 'steg och verktygsanrop');
  assert.ok(d.maxCallTokens <= 25000 && d.maxOutputTokens <= 3000 && d.maxResultChars <= 4000, 'skydd mot onödigt stora prompts och svar');
  assert.ok(r.minGapMs >= d.minGapMs && r.minGapMs >= 2000, 'lugnare takt mot en riktig grossist');
  assert.equal(r.maxProductsPerTask, 20); assert.equal(r.maxSessionMinutes, 30);
  assert.ok(worstCaseUsd(r) < 1 && worstCaseUsd(d) < 1, 'övre tak för AI-kostnaden per session: ' + worstCaseUsd(r) + ' / ' + worstCaseUsd(d) + ' USD');
  assert.ok(worstCaseUsd({ ...d, ...SELFTEST_LIMITS }) < 1.5, 'självtestet kostar högst ungefär 1 USD');
  assert.equal(SELFTEST_LIMITS.maxSessionTokens, 300000);
  assert.equal(SELFTEST_LIMITS.maxTaskTokens, 80000); assert.ok(SELFTEST_LIMITS.maxTaskTokens < 120000 && SELFTEST_LIMITS.maxTaskTokens > d.maxTaskTokens, 'självtestets uppdrag får lite mer luft än vanlig DEMO, men långt under tidigare 120 000');
  assert.equal(STOP_HEADLINE, 'STOPP – testets säkerhetsgräns är nådd.');
  assert.throws(() => profileFor('annat'), /Okänt läge/); assert.equal(profileFor('real', { maxTurns: 3 }).maxTurns, 3);
});

test('en enskild förfrågan som är för stor stoppar uppdraget (skydd mot onödigt stora prompts), och nästa uppdrag börjar om', () => {
  let clock = 0;
  const b = createBudget({ ...PROFILES.demo, maxCallTokens: 10000 }, { now: () => clock });
  b.beginTask(); b.addUsage({ input_tokens: 9000, output_tokens: 500 });
  assert.equal(b.check({ predictive: true }), null, 'precis under gränsen');
  b.addUsage({ input_tokens: 10200, output_tokens: 100 });
  const hit = b.check();
  assert.equal(hit.kind, 'forfragan'); assert.match(hit.message, /enskild förfrågan blev för stor/);
  b.beginTask(); assert.equal(b.check(), null, 'ett nytt uppdrag börjar om');
});

test('budgeten: tokens per uppdrag och per session, steg, tid, verktygsanrop och artiklar; framåtblickande så att nästa anrop inte får spräcka taket', () => {
  let clock = 0;
  const mk = over => createBudget({ ...PROFILES.real, ...over }, { now: () => clock });
  let b = mk({ maxTaskTokens: 10000 });
  b.beginTask(); b.addUsage({ input_tokens: 4000, output_tokens: 500 });
  assert.equal(b.check({ predictive: true }), null);                                    // 4500 + 4500 (lika stort som förra) = 9000 ≤ 10000
  b.addUsage({ input_tokens: 4000, output_tokens: 500 });
  assert.equal(b.check({ predictive: true }).kind, 'tokens');
  assert.equal(b.check().kind, 'tokens', 'en gräns som nåtts ligger kvar');
  b = mk({ maxSessionTokens: 5000, maxTaskTokens: 99999 });
  b.beginTask(); b.addUsage({ input_tokens: 1500, output_tokens: 100 });
  assert.equal(b.check({ predictive: true }), null, '1600 + 3000 (minsta antagande för nästa anrop) ryms i 5000');
});

test('budgeten, forts.: sessionstokens, tid, steg, verktyg, artiklar och externa gränser', () => {
  let clock = 1000;
  const mk = over => createBudget({ ...PROFILES.real, ...over }, { now: () => clock, ...(over && over.__ext ? { external: over.__ext } : {}) });
  let b = mk({ maxSessionTokens: 5000, maxTaskTokens: 99999 });
  b.beginTask(); b.addUsage({ input_tokens: 2500, output_tokens: 100 });
  assert.equal(b.check({ predictive: true }).kind, 'sessionstokens', '2600 + 3000 > 5000');
  b.beginTask();                                                                         // nytt uppdrag nollställer uppdragets räknare men inte sessionens
  assert.equal(b.snapshot().task.tokens, 0); assert.equal(b.snapshot().session.tokens, 2600);
  assert.equal(b.check({ predictive: true }).kind, 'sessionstokens');
  b = mk({ maxTaskSeconds: 60, maxSessionMinutes: 5 });
  b.beginTask(); clock += 59000; assert.equal(b.check(), null); clock += 2000; assert.equal(b.check().kind, 'tid');
  b = mk({ maxTaskSeconds: 9999, maxSessionMinutes: 5 }); b.beginTask(); clock += 5 * 60000 + 1; assert.equal(b.check().kind, 'sessionstid');
  b = mk({ maxTurns: 2 }); b.beginTask(); b.addUsage({ input_tokens: 1, output_tokens: 1 }); assert.equal(b.check({ predictive: true }), null); b.addUsage({ input_tokens: 1, output_tokens: 1 }); assert.equal(b.check({ predictive: true }).kind, 'steg');
  b = mk({ maxToolCalls: 2 }); b.beginTask(); assert.equal(b.addToolCall(), null); assert.equal(b.addToolCall(), null); assert.equal(b.addToolCall().kind, 'verktyg');
  b = mk({ maxProductsPerTask: 5 }); b.beginTask(); assert.equal(b.productRoom(), 5); b.addProducts(3); assert.equal(b.productRoom(), 2); b.addProducts(9); assert.equal(b.productRoom(), 0);
  let hit = null; b = createBudget(PROFILES.real, { now: () => clock, external: () => hit }); b.beginTask(); assert.equal(b.check(), null);
  hit = { kind: 'webblasaranrop', message: 'tak' }; assert.equal(b.check().kind, 'webblasaranrop');
});

test('skyddets tak för webbläsaranrop: efter N tillåtna anrop i agentfasen nekas allt, inloggningsfasen berörs inte, och expire stänger direkt', () => {
  const g = createGuard({ hosts: ['shop.test'], maxRequests: 3 });
  const get = p => g.decide({ method: 'GET', url: 'https://shop.test' + p, resourceType: 'xhr' });
  for (let i = 0; i < 10; i++) assert.equal(get('/a' + i).allow, true, 'inloggningsfasen räknas inte');
  assert.equal(g.requests().used, 0);
  g.setPhase('agent');
  assert.deepEqual([get('/1').allow, get('/2').allow, get('/3').allow], [true, true, true]);
  const d = get('/4'); assert.equal(d.allow, false); assert.match(d.reason, /gräns för antal webbläsaranrop \(3\)/);
  assert.deepEqual(g.requests(), { used: 3, max: 3, exhausted: true });
  assert.equal(get('/5').allow, false, 'ligger kvar');
  const g2 = createGuard({ hosts: ['shop.test'] }); g2.setPhase('agent'); assert.equal(g2.decide({ method: 'GET', url: 'https://shop.test/x', resourceType: 'xhr' }).allow, true);
  g2.expire('sessionen är slut'); assert.equal(g2.decide({ method: 'GET', url: 'https://shop.test/x', resourceType: 'xhr' }).allow, false);
  assert.equal(g2.blocked().at(-1).reason, 'sessionen är slut');
});

test('slingan stoppar med "gräns" och orsak: tokens, verktygsanrop och tid, och kör aldrig verktyg från ett avkortat svar', async () => {
  let b = createBudget({ ...PROFILES.demo, maxTaskTokens: 5000 });
  b.beginTask();
  let client = scripted([toolUse('observe', {}), toolUse('observe', {}), toolUse('observe', {}), endTurn('aldrig')]);        // 1280 tokens per anrop
  let calls = [], events = [];
  let res = await runAgent({ client, model: 'm', instruction: 'x', toolbox: box(calls), budget: b, onEvent: e => events.push(e) });
  assert.deepEqual([res.stop, res.limit.kind, res.turns, calls.length, client.requests.length], ['gräns', 'tokens', 2, 2, 2]);
  assert.match(res.limit.message, /tokens per uppdrag/); assert.ok(events.some(e => e.type === 'gräns' && e.kind === 'tokens'));

  b = createBudget({ ...PROFILES.demo, maxToolCalls: 2 }); b.beginTask(); calls = [];
  client = scripted([toolUse('observe', {}), toolUse('observe', {}), toolUse('observe', {}), toolUse('observe', {})]);
  res = await runAgent({ client, model: 'm', instruction: 'x', toolbox: box(calls), budget: b });
  assert.deepEqual([res.stop, res.limit.kind, calls.length, client.requests.length], ['gräns', 'verktyg', 2, 3]);

  let clock = 0; b = createBudget({ ...PROFILES.demo, maxTaskSeconds: 100 }, { now: () => clock }); b.beginTask(); calls = [];
  client = scripted([() => { clock += 101000; return toolUse('observe', {}); }, endTurn('aldrig')]);
  res = await runAgent({ client, model: 'm', instruction: 'x', toolbox: box(calls), budget: b });
  assert.deepEqual([res.stop, res.limit.kind, calls.length], ['gräns', 'tid', 0]);                  // tiden gick ut medan modellen tänkte: verktyget kördes inte

  calls = [];                                                                                         // ett avkortat eller avvisat svar kör aldrig sina verktyg
  for (const [reason, stop] of [['max_tokens', 'max_tokens'], ['refusal', 'avvisad']]) {
    const r = await runAgent({ client: { messages: { create: async () => ({ stop_reason: reason, content: [{ type: 'tool_use', id: 'a', name: 'observe', input: {} }], usage: {} }) } }, model: 'm', instruction: 'x', toolbox: box(calls) });
    assert.equal(r.stop, stop);
  }
  assert.deepEqual(calls, []);
});

test('statusraderna: korta, på svenska, från vår kod; modellens text och tänkande visas aldrig', async () => {
  assert.equal(statusBefore('search', { text: 'vita rosor' }), 'Söker efter «vita rosor»…');
  assert.equal(statusBefore('inspect_json', {}), 'Läser produktinformation…');
  assert.equal(statusAfter('find_products', {}, { traffar: 5 }), 'Hittade 5 produkter…'); assert.equal(statusAfter('find_products', {}, { traffar: 1 }), 'Hittade 1 produkt…');
  assert.equal(statusAfter('report_candidates', {}, { mottaget: 2 }), 'Klart ✓');
  assert.equal(statusAfter('set_extraction', {}, { antal: 3, begransad: true }), 'Läste ut 3 produkter (taket för testet nått)…');
  assert.match(statusAfter('click', {}, null, true, 'Nekad: elementet "Lägg i varukorg" liknar köp'), /^Skyddet stoppade ett steg: elementet/);
  assert.equal(statusAfter('observe', {}, { url: 'x' }), null);
  assert.equal(statusBefore('search', { text: 'x'.repeat(500) }).length < 90, true);
  // en hel slinga: bara statusrader går ut, aldrig text från modellen
  const events = [];
  const client = scripted([toolUse('observe', {}, 'HEMLIG RESONEMANGSTEXT: jag tänker köpa allt'), { stop_reason: 'end_turn', usage: {}, content: [{ type: 'thinking', thinking: 'HEMLIGT TÄNKANDE', signature: 's' }, { type: 'text', text: 'SLUTSVAR' }] }]);
  const res = await runAgent({ client, model: 'm', instruction: 'x', toolbox: box(), onEvent: e => events.push(e) });
  assert.equal(res.text, 'SLUTSVAR');
  const shown = JSON.stringify(events);
  assert.ok(!shown.includes('HEMLIG') && !shown.includes('SLUTSVAR'), 'modellens text får inte skickas vidare som händelse: ' + shown);
  assert.deepEqual(events.filter(e => e.type === 'status').map(e => e.text), ['Tittar på sidan…']);
});

test('sessionen: artiklar per uppdrag är begränsade (i första testet 20, här 3), taket nollställs per uppdrag, och agenten får veta att taket är nått', async () => {
  let ids = {};
  const client = scripted([
    toolUse('search', { text: 'ros' }),
    (r, res) => { ids.j = parse(res[0]).json_svar.at(-1).id; return toolUse('set_extraction', { source: 'json', response_id: ids.j, items_path: 'resultat.artiklar', fields: FIELDS }); },
    (r, res) => { const o = parse(res[0]); assert.deepEqual([o.antal, o.begransad, o.utanforTaket], [3, true, 3]); assert.match(o.rad, /Taket för testet \(3 artiklar per uppdrag\)/); return toolUse('report_candidates', { picks: [{ id: 'R-1001', reason: 'x' }] }); },
    toolUse('search', { text: 'ros' }),
    (r, res) => { ids.j = parse(res[0]).json_svar.at(-1).id; return toolUse('set_extraction', { source: 'json', response_id: ids.j, items_path: 'resultat.artiklar', fields: FIELDS }); },
    toolUse('report_candidates', { picks: [] })
  ]);
  const t = await start(client, { limits: { minGapMs: 0, maxProductsPerTask: 3 } });
  try {
    const first = await t.s.ask('Hitta rosor'); assert.equal(first.stop, 'klar', first.error);
    assert.equal(t.s.state().catalogCount, 3);
    assert.ok(t.s.state().events.some(e => e.message === 'Läste ut 3 produkter (taket för testet nått)…'), JSON.stringify(t.s.state().events.map(e => e.message)));
    const second = await t.s.ask('Hitta fler rosor'); assert.equal(second.stop, 'klar', second.error);
    assert.equal(t.s.state().catalogCount, 6, 'redan kända artiklar räknas inte, tre nya fick plats i det nya uppdraget');
    assert.deepEqual(t.shop.mutations(), []);
  } finally { await t.close(); }
});

test('sessionen: verktygsanrop, webbläsaranrop och tid stoppar agenten, och därefter kan varken AI:n eller webbläsaren göra något mer', async () => {
  // verktygsanrop (hård gräns i slingan)
  let client = scripted(Array.from({ length: 8 }, () => toolUse('observe', {})));
  let t = await start(client, { limits: { minGapMs: 0, maxToolCalls: 3 } });
  try {
    const res = await t.s.ask('Titta runt'); assert.deepEqual([res.stop, res.limit.kind, client.requests.length], ['gräns', 'verktyg', 4]);
    assert.ok(t.s.state().events.some(e => e.type === 'gräns' && /verktygsanrop \(3 per uppdrag\)/.test(e.message)));
    const next = await t.s.ask('Igen'); assert.deepEqual([next.stop, next.limit.kind, client.requests.length], ['gräns', 'verktyg', 8]);       // ett nytt uppdrag får nya tre verktygsanrop
  } finally { await t.close(); }

  // webbläsaranrop
  client = scripted(Array.from({ length: 12 }, (_, i) => toolUse('goto', { url: '/sok?q=ros&n=' + i })));
  t = await start(client, { limits: { minGapMs: 0, maxRequests: 6 } });
  try {
    const before = t.shop.requests.length;
    const res = await t.s.ask('Bläddra'); assert.deepEqual([res.stop, res.limit.kind], ['gräns', 'webblasaranrop']);
    const st = t.s.state(); assert.deepEqual([st.budget.requests.used, st.budget.requests.max, st.budget.requests.exhausted], [6, 6, true]);
    assert.ok(t.shop.requests.length - before <= 6, 'servern fick högst 6 anrop: ' + (t.shop.requests.length - before));
    const n = t.shop.requests.length;
    await t.s.page.goto(t.shop.url + '/sortiment').catch(() => {});
    assert.equal(t.shop.requests.length, n, 'efter taket nekas allt, även webbläsarens egna anrop');
    assert.deepEqual(t.shop.mutations(), []);
  } finally { await t.close(); }

  // sessionstokens: ingen mer AI och ingen mer webbläsare, och det finns inget anrop till modellen i nästa uppdrag
  client = scripted([toolUse('observe', {}), endTurn('aldrig'), endTurn('aldrig')]);
  t = await start(client, { limits: { minGapMs: 0, maxSessionTokens: 3000, maxTaskTokens: 99999 } });
  try {
    const first = await t.s.ask('Titta'); assert.deepEqual([first.stop, first.limit.kind, client.requests.length], ['gräns', 'sessionstokens', 1]);
    const second = await t.s.ask('Titta igen'); assert.deepEqual([second.stop, second.limit.kind, client.requests.length], ['gräns', 'sessionstokens', 1], 'inget nytt modellanrop');
    const n = t.shop.requests.length; await t.s.page.goto(t.shop.url + '/sortiment').catch(() => {}); assert.equal(t.shop.requests.length, n, 'webbläsaren är stängd för alla anrop');
    assert.match(JSON.stringify(t.s.state().blocked), /tokens per session/);
  } finally { await t.close(); }

  // tid: uppdragets tidsgräns (klocka som styrs av testet)
  let clock = 1_800_000_000_000;
  client = scripted([() => { clock += 241000; return toolUse('observe', {}); }, endTurn('aldrig')]);
  t = await start(client, { now: () => new Date(clock) });
  try {
    const res = await t.s.ask('Titta'); assert.deepEqual([res.stop, res.limit.kind], ['gräns', 'tid']); assert.match(res.limit.message, /240 s/);
  } finally { await t.close(); }
});

test('när modellen stoppar av annat skäl än att bli klar visas ett begripligt besked, och Stoppa ger "Avbruten."', async () => {
  for (const [reason, re] of [['max_tokens', /avkortades/], ['refusal', /avvisade/]]) {
    const t = await start({ messages: { create: async () => ({ stop_reason: reason, content: [{ type: 'text', text: 'x' }], usage: { input_tokens: 10, output_tokens: 5 } }) } });
    try { const res = await t.s.ask('Hitta rosor'); assert.match(res.error, re); assert.equal(t.s.state().last.error, res.error); } finally { await t.close(); }
  }
  let resolveCall;
  const hang = { messages: { create: (req, opts) => new Promise((_, reject) => { opts.signal.addEventListener('abort', () => reject(new Error('avbruten'))); resolveCall = reject; }) } };
  const t = await start(hang);
  try {
    const p = t.s.ask('Hitta rosor'); await new Promise(r => setTimeout(r, 200)); t.s.stop();
    const res = await p; assert.equal(res.stop, 'avbruten'); assert.ok(t.s.state().events.some(e => e.message === 'Avbruten.'));
  } finally { await t.close(); }
});
