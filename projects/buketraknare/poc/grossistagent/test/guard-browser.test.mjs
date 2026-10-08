// Skyddet mot en riktig webbläsare (Playwright, hela kontexten) och en påhittad butik. Beviset är att butikens server aldrig får ett enda
// muterande anrop, och att inloggningen finns kvar efteråt. Allt sidan själv försöker (fetch, beacon, XHR, formulär, bild, popup, worker, iframe, websocket) går genom skyddet.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createGuard, attachGuard } from '../src/guard.mjs';
import { startMockShop } from './support/mock-shop.mjs';
import { launchTestBrowser, humanLogin, wait } from './support/browser.mjs';

async function setup() {
  const shop = await startMockShop();
  const { browser, context, page } = await launchTestBrowser();
  const guard = createGuard({ hosts: ['127.0.0.1'] });
  await attachGuard(context, guard);                                   // i inloggningsfasen släpper skyddet igenom allt
  await humanLogin(page, shop.url);
  return { shop, browser, context, page, guard, close: async () => { await browser.close(); await shop.close(); } };
}
const tryIn = (page, src) => page.evaluate(`(async () => { try { ${src} } catch (e) { return 'nekat: ' + e.message; } })()`);
/** Ett riktigt klick (användaraktivering) som öppnar ett popup-fönster mot adressen. */
async function popupVia(page, url) {
  await page.evaluate(u => { const b = document.createElement('button'); b.className = 'pp'; b.style.cssText = 'position:fixed;top:0;left:0;width:20px;height:20px;z-index:99999'; b.onclick = () => window.open(u); document.body.appendChild(b); }, url);
  await page.click('button.pp'); await page.evaluate(() => document.querySelectorAll('button.pp').forEach(b => b.remove()));
}

test('människan loggar in med skyddet påkopplat (inloggningsfasen), och läsning fungerar därefter i agentfasen', async () => {
  const t = await setup();
  try {
    assert.match(t.page.url(), /\/sortiment$/);
    assert.equal(t.shop.sessionCount(), 1);
    t.guard.setPhase('agent');
    assert.equal(await tryIn(t.page, "const r = await fetch('/api/products?q=ros'); return r.status;"), 200);
    await t.page.fill('#q', 'vit ros'); await t.page.keyboard.press('Enter');
    await t.page.waitForFunction(() => /träffar/.test(document.getElementById('status').textContent), null, { timeout: 5000 });
    assert.match(await t.page.$eval('#status', e => e.textContent), /\d+ träffar/);
    assert.equal(t.shop.mutations().length, 0);
  } finally { await t.close(); }
});

test('allt sidan själv försöker göra som ändrar något nekas, och servern får aldrig ett enda muterande anrop', async () => {
  const t = await setup();
  try {
    t.guard.setPhase('agent');
    const attempts = {
      'fetch POST varukorg': "await fetch('/api/cart/add', { method: 'POST', body: '{}' }); return 'SKICKAT';",
      'fetch POST beställning': "await fetch('/api/order', { method: 'POST' }); return 'SKICKAT';",
      'fetch PUT och DELETE': "await fetch('/api/products/1', { method: 'PUT' }); await fetch('/api/products/1', { method: 'DELETE' }); return 'SKICKAT';",
      'fetch GET varukorg': "await fetch('/cart/add?id=1'); return 'SKICKAT';",
      'fetch GET utloggning': "await fetch('/logout'); return 'SKICKAT';",
      'XHR POST kassa': "return await new Promise(res => { const x = new XMLHttpRequest(); x.open('POST', '/checkout'); x.onload = () => res('SKICKAT'); x.onerror = () => res('nekat: xhr'); x.send('a=1'); });",
      'bild-GET mot varukorg': "return await new Promise(res => { const i = new Image(); i.onload = () => res('SKICKAT'); i.onerror = () => res('nekat: bild'); i.src = '/cart/add?id=1&x=' + Date.now(); });",
      'keepalive POST': "await fetch('/api/order', { method: 'POST', keepalive: true }); return 'SKICKAT';"
    };
    for (const [name, src] of Object.entries(attempts)) { const r = await tryIn(t.page, src); assert.match(r, /^nekat/, name + ' → ' + r); }
    await tryIn(t.page, "navigator.sendBeacon('/api/order', 'x'); return 1;");           // sendBeacon returnerar true när anropet köats: beviset är att servern inte får något
    await t.page.evaluate(() => { const f = document.createElement('form'); f.method = 'post'; f.action = '/checkout'; document.body.appendChild(f); f.submit(); }).catch(() => {});
    await wait(300);
    await t.page.evaluate(() => { const i = document.createElement('iframe'); i.src = '/checkout'; document.body.appendChild(i); }).catch(() => {});
    await t.page.evaluate(() => { setTimeout(() => { location.href = '/logout'; }, 0); }).catch(() => {});
    await wait(500);
    await t.page.goto(t.shop.url + '/workertest').catch(() => {});                       // en web worker som försöker skicka
    await t.page.evaluate(() => window.runWorker()).catch(() => {});
    await wait(500);
    assert.deepEqual(t.shop.mutations(), [], 'servern fick muterande anrop: ' + JSON.stringify(t.shop.mutations()));
    assert.equal(t.shop.sessionCount(), 1, 'inloggningen ska finnas kvar');
    assert.ok(t.guard.summary().blocked >= 8, 'skyddet ska ha nekat många anrop: ' + JSON.stringify(t.guard.summary()));
  } finally { await t.close(); }
});

test('popup-fönster: skyddet sitter på från fönstrets första anrop (12 försök, noll nådde servern)', async () => {
  const t = await setup();
  try {
    t.guard.setPhase('agent');
    for (let i = 0; i < 12; i++) await popupVia(t.page, t.shop.url + '/cart/add?id=' + i);
    await popupVia(t.page, t.shop.url + '/logout');
    await popupVia(t.page, t.shop.url + '/checkout');
    await wait(700);
    assert.deepEqual(t.shop.mutations(), [], 'popup läckte: ' + JSON.stringify(t.shop.mutations()));
    assert.equal(t.shop.sessionCount(), 1);
    assert.ok(t.guard.blocked().filter(b => /cart|checkout|logout/.test(b.path)).length >= 12);
    for (const p of t.context.pages()) if (p !== t.page) await p.close();
  } finally { await t.close(); }
});

test('websocket nekas i agentfasen (och loggas), och släpps inte till servern', async () => {
  const t = await setup();
  try {
    t.guard.setPhase('agent');
    const r = await tryIn(t.page, "return await new Promise(res => { const w = new WebSocket('ws://127.0.0.1:" + t.shop.port + "/live'); w.onclose = e => res('stängd:' + e.code); w.onerror = () => {}; setTimeout(() => res('tid'), 3000); });");
    assert.match(r, /^stängd/, r);
    assert.ok(t.guard.blocked().some(b => b.method === 'WS' && b.reason === 'websocket nekas i agentfasen'));
    assert.equal(t.shop.requests.filter(x => x.path === '/live').length, 0, 'servern fick aldrig en websocket-anslutning');
  } finally { await t.close(); }
});

test('operatören kan godkänna en läsande POST-sökning efter att ha sett att den nekades, men varukorgen förblir stängd', async () => {
  const t = await setup();
  try {
    await t.page.goto(t.shop.url + '/sortiment?mode=post');
    t.guard.setPhase('agent');
    await t.page.fill('#q', 'vit ros'); await t.page.keyboard.press('Enter');
    await wait(500);
    assert.equal(await t.page.$eval('#status', e => e.textContent), '', 'sökningen ska ha nekats');
    const blocked = t.guard.blocked().filter(b => b.method === 'POST');
    assert.equal(blocked.length, 1); assert.equal(blocked[0].path, '/api/search');
    assert.equal(t.shop.requests.filter(r => r.path === '/api/search').length, 0, 'servern fick aldrig sökningen');
    t.guard.allowPostPattern({ host: '127.0.0.1', pathRegex: '^/api/search$' });         // operatörens beslut
    await t.page.fill('#q', 'vit ros'); await t.page.keyboard.press('Enter');
    await t.page.waitForFunction(() => /träffar/.test(document.getElementById('status').textContent), null, { timeout: 5000 });
    assert.equal(await tryIn(t.page, "await fetch('/api/cart/add', { method: 'POST' }); return 'SKICKAT';"), 'nekat: Failed to fetch');
    assert.deepEqual(t.shop.mutations(), []);
  } finally { await t.close(); }
});
