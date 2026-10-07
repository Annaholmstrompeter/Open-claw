// TESTDATA. Inget här är en verifierad skatteregel. Satserna är påhittade siffror för att testa strukturen
// (flera satser, versioner, giltighetstid). Källan är alltid 'fixture' och status alltid 'unverified'.
import T from '../../public/js/core/tax.js';

/** En regeluppsättning med samma sats för alla kategorier (bp = hundradels procent). */
export function fixtureFlat(bp, over = {}) {
  const rates = {};
  T.TAX_CATEGORIES.forEach(c => { rates[c] = bp; });
  return T.createRuleSet({ id: 'fixture-flat', version: 1, validFrom: '2000-01-01', validTo: null, rates, roundingLevel: 'line',
    source: { kind: 'fixture', note: 'TESTDATA. Inte en regel.' }, verification: { status: 'unverified' }, ...over });
}

/** En regeluppsättning med olika satser per kategori. */
export function fixtureMixed(rates, over = {}) {
  const all = {};
  T.TAX_CATEGORIES.forEach(c => { all[c] = 2500; });
  return T.createRuleSet({ id: 'fixture-mixed', version: 1, validFrom: '2000-01-01', validTo: null, rates: { ...all, ...rates }, roundingLevel: 'line',
    source: { kind: 'fixture', note: 'TESTDATA. Inte en regel.' }, verification: { status: 'unverified' }, ...over });
}
