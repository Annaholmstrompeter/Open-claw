// Floriststudions gränssnitt i en riktig sida (jsdom): startsidan, byggaren utan jobb, första priset, ändra och ta bort, kalkyl och inköp,
// katalogens ärliga data, sparstatus och tillgänglighetsstruktur. Priserna räknas av prismotorn, aldrig av skärmen: testerna jämför med motorn.
// Momssatsen är floristens egen inställning i testdata (25 %, aldrig verifierad).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { loadApp, v1State, item, wait } from './helpers/app.mjs';
import M from '../public/js/core/money.js';
import W from '../public/js/core/workspace.js';
import HomeUI from '../public/js/home-ui.js';

const { Money } = M;
const TODAY = '2026-10-07';
const WS_KEY = 'buketraknare.workspace.v1';
const ROS = ['Röd ros', 'Blommor', 10, 120, 'pack', TODAY];
const TULPAN = ['Tulpan', 'Blommor', 10, 55, 'bunt', TODAY];
const PION = ['Pion', 'Blommor', 5, 0, ''];
const seed = state => ({ storage: { 'buketraknare.v1': JSON.stringify(state) } });
const basic = (extra = {}) => v1State({ items: [item(ROS), item(TULPAN), item(PION)], ...extra });
const withApp = async (opts, fn) => { const app = await loadApp(opts); try { await fn(app); } finally { app.close(); } };
const savedWorkspace = app => JSON.parse(app.storage()[WS_KEY]);
const NB = s => s.replace(/ /g, ' ');
/** Text med mellanrum mellan elementen (etikett och värde ligger i skilda element, och skärmen lägger avståndet med CSS). */
const spaced = el => String(el ? el.innerHTML : '').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
const step = async (app, fn) => { fn(); await app.hook.jobs().idle(); await app.settle(); };
const submit = (app, sel) => app.click(sel + ' button[type="submit"]');
const tile = (app, name) => app.$$('#view-jobb .j-tile').find(t => t.querySelector('.j-tile-name').textContent === name);
const homeBtn = (app, kind) => app.$('[data-home="' + kind + '"]');
const tap = async (app, el) => { app.click(el); await app.hook.jobs().idle(); await app.settle(); };

async function newJob(app, { customer = 'Emma Svensson', name = 'Emma & Johan', type = 'wedding', date = '2026-06-12' } = {}) {
  await tap(app, homeBtn(app, 'job'));
  await step(app, () => { app.set('#jf-customer', customer, 'input'); app.set('#jf-name', name, 'input'); app.set('#jf-type', type); app.set('#jf-date', date); submit(app, '#jf-job'); });
}
async function newArrangement(app, name, qty = 1) {
  await step(app, () => { app.set('#jf-arr-name', name, 'input'); app.set('#jf-arr-qty', String(qty), 'input'); submit(app, '#jf-arr'); });
}

// ---------- skalet: landmärken, rubriker, navigering ----------
test('skalet: hoppa-till-innehållet, landmärken, en h1 per vy, aktiv flik och sidtitel följer med', async () => {
  await withApp(seed(basic()), async app => {
    const d = app.doc;
    assert.equal(d.documentElement.lang, 'sv');
    assert.equal(d.querySelector('a.skip').getAttribute('href'), '#main');
    assert.ok(d.querySelector('main#main')); assert.ok(d.querySelector('header.appbar')); assert.ok(d.querySelector('nav[aria-label="Huvudmeny"]'));
    assert.equal(d.title, 'Hem – Buketträknaren');
    assert.equal(app.$('#view-hem').hidden, false);
    for (const t of ['hem', 'jobb', 'prislista', 'bukett', 'installningar']) {
      app.tab(t); await app.hook.jobs().idle();
      const views = app.$$('main > section[id^="view-"]').filter(s => !s.hidden);
      assert.equal(views.length, 1, t); assert.equal(views[0].id, 'view-' + t);
      assert.equal(views[0].querySelectorAll('h1').length, 1, 'exakt en h1 i ' + t);
      assert.equal(app.$$('.nav-item[aria-current="page"]').map(b => b.dataset.tab).join(), t);
    }
    assert.equal(d.title, 'Inställningar – Buketträknaren');
    assert.equal(app.$$('.nav-item').map(b => b.textContent.trim()).join(), 'Hem,Jobb,Blommor,Snabbkalkyl,Inställningar');
  });
});

test('bakåtknappen går till föregående flik', async () => {
  await withApp(seed(basic()), async app => {
    app.tab('jobb'); await app.hook.jobs().idle(); app.tab('prislista');
    assert.equal(app.$('.nav-item[aria-current="page"]').dataset.tab, 'prislista');
    app.window.history.back(); await app.settle(8);
    assert.equal(app.$('.nav-item[aria-current="page"]').dataset.tab, 'jobb');
    assert.equal(app.$('#view-jobb').hidden, false);
  });
});

test('inga bilder och inga nycklar: inga <img>, inga externa bildadresser och ingen API-nyckel i det som skickas till webbläsaren', async () => {
  await withApp(seed(basic()), async app => {
    for (const t of ['hem', 'jobb', 'prislista', 'bukett', 'installningar']) { app.tab(t); await app.hook.jobs().idle(); assert.equal(app.$$('img').length, 0, 'img i ' + t); }
  });
  const PUB = new URL('../public/', import.meta.url).pathname;
  const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
  for (const f of walk(PUB).filter(f => /\.(html|js|css)$/.test(f))) {
    const src = fs.readFileSync(f, 'utf8');
    assert.doesNotMatch(src, /sk-ant-|ANTHROPIC_API_KEY|x-api-key/i, f + ' innehåller något som liknar en API-nyckel');
    assert.doesNotMatch(src, /url\(\s*['"]?https?:/i, f + ' hämtar en bild via CSS');
  }
  const css = fs.readFileSync(new URL('../public/css/studio.css', import.meta.url), 'utf8');
  assert.doesNotMatch(css, /url\(/, 'designsystemet använder inga bilder');
});

// ---------- Hem ----------
test('Hem: frågan, två tydliga val, tomläge, och en förklaring när priser saknas', async () => {
  await withApp({}, async app => {
    assert.equal(app.text('#view-hem h1'), 'Vad vill du skapa idag?');
    assert.deepEqual(app.$$('[data-home]').filter(b => ['bouquet', 'job'].includes(b.dataset.home)).map(b => app.text('[data-home="' + b.dataset.home + '"] .h-title')), ['Skapa en bukett', 'Planera ett kundjobb']);
    assert.match(app.text('#view-hem .h-empty'), /Inga arbeten än/); assert.match(app.text('#view-hem .h-empty'), /ungefär en minut/);
    assert.match(app.text('#view-hem .h-note'), /Du har inte lagt in några priser än/);
    assert.equal(app.$$('#view-hem .h-job').length, 0);
  });
  await withApp(seed(basic()), async app => {
    assert.equal(app.$('#view-hem .h-note'), null, 'med priser behövs ingen förklaring');
  });
});

test('Hem: de senaste jobben visas med kund, typ, datum och samma kundpris som Jobb, och går att öppna', async () => {
  await withApp(seed(basic()), async app => {
    await newJob(app);
    await newArrangement(app, 'Brudbukett');
    for (let i = 0; i < 5; i++) await tap(app, tile(app, 'Röd ros'));
    app.tab('hem'); await app.hook.jobs().idle(); await app.settle();
    const row = app.$$('#view-hem .h-job')[0];
    assert.ok(row); assert.match(row.textContent, /Emma & Johan/); assert.match(row.textContent, /Emma Svensson · Bröllop · 12 juni/);
    app.tab('jobb'); await app.hook.jobs().idle();
    const total = NB(app.text('#j-total .j-amt'));
    assert.equal(NB(app.text('#view-hem .h-job-price')).replace(/[✓≈] ?/, '').replace(/ ?inkl\. moms$/, ''), total, 'Hem och Jobb visar samma belopp');
    // öppna från Hem
    app.tab('hem'); await app.settle();
    await tap(app, app.$('#view-hem .h-job'));
    assert.equal(app.$('#view-jobb').hidden, false); assert.equal(app.$('.j-wrap').dataset.mode, 'overview');
  });
});

test('Hem: texter från floristen visas som text och kan aldrig bli HTML', () => {
  const html = HomeUI.homeHtml({ jobsReady: true, jobs: [{ id: 'x"><b>', name: '<img src=x onerror=alert(1)>', customer: '<b>fet</b>', type: 'Bröllop', date: '', price: { kind: 'ok', mark: '✓', text: '100 kr', tail: 'inkl. moms' } }] });
  assert.doesNotMatch(html, /<img|<b>/);
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
});

// ---------- Skapa en bukett (byggaren utan jobb) ----------
test('Skapa en bukett: byggaren öppnas utan jobb, och jobbet (typ Bukett, utan kund) skapas först när något läggs till', async () => {
  await withApp(seed(basic()), async app => {
    await tap(app, homeBtn(app, 'bouquet'));
    assert.equal(app.$('#view-jobb').hidden, false); assert.equal(app.$('.j-wrap').dataset.mode, 'builder');
    assert.ok(app.$('#j-detail')); assert.match(app.text('#j-detail .j-pricebar'), /Välj blommor så visas priset/);
    assert.equal(app.doc.body.dataset.focus, 'builder', 'på telefon byts navigeringen mot det fasta prisfältet');
    assert.equal(savedWorkspace(app).events.length, 0, 'inget tomt jobb skapas bara av att öppna byggaren');
    assert.equal(app.doc.activeElement.tagName, 'H2', 'fokus ligger på rubriken');
    await tap(app, tile(app, 'Röd ros'));
    const ws = savedWorkspace(app);
    assert.equal(ws.events.length, 1); assert.equal(ws.events[0].type, 'bouquet'); assert.equal(ws.events[0].customerId, null);
    assert.match(ws.events[0].name, /^Bukett \d+ oktober$/);
    assert.equal(ws.arrangements.length, 1); assert.equal(ws.arrangements[0].name, 'Bukett'); assert.equal(ws.items.length, 1);
    assert.equal(app.text('#j-status'), 'Sparat ✓'); assert.equal(app.text('#save-status'), 'Sparat ✓');
    // 1 ros = en hel förpackning à 120 kr: (120 × 1,5) × 1,25 = 225 kr
    assert.match(NB(app.text('#j-detail .j-pb-amt')), /^✓ 225 kr inkl\. moms$/);
  });
});

test('Skapa en bukett: lämnar man byggaren utan att lägga till något skapas inget jobb, och namn och antal kan väljas före första blomman', async () => {
  await withApp(seed(basic()), async app => {
    await tap(app, homeBtn(app, 'bouquet'));
    app.click('#j-detail [data-j="close"]'); await app.settle();
    assert.equal(app.$('#view-hem').hidden, false); assert.equal(savedWorkspace(app).events.length, 0);
    assert.equal(app.doc.body.dataset.focus, '');
    await tap(app, homeBtn(app, 'bouquet'));
    await step(app, () => { app.set('#j-arr-name', 'Födelsedagsbukett'); app.click('#j-detail [data-j="arrstep"][data-dir="1"]'); app.click('#j-detail [data-j="arrstep"][data-dir="1"]'); });
    await tap(app, tile(app, 'Tulpan'));
    const a = savedWorkspace(app).arrangements[0];
    assert.equal(a.name, 'Födelsedagsbukett'); assert.equal(a.quantity, 3);
  });
});

// ---------- det första priset: skriv in det där man står ----------
test('saknas priset frågar raden direkt vad en förpackning kostar, och svaret sparas i prislistan och räknas av motorn', async () => {
  await withApp(seed(basic()), async app => {
    await tap(app, homeBtn(app, 'bouquet'));
    await tap(app, tile(app, 'Pion'));
    assert.match(app.text('#j-detail .j-item'), /Vad kostar Pion\?/);
    assert.equal(app.doc.activeElement.name, 'pris', 'fokus ligger i prisfältet');
    assert.match(app.text('#j-detail .j-pricebar'), /Pris saknas/); assert.equal(app.$('#j-detail .j-pricebar [data-j="gotoprice"]').textContent, 'Fyll i pris');
    // felaktiga uppgifter ger ett svar i formuläret, fälten behålls och inget sparas
    const form = () => app.$('.j-priceform');
    for (const [v, re] of [['abc', /Skriv priset per förpackning i kronor/], ['0', /Priset måste vara större än noll/]]) {
      await step(app, () => { app.set(form().elements.pris, v, 'input'); app.click('.j-priceform button[type="submit"]'); });
      assert.match(app.text('.j-priceform [role="alert"]'), re); assert.equal(form().elements.pris.value, v, 'det man skrev finns kvar');
      assert.equal(app.hook.state().priceList.items.find(i => i.namn === 'Pion').pris, 0);
    }
    await step(app, () => { app.set(form().elements.paket, '5', 'input'); app.set(form().elements.pris, '62,50', 'input'); app.click('.j-priceform button[type="submit"]'); });
    const pion = app.hook.state().priceList.items.find(i => i.namn === 'Pion');
    assert.equal(pion.pris, 62.5); assert.equal(pion.paket, 5); assert.equal(pion.uppd, TODAY);
    assert.equal(app.$('.j-priceform'), null, 'frågan försvinner när priset finns');
    // 1 pion = en hel förpackning à 62,50: 62,50 × 1,5 = 93,75 × 1,25 = 117,19 → 120 kr
    assert.match(NB(app.text('#j-detail .j-pricebar')), /✓ 120 kr inkl\. moms/);
    // samma pris syns i Blommor
    app.tab('prislista'); assert.match(app.text('[data-art="2"] .art-meta'), /62,50 kr per förp/);
    assert.match(app.text('[data-art="2"] .art-fresh'), /✓ Pris från idag/);
    // och i den gamla Snabbkalkyl: samma prislista
    app.tab('bukett'); assert.match(app.tileText('Pion'), /12,50 kr\/st/);
  });
});

// ---------- bukettbyggaren: antal, material, ändra och ta bort ----------
test('antal med plus och minus: en rad, ett arrangemang och de likadana, aldrig under 1', async () => {
  await withApp(seed(basic()), async app => {
    await newJob(app); await newArrangement(app, 'Bordsdekoration');
    await tap(app, tile(app, 'Röd ros'));
    const qty = () => app.$('#j-detail input[data-jf="itemqty"]').value;
    assert.equal(qty(), '1'); assert.equal(app.$('#j-detail [data-j="itemstep"][data-dir="-1"]').disabled, true, 'minus är avstängd vid 1');
    await tap(app, app.$('#j-detail [data-j="itemstep"][data-dir="1"]')); await tap(app, app.$('#j-detail [data-j="itemstep"][data-dir="1"]'));
    assert.equal(qty(), '3'); assert.equal(savedWorkspace(app).items[0].quantity, '3');
    await tap(app, app.$('#j-detail [data-j="itemstep"][data-dir="-1"]')); assert.equal(qty(), '2');
    await tap(app, app.$('#j-detail [data-j="arrstep"][data-dir="1"]')); assert.equal(savedWorkspace(app).arrangements[0].quantity, 2);
    await tap(app, app.$('#j-detail [data-j="arrstep"][data-dir="-1"]')); await tap(app, app.$('#j-detail [data-j="arrstep"][data-dir="-1"]'));
    assert.equal(savedWorkspace(app).arrangements[0].quantity, 1);
    // blomkortet visar hur många som finns i arrangemanget
    assert.equal(app.text('#j-results .j-tile.on .j-tile-count'), '2');
  });
});

test('eget material: bara de fält som hör till valet visas, och ett felaktigt formulär behåller det man skrev', async () => {
  await withApp(seed(basic()), async app => {
    await newJob(app); await newArrangement(app, 'Brudbukett');
    const form = app.$('#jf-own');
    assert.equal(form.dataset.pmode, 'STANDARD_MARKUP');
    app.click('input[name="j-pmode"][value="FIXED_SALE_PRICE"]'); assert.equal(form.dataset.pmode, 'FIXED_SALE_PRICE');
    app.click('input[name="j-pmode"][value="INCLUDED"]'); assert.equal(form.dataset.pmode, 'INCLUDED');
    // ett fast pris utan belopp: fältet och valet finns kvar
    await step(app, () => { app.set('#jf-own-name', 'Vas', 'input'); app.click('input[name="j-pmode"][value="FIXED_SALE_PRICE"]'); app.set('#jf-own-price', '', 'input'); submit(app, '#jf-own'); });
    assert.match(app.text('#jf-own [role="alert"]'), /Skriv priset i kronor/);
    assert.equal(app.$('#jf-own-name').value, 'Vas'); assert.equal(app.$('input[name="j-pmode"][value="FIXED_SALE_PRICE"]').checked, true);
    // ett fel från arbetsytan (0 kr som kalkylkostnad) behåller också formuläret
    await step(app, () => { app.click('input[name="j-pmode"][value="STANDARD_MARKUP"]'); app.set('#jf-own-cost', '0', 'input'); submit(app, '#jf-own'); });
    assert.match(app.text('#j-alert'), /Noll inköpskostnad betyder inte noll värde/);
    assert.equal(app.$('#jf-own-name').value, 'Vas', 'namnet finns kvar efter felet'); assert.equal(app.$('#jf-own-cost').value, '0');
    assert.equal(app.$('#j-own').open, true); assert.equal(savedWorkspace(app).items.length, 0);
  });
});

test('arbete utan belopp säger att priset bara innehåller material och påslag', async () => {
  await withApp(seed(basic()), async app => {
    await newJob(app); await newArrangement(app, 'Brudbukett');
    assert.match(app.text('#j-detail'), /Inget arbete angivet\. Priset innehåller bara material och påslag\./);
  });
});

test('ändra uppgifter: kund, namn, typ och datum, utan att kunden dubbleras', async () => {
  await withApp(seed(basic()), async app => {
    await newJob(app, { customer: 'Emma Svenson', name: 'Emma Svenson – Bröllop' });
    app.tab('jobb'); await app.hook.jobs().idle();
    await tap(app, app.$('[data-j="editjob"]'));
    assert.equal(app.$('#je-customer').value, 'Emma Svenson'); assert.equal(app.$('#je-name').value, 'Emma Svenson – Bröllop');
    await step(app, () => { app.set('#je-customer', 'Emma Svensson', 'input'); app.set('#je-name', 'Emma Svensson – Begravning', 'input'); app.set('#je-type', 'funeral'); app.set('#je-date', '2026-07-01'); submit(app, '#jf-edit'); });
    const ws = savedWorkspace(app);
    assert.equal(ws.customers.length, 1, 'stavningen rättades, ingen ny kund'); assert.equal(ws.customers[0].name, 'Emma Svensson');
    const ev = ws.events[0]; assert.equal(ev.name, 'Emma Svensson – Begravning'); assert.equal(ev.type, 'funeral'); assert.equal(ev.eventDate, '2026-07-01');
    assert.match(app.text('.j-job .j-meta'), /Emma Svensson · Begravning · 1 juli/);
    assert.equal(app.$('#jf-edit'), null, 'formuläret stängs när det sparats');
    // en kund som redan finns kopplas, ingen ny skapas; tomt fält tar bort kopplingen
    await tap(app, app.$('[data-j="editjob"]'));
    await step(app, () => { app.set('#je-customer', '', 'input'); submit(app, '#jf-edit'); });
    assert.equal(savedWorkspace(app).events[0].customerId, null); assert.match(app.text('.j-job .j-meta'), /^Ingen kund/);
    assert.equal(savedWorkspace(app).customers.length, 1, 'kunden finns kvar i kundlistan');
  });
});

test('ta bort arrangemanget kräver ett andra tryck och tar med sig raderna', async () => {
  await withApp(seed(basic()), async app => {
    await newJob(app); await newArrangement(app, 'Brudbukett'); await tap(app, tile(app, 'Röd ros'));
    await step(app, () => app.click('#j-detail [data-j="rmarr"]'));
    assert.match(app.text('#j-detail [data-j="rmarr"]'), /Säker\? Tryck igen/); assert.equal(savedWorkspace(app).arrangements[0].deletedAt, null);
    await step(app, () => app.click('#j-detail [data-j="rmarr"]'));
    assert.notEqual(savedWorkspace(app).arrangements[0].deletedAt, null); assert.notEqual(savedWorkspace(app).items[0].deletedAt, null);
    assert.equal(app.$('#j-detail'), null); assert.equal(app.$('.j-wrap').dataset.mode, 'overview'); assert.equal(app.$$('.j-arr').length, 0);
  });
});

test('ett nytt jobb kan skapas från jobbvyn, och sekundära val ligger hopfällda', async () => {
  await withApp(seed(basic()), async app => {
    await newJob(app);
    assert.equal(app.$('#j-more').open, false, 'byt jobb, kundtyp och ta bort ligger hopfällda');
    await step(app, () => app.click('[data-j="newjob"]'));
    assert.equal(app.$('.j-wrap').dataset.mode, 'new'); assert.ok(app.$('#jf-job'));
    await step(app, () => app.click('[data-j="cancelnewjob"]'));
    assert.equal(app.$('.j-wrap').dataset.mode, 'overview');
  });
});

test('val-knappar: typ och kundtyp styr de dolda fälten, och jobbets namn föreslås tills man skriver ett eget', async () => {
  await withApp(seed(basic()), async app => {
    await tap(app, homeBtn(app, 'job'));
    assert.equal(app.$('#jf-name').value, '');
    await step(app, () => app.set('#jf-customer', 'Ida Berg', 'input'));
    assert.equal(app.$('#jf-name').value, 'Ida Berg – Bröllop');
    app.click('input[data-choice="jf-type"][value="funeral"]');
    assert.equal(app.$('#jf-type').value, 'funeral'); assert.equal(app.$('#jf-name').value, 'Ida Berg – Begravning');
    app.click('input[data-choice="jf-kind"][value="BUSINESS"]'); assert.equal(app.$('#jf-kind').value, 'BUSINESS');
    app.set('#jf-name', 'Egen rubrik', 'input'); app.click('input[data-choice="jf-type"][value="other"]');
    assert.equal(app.$('#jf-name').value, 'Egen rubrik', 'ett eget namn skrivs aldrig över');
    await step(app, () => submit(app, '#jf-job'));
    const ws = savedWorkspace(app); assert.equal(ws.events[0].type, 'other'); assert.equal(ws.customers[0].customerKind, 'BUSINESS');
  });
});

// ---------- kalkyl och inköp ----------
test('kalkyl och inköp: uppbyggnad, beräknat och presenterat, förpackningar och överskott kommer från motorn', async () => {
  await withApp(seed(basic()), async app => {
    await newJob(app); await newArrangement(app, 'Brudbukett');
    for (let i = 0; i < 3; i++) await tap(app, tile(app, 'Röd ros'));
    await step(app, () => app.set('#j-labor', '125'));
    await tap(app, app.$('#j-detail [data-j="close"]'));
    assert.equal(app.$('#j-calc'), null, 'kalkylen ritas först när den öppnas');
    await tap(app, app.$('[data-j="opencalc"]'));
    assert.equal(app.$('.j-wrap').dataset.mode, 'calc');
    const text = NB(spaced(app.$('#j-calc')));
    // 3 rosor = 1 förpackning à 120 kr. (120 × 1,5) + 125 arbete = 305 exkl. moms = 381,25 inkl. moms → 385 kr
    assert.match(text, /Material \(din kalkylkostnad\) 120 kr/); assert.match(text, /Påslag 60 kr/); assert.match(text, /Arbete 125 kr/);
    assert.match(text, /Summa exkl\. moms 305 kr/); assert.match(text, /Moms 76,25 kr/); assert.match(text, /Beräknat pris inkl\. moms 381,25 kr/); assert.match(text, /Avrundning 3,75 kr/); assert.match(text, /Pris till kund inkl\. moms 385 kr/);
    assert.match(text, /Beräknat exakt, före avrundning 381,25 kr/); assert.match(text, /Presenterat det du säger till kunden 385 kr/);
    assert.doesNotMatch(text, /Överenskommet/, 'överenskommet visas bara när kunden sagt ja');
    assert.match(text, /Röd ros 10-pack · 120 kr per förpackning Behövs 3 Köp 1 × 10 = 10 Över 7 120 kr/);
    assert.match(text, /Summa inköp, exkl\. moms 120 kr/); assert.match(text, /Blir över: 7 stjälkar, värde 84 kr\. Det ingår i kundpriset/);
    // samma belopp som motorn räknar på det som sparats
    const ws = savedWorkspace(app), res = W.priceEvent(ws, ws.events[0].id, { catalog: (await import('../public/js/core/bridge.js')).default.catalogFromView(app.hook.state(), { today: TODAY }).catalog, today: TODAY });
    assert.equal(res.job.totalIncVat.toDecimalString(), '385.00'); assert.equal(res.plan.requirements[0].packs, 1); assert.equal(res.plan.requirements[0].leftover, 7);
    await tap(app, app.$('[data-j="closecalc"]')); assert.equal(app.$('.j-wrap').dataset.mode, 'overview'); assert.equal(app.$('#j-calc'), null);
  });
});

test('kalkyl och inköp: inköpet nämner egna material som inte beställs, och ett pris som saknas stoppar kalkylen med klartext', async () => {
  await withApp(seed(basic()), async app => {
    await newJob(app); await newArrangement(app, 'Brudbukett');
    await tap(app, tile(app, 'Pion'));
    await tap(app, app.$('#j-detail [data-j="close"]'));
    assert.equal(app.$('[data-j="opencalc"]'), null, 'ingen kalkylknapp när priset saknas');
    app.tab('jobb'); await tap(app, app.$('.j-arr .link')); // öppna igen
    assert.match(app.text('#j-total'), /Pris saknas för Pion/);
    await step(app, () => { app.set('.j-priceform input[name="pris"]', '50', 'input'); app.click('.j-priceform button[type="submit"]'); });
    await step(app, () => { app.click('#j-own summary'); app.set('#jf-own-name', 'Sidenband', 'input'); app.click('input[name="j-pmode"][value="STANDARD_MARKUP"]'); app.set('#jf-own-cost', '25', 'input'); submit(app, '#jf-own'); });
    await tap(app, app.$('#j-detail [data-j="close"]'));
    await tap(app, app.$('[data-j="opencalc"]'));
    assert.match(app.text('#j-calc'), /Beställs inte \(eget lager och egen trädgård\): Sidenband\./);
    assert.match(app.text('#j-calc'), /Pion/);
  });
});

test('kalkyl och inköp: ett överenskommet pris visas när det finns, och bara då', async () => {
  // jobbet med en godkänd kundorder byggs med arbetsytan (samma anrop som skärmen använder) och läggs i lagringen
  let n = 0;
  const ctx = { now: () => '2026-10-07T10:00:00.000Z', newId: p => p + '_t' + (++n) };
  const st = W.createWorkspace(ctx, {});
  const ev = W.createEvent(st, ctx, { name: 'Emma & Johan', type: 'wedding', eventDate: '2026-06-12' });
  const arr = W.addArrangement(st, ctx, ev.id, { name: 'Brudbukett', quantity: 1 });
  W.addItem(st, ctx, arr.id, { source: 'OWN_STOCK', name: 'Vas', quantity: 1, pricing: { mode: 'FIXED_SALE_PRICE', unitSalePrice: { amount: Money.fromDecimal('650').toJSON(), basis: 'inc' } } });
  const q = W.createQuote(st, ctx, ev.id, { today: TODAY });
  W.acceptQuote(st, ctx, q.id, { approvedBy: 'Anna', agreed: { [arr.id]: Money.fromDecimal('600').toJSON() } });
  await withApp({ storage: { 'buketraknare.v1': JSON.stringify(basic()), [WS_KEY]: JSON.stringify(st) } }, async app => {
    app.tab('jobb'); await app.hook.jobs().idle();
    await tap(app, app.$('[data-j="opencalc"]'));
    const t = NB(spaced(app.$('#j-calc')));
    assert.match(t, /Presenterat det du säger till kunden 650 kr/); assert.match(t, /Överenskommet kundens ja, version 1 600 kr/);
    assert.match(t, /Det överenskomna priset är sparat och ändras aldrig av att kalkylen ändras\./);
    assert.equal(savedWorkspace(app).orders[0].totals.agreedIncVat.amount !== undefined, true);
  });
});

// ---------- Blommor (katalogen) ----------
test('Blommor: sökning, kategorier och en rad som öppnas för att ändra, med färskhet som ✓, ≈ eller okänd', async () => {
  const old = v1State({ items: [item(ROS), item(['Tulpan', 'Blommor', 10, 55, 'bunt', '2026-10-04']), item(['Eukalyptus', 'Grönt', 10, 65, 'bunt']), item(PION)] });
  await withApp(seed(old), async app => {
    app.tab('prislista');
    const fresh = n => app.text('[data-art="' + n + '"] .art-fresh');
    assert.equal(fresh(0), '✓ Pris från idag'); assert.equal(fresh(1), '≈ Pris från 3 dagar sedan'); assert.equal(fresh(2), 'Prisets datum är okänt'); assert.equal(fresh(3), 'Pris saknas');
    assert.equal(app.$$('.art').length, 4);
    app.set('#pl-search', 'tul', 'input'); assert.deepEqual(app.$$('.art-name').map(e => e.textContent), ['Tulpan']);
    app.set('#pl-search', '', 'input');
    app.click('[data-act="pl-cat"][data-cat="Grönt"]'); assert.deepEqual(app.$$('.art-name').map(e => e.textContent), ['Eukalyptus']);
    assert.equal(app.$('[data-act="pl-cat"][data-cat="Grönt"]').getAttribute('aria-pressed'), 'true');
    app.click('[data-act="pl-cat"][data-cat=""]');
    assert.equal(app.$('[data-art="0"] .art-edit').hidden, true);
    app.click('[data-act="edit-row"][data-i="0"]');
    assert.equal(app.$('[data-art="0"] .art-edit').hidden, false); assert.equal(app.$('[data-act="edit-row"][data-i="0"]').getAttribute('aria-expanded'), 'true');
    app.set('input[data-pl="pris"][data-i="3"]', '77');           // Pion får ett pris
    assert.equal(fresh(3), '✓ Pris från idag'); assert.match(app.text('[data-art="3"] .art-meta'), /77 kr per förp/);
  });
});

test('Blommor visar inga påhittade artikelfakta: den egna prislistan har varken artikelnummer, längd eller tillgänglighet', async () => {
  await withApp(seed(basic()), async app => {
    app.tab('prislista');
    assert.equal(app.$$('.art-facts').length, 0);
    assert.doesNotMatch(app.text('#view-prislista'), /Art\.?\s?nr|SKU|Tillgänglighet|I lager|Längd|Sort/i);
    assert.doesNotMatch(app.text('#view-prislista'), /favorit|♡|♥/i, 'favoriter finns inte i datamodellen och visas inte');
  });
});

test('Blommor visar sort, längd, tillgänglighet och källa bara när de finns i datamodellen', async () => {
  const first = await loadApp(seed(basic()));
  const model = JSON.parse(JSON.stringify(first.hook.model())); first.close();
  const ros = model.products.find(p => p.name === 'Röd ros');
  const sp = model.supplierProducts.find(s => s.supplierProductId === ros.id); sp.cultivar = 'Freedom'; sp.stemLengthCm = 60; sp.origin = 'Ecuador';
  const q = model.quotes.filter(x => x.supplierProductId === ros.id).pop(); q.availability = 'low'; q.verification = 'live';
  await withApp({ storage: { 'buketraknare.v2': JSON.stringify(model) } }, async app => {
    app.tab('prislista');
    const facts = app.$$('[data-art="0"] .art-facts div').map(d => spaced(d));
    assert.deepEqual(facts, ['Sort Freedom', 'Längd 60 cm', 'Ursprung Ecuador', 'Tillgänglighet Få kvar', 'Källa Direkt från grossisten']);
    assert.equal(app.$$('[data-art="1"] .art-facts').length, 0, 'en annan vara utan fakta får inga');
  });
});

test('Blommor: sökning utan träff erbjuder att lägga till blomman, och den nya blomman öppnas för pris', async () => {
  await withApp(seed(basic()), async app => {
    app.tab('prislista');
    app.set('#pl-search', 'dahlia', 'input');
    assert.match(app.text('#pl-table'), /Lägg till "dahlia" som ny blomma/);
    app.click('[data-act="pl-add-named"]');
    assert.equal(app.$$('.art-name').map(e => e.textContent).pop(), 'Dahlia');
    assert.equal(app.doc.activeElement.dataset.pl, 'pris');
    assert.equal(app.$('#pl-search').value, '');
  });
});

// ---------- sparstatus ----------
test('sparstatus: "Sparat ✓" syns efter en ändring i den gamla delen, och "Inte sparat" när lagringen är full', async () => {
  await withApp(seed(basic()), async app => {
    assert.equal(app.text('#save-status'), '');
    app.tab('bukett'); app.add('Röd ros');
    assert.equal(app.text('#save-status'), 'Sparat ✓'); assert.equal(app.$('#save-status').getAttribute('aria-hidden'), 'true');
  });
  await withApp({ ...seed(basic()), failWrite: 'buketraknare.v2' }, async app => {
    app.tab('bukett'); app.add('Röd ros');
    assert.equal(app.text('#save-status'), 'Inte sparat'); assert.ok(app.$('#save-status').classList.contains('bad'));
    assert.equal(app.count('Röd ros'), 1, 'man kan fortsätta arbeta');
  });
});

test('Hämta pris-fönstret är ett riktigt fönster: dialog, inaktiv bakgrund, Escape stänger och fokus går tillbaka', async () => {
  await withApp(seed(basic()), async app => {
    app.tab('prislista');
    const opener = app.$('#pl-head [data-act="open-update"]'); opener.focus();
    app.click(opener); await app.settle();
    const dlg = app.$('#update-panel [role="dialog"]');
    assert.ok(dlg); assert.equal(dlg.getAttribute('aria-modal'), 'true'); assert.ok(app.$(dlg.getAttribute('aria-labelledby') ? '#' + dlg.getAttribute('aria-labelledby') : 'x'));
    assert.equal(app.$('.app').inert, true); assert.ok(app.doc.body.classList.contains('modal-open'));
    assert.equal(app.doc.activeElement.id, 'upd-title');
    app.doc.dispatchEvent(new app.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await app.settle();
    assert.equal(app.$('#update-panel').hidden, true); assert.equal(app.$('.app').inert, false); assert.ok(!app.doc.body.classList.contains('modal-open'));
    assert.equal(app.doc.activeElement, opener);
  });
});

// ---------- fel isolering och långa namn ----------
test('långa och konstiga namn: allt visas som text, ingenting läcker ut ur sidan', async () => {
  const long = 'Maria Elisabeth Andersson-Lindqvist von Hartmanshagen och Jan-Olof '.repeat(3).trim();
  await withApp(seed(basic()), async app => {
    await newJob(app, { customer: long, name: long + ' <b>fet</b>' });
    await newArrangement(app, 'Å'.repeat(120) + '<i>kursiv</i>');
    await tap(app, tile(app, 'Röd ros'));
    app.tab('hem'); await app.hook.jobs().idle(); await app.settle();
    for (const sel of ['#view-hem', '#view-jobb']) { assert.equal(app.$$(sel + ' b, ' + sel + ' i').length, 0, sel); }
    assert.ok(app.text('#view-hem .h-job-name').includes('<b>fet</b>'));
    const all = app.text('#view-jobb') + app.text('#view-hem');
    for (const bad of ['undefined', 'NaN', '[object', 'Infinity']) assert.ok(!all.includes(bad), bad);
  });
});

// ---------- luckor som mutationstestet hittade ----------
test('antal går aldrig under 1: före första blomman, i formuläret för nytt arrangemang och på arrangemanget', async () => {
  await withApp(seed(basic()), async app => {
    await tap(app, homeBtn(app, 'bouquet'));
    const qty = () => app.$('#j-arr-qty').value;
    await tap(app, app.$('#j-detail [data-j="arrstep"][data-dir="-1"]')); assert.equal(qty(), '1');
    await tap(app, app.$('#j-detail [data-j="arrstep"][data-dir="1"]')); assert.equal(qty(), '2');
    await tap(app, app.$('#j-detail [data-j="arrstep"][data-dir="-1"]')); await tap(app, app.$('#j-detail [data-j="arrstep"][data-dir="-1"]')); assert.equal(qty(), '1');
    app.click('#j-detail [data-j="close"]'); await app.settle();
    await newJob(app);
    app.click('[data-j="fieldstep"][data-for="jf-arr-qty"][data-dir="-1"]'); assert.equal(app.$('#jf-arr-qty').value, '1');
    app.click('[data-j="fieldstep"][data-for="jf-arr-qty"][data-dir="1"]'); assert.equal(app.$('#jf-arr-qty').value, '2');
  });
});

test('företagskund: Hem visar priset exkl. moms, och det är exakt det prismotorn räknar fram', async () => {
  await withApp(seed(basic()), async app => {
    await tap(app, homeBtn(app, 'job'));
    await step(app, () => { app.set('#jf-customer', 'Blomsterbutiken AB', 'input'); app.set('#jf-kind', 'BUSINESS'); submit(app, '#jf-job'); });
    await newArrangement(app, 'Entré'); await tap(app, tile(app, 'Röd ros'));
    // en hel förpackning à 120 kr: 120 × 1,5 = 180 exkl. moms, 225 inkl. moms
    assert.match(NB(app.text('#j-total .j-big')), /^✓ 180 kr exkl\. moms$/);
    app.tab('hem'); await app.hook.jobs().idle(); await app.settle();
    assert.match(NB(app.text('#view-hem .h-job-price')), /^✓ 180 kr exkl\. moms$/);
  });
});

test('kundpriset läses upp för skärmläsare när det ändras (och bara då)', async () => {
  await withApp(seed(basic()), async app => {
    await tap(app, homeBtn(app, 'bouquet'));
    await tap(app, tile(app, 'Röd ros')); await wait(80);
    assert.match(NB(app.text('#sr-live')), /^Kundpris ✓ 225 kr inkl\. moms Bekräftat pris$/);
    await tap(app, tile(app, 'Tulpan')); await wait(80);
    assert.match(NB(app.text('#sr-live')), /Kundpris ✓ \d+ kr inkl\. moms/)
  });
});

test('"Min order"-noten visas i jobbvyn och följer inte med in i byggaren eller tillbaka', async () => {
  const old = basic({ buketter: [{ size: 'medel', qty: 1, items: { 'Röd ros': 5 } }] });
  await withApp(seed(old), async app => {
    app.tab('jobb'); await app.hook.jobs().idle();
    assert.match(app.text('.j-wrap'), /Din nuvarande order finns nu som jobbet "Min order"/);
    await tap(app, app.$('.j-arr .link'));
    assert.doesNotMatch(app.text('.j-wrap'), /Din nuvarande order finns nu/);
    await tap(app, app.$('#j-detail [data-j="close"]'));
    assert.doesNotMatch(app.text('.j-wrap'), /Din nuvarande order finns nu/, 'noten är läst och kommer inte tillbaka');
  });
});

test('Hem synkas mot Inställningar: ett höjt påslag syns på Hem med samma belopp som i Jobb, utan att man öppnat Jobb däremellan', async () => {
  await withApp(seed(basic()), async app => {
    await newJob(app); await newArrangement(app, 'Bukett'); await tap(app, tile(app, 'Röd ros'));
    app.tab('hem'); await app.hook.jobs().idle(); await app.settle();
    assert.match(NB(app.text('#view-hem .h-job-price')), /225 kr/);
    app.tab('installningar'); app.set('input[data-set="markupPct"]', '100');
    app.tab('hem'); await app.hook.jobs().idle(); await app.settle();
    // 120 × 2 = 240 exkl. moms, 300 kr inkl. moms
    assert.match(NB(app.text('#view-hem .h-job-price')), /300 kr/);
    app.tab('jobb'); await app.hook.jobs().idle();
    assert.match(NB(app.text('#j-total .j-big')), /300 kr inkl\. moms/);
  });
});

test('Hem visar de fem senaste jobben och en länk till alla när det finns fler', async () => {
  let n = 0, t = 0;
  const ctx = { now: () => new Date(Date.UTC(2026, 9, 7, 10, 0, t++)).toISOString(), newId: p => p + '_s' + (++n) };
  const st = W.createWorkspace(ctx, {});
  for (let i = 1; i <= 6; i++) {
    const ev = W.createEvent(st, ctx, { name: 'Jobb ' + i, type: 'other' });
    const a = W.addArrangement(st, ctx, ev.id, { name: 'Del', quantity: 1 });
    W.addItem(st, ctx, a.id, { source: 'OWN_STOCK', name: 'Vas', quantity: 1, pricing: { mode: 'FIXED_SALE_PRICE', unitSalePrice: { amount: Money.fromDecimal(String(100 + i)).toJSON(), basis: 'inc' } } });
  }
  await withApp({ storage: { 'buketraknare.v1': JSON.stringify(basic()), [WS_KEY]: JSON.stringify(st) } }, async app => {
    await app.hook.jobs().idle(); await app.settle();
    assert.deepEqual(app.$$('#view-hem .h-job-name').map(e => e.textContent), ['Jobb 6', 'Jobb 5', 'Jobb 4', 'Jobb 3', 'Jobb 2'], 'senast ändrade först, högst fem');
    assert.equal(app.text('[data-home="alljobs"]'), 'Visa alla 6 jobb');
    await tap(app, app.$('[data-home="alljobs"]')); assert.equal(app.$('#view-jobb').hidden, false);
  });
});
