// Granskningsmotor för layout: letar efter det som en florist ser som "trasigt" på en telefon.
// Kapad text (även i fält och rullbara ytor), text och kontroller som överlappar varandra, kontroller som något annat täcker,
// innehåll utanför bild, vågrät rullning och för små tryckytor. Körs i riktig Chromium. Motorn kan också emulera ökad textstorlek
// (som Androids teckenstorlek) genom att skala alla teckenstorlekar i CSS och JS, medan layoutbredden är kvar.
import fs from 'node:fs';
import path from 'node:path';

/** Körs inne i sidan. Ger en lista med fynd { kind, what, detail }. Mäter det som syns just nu. */
export function auditInPage(opts) {
  const o = Object.assign({ minTap: 44, minFont: 12 }, opts || {});
  const out = [];
  const vw = document.documentElement.clientWidth, vh = document.documentElement.clientHeight;
  const add = (kind, el, detail) => out.push({ kind, what: label(el), detail: detail || '' });
  function label(el) {
    if (!el) return '?';
    const cls = typeof el.className === 'string' && el.className.trim() ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : '';
    return el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + cls + ' "' + (el.value || el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 30) + '"';
  }
  const de0 = document.documentElement;
  const docScroll = (de0.scrollHeight > de0.clientHeight + 2 || document.body.scrollHeight > document.body.clientHeight + 2) && getComputedStyle(document.body).overflowY !== 'hidden' && getComputedStyle(de0).overflowY !== 'hidden';
  const fixedAnc = el => { for (let e = el; e && e !== document.documentElement; e = e.parentElement) { const p = getComputedStyle(e).position; if (p === 'fixed' || p === 'sticky') return e; } return null; };
  const isFixed = el => !!fixedAnc(el);
  // ett fast fält täcker bara "på riktigt" innehåll som aldrig går att rulla fram: överkant vid rullning 0, nederkant vid slutet
  const fixedRelevant = f => { const r = f.getBoundingClientRect(); return (r.top + r.bottom) / 2 < vh / 2 ? !!o.atStart : !!o.atEnd; };
  const shown = el => { for (let e = el; e && e !== document.documentElement; e = e.parentElement) { if (e.hasAttribute('hidden') || e.hasAttribute('inert')) return false; const s = getComputedStyle(e); if (s.display === 'none' || s.visibility === 'hidden') return false; } return true; };
  const isSr = el => !!el.closest('.sr, .skip');
  const chain = (el, self) => { const r = []; for (let a = self ? el : el.parentElement; a && a !== document.documentElement; a = a.parentElement) { const s = getComputedStyle(a); if (s.overflowX !== 'visible' || s.overflowY !== 'visible') r.push({ a, ox: s.overflowX, oy: s.overflowY }); } return r; };
  function clipOf(el, self) {   // self: texten klipps också av sin egen ruta (en rubrik med overflow:hidden)
    let L = 0, T = 0, R = vw, B = vh, vscroll = false;
    for (const { a, ox, oy } of chain(el, self)) {
      const r = a.getBoundingClientRect();
      if (ox !== 'visible') { L = Math.max(L, r.left); R = Math.min(R, r.right); }
      if (oy !== 'visible') { T = Math.max(T, r.top); B = Math.min(B, r.bottom); }
      if (oy === 'auto' || oy === 'scroll') vscroll = true;
    }
    return { L, T, R, B, vscroll };
  }
  const inter = (a, b) => ({ w: Math.min(a.R, b.R) - Math.max(a.L, b.L), h: Math.min(a.B, b.B) - Math.max(a.T, b.T) });
  const boxOf = r => ({ L: r.left, T: r.top, R: r.right, B: r.bottom });
  const clipBox = (r, c) => ({ L: Math.max(r.left, c.L), T: Math.max(r.top, c.T), R: Math.min(r.right, c.R), B: Math.min(r.bottom, c.B) });

  // 1. text: kapad, utanför bild eller kräver sidledes rullning, och för liten
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const textBoxes = []; let n;
  while ((n = walker.nextNode())) {
    const t = n.textContent.replace(/\s+/g, ' ').trim(); if (!t) continue;
    const el = n.parentElement; if (!el || el.closest('script,style,noscript') || isSr(el) || !shown(el)) continue;
    const range = document.createRange(); range.selectNodeContents(n);
    const rects = [...range.getClientRects()].filter(r => r.width > 0.5 && r.height > 0.5); if (!rects.length) continue;
    const c = clipOf(el, true);
    let U = { L: 1e9, T: 1e9, R: -1e9, B: -1e9 };
    for (const r of rects) {
      U = { L: Math.min(U.L, r.left), T: Math.min(U.T, r.top), R: Math.max(U.R, r.right), B: Math.max(U.B, r.bottom) };
      if (r.left < c.L - 1 || r.right > c.R + 1) {
        const horiz = chain(el, true).find(x => x.ox !== 'visible' && (r.left < x.a.getBoundingClientRect().left - 1 || r.right > x.a.getBoundingClientRect().right + 1));
        add('kapad-text', el, 'texten går ' + Math.round(Math.max(c.L - r.left, r.right - c.R)) + ' px utanför ' + (horiz ? label(horiz.a) : 'bild'));
        break;
      }
      if (!c.vscroll && !docScroll && (r.top < c.T - 1 || r.bottom > c.B + 1)) { add('kapad-text', el, 'texten är kapad uppifrån eller nedifrån'); break; }
    }
    const cs0 = getComputedStyle(el), fs = parseFloat(cs0.fontSize); if (fs < o.minFont) add('liten-text', el, fs + ' px');
    // kontrast (WCAG 2.x): textfärg mot den bakgrund som faktiskt ligger bakom, 4.5:1 (3:1 för stor text)
    { const rgb = c => { const m = /rgba?\(([^)]+)\)/.exec(c); if (!m) return null; const v = m[1].split(/[ ,\/]+/).filter(Boolean).map(Number); return { r: v[0], g: v[1], b: v[2], a: v.length > 3 ? v[3] : 1 }; };
      const lin = x => { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); }; const L = c => 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b);
      let bg = { r: 255, g: 255, b: 255 }; const stack = []; for (let a = el; a; a = a.parentElement) stack.push(a);
      for (const a of stack.reverse()) { const c = rgb(getComputedStyle(a).backgroundColor); if (c && c.a > 0) bg = c.a >= 1 ? c : { r: c.r * c.a + bg.r * (1 - c.a), g: c.g * c.a + bg.g * (1 - c.a), b: c.b * c.a + bg.b * (1 - c.a) }; }
      const fg = rgb(cs0.color); if (fg && !(el.closest('button:disabled'))) { const f = fg.a < 1 ? { r: fg.r * fg.a + bg.r * (1 - fg.a), g: fg.g * fg.a + bg.g * (1 - fg.a), b: fg.b * fg.a + bg.b * (1 - fg.a) } : fg; const l1 = L(f), l2 = L(bg), ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05); const large = fs >= 24 || (fs >= 18.66 && parseInt(cs0.fontWeight, 10) >= 700); if (ratio < (large ? 3 : 4.5) - 0.01) add('låg-kontrast', el, ratio.toFixed(2) + ':1 (krav ' + (large ? 3 : 4.5) + ':1)'); } }
    for (const r of rects) { const ink = { left: r.left, right: r.right, top: r.top + r.height * 0.2, bottom: r.bottom - r.height * 0.2 }; textBoxes.push({ el, box: clipBox(ink, c), full: U }); }   // bokstävernas höjd, inte typsnittets hela ruta   // en ruta per textrad, så att en text som bryter rad inte ser ut att täcka sin granne
  }

  // 2. fält där värdet inte ryms, och ellipsis
  for (const el of document.querySelectorAll('input:not([type=hidden]),textarea')) {
    if (!shown(el)) continue;
    if ((el.value || el.placeholder) && el.scrollWidth > el.clientWidth + 1) add('kapad-text', el, 'fältets text ryms inte (' + el.scrollWidth + ' mot ' + el.clientWidth + ' px)');
  }
  for (const el of document.querySelectorAll('*')) {
    if (!shown(el)) continue;
    const s = getComputedStyle(el);
    if ((s.textOverflow === 'ellipsis' || s.webkitLineClamp !== 'none' && s.webkitLineClamp) && el.scrollWidth > el.clientWidth + 1) add('kapad-text', el, 'ellipsis döljer text');
    if ((s.overflowX === 'auto' || s.overflowX === 'scroll') && el.scrollWidth > el.clientWidth + 1 && !el.hasAttribute('data-hscroll-ok')) add('sidscroll', el, 'rullar i sidled (' + el.scrollWidth + ' mot ' + el.clientWidth + ' px)');
  }

  // 3. dokumentet får inte rulla i sidled
  const de = document.documentElement;
  if (de.scrollWidth > de.clientWidth + 1) out.push({ kind: 'sidscroll', what: 'html', detail: de.scrollWidth + ' mot ' + de.clientWidth + ' px' });

  // 4. kontroller: tryckyta, överlapp med annat, täckta
  const controls = [...document.querySelectorAll('button,a[href],input:not([type=hidden]),select,textarea,[role=checkbox],[role=tab]')].filter(e => shown(e) && !isSr(e));
  const coarse = matchMedia('(pointer:coarse)').matches;
  const boxes = [];
  for (const el of controls) {
    const r = el.getBoundingClientRect(), c = clipOf(el), b = clipBox(r, c);
    if (b.R - b.L <= 1 || b.B - b.T <= 1) continue;
    if (coarse && (r.width < o.minTap - 0.5 || r.height < o.minTap - 0.5) && !el.hasAttribute('data-small-ok')) add('liten-tryckyta', el, Math.round(r.width) + '×' + Math.round(r.height) + ' px');
    boxes.push({ el, box: b, kind: 'kontroll' });
  }
  for (const t of textBoxes) if (t.box.R - t.box.L > 1 && t.box.B - t.box.T > 1) boxes.push({ el: t.el, box: t.box, kind: 'text' });
  for (const el of document.querySelectorAll('svg,i')) {
    if (!shown(el) || isSr(el) || el.closest('svg') !== el && el.tagName === 'svg') continue;
    if (el.tagName.toLowerCase() === 'i' && !el.classList.contains('sw')) continue;
    const r = el.getBoundingClientRect(), b = clipBox(r, clipOf(el)); if (b.R - b.L > 1 && b.B - b.T > 1) boxes.push({ el, box: b, kind: 'grafik' });
  }
  const seen = new Set();
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
    const A = boxes[i], B = boxes[j];
    if (A.el.contains(B.el) || B.el.contains(A.el)) continue;
    if (docScroll && isFixed(A.el) !== isFixed(B.el) && !fixedRelevant(fixedAnc(A.el) || fixedAnc(B.el))) continue;
    const x = inter(A.box, B.box); if (x.w > 2 && x.h > 2) {
      const key = label(A.el) + '|' + label(B.el); if (seen.has(key)) continue; seen.add(key);
      out.push({ kind: 'overlapp', what: label(A.el) + '  ×  ' + label(B.el), detail: Math.round(x.w) + '×' + Math.round(x.h) + ' px (' + A.kind + '/' + B.kind + ')' });
    }
  }
  for (const b of boxes) {
    if (b.kind === 'grafik') continue;
    if (b.box.R - b.box.L < 8 || b.box.B - b.box.T < 8) continue;   // en list på några pixlar i kanten av en rullyta är inte en kontroll man kan träffa
    const cx = (b.box.L + b.box.R) / 2, cy = (b.box.T + b.box.B) / 2; if (cx < 0 || cy < 0 || cx > vw || cy > vh) continue;
    const top = document.elementFromPoint(cx, cy);
    if (top && !(top === b.el || b.el.contains(top) || top.contains(b.el))) { if (docScroll && isFixed(top) && !isFixed(b.el) && !fixedRelevant(fixedAnc(top))) continue; add('täckt', b.el, 'täcks av ' + label(top)); }
  }
  return out;
}

/** Granskar sidan som den ser ut nu, och rullar igenom varje rullningsyta så att allt innehåll mäts. */
export async function audit(page, opts) {
  const all = new Map();
  const merge = list => { for (const f of list) { const k = f.kind + '|' + f.what + '|' + f.detail.replace(/\d+/g, '#'); if (!all.has(k)) all.set(k, f); } };
  const docMax = await page.evaluate(() => { const de = document.documentElement; const sc = getComputedStyle(document.body).overflowY !== 'hidden' && getComputedStyle(de).overflowY !== 'hidden'; return sc ? Math.max(0, Math.max(de.scrollHeight, document.body.scrollHeight) - innerHeight) : 0; });
  merge(await page.evaluate(auditInPage, Object.assign({}, opts || {}, { atStart: true, atEnd: docMax <= 4 })));
  if (docMax > 4) {
    const step = await page.evaluate(() => Math.max(80, Math.round(innerHeight * 0.7)));
    for (let y = step; ; y += step) {
      const last = y >= docMax; await page.evaluate(t => window.scrollTo(0, t), Math.min(y, docMax)); await page.waitForTimeout(30);
      merge(await page.evaluate(auditInPage, Object.assign({}, opts || {}, { atEnd: last })));
      if (last) break;
    }
    await page.evaluate(() => window.scrollTo(0, 0));
  }
  const scrollers = await page.evaluate(() => {
    const r = []; document.querySelectorAll('*').forEach((el, i) => { const s = getComputedStyle(el); if ((s.overflowY === 'auto' || s.overflowY === 'scroll') && el.scrollHeight > el.clientHeight + 4) { let ok = true; for (let e = el; e && e !== document.documentElement; e = e.parentElement) { const c = getComputedStyle(e); if (e.hasAttribute('hidden') || c.display === 'none' || c.visibility === 'hidden') ok = false; } if (ok) { el.setAttribute('data-gr-scroll', String(r.length)); r.push({ i: r.length, max: el.scrollHeight - el.clientHeight, step: Math.max(60, Math.round(el.clientHeight * 0.7)) }); } } });
    return r;
  });
  for (const s of scrollers) {
    for (let y = s.step; y < s.max + s.step; y += s.step) {
      await page.evaluate(([i, top]) => { document.querySelector('[data-gr-scroll="' + i + '"]').scrollTop = top; }, [s.i, Math.min(y, s.max)]);
      merge(await page.evaluate(auditInPage, opts || {}));
      if (y >= s.max) break;
    }
    await page.evaluate(i => { const e = document.querySelector('[data-gr-scroll="' + i + '"]'); e.scrollTop = 0; e.removeAttribute('data-gr-scroll'); }, s.i);
  }
  return [...all.values()];
}

// ---------- ökad textstorlek ----------
/** Skalar teckenstorlekarna (px) i CSS och JS med faktorn k och skriver en kopia. Layoutens övriga mått ändras inte, som när man ökar teckenstorleken i Android. */
export function scaleFonts(text, k) {
  const num = (m, v) => String(Math.round(parseFloat(v) * k * 100) / 100);
  return text
    .replace(/(\bfont:\s*(?:italic\s+)?\d{3}\s+)(\d+(?:\.\d+)?)(px)/g, (m, a, v, u) => a + num(m, v) + u)
    .replace(/(font-size:\s*)([^;}"'`]*)/g, (m, a, body) => a + body.replace(/(\d+(?:\.\d+)?)px/g, (mm, v) => num(mm, v) + 'px'));
}
export function makeZoomedCopy(root, k, outDir) {
  fs.rmSync(outDir, { recursive: true, force: true }); fs.mkdirSync(outDir, { recursive: true });
  const walk = (src, dst) => {
    fs.mkdirSync(dst, { recursive: true });
    for (const f of fs.readdirSync(src)) {
      if (/^(skarmbilder|verktyg|node_modules)$/.test(f)) continue;
      const s = path.join(src, f), d = path.join(dst, f), st = fs.statSync(s);
      if (st.isDirectory()) walk(s, d);
      else if (/\.(css|js|html)$/.test(f) && !/engine/.test(s)) fs.writeFileSync(d, scaleFonts(fs.readFileSync(s, 'utf8'), k));
      else fs.copyFileSync(s, d);
    }
  };
  walk(root, outDir);
  return outDir;
}
