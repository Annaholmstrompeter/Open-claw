import { chromium } from 'playwright-core';
import { fileURLToPath } from 'node:url';
import path from 'node:path'; import fs from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const URLB = 'file://' + ROOT + '/index.html';
const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
let fail = 0; const say = (ok, m) => { if (!ok) fail++; console.log((ok ? '  ok   ' : '  FEL  ') + m); };
async function pg(w, h, q = '', o = {}) { const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, locale: 'sv-SE', hasTouch: w < 600, isMobile: w < 600, ...o }); const p = await ctx.newPage(); p.errs = []; p.on('pageerror', e => p.errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/net::|Failed to load resource/.test(m.text())) p.errs.push(m.text()); }); await p.goto(URLB + q); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(250); return p; }

console.log('1. Sidledes överflöd och prisfält i bild, per bredd');
for (const w of [320, 360, 390, 768, 999, 1000, 1024, 1100, 1280, 1440, 1920]) {
  for (const [name, q] of [['Hem', ''], ['Bygg', '?bygg=1'], ['Blomval', '?bygg=1&blommor=1'], ['Inköp', '?inkop=1']]) {
    const p = await pg(w, w < 600 ? 780 : 900, q);
    const r = await p.evaluate(sel => ({ ov: document.documentElement.scrollWidth - document.documentElement.clientWidth, pb: (() => { const e = document.querySelector(sel); if (!e) return null; const b = e.getBoundingClientRect(); return { top: b.top, bottom: b.bottom, h: innerHeight }; })(),
      top: (() => { if (innerWidth < 1000) return null; const g = s => document.querySelector(s).getBoundingClientRect(); const n = g('.gnav'), br = g('.brand'), rr = g('.top .r'); return Math.min(br.left - n.right, rr.left - br.right); })() }), name === 'Blomval' ? '#picker:not([hidden]) .pk-bar' : '#pb');
    say(r.ov <= 0 && p.errs.length === 0 && (!r.pb || (r.pb.bottom <= r.pb.h + 1 && r.pb.top >= 0)) && (r.top === null || r.top >= 16), `${name} ${w} px: överflöd ${r.ov}, prisfält ${r.pb ? Math.round(r.pb.top) + '–' + Math.round(r.pb.bottom) + ' av ' + r.pb.h : '–'}, avstånd meny/logotyp ${r.top === null ? '–' : Math.round(r.top) + ' px'}, fel ${p.errs.length}`);
    await p.context().close();
  }
}
console.log('2. Tryckytor på mobil (390 px), minst 44×44 px');
for (const [name, q, steps] of [['Hem', '', null], ['Bygg', '?bygg=1', null], ['Inköp', '?inkop=1', null], ['Blomval, översikt', '?bygg=1&blommor=1', null], ['Blomval, kategori', '?bygg=1&blommor=1', async p => { await p.click('.pk-cat[data-id="huvud"]'); await p.waitForTimeout(150); }],
  ['Blomval, sök', '?bygg=1&blommor=1', async p => { await p.fill('#pk-q', 'ros'); await p.waitForTimeout(150); }],
  ['Blomval, favoriter med förklaring', '?bygg=1&blommor=1', async p => { await p.click('.pk-sec .link'); await p.waitForTimeout(100); await p.click('[data-act="pk-about"]'); await p.waitForTimeout(100); }]]) {
  const p = await pg(390, 844, q); if (steps) await steps(p);
  const small = await p.evaluate(() => [...document.querySelectorAll('button,a[href],input,select,textarea')].filter(e => { const s = getComputedStyle(e), r = e.getBoundingClientRect(); if (r.width === 0 || r.height === 0 || s.visibility === 'hidden' || e.closest('[inert]') && false) return false; if (e.closest('.sr') || e.classList.contains('skip')) return false; const inView = r.bottom > 0 && r.top < innerHeight * 4; const hiddenPicker = e.closest('.picker') && !e.closest('.picker.open'); return inView && !hiddenPicker && (r.width < 43.5 || r.height < 43.5); }).map(e => (e.className || e.tagName) + ' ' + Math.round(e.getBoundingClientRect().width) + '×' + Math.round(e.getBoundingClientRect().height) + ' "' + (e.getAttribute('aria-label') || e.textContent).trim().slice(0, 24) + '"'));
  say(small.length === 0, `${name}: ${small.length ? small.join(' | ') : 'alla tryckytor ≥ 44 px'}`);
  await p.context().close();
}
console.log('3. Typografi: minsta textstorlek, tunna skrifter och Bodoni i små storlekar');
for (const [name, w, q] of [['Hem mobil', 390, ''], ['Hem dator', 1440, ''], ['Bygg mobil', 390, '?bygg=1'], ['Bygg dator', 1440, '?bygg=1'], ['Blomval mobil', 390, '?bygg=1&blommor=1'], ['Blomval dator', 1440, '?bygg=1&blommor=1'], ['Inköp mobil', 390, '?inkop=1'], ['Inköp dator', 1440, '?inkop=1']]) {
  const p = await pg(w, 900, q); if (/Blomval/.test(name)) { await p.click(w < 600 ? '.pk-cat[data-id="lok"]' : '.rail-i[data-id="lok"]'); await p.waitForTimeout(150); }
  const r = await p.evaluate(() => { const out = { tiny: [], thin: [], bodoni: [] }; const wk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let n; while ((n = wk.nextNode())) { const t = n.textContent.trim(); if (!t) continue; const e = n.parentElement; if (e.closest('.sr') || e.closest('script')) continue; const s = getComputedStyle(e); if (s.display === 'none' || s.visibility === 'hidden') continue; const r = e.getBoundingClientRect(); if (r.width === 0) continue;
      const fs = parseFloat(s.fontSize), fw = parseInt(s.fontWeight, 10), ff = s.fontFamily;
      if (fs < 12) out.tiny.push(t.slice(0, 20) + ' ' + fs); if (fw < 400) out.thin.push(t.slice(0, 20) + ' ' + fw); if (/Bodoni/.test(ff.split(',')[0]) && fs < 20) out.bodoni.push(t.slice(0, 20) + ' ' + fs); }
    return out; });
  say(!r.tiny.length && !r.thin.length && !r.bodoni.length, `${name}: text <12 px: ${r.tiny.length}, vikt <400: ${r.thin.length}, Bodoni <20 px: ${r.bodoni.length} ${[...r.tiny, ...r.thin, ...r.bodoni].slice(0, 4).join(' | ')}`);
  await p.context().close();
}
console.log('4. Kontrast (WCAG 2.x), uppmätt ur CSS-variablerna');
const css = fs.readFileSync(ROOT + '/css/studio.css', 'utf8'); const V = {}; for (const m of css.matchAll(/--([a-z0-9-]+):\s*(#[0-9A-Fa-f]{6})/g)) V[m[1]] = m[2];
const lin = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const lum = h => { const [r, g, bl] = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)); return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(bl); };
const ratio = (a, c) => { const x = lum(V[a] || a), y = lum(V[c] || c); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
for (const [fg, bg, min, what] of [['ink', 'paper', 7, 'brödtext'], ['ink-2', 'paper', 7, 'dämpad text'], ['mut', 'paper', 4.5, 'etiketter'], ['mut', 'paper-2', 4.5, 'etiketter på ytor'], ['bronze', 'paper', 4.5, 'bronstext (taggar, fokus)'], ['claret', 'paper', 4.5, 'claret (ord, ta bort)'], ['ok', 'paper', 4.5, '✓ bekräftat'], ['warn', 'paper', 4.5, '≈ ungefärligt'], ['paper', 'ink', 7, 'text på svart knapp'], ['#E0C592', 'ink', 4.5, 'guldsiffra på svart'], ['#DDD6C7', 'ink', 4.5, 'underrubrik på svart'], ['field', 'paper', 3, 'fältkant mot sida (1.4.11)'], ['field', 'paper-2', 3, 'fältkant mot yta (1.4.11)'], ['ink', 'paper-2', 7, 'text på ytor'], ['ink-2', 'paper-2', 4.5, 'dämpad text på ytor'], ['warn', 'paper-2', 4.5, '≈ på yta'], ['bronze', 'paper-2', 4.5, 'brons på yta'], ['ink', 'paper-3', 7, 'text vid hover'], ['claret', 'paper-2', 4.5, 'hjärta på vald rad'], ['mut', 'paper-2', 3, 'tomt hjärta och kryssruta mot vald rad (1.4.11)'], ['field', 'paper-2', 3, 'kryssrutans kant (1.4.11)'], ['ink', '#EBDDB8', 7, 'sökträff markerad i namnet'], ['#E0C592', 'ink', 4.5, 'Ångra i meddelandet']]) { const r = ratio(fg, bg); say(r >= min, `${what}: ${fg} på ${bg} = ${r.toFixed(2)}:1 (krav ${min}:1)`); }
console.log('   (hårfina linjer #DDD3C1 och #C4B8A0 är dekor, inte det enda som visar en kontroll; kontrollerna har egen kant eller fyllning.)');
console.log('5. Tangentbord och fokus');
{ const p = await pg(1440, 900); const seq = [];
  for (let i = 0; i < 9; i++) { await p.keyboard.press('Tab'); seq.push(await p.evaluate(() => { const e = document.activeElement, s = getComputedStyle(e); return (e.dataset.act || e.className || e.tagName) + (s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) >= 2 ? '' : ' (SAKNAR FOKUSRING)'); })); }
  say(!seq.some(s => /SAKNAR/.test(s)), 'Tab genom Hem: ' + seq.join(' → '));
  await p.keyboard.press('Enter'); await p.waitForTimeout(100); await p.context().close(); }
{ const p = await pg(390, 844, '?bygg=1'); await p.click('.addflowers'); await p.waitForTimeout(350);
  const insideOnly = await p.evaluate(() => { const bad = []; for (const s of ['.top', '.p-job', '.p-active']) { const e = document.querySelector(s); if (e && !e.hasAttribute('inert')) bad.push(s); } return bad; });
  say(insideOnly.length === 0, 'blomvalet på mobil låser resten av sidan (inert) för tangentbord och skärmläsare: ' + (insideOnly.join(',') || 'ja'));
  const seq = []; for (let i = 0; i < 12; i++) { await p.keyboard.press('Tab'); seq.push(await p.evaluate(() => { const e = document.activeElement, s = getComputedStyle(e), pk = document.querySelector('#picker'); return (pk.contains(e) ? '' : 'UTANFÖR ') + (e.dataset.fk || e.id || e.className || e.tagName) + (s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) >= 2 || (e.closest('.pk-field') && getComputedStyle(e.closest('.pk-field')).outlineStyle !== 'none') ? '' : ' (SAKNAR FOKUSRING)'); })); }
  say(!seq.some(x => /SAKNAR|UTANFÖR/.test(x)), 'Tab i blomvalet stannar i blomvalet och alla kontroller har fokusring: ' + seq.join(' → '));
  await p.keyboard.press('Escape'); await p.waitForTimeout(350);
  say(await p.evaluate(() => document.querySelector('#picker').hidden), 'Escape stänger blomvalet'); await p.context().close(); }
{ const p = await pg(1440, 900, '?bygg=1&blommor=1'); const seq = [];
  for (let i = 0; i < 8; i++) { await p.keyboard.press('Tab'); seq.push(await p.evaluate(() => { const e = document.activeElement, s = getComputedStyle(e); return (e.dataset.fk || e.id || e.className || e.tagName) + ((s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) >= 2) || (e.closest('.pk-field') && getComputedStyle(e.closest('.pk-field')).outlineStyle !== 'none') ? '' : ' (SAKNAR FOKUSRING)'); })); }
  say(!seq.some(x => /SAKNAR/.test(x)), 'Tab genom blomvalet på dator, fokusring överallt: ' + seq.join(' → ')); await p.context().close(); }
console.log('6. Gränssnittet följer skärmstorleken när fönstret ändras');
{ const p = await pg(1440, 900, '?bygg=1&blommor=1'); await p.setViewportSize({ width: 390, height: 844 }); await p.waitForTimeout(300);
  say(await p.evaluate(() => document.querySelector('#picker').hidden && !document.body.classList.contains('locked')), 'dator→mobil med blomvalet öppet: blomvalet stängs och sidan låses inte'); await p.setViewportSize({ width: 1440, height: 900 }); await p.waitForTimeout(300);
  await p.setViewportSize({ width: 1440, height: 900 }); await p.evaluate(() => window.__studio.go(window.__studio.S.route)); await p.setViewportSize({ width: 390, height: 844 }); await p.waitForTimeout(300);
  const mob = await p.evaluate(() => ({ ov: document.documentElement.scrollWidth - document.documentElement.clientWidth, pk: getComputedStyle(document.querySelector('#picker')).position, tabs: !!document.querySelector('.arrlist') }));
  say(mob.ov <= 0 && mob.pk === 'fixed', 'dator→mobil: ingen överflöd, blomvalet blir egen skärm'); await p.setViewportSize({ width: 1440, height: 900 }); await p.waitForTimeout(300);
  say(await p.evaluate(() => getComputedStyle(document.querySelector('#picker')).position === 'static'), 'mobil→dator: blomvalet blir kolumn igen'); await p.context().close(); }
console.log('7. Utan webbtypsnitt och utan JavaScript');
{ const p = await pg(390, 844, '', { offline: false }); await p.route('**/fonts.g*/**', r => r.abort()); await p.reload(); await p.waitForTimeout(400);
  say(await p.evaluate(() => document.querySelectorAll('.job').length === 4 && document.documentElement.scrollWidth <= document.documentElement.clientWidth), 'reservtypsnitt: sidan fungerar utan Google Fonts'); await p.context().close(); }
{ const ctx = await b.newContext({ javaScriptEnabled: false }); const p = await ctx.newPage(); await p.goto(URLB); say(/kräver JavaScript/.test(await p.textContent('body')), 'utan JavaScript visas ett tydligt meddelande'); await ctx.close(); }
console.log('8. Vikt (lokala filer)');
{ const dir = ROOT; let tot = 0; const walk = d => { for (const f of fs.readdirSync(d)) { const q = path.join(d, f); const s = fs.statSync(q); if (s.isDirectory()) { if (!/skarmbilder|media|node_modules|verktyg/.test(f)) walk(q); } else if (/\.(js|css|html)$/.test(f)) tot += s.size; } }; walk(dir);
  console.log('   HTML+CSS+JS lokalt: ' + Math.round(tot / 1024) + ' KB (varav motorn ' + Math.round(fs.readdirSync(ROOT + '/js/engine').reduce((s, f) => s + fs.statSync(ROOT + '/js/engine/' + f).size, 0) / 1024) + ' KB, ej minifierad), inga bilder, två typsnittsfamiljer från Google Fonts'); }
await b.close(); console.log('\n' + (fail ? fail + ' FEL' : 'ALLT OK')); process.exit(fail ? 1 : 0);
