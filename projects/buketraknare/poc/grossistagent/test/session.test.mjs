// Hela flödet mot en riktig webbläsare och en påhittad butik: människan loggar in själv, agenten (här ett manus, ingen riktig AI) söker,
// koden läser ut och räknar, skyddet håller, och sessionen raderas. Bevis: butikens server fick aldrig ett muterande anrop.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createSession, CONSENT_TEXT } from '../src/session.mjs';
import { startMockShop, PASS } from './support/mock-shop.mjs';
import { CHROME, humanLogin } from './support/browser.mjs';
import { scripted, toolUse, endTurn, parse } from './support/fake-client.mjs';

const OK = { consent: true };
const FIELDS = { id: 'artikelnr', name: 'benamning', variant: 'sort', color: 'farg', lengthCm: 'langd_cm', packSize: 'forpackning.antal', price: 'pris.belopp', priceUnit: 'pris.per', priceIncludesVat: 'pris.inklmoms', currency: 'pris.valuta', availability: 'lager.status', offer: 'kampanj' };

async function start(client, over = {}) {
  const shop = await startMockShop();
  const s = await createSession({ shopUrl: shop.url + '/sortiment', executablePath: CHROME, headless: true, extraArgs: ['--no-sandbox'], client, limits: { minGapMs: 0 }, ...over });
  return { shop, s, close: async () => { await s.end(); await shop.close(); } };
}
const logIn = async t => { await humanLogin(t.s.page, t.shop.url); return t.s.confirmLogin(OK); };
const allText = (...xs) => xs.map(x => JSON.stringify(x)).join('\n');

test('hela flödet: människan loggar in, agenten söker och läser verkliga (påhittade) artiklar, koden räknar inköpet, inget muterande når servern, sessionen raderas', async () => {
  let ids = {};
  const client = scripted([
    toolUse('observe', {}, 'Jag tittar på sidan.'),
    toolUse('search', { text: 'vit ros' }),
    (req, results) => { const r = parse(results[0]); ids.json = r.json_svar.at(-1).id; return toolUse('inspect_json', { response_id: ids.json, path: 'resultat.artiklar' }); },
    () => toolUse('set_extraction', { source: 'json', response_id: ids.json, items_path: 'resultat.artiklar', fields: FIELDS, extras: { sort: 'sort' } }),
    () => toolUse('find_products', { text: 'ros', color: 'vit', sort: 'length' }),
    () => toolUse('report_candidates', { picks: [{ id: 'R-1001', reason: 'Ren vit, 60 cm, klassisk till brudbukett', needed: 25 }, { id: 'R-1003', reason: 'Krämvit, romantisk' }, { id: 'FINNS-INTE', reason: 'ska avvisas' }], summary: 'Två passande sorter.' })
  ]);
  const t = await start(client);
  try {
    assert.equal(t.s.phase, 'login');
    await assert.rejects(() => t.s.ask('för tidigt'), /Bekräfta inloggningen först/);
    const login = await logIn(t);
    assert.equal(login.popupCheck, true); assert.equal(t.s.phase, 'agent');
    await assert.rejects(() => t.s.confirmLogin(OK), /redan bekräftad/);

    const res = await t.s.ask('Hitta vita rosor som skulle passa till en romantisk brudbukett. Jag behöver ungefär 25 av den klassiska.');
    assert.equal(res.stop, 'klar', res.error); assert.equal(res.turns, 6);
    const [av, vendela] = res.picks.picks;
    // verklig (påhittad) produktdata, utläst av koden
    assert.deepEqual([av.product.id, av.product.name, av.product.variant, av.product.color, av.product.lengthCm, av.product.packSize, av.product.packPrice, av.product.priceUnit, av.product.priceIncludesVat, av.product.availability],
      ['R-1001', 'Ros Avalanche 60 cm', 'Avalanche', 'Vit', 60, 20, '118.00', 'pack', false, 'in_stock']);
    assert.deepEqual(vendela.product.extras, { sort: 'Vendela' }); assert.equal(vendela.product.availability, 'low'); assert.equal(vendela.plan, null);
    assert.deepEqual(res.picks.notFound, ['FINNS-INTE']);
    // och inköpsberäkningen gjordes av vår kod
    assert.deepEqual([av.plan.status, av.plan.needed, av.plan.packSize, av.plan.packs, av.plan.bought, av.plan.leftover, av.plan.cost], ['ok', 25, 20, 2, 40, 15, '236 kr']);
    assert.deepEqual(t.s.calc('R-1003', 41), { ...t.s.calc('R-1003', 41) }); assert.equal(t.s.calc('R-1003', 41).cost, '379,50 kr');
    // AI:n fick aldrig se priser i filtrerade listor, och räknade inget
    const toolResults = client.requests.flatMap(r => r.messages.flatMap(m => (Array.isArray(m.content) ? m.content.filter(b => b.type === 'tool_result') : [])));
    const findResult = toolResults.find(b => b.content.includes('traffar'));
    assert.ok(findResult && !/pris|118|126/i.test(findResult.content), 'find_products ska inte visa priser: ' + findResult.content.slice(0, 300));
    // inget lösenord någonstans
    const everything = allText(client.requests, t.s.state(), t.s.report({ includeProducts: true }), t.s.products(), res);
    assert.ok(!everything.includes(PASS), 'lösenordet läcker');
    assert.ok(!/cookie|set-cookie|sid=/i.test(everything), 'cookie läcker');
    // skrivskyddet
    assert.deepEqual(t.shop.mutations(), [], 'servern fick muterande anrop');
    const st = t.s.state();
    assert.ok(!JSON.stringify(st.events).includes('Jag tittar på sidan'), 'modellens löpande text ska inte visas');
    assert.ok(st.events.some(e => e.type === 'status' && e.message === 'Söker efter «vit ros»…') && st.events.some(e => e.type === 'status' && e.message === 'Klart ✓'), JSON.stringify(st.events.map(e => e.message)));
    assert.ok(st.guard.blocked > 0 && st.guard.allowed > 0); assert.equal(st.pageLoads, 1); assert.ok(st.usage.input_tokens > 5000);
    assert.ok(st.costUsd > 0 && st.costUsd < 0.05, 'kostnad: ' + st.costUsd);
    // popup-självkontrollen nådde aldrig servern
    assert.equal(t.shop.requests.filter(r => r.path.includes('selftest')).length, 0);
    // sessionen raderas
    const tmp = t.s.tmpParent;
    assert.equal(t.s.profileDirsLeft().length, 1); assert.ok(fs.existsSync(tmp));       // webbläsarens tillfälliga profil finns i vår egen mapp medan sessionen lever
    const wipe = await t.s.end();
    assert.equal(wipe.wiped, true); assert.deepEqual(t.s.profileDirsLeft(), []); assert.ok(!fs.existsSync(tmp), 'hela den tillfälliga mappen ska vara raderad'); assert.equal(t.s.phase, 'ended');
    assert.equal(t.s.toolbox.state.catalog.size, 0); assert.equal(t.s.capture.list().length, 0); assert.deepEqual(t.s.state().events, []);
    await assert.rejects(() => t.s.ask('igen'), /Bekräfta inloggningen först/);
    assert.equal((await t.s.end()).wiped, true);
  } finally { await t.close(); }
});

test('RIKTIG GROSSIST kräver kontoinnehavarens samtycke (en ruta, Annas ordalydelse), inget annat; samtycket står i rapporten; DEMO kräver inget', async () => {
  assert.equal(CONSENT_TEXT, 'Kontoinnehavaren samtycker till detta begränsade read-only-test med sitt eget konto. Testet får inte genomföra köp eller ändra konto/order.');
  const t = await start(scripted([]));
  try {
    await humanLogin(t.s.page, t.shop.url);
    for (const bad of [undefined, {}, { consent: 'ja' }, { consent: false }, { termsChecked: true }, { consent: 1 }])
      await assert.rejects(() => t.s.confirmLogin(bad), /samtyckt/, JSON.stringify(bad));
    assert.equal(t.s.phase, 'login'); assert.equal(t.s.guard.phase, 'login');
    assert.equal(t.s.report().samtycke, null); assert.equal(t.s.state().consentText, CONSENT_TEXT);
    await t.s.confirmLogin({ consent: true, termsChecked: false });                      // den gamla villkorsrutan finns inte längre och spelar ingen roll
    assert.equal(t.s.phase, 'agent'); assert.equal(t.s.report().samtycke.text, CONSENT_TEXT); assert.ok(t.s.report().samtycke.at);
    assert.equal(t.s.report().läge, 'real');
  } finally { await t.close(); }
  const d = await start(scripted([]), { mode: 'demo' });
  try {
    await humanLogin(d.s.page, d.shop.url);
    await d.s.confirmLogin({});                                                            // påhittad butik, inget konto: ingen ruta behövs
    assert.equal(d.s.phase, 'agent'); assert.equal(d.s.report().samtycke, null); assert.equal(d.s.report().läge, 'demo'); assert.equal(d.s.state().consentText, null);
  } finally { await d.close(); }
});

test('DOM-variant utan JSON: väljare ger exakt samma sorts data, och köp-knappar, varukorg och främmande sidor nekas av verktygen', async () => {
  let ref;
  const client = scripted([
    toolUse('goto', { url: '/sok?q=' }),
    toolUse('observe', {}),
    (req, results) => { const o = parse(results[0]); const btn = o.element.find(e => /varukorg/i.test(e.text)); ref = btn.ref; assert.equal(btn.riskabel, true); const out = o.element.find(e => /logga ut/i.test(e.text)); assert.equal(out.riskabel, true); return toolUse('dom_outline', {}); },
    (req, results) => { const o = parse(results[0]); assert.ok(o.kandidater.some(k => k.selector === 'tr.artikelrad' && k.antal === 8), JSON.stringify(o.kandidater.map(k => k.selector))); return toolUse('set_extraction', { source: 'dom', row_selector: 'tr.artikelrad', fields: { id: '.nr', name: '.namn', color: '.farg', lengthCm: '.langd', packSize: '.forp', price: '.pris', availability: '.lager' }, price_unit: 'pack', price_includes_vat: false, currency: 'SEK' }); },
    () => toolUse('click', { ref }),                                              // "Lägg i varukorg": ska nekas av verktyget
    () => toolUse('goto', { url: '/cart/add?id=1' }),
    () => toolUse('goto', { url: '/checkout' }),
    () => toolUse('goto', { url: 'https://annan-sajt.test/' }),
    () => toolUse('goto', { url: 'javascript:alert(1)' }),
    () => toolUse('report_candidates', { picks: [{ id: 'G-3001', reason: 'Gipsört passar', needed: 25 }] })
  ]);
  const t = await start(client);
  try {
    await logIn(t);
    const res = await t.s.ask('Visa vita blommor');
    assert.equal(res.stop, 'klar', res.error);
    const all = client.requests.at(-1).messages.filter(m => Array.isArray(m.content)).flatMap(m => m.content.filter(b => b.type === 'tool_result'));
    assert.equal(all.length, 9);
    assert.ok(all.slice(0, 4).every(b => !b.is_error), 'goto, observe, dom_outline och set_extraction ska lyckas');
    assert.ok(all.slice(4).every(b => b.is_error), 'köp-knappen, varukorgen, kassan, främmande sida och javascript: ska nekas');
    assert.match(all[4].content, /Nekad: elementet/); assert.match(all[5].content, /Nekad: varukorg/); assert.match(all[6].content, /Nekad: varukorg/); assert.match(all[7].content, /utanför den godkända/); assert.match(all[8].content, /Bara http/);
    const g = res.picks.picks[0];
    assert.deepEqual([g.product.id, g.product.name, g.product.color, g.product.lengthCm, g.product.packSize, g.product.packPrice, g.product.availability, g.product.källa.kind], ['G-3001', 'Gipsört Million Stars', 'Vit', 65, 10, '58.00', 'in_stock', 'dom']);
    assert.deepEqual([g.plan.packs, g.plan.bought, g.plan.leftover, g.plan.cost], [3, 30, 5, '174 kr']);
    assert.deepEqual(t.shop.mutations(), []);
  } finally { await t.close(); }
});

test('en länk som skulle öppnas i ett nytt fönster följs i samma flik, efter samma kontroller, och inga extra fönster skapas', async () => {
  let ref;
  const client = scripted([
    toolUse('observe', {}),
    (req, results) => { const o = parse(results[0]); ref = o.element.find(e => /Enkel sökning/.test(e.text)).ref; return toolUse('click', { ref }); },
    () => endTurn('klar')
  ]);
  const t = await start(client);
  try {
    await logIn(t);
    const res = await t.s.ask('Öppna den enkla sökningen');
    assert.equal(res.stop, 'klar', res.error);
    assert.match(t.s.page.url(), /\/sok\?q=ros$/);
    assert.equal(t.s.context.pages().length, 1, 'inga extra flikar eller fönster');
    assert.equal(t.s.state().pageLoads, 1);
    assert.deepEqual(t.shop.mutations(), []);
  } finally { await t.close(); }
});

test('ett popup-fönster som sidan öppnar i agentfasen stängs direkt, och dess anrop går ändå genom skyddet', async () => {
  const t = await start(scripted([]));
  try {
    await logIn(t);
    const before = t.shop.requests.length;
    await t.s.page.click('a[target=_blank]');                                         // ett riktigt klick på en länk som öppnar ett nytt fönster
    await new Promise(r => setTimeout(r, 800));
    assert.equal(t.s.context.pages().length, 1, 'popup-fönstret ska vara stängt');
    assert.deepEqual(t.shop.mutations(), []);
    assert.ok(t.s.guard.audit().some(a => a.path.startsWith('/sok')), 'fönstrets anrop gick genom skyddet');
    assert.ok(t.shop.requests.length >= before);
  } finally { await t.close(); }
});

test('en POST-sökning nekas som standard, agenten får veta det, och efter operatörens godkännande fungerar den (varukorgen förblir stängd)', async () => {
  let ids = {};
  const client = scripted([
    toolUse('goto', { url: '/sortiment?mode=post' }),
    toolUse('search', { text: 'vit ros' }),
    (req, results) => { const r = parse(results[0]); assert.equal(r.nekade_anrop_sedan_sist, 1); assert.deepEqual(r.json_svar, []); return endTurn('Sökningen nekades av skyddet (en POST). Du behöver godkänna den om den är en vanlig sökning.'); },
    toolUse('search', { text: 'vit ros' }),
    (req, results) => { ids.json = parse(results[0]).json_svar.at(-1).id; return toolUse('set_extraction', { source: 'json', response_id: ids.json, items_path: 'resultat.artiklar', fields: FIELDS }); },
    () => toolUse('report_candidates', { picks: [{ id: 'R-1002', reason: 'Vit, 50 cm' }] })
  ]);
  const t = await start(client);
  try {
    await logIn(t);
    const first = await t.s.ask('Hitta vita rosor');
    assert.equal(first.stop, 'klar', first.error); assert.match(first.answer, /nekades/); assert.equal(first.picks, null);
    assert.equal(t.shop.requests.filter(r => r.path === '/api/search').length, 0);
    const st = t.s.state(); assert.equal(st.blocked.filter(b => b.method === 'POST').length, 1);
    assert.throws(() => t.s.allowBlockedPost(5), /finns inte i listan/);
    t.s.allowBlockedPost(0);                                                           // operatörens beslut, efter att ha sett vad som nekades
    assert.deepEqual(t.s.state().approved, [{ host: '127.0.0.1', pathRegex: '^/api/search$' }]);
    const second = await t.s.ask('Försök igen');
    assert.equal(second.stop, 'klar', second.error); assert.equal(second.picks.picks[0].product.id, 'R-1002');
    assert.equal(t.shop.requests.filter(r => r.path === '/api/search').length, 1);
    assert.deepEqual(t.shop.mutations(), []);
  } finally { await t.close(); }
});

test('agenten ser aldrig lösenordsfält eller fältvärden och kan inte skriva i ett lösenordsfält', async () => {
  const client = scripted([
    toolUse('goto', { url: '/login' }), endTurn('uppe'),                                  // inloggningssidan finns kvar att öppna (GET), men agenten får inte röra den
    toolUse('observe', { include_text: true }), toolUse('search', { text: 'hemligt' }), endTurn('klar')
  ]);
  const t = await start(client);
  try {
    await logIn(t);
    await t.s.ask('Öppna inloggningssidan');
    await t.s.page.fill('#user', 'testkund'); await t.s.page.fill('#pass', 'ett-annat-hemligt');       // någon har skrivit i fälten på sidan
    const res = await t.s.ask('Titta på sidan');
    assert.equal(res.stop, 'klar', res.error);
    const results = client.requests.at(-1).messages.filter(m => Array.isArray(m.content)).flatMap(m => m.content.filter(b => b.type === 'tool_result'));
    const obs = JSON.parse(results.at(-2).content);
    assert.ok(!obs.element.some(e => /password/.test(e.slag)), 'lösenordsfältet får inte listas');
    assert.ok(obs.element.some(e => e.name === 'anvandare'), 'användarnamnsfältet listas (utan värde)');
    assert.equal(results.at(-1).is_error, true); assert.match(results.at(-1).content, /Hittar inget sökfält/);   // sök skriver inte i fält som inte är sökfält
    const everything = JSON.stringify(client.requests);
    for (const secret of ['ett-annat-hemligt', 'testkund', PASS]) assert.ok(!everything.includes(secret), 'fältvärdet "' + secret + '" läcker till AI:n: ' + everything.slice(Math.max(0, everything.indexOf(secret) - 150), everything.indexOf(secret) + 60));
    assert.equal(await t.s.page.inputValue('#pass'), 'ett-annat-hemligt');                                      // och agenten ändrade inte fältet
  } finally { await t.close(); }
});

test('sök skriver aldrig i ett lösenordsfält, telefon- eller e-postfält, även om de ser ut som sökfält', async () => {
  const client = scripted([toolUse('goto', { url: '/trick' }), toolUse('search', { text: 'hemligt-sökord' }), endTurn('klar'), toolUse('goto', { url: '/trick2' }), toolUse('search', { text: 'hemligt-sökord' }), endTurn('klar')]);
  const t = await start(client);
  try {
    await logIn(t);
    const res = await t.s.ask('Sök efter något');
    assert.equal(res.stop, 'klar', res.error);
    const results = client.requests.at(-1).messages.filter(m => Array.isArray(m.content)).flatMap(m => m.content.filter(b => b.type === 'tool_result'));
    assert.equal(results.at(-1).is_error, true); assert.match(results.at(-1).content, /Hittar inget sökfält|lösenordsfält/);
    for (const id of ['#pw', '#card', '#em']) assert.equal(await t.s.page.inputValue(id), '', id + ' ska vara orört');
    const res2 = await t.s.ask('Försök igen');                                       // en sida där bara telefon-, e-post- och talfält ser ut som sökfält
    assert.equal(res2.stop, 'klar', res2.error);
    const results2 = client.requests.at(-1).messages.filter(m => Array.isArray(m.content)).flatMap(m => m.content.filter(b => b.type === 'tool_result'));
    assert.equal(results2.at(-1).is_error, true); assert.match(results2.at(-1).content, /Hittar inget sökfält/);
    for (const id of ['#card', '#em', '#nr']) assert.equal(await t.s.page.inputValue(id), '', id + ' ska vara orört');
  } finally { await t.close(); }
});

test('hastighetsgränser: högst N sidhämtningar och en paus mellan dem', async () => {
  const waits = [];
  const steps = [toolUse('goto', { url: '/sok?q=ros' }), toolUse('goto', { url: '/sok?q=lisianthus' }), toolUse('goto', { url: '/sok?q=gips' }), toolUse('goto', { url: '/sok?q=eukalyptus' }), toolUse('observe', {}), endTurn('klar')];
  const client = scripted(steps);
  const t = await start(client, { limits: { minGapMs: 2000, maxPageLoads: 3 }, sleep: async ms => { waits.push(ms); } });
  try {
    await logIn(t);
    await t.s.ask('Sök lite');
    const results = client.requests.at(-1).messages.filter(m => Array.isArray(m.content)).flatMap(m => m.content.filter(b => b.type === 'tool_result'));
    assert.deepEqual(results.slice(0, 4).map(b => !!b.is_error), [false, false, false, true]);
    assert.match(results[3].content, /Gränsen för antal sidhämtningar \(3\)/);
    assert.equal(t.s.state().pageLoads, 3);
    assert.ok(waits.filter(w => w > 1000).length >= 2, 'paus mellan sidhämtningar: ' + JSON.stringify(waits));
  } finally { await t.close(); }
});

test('popup-självkontrollen: om skyddet inte fångar ett popup-fönsters första anrop får agentfasen inte starta', async () => {
  const shop = await startMockShop();
  const s = await createSession({ shopUrl: shop.url + '/sortiment', executablePath: CHROME, headless: true, extraArgs: ['--no-sandbox'], client: scripted([]), limits: { minGapMs: 0 } });
  try {
    await humanLogin(s.page, shop.url);
    await s.context.unroute('**/*');                                  // saboterar skyddet för att visa att kontrollen märker det
    await assert.rejects(() => s.confirmLogin(OK), /fångade inte ett popup-fönsters första anrop/);
    assert.equal(s.phase, 'login'); assert.equal(s.guard.phase, 'login');
    await assert.rejects(() => s.ask('x'), /Bekräfta inloggningen först/);
    assert.ok(shop.requests.some(r => r.path.includes('selftest')), 'kontrollen ska ha visat ett verkligt läckage när skyddet saknas');
  } finally { await s.end(); await shop.close(); }
});

test('fel från modellen och instruktionsgränser kraschar inte sessionen, och samtidiga frågor nekas', async () => {
  const bad = { messages: { create: async () => { throw new Error('API-fel 529: överbelastad'); } } };
  const t = await start(bad);
  try {
    await logIn(t);
    const res = await t.s.ask('Hitta rosor');
    assert.equal(res.stop, 'fel'); assert.match(res.error, /529/); assert.equal(t.s.state().running, false);
    await assert.rejects(() => t.s.ask('   '), /Skriv en instruktion/);
    const slow = { messages: { create: () => new Promise(r => setTimeout(() => r(endTurn('klart')), 200)) } };
    const s2 = await createSession({ shopUrl: t.shop.url + '/sortiment', executablePath: CHROME, headless: true, extraArgs: ['--no-sandbox'], client: slow });
    try { await humanLogin(s2.page, t.shop.url); await s2.confirmLogin(OK); const a = s2.ask('första'); await assert.rejects(() => s2.ask('andra'), /arbetar redan/); assert.equal((await a).stop, 'klar'); } finally { await s2.end(); }
    const none = await createSession({ shopUrl: t.shop.url + '/sortiment', executablePath: CHROME, headless: true, extraArgs: ['--no-sandbox'] });
    try { await humanLogin(none.page, t.shop.url); await none.confirmLogin(OK); await assert.rejects(() => none.ask('x'), /Ingen AI-koppling/); } finally { await none.end(); }
  } finally { await t.close(); }
});

test('webbplatsen måste vara https (utom lokalt), och en sanerad rapport innehåller bara struktur', async () => {
  await assert.rejects(() => createSession({ shopUrl: 'http://shop.exempel.test/', executablePath: CHROME, headless: true }), /måste använda https/);
  let ids = {};
  const client = scripted([toolUse('search', { text: 'ros' }), (r, res) => { ids.j = parse(res[0]).json_svar.at(-1).id; return toolUse('set_extraction', { source: 'json', response_id: ids.j, items_path: 'resultat.artiklar', fields: FIELDS }); }, toolUse('report_candidates', { picks: [{ id: 'R-1001', reason: 'x' }] })]);
  const t = await start(client);
  try {
    await logIn(t); const ran = await t.s.ask('Hitta rosor'); assert.equal(ran.stop, 'klar', ran.error);
    const rep = t.s.report();
    const text = JSON.stringify(rep);
    assert.equal(rep.artiklarUtlästa, 6); assert.equal(rep.artiklar, undefined);          // 'ros' matchar fem rosor och Lisianthus Rosita
    assert.ok(!text.includes('Avalanche') && !text.includes('118'), 'rapporten ska inte innehålla artikeldata');
    assert.ok(text.includes('artikelnr') && text.includes('"antal"'), 'men väl nyckelnamn');
    assert.equal(t.s.report({ includeProducts: true }).artiklar.length, 6);
    const f = t.s.saveReport('/tmp/claude-0/-home-user-Open-claw/8b6f99f7-8ba1-5f61-9af8-6c667be57a89/scratchpad/poc-report');
    assert.ok(fs.existsSync(f)); assert.ok(!fs.readFileSync(f, 'utf8').includes('Avalanche'));
  } finally { await t.close(); }
});

test('RIKTIG GROSSIST: efter inloggningen väntar agenten ("Inloggning klar – agenten väntar"): inget modellanrop och ingen aktivitet i butiken förrän en människa skickar första uppgiften, och taket är 20 artiklar', async () => {
  const client = scripted([toolUse('observe', {}), endTurn('klart')]);
  const t = await start(client, { mode: 'real' });
  try {
    await humanLogin(t.s.page, t.shop.url);
    await assert.rejects(() => t.s.confirmLogin(), /samtyckt/, 'samtycke krävs i RIKTIG GROSSIST');
    await t.s.confirmLogin({ consent: true });
    const shopBefore = t.shop.requests.length;
    const events = t.s.state().events;
    assert.match(events.at(-1).message, /^Inloggning klar – agenten väntar på din första uppgift\./);
    await new Promise(r => setTimeout(r, 1500));                                                              // tid för "automatisk aktivitet" att visa sig om den fanns
    assert.equal(client.requests.length, 0, 'inget modellanrop före första uppgiften');
    assert.equal(t.shop.requests.length, shopBefore, 'ingen aktivitet i butiken före första uppgiften');
    assert.equal(t.s.state().running, false); assert.equal(t.s.state().limits.maxProductsPerTask, 20); assert.equal(t.s.state().phase, 'agent');
    const res = await t.s.ask('Titta på sidan'); assert.equal(res.stop, 'klar', res.error);
    assert.equal(client.requests.length, 2);
  } finally { await t.close(); }
});
