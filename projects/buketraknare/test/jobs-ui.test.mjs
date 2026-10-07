// Den minimala jobbskärmen i en riktig sida (jsdom): skapa kund och jobb, skapa arrangemang, lägg till blomma och eget material, ange arbete,
// se kundpris, öppna igen. Dessutom: "Min order", att den gamla appen är orörd och att fel i lagringen eller indata aldrig tar ner något.
// Momssatsen är floristens egen inställning i testdata (25 %, aldrig verifierad).
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadApp, v1State, item } from './helpers/app.mjs';
import { JSDOM } from 'jsdom';
import fs from 'node:fs';
import M from '../public/js/core/money.js';
import W from '../public/js/core/workspace.js';
import B from '../public/js/core/bridge.js';

const { Money } = M;
const TODAY = '2026-10-07';
const WS_KEY = 'buketraknare.workspace.v1';
const ROS = ['Röd ros', 'Blommor', 10, 120, 'pack', TODAY];
const EUK = ['Eukalyptus', 'Grönt', 10, 65, 'bunt', TODAY];
const PION = ['Pion', 'Blommor', 5, 0, ''];
const seed = state => ({ storage: { 'buketraknare.v1': JSON.stringify(state) } });
const basic = (extra = {}) => v1State({ items: [item(ROS), item(EUK), item(PION)], ...extra });
const withApp = async (opts, fn) => { const app = await loadApp(opts); try { await fn(app); } finally { app.close(); } };
const NB = s => s.replace(/ /g, ' ');
/** Belopp som skärmen visar: "1 495 kr" eller "667,75 kr" (blanksteg efter normalisering). */
const krText = m => { const a = m.amount < 0n ? -m.amount : m.amount, w = String(a / 100n).replace(/\B(?=(\d{3})+(?!\d))/g, ' '), o = a % 100n; return w + (o === 0n ? '' : ',' + String(o).padStart(2, '0')) + ' kr'; };

async function openJobs(app) { app.tab('jobb'); const j = app.hook.jobs(); await j.idle(); return j; }
async function step(app, fn) { fn(); await app.hook.jobs().idle(); }
const submit = (app, formSel) => app.click(formSel + ' button[type="submit"]');
async function createJob(app, { customer = 'Emma Svensson', kind = 'PRIVATE', name = 'Emma & Johan', type = 'wedding', date = '2026-06-12' } = {}) {
  await step(app, () => {
    app.set('#jf-customer', customer, 'input'); app.set('#jf-kind', kind); app.set('#jf-name', name, 'input'); app.set('#jf-type', type); app.set('#jf-date', date);
    submit(app, '#jf-job');
  });
}
async function addArrangement(app, name, qty = 1) {
  await step(app, () => { app.set('#jf-arr-name', name, 'input'); app.set('#jf-arr-qty', String(qty), 'input'); submit(app, '#jf-arr'); });
}
async function addFlower(app, name, times = 1) {
  for (let i = 0; i < times; i++) await step(app, () => app.click([...app.$$('#j-results [data-j="addflower"]')].find(b => b.textContent.includes(name))));
}
async function addOwn(app, { name, qty = '1', source = 'OWN_STOCK', mode = 'STANDARD_MARKUP', cost, price, basis }) {
  await step(app, () => {
    app.set('#jf-own-name', name, 'input'); app.set('#jf-own-qty', qty, 'input'); app.set('#jf-own-source', source);
    app.click(`input[name="j-pmode"][value="${mode}"]`);
    if (cost !== undefined) app.set('#jf-own-cost', cost, 'input');
    if (price !== undefined) app.set('#jf-own-price', price, 'input');
    if (basis) app.set('#jf-own-basis', basis);
    submit(app, '#jf-own');
  });
}
const savedWorkspace = app => JSON.parse(app.storage()[WS_KEY]);
const msg = app => app.text('#view-jobb [role="alert"]');

// ---------- start ----------
test('första gången utan någon order: Jobb-fliken erbjuder att skapa ett jobb, och ingen "Min order" hittas på', async () => {
  await withApp(seed(basic()), async app => {
    assert.equal(app.$('#view-jobb').hidden, true);
    await openJobs(app);
    assert.equal(app.$('#view-jobb').hidden, false); assert.equal(app.$('#view-bukett').hidden, true);
    assert.match(app.text('#view-jobb'), /Nytt jobb/); assert.ok(app.$('#jf-job'));
    assert.doesNotMatch(app.text('#view-jobb'), /Min order/);
    assert.equal(app.$$('#j-job option').length, 0);
    assert.deepEqual(savedWorkspace(app).events, []);
  });
});

// ---------- hela flödet ----------
test('Annas flöde: kund och jobb → arrangemang → blomma → eget material → arbete → kundpris → öppna igen', async () => {
  let storageAfter, expectedTotal;
  await withApp(seed(basic()), async app => {
    const v2Before = app.storage()['buketraknare.v2'], v1Before = app.storage()['buketraknare.v1'];
    await openJobs(app);
    await createJob(app);
    assert.match(app.text('#view-jobb'), /Emma Svensson/); assert.match(app.text('#view-jobb'), /Bröllop/); assert.match(app.text('#view-jobb'), /12 juni/);
    assert.equal(app.$$('#j-job option').length, 1); assert.match(app.text('#j-job option'), /Emma & Johan/);
    assert.match(app.text('#j-total'), /Lägg till arrangemang/);

    // Brudbukett: det som går att räkna för hand
    await addArrangement(app, 'Brudbukett', 1);
    assert.match(app.text('#j-detail'), /Brudbukett/);                                         // det nya arrangemanget öppnas direkt
    await step(app, () => app.set('#j-search', 'ros', 'input'));
    await addFlower(app, 'Röd ros', 5);
    await addOwn(app, { name: 'Band', source: 'OWN_STOCK', mode: 'STANDARD_MARKUP', cost: '25' });
    await addOwn(app, { name: 'Kvistar från egen trädgård', qty: '3', source: 'HOME_GROWN', mode: 'INCLUDED' });
    await step(app, () => app.set('#j-labor', '125'));
    assert.deepEqual(app.$$('#j-detail .j-item strong').map(e => e.textContent), ['Röd ros', 'Band', 'Kvistar från egen trädgård']);
    assert.match(app.text('#j-detail'), /Ingår utan extra kostnad \(0 kr\)/); assert.match(app.text('#j-detail'), /Standardpåslag på kalkylkostnad 25 kr/); assert.match(app.text('#j-detail'), /Arbete: 125 kr/);
    // 5 rosor = 1 förpackning à 120 kr, band 25 kr kalkylkostnad: (120 + 25) × 1,5 + 125 arbete = 342,50 exkl. moms = 428,125 inkl. moms → 430 kr (uppåt till 5 kr)
    assert.match(app.text('#j-total'), /✓ 430 kr inkl\. moms/);
    assert.match(app.text('#view-jobb .j-arr'), /✓ 430 kr/);
    assert.match(app.text('#j-detail'), /Så räknades priset/);
    await step(app, () => { app.$('#j-detail details:not(#j-own)').open = true; });
    const lines = app.$$('#j-detail dl.lines dt').map(dt => (dt.textContent + ' ' + dt.nextElementSibling.textContent).replace(/\s+/g, ' ')).join(' | ');
    for (const part of ['Material (kalkylkostnad) 145 kr', 'Påslag 72,50 kr', 'Arbete 125 kr', 'Summa exkl. moms 342,50 kr', 'Moms 85,63 kr', 'Beräknat pris 428,13 kr', 'Avrundning 1,88 kr', 'Pris till kund 430 kr']) assert.ok(lines.includes(part), part + ' saknas i: ' + lines);

    // fler arrangemang som i exemplet
    await addArrangement(app, 'Bordsdekoration', 8);
    await addFlower(app, 'Eukalyptus', 2);
    await addOwn(app, { name: 'Vas', source: 'OWN_STOCK', mode: 'FIXED_SALE_PRICE', price: '60', basis: 'inc' });
    await step(app, () => app.set('#j-labor', '40'));
    await addArrangement(app, 'Corsage', 4);
    await addFlower(app, 'Röd ros', 1);
    await step(app, () => app.set('#j-labor', '30'));
    assert.deepEqual(app.$$('#view-jobb .j-arr .link').map(e => e.textContent), ['Brudbukett', 'Bordsdekoration ×8', 'Corsage ×4']);

    // skärmens totalsumma är exakt det prismotorn räknar fram på det som sparats
    const ws = savedWorkspace(app), view = app.hook.state();
    const { catalog } = B.catalogFromView(view, { today: TODAY });
    const res = W.priceEvent(ws, ws.events[0].id, { catalog, today: TODAY });
    assert.equal(res.status, 'OK'); expectedTotal = res.job.totalIncVat;
    assert.ok(expectedTotal.amount > 43000n);
    assert.match(NB(app.text('#j-total .j-big')), new RegExp('^[✓≈] ' + krText(expectedTotal).replace(/ /g, ' ') + ' inkl\\. moms$'));
    assert.equal(app.text('#j-status'), 'Sparat ✓');
    // den gamla appen är orörd av allt detta
    assert.equal(app.storage()['buketraknare.v2'], v2Before); assert.equal(app.storage()['buketraknare.v1'], v1Before);
    assert.equal(ws.arrangements.length, 3); assert.equal(ws.items.length, 6);                // 3 + 2 + 1 rader
    storageAfter = app.storage();
  });
  // en ny session (telefonen startas om): jobbet, arrangemangen, raderna och priset är kvar
  await withApp({ storage: storageAfter }, async app => {
    await openJobs(app);
    assert.match(app.text('#j-job option'), /Emma & Johan/);
    assert.deepEqual(app.$$('#view-jobb .j-arr .link').map(e => e.textContent), ['Brudbukett', 'Bordsdekoration ×8', 'Corsage ×4']);
    assert.match(NB(app.text('#j-total .j-big')), new RegExp(krText(expectedTotal) + ' inkl\\. moms'));
    await step(app, () => app.click('#view-jobb .j-arr .link'));
    assert.deepEqual(app.$$('#j-detail .j-item strong').map(e => e.textContent), ['Röd ros', 'Band', 'Kvistar från egen trädgård']);
    assert.equal(app.$('#j-labor').value, '125'); assert.equal(app.$('#j-arr-qty').value, '1');
    assert.equal(app.storage()[WS_KEY], storageAfter[WS_KEY], 'att bara öppna ett jobb ändrar ingenting i lagringen');
  });
});

// ---------- min order ----------
test('"Min order": den gamla ordern syns som ett jobb med exakt samma totalsumma som calc(), och fliken Bukett är oförändrad', async () => {
  const old = basic({ buketter: [{ size: 'medel', qty: 2, items: { 'Röd ros': 5, 'Eukalyptus': 2 } }, { size: 'liten', qty: 1, items: { 'Röd ros': 3 } }], hemma: { 'Röd ros': 1 } });
  await withApp(seed(old), async app => {
    const C = app.calc(), modelBefore = JSON.stringify(app.hook.model()), v2Before = app.storage()['buketraknare.v2'];
    assert.equal(C.incomplete, false);
    await openJobs(app);
    assert.match(app.text('#j-job option'), /Min order/);
    assert.match(app.text('#view-jobb'), /Din nuvarande order finns nu som jobbet "Min order"/); assert.match(app.text('#view-jobb'), /Fliken Bukett är oförändrad/);
    assert.deepEqual(app.$$('#view-jobb .j-arr .link').map(e => e.textContent), ['Bukett 1 ×2', 'Bukett 2']);
    assert.match(NB(app.text('#j-total .j-big')), new RegExp(krText(Money.fromDecimal(String(C.total))) + ' inkl\\. moms'));
    assert.equal(JSON.stringify(app.hook.model()), modelBefore); assert.equal(app.storage()['buketraknare.v2'], v2Before);        // gamla appen är orörd
    // byter man flik tillbaka fungerar Bukett som förut
    app.tab('bukett'); await app.settle();
    assert.equal(app.$('#view-jobb').hidden, true); assert.equal(app.$('#view-bukett').hidden, false);
    assert.equal(app.text('#totalbar strong'), NB(krText(Money.fromDecimal(String(C.total)))));
    // och "Min order" skapas inte en gång till
    await openJobs(app);
    assert.equal(app.$$('#j-job option').length, 1); assert.equal(savedWorkspace(app).events.length, 1);
  });
});

// ---------- eget material ----------
test('eget tillägg: 0 kr som kalkylkostnad avvisas, "Ingår" är ett uttryckligt val, och prisbasen följer kundtypen', async () => {
  await withApp(seed(basic()), async app => {
    await openJobs(app);
    await createJob(app);
    await addArrangement(app, 'Brudbukett');
    await addOwn(app, { name: 'Kvistar', source: 'HOME_GROWN', mode: 'STANDARD_MARKUP', cost: '0' });
    assert.match(msg(app), /Noll inköpskostnad betyder inte noll värde/); assert.equal(app.$$('#j-detail .j-item').length, 0);      // ingenting sparades
    await addOwn(app, { name: 'Kvistar', source: 'HOME_GROWN', mode: 'STANDARD_MARKUP', cost: '' });
    assert.match(msg(app), /Skriv kalkylkostnaden i kronor/);
    assert.equal(app.$('#jf-own-basis').value, 'inc');                                           // privatkund: fast pris inkl. moms som förval
    await addOwn(app, { name: 'Kvistar', source: 'HOME_GROWN', mode: 'INCLUDED' });
    assert.equal(msg(app), ''); assert.equal(app.$$('#j-detail .j-item').length, 1);
    assert.equal(savedWorkspace(app).items[0].pricing.mode, 'INCLUDED');
    // ett fast pris sparas med uttrycklig prisbas
    await addOwn(app, { name: 'Vas', source: 'OWN_STOCK', mode: 'FIXED_SALE_PRICE', price: '75', basis: 'inc' });
    await addOwn(app, { name: 'Ljushållare', source: 'OWN_STOCK', mode: 'FIXED_SALE_PRICE', price: '60', basis: 'ex' });
    const items = savedWorkspace(app).items;
    assert.deepEqual(items.map(i => [i.name, i.pricing.unitSalePrice && i.pricing.unitSalePrice.basis]).slice(1), [['Vas', 'inc'], ['Ljushållare', 'ex']]);
    // ett företag får exkl. moms som förval, och priset visas exkl. moms med momsen för sig
    await step(app, () => app.set('#j-kind', 'BUSINESS'));
    await addOwn(app, { name: 'Kruka', source: 'OWN_STOCK', mode: 'INCLUDED' });
    assert.equal(app.$('#jf-own-basis').value, 'ex');
    assert.match(app.text('#j-total'), /exkl\. moms/); assert.match(app.text('#j-total'), /\+ moms/);
  });
});

test('ett pris som saknas är inte 0 kr: kundpriset räknas inte, och skärmen säger vad som saknas', async () => {
  await withApp(seed(basic()), async app => {
    await openJobs(app);
    await createJob(app);
    await addArrangement(app, 'Brudbukett');
    await step(app, () => app.set('#j-search', 'pion', 'input'));
    assert.match(app.text('#j-results'), /pris saknas/);
    await addFlower(app, 'Pion');
    assert.match(app.text('#j-total'), /Kundpriset kan inte räknas än/); assert.match(app.text('#j-total'), /Pris saknas för Pion/);
    assert.doesNotMatch(app.text('#j-total'), /\d kr inkl\. moms/);
    assert.match(app.text('#view-jobb .j-arr'), /Pris saknas/);
    // ta bort raden: tomt arrangemang, inget pris att visa, ingen 0 kr
    await step(app, () => app.click('#j-detail [data-j="rmitem"]'));
    assert.doesNotMatch(app.text('#j-total'), /Kundpriset kan inte räknas än/); assert.doesNotMatch(app.text('#j-total'), /0 kr/);
    assert.match(app.text('#view-jobb .j-arr'), /Tomt/);
  });
});

// ---------- fel och trasig lagring ----------
test('felaktiga uppgifter ger ett tydligt svar på svenska och sparar ingenting', async () => {
  await withApp(seed(basic()), async app => {
    await openJobs(app);
    await step(app, () => { app.set('#jf-name', '  ', 'input'); submit(app, '#jf-job'); });
    assert.match(msg(app), /Jobbets namn måste fyllas i/); assert.deepEqual(savedWorkspace(app).events, []);
    await createJob(app);
    await step(app, () => { app.set('#jf-arr-name', 'Buketten', 'input'); app.set('#jf-arr-qty', 'tre', 'input'); submit(app, '#jf-arr'); });
    assert.match(msg(app), /Antalet arrangemang måste vara ett heltal/); assert.equal(savedWorkspace(app).arrangements.length, 0);
    await addArrangement(app, 'Buketten');
    for (const [v, re] of [['12,345', /Skriv arbetet i kronor/], ['abc', /Skriv arbetet i kronor/], ['-5', /Skriv arbetet i kronor/]]) {
      await step(app, () => app.set('#j-labor', v)); assert.match(msg(app), re, v);
    }
    assert.equal(savedWorkspace(app).arrangements[0].laborOverride, null);
    await step(app, () => app.set('#j-arr-qty', '0')); assert.match(msg(app), /Antalet arrangemang måste vara ett heltal från 1/);
    await step(app, () => app.set('#j-arr-name', '')); assert.match(msg(app), /Namnet måste fyllas i/);
    await step(app, () => app.set('#j-arr-qty', '3')); assert.equal(msg(app), ''); assert.equal(savedWorkspace(app).arrangements[0].quantity, 3);
    await step(app, () => app.set('#j-labor', '62,50')); assert.deepEqual(savedWorkspace(app).arrangements[0].laborOverride, { mode: 'fixed', fee: Money.fromDecimal('62.50').toJSON() });
    await step(app, () => app.set('#j-labor', '')); assert.equal(savedWorkspace(app).arrangements[0].laborOverride, null);     // tomt = inget arbete angivet
    await addFlower(app, 'Röd ros');
    await step(app, () => app.set('#j-arr-qty', '2'));
    const row = app.$('#j-detail .j-item input[data-jf="itemqty"]');
    await step(app, () => app.set(row, '2,5')); assert.match(msg(app), /heltal/);                // en grossistvara säljs i hela stjälkar
    await step(app, () => app.set(app.$('#j-detail .j-item input[data-jf="itemqty"]'), '4')); assert.equal(msg(app), ''); assert.equal(savedWorkspace(app).items[0].quantity, '4');
  });
});

test('trasig lagring skrivs aldrig över: jobbfliken säger det och de andra flikarna fungerar som vanligt', async () => {
  const bad = '{"v":1,"rev":'; // avbruten skrivning
  await withApp({ ...seed(basic()), storage: { ...seed(basic()).storage, [WS_KEY]: bad } }, async app => {
    await openJobs(app);
    assert.match(msg(app), /går inte att läsa/); assert.match(msg(app), /inte överskrivet och inte raderat/);
    assert.equal(app.storage()[WS_KEY], bad);                                                      // orört
    assert.equal(app.$('#jf-job'), null);
    app.tab('bukett'); await app.settle(); app.add('Röd ros'); assert.equal(app.count('Röd ros'), 1);   // gamla appen fungerar
    assert.equal(app.storage()[WS_KEY], bad);
  });
  const wrong = JSON.stringify({ v: 1, rev: 1, shop: { id: 'shop_x' }, customers: [], events: [], arrangements: [], items: [], materials: [] });
  await withApp({ storage: { ...seed(basic()).storage, [WS_KEY]: wrong } }, async app => {
    await openJobs(app);
    assert.match(msg(app), /går inte att läsa/); assert.equal(app.storage()[WS_KEY], wrong);
  });
});

test('full lagring: jobbet finns kvar i sidan, men skärmen säger ärligt att det inte sparades', async () => {
  await withApp({ ...seed(basic()), failWrite: WS_KEY }, async app => {
    await openJobs(app);
    await createJob(app);
    assert.match(msg(app), /Det gick inte att spara/); assert.equal(app.text('#j-status'), 'Inte sparat');
    assert.match(app.text('#j-job option'), /Emma & Johan/);                                         // man kan fortsätta arbeta
    assert.equal(app.storage()[WS_KEY], undefined);
    await addArrangement(app, 'Brudbukett'); assert.match(app.text('#view-jobb .j-arr'), /Brudbukett/);
  });
});

test('ta bort jobbet kräver ett andra tryck, och ett borttaget "Min order" kommer inte tillbaka av sig själv', async () => {
  const old = basic({ buketter: [{ size: 'medel', qty: 1, items: { 'Röd ros': 5 } }] });
  await withApp(seed(old), async app => {
    await openJobs(app);
    await step(app, () => app.click('[data-j="rmjob"]'));
    assert.match(app.text('[data-j="rmjob"]'), /Säker\? Tryck igen/); assert.equal(savedWorkspace(app).events[0].deletedAt, null);
    await step(app, () => app.click('[data-j="rmjob"]'));
    assert.match(app.text('#view-jobb'), /Nytt jobb/); assert.notEqual(savedWorkspace(app).events[0].deletedAt, null);
    app.tab('bukett'); await openJobs(app);
    assert.equal(app.$$('#j-job option').length, 0); assert.equal(savedWorkspace(app).events.length, 1);
  });
});

// ---------- användbarhet ----------
test('alla fält i jobbskärmen har en etikett, och skärmen läcker ingen osäker text', async () => {
  await withApp(seed(basic({ buketter: [{ size: 'medel', qty: 1, items: { 'Röd ros': 5 } }] })), async app => {
    await openJobs(app);
    await step(app, () => app.click('#view-jobb .j-arr .link'));
    await step(app, () => { app.$('#j-own').open = true; });
    const controls = app.$$('#view-jobb input, #view-jobb select').filter(el => el.type !== 'hidden');
    assert.ok(controls.length >= 10);
    for (const el of controls) assert.ok((el.labels && el.labels.length > 0) || el.getAttribute('aria-label'), 'fält utan etikett: ' + (el.id || el.name || el.outerHTML.slice(0, 60)));
    const all = app.text('#view-jobb');
    for (const bad of ['undefined', 'NaN', '[object', 'null', 'Infinity']) assert.ok(!all.includes(bad), 'texten innehåller ' + bad);
    assert.match(all, /Moms: din egen inställning \(25 %\), inte kontrollerad mot en officiell regel/);        // ärligt om momssatsen
    for (const b of app.$$('#view-jobb button')) assert.ok(b.textContent.trim().length > 0 || b.getAttribute('aria-label'), 'knapp utan text');
  });
});

// ---------- säkerhet och felisolering ----------
test('text som floristen skriver visas som text och kan aldrig bli HTML eller kod', async () => {
  const evil = '<img src=x onerror="window.pwned=1"><b>fet</b>';
  await withApp(seed(basic()), async app => {
    await openJobs(app);
    await createJob(app, { customer: evil, name: evil });
    await addArrangement(app, evil);
    await addOwn(app, { name: evil, source: 'OWN_STOCK', mode: 'INCLUDED' });
    await step(app, () => app.set('#j-arr-name', evil + '"\'><i>'));
    assert.equal(app.$$('#view-jobb img').length, 0); assert.equal(app.$$('#view-jobb b').length, 0); assert.equal(app.$$('#view-jobb i').length, 0);
    assert.equal(app.window.pwned, undefined);
    assert.ok(app.text('#view-jobb').includes('<img src=x onerror="window.pwned=1"><b>fet</b>'), 'texten visas ordagrant');
    assert.equal(app.$('#j-arr-name').value, evil + '"\'><i>');
    assert.equal(savedWorkspace(app).items[0].name, evil);                                       // och sparas ordagrant
  });
});

test('om de nya skripten inte går att läsa in fungerar de gamla flikarna som vanligt, och Jobb-fliken säger det', async () => {
  const raw = fs.readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
  const PUB = new URL('../public/', import.meta.url);
  for (const broken of ['js/core/money.js', 'js/jobs-ui.js']) {
    const html = raw.replace(/<script src="([^":]+)"><\/script>/g, (m, src) => src === broken ? '<script>throw new Error("kunde inte läsas")</script>' : '<script>' + fs.readFileSync(new URL(src, PUB), 'utf8') + '</script>');
    const dom = new JSDOM(html, { url: 'https://buketraknare.test/', runScripts: 'dangerously', pretendToBeVisual: true, beforeParse(w) { w.scrollTo = () => {}; w.HTMLElement.prototype.scrollIntoView = () => {}; w.addEventListener('error', e => e.preventDefault()); } });
    const w = dom.window, doc = w.document;
    await new Promise(r => setTimeout(r, 20));
    assert.ok(doc.querySelectorAll('#tiles .tile').length >= 20, broken + ': Bukett-fliken ska fungera');
    doc.querySelector('[data-tab="jobb"]').click();
    await new Promise(r => setTimeout(r, 20));
    assert.match(doc.querySelector('#view-jobb').textContent, /Jobb-fliken kunde inte startas\. De andra flikarna fungerar som vanligt/, broken);
    doc.querySelector('[data-tab="prislista"]').click(); assert.equal(doc.querySelector('#view-prislista').hidden, false);
    doc.querySelector('[data-tab="bukett"]').click(); assert.equal(doc.querySelector('#view-bukett').hidden, false);
    w.close();
  }
});
