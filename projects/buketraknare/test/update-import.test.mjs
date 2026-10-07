// Prisuppdatering (förhandsgranskning före byte) och inläsning av en hel prislista.
// Huvudregeln: inget pris byts förrän floristen bekräftar.
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadApp, v1State, item } from './helpers/app.mjs';

const OLD = '2026-09-29';
const ROS = ['Röd ros', 'Blommor', 10, 120, 'pack', OLD];
const TULPAN = ['Tulpan', 'Blommor', 10, 55, 'bunt', OLD];
const NEJLIKA = ['Nejlika', 'Blommor', 20, 70, 'bunt', OLD];

const startState = (extra = {}) => v1State({
  items: [item(ROS), item(TULPAN), item(NEJLIKA)],
  buketter: [{ items: { 'Röd ros': 5, 'Tulpan': 5, 'Nejlika': 2 } }],
  ...extra
});
const open = async (state = startState()) => {
  const app = await loadApp({ storage: { 'buketraknare.v1': JSON.stringify(state) } });
  app.click('[data-act="open-update"]');
  await app.settle();
  return app;
};
const answer = (app, text) => { app.set('#upd-in', text, 'input'); app.click('[data-act="parse-update"]'); };
const HEAD = 'Namn;Antal per förp;Pris per förp;Enhet;Anmärkning\n';

// ---------- uppdatering ----------

test('Hämta pris öppnar en ruta som listar de valda blommorna', async () => {
  const app = await open();
  assert.equal(app.$('#update-panel').hidden, false);
  assert.equal(app.text('#upd-names'), 'Röd ros, Tulpan, Nejlika');
  assert.ok(app.$('#upd-in'), 'det finns en ruta för svaret');
  app.close();
});

test('förhandsgranskning: gammalt → nytt pris, procent per stjälk och ändrad förpackning', async () => {
  const app = await open();
  answer(app, HEAD + 'Röd ros;10;129;pack;Freedom 60 cm\nTulpan;20;120;bunt;\nOkänd blomma;10;50;bunt;');
  const t = app.text('#upd-preview');
  assert.match(t, /2 av 3 efterfrågade priser kunde läsas in/);
  assert.match(t, /Röd ros.*10-pack.*120 kr → 129 kr.*\+7 %/, '12 → 12,90 kr per stjälk');
  assert.match(t, /Tulpan.*Förpackning 10 → 20 st.*55 kr → 120 kr.*\+9 %/, 'ändrad förpackning varnas');
  assert.match(t, /Inget pris för: Nejlika\. De behåller sitt gamla pris/);
  assert.match(t, /Kunde inte koppla till dina blommor: Okänd blomma\. De ignoreras/);
  app.close();
});

test('INGET byts före bekräftelse: priserna är oförändrade i förhandsgranskningen', async () => {
  const app = await open();
  answer(app, HEAD + 'Röd ros;10;129;pack;');
  await app.settle();
  assert.match(app.tileText('Röd ros'), /ca 12 kr\/st/, 'gamla priset gäller fortfarande');
  assert.equal(app.calc().purchaseSum, 120 + 55 + 70);
  assert.equal(app.text('#fresh').includes('Aktuella idag'), false);
  app.close();
});

test('Använd priserna: byter bara det som lästes in, märker det som idag och stänger rutan', async () => {
  const app = await open();
  answer(app, HEAD + 'Röd ros;10;129;pack;\nTulpan;10;60;bunt;');
  app.click('[data-act="apply-update"]');
  await app.settle();
  assert.equal(app.$('#update-panel').hidden, true);
  assert.match(app.text('#fresh'), /Uppdaterade 2 priser\./);
  assert.match(app.tileText('Röd ros'), /^Röd ros12,90 kr\/st/, 'färskt pris utan "ca"');
  assert.match(app.tileText('Tulpan'), /^Tulpan6 kr\/st/);
  assert.match(app.tileText('Nejlika'), /^Nejlikaca 3,50 kr\/st/, 'det som inte lästes in behåller gammalt pris och datum');
  const C = app.calc();
  assert.equal(C.purchaseSum, 129 + 60 + 70);
  assert.equal(C.approx, true, 'Nejlika är fortfarande gammal');
  assert.match(app.text('#fresh'), /Priser från 2026-10-07 \(idag\)/);
  app.tab('prislista');
  assert.match(app.text('#pl-head'), /Uppdaterad med AI/);
  app.close();
});

test('en uppdatering av ett enda pris säger "pris" i singular', async () => {
  const app = await open();
  answer(app, HEAD + 'Röd ros;10;129;pack;');
  app.click('[data-act="apply-update"]');
  await app.settle();
  assert.match(app.text('#fresh'), /Uppdaterade 1 pris\./);
  app.close();
});

test('Avbryt: förhandsgranskningen försvinner och inget ändras', async () => {
  const app = await open();
  answer(app, HEAD + 'Röd ros;10;129;pack;');
  assert.match(app.text('#upd-preview'), /Kontrollera innan du använder priserna/);
  app.click('[data-act="cancel-update"]');
  assert.equal(app.text('#upd-preview'), '');
  assert.equal(app.calc().purchaseSum, 120 + 55 + 70);
  app.close();
});

test('matchning av namn: "Röd ros Freedom 60 cm" hör till "Röd ros" och varianten visas', async () => {
  const app = await open();
  answer(app, HEAD + 'Röd ros Freedom 60 cm;10;129;pack;');
  assert.match(app.text('#upd-preview'), /från "Röd ros Freedom 60 cm"/);
  app.close();
});

test('pris per stjälk: appen räknar om till pris per förpackning, och valet går att ändra', async () => {
  const app = await open();
  answer(app, 'Namn;Antal per förp;Pris per stjälk\nRöd ros;10;12,9');
  assert.equal(app.$('#upd-basis').value, 'st', 'gissar stjälke utifrån rubriken');
  assert.match(app.text('#upd-preview'), /120 kr → 129 kr/);
  app.set('#upd-basis', 'forp');
  assert.match(app.text('#upd-preview'), /120 kr → 12,90 kr/, 'valet "hela förpackningen" tolkar samma siffra som förpackningspris');
  app.close();
});

test('"saknas" som pris läses inte in och behåller gammalt pris; inget att använda → knappen är avstängd', async () => {
  const app = await open();
  answer(app, HEAD + 'Röd ros;10;saknas;pack;');
  assert.match(app.text('#upd-preview'), /0 av 3 efterfrågade priser/);
  assert.equal(app.$('[data-act="apply-update"]').disabled, true);
  app.close();
});

test('ett svar som inte går att tolka ger ett begripligt fel och ingen förhandsgranskning', async () => {
  const app = await open();
  answer(app, 'Det gick inte att hämta några priser');
  assert.equal(app.$('#upd-msg').hidden, false);
  assert.match(app.text('#upd-msg'), /inga kolumner/);
  assert.equal(app.text('#upd-preview'), '');
  app.close();
});

test('"Hela min lista" frågar efter alla varor, inte bara de valda', async () => {
  const app = await open(v1State({ items: [item(ROS), item(TULPAN), item(NEJLIKA)], buketter: [{ items: { 'Röd ros': 1 } }] }));
  assert.equal(app.text('#upd-names'), 'Röd ros');
  const radio = app.$('input[name="updscope"][value="alla"]');
  radio.checked = true;
  app.set(radio, 'alla');
  assert.equal(app.text('#upd-names'), 'Röd ros, Tulpan, Nejlika');
  app.close();
});

test('utan valda blommor visas en uppmaning i stället för ett tomt uppdrag', async () => {
  const app = await open(v1State({ items: [item(ROS)] }));
  assert.equal(app.$('#upd-none').hidden, false);
  assert.match(app.text('#upd-none'), /Du har inte valt några blommor än/);
  app.close();
});

test('uppdatera från exempeldata byter källa till "uppdaterad" och exempelbannern försvinner', async () => {
  const app = await open(v1State({ items: [item(ROS)], buketter: [{ items: { 'Röd ros': 3 } }], kalla: 'exempel' }));
  assert.match(app.text('#banner'), /Exempeldata/);
  answer(app, HEAD + 'Röd ros;10;129;pack;');
  app.click('[data-act="apply-update"]');
  await app.settle();
  assert.equal(app.text('#banner'), '');
  app.close();
});

// ---------- hel prislista ----------

const CSV = 'Namn;Kategori;Antal per förp;Pris per förp;Enhet\nRöd ros;Blommor;10;130;pack\nTulpan;Blommor;10;55;bunt\nPion;Blommor;5;90;bunt\nGrönt;Grönt;;60;bunt';
async function openImport() {
  const state = v1State({ items: [item(ROS), item(TULPAN), item(NEJLIKA)], buketter: [{ items: { 'Röd ros': 5, 'Nejlika': 2 } }], recipes: [{ name: 'Vår', items: { 'Tulpan': 5 } }] });
  const app = await loadApp({ storage: { 'buketraknare.v1': JSON.stringify(state) } });
  app.tab('prislista');
  return app;
}
const pasteImport = (app, csv) => { app.set('#csv-in', csv, 'input'); app.click('[data-act="parse-import"]'); };

test('import: jämför med förra listan och flaggar det som används i ordern eller recepten', async () => {
  const app = await openImport();
  pasteImport(app, CSV);
  const t = app.text('#import-preview');
  assert.match(t, /4 varor lästes in/);
  assert.match(t, /1 ändrad2 nya1 försvunnen0 med ändrad förpackning/);
  assert.match(t, /Röd rosanvänds i din order eller dina recept.*120 kr → 130 kr.*\+8 %/);
  assert.match(t, /Finns inte i nya listan: Nejlika används i din order eller dina recept/);
  assert.match(t, /Nya varor: Pion, Grönt/);
  assert.match(t, /Grönt: 1 st \(saknas, räknas som 1\)/, 'gissade förpackningar markeras');
  app.close();
});

test('import: inget byts före bekräftelse', async () => {
  const app = await openImport();
  pasteImport(app, CSV);
  assert.match(app.text('#pl-head'), /3 varor, 3 med pris/);
  app.click('[data-act="cancel-import"]');
  assert.equal(app.text('#import-preview'), '');
  assert.deepEqual(app.$$('#pl-table input[data-pl="namn"]').map(i => i.value), ['Röd ros', 'Tulpan', 'Nejlika']);
  app.close();
});

test('import: Använd den nya listan byter listan men behåller ordern för varor som finns kvar', async () => {
  const app = await openImport();
  pasteImport(app, CSV);
  app.click('[data-act="apply-import"]');
  await app.settle();
  assert.match(app.text('#pl-head'), /Inläst lista.*4 varor, 4 med pris/);
  assert.deepEqual(app.$$('#pl-table input[data-pl="namn"]').map(i => i.value), ['Röd ros', 'Tulpan', 'Pion', 'Grönt']);
  app.tab('bukett');
  assert.equal(app.count('Röd ros'), 5, 'ordern följer med via namnet');
  assert.match(app.text('#editor'), /Finns inte i prislistan: Nejlika \(ta bort\)/, 'borttagen vara syns som saknad, den försvinner inte tyst');
  assert.match(app.text('#summary'), /Finns inte i prislistan: Nejlika/);
  // receptet som använder Tulpan finns kvar och Tulpan finns i nya listan
  assert.match(app.text('#recipes'), /Vår/);
  // alla inlästa varor är färska idag
  assert.match(app.tileText('Röd ros'), /^Röd ros13 kr\/st/);
  app.close();
});

test('import: pris per stjälk räknas om, och oförändrat pris räknas inte som ändring', async () => {
  const app = await openImport();
  pasteImport(app, 'Namn;Pris per stjälk;Antal\nTulpan;5,5;10');
  assert.match(app.text('#import-preview'), /Rubriken i filen är "Pris per stjälk"/);
  assert.match(app.text('#import-preview'), /0 ändrade/, '5,5 × 10 = 55 kr = samma som förut');
  app.close();
});

test('import: fel i filen visas utan att något ändras', async () => {
  const app = await openImport();
  pasteImport(app, 'Foo;Bar\n1;2');
  assert.equal(app.$('#import-msg').hidden, false);
  assert.match(app.text('#import-msg'), /hittar inte kolumnerna Namn och Pris/);
  assert.equal(app.text('#import-preview'), '');
  app.close();
});

test('import: första importen på en tom lista har inget att jämföra med', async () => {
  const app = await loadApp();
  app.tab('prislista');
  pasteImport(app, CSV);
  assert.match(app.text('#import-preview'), /Det finns inga tidigare priser att jämföra med/);
  app.click('[data-act="apply-import"]');
  await app.settle();
  assert.match(app.text('#pl-head'), /4 varor, 4 med pris/);
  app.close();
});

test('exempel-CSV från repot går att läsa in', async () => {
  const { readFileSync } = await import('node:fs');
  const csv = readFileSync(new URL('../exempel-prislista.csv', import.meta.url), 'utf8');
  const app = await loadApp();
  app.tab('prislista');
  pasteImport(app, csv);
  assert.match(app.text('#import-preview'), /13 varor lästes in/);
  app.close();
});
