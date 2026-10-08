// Tolkning av priser och förpackningar, tabeller från AI eller Excel, och matchning av namn.
// Tester märkta [dokumenterat] beskriver nuvarande beteende som inte nödvändigtvis är önskat. De finns
// för att en framtida ändring ska vara ett medvetet beslut och inte en olycka.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { loadApp } from './helpers/app.mjs';

let app, h;
// objekt från jsdom kommer från ett annat JavaScript-rike, så de plattas ut innan de jämförs
const plain = x => JSON.parse(JSON.stringify(x));
before(async () => { app = await loadApp(); h = app.hook; });
after(() => app.close());

test('parseNum: svenska och engelska tal, valuta och tusentalsavgränsare', () => {
  const cases = [
    ['129', 129], ['129,50', 129.5], ['1 234,50', 1234.5], ['1.234,50', 1234.5], ['1,234.50', 1234.5],
    ['129 kr', 129], ['129:-', 129], ['12.5', 12.5], ['1,5', 1.5], ['0', 0], ['1 234', 1234], ['1.234', 1234]
  ];
  for (const [s, n] of cases) assert.equal(h.parseNum(s), n, JSON.stringify(s));
  for (const s of ['abc', '', null, undefined]) assert.ok(Number.isNaN(h.parseNum(s)), String(s) + ' är inget tal');
});

test('detectPack: förpackningsstorlek ur text', () => {
  const cases = [
    ['Röd ros 10-pack', 10], ['10 pack', 10], ['pack à 20', 20], ['pack 5', 5], ['bunt à 20', 20], ['bunt 10', 10],
    ['förp. à 12', 12], ['5 st/bunt', 5], ['5/bunt', 5], ['Tulpan à 10', 10], ['box 24', 24]
  ];
  for (const [s, n] of cases) assert.equal(h.detectPack(s), n, s);
  // längd är inte förpackning, orimliga och noll-värden ignoreras
  for (const s of ['Röd ros 60 cm', 'ros 1500 st/bunt', 'Nejlika 0-pack', '', null]) assert.equal(h.detectPack(s), null, String(s));
});

test('matchKey: exakt, innehåller, och ord som överlappar', () => {
  const keys = ['röd ros', 'rosa ros', 'vit ros', 'tulpan', 'nejlika', 'eukalyptus', 'gipsört', 'lisianthus'];
  assert.deepEqual(plain(h.matchKey('Röd ros', keys)), { key: 'röd ros', how: 'exakt' });
  assert.deepEqual(plain(h.matchKey('RÖD  ROS', keys)), { key: 'röd ros', how: 'exakt' }, 'skiftläge och mellanrum spelar ingen roll');
  assert.deepEqual(plain(h.matchKey('Röd ros Freedom 60 cm', keys)), { key: 'röd ros', how: 'liknande' }, 'AI skriver ofta en variant');
  assert.deepEqual(plain(h.matchKey('Freedom Röd ros 50cm', keys)), { key: 'röd ros', how: 'liknande' });
  assert.deepEqual(plain(h.matchKey('ros röd', keys)), { key: 'röd ros', how: 'liknande' }, 'ordföljd spelar ingen roll');
  assert.deepEqual(plain(h.matchKey('Eukalyptus Cinerea', keys)), { key: 'eukalyptus', how: 'liknande' });
});

test('matchKey: gissar inte när det är tvetydigt eller okänt', () => {
  const keys = ['röd ros', 'rosa ros', 'vit ros', 'tulpan', 'gipsört'];
  assert.equal(h.matchKey('Ros', keys), null, 'tre rosor passar lika bra');
  assert.equal(h.matchKey('Okänd blomma', keys), null);
  assert.equal(h.matchKey('Slöjflor', keys), null, 'inga synonymer i dag (gipsört och slöjflor är samma växt)');
});

test('[dokumenterat] matchKey kontrollerar inte färg: "Tulpan gul" blir "tulpan"', () => {
  assert.deepEqual(plain(h.matchKey('Tulpan gul', ['tulpan'])), { key: 'tulpan', how: 'liknande' });
  // och "rosa" (färg) blir "rosa ros" (blomma). Matchningsmotorn senare måste skilja på färg och blomma.
  assert.deepEqual(plain(h.matchKey('rosa', ['röd ros', 'rosa ros'])), { key: 'rosa ros', how: 'liknande' });
});

// ---------- readTable ----------

const table = t => h.readTable(t);

test('readTable: semikolon, komma och tabb', () => {
  let r = table('Namn;Antal per förp;Pris per förp;Enhet\nRöd ros;10;120;pack\nTulpan;10;55,50;bunt');
  assert.equal(r.rows.length, 2);
  assert.equal(r.basisGuess, 'forp');
  assert.equal(r.hasPackCol, true);
  assert.deepEqual({ ...r.rows[0] }, { namn: 'Röd ros', kategori: '', enhet: 'pack', farg: '', paketNum: 10, prisNum: 120, packDetected: 10 });
  assert.equal(r.rows[1].prisNum, 55.5);

  r = table('Namn,Pris\nRöd ros,120\nTulpan,55');
  assert.equal(r.rows.length, 2);
  assert.equal(r.hasPackCol, false);

  r = table('Namn\tPris/st\tAntal\nRöd ros\t12\t10');
  assert.equal(r.basisGuess, 'st', 'rubriken "Pris/st" tolkas som pris per stjälk');
  assert.equal(r.rows[0].paketNum, 10);
});

test('readTable: svar från AI-assistenter (markdown-tabell, kodblock, inledande och avslutande text)', () => {
  assert.equal(table('| Namn | Antal | Pris |\n|---|---|---|\n| Röd ros | 10 | 120 |').rows[0].prisNum, 120);
  assert.equal(table('```\nNamn;Pris\nRöd ros;120\n```').rows.length, 1);
  assert.equal(table('Här är priserna:\n\nNamn;Pris\nRöd ros;120\nTulpan;55\n\nHoppas det hjälper!').rows.length, 2,
    'texten efter tabellen räknas inte som vara');
});

test('readTable: BOM, Windows-radslut och citerade fält', () => {
  assert.equal(table('﻿Namn;Pris\r\nRöd ros;120\r\n').rows[0].namn, 'Röd ros');
  assert.equal(table('Namn;Pris\n"Röd ros; 60 cm";120').rows[0].namn, 'Röd ros; 60 cm');
});

test('readTable: artikelnummer blir inte namn eller pris', () => {
  const r = table('Artikelnr;Namn;Pris\n123;Röd ros;120');
  assert.equal(r.rows[0].namn, 'Röd ros');
  assert.equal(r.rows[0].prisNum, 120);
});

test('[dokumenterat] readTable: med flera priskolumner vinner den första', () => {
  const r = table('Namn;Pris per förp;Pris inkl moms\nRöd ros;120;150');
  assert.equal(r.rows[0].prisNum, 120);
  assert.equal(r.priceHeader, 'Pris per förp');
});

test('readTable: begripliga fel i stället för tyst misslyckande', () => {
  assert.match(table('').error, /ingen text att läsa in/);
  assert.match(table('bara text utan kolumner').error, /inga kolumner/);
  assert.match(table('Foo;Bar\n1;2').error, /hittar inte kolumnerna Namn och Pris\. Rubrikerna jag läste: "Foo", "Bar"/);
  assert.match(table('Namn;Pris').error, /inga varor under dem/);
});

test('readTable: förpackningen kan stå i enheten eller namnet när kolumnen saknas', () => {
  const r = table('Namn;Pris;Enhet\nRöd ros;120;10-pack\nTulpan;55;bunt à 20');
  assert.equal(r.rows[0].packDetected, 10);
  assert.equal(r.rows[1].packDetected, 20);
  assert.ok(Number.isNaN(r.rows[0].paketNum) || r.rows[0].paketNum == null);
});
