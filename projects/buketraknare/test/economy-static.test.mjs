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
const noComments = src => src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1');
const FLOAT_FREE = ['money.js', 'amounts.js', 'tax.js', 'pricing.js', 'purchase.js', 'items.js'];
const PURE = [...FLOAT_FREE, 'workspace.js', 'store.js', 'bridge.js'];

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
  assert.deepEqual(requires('bridge.js'), ['money', 'workspace']);
  const ui = [...fs.readFileSync(new URL('../public/js/jobs-ui.js', import.meta.url), 'utf8').matchAll(/require\('\.\/core\/([a-z]+)\.js'\)/g)].map(m => m[1]).sort();
  assert.deepEqual(ui, ['bridge', 'items', 'money', 'store', 'workspace']);          // skärmen räknar inget själv, den går via arbetsytan och bryggan
});

test('bryggan är den enda platsen där den gamla appens flyttal kommer in, och de omvandlas via text, aldrig via flyttalsräkning', () => {
  const src = codeOnly(read('bridge.js'));
  for (const [re, what] of [[/\bparseFloat\b/, 'parseFloat'], [/\btoFixed\b/, 'toFixed'], [/\bMath\.(floor|ceil|trunc|pow|sqrt)\b/, 'Math.floor/ceil/trunc/pow/sqrt']]) assert.ok(!re.test(src), 'bridge.js innehåller ' + what);
  // Math används bara för antal (förpackningsstorlek och hemmalager) och för att jämföra priset med noll, precis som calc(), aldrig för belopp
  const lines = src.split('\n').filter(l => /\bMath\./.test(l)).map(l => l.trim());
  assert.equal(lines.length, 4, 'oväntade Math-anrop: ' + lines.join(' | '));
  for (const l of lines) assert.ok(/paket|pris|\bv\b|seq/.test(l), 'Math-anrop som inte gäller antal: ' + l);
  assert.equal((src.match(/\bNumber\(/g) || []).length, 1, 'Number( får bara finnas i plain()');
});

test('jobbskärmen räknar inga flyttal och rör varken nätverket eller lagringen direkt (lagringen skickas in utifrån)', () => {
  const src = codeOnly(fs.readFileSync(new URL('../public/js/jobs-ui.js', import.meta.url), 'utf8'));
  for (const [re, what] of [[/\bparseFloat\b/, 'parseFloat'], [/\btoFixed\b/, 'toFixed'], [/\bMath\./, 'Math.'], [/\bNumber\(/, 'Number('], [/\blocalStorage\b/, 'localStorage'], [/\bsessionStorage\b/, 'sessionStorage'], [/\bfetch\b/, 'fetch'], [/\bXMLHttpRequest\b/, 'XMLHttpRequest'], [/\bindexedDB\b/, 'indexedDB'], [/\bwindow\b/, 'window']])
    assert.ok(!re.test(src), 'jobs-ui.js använder ' + what);
});

test('appen laddar de nya modulerna i rätt ordning, och den gamla appens egna filer och lagringsnycklar är orörda', () => {
  const html = fs.readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
  const order = ['model', 'money', 'amounts', 'tax', 'pricing', 'purchase', 'items', 'workspace', 'store', 'bridge'].map(f => html.indexOf('<script src="js/core/' + f + '.js"></script>'));
  assert.ok(order.every(i => i > 0), 'alla moduler ska laddas: ' + order);
  assert.deepEqual([...order].sort((a, b) => a - b), order, 'modulerna ska laddas i beroendeordning');
  assert.ok(html.indexOf('<script src="js/jobs-ui.js"></script>') > order[order.length - 1]);
  // den gamla appens lagringsnycklar finns bara i den gamla koden. Arbetsytans egen nyckel finns bara i store.js
  for (const f of ['money', 'amounts', 'tax', 'pricing', 'purchase', 'items', 'workspace', 'store', 'bridge']) assert.ok(!/buketraknare\.v[12]/.test(noComments(read(f + '.js'))), f + '.js använder den gamla appens lagring');
  assert.ok(!/buketraknare\.v[12]/.test(noComments(fs.readFileSync(new URL('../public/js/jobs-ui.js', import.meta.url), 'utf8'))));
  assert.ok(!/buketraknare\.workspace/.test(html), 'appen nämner inte arbetsytans nyckel (den ligger i store.js)');
  assert.ok(read('store.js').includes("'buketraknare.workspace.v1'"));
  assert.ok(html.includes("storage:window.localStorage"), 'lagringen skickas in till jobbskärmen utifrån');
});
