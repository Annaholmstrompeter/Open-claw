// Det floristen gör i appen: välja blommor, buketter, recept, hemma, ny blomma, byta namn,
// samt att sparad data överlever omstart. Testerna går via knappar och texter, inte interna nycklar.
// Kroken window.buketraknare.state() läses bara som en vy i det gamla formatet (wholesaler, settings, order …).
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadApp, v1State, item, DEFAULT_SETTINGS } from './helpers/app.mjs';

const TODAY = '2026-10-07';
const ROS = ['Röd ros', 'Blommor', 10, 120, 'pack', TODAY];
const TULPAN = ['Tulpan', 'Blommor', 10, 55, 'bunt', TODAY];
const seed = (state) => ({ storage: { 'buketraknare.v1': JSON.stringify(state) } });
const withApp = async (state, fn) => { const app = await loadApp(state ? seed(state) : {}); try { await fn(app); } finally { app.close(); } };
const basic = (extra = {}) => v1State({ items: [item(ROS), item(TULPAN)], ...extra });

// ---------- start och val av blommor ----------

test('första start: de 20 vanligaste blommorna som knappar, utan priser, och ingen summa', async () => {
  await withApp(null, app => {
    const names = app.$$('#tiles .tile-name').map(e => e.textContent);
    assert.equal(names.length, 21, '20 blommor + "Ny blomma"');
    for (const n of ['Röd ros', 'Rosa ros', 'Vit ros', 'Tulpan', 'Lisianthus', 'Eukalyptus', 'Slöjflor', 'Ruscus', 'Pion']) assert.ok(names.includes(n), n);
    assert.match(app.text('#fresh'), /Inga priser än/);
    assert.equal(app.$$('#tiles .tile-meta').filter(e => /\d\s?kr/.test(e.textContent)).length, 0, 'inga priser påhittade');
    assert.equal(app.text('#totalbar strong'), '–');
    assert.match(app.text('#summary'), /Välj blommor till bukett 1/);
    assert.equal(app.hook.state().priceList.meta.kalla, 'tom');
  });
});

test('tryck lägger till en blomma, fler tryck fler, minus tar bort en och tar bort raden vid noll', async () => {
  await withApp(basic(), app => {
    app.add('Röd ros');
    assert.equal(app.count('Röd ros'), 1);
    app.add('Röd ros', 2);
    assert.equal(app.count('Röd ros'), 3);
    app.dec('Röd ros');
    assert.equal(app.count('Röd ros'), 2);
    app.dec('Röd ros'); app.dec('Röd ros');
    assert.equal(app.count('Röd ros'), 0);
    assert.equal(app.tile('Röd ros').querySelector('.minus'), null, 'minusknappen försvinner vid 0');
  });
});

test('priset räknas om direkt när man trycker', async () => {
  await withApp(basic(), app => {
    assert.equal(app.text('#totalbar strong'), '–');
    app.add('Röd ros', 7);
    assert.equal(app.text('#totalbar strong'), '405 kr');
    assert.equal(app.text('#summary .price-card .big'), '405 kr');
  });
});

test('mätaren visar hur många stjälkar som saknas, nås och överskrids', async () => {
  await withApp(basic(), app => {
    assert.match(app.text('#editor'), /Välj blommor nedan\. Riktvärde för medel: 15 stjälkar\./);
    app.add('Tulpan', 7);
    assert.match(app.text('#editor'), /7 av 15 stjälkar, 8 kvar till medel/);
    app.add('Tulpan', 8);
    assert.match(app.text('#editor'), /15 av 15 stjälkar, riktvärdet är nått/);
    app.add('Tulpan');
    assert.match(app.text('#editor'), /16 stjälkar, 1 över riktvärdet för medel/);
  });
});

test('storlek byts med knapparna och påverkar pris och riktvärde', async () => {
  await withApp(basic(), app => {
    app.add('Röd ros', 3);
    const price = () => app.text('#totalbar strong');
    const medel = price();
    app.click('[data-act="size"][data-size="stor"]');
    assert.notEqual(price(), medel, 'stor bukett har mer emballage och arbete');
    assert.match(app.text('#editor'), /3 av 25 stjälkar/);
    assert.equal(app.$('[data-act="size"][data-size="stor"]').getAttribute('aria-pressed'), 'true');
    assert.equal(app.$('[data-act="size"][data-size="medel"]').getAttribute('aria-pressed'), 'false');
  });
});

test('antal likadana buketter: minst 1 och högst 99', async () => {
  await withApp(basic(), app => {
    app.add('Röd ros', 2);
    app.click('[data-act="qty-dec"]');
    assert.equal(app.text('#editor output'), '1');
    for (let i = 0; i < 120; i++) app.click('[data-act="qty-inc"]');
    assert.equal(app.text('#editor output'), '99');
    assert.match(app.text('#chips'), /Bukett 1 · Medel ×99/);
  });
});

test('flera buketter: ny bukett ärver storlek, kan bytas mellan och tas bort (aldrig den sista)', async () => {
  await withApp(basic(), app => {
    app.click('[data-act="size"][data-size="stor"]');
    app.add('Röd ros', 2);
    app.click('[data-act="new-bouquet"]');
    assert.match(app.text('#chips'), /Bukett 1 · Stor.*Bukett 2 · Stor/);
    assert.equal(app.count('Röd ros'), 0, 'den nya buketten är tom och aktiv');
    app.add('Tulpan', 3);
    app.click('[data-act="chip"][data-id="b1"]');
    assert.equal(app.count('Röd ros'), 2);
    assert.equal(app.count('Tulpan'), 0);
    // ta bort bukett 2
    app.click('[data-act="del-bouquet"][data-id="b2"]');
    assert.doesNotMatch(app.text('#chips'), /Bukett 2/);
    assert.equal(app.$('[data-act="del-bouquet"]'), null, 'sista buketten kan inte tas bort');
  });
});

test('Töm ordern kräver ett andra tryck', async () => {
  await withApp(basic(), app => {
    app.add('Röd ros', 4);
    app.click('[data-act="clear-order"]');
    assert.equal(app.count('Röd ros'), 4, 'första trycket gör inget');
    assert.match(app.$('[data-act="clear-order"]').textContent, /Säker\? Tryck igen/);
    app.click('[data-act="clear-order"]');
    assert.equal(app.count('Röd ros'), 0);
  });
});

test('sökning filtrerar blommorna; Enter på ett exakt namn lägger till en blomma', async () => {
  await withApp(basic(), app => {
    app.set('#search', 'tul', 'input');
    assert.deepEqual(app.$$('#tiles .tile-name').map(e => e.textContent).filter(n => !n.startsWith('+')), ['Tulpan']);
    const s = app.$('#search');
    s.value = 'tulpan';
    s.dispatchEvent(new app.window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    app.set('#search', '', 'input');
    assert.equal(app.count('Tulpan'), 1);
  });
});

// ---------- ny blomma ----------

test('ny blomma: får stor bokstav, hamnar i listan och i buketten, och dubbletter blir inte två', async () => {
  await withApp(basic(), app => {
    app.set('#search', 'pelargon', 'input');
    app.click('[data-act="add-new"]');
    assert.equal(app.count('Pelargon'), 1, 'ny knapp med 1 vald');
    assert.ok(app.tile('Pelargon'));
    assert.match(app.tileText('Pelargon'), /Pris saknas/, 'andra varor har pris, den här saknar');
    // skriv samma namn igen: samma knapp, antalet ökar
    app.set('#search', 'PELARGON', 'input');
    const s = app.$('#search');
    s.dispatchEvent(new app.window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    assert.equal(app.$$('#tiles .tile-name').filter(e => e.textContent === 'Pelargon').length, 1);
    assert.equal(app.count('Pelargon'), 2);
    assert.match(app.text('#summary'), /Pris saknas för Pelargon/, 'ingen 0 kr');
  });
});

test('"Ny blomma" öppnar ett formulär; Escape avbryter och Enter skapar', async () => {
  await withApp(basic(), app => {
    app.click('[data-act="open-new"]');
    const input = app.$('#new-flower');
    assert.ok(input, 'formuläret visas');
    input.dispatchEvent(new app.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    assert.equal(app.$('#new-flower'), null);
    app.click('[data-act="open-new"]');
    app.$('#new-flower').value = 'Dahlia';
    app.$('#new-flower').dispatchEvent(new app.window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    assert.equal(app.count('Dahlia'), 1);
  });
});

test('blomnamn med HTML visas som text och körs aldrig', async () => {
  await withApp(basic(), app => {
    app.set('#search', '<img src=x onerror=alert(1)>', 'input');
    app.click('[data-act="add-new"]');
    assert.equal(app.$$('#tiles img, #summary img, #editor img').length, 0, 'ingen img i DOM');
    assert.ok(app.tile('<img src=x onerror=alert(1)>'), 'namnet visas bokstavligt');
    app.tab('prislista');
    assert.equal(app.$$('#pl-table img').length, 0);
  });
});

// ---------- recept ----------

test('recept: spara bukett, lägg till som ny bukett, ta bort', async () => {
  await withApp(basic(), app => {
    app.add('Röd ros', 4); app.add('Tulpan', 2);
    app.set('#recipe-name', 'Födelsedag', 'input');
    app.click('[data-act="save-recipe"]');
    assert.match(app.text('#recipes'), /Födelsedag/);
    app.click('[data-act="use-recipe"]');
    assert.match(app.text('#chips'), /Bukett 2/);
    assert.equal(app.count('Röd ros'), 4);
    assert.equal(app.count('Tulpan'), 2);
    app.click('[data-act="del-recipe"]');
    assert.match(app.text('#recipes'), /Inga recept sparade än/);
  });
});

test('recept: tomt namn eller tom bukett sparas inte', async () => {
  await withApp(basic(), app => {
    app.set('#recipe-name', 'Tomt', 'input');
    app.click('[data-act="save-recipe"]');
    assert.match(app.text('#recipes'), /Inga recept sparade än/);
    app.add('Röd ros');
    app.set('#recipe-name', '', 'input');
    app.click('[data-act="save-recipe"]');
    assert.match(app.text('#recipes'), /Inga recept sparade än/);
  });
});

// ---------- hemma, inköpslista ----------

test('Har du något hemma: stjälkar dras av och syns i inköpslistan', async () => {
  await withApp(basic(), app => {
    app.add('Röd ros', 7);
    const inp = app.$('input[aria-label="Antal Röd ros hemma"]');
    app.set(inp, '4');
    assert.match(app.text('#summary'), /7\s*4 hemma/);
    assert.equal(app.calc().purchaseSum, 120);
    assert.equal(Object.values(app.calc().buy)[0].toBuy, 3);
  });
});

test('Kopiera inköpslista: text med paket, kostnad och summa', async () => {
  await withApp(basic(), async app => {
    app.add('Röd ros', 7);
    app.click('[data-act="copy-list"]');
    await app.settle();
    assert.deepEqual(app.calls.clipboard.map(t => t.replace(/\u00a0/g, ' ')), ['Inköpslista (priser exklusive moms)\n1 × Röd ros – 10-pack (120 kr)\nSumma: 120 kr']);
  });
});

// ---------- prislistan: byta namn, ändra pris, lägga till och ta bort ----------

test('byta namn på en vara behåller den i buketten och i orderns rader', async () => {
  await withApp(basic(), app => {
    app.add('Röd ros', 3);
    app.tab('prislista');
    app.set('input[data-pl="namn"][data-i="0"]', 'Freedom röd');
    app.tab('bukett');
    assert.equal(app.count('Freedom röd'), 3);
    assert.equal(app.tile('Röd ros'), undefined);
    assert.doesNotMatch(app.text('#editor'), /Finns inte i prislistan/);
    assert.equal(app.calc().rows[0].price !== null, true);
  });
});

test('ändra pris i tabellen: priset gäller direkt och märks som idag', async () => {
  const old = v1State({ items: [item(['Röd ros', 'Blommor', 10, 120, 'pack', '2026-09-01'])], buketter: [{ items: { 'Röd ros': 7 } }] });
  await withApp(old, app => {
    assert.match(app.text('#summary .price-card .big'), /^ca 405 kr$/);
    app.tab('prislista');
    app.set('input[data-pl="pris"][data-i="0"]', '130');
    app.tab('bukett');
    assert.match(app.text('#summary .price-card .big'), /^\d+ kr$/, 'inte längre "ca"');
    assert.match(app.tileText('Röd ros'), /^Röd ros13 kr\/st/);
  });
});

test('lägg till vara och ta bort vara i prislistan', async () => {
  await withApp(basic(), app => {
    app.tab('prislista');
    app.click('[data-act="add-row"]');
    const names = () => app.$$('#pl-table input[data-pl="namn"]').map(i => i.value);
    assert.deepEqual(names(), ['Röd ros', 'Tulpan', 'Ny vara']);
    assert.equal(app.$('input[data-pl="paket"][data-i="2"]').value, '10');
    app.click('[data-act="del-row"][data-i="2"]');
    assert.deepEqual(names(), ['Röd ros', 'Tulpan']);
  });
});

test('att ta bort en vara som används i ordern lämnar den som "finns inte i prislistan", inte som 0 kr', async () => {
  await withApp(basic({ buketter: [{ items: { 'Röd ros': 5, 'Tulpan': 3 } }] }), app => {
    app.tab('prislista');
    app.click('[data-act="del-row"][data-i="0"]');
    app.tab('bukett');
    assert.match(app.text('#summary'), /Finns inte i prislistan: Röd ros/);
    assert.equal(app.calc().total, null);
  });
});

test('ta bort en saknad vara ur buketten med "ta bort"', async () => {
  await withApp(basic({ buketter: [{ items: { 'Röd ros': 5, 'Pelargon': 2 } }] }), app => {
    assert.match(app.text('#editor'), /Pelargon \(ta bort\)/);
    app.click('[data-act="rm-item"]');
    assert.doesNotMatch(app.text('#editor'), /Finns inte i prislistan/);
  });
});

// ---------- inställningar, exempel, återställning ----------

test('inställningar ändrar priset: högre påslag ger högre pris', async () => {
  await withApp(basic({ buketter: [{ items: { 'Röd ros': 7 } }] }), app => {
    assert.equal(app.text('#totalbar strong'), '405 kr');
    app.tab('installningar');
    app.set('input[data-set="markupPct"]', '100');
    app.tab('bukett');
    // bas 145 → påslag 145 → arbete 104,1667 → 394,1667 → moms 492,7083 → 495
    assert.equal(app.text('#totalbar strong'), '495 kr');
  });
});

test('Fyll med exempeldata och Töm allt kräver ett andra tryck och går att ångra via tom start', async () => {
  await withApp(basic({ buketter: [{ items: { 'Röd ros': 5 } }] }), app => {
    app.tab('installningar');
    app.click('[data-act="load-example"]');
    assert.equal(app.hook.state().priceList.meta.kalla, 'egen', 'första trycket ändrar inget');
    app.click('[data-act="load-example"]');
    assert.equal(app.hook.state().priceList.meta.kalla, 'exempel');
    assert.match(app.text('#banner'), /Exempeldata/);
    app.click('[data-act="reset-all"]');
    assert.equal(app.hook.state().priceList.meta.kalla, 'exempel');
    app.click('[data-act="reset-all"]');
    assert.equal(app.hook.state().priceList.meta.kalla, 'tom');
    assert.equal(app.$$('#tiles .tile-name').length, 21);
  });
});

test('flikarna visar rätt vy och den fasta totallisten bara på Bukett', async () => {
  await withApp(basic(), app => {
    app.tab('prislista');
    assert.equal(app.$('#view-prislista').hidden, false);
    assert.equal(app.$('#view-bukett').hidden, true);
    assert.equal(app.$('#totalbar').hidden, true);
    app.tab('installningar');
    assert.equal(app.$('#view-installningar').hidden, false);
    app.tab('bukett');
    assert.equal(app.$('#totalbar').hidden, false);
  });
});

// ---------- sparande och robusthet ----------

test('allt sparas och finns kvar när appen öppnas igen', async () => {
  const first = await loadApp(seed(basic({ buketter: [{ items: {} }] })));
  first.add('Röd ros', 3);
  first.click('[data-act="size"][data-size="stor"]');
  first.click('[data-act="new-bouquet"]');
  first.add('Tulpan', 2);
  first.set('#recipe-name', 'Min', 'input');
  first.click('[data-act="save-recipe"]');
  const stored = first.storage();
  first.close();

  const again = await loadApp({ storage: stored });
  assert.match(again.text('#chips'), /Bukett 1 · Stor.*Bukett 2 · Stor/);
  assert.equal(again.count('Tulpan'), 2, 'aktiv bukett är bukett 2');
  again.click('[data-act="chip"][data-id="b1"]');
  assert.equal(again.count('Röd ros'), 3);
  assert.match(again.text('#recipes'), /Min/);
  assert.equal(again.text('#totalbar strong') !== '–', true);
  again.close();
});

test('trasig lagring ger en ren tom start i stället för ett krasch', async () => {
  for (const bad of ['{inte json', '[]', '{"priceList":{"items":"nej"}}', 'null', '{"priceList":{"items":[]},"order":{"buketter":[]}}']) {
    const app = await loadApp({ storage: { 'buketraknare.v1': bad } });
    assert.equal(app.$$('#tiles .tile-name').length, 21, 'tom start för: ' + bad);
    assert.equal(app.hook.state().priceList.meta.kalla, 'tom');
    app.close();
  }
});

test('saknade fält i gammal lagring fylls med standardvärden', async () => {
  const old = v1State({ items: [item(ROS)] });
  delete old.wholesaler; delete old.labels; delete old.recipes; delete old.settings.sizes; delete old.order.hemma;
  old.order.active = 'finns-inte';
  const app = await loadApp({ storage: { 'buketraknare.v1': JSON.stringify(old) } });
  const st = app.hook.state();
  assert.deepEqual(JSON.parse(JSON.stringify(st.settings.sizes)), DEFAULT_SETTINGS.sizes);
  assert.equal(st.wholesaler.mode, 'skarm');
  assert.equal(st.order.active, 'b1');
  assert.deepEqual(JSON.parse(JSON.stringify(st.recipes)), []);
  app.add('Röd ros');
  assert.equal(app.count('Röd ros'), 1);
  app.close();
});

test('en "tom" lista utan varor fylls på med de vanliga blommorna igen', async () => {
  const app = await loadApp(seed(v1State({ items: [], kalla: 'tom' })));
  assert.equal(app.$$('#tiles .tile-name').length, 21);
  app.close();
});

test('exempeldata: exempelpriser, två buketter och två recept, med tydlig märkning', async () => {
  const app = await loadApp(seed(JSON.parse(JSON.stringify((await (async () => { const a = await loadApp(); const s = a.hook.exampleState(); const j = JSON.parse(JSON.stringify(s)); a.close(); return j; })())))));
  assert.match(app.text('#banner'), /Exempeldata/);
  assert.match(app.text('#chips'), /Bukett 1 · Liten.*Bukett 2 · Medel/);
  assert.match(app.text('#recipes'), /Liten vårbukett \(exempel\).*Stor rosbukett \(exempel\)/);
  assert.equal(app.calc().incomplete, false);
  app.close();
});
