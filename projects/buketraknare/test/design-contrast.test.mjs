// Kontrast och tillgänglighet i designsystemet (public/css/studio.css): WCAG 2.x, ljust och mörkt läge.
// Färgerna i uppdraget är varumärkesfärger. Där originalet inte klarar kraven används en anpassad ton för text, fält och knappar.
// Testet läser färgerna direkt ur CSS-filen, så en ändrad färg som bryter kontrasten stoppas här.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const CSS = fs.readFileSync(new URL('../public/css/studio.css', import.meta.url), 'utf8');

function tokens(block) {
  const out = {};
  for (const m of block.matchAll(/--([a-z0-9-]+):\s*([^;]+);/g)) out[m[1]] = m[2].trim();
  return out;
}
const blockAfter = marker => {
  const i = CSS.indexOf(marker); assert.ok(i >= 0, 'hittar inte ' + marker);
  const open = CSS.indexOf('{', i), close = CSS.indexOf('}', open);
  return CSS.slice(open + 1, close);
};
const LIGHT = tokens(blockAfter(':root{'));
const DARK = tokens(blockAfter(':root[data-theme="dark"]'));
const DARK_MEDIA = tokens(blockAfter(':root:not([data-theme="light"])'));

const hex = h => { h = h.replace('#', ''); return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)); };
const lin = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const lum = h => { const [r, g, b] = hex(h).map(lin); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

const TEXT = 4.5, LARGE_OR_UI = 3, BODY_AAA = 7;
// [förgrund, bakgrund, minst, vad det är]
const PAIRS = [
  ['ink', 'bg', BODY_AAA, 'brödtext på sidan'], ['ink', 'surface', BODY_AAA, 'brödtext på kort'], ['ink', 'sage', TEXT, 'text på valt läge (sage)'], ['ink', 'sage-soft', TEXT, 'text på ljus sage'],
  ['ink-2', 'bg', TEXT, 'dämpad text på sidan'], ['ink-2', 'surface', TEXT, 'dämpad text på kort'], ['ink-2', 'sage', TEXT, 'dämpad text på sage'], ['ink-2', 'sage-soft', TEXT, 'dämpad text på ljus sage'],
  ['rose-ink', 'bg', TEXT, 'länkar och ikoner i rose'], ['rose-ink', 'surface', TEXT, 'rose-text på kort'], ['rose-ink', 'sage', TEXT, 'rose-text på sage'], ['rose-ink', 'rose-soft', TEXT, 'rose-text på rose-yta'],
  ['on-rose', 'rose-fill', TEXT, 'text på dusty rose (antal-märken)'],
  ['btn-fg', 'btn-bg', BODY_AAA, 'primärknapp'], ['btn-fg', 'btn-hover', BODY_AAA, 'primärknapp, hover'],
  ['hero-fg', 'hero-bg', BODY_AAA, 'kundpriskort och startsidans val'], ['hero-icon', 'hero-bg', LARGE_OR_UI, 'ikon på startsidans val (grafik)'],
  ['line-strong', 'bg', LARGE_OR_UI, 'fältkant mot sidan (WCAG 1.4.11)'], ['line-strong', 'surface', LARGE_OR_UI, 'fältkant mot kort (WCAG 1.4.11)'],
  ['focus', 'bg', LARGE_OR_UI, 'fokusring mot sidan'], ['focus', 'surface', LARGE_OR_UI, 'fokusring mot kort'], ['focus', 'sage', LARGE_OR_UI, 'fokusring mot sage'],
  ['ok', 'ok-soft', TEXT, 'bekräftat, text'], ['warn', 'warn-soft', TEXT, 'varning, text'], ['bad', 'bad-soft', TEXT, 'fel, text'],
  ['ink', 'ok-soft', TEXT, 'brödtext på bekräftat'], ['ink', 'warn-soft', TEXT, 'brödtext på varning'], ['ink', 'bad-soft', TEXT, 'brödtext på fel'],
  ['ok', 'bg', TEXT, 'bekräftat som text på sidan'], ['warn', 'bg', TEXT, 'varning som text på sidan'], ['bad', 'bg', TEXT, 'fel som text på sidan'],
  ['warn', 'surface', TEXT, 'varning på kort'], ['bad', 'surface', TEXT, 'fel på kort']
];

for (const [name, T] of [['ljust läge', LIGHT], ['mörkt läge', DARK]]) {
  test('kontrast i ' + name + ': alla par når kraven (WCAG 2.x AA, brödtext AAA)', () => {
    const low = [];
    for (const [fg, bg, min, what] of PAIRS) {
      assert.ok(T[fg] && T[bg], name + ': saknar färg ' + fg + ' eller ' + bg);
      const r = ratio(T[fg], T[bg]);
      if (r < min) low.push(what + ': ' + T[fg] + ' på ' + T[bg] + ' = ' + r.toFixed(2) + ':1, kravet är ' + min + ':1');
    }
    assert.deepEqual(low, []);
  });
}

test('mörkt läge: enhetens val (media query) och data-theme="dark" har exakt samma färger', () => {
  assert.deepEqual(DARK_MEDIA, DARK);
});

test('uppdragets fem färger finns kvar som varumärkesfärger i ljust läge', () => {
  const upper = o => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, v.toUpperCase()]));
  const L = upper(LIGHT);
  assert.equal(L.bg, '#F6F3EC');       // ivory
  assert.equal(L.ink, '#263A30');      // deep olive
  assert.equal(L.rose, '#B78F91');     // dusty rose
  assert.equal(L.sage, '#DCE3D8');     // sage
  assert.equal(L.stone, '#C5B59D');    // stone
});

test('dusty rose och stone används aldrig som textfärg, och fält har den mörkare kanten (de uppmätta skälen till anpassade toner)', () => {
  // originalen är för ljusa för text (2,6:1 mot ivory, 2,9:1 med vit text) och för fältkant (1,8:1)
  assert.ok(ratio('#B78F91', '#F6F3EC') < TEXT);
  assert.ok(ratio('#FFFFFF', '#B78F91') < TEXT);
  assert.ok(ratio('#C5B59D', '#F6F3EC') < LARGE_OR_UI);
  const rules = [...CSS.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^}]*)\}/g)].map(m => ({ sel: m[1].trim(), body: m[2] }));
  const textUses = rules.filter(r => /(^|;)\s*color\s*:[^;]*var\(--(rose|stone)\)/.test(r.body)).map(r => r.sel);
  assert.deepEqual(textUses, [], 'rose eller stone som textfärg: ' + textUses.join(' | '));
  const field = rules.find(r => r.sel.startsWith('input,select,textarea'));
  assert.match(field.body, /border:1px solid var\(--line-strong\)/);
});

test('tillgänglighet i CSS: fokus syns, rörelse kan stängas av, tvingade färger stöds och tryckytor är minst 44 px', () => {
  const code = CSS.replace(/\/\*[\s\S]*?\*\//g, '');
  assert.match(code, /:focus-visible\{outline:3px solid var\(--focus\)/);
  // fokus tas bara bort där något annat tar över: main (flyttas till programmatiskt), kort med egen ring och kundpris-listen
  const removed = [...code.matchAll(/([^{}]+)\{[^}]*outline:\s*0\b[^}]*\}/g)].map(m => m[1].trim()).sort();
  assert.deepEqual(removed, ['#totalbar:focus-within', '.j-arr .link:focus-visible', '.main:focus']);
  assert.ok(code.includes('.j-arr:has(.link:focus-visible){outline:3px solid var(--focus)'), 'kortet tar över fokusringen');
  assert.match(code, /prefers-reduced-motion: reduce/);
  assert.match(code, /prefers-color-scheme: dark/);
  assert.match(code, /forced-colors: active/);
  const has = (selector, ...decls) => { const m = code.match(new RegExp(selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\{([^}]*)\\}')); return !!m && decls.every(d => m[1].includes(d)); };
  assert.ok(has('.btn', 'min-height:48px'), '.btn är minst 48 px');
  assert.ok(has('.btn.sm', 'min-height:44px'), '.btn.sm är minst 44 px');
  assert.ok(has('.icon-btn', 'width:44px', 'height:44px'), 'ikonknappar är minst 44 px');
  assert.ok(has('.stepper-btn,.stepper button', 'width:48px', 'height:46px', 'flex:none'), 'plus och minus är minst 44 px och krymper inte');
  assert.ok(has('.nav-item', 'min-height:var(--nav-h)'), 'menyvalen är höga som menyfältet');
  assert.ok(/--nav-h:\s*(6[4-9]|[7-9]\d)px/.test(code), 'menyfältet är minst 64 px');
});
