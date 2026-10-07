// Statiska kontroller av hela ekonomi- och arbetsytekoden: inga flyttal i ekonomikoden, inga webbläsarberoenden, rätt beroenden mellan moduler.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = f => fs.readFileSync(new URL('../public/js/core/' + f, import.meta.url), 'utf8');
function codeOnly(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')
    .replace(/'(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*"|`(?:\\.|[^`\\])*`/g, "''");
}
const FLOAT_FREE = ['money.js', 'amounts.js', 'tax.js', 'pricing.js', 'purchase.js', 'items.js'];
const PURE = [...FLOAT_FREE, 'workspace.js', 'store.js'];

test('all pengakod (inklusive inköpsplan och rader) är fri från flyttalsanrop och decimaltal', () => {
  for (const f of FLOAT_FREE) {
    const src = codeOnly(read(f));
    for (const [re, what] of [[/\bMath\./, 'Math.'], [/\bparseFloat\b/, 'parseFloat'], [/\btoFixed\b/, 'toFixed'], [/\bNumber\(/, 'Number('], [/\b\d+\.\d+\b/, 'decimaltal'], [/(^|[^\w.])\.\d+\b/, 'decimaltal utan heltalsdel'], [/\b\d+e[+-]?\d+\b/i, 'tal med exponent']])
      assert.ok(!re.test(src), f + ' innehåller ' + what);
  }
});

test('ingen modul rör webbläsarens tillstånd, nätverket eller lagringen direkt (lagring kommer in via en adapter)', () => {
  for (const f of PURE) {
    const src = codeOnly(read(f));
    for (const [re, what] of [[/\bwindow\b/, 'window'], [/\bdocument\b/, 'document'], [/\blocalStorage\b/, 'localStorage'], [/\bsessionStorage\b/, 'sessionStorage'], [/\bfetch\b/, 'fetch'], [/\bXMLHttpRequest\b/, 'XMLHttpRequest'], [/\bindexedDB\b/, 'indexedDB']])
      assert.ok(!re.test(src), f + ' använder ' + what);
  }
});

test('klockan och slumpen finns bara i arbetsytans standardsammanhang, aldrig i ekonomikoden', () => {
  for (const f of FLOAT_FREE) {
    const src = codeOnly(read(f));
    for (const [re, what] of [[/\bnew Date\b/, 'new Date'], [/\bDate\.now\b/, 'Date.now'], [/\bMath\.random\b/, 'Math.random'], [/\bcrypto\b/, 'crypto']]) assert.ok(!re.test(src), f + ' använder ' + what);
  }
  const ws = codeOnly(read('workspace.js'));
  assert.equal((ws.match(/new Date\(/g) || []).length, 1, 'bara defaultContext får läsa klockan');
  assert.equal((ws.match(/Math\.random/g) || []).length, 1, 'bara defaultContext får slumpa');
});

test('beroenden går bara åt ett håll: pengar ← belopp, regler ← prismotor ← inköp och rader ← arbetsyta, och lagringen känner inte arbetsytan', () => {
  const requires = f => [...read(f).matchAll(/require\('\.\/([a-z]+)\.js'\)/g)].map(m => m[1]).sort();
  assert.deepEqual(requires('money.js'), []);
  assert.deepEqual(requires('amounts.js'), ['money']);
  assert.deepEqual(requires('tax.js'), ['money']);
  assert.deepEqual(requires('purchase.js'), ['money']);
  assert.deepEqual(requires('items.js'), ['money', 'tax']);
  assert.deepEqual(requires('pricing.js'), ['amounts', 'money', 'tax']);
  assert.deepEqual(requires('workspace.js'), ['items', 'money', 'pricing', 'purchase', 'tax']);
  assert.deepEqual(requires('store.js'), []);
});

test('de nya modulerna laddas inte av appen än och den gamla appens filer är orörda', () => {
  const html = fs.readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
  for (const f of ['money', 'amounts', 'tax', 'pricing', 'purchase', 'items', 'workspace', 'store']) assert.ok(!html.includes('js/core/' + f + '.js'), f + ' ska inte vara kopplad till appen än');
  assert.ok(html.includes('js/core/model.js'));
  assert.ok(!/buketraknare\.workspace/.test(html), 'appen skriver inte till arbetsytans lagring än');
});
