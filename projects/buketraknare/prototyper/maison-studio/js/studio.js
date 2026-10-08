/* Maison Studio: gränssnittet. Tre vyer ovanpå Buketträknarens riktiga prismotor (via studio-engine.js):
 *   Hem        senaste arbeten och en tydlig väg till en ny bukett
 *   Bukett     arbetsflödets centrum: välj blommor (sök, favoriter, kategorier) och se och ändra bukettens stjälkar och pris
 *   Inköp      vad som ska köpas hem för jobbet, i hela förpackningar
 * På smal skärm visas en yta i taget i Bukett, och prisfältet har ett tydligt kommando som växlar mellan dem. På bred skärm ligger bukett
 * och blomval sida vid sida. Inget sparas utom favoriterna (lokalt): allt annat ligger i minnet och återställs när sidan laddas om. */
(function () {
  'use strict';
  const E = window.StudioEngine.create();
  const D = window.StudioData;
  const safeStorage = () => { try { const st = window.localStorage, k = '__maison_test'; st.setItem(k, '1'); st.removeItem(k); return st; } catch (e) { return null; } };
  const F = window.StudioFavorites.create(safeStorage(), D.FLORISTS, new Set(D.FLOWERS.map(f => f.id)));   // favoriter per florist, lokalt i prototypen
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => [...(r || document).querySelectorAll(s)];
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const SPLIT = window.matchMedia('(min-width:900px) and (min-height:540px)');   // bukett och blomval sida vid sida
  const params = new URLSearchParams(location.search);
  const plural = (n, one, many) => n + ' ' + (n === 1 ? one : many);
  const stems = n => plural(n, 'stjälke', 'stjälkar');

  // ---------- ikoner (enkla gränssnittsikoner, inga illustrationer) ----------
  const P = { plus: 'M12 5v14M5 12h14', minus: 'M5 12h14', check: 'M5 12.5l4.5 4.5L19 7', search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4', chevd: 'M6 9l6 6 6-6', trash: 'M5 7h14M9 7V4.5h6V7M7 7l1 13h8l1-13',
    heart: 'M12 20.4s-7.4-4.5-7.4-10.1A4.2 4.2 0 0 1 12 7.8a4.2 4.2 0 0 1 7.4 2.5c0 5.6-7.4 10.1-7.4 10.1z', close: 'M6 6l12 12M18 6L6 18', pencil: 'M4 20h4L19.5 8.5l-4-4L4 16v4zM13.5 6.5l4 4', info: 'M12 11v5.5M12 7.6h.01M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17z' };
  const ic = (n, s, w, fill) => '<svg class="i" width="' + (s || 22) + '" height="' + (s || 22) + '" viewBox="0 0 24 24" fill="' + (fill ? 'currentColor' : 'none') + '" stroke="currentColor" stroke-width="' + (w || 1.6) + '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="' + P[n] + '"/></svg>';

  // ---------- tillstånd ----------
  // route: vilken vy. cur: senaste jobb och arrangemang (så att flikarna Bukett och Inköp vet vad du arbetar med). mode: på smal skärm, 'valj' (välj blommor) eller 'bukett'.
  // pk: blomvalet (vy, kategori, sökord, favoriter som just tagits bort och ligger kvar tills man lämnar vyn, om förklaringen visas). menu: vilken lista som är öppen.
  const freshPk = () => ({ view: F.count() ? 'fav' : 'cat', cat: 'rosor', q: '', ghost: new Set(), about: false });
  const S = { route: { name: 'hem' }, cur: { ev: null, arr: null }, mode: 'bukett', menu: null, receipt: false, own: false, confirm: false, rename: false, invalid: null, toast: null, fresh: new Set(), before: new Set(), pk: freshPk() };
  let memo = null;
  const dirty = () => { memo = null; };
  const cur = () => memo || (memo = { J: S.route.ev ? E.job(S.route.ev) : null, A: S.route.name === 'bukett' && S.route.arr ? E.arrangement(S.route.ev, S.route.arr) : null });

  // ---------- adress och navigering ----------
  function parseHash() {
    const h = (location.hash || '').replace(/^#\/?/, '').split('/');
    if (h[0] === 'inkop') return { name: 'inkop', ev: h[1] && E.job(h[1]) ? h[1] : null };
    if (h[0] === 'bukett' || h[0] === 'jobb') {
      if (h[1] === 'ny') return { name: 'bukett', ev: null, arr: null };
      const j = h[1] && E.job(h[1]);
      if (j) { const a = j.arrangements.find(x => x.id === h[2]) || j.arrangements[0]; return { name: 'bukett', ev: j.id, arr: a ? a.id : null }; }
    }
    return { name: 'hem' };
  }
  const hashOf = r => (r.name === 'hem' ? '#/hem' : r.name === 'inkop' ? '#/inkop/' + (r.ev || '') : (r.ev ? '#/bukett/' + r.ev + '/' + (r.arr || '') : '#/bukett/ny'));
  const hist = fn => { try { fn(); return true; } catch (e) { return false; } };   // inbäddad sida utan historik: allt fungerar ändå
  const syncUrl = () => hist(() => history.replaceState(history.state, '', hashOf(S.route)));
  const latest = () => E.jobs()[0] || null;
  function setRoute(route, o) {
    o = o || {};
    const enteringBuilder = route.name === 'bukett' && (S.route.name !== 'bukett' || route.ev !== S.route.ev);
    S.route = route; if (route.ev) S.cur = { ev: route.ev, arr: route.arr || null };
    S.menu = null; S.receipt = false; S.own = false; S.confirm = false; S.rename = false; S.invalid = null; S.toast = null; dirty();
    if (enteringBuilder) S.pk = freshPk();
    if (o.mode) S.mode = o.mode;
    if (!o.noPush) hist(() => { if (o.replace) history.replaceState(null, '', hashOf(route)); else history.pushState(null, '', hashOf(route)); });
    render();
  }
  function openBuilder(ev, arr, mode) {
    const j = ev ? E.job(ev) : null, a = arr || (j && j.arrangements[0] ? j.arrangements[0].id : null);
    setRoute({ name: 'bukett', ev: j ? j.id : null, arr: a }, { mode });
  }
  const goHem = () => setRoute({ name: 'hem' });
  const goBukett = () => { if (S.cur.ev && E.job(S.cur.ev)) return openBuilder(S.cur.ev, S.cur.arr, S.mode); const j = latest(); if (j) openBuilder(j.id, null, 'bukett'); else openBuilder(null, null, 'valj'); };
  const goInkop = () => { const ev = (S.cur.ev && E.job(S.cur.ev)) ? S.cur.ev : (latest() || {}).id; if (ev) setRoute({ name: 'inkop', ev }); };
  window.addEventListener('popstate', () => { S.route = parseHash(); if (S.route.ev) S.cur = { ev: S.route.ev, arr: S.route.arr || null }; S.menu = null; S.toast = null; dirty(); render(); });

  // ---------- små byggstenar ----------
  const mark = m => (m === '✓' ? '<span class="mk ok" aria-hidden="true">✓</span><span class="sr">Bekräftat pris </span>' : m ? '<span class="mk ap" aria-hidden="true">≈</span><span class="sr">Ungefärligt pris </span>' : '');
  const composeBar = c => (c.length ? '<span class="compo" aria-hidden="true">' + c.map(x => '<i style="flex:' + x.n + ';background:' + x.color + '" title="' + esc(x.n + ' ' + x.name) + '"></i>').join('') + '</span>' : '');
  const legend = c => (c.length ? '<div class="legend">' + c.map(x => '<span><i style="background:' + x.color + '"></i><b>' + x.n + '</b> ' + esc(x.name) + '</span>').join('') + '</div>' : '');
  const stemsLine = c => { const n = c.reduce((s, x) => s + x.n, 0); return stems(n) + ' · ' + plural(c.length, 'sort', 'sorter'); };
  function stepper(o) {   // o: { act, id, value, name, removeAtOne, fk, stems }
    const trash = o.removeAtOne && o.value <= 1;
    return '<div class="stp" role="group" aria-label="' + (o.stems ? 'Antal stjälkar ' : 'Antal ') + esc(o.name) + '">'
      + '<button type="button" data-act="' + o.act + '-dec" data-id="' + esc(o.id) + '" data-fk="' + o.fk + ':dec" aria-label="' + (trash ? 'Ta bort ' : o.stems ? 'Färre stjälkar ' : 'Färre ') + esc(o.name) + '"' + (!trash && o.value <= 1 ? ' disabled' : '') + '>' + ic(trash ? 'trash' : 'minus', 20, 1.7) + '</button>'
      + '<output>' + o.value + '</output>'
      + '<button type="button" data-act="' + o.act + '-inc" data-id="' + esc(o.id) + '" data-fk="' + o.fk + ':inc" aria-label="' + (o.stems ? 'Fler stjälkar ' : 'Fler ') + esc(o.name) + '">' + ic('plus', 20, 1.7) + '</button></div>';
  }
  const priceOf = a => (a && a.state === 'ok' ? mark(a.mark) + esc(a.price) : '');

  // ---------- ram ----------
  const NAV = [['hem', 'Hem'], ['bukett', 'Bukett'], ['inkop', 'Inköp']];
  const topHtml = () => '<header class="top"><a class="brand" href="#/hem" data-act="nav-hem" aria-label="Buketträknaren, till Hem"><span class="mono" aria-hidden="true">B</span><span class="brand-t">Buketträknaren</span></a>'
    + '<nav class="nav" aria-label="Huvudmeny">' + NAV.map(([id, t]) => '<button type="button" data-act="nav-' + id + '" data-fk="nav:' + id + '"' + (S.route.name === id ? ' aria-current="page"' : '') + '>' + t + '</button>').join('') + '</nav>'
    + '<span class="proto">Prototyp</span></header>';
  function toastHtml() { const t = S.toast; return t ? '<div class="toast" role="status"><span>' + esc(t.text) + '</span>' + (t.action ? '<button type="button" data-act="toast-action">' + esc(t.action.label) + '</button>' : '') + '</div>' : ''; }
  let toastT, toastFn = null;
  function toast(text, action) {
    S.toast = { text, action }; toastFn = action ? action.fn : null; setHtml('#toast-slot', toastHtml());
    clearTimeout(toastT); toastT = setTimeout(() => { S.toast = null; toastFn = null; setHtml('#toast-slot', ''); }, action ? 6000 : 3500);
  }

  // ---------- HEM ----------
  function homeHtml() {
    const jobs = E.jobs(), pl = E.priceListStatus();
    const oldTxt = pl.old.map(o => o.name + ' ' + o.days + ' d').join(', ');
    return '<main class="screen" id="main" tabindex="-1"><div class="scroll" data-scroll="hem"><div class="wrap">'
      + '<div class="home-head"><p class="eyebrow">Torsdag 8 oktober</p><button type="button" class="btn" data-act="new" data-fk="new">Ny bukett</button></div>'
      + '<h1 class="sec">Senaste arbeten</h1><ul class="jobs">' + jobs.map(j => {
        const n = j.composition.reduce((s, x) => s + x.n, 0);
        const price = j.price.kind === 'ok' ? '<span class="price num">' + mark(j.price.mark) + esc(j.price.text) + ' <small>' + j.price.basis + '</small></span>' : '<span class="price"><small>' + esc(j.price.text) + '</small></span>';
        return '<li><button type="button" class="job" data-act="open-job" data-id="' + j.id + '" data-fk="job:' + j.id + '"><span class="nm">' + esc(j.name) + '</span>'
          + '<span class="meta">' + esc([j.customer, j.type, j.date].filter(Boolean).join(' · ')) + (n ? ' · ' + stems(n) + ', ' + plural(j.composition.length, 'sort', 'sorter') : '') + '</span>' + price + composeBar(j.composition) + '</button></li>';
      }).join('') + '</ul>'
      + '<p class="note"><b>Prislista:</b> ' + pl.today + ' av ' + pl.total + ' priser är från i dag' + (pl.old.length ? ', <span class="warn">' + pl.old.length + ' äldre</span> (' + esc(oldTxt) + ') och räknas som ungefärliga ≈' : '') + '. Prototyp med påhittad data: inget sparas utom favoriter.</p>'
      + '</div></div></main>';
  }

  // ---------- BUKETT ----------
  function barHtml() {
    const { A } = cur(), has = !!(A && A.items.length), n = A ? A.sorts : 0;
    const who = esc(A ? A.name : 'Ny bukett') + (A && A.state === 'ok' ? ' · ' + A.basis : '');
    const price = A && A.state === 'ok' ? '<b class="num">' + mark(A.mark) + esc(A.price) + '</b>'
      : has ? '<span>Pris saknas för någon artikel</span>' : '<span>Välj blommor så räknas priset</span>';
    const go = S.mode === 'valj' ? '<button type="button" class="btn bar-go" data-act="go-bq" data-fk="go-bq"' + (has ? '' : ' disabled') + '>Visa min bukett' + (n ? ' (' + n + ')' : '') + '</button>'
      : '<button type="button" class="btn bar-go" data-act="go-pk" data-fk="go-pk">Lägg till blommor</button>';
    return '<div class="bar-p"><div class="bar-who">' + who + '</div><div class="bar-price">' + price + '</div>'
      + (has ? '<div class="bar-sub">' + plural(n, 'sort', 'sorter') + ' · ' + stems(A.stems) + '</div>' : '') + '</div>'
      + '<div class="bar-links"><button type="button" class="link" data-act="nav-inkop" data-fk="bar-inkop">Inköp för jobbet</button></div>' + go;
  }
  function jobPaneHtml() {
    const { J, A } = cur();
    const arrs = J ? J.arrangements : [];
    const total = J && J.price.kind === 'ok' ? '<div class="jobtotal"><p class="eyebrow">Kundpris för hela jobbet</p><div class="price num">' + mark(J.price.mark) + esc(J.price.text) + '</div><p>' + J.price.basis + (J.kind === 'BUSINESS' ? '' : ' · varav moms ' + esc(J.vat)) + '</p><button type="button" class="link" data-act="nav-inkop" data-fk="job-inkop">Inköp för jobbet</button></div>' : '';
    return '<div class="scroll jobp" data-scroll="job"><p class="eyebrow">Kundjobb</p><h2>' + esc(J ? J.name : 'Ny bukett') + '</h2>'
      + '<p class="muted">' + esc(J ? [J.customer, J.type, J.date].filter(Boolean).join(' · ') : 'Jobbet skapas när du lägger till den första blomman.') + '</p>'
      + (J ? '<ul class="arrs" aria-label="Arrangemang">' + arrs.map(a => '<li><button type="button" data-act="arr" data-id="' + a.id + '" data-fk="arr:' + a.id + '"' + (A && a.id === A.id ? ' aria-current="true"' : '') + '><span class="nm">' + esc(a.name) + (a.qty > 1 ? ' ×' + a.qty : '') + '</span><span class="pr">'
        + (a.state === 'ok' ? mark(a.mark) + esc(a.unit) + (a.total ? ' × ' + a.qty + ' = ' + mark(a.mark) + esc(a.total) : '') : 'Tomt') + '</span></button></li>').join('')
        + '<li><button type="button" class="add" data-act="add-arr" data-fk="add-arr">' + ic('plus', 18, 1.8) + 'Nytt arrangemang</button></li></ul>' : '') + total + '</div>';
  }
  function bqHtml() {
    const { J, A } = cur(), single = !SPLIT.matches;
    const arrs = J ? J.arrangements : [], me = A && arrs.find(a => a.id === A.id);
    const name = A ? A.name : 'Ny bukett', has = !!(A && A.items.length);
    let h = '<div class="bq"><p class="eyebrow">' + esc(J ? J.name : 'Ny bukett') + '</p>';
    h += '<div class="bq-t"><h1 class="bq-title" id="bq-h">' + esc(name) + '</h1>' + (A && !S.rename ? '<button type="button" class="icon-btn" data-act="rename" data-fk="rename" aria-label="Byt namn på ' + esc(name) + '">' + ic('pencil', 20, 1.6) + '</button>' : '') + '</div>';
    if (A && S.rename) h += '<form class="renameform" id="renameform" novalidate><label class="sr" for="arr-name">Namn på arrangemanget</label><input id="arr-name" value="' + esc(name) + '" autocomplete="off" data-fk="arr-name"><button class="btn" type="button" data-act="rename-save" data-fk="rename-save">Spara</button><button class="btn btn--ghost" type="button" data-act="rename-cancel">Avbryt</button></form>';
    if (has && A.composition.length) h += '<div class="compo-line">' + composeBar(A.composition) + '</div>';
    if (J && arrs.length > 1) {
      const cn = arrs.findIndex(a => A && a.id === A.id) + 1;
      h += '<div class="arrsel"><button type="button" class="selbtn" data-act="menu-arr" data-fk="menu-arr" aria-expanded="' + (S.menu === 'arr') + '"><span class="l">Arrangemang</span><span class="v">' + cn + ' av ' + arrs.length + '</span><span class="n">Byt</span>' + ic('chevd', 18, 1.8) + '</button>';
      if (S.menu === 'arr') h += '<div class="menu">' + arrs.map(a => '<button type="button" data-act="arr" data-id="' + a.id + '" data-fk="marr:' + a.id + '"' + (A && a.id === A.id ? ' aria-current="true"' : '') + '><span class="nm">' + esc(a.name) + (a.qty > 1 ? ' ×' + a.qty : '') + '</span><span class="pr">' + (a.state === 'ok' ? mark(a.mark) + esc(a.unit) : 'Tomt') + '</span></button>').join('')
        + '<button type="button" data-act="add-arr" data-fk="marr:add"><span class="nm add">Nytt arrangemang</span>' + ic('plus', 18, 1.8) + '</button></div>';
      h += '</div>';
    }
    h += '<div class="bq-h"><h2>Ingår</h2><span>Antal stjälkar</span></div>';
    if (!has) {
      h += '<div class="empty-bq">Inga blommor valda än.' + (single ? '<br><button type="button" class="btn" data-act="go-pk" data-fk="empty-go">Välj blommor</button>' : ' Välj blommor i listan bredvid.') + '</div>';
    } else {
      h += '<ul>' + A.items.map(it => {
        const fresh = S.fresh.has(it.id) ? ' fresh' : '';
        if (!it.supplier) return '<li class="row' + fresh + '"><span class="nm">' + (it.color ? '<i class="sw" style="background:' + it.color + '"></i>' : '') + esc(it.name) + '<span class="tag">' + it.tag + '</span></span><span class="l2">' + esc(it.packText) + '</span>'
          + stepper({ act: 'item', id: it.id, value: it.qty, name: it.name, removeAtOne: true, fk: 'it:' + it.id }) + '</li>';
        return '<li class="row' + fresh + '"><span class="nm"><i class="sw" style="background:' + it.color + '"></i>' + esc(it.name) + '</span>' + (it.buy ? '<span class="buy">' + esc(it.buy) + '</span>' : '')
          + '<span class="l2"><b class="u">' + esc(it.unit) + '</b> · ' + esc(it.desc) + (it.old ? ' <span class="warn">≈ äldre pris</span>' : '') + '</span>'
          + stepper({ act: 'item', id: it.id, value: it.qty, name: it.name, removeAtOne: true, fk: 'it:' + it.id, stems: true }) + '</li>';
      }).join('')
        + '<li class="row"><span class="nm">Antal likadana</span><span class="l2">' + (A.qty > 1 && me && me.total ? 'Totalt <b class="num">' + mark(A.mark) + esc(me.total) + '</b>' : 'Hur många av samma arrangemang') + '</span>' + stepper({ act: 'cnt', id: 'x', value: A.qty, name: 'likadana arrangemang', removeAtOne: false, fk: 'cnt' }) + '</li>'
        + '<li class="row"><span class="nm">Arbete<span class="tag">Per arrangemang</span></span><span class="l2">kr exkl. moms. Lämna tomt om inget ska tas ut.</span><label class="amt"><input id="labor" inputmode="decimal" autocomplete="off" value="' + esc(A.labor) + '" aria-label="Arbete, kr exkl. moms"' + (S.invalid ? ' aria-invalid="true"' : '') + '><span>kr</span></label></li>'
        + '<li class="row row--add"><button type="button" class="addrow" data-act="own-toggle" data-fk="own-toggle" aria-expanded="' + S.own + '">' + ic(S.own ? 'minus' : 'plus', 18, 1.8) + '<span>Eget material<small>band, vas, kvistar från trädgården …</small></span></button>'
        + (S.own ? '<form class="ownform" id="ownform" novalidate><label>Namn<input name="n" autocomplete="off" placeholder="till exempel Band" required></label><label>Kalkylkostnad, kr<input name="c" inputmode="decimal" autocomplete="off" placeholder="40" required></label><button class="btn" type="button" data-act="own-add" data-fk="own-add">Lägg till</button></form>' : '') + '</li></ul>';
      if (J && J.price.kind === 'ok') h += '<p class="jobline">Hela jobbet <b class="num">' + mark(J.price.mark) + esc(J.price.text) + '</b> ' + J.price.basis + ' · <button type="button" class="link link--inline" data-act="nav-inkop" data-fk="bq-inkop">Inköp för jobbet</button></p>';
      if (A.state === 'ok') {
        h += '<button type="button" class="receipt-t" data-act="receipt" data-fk="receipt" aria-expanded="' + S.receipt + '"><span>Så räknades priset</span>' + ic('chevd', 18, 1.8) + '</button>';
        if (S.receipt) h += '<div class="rcp-wrap" id="receipt">' + receiptRows(A) + '</div>';
      }
    }
    if (A) h += '<div class="foot">' + (S.confirm ? '<div class="confirm"><span>Ta bort ' + esc(A.name) + (arrs.length <= 1 ? ' och jobbet' : '') + '?</span><button type="button" class="danger" data-act="del-yes" data-fk="del-yes">Ta bort</button><button type="button" class="link" data-act="del-no" data-fk="del-no">Avbryt</button></div>' : '<button type="button" class="danger" data-act="del" data-fk="del">Ta bort arrangemanget</button>') + '</div>';
    return h + '</div>';
  }
  const receiptRows = A => A.receipt.map(([k, v, c]) => '<div class="rcp ' + (c || '') + '"><span>' + k + '</span><span class="a">' + v + '</span></div>').join('');

  // ---------- blomvalet ----------
  const pkQ = () => S.pk.q.trim();
  const pkView = () => (pkQ() ? 'search' : S.pk.view);
  const pkCounts = A => { const m = {}; if (A) A.items.forEach(i => { if (i.flowerId) m[i.flowerId] = i.qty; }); return m; };
  const favFlowers = () => F.list().map(id => E.flower(id)).filter(Boolean).sort((a, b) => a.order - b.order);
  const catOf = id => E.categories().find(c => c.id === id);
  const viewName = v => (v === 'fav' ? 'Mina favoriter' : v === 'all' ? 'Alla blommor' : v === 'search' ? 'Sökresultat' : (catOf(S.pk.cat) || { name: 'Blommor' }).name);
  const viewCount = v => (v === 'fav' ? F.count() : v === 'all' ? E.flowers().length : v === 'search' ? E.search(pkQ()).length : (catOf(S.pk.cat) || { count: 0 }).count);
  function hl(name, q) {   // markerar träffen i namnet (diakritikokänsligt: "gipsort" träffar Gipsört)
    const raw = E.foldRaw(name), toks = E.fold(q).split(' ').filter(Boolean);
    if (!toks.length || raw.length !== name.length) return esc(name);
    const on = new Array(name.length).fill(false);
    for (const t of toks) { const i = raw.indexOf(t); if (i >= 0) for (let k = i; k < i + t.length; k++) on[k] = true; }
    let out = '', k = 0;
    while (k < name.length) { let j = k; while (j < name.length && on[j] === on[k]) j++; const part = esc(name.slice(k, j)); out += on[k] ? '<mark>' + part + '</mark>' : part; k = j; }
    return out;
  }
  function rowHtml(f, o) {   // o: { n (stjälkar i buketten), crumb, q }
    const on = o.n > 0, fav = F.has(f.id);
    return '<li class="pk-row' + (on ? ' on' : '') + '"><button type="button" class="pk-pick" role="checkbox" aria-checked="' + on + '" data-act="pk-toggle" data-id="' + f.id + '" data-fk="pk:' + f.id + '">'
      + '<span class="pk-chk" aria-hidden="true">' + (on ? ic('check', 16, 2.4) : '') + '</span>'
      + '<span class="pk-txt"><span class="pk-l1"><i class="sw" style="background:' + f.color + '"></i><span class="pk-nm">' + (o.q ? hl(f.name, o.q) : esc(f.name)) + '</span>'
      + (f.old ? '<span class="pk-old" title="Priset är ' + f.days + ' dagar gammalt">≈ ' + f.days + ' d sedan</span>' : '') + (on ? '<span class="pk-stems">' + stems(o.n) + '</span>' : '') + (o.crumb ? '<span class="pk-crumb">' + esc(f.catName) + '</span>' : '') + '</span>'
      + '<span class="pk-l2"><b class="u">' + esc(f.unit) + '</b><span class="d">' + esc(f.desc) + '</span></span></span></button>'
      + '<button type="button" class="pk-fav" aria-pressed="' + fav + '" aria-label="Favorit: ' + esc(f.name) + '" data-act="pk-fav" data-id="' + f.id + '" data-fk="fav:' + f.id + '">' + ic('heart', 22, 1.6, fav) + '</button></li>';
  }
  function listBody(list, o) {   // o: { counts, crumb, q, groupBy: 'cat' | 'grp' | null }
    let out = '', last = null;
    const keyOf = f => (o.groupBy === 'cat' ? f.cat : f.cat + '/' + f.grp);
    for (const f of list) {
      if (o.groupBy && keyOf(f) !== last) { last = keyOf(f); out += '<li class="pk-grp" role="presentation"><span>' + esc(o.groupBy === 'cat' ? f.catName : f.grpName) + '</span><span class="n">' + list.filter(x => keyOf(x) === last).length + '</span></li>'; }
      out += rowHtml(f, { n: o.counts[f.id] || 0, crumb: o.crumb, q: o.q });
    }
    return '<ul class="pk-list">' + out + '</ul>';
  }
  const noteHtml = () => '<p class="pk-note">Ett tryck lägger 1 stjälke i buketten. Antal ändrar du i bukettöversikten, där du också ser vad som köps hem i hela förpackningar. Styckpriset i parentes är räknat, inte grossistens pris. ≈ betyder att priset inte är från i dag.</p>';
  function aboutHtml() {
    const fl = F.florists(), cur0 = F.current();
    return '<section class="about" id="about" aria-labelledby="about-h"><h2 id="about-h" tabindex="-1">Så sparas favoriter i appen</h2><ul>'
      + '<li><b>En lista per florist.</b> Favoriterna hör till floristens eget konto, inte till butiken. Två florister i samma butik har varsin lista.</li>'
      + '<li><b>Följer med mellan enheter.</b> Listan ligger på kontot och syns på både telefon och dator. ' + (F.isPersisted() ? 'Här i prototypen sparas den bara i den här webbläsaren.' : 'Här i prototypen finns den bara medan sidan är öppen, eftersom webbläsaren inte tillåter lagring här.') + '</li>'
      + '<li><b>Pekar på artikeln, inte på en kopia.</b> Pris, enhet och förpackning hämtas alltid ur prislistan, så en favorit blir aldrig fel när priset ändras.</li></ul>'
      + '<p class="h">Prova i prototypen</p><div class="demo"><span class="lbl" id="fl-l">Visa som</span><div class="seg" role="group" aria-labelledby="fl-l">'
      + fl.map(f => '<button type="button" data-act="pk-florist" data-id="' + f.id + '" data-fk="florist:' + f.id + '" aria-pressed="' + (f.id === cur0) + '">' + esc(f.name) + '</button>').join('') + '</div>'
      + '<button type="button" class="link" data-act="pk-fav-reset" data-fk="fav-reset">Återställ</button><button type="button" class="link" data-act="pk-fav-clear" data-fk="fav-clear">Töm listan</button></div>'
      + '<p class="h">Så kan en favorit sparas</p><pre>{ florist: "' + cur0 + '",\n  favoriter: [\n    { grossist: "conn_manual",\n      artikel: "p04",\n      tillagd: "2026-10-08" } ] }</pre></section>';
  }
  function pkViewHtml() {   // en lista på smal skärm, knappar på bred skärm
    const v = pkView(), cats = E.categories(), favN = F.count();
    const name = v === 'fav' ? '<span class="hrt">' + ic('heart', 18, 1.6, true) + '</span>Mina favoriter' : esc(viewName(v));
    const chip = (id, label, n, pressed, heart) => '<button type="button" class="chip" data-act="pk-open" data-id="' + id + '" data-fk="chip:' + id + '" aria-pressed="' + pressed + '">' + (heart ? '<span class="hrt">' + ic('heart', 16, 1.6, true) + '</span>' : '') + esc(label) + ' <span class="n">' + n + '</span></button>';
    return '<button type="button" class="selbtn selbtn-view" data-act="view-menu" data-fk="view-menu" aria-expanded="' + (S.menu === 'view') + '"' + (v === 'search' ? ' disabled' : '') + '><span class="l">Visa</span><span class="v">' + name + '</span><span class="n">' + viewCount(v) + '</span>' + ic('chevd', 18, 1.8) + '</button>'
      + '<div class="chips" role="group" aria-label="Visa">' + chip('fav', 'Favoriter', favN, v === 'fav', true) + cats.map(c => chip(c.id, c.name, c.count, v === 'cat' && S.pk.cat === c.id)).join('') + chip('all', 'Alla', E.flowers().length, v === 'all') + '</div>';
  }
  function pkListHtml() {
    const v = pkView(), { A } = cur(), counts = pkCounts(A), q = pkQ();
    if (S.menu === 'view' && v !== 'search') {
      const cats = E.categories(), t = (id, label, n, on, heart) => '<li><button type="button" class="tile" data-act="pk-open" data-id="' + id + '" data-fk="tile:' + id + '"' + (on ? ' aria-current="true"' : '') + '><span class="nm">' + (heart ? '<span class="hrt">' + ic('heart', 16, 1.6, true) + '</span>' : '') + esc(label) + '</span><span class="ct">' + n + '</span></button></li>';
      return '<ul class="tiles">' + t('fav', 'Mina favoriter', F.count(), v === 'fav', true) + cats.map(c => t(c.id, c.name, c.count, v === 'cat' && S.pk.cat === c.id)).join('') + t('all', 'Alla blommor', E.flowers().length, v === 'all') + '</ul>';
    }
    if (v === 'search') { const r = E.search(q); return r.length ? listBody(r, { counts, crumb: true, q }) + noteHtml() : '<p class="pk-empty">Ingen blomma matchar “' + esc(q) + '”. Försök med ett kortare ord eller ett annat namn. Sökningen gäller hela sortimentet.</p>'; }
    if (v === 'fav') {
      const ids = new Set([...F.list(), ...S.pk.ghost]), list = E.flowers().filter(f => ids.has(f.id));
      return (list.length ? listBody(list, { counts, crumb: false, q: '' }) + noteHtml() : '<p class="pk-empty">Du har inga favoriter än. Tryck på ' + ic('heart', 18, 1.6) + ' vid en blomma i en kategori, så sparas den här.</p>')
        + '<button type="button" class="link pk-more" data-act="pk-about" data-fk="pk-about" aria-expanded="' + S.pk.about + '" aria-controls="about">' + ic('info', 16, 1.6) + 'Så sparas favoriter</button>' + (S.pk.about ? aboutHtml() : '');
    }
    if (v === 'all') return listBody(E.flowers(), { counts, groupBy: 'cat', q: '' }) + noteHtml();
    const c = catOf(S.pk.cat), grouped = c.count >= 8 && c.groups.filter(g => g.count).length > 1;
    return listBody(E.inCategory(S.pk.cat), { counts, groupBy: grouped ? 'grp' : null, q: '' }) + noteHtml();
  }
  function pkHtml() {
    return '<div class="pk-top"><div class="search">' + ic('search', 20, 1.6) + '<label class="sr" for="pk-q">Sök i hela sortimentet</label><input id="pk-q" type="search" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="search" placeholder="Sök i hela sortimentet" value="' + esc(S.pk.q) + '" data-fk="pk-q">'
      + '<button type="button" class="clr" data-act="pk-clear" data-fk="pk-clear" aria-label="Rensa sökningen"' + (pkQ() ? '' : ' hidden') + '>' + ic('close', 18, 1.8) + '</button></div><div id="pk-view">' + pkViewHtml() + '</div></div>'
      + '<div class="scroll pk-scroll" id="pk-scroll" data-scroll="pk">' + pkListHtml() + '</div>';
  }
  function builderHtml() {
    return '<main class="screen bld" id="main" tabindex="-1" data-mode="' + S.mode + '"><div class="panes">'
      + '<section class="pane pane-job" id="pane-job" aria-label="Kundjobb">' + jobPaneHtml() + '</section>'
      + '<section class="pane pane-bq" id="pane-bq" aria-label="Min bukett"><div class="scroll" id="bq-scroll" data-scroll="bq">' + bqHtml() + '</div></section>'
      + '<section class="pane pane-pk" id="pane-pk" aria-label="Välj blommor">' + pkHtml() + '</section></div>'
      + '<div class="bar" id="bar">' + barHtml() + '</div></main>';
  }

  // ---------- INKÖP ----------
  function inkopHtml() {
    const J = E.job(S.route.ev), Pu = E.purchase(S.route.ev), jobs = E.jobs();
    const rows = Pu.rows.map(r => '<li class="ik-row"><span class="nm"><i class="sw" style="background:' + r.color + '"></i>' + esc(r.name) + '</span>'
      + (r.hasPrice ? '<span class="ik-cost num">' + esc(r.cost) + '</span>' : '') + '<span class="sub"><b class="u">' + esc(r.unit) + '</b> · ' + esc(r.desc) + '</span>'
      + (r.hasPrice ? '<span class="ik-num"><span>Behövs <b>' + stems(r.needed) + '</b></span><span>Köper <b>' + esc(r.buy) + '</b></span><span class="' + (r.leftover > 0 ? 'over' : '') + '">Över <b>' + r.leftover + ' st</b></span></span>' : '<span class="ik-num"><span>Behövs <b>' + stems(r.needed) + '</b></span><span class="warn">Pris saknas</span></span>') + '</li>').join('');
    const pick = '<button type="button" class="selbtn" data-act="menu-job" data-fk="menu-job" aria-expanded="' + (S.menu === 'job') + '"><span class="l">Jobb</span><span class="v">' + esc(J.name) + '</span>' + ic('chevd', 18, 1.8) + '</button>'
      + (S.menu === 'job' ? '<div class="menu">' + jobs.map(j => '<button type="button" data-act="pick-job" data-id="' + j.id + '" data-fk="pj:' + j.id + '"' + (j.id === J.id ? ' aria-current="true"' : '') + '><span class="nm">' + esc(j.name) + '</span><span class="pr">' + (j.price.kind === 'ok' ? mark(j.price.mark) + esc(j.price.text) : '') + '</span></button>').join('') + '</div>' : '');
    return '<main class="screen" id="main" tabindex="-1"><div class="scroll" data-scroll="ik"><div class="wrap">' + pick + '<h1 class="sr">Inköp för jobbet</h1><p class="ik-lede">Inköp för jobbet. Du köper hela förpackningar, och det som blir över ingår i kundpriset.</p>'
      + (rows ? '<ul class="ik">' + rows + '</ul>' : '<p class="empty-bq">Inget att köpa än. Lägg till blommor i ett arrangemang så visas inköpet här.</p>')
      + (rows ? '<p class="ik-note">Blir över: ' + stems(Pu.leftoverStems) + ', värde ' + esc(Pu.leftoverValue) + '. ' + (Pu.wholePacks ? 'Det ingår i kundpriset, eftersom hela förpackningen debiteras.' : 'Det tas inte ut i kundpriset.') + '</p>' : '')
      + (Pu.notOrdered.length ? '<p class="ik-note">Beställs inte (eget lager och egen trädgård): ' + Pu.notOrdered.map(esc).join(', ') + '.</p>' : '') + '</div></div>'
      + '<div class="bar ik-bar"><div class="bar-p"><div class="bar-who">Summa inköp, exkl. moms</div><div class="bar-price"><b class="num">' + esc(Pu.sum) + '</b></div></div><button type="button" class="btn bar-go" data-act="nav-bukett" data-fk="ik-bq">Till bukett</button></div></main>';
  }

  // ---------- ritning ----------
  const setHtml = (sel, html) => { const e = $(sel); if (e) e.innerHTML = html; };
  function render(focusKey) {
    const sc = {}; $$('[data-scroll]').forEach(e => { sc[e.dataset.scroll] = e.scrollTop; });
    const ae = document.activeElement, fk = focusKey || (ae && ae.dataset ? ae.dataset.fk : null);
    dirty();
    document.body.dataset.screen = S.route.name;
    const body = S.route.name === 'hem' ? homeHtml() : S.route.name === 'inkop' ? inkopHtml() : builderHtml();
    $('#app').innerHTML = topHtml() + body + '<div class="toast-slot" id="toast-slot">' + toastHtml() + '</div>';
    $$('[data-scroll]').forEach(e => { if (sc[e.dataset.scroll] != null) e.scrollTop = sc[e.dataset.scroll]; });
    if (fk) { const t = $('[data-fk="' + fk.replace(/"/g, '') + '"]'); if (t && !t.disabled && t.offsetParent !== null) t.focus({ preventScroll: true }); }
    document.title = (S.route.name === 'hem' ? 'Hem' : S.route.name === 'inkop' ? 'Inköp' : 'Bukett') + ' – Buketträknaren · Maison Studio (prototyp)';
  }
  /** Ritar om bara de delar som ändras. Sökfältet och rullningslistorna rörs aldrig, så markör och rullning blir kvar. */
  function refresh(parts) {
    dirty();
    const ae = document.activeElement, fk = ae && ae.dataset && $('#app').contains(ae) ? ae.dataset.fk : null;
    for (const p of parts) {
      if (p === 'bar') setHtml('#bar', barHtml());
      else if (p === 'bq') setHtml('#bq-scroll', bqHtml());
      else if (p === 'job') setHtml('#pane-job', jobPaneHtml());
      else if (p === 'pk') { setHtml('#pk-view', pkViewHtml()); setHtml('#pk-scroll', pkListHtml()); const i = $('#pk-q'), c = $('.search .clr'); if (i && i.value !== S.pk.q) i.value = S.pk.q; if (c) c.hidden = !pkQ(); }
    }
    if (fk && fk !== 'pk-q') { const t = $('[data-fk="' + fk.replace(/"/g, '') + '"]'); if (t && !t.disabled && t.offsetParent !== null) t.focus({ preventScroll: true }); }
  }
  const refreshWork = () => refresh(['bq', 'bar', 'job', 'pk']);
  let live; function announce(t) { if (!live) live = $('#live'); if (!live) return; live.textContent = ''; setTimeout(() => { live.textContent = t; }, 30); }

  // ---------- arbete i buketten ----------
  function ensureArr() {
    if (S.route.arr) return S.route.arr;
    const d = E.draft(); S.route = { name: 'bukett', ev: d.eventId, arr: d.arrId }; S.cur = { ev: d.eventId, arr: d.arrId }; dirty(); syncUrl(); return d.arrId;
  }
  function setMode(m) {
    const { A } = cur();
    if (m === 'valj') { S.before = new Set(A ? A.items.map(i => i.id) : []); S.fresh = new Set(); }
    else { S.fresh = new Set((A ? A.items.map(i => i.id) : []).filter(id => !S.before.has(id))); }
    S.mode = m; S.menu = null; $('.bld').dataset.mode = m; refresh(['bq', 'bar', 'pk']);
    if (m === 'bukett') { const f = $('.row.fresh'); if (f) f.scrollIntoView({ block: 'nearest' }); setTimeout(() => { S.fresh = new Set(); $$('.row.fresh').forEach(e => e.classList.remove('fresh')); }, 2600); }
    announce(m === 'valj' ? 'Välj blommor' : 'Min bukett');
  }
  function toggleFlower(id) {
    const f = E.flower(id); if (!f) return;
    let { A } = cur(); const item = A && A.items.find(i => i.flowerId === id);
    if (item) {
      const arr = A.id, qty = item.qty; E.removeItem(item.id); dirty();
      toast(f.name + ' borttagen', { label: 'Ångra', fn: () => { E.restoreFlower(arr, id, qty); refreshWork(); announce(f.name + ' tillbaka'); } });
    } else {
      E.addFlower(ensureArr(), id); dirty();
      if (SPLIT.matches) { const nA = cur().A, it = nA && nA.items.find(i => i.flowerId === id); if (it) { S.fresh = new Set([it.id]); setTimeout(() => { S.fresh = new Set(); $$('.row.fresh').forEach(e => e.classList.remove('fresh')); }, 2600); } }
    }
    refreshWork(); A = cur().A;
    announce(f.name + (item ? ' borttagen' : ' vald') + '. ' + plural(A ? A.sorts : 0, 'sort vald', 'sorter valda'));
  }
  function toggleFav(id) {
    const f = E.flower(id); if (!f) return;
    const was = F.has(id), now = F.toggle(id);
    if (was && pkView() === 'fav') S.pk.ghost.add(id); else S.pk.ghost.delete(id);
    refresh(['pk']); announce(f.name + (now ? ' sparad i favoriter' : ' borttagen från favoriter'));
  }
  function openView(id) {   // id: 'fav', 'all' eller en kategori
    S.pk.ghost.clear(); S.pk.q = ''; S.pk.about = false; S.menu = null;
    if (id === 'fav' || id === 'all') S.pk.view = id; else { S.pk.view = 'cat'; S.pk.cat = id; }
    refresh(['pk']); const sc = $('#pk-scroll'); if (sc) sc.scrollTop = 0; announce(viewName(S.pk.view));
  }

  // ---------- händelser ----------
  const attempt = fn => { try { fn(); return true; } catch (e) { toast(String(e && e.message || e).replace(/^Error: /, '')); return false; } };
  function onClick(e) {
    const t = e.target.closest('[data-act]'); if (!t || t.disabled) return;
    const act = t.dataset.act, id = t.dataset.id, { A } = cur();
    if (act === 'toast-action') { const fn = toastFn; S.toast = null; toastFn = null; setHtml('#toast-slot', ''); if (fn) fn(); return; }
    if (act === 'nav-hem') { e.preventDefault(); return goHem(); }
    if (act === 'nav-bukett') return S.route.name === 'bukett' ? undefined : goBukett();
    if (act === 'nav-inkop') return goInkop();
    if (act === 'new') return openBuilder(null, null, 'valj');
    if (act === 'open-job') return openBuilder(id, null, 'bukett');
    if (act === 'arr') { S.menu = null; return setRoute({ name: 'bukett', ev: S.route.ev, arr: id }, { mode: S.mode }); }
    if (act === 'add-arr') { const a = E.addArrangement(S.route.ev, 'Nytt arrangemang'); S.pk = freshPk(); setRoute({ name: 'bukett', ev: S.route.ev, arr: a }, { mode: 'valj' }); return; }
    if (act === 'pick-job') { S.menu = null; return setRoute({ name: 'inkop', ev: id }); }
    if (act === 'menu-arr' || act === 'menu-job') { S.menu = S.menu === (act === 'menu-arr' ? 'arr' : 'job') ? null : (act === 'menu-arr' ? 'arr' : 'job'); return S.route.name === 'inkop' ? render('menu-job') : refresh(['bq']); }
    if (act === 'go-bq') return setMode('bukett');
    if (act === 'go-pk') return setMode('valj');
    if (act === 'view-menu') { S.menu = S.menu === 'view' ? null : 'view'; refresh(['pk']); const sc = $('#pk-scroll'); if (sc) sc.scrollTop = 0; return; }
    if (act === 'pk-open') return openView(id);
    if (act === 'pk-toggle') return toggleFlower(id);
    if (act === 'pk-fav') return toggleFav(id);
    if (act === 'pk-clear') { S.pk.q = ''; refresh(['pk']); const i = $('#pk-q'); if (i) i.focus({ preventScroll: true }); return; }
    if (act === 'pk-about') { S.pk.about = !S.pk.about; refresh(['pk']); if (S.pk.about) { const h = $('#about-h'); if (h) { h.focus({ preventScroll: true }); h.scrollIntoView({ block: 'nearest' }); } } return; }
    if (act === 'pk-florist') { F.setCurrent(id); S.pk.ghost.clear(); refresh(['pk']); return announce('Visar ' + F.currentName() + 's favoriter'); }
    if (act === 'pk-fav-clear') { F.clear(); S.pk.ghost.clear(); return refresh(['pk']); }
    if (act === 'pk-fav-reset') { F.reset(); S.pk.ghost.clear(); return refresh(['pk']); }
    if (act === 'receipt') { S.receipt = !S.receipt; return refresh(['bq']); }
    if (act === 'rename') { S.rename = true; refresh(['bq']); const i = $('#arr-name'); if (i) { i.focus(); i.select(); } return; }
    if (act === 'rename-cancel') { S.rename = false; return refresh(['bq']); }
    if (act === 'rename-save') return doRename();
    if (act === 'own-add') return doOwn();
    if (act === 'own-toggle') { S.own = !S.own; refresh(['bq']); if (S.own) { const f = $('#ownform input'); if (f) f.focus(); } return; }
    if (act === 'del') { S.confirm = true; refresh(['bq']); return; }
    if (act === 'del-no') { S.confirm = false; return refresh(['bq']); }
    if (act === 'del-yes') { const j0 = E.job(S.route.ev); if (j0 && j0.arrangements.length <= 1) E.removeJob(S.route.ev); else E.removeArrangement(S.route.arr); S.confirm = false; const j = E.job(S.route.ev); if (j && j.arrangements.length) return setRoute({ name: 'bukett', ev: j.id, arr: j.arrangements[0].id }, { mode: 'bukett' }); S.cur = { ev: null, arr: null }; return goHem(); }
    if (act === 'item-dec') { const item = A.items.find(i => i.id === id); if (!item) return; if (item.qty <= 1) E.removeItem(item.id); else E.setQty(item.id, item.qty - 1); return refreshWork(); }
    if (act === 'item-inc') { const item = A.items.find(i => i.id === id); E.setQty(item.id, item.qty + 1); return refreshWork(); }
    if (act === 'cnt-dec' || act === 'cnt-inc') { E.setCount(S.route.arr, A.qty + (act === 'cnt-inc' ? 1 : -1)); return refreshWork(); }
  }
  let searchT;
  function onInput(e) {
    const t = e.target;
    if (t.id === 'pk-q') {
      S.pk.q = t.value; S.pk.ghost.clear(); S.menu = null; refresh(['pk']); const sc = $('#pk-scroll'); if (sc) sc.scrollTop = 0;
      clearTimeout(searchT); searchT = setTimeout(() => { if (pkQ()) announce(plural(E.search(pkQ()).length, 'träff', 'träffar')); }, 400);
      return;
    }
    if (t.id === 'labor') {
      const { A } = cur(); if (!A) return;
      const ok = attempt(() => E.setLabor(A.id, t.value)); S.invalid = ok ? null : true; t.setAttribute('aria-invalid', ok ? 'false' : 'true');
      if (ok) { dirty(); refresh(['bar', 'job']); const r = $('#receipt'); if (r && cur().A.state === 'ok') r.innerHTML = receiptRows(cur().A); }
    }
  }
  // Spara och Lägg till är vanliga knappar (inte submit) och Enter hanteras här: i en inbäddad sida utan tillstånd att skicka formulär
  // (sandlåda) skickas aldrig submit, så ingenting får bero på att ett formulär skickas.
  function doRename() { const { A } = cur(); const i = $('#arr-name'); if (A && i) E.rename(A.id, i.value); S.rename = false; refreshWork(); const b = $('[data-fk="rename"]'); if (b) b.focus({ preventScroll: true }); }
  function doOwn() {
    const f = $('#ownform'); if (!f) return;
    const n = f.n.value.trim(), c = f.c.value.replace(/[\s ]/g, '').replace(',', '.');
    if (!n || !/^\d{1,9}(\.\d{1,2})?$/.test(c)) { toast('Skriv ett namn och en kalkylkostnad i kronor, till exempel 40 eller 62,50.'); return; }
    E.addOwn(ensureArr(), n, c); S.own = false; refreshWork(); const b = $('[data-fk="own-toggle"]'); if (b) b.focus({ preventScroll: true });
  }
  function onSubmit(e) { if (e.target.id === 'renameform' || e.target.id === 'ownform') e.preventDefault(); }
  function onKey(e) {
    if (e.key === 'Enter' && e.target && (e.target.id === 'arr-name' || (e.target.closest && e.target.closest('#ownform') && e.target.tagName === 'INPUT'))) { e.preventDefault(); return e.target.id === 'arr-name' ? doRename() : doOwn(); }
    if (e.key === 'Escape') {
      if (S.menu) { S.menu = null; if (S.route.name === 'inkop') render('menu-job'); else refresh(['bq', 'pk']); return; }
      if (S.rename) { S.rename = false; return refresh(['bq']); }
      if (S.route.name === 'bukett' && pkQ()) { S.pk.q = ''; refresh(['pk']); return; }
    }
    if (e.key === '/' && S.route.name === 'bukett' && !e.ctrlKey && !e.metaKey && !e.altKey && !/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)) {
      const i = $('#pk-q'); if (i && i.offsetParent !== null) { e.preventDefault(); i.focus(); }
    }
  }
  document.addEventListener('click', onClick); document.addEventListener('input', onInput); document.addEventListener('submit', onSubmit); document.addEventListener('keydown', onKey);
  // tangentbordet ska stängas när man börjar rulla bland träffarna
  document.addEventListener('touchmove', e => { const i = $('#pk-q'); if (i && document.activeElement === i && e.target.closest && e.target.closest('#pk-scroll')) i.blur(); }, { passive: true });
  const onSplit = () => { S.menu = null; render(); };
  if (SPLIT.addEventListener) SPLIT.addEventListener('change', onSplit); else SPLIT.addListener(onSplit);

  // ---------- start ----------
  S.route = parseHash();
  if (S.route.ev) S.cur = { ev: S.route.ev, arr: S.route.arr || null };
  if (S.route.name === 'bukett' && !S.route.ev) S.mode = 'valj';
  const first = latest();
  if (params.has('ny')) { S.route = { name: 'bukett', ev: null, arr: null }; S.mode = 'valj'; }
  else if ((params.has('bukett') || params.has('blommor')) && S.route.name === 'hem' && first) { const a = E.job(first.id).arrangements[0]; S.route = { name: 'bukett', ev: first.id, arr: a ? a.id : null }; S.cur = { ev: first.id, arr: a ? a.id : null }; S.mode = params.has('blommor') ? 'valj' : 'bukett'; }
  else if (params.has('inkop') && S.route.name === 'hem' && first) { S.route = { name: 'inkop', ev: first.id }; S.cur = { ev: first.id, arr: null }; }
  S.pk = freshPk();
  render();
  window.__studio = { E, F, S, render, refresh, setRoute, openBuilder, setMode, cur };   // för tester
})();
