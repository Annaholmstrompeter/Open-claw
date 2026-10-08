// Differenstest: den GAMLA appen (före modellbytet) fick samma sparade tillstånd och räknade ut facit
// (test/fixtures/calc-golden.json). Den nya appen måste ge exakt samma priser, paket, överskott och varningar.
// Så bevisas att den fungerande kalkylen inte förstörs när arkitekturen ändras.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { loadApp } from './helpers/app.mjs';
import { fixtures, randomV1State, randomCleanV1State } from './support/v1-fixtures.mjs';
import { extractCalc, toKeyFor, GOLDEN_FUZZ, GOLDEN_CLEAN } from './support/calc-extract.mjs';

const golden = JSON.parse(fs.readFileSync(new URL('./fixtures/calc-golden.json', import.meta.url), 'utf8'));
const plain = x => JSON.parse(JSON.stringify(x));

async function check(names, stateFor) {
  for (const name of names) {
    assert.ok(golden[name], 'facit saknas för ' + name);
    const app = await loadApp({ storage: { 'buketraknare.v1': JSON.stringify(stateFor(name)) } });
    const got = plain(extractCalc(app.calc(), toKeyFor(app)));
    app.close();
    assert.deepEqual(got, golden[name], name);
  }
}

test('facit finns för alla fall', () => {
  assert.equal(Object.keys(golden).length, Object.keys(fixtures()).length + GOLDEN_FUZZ + GOLDEN_CLEAN);
});

test('differens: handbyggda tillstånd räknar exakt som den gamla appen', async () => {
  const f = fixtures();
  await check(Object.keys(f).map(n => 'fixtur: ' + n), n => f[n.replace('fixtur: ', '')]);
});

test(`differens: ${GOLDEN_FUZZ} slumpade (ofta trasiga) tillstånd räknar exakt som den gamla appen`, async () => {
  await check(Array.from({ length: GOLDEN_FUZZ }, (_, n) => 'slump ' + n), n => randomV1State(+n.split(' ')[1]));
});

test(`differens: ${GOLDEN_CLEAN} rena tillstånd (färdiga priser, delade paket, hemma, frakt) räknar exakt som den gamla appen`, async () => {
  await check(Array.from({ length: GOLDEN_CLEAN }, (_, n) => 'ren ' + n), n => randomCleanV1State(+n.split(' ')[1]));
});
