// Räknemotorn: hela förpackningar, delning mellan buketter, "pris saknas", ca/ålder, frakt, hemma.
// Alla förväntade värden är uträknade för hand (härledningen står vid varje fall), inte hämtade från koden.
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadApp, v1State, item, buyOf } from './helpers/app.mjs';

const TODAY = '2026-10-07';
const ROS = ['Röd ros', 'Blommor', 10, 120, 'pack', TODAY]; // 12 kr per stjälk
const ROSA = ['Rosa ros', 'Blommor', 10, 105, 'pack', TODAY];
const TULPAN = ['Tulpan', 'Blommor', 10, 55, 'bunt', TODAY];

async function calcFor(state) {
  const app = await loadApp({ storage: { 'buketraknare.v1': JSON.stringify(state) } });
  const C = app.calc();
  return { app, C };
}
const near = (a, b, msg) => assert.ok(Math.abs(a - b) < 0.01, `${msg || ''} ${a} ≈ ${b}`);

test('hela förpackningar: 7 rosor ur ett 10-pack ger Behövs 7, Köps 10, Över 3', async () => {
  const { app, C } = await calcFor(v1State({ items: [item(ROS)], buketter: [{ items: { 'Röd ros': 7 } }] }));
  const b = buyOf(C, 'Röd ros');
  assert.equal(b.need, 7);
  assert.equal(b.packs, 1);
  assert.equal(b.bought, 10);
  assert.equal(b.leftover, 3);
  assert.equal(b.cost, 120);
  near(b.leftoverValue, 36, 'överskott 3 × 12 kr');
  assert.equal(C.purchaseSum, 120);
  assert.equal(C.leftoverStems, 3);
  app.close();
});

test('gränsfall för förpackningar: exakt 10, 11 och 1 stjälke', async () => {
  for (const [n, packs, over] of [[10, 1, 0], [11, 2, 9], [1, 1, 9], [20, 2, 0]]) {
    const { app, C } = await calcFor(v1State({ items: [item(ROS)], buketter: [{ items: { 'Röd ros': n } }] }));
    const b = buyOf(C, 'Röd ros');
    assert.equal(b.packs, packs, `${n} stjälkar → ${packs} paket`);
    assert.equal(b.leftover, over, `${n} stjälkar → ${over} över`);
    app.close();
  }
});

test('kundpris för en bukett: blommor + emballage + påslag + arbete + moms, avrundat uppåt till 5 kr', async () => {
  // medel: 25 min, emballage 25 kr. Påslag 50 %, timpris 250, moms 25 %.
  // blommor 120 (hela paketet) → bas 145 → påslag 72,50 → arbete 25/60×250 = 104,1667
  // exkl. moms 321,6667 → moms 80,4167 → 402,0833 → närmaste 5 uppåt = 405
  const { app, C } = await calcFor(v1State({ items: [item(ROS)], buketter: [{ items: { 'Röd ros': 7 } }] }));
  const r = C.rows[0];
  near(r.flowers, 120);
  assert.equal(r.wrap, 25);
  near(r.base, 145);
  near(r.markup, 72.5);
  near(r.labor, 104.1667);
  near(r.exVat, 321.6667);
  near(r.vat, 80.4167);
  assert.equal(r.price, 405);
  near(r.rounding, 405 - 402.0833);
  // marginal efter inköp: pris utan moms 405/1,25 = 324 → (324 − 145) / 324
  near(r.margin, 179 / 324);
  assert.equal(C.total, 405);
  assert.equal(C.count, 1);
  app.close();
});

test('storlek påverkar emballage och arbetstid (liten: 15 min, 15 kr)', async () => {
  // blommor 105 → bas 120 → påslag 60 → arbete 15/60×250 = 62,5 → 242,5 → moms 60,625 → 303,125 → 305
  const { app, C } = await calcFor(v1State({ items: [item(ROSA)], buketter: [{ size: 'liten', items: { 'Rosa ros': 3 } }] }));
  assert.equal(C.rows[0].price, 305);
  app.close();
});

test('avrundningssteg 1, 5 och 10 kr', async () => {
  for (const [step, expected] of [[1, 403], [5, 405], [10, 410]]) {
    const { app, C } = await calcFor(v1State({ items: [item(ROS)], buketter: [{ items: { 'Röd ros': 7 } }], settings: { roundStep: step } }));
    assert.equal(C.rows[0].price, expected, `steg ${step}`); // 402,0833 uppåt
    app.close();
  }
});

test('momssats 0 % ger priset utan moms (321,67 → 325)', async () => {
  const { app, C } = await calcFor(v1State({ items: [item(ROS)], buketter: [{ items: { 'Röd ros': 7 } }], settings: { vatPct: 0 } }));
  assert.equal(C.rows[0].price, 325);
  app.close();
});

test('läget "bara använda stjälkar" debiterar 7 × 12 kr men inköpet är fortfarande hela paketet', async () => {
  // blommor 84 → bas 109 → påslag 54,5 → arbete 104,1667 → 267,6667 → moms 66,9167 → 334,5833 → 335
  const { app, C } = await calcFor(v1State({ items: [item(ROS)], buketter: [{ items: { 'Röd ros': 7 } }], settings: { mode: 'used' } }));
  near(C.rows[0].flowers, 84);
  assert.equal(C.rows[0].price, 335);
  assert.equal(C.purchaseSum, 120);
  app.close();
});

test('delning: två buketter delar samma 10-pack och betalar bara för ett paket', async () => {
  const { app, C } = await calcFor(v1State({
    items: [item(ROS)],
    buketter: [{ items: { 'Röd ros': 3 } }, { items: { 'Röd ros': 4 } }]
  }));
  const b = buyOf(C, 'Röd ros');
  assert.equal(b.need, 7);
  assert.equal(b.packs, 1);
  assert.equal(C.purchaseSum, 120, 'ett paket, inte två');
  near(C.rows[0].flowers, 3 * (120 / 7)); // 51,43
  near(C.rows[1].flowers, 4 * (120 / 7)); // 68,57
  near(C.rows[0].flowers + C.rows[1].flowers, 120, 'fördelningen summerar exakt till inköpet');
  // bukett 1: 51,4286 + 25 = 76,4286 → ×1,5 + 104,1667 = 218,8095 → ×1,25 = 273,5119 → 275
  // bukett 2: 68,5714 + 25 = 93,5714 → ×1,5 + 104,1667 = 244,5238 → ×1,25 = 305,6548 → 310
  assert.equal(C.rows[0].price, 275);
  assert.equal(C.rows[1].price, 310);
  assert.equal(C.total, 585);
  assert.equal(C.leftoverStems, 3);
  app.close();
});

test('delning med antal likadana buketter: 2 × 6 rosor = 12 stjälkar = 2 paket', async () => {
  const { app, C } = await calcFor(v1State({ items: [item(ROS)], buketter: [{ qty: 2, items: { 'Röd ros': 6 } }] }));
  const b = buyOf(C, 'Röd ros');
  assert.equal(b.need, 12);
  assert.equal(b.packs, 2);
  assert.equal(C.purchaseSum, 240);
  near(C.rows[0].flowers, 120, 'per bukett: 6 × (240/12)');
  assert.equal(C.rows[0].lineTotal, C.rows[0].price * 2);
  assert.equal(C.count, 2);
  app.close();
});

test('flera varor i en bukett summeras per vara', async () => {
  const { app, C } = await calcFor(v1State({ items: [item(ROS), item(TULPAN)], buketter: [{ items: { 'Röd ros': 4, 'Tulpan': 6 } }] }));
  assert.equal(C.purchaseSum, 120 + 55);
  near(C.rows[0].flowers, 175);
  app.close();
});

test('"har hemma" dras av från inköpet och kan inte överstiga behovet', async () => {
  let r = await calcFor(v1State({ items: [item(ROS)], buketter: [{ items: { 'Röd ros': 7 } }], hemma: { 'Röd ros': 4 } }));
  let b = buyOf(r.C, 'Röd ros');
  assert.equal(b.have, 4);
  assert.equal(b.toBuy, 3);
  assert.equal(b.packs, 1);
  assert.equal(b.leftover, 7); // 10 köpta − 3 som behövs
  r.app.close();

  r = await calcFor(v1State({ items: [item(ROS)], buketter: [{ items: { 'Röd ros': 7 } }], hemma: { 'Röd ros': 20 } }));
  b = buyOf(r.C, 'Röd ros');
  assert.equal(b.have, 7, 'högst det som behövs');
  assert.equal(b.packs, 0);
  assert.equal(b.cost, 0);
  assert.equal(r.C.purchaseSum, 0);
  r.app.close();
});

test('frakt läggs på buketterna och försvinner vid fri frakt', async () => {
  // frakt 60 kr under 200 kr: blommor 120 + frakt 60 + emballage 25 = 205 → ×1,5 = 307,5 + 104,1667 = 411,6667 → ×1,25 = 514,5833 → 515
  let r = await calcFor(v1State({ items: [item(ROS)], buketter: [{ items: { 'Röd ros': 7 } }], settings: { shipFee: 60, freeFrom: 200 } }));
  assert.equal(r.C.ship, 60);
  assert.equal(r.C.rows[0].price, 515);
  r.app.close();

  // 15 rosor = 2 paket = 240 kr ≥ 200 → ingen frakt
  r = await calcFor(v1State({ items: [item(ROS)], buketter: [{ items: { 'Röd ros': 15 } }], settings: { shipFee: 60, freeFrom: 200 } }));
  assert.equal(r.C.ship, 0);
  r.app.close();
});

test('minsta order och fri-frakt-gräns visas som råd, inte som fel', async () => {
  const { app } = await calcFor(v1State({ items: [item(ROS)], buketter: [{ items: { 'Röd ros': 7 } }], settings: { minOrder: 300, shipFee: 50, freeFrom: 500 } }));
  const t = app.text('#summary');
  assert.match(t, /Under grossistens minsta order\. Det saknas 180 kr/);
  assert.match(t, /Fri frakt från 500 kr\. Det saknas 380 kr/);
  app.close();
});

// ---------- pris saknas: aldrig 0 kr ----------

test('pris saknas ger inget pris (null), aldrig 0 kr', async () => {
  const { app, C } = await calcFor(v1State({ items: [item(['Röd ros', 'Blommor', 10, 0, 'pack']), item(TULPAN)], buketter: [{ items: { 'Röd ros': 5, 'Tulpan': 3 } }] }));
  assert.equal(C.rows[0].price, null);
  assert.equal(C.rows[0].lineTotal, null);
  assert.equal(C.total, null);
  assert.equal(C.incomplete, true);
  assert.deepEqual(C.rows[0].noPrice.length, 1);
  assert.equal(buyOf(C, 'Röd ros').hasPrice, false);
  // och i vyn: ett streck och en förklaring, inget "0 kr"
  assert.equal(app.text('#summary .price-card .big'), '–');
  assert.match(app.text('#summary .price-card'), /Pris saknas för Röd ros/);
  assert.equal(app.text('#totalbar strong'), '–');
  assert.doesNotMatch(app.text('#summary'), /(^|[^\d,.])0\s?kr\b(?! över)/, 'ingen 0 kr-summa som kund- eller totalpris');
  app.close();
});

test('en vara som inte finns i prislistan ger ofullständigt pris och en tydlig varning', async () => {
  // 'Pelargon' ligger i ordern men inte i prislistan (som när man tagit bort varan ur listan)
  const { app, C } = await calcFor(v1State({ items: [item(ROS)], buketter: [{ items: { 'Röd ros': 5, 'Pelargon': 2 } }] }));
  assert.equal(C.missing.length, 1);
  assert.match(app.text('#summary'), /Finns inte i prislistan: Pelargon/);
  assert.match(app.text('#editor'), /Finns inte i prislistan: Pelargon \(ta bort\)/);
  app.close();
});

test('tom bukett: inget pris, inga streck som ser ut som en summa', async () => {
  const { app, C } = await calcFor(v1State({ items: [item(ROS)] }));
  assert.equal(C.count, 0);
  assert.equal(C.rows[0].empty, true);
  assert.match(app.text('#summary'), /Välj blommor till bukett 1/);
  assert.equal(app.text('#totalbar strong'), '–');
  app.close();
});

test('en vara utan pris visas aldrig som 0 kr på knappen: "Pris saknas" när andra har pris', async () => {
  const { app } = await calcFor(v1State({ items: [item(ROS), item(['Tulpan', 'Blommor', 10, 0, 'bunt'])] }));
  assert.match(app.tileText('Tulpan'), /Pris saknas/);
  assert.doesNotMatch(app.tileText('Tulpan'), /0\s?kr/);
  app.close();
});

// ---------- gammalt pris, ca och ålder ----------

test('färskt pris (idag) räknas som aktuellt, äldre pris som ungefärligt (ca)', async () => {
  const fresh = await calcFor(v1State({ items: [item(ROS)], buketter: [{ items: { 'Röd ros': 7 } }] }));
  assert.equal(fresh.C.rows[0].approx, false);
  assert.equal(fresh.C.approx, false);
  assert.match(fresh.app.text('#summary .price-card .big'), /^405 kr$/);
  assert.match(fresh.app.text('#summary .price-card'), /aktuella priser/);
  assert.match(fresh.app.text('#fresh'), /Aktuella idag/);
  fresh.app.close();

  const old = await calcFor(v1State({ items: [item(['Röd ros', 'Blommor', 10, 120, 'pack', '2026-09-29'])], buketter: [{ items: { 'Röd ros': 7 } }] }));
  assert.equal(old.C.rows[0].approx, true);
  assert.equal(old.C.approx, true);
  assert.match(old.app.text('#summary .price-card .big'), /^ca 405 kr$/);
  assert.match(old.app.text('#summary .price-card'), /ungefärligt, uppdatera för aktuellt pris/);
  assert.match(old.app.text('#fresh'), /Ungefärliga/);
  old.app.close();
});

test('åldern visas som idag, igår och antal dagar', async () => {
  for (const [uppd, text] of [['2026-10-07', 'idag'], ['2026-10-06', 'igår'], ['2026-09-29', '8 dagar gamla']]) {
    const { app } = await calcFor(v1State({ items: [item(['Röd ros', 'Blommor', 10, 120, 'pack', uppd])], buketter: [{ items: { 'Röd ros': 7 } }] }));
    assert.match(app.text('#fresh'), new RegExp(`Priser från ${uppd} \\(${text}\\)`));
    app.close();
  }
});

test('en blandad bukett (ett färskt, ett gammalt pris) är ungefärlig', async () => {
  const { C, app } = await calcFor(v1State({
    items: [item(ROS), item(['Tulpan', 'Blommor', 10, 55, 'bunt', '2026-09-01'])],
    buketter: [{ items: { 'Röd ros': 4, 'Tulpan': 4 } }]
  }));
  assert.equal(C.rows[0].approx, true);
  app.close();
});

test('knappen visar "ca" före per-stjälk-pris när priset inte är från idag', async () => {
  const { app } = await calcFor(v1State({ items: [item(ROS), item(['Tulpan', 'Blommor', 10, 55, 'bunt', '2026-09-01'])] }));
  assert.match(app.tileText('Röd ros'), /^Röd ros12 kr\/st · 10-pack$/);
  assert.match(app.tileText('Tulpan'), /^Tulpanca 5,50 kr\/st · bunt à 10$/);
  app.close();
});

test('tillstånd i färskhetskortet: inga priser, exempeldata, egna priser', async () => {
  let r = await calcFor(v1State({ items: [item(['Röd ros', 'Blommor', 10, 0, 'pack'])], kalla: 'tom' }));
  assert.match(r.app.text('#fresh'), /Inga priser än/);
  r.app.close();
  r = await calcFor(v1State({ items: [item(ROS)], kalla: 'exempel' }));
  assert.match(r.app.text('#fresh'), /Exempelpriser/);
  assert.match(r.app.text('#banner'), /Exempeldata/);
  r.app.close();
});
