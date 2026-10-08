// Kontrollsidan och dess lokala server: nyckel, värdnamnskontroll, hela flödet via HTTP, och att sidan inte kan luras av data från webbplatsen (XSS).
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { JSDOM } from 'jsdom';
import { createSession } from '../src/session.mjs';
import { startControlServer, PAGE } from '../src/server.mjs';
import { startMockShop, PASS } from './support/mock-shop.mjs';
import { CHROME, humanLogin } from './support/browser.mjs';
import { scripted, toolUse, parse } from './support/fake-client.mjs';

const FIELDS = { id: 'artikelnr', name: 'benamning', color: 'farg', lengthCm: 'langd_cm', packSize: 'forpackning.antal', price: 'pris.belopp', priceUnit: 'pris.per', availability: 'lager.status' };
const call = (srv, method, p, { token = srv.token, headers = {}, body } = {}) => new Promise((resolve, reject) => {
  const req = http.request({ host: '127.0.0.1', port: srv.port, method, path: p, headers: { ...(token ? { 'x-poc-token': token } : {}), ...(body ? { 'content-type': 'application/json' } : {}), ...headers } }, res => {
    let d = ''; res.on('data', c => { d += c; }); res.on('end', () => { let j = null; try { j = JSON.parse(d); } catch (e) { /* html */ } resolve({ status: res.statusCode, headers: res.headers, text: d, json: j }); });
  });
  req.on('error', reject); if (body !== undefined) req.write(typeof body === 'string' ? body : JSON.stringify(body)); req.end();
});

async function setup(steps) {
  const shop = await startMockShop();
  const ids = {};
  const client = scripted(steps(ids));
  const session = await createSession({ shopUrl: shop.url + '/sortiment', executablePath: CHROME, headless: true, extraArgs: ['--no-sandbox'], client, limits: { minGapMs: 0 } });
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'poc-out-'));
  let ended = false;
  const srv = await startControlServer({ session, saveDir: out, onEnd: () => { ended = true; } });
  return { shop, session, srv, out, ended: () => ended, close: async () => { await session.end(); await srv.close(); await shop.close(); fs.rmSync(out, { recursive: true, force: true }); } };
}

test('nyckel och värdnamn: utan rätt nyckel, med fel värdnamn eller från en annan webbplats svarar servern 403 på allt', async () => {
  const t = await setup(() => []);
  try {
    assert.equal(t.srv.host, '127.0.0.1');                                                                                     // bara lokalt, aldrig på nätverket
    assert.equal((await call(t.srv, 'GET', '/', { token: null })).status, 403);
    assert.equal((await call(t.srv, 'GET', '/?t=fel', { token: null })).status, 403);
    const page = await call(t.srv, 'GET', '/?t=' + t.srv.token, { token: null });
    assert.equal(page.status, 200); assert.match(page.headers['content-security-policy'], /default-src 'none'/); assert.match(page.headers['content-security-policy'], /connect-src 'self'/);
    assert.ok(page.text.includes(t.srv.token) && page.text.includes('Jag är inloggad'));
    assert.equal(page.headers['access-control-allow-origin'], undefined);
    for (const [m, p] of [['GET', '/api/state'], ['GET', '/api/products'], ['POST', '/api/ask'], ['POST', '/api/end'], ['POST', '/api/logged-in']]) {
      assert.equal((await call(t.srv, m, p, { token: null })).status, 403, p);
      assert.equal((await call(t.srv, m, p, { token: 'fel' })).status, 403, p);
      assert.equal((await call(t.srv, m, p, { headers: { host: 'evil.test:' + t.srv.port } })).status, 403, 'värdnamn ' + p);
      assert.equal((await call(t.srv, m, p, { headers: { origin: 'https://evil.test' } })).status, 403, 'ursprung ' + p);
    }
    assert.equal((await call(t.srv, 'GET', '/api/state')).status, 200);
    assert.equal((await call(t.srv, 'GET', '/finns-inte')).status, 404);
    assert.equal((await call(t.srv, 'POST', '/api/ask', { body: '{trasig' })).status, 400);
    assert.equal(t.session.phase, 'login');
  } finally { await t.close(); }
});

test('hela flödet via kontrollsidans API: logga in, fråga, resultat, inköpsberäkning, godkänn en sökning, rapport och avsluta', async () => {
  const t = await setup(ids => [
    toolUse('search', { text: 'vit ros' }),
    (r, res) => { ids.j = parse(res[0]).json_svar.at(-1).id; return toolUse('set_extraction', { source: 'json', response_id: ids.j, items_path: 'resultat.artiklar', fields: FIELDS }); },
    () => toolUse('report_candidates', { picks: [{ id: 'R-1001', reason: 'klassisk vit', needed: 25 }] })
  ]);
  try {
    assert.equal((await call(t.srv, 'POST', '/api/ask', { body: { instruction: 'x' } })).status, 400);                     // före inloggning
    await humanLogin(t.session.page, t.shop.url);
    assert.equal((await call(t.srv, 'POST', '/api/logged-in', { body: { consent: true } })).status, 400);                    // villkoren inte bekräftade
    assert.equal((await call(t.srv, 'POST', '/api/logged-in', { body: {} })).status, 400);
    const li = await call(t.srv, 'POST', '/api/logged-in', { body: { consent: true, termsChecked: true } });
    assert.equal(li.status, 200); assert.equal(li.json.popupCheck, true);
    const ask = await call(t.srv, 'POST', '/api/ask', { body: { instruction: 'Hitta vita rosor, jag behöver 25' } });
    assert.equal(ask.status, 202);
    await t.srv.idle();
    const st = (await call(t.srv, 'GET', '/api/state')).json;
    assert.equal(st.running, false); assert.equal(st.last.stop, 'klar'); assert.equal(st.last.picks.picks[0].plan.cost, '236 kr');
    assert.equal(st.catalogCount, 5); assert.ok(!JSON.stringify(st).includes(PASS));
    const calc = await call(t.srv, 'POST', '/api/calc', { body: { id: 'R-1003', needed: 41 } });
    assert.deepEqual([calc.json.packs, calc.json.leftover, calc.json.cost], [3, 19, '379,50 kr']);
    assert.equal((await call(t.srv, 'POST', '/api/calc', { body: { id: 'R-1003', needed: 'x' } })).json.status, 'ogiltigt_antal');          // ogiltigt antal är ett besked, inte ett serverfel
    assert.equal((await call(t.srv, 'POST', '/api/calc', { body: { id: 'okänd', needed: 5 } })).status, 400);
    assert.equal((await call(t.srv, 'POST', '/api/allow-post', { body: { index: 3 } })).status, 400);
    assert.equal((await call(t.srv, 'GET', '/api/products')).json.artiklar.length, 5);
    const rep = await call(t.srv, 'POST', '/api/save-report', { body: { includeProducts: false } });
    assert.ok(fs.existsSync(rep.json.fil) && !fs.readFileSync(rep.json.fil, 'utf8').includes('Avalanche'));
    const end = await call(t.srv, 'POST', '/api/end', { body: {} });
    assert.equal(end.json.wiped, true); await new Promise(r => setTimeout(r, 400)); assert.equal(t.ended(), true);
    assert.deepEqual(t.shop.mutations(), []);
  } finally { await t.close(); }
});

test('en för stor kropp avvisas, och sidan innehåller inga externa adresser', async () => {
  const t = await setup(() => []);
  try {
    await assert.rejects(() => call(t.srv, 'POST', '/api/ask', { body: 'x'.repeat(60000) }));
    assert.equal((await call(t.srv, 'GET', '/api/state')).status, 200);                                                         // servern lever
    assert.ok(!/https?:\/\//.test(PAGE), 'sidan ska inte läsa in något utifrån');
    assert.ok(!/<script[^>]+src=|<link[^>]+href=|<img[^>]+src=/i.test(PAGE));
  } finally { await t.close(); }
});

test('sidan visar data från webbplatsen som text: namn med HTML eller skript blir aldrig element eller kod', async () => {
  const evil = '<img src=x onerror="window.pwned=1"><b>fet</b>';
  const product = { id: evil, name: evil, variant: evil, color: evil, lengthCm: 60, packSize: 10, packSizeSource: 'fält', packPrice: '118.00', currency: 'SEK', currencyAssumed: false, priceUnit: 'pack', priceDerived: false, priceIncludesVat: null, availability: 'in_stock', availabilityRaw: evil, offer: evil, extras: {}, issues: [evil] };
  const state = { phase: 'agent', running: false, shop: evil, hosts: [], model: 'm', guard: { allowed: 1, blocked: 1, total: 2, reasons: {} }, blocked: [{ method: 'POST', host: evil, path: '/' + evil, reason: evil, allow: false }], blockedPosts: [{ index: 0, host: evil, path: evil }], approved: [],
    pageLoads: 1, jsonResponses: 1, catalogCount: 1, usage: { input_tokens: 1, output_tokens: 1 }, costUsd: 0.01, events: [{ type: evil, message: evil }], lastError: evil,
    last: { stop: 'klar', text: evil, error: evil, picks: { summary: evil, notFound: [evil], picks: [{ product, reason: evil, needed: 25, plan: { status: 'ok', needed: 25, packs: 2, bought: 40, leftover: 15, cost: evil, costNote: evil } }] } } };
  const dom = new JSDOM(PAGE.replace('__TOKEN__', 'T'), { runScripts: 'dangerously', url: 'http://127.0.0.1:1/', beforeParse(w) {
    w.fetch = async p => ({ ok: true, status: 200, json: async () => (p === '/api/state' ? state : { artiklar: [product] }) });
    w.confirm = () => true;
  } });
  await new Promise(r => setTimeout(r, 300));
  const d = dom.window.document;
  assert.equal(d.querySelectorAll('img').length, 0); assert.equal(d.querySelectorAll('main b').length, 0); assert.equal(dom.window.pwned, undefined);
  assert.ok(d.body.textContent.includes('<img src=x onerror="window.pwned=1">'), 'texten visas ordagrant');
  assert.ok(d.querySelector('#picks table'), 'resultattabellen ritades'); assert.ok(d.querySelector('[data-allow="0"]'), 'knappen för att godkänna en läsande sökning finns');
  dom.window.close();
});
