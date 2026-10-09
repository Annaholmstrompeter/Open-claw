/* Maison Studio: gränssnittet. Två vyer (Hem och Bukettbyggaren) ovanpå Buketträknarens riktiga prismotor via studio-engine.js.
 * Inget sparas: allt ligger i minnet och återställs när sidan laddas om. */
(function () {
  'use strict';
  const E = window.StudioEngine.create();
  const NB = ' ';
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => [...(r || document).querySelectorAll(s)];
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const mqMobile = window.matchMedia('(max-width: 999px)');
  const params = new URLSearchParams(location.search);

  // ---------- ikoner (enkla gränssnittsikoner, inga illustrationer) ----------
  const P = { arrow: 'M4 12h16M14 6l6 6-6 6', next: 'M9 5l7 7-7 7', back: 'M15 5l-7 7 7 7', plus: 'M12 5v14M5 12h14', minus: 'M5 12h14', check: 'M5 12.5l4.5 4.5L19 7', search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4',
    chevd: 'M6 9l6 6 6-6', trash: 'M5 7h14M9 7V4.5h6V7M7 7l1 13h8l1-13', sliders: 'M4 7h9M17 7h3M4 17h3M11 17h9M15 4.5v5M9 14.5v5', home: 'M4 11l8-7 8 7v8.5a1 1 0 0 1-1 1h-4v-6h-6v6H5a1 1 0 0 1-1-1z',
    clip: 'M9 4h6l1 2h2a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h2zM9 4v2h6V4M8.5 11h7M8.5 14.5h7', flower: 'M12 21v-8M12 13c-3.2 0-5-2-5-5 3 0 5 2 5 5zm0 0c3.2 0 5-2 5-5-3 0-5 2-5 5zM9 18c1.5-.2 2.5-1 3-2M15 18c-1.5-.2-2.5-1-3-2',
    calc: 'M7 3h10a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM8.5 6.5h7v3h-7zM9 13h.01M12 13h.01M15 13h.01M9 16.5h.01M12 16.5h.01M15 16.5h.01' };
  const ic = (n, s, w) => '<svg class="i" width="' + (s || 22) + '" height="' + (s || 22) + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' + (w || 1.6) + '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="' + P[n] + '"/></svg>';

  // ---------- tillstånd ----------
  const S = { route: { name: 'hem' }, filter: 'Alla', q: '', receipt: false, picker: false, own: false, confirm: false, photo: params.has('foto') ? 'ph' : 'none', invalid: null };
  function parseHash() {
    const h = (location.hash || '').replace(/^#\/?/, '').split('/');
    if (h[0] === 'inkop' && h[1] && E.job(h[1])) return { name: 'inkop', ev: h[1] };
    if (h[0] === 'jobb') {
      if (h[1] === 'ny') return { name: 'bygg', ev: null, arr: null };
      const j = h[1] && E.job(h[1]);
      if (j) { const a = j.arrangements.find(x => x.id === h[2]) || j.arrangements[0]; return { name: 'bygg', ev: j.id, arr: a ? a.id : null }; }
    }
    return { name: 'hem' };
  }
  function hashOf(r) { return r.name === 'hem' ? '#/hem' : r.name === 'inkop' ? '#/inkop/' + r.ev : (r.ev ? '#/jobb/' + r.ev + '/' + (r.arr || '') : '#/jobb/ny'); }
  function go(route, replace) {
    S.route = route; S.receipt = false; S.picker = false; S.own = false; S.confirm = false; S.q = ''; S.filter = 'Alla'; S.invalid = null;
    if (replace) history.replaceState(null, '', hashOf(route)); else history.pushState(null, '', hashOf(route));
    render(); window.scrollTo(0, 0);
    const t = $('#main'); if (t && route.name === 'hem') t.focus({ preventScroll: true });
  }
  window.addEventListener('popstate', () => { S.route = parseHash(); S.receipt = false; S.picker = false; render(); });

  // ---------- små byggstenar ----------
  const kr0 = E.kr;
  function mark(m) { return m === '✓' ? '<span class="mk ok" aria-hidden="true">✓</span> <span class="sr">Bekräftat pris </span>' : m ? '<span class="mk ap" aria-hidden="true">≈</span> <span class="sr">Ungefärligt pris </span>' : ''; }
  function composeBar(c, big) { const tot = c.reduce((s, x) => s + x.n, 0); return c.length ? '<span class="compo' + (big ? ' compo--lg' : '') + '" aria-hidden="true">' + c.map(x => '<i style="flex:' + x.n + ';background:' + x.color + '" title="' + esc(x.n + ' ' + x.name) + '"></i>').join('') + '</span>' : ''; }
  function legend(c) { return c.length ? '<div class="legend">' + c.map(x => '<span><i style="background:' + x.color + '"></i><b>' + x.n + '</b> ' + esc(x.name) + '</span>').join('') + '</div>' : ''; }
  function stepper(o) {   // o: { act, id, value, name, removeAtOne, fk, small }
    const trash = o.removeAtOne && o.value <= 1;
    return '<div class="stp' + (o.small ? ' stp--sm' : '') + '" role="group" aria-label="' + (o.stems ? 'Antal stjälkar ' : 'Antal ') + esc(o.name) + '">'
      + '<button type="button" data-act="' + o.act + '-dec" data-id="' + esc(o.id) + '" data-fk="' + o.fk + ':dec" aria-label="' + (trash ? 'Ta bort ' : o.stems ? 'Färre stjälkar ' : 'Färre ') + esc(o.name) + '"' + (!trash && o.value <= 1 ? ' disabled' : '') + '>' + ic(trash ? 'trash' : 'minus', 20, 1.7) + '</button>'
      + '<output aria-live="off">' + o.value + '</output>'
      + '<button type="button" data-act="' + o.act + '-inc" data-id="' + esc(o.id) + '" data-fk="' + o.fk + ':inc" aria-label="' + (o.stems ? 'Fler stjälkar ' : 'Fler ') + esc(o.name) + '">' + ic('plus', 20, 1.7) + '</button></div>';
  }
  const stemsLine = c => { const n = c.reduce((s, x) => s + x.n, 0); return n + ' stjälkar · ' + c.length + ' ' + (c.length === 1 ? 'sort' : 'sorter'); };

  // ---------- ram ----------
  const TABS = [['Hem', 'home', 'hem'], ['Jobb', 'clip', 'bygg'], ['Blommor', 'flower', null], ['Snabbkalkyl', 'calc', null]];
  function topbar() {
    const bygg = S.route.name !== 'hem';
    return '<header class="top"><div class="l">' + (bygg ? '<button type="button" class="back" data-act="' + (S.route.name === 'inkop' ? 'back-bygg' : 'hem') + '" data-fk="back">' + ic('back', 18, 1.8) + (S.route.name === 'inkop' ? 'Bukett' : 'Hem') + '</button>' : '')
      + '<nav class="gnav" aria-label="Huvudmeny">' + TABS.map(([t, , r]) => '<button type="button" data-act="' + (r === 'hem' ? 'hem' : r === 'bygg' ? 'jobb' : 'na') + '"' + (r === (S.route.name === 'inkop' ? 'bygg' : S.route.name) ? ' aria-current="page"' : '') + (r ? '' : ' data-na="' + t + '"') + '>' + t + '</button>').join('') + '</nav></div>'
      + '<a class="brand" href="#/hem" data-act="hem"><span class="mono" aria-hidden="true">B</span>Buketträknaren</a>'
      + '<div class="r"><span class="saved" id="saved" role="img" aria-label="Sparat">' + ic('check', 14, 2.2) + '<span class="t" aria-hidden="true">Sparat</span></span><button type="button" class="icon-btn" data-act="na" data-na="Inställningar" aria-label="Inställningar">' + ic('sliders', 22, 1.5) + '</button></div></header>';
  }
  function tabbar() {
    return '<nav class="tabbar" aria-label="Huvudmeny">' + TABS.map(([t, i, r]) => '<button type="button" data-act="' + (r === 'hem' ? 'hem' : r === 'bygg' ? 'jobb' : 'na') + '"' + (r === (S.route.name === 'inkop' ? 'bygg' : S.route.name) ? ' aria-current="page"' : '') + (r ? '' : ' data-na="' + t + '"') + '>' + ic(i, 22, 1.5) + t + '</button>').join('') + '</nav>';
  }

  // ---------- HEM ----------
  function hemView() {
    const jobs = E.jobs(), pl = E.priceListStatus(), photo = S.photo !== 'none';
    const oldTxt = pl.old.map(o => o.name + ' ' + o.days + ' d').join(', ');
    const fig = !photo ? '' : '<figure class="photo">' + (S.photo === 'real' ? '<img src="media/hem.jpg" alt="" decoding="async">' : '<div class="ph" role="img" aria-label="Plats för ett licensierat fotografi">Plats för fotografi<br>4:5 · licensierat eller eget</div>')
      + '<figcaption>' + (S.photo === 'real' ? 'Foto: se media/CREDITS.md' : 'Förhandsvisning av var ett fotografi kan sitta. Ingen bild ingår i prototypen.') + '</figcaption></figure>';
    return '<main id="main" class="hem' + (photo ? ' has-photo' : '') + '" tabindex="-1">'
      + '<div class="intro"><p class="eyebrow">Din studio · torsdag 8 oktober</p><h1>Vad ska vi <em>skapa</em> idag?</h1>'
      + '<div class="acts"><button type="button" class="act act--primary" data-act="new-bouquet" data-fk="new-bouquet"><span class="act-no">01</span><span class="act-t">Skapa en bukett</span><span class="act-s">Välj blommor och se kundpriset direkt.</span>' + ic('arrow', 26, 1.4) + '</button>'
      + '<button type="button" class="act" data-act="new-job" data-fk="new-job"><span class="act-no">02</span><span class="act-t">Planera ett kundjobb</span><span class="act-s">Bröllop, begravning eller en kund med flera arrangemang.</span>' + ic('arrow', 26, 1.4) + '</button></div></div>'
      + fig
      + '<section class="recent" aria-labelledby="recent-h"><div class="recent-head"><h2 id="recent-h">Senaste arbeten</h2>'
      + '<p class="pl"><b>Prislista</b> · ' + pl.today + ' av ' + pl.total + ' priser är från idag' + (pl.old.length ? ', <span class="warn">' + pl.old.length + ' äldre</span><span class="pl-old"> (' + esc(oldTxt) + ')</span>' : '') + '<span class="dot"> · </span><button type="button" class="link" data-act="na" data-na="Uppdatera priser">Uppdatera priser</button></p></div>'
      + '<ul class="jobs">' + jobs.map(j => {
        const n = j.composition.reduce((s, x) => s + x.n, 0);
        const price = j.price.kind === 'ok' ? '<span class="price num">' + mark(j.price.mark) + esc(j.price.text) + ' <small>' + j.price.basis + '</small></span>' : '<span class="price"><small>' + esc(j.price.text) + '</small></span>';
        return '<li><button type="button" class="job" data-act="open-job" data-id="' + j.id + '" data-fk="job:' + j.id + '"><span class="job-main"><span class="nm">' + esc(j.name) + '</span><span class="meta">' + esc([j.customer, j.type, j.date].filter(Boolean).join(' · ')) + '</span>'
          + (n ? '<span class="stems">' + n + ' stjälkar · ' + j.composition.length + ' sorter</span>' : '') + '</span>' + composeBar(j.composition) + price + '<span class="chev">' + ic('next', 20, 1.5) + '</span></button></li>';
      }).join('') + '</ul></section></main>';
  }

  // ---------- BYGGAREN ----------
  const arrangementNow = () => (S.route.arr ? E.arrangement(S.route.ev, S.route.arr) : null);
  function priceLabel(A) { return A && A.state === 'ok' ? (A.mark === '✓' ? '<span class="ok" aria-hidden="true">✓</span> Bekräftat pris' : '<span class="ap" aria-hidden="true">≈</span> Ungefärligt pris') + ' · ' + A.basis : 'Kundpris'; }
  function pbPrice(A) { return A && A.state === 'ok' ? '<span class="sr">' + (A.mark === '✓' ? 'Bekräftat pris ' : 'Ungefärligt pris ') + '</span>' + A.price : '<span class="pb-empty">Priset visas när du valt blommor</span>'; }
  function receiptHtml(A) { return A && A.state === 'ok' ? '<div class="rcp-wrap"><h2>Så räknades priset</h2>' + A.receipt.map(([k, v, c]) => '<div class="rcp ' + (c || '') + '"><span>' + k + '</span><i></i><span class="a">' + v + '</span></div>').join('') + '</div>' : ''; }
  const arrPr = a => esc(a.unit) + (a.total ? ' × ' + a.qty + '<span class="eq"> = ' + mark(a.mark) + esc(a.total) + '</span>' : '');
  function jobPanel(J, A) {
    const arrs = J ? J.arrangements : [{ id: null, name: A ? A.name : 'Bukett', qty: 1, state: 'empty' }];
    const arrLi = arrs.map(a => {
      const pr = a.state === 'ok' ? mark(a.mark) + '<span data-arr-pr="' + a.id + '">' + arrPr(a) + '</span>' : '<span data-arr-pr="' + a.id + '">Tomt</span>';
      return '<li><button type="button" class="arr" data-act="arr" data-id="' + a.id + '" data-fk="arr:' + a.id + '"' + (a.id === S.route.arr ? ' aria-current="true"' : '') + (a.id ? '' : ' disabled') + '><span class="arr-nm"><span data-arr-nm="' + a.id + '">' + esc(a.name) + '</span>' + (a.qty > 1 ? ' ×' + a.qty : '') + '</span><span class="arr-pr">' + pr + '</span></button></li>';
    }).join('');
    const total = J && J.price.kind === 'ok' ? '<div class="jobtotal"><p class="eyebrow">Kundpris för hela jobbet</p><div class="price num" id="jt-price">' + mark(J.price.mark) + esc(J.price.text) + '</div><p id="jt-vat">' + J.price.basis + (J.kind === 'BUSINESS' ? '' : ' · varav moms ' + esc(J.vat)) + '</p><button type="button" class="link" data-act="inkop" data-fk="inkop">Inköp för jobbet</button></div>' : '';
    const line = J && J.price.kind === 'ok' ? '<p class="jobline">Hela jobbet <b class="num" id="jl-price">' + mark(J.price.mark) + esc(J.price.text) + '</b> ' + J.price.basis + ' · <button type="button" class="link link--inline" data-act="inkop" data-fk="inkop-m">Inköp</button></p>' : '';
    return '<aside class="p-job" aria-label="Kundjobb"><div class="jobhead"><button type="button" class="back2" data-act="hem" data-fk="back2">' + ic('back', 16, 1.8) + 'Alla jobb</button><p class="eyebrow" style="margin-top:14px">Kundjobb</p><h2>' + esc(J ? J.name : 'Ny bukett') + '</h2>'
      + '<p>' + esc(J ? [J.customer, J.type, J.date].filter(Boolean).join(' · ') : 'Jobbet skapas när du lägger till den första blomman.') + '</p></div>'
      + '<p class="eyebrow arrlist-h" style="display:none">Arrangemang</p><ul class="arrlist" aria-label="Arrangemang">' + arrLi
      + (J ? '<li><button type="button" class="arr-add" data-act="add-arr" data-fk="add-arr">' + ic('plus', 18, 1.8) + 'Nytt arrangemang</button></li>' : '') + '</ul>' + line + total + '</aside>';
  }
  function ledgerHtml(A) {
    if (!A) return '<div class="ledger"><div class="ledger-h"><h2>Ingår</h2></div><div class="empty"><b>Börja med en blomma.</b>Välj blommor i listan så räknas kundpriset direkt.</div><button type="button" class="addflowers" data-act="open-picker" data-fk="open-picker">' + ic('plus', 18, 1.8) + 'Lägg till blommor</button></div>';
    const rows = A.items.map(it => '<li class="row"><span class="nm">' + (it.color ? '<i class="sw" style="background:' + it.color + '"></i>' : '') + esc(it.name) + '<span class="tag' + (it.supplier ? '' : ' tag--own') + '">' + it.tag + '</span></span>'
      + (it.supplier ? '<span class="sub"><span class="info"><b class="u">' + esc(it.unit) + '</b>' + (it.old ? ' <span class="warn">≈ äldre pris</span>' : '') + '<span class="d">' + esc(it.desc) + '</span></span>' + (it.buy ? '<span class="buy">' + esc(it.buy) + '</span>' : '') + '</span>' : '<span class="sub">' + esc(it.packText) + '</span>')
      + stepper({ act: 'item', id: it.id, value: it.qty, name: it.name, removeAtOne: true, fk: 'it:' + it.id, stems: it.supplier }) + '</li>').join('');
    const ownForm = S.own ? '<li><form class="ownform" id="ownform" novalidate><label>Namn<input name="n" autocomplete="off" placeholder="till exempel Band" required></label><label>Kalkylkostnad, kr<input name="c" inputmode="decimal" autocomplete="off" placeholder="40" required></label><button class="btn" type="submit">Lägg till</button></form></li>' : '';
    return '<div class="ledger"><div class="ledger-h"><h2>Ingår</h2><span>Antal stjälkar</span></div><ul>' + rows
      + '<li class="row"><span class="nm">Arbete<span class="tag tag--own">Per arrangemang</span></span><span class="sub">kr exkl. moms. Lämna tomt om inget ska tas ut.</span><label class="amt"><input id="labor" inputmode="decimal" autocomplete="off" value="' + esc(A.labor) + '" aria-label="Arbete, kr exkl. moms"' + (S.invalid ? ' aria-invalid="true"' : '') + '><span>kr</span></label></li>'
      + '<li class="row row--add"><button type="button" data-act="own-toggle" data-fk="own-toggle" aria-expanded="' + S.own + '">' + ic(S.own ? 'minus' : 'plus', 18, 1.8) + '<span>Eget material <small>band, vas, kvistar från trädgården …</small></span></button></li>' + ownForm + '</ul>'
      + '<button type="button" class="addflowers" data-act="open-picker" data-fk="open-picker">' + ic('plus', 18, 1.8) + 'Lägg till blommor</button></div>';
  }
  function pickerHtml(A) {
    const counts = {}; if (A) A.items.forEach(i => { if (i.flowerId) counts[i.flowerId] = { id: i.id, n: i.qty }; });
    const q = S.q.trim().toLowerCase();
    const list = E.flowers().filter(f => (S.filter === 'Alla' || f.category === S.filter) && (!q || f.name.toLowerCase().includes(q)));
    const pl = E.priceListStatus();
    const rows = list.map(f => {
      const c = counts[f.id];
      return '<li class="pk-row' + (c ? ' on' : '') + '"><span class="nm"><i class="sw" style="background:' + f.color + '"></i>' + esc(f.name) + '</span><span class="sub"><b class="u">' + esc(f.unit) + '</b>' + (f.old ? ' <span class="warn" title="Priset är ' + f.days + ' dagar gammalt">≈ ' + f.days + ' d sedan</span>' : '') + '<span class="d">' + esc(f.desc) + '</span></span>'
        + (c ? stepper({ act: 'pk', id: f.id, value: c.n, name: f.name, removeAtOne: true, fk: 'pk:' + f.id, stems: true }) : '<button type="button" class="addbtn" data-act="pk-inc" data-id="' + f.id + '" data-fk="pk:' + f.id + ':inc" aria-label="Lägg till ' + esc(f.name) + '">' + ic('plus', 20, 1.7) + '</button>') + '</li>';
    }).join('');
    const mobile = mqMobile.matches;
    return '<aside class="picker' + (S.picker ? ' open' : '') + '" id="picker" aria-labelledby="pk-h"' + (mobile && S.picker ? ' role="dialog" aria-modal="true"' : '') + '>'
      + '<div class="pk-head"><h2 id="pk-h" tabindex="-1">Lägg till blommor</h2><button type="button" class="link pk-close" data-act="close-picker" data-fk="pk-close">Klart</button></div>'
      + '<div class="pk-body"><div class="pk-search"><label class="pk-field">' + ic('search', 20, 1.6) + '<span class="sr">Sök i dina blommor</span><input id="pk-q" type="search" autocomplete="off" placeholder="Sök blomma" value="' + esc(S.q) + '" data-fk="pk-q"></label></div>'
      + '<div class="pk-tabs" role="group" aria-label="Visa">' + ['Alla', 'Blommor', 'Grönt'].map(t => '<button type="button" data-act="filter" data-id="' + t + '" data-fk="f:' + t + '" aria-pressed="' + (S.filter === t) + '">' + t + '</button>').join('') + '</div>'
      + '<ul id="pk-list">' + (rows || '<li class="pk-none">Ingen blomma matchar “' + esc(S.q) + '”.</li>') + '</ul>'
      + '<p class="pk-note">Siffran är antal stjälkar. Du köper alltid hela förpackningar. Styckpriset i parentes är räknat, inte grossistens pris.</p><p class="pk-note">Prislista: ' + pl.today + ' av ' + pl.total + ' priser är från idag.' + (pl.old.length ? ' <span class="warn">≈ ' + pl.old.length + ' äldre</span> räknas som ungefärliga.' : '') + '</p></div>'
      + '<div class="pk-bar"><div><div class="pb-label" id="pk-label">' + priceLabel(A) + '</div><div class="pb-price num" id="pk-price">' + pbPrice(A) + '</div></div><button type="button" class="btn" data-act="close-picker" data-fk="pk-done">Klart</button></div></aside>';
  }
  function byggView() {
    const J = S.route.ev ? E.job(S.route.ev) : null, A = arrangementNow();
    const idx = J && A ? J.arrangements.findIndex(a => a.id === A.id) + 1 : 1, n = J ? J.arrangements.length : 1;
    const name = A ? A.name : 'Ny bukett';
    return '<main id="main" class="bygg" tabindex="-1"><div class="ws">' + jobPanel(J, A)
      + '<section class="p-active" aria-labelledby="arr-h"><div class="a-scroll"><p class="crumbline"><span>' + esc(J ? J.name : 'Ny bukett') + '</span><span aria-hidden="true">/</span><span>Arrangemang ' + idx + ' av ' + n + '</span></p>'
      + '<h1 class="sr" id="arr-h">Bukettbyggare: ' + esc(name) + '</h1>'
      + '<div class="a-title"><input class="title-input" id="arr-name" value="' + esc(name) + '" aria-label="Namn på arrangemanget"' + (A ? '' : ' disabled') + ' data-fk="arr-name">'
      + '<div class="a-count"><span class="eyebrow">Antal likadana</span>' + stepper({ act: 'cnt', id: 'x', value: A ? A.qty : 1, name: 'likadana arrangemang', removeAtOne: false, fk: 'cnt', small: true }).replace(/data-act="cnt-(dec|inc)"/g, A ? 'data-act="cnt-$1"' : 'data-act="cnt-$1" disabled') + '</div></div>'
      + '<div class="compo-block"><div class="compo-head"><span class="eyebrow">Sammansättning</span><span id="compo-sum">' + (A && A.composition.length ? esc(stemsLine(A.composition)) : '') + '</span></div><div id="compo-wrap">' + (A && A.composition.length ? composeBar(A.composition, true) + legend(A.composition) : '<p class="sub" style="font:400 14px/1.4 var(--sans);color:var(--ink-2)">Ingen sammansättning än.</p>') + '</div></div>'
      + ledgerHtml(A)
      + (A ? '<div class="a-foot">' + (S.confirm ? '<div class="confirm"><span>Ta bort ' + esc(A.name) + '?</span><button type="button" class="danger" data-act="del-yes" data-fk="del-yes">Ta bort</button><button type="button" class="link" data-act="del-no" data-fk="del-no">Avbryt</button></div>' : '<button type="button" class="danger" data-act="del" data-fk="del">Ta bort arrangemanget</button>') + '</div>' : '')
      + '</div>'
      + '<div class="pricebar" id="pb"><button type="button" class="pb-main" data-act="receipt" data-fk="receipt" aria-expanded="' + S.receipt + '" aria-controls="receipt"' + (A && A.state === 'ok' ? ' aria-label="Kundpris ' + esc(A.price) + ' ' + A.basis + '. Visa hur priset räknades"' : ' disabled') + '><span class="pb-label" id="pb-label">' + priceLabel(A) + '</span><span class="pb-price num" id="pb-price">' + pbPrice(A) + '</span><span class="pb-how"><span class="t">Så räknades priset</span>' + ic('chevd', 18, 1.8) + '</span></button>'
      + '<button type="button" class="btn pb-done" data-act="done" data-fk="done">Klart</button>'
      + '<div class="receipt" id="receipt"' + (S.receipt && A && A.state === 'ok' ? '' : ' hidden') + '>' + receiptHtml(A) + '</div></div></section>'
      + pickerHtml(A) + '</div></main>';
  }

  // ---------- INKÖP ----------
  function inkopView() {
    const J = E.job(S.route.ev), P = E.purchase(S.route.ev);
    const rows = P.rows.map(r => '<li class="ik-row"><div class="ik-main"><span class="nm"><i class="sw" style="background:' + r.color + '"></i>' + esc(r.name) + '</span><span class="sub"><b class="u">' + esc(r.unit) + '</b><span class="d">' + esc(r.desc) + '</span></span></div>'
      + (r.hasPrice ? '<div class="ik-num"><span>Behövs <b>' + r.needed + ' st</b></span><span>Köper <b>' + esc(r.buy) + '</b></span><span class="' + (r.leftover > 0 ? 'over' : '') + '">Över <b>' + r.leftover + ' st</b></span></div><div class="ik-cost num">' + esc(r.cost) + '</div>'
        : '<div class="ik-num"><span>Behövs <b>' + r.needed + ' st</b></span><span class="warn">Pris saknas</span></div>') + '</li>').join('');
    return '<main id="main" class="bygg inkop" tabindex="-1"><div class="ws ws--inkop">' + jobPanel(J, null)
      + '<section class="p-active" aria-labelledby="ik-h"><div class="a-scroll"><p class="crumbline"><span>' + esc(J.name) + '</span><span aria-hidden="true">/</span><span>Inköp</span></p>'
      + '<h1 class="ik-title" id="ik-h">Inköp för jobbet</h1><p class="ik-lede">Du köper hela förpackningar. Det som blir över ingår i kundpriset.</p>'
      + (rows ? '<ul class="ik">' + rows + '</ul>' : '<p class="empty"><b>Inget att köpa än.</b>Lägg till blommor i ett arrangemang så visas inköpet här.</p>')
      + (rows ? '<div class="ik-sum"><p class="eyebrow">Summa inköp, exkl. moms</p><p class="ik-total num">' + esc(P.sum) + '</p></div>'
        + '<p class="ik-note">Blir över: ' + P.leftoverStems + ' stjälkar, värde ' + esc(P.leftoverValue) + '. ' + (P.wholePacks ? 'Det ingår i kundpriset, eftersom hela förpackningen debiteras.' : 'Det tas inte ut i kundpriset.') + '</p>' : '')
      + (P.notOrdered.length ? '<p class="ik-note">Beställs inte (eget lager och egen trädgård): ' + P.notOrdered.map(esc).join(', ') + '.</p>' : '')
      + '<p class="a-foot"><button type="button" class="btn btn--ghost" data-act="back-bygg" data-fk="back-bygg">Till bukettbyggaren</button></p></div></section></div></main>';
  }

  // ---------- ritning ----------
  function saveScroll() { const m = {}; ['.a-scroll', '.p-job', '.pk-body'].forEach(s => { const e = $(s); if (e) m[s] = e.scrollTop; }); return m; }
  function restoreScroll(m) { Object.keys(m).forEach(s => { const e = $(s); if (e) e.scrollTop = m[s]; }); }
  function render(focusKey) {
    const sc = saveScroll(), ae = document.activeElement, fk = focusKey || (ae && ae.dataset ? ae.dataset.fk : null);
    document.body.dataset.screen = S.route.name;
    document.body.classList.toggle('locked', S.picker && mqMobile.matches);
    $('#app').innerHTML = topbar() + (S.route.name === 'hem' ? hemView() : S.route.name === 'inkop' ? inkopView() : byggView()) + tabbar();
    restoreScroll(sc);
    if (fk) { const t = $('[data-fk="' + fk.replace(/"/g, '') + '"]'); if (t && !t.disabled) t.focus({ preventScroll: true }); }
    const inert = mqMobile.matches && S.picker;
    ['.top', '.p-job', '.p-active', '.tabbar'].forEach(s => $$(s).forEach(e => { if (inert) e.setAttribute('inert', ''); else e.removeAttribute('inert'); }));
    document.title = (S.route.name === 'hem' ? 'Hem' : S.route.name === 'inkop' ? 'Inköp' : 'Bukettbyggare') + ' – Buketträknaren · Maison Studio (prototyp)';
  }
  /** Uppdaterar bara texter som beror på priset, så att inget som man håller på att trycka på byts ut. */
  function patch() {
    const A = arrangementNow(), J = S.route.ev ? E.job(S.route.ev) : null; if (!A) return render();
    const set = (sel, html) => { const e = $(sel); if (e) e.innerHTML = html; };
    set('#pb-label', priceLabel(A)); set('#pb-price', pbPrice(A)); set('#pk-label', priceLabel(A)); set('#pk-price', pbPrice(A));
    const rc = $('#receipt'); if (rc) { rc.innerHTML = receiptHtml(A); if (A.state !== 'ok') rc.hidden = true; }
    const how = $('.pb-main'); if (how) { how.disabled = A.state !== 'ok'; if (A.state === 'ok') how.setAttribute('aria-label', 'Kundpris ' + A.price + ' ' + A.basis + '. Visa hur priset räknades'); }
    set('#compo-wrap', A.composition.length ? composeBar(A.composition, true) + legend(A.composition) : ''); set('#compo-sum', esc(A.composition.length ? stemsLine(A.composition) : ''));
    if (J) {
      J.arrangements.forEach(a => { const pr = $('[data-arr-pr="' + a.id + '"]'); if (pr) pr.innerHTML = a.state === 'ok' ? arrPr(a) : 'Tomt'; const nm = $('[data-arr-nm="' + a.id + '"]'); if (nm) nm.textContent = a.name; });
      set('#jt-price', mark(J.price.mark) + esc(J.price.text)); set('#jl-price', mark(J.price.mark) + esc(J.price.text)); set('#jt-vat', J.price.basis + (J.kind === 'BUSINESS' ? '' : ' · varav moms ' + esc(J.vat)));
    }
    announce(A.state === 'ok' ? 'Kundpris ' + A.price + ' ' + A.basis : 'Pris saknas');
  }
  let live; function announce(t) { if (!live) live = $('#live'); if (!live) return; live.textContent = ''; setTimeout(() => { live.textContent = t; }, 30); }
  let toastT; function toast(t) { const el = $('#toast'); el.textContent = t; el.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { el.hidden = true; }, 3200); }

  // ---------- ändringar ----------
  function ensureArr() {
    if (S.route.arr) return S.route.arr;
    const d = E.draft(); S.route = { name: 'bygg', ev: d.eventId, arr: d.arrId }; history.replaceState(null, '', hashOf(S.route)); return d.arrId;
  }
  function attempt(fn) { try { fn(); return true; } catch (e) { toast(String(e && e.message || e).replace(/^Error: /, '')); return false; } }
  function onClick(e) {
    const t = e.target.closest('[data-act]'); if (!t || t.disabled) return;
    const act = t.dataset.act, id = t.dataset.id, A = arrangementNow();
    if (act === 'hem') { e.preventDefault(); return go({ name: 'hem' }); }
    if (act === 'jobb') { const j = E.jobs()[0]; return go({ name: 'bygg', ev: j.id, arr: E.job(j.id).arrangements[0].id }); }
    if (act === 'na') { return toast((t.dataset.na || 'Den här delen') + ' ingår inte i prototypen.'); }
    if (act === 'inkop') return go({ name: 'inkop', ev: S.route.ev });
    if (act === 'back-bygg') { const jb = E.job(S.route.ev); return go({ name: 'bygg', ev: jb.id, arr: jb.arrangements[0] ? jb.arrangements[0].id : null }); }
    if (act === 'new-bouquet') return go({ name: 'bygg', ev: null, arr: null });
    if (act === 'new-job') { toast('Formuläret för nytt jobb ingår inte i prototypen. Här öppnas det senaste jobbet.'); const j = E.jobs()[0]; return go({ name: 'bygg', ev: j.id, arr: E.job(j.id).arrangements[0].id }); }
    if (act === 'open-job') { const j = E.job(id); return go({ name: 'bygg', ev: id, arr: j.arrangements[0] ? j.arrangements[0].id : null }); }
    if (act === 'arr') { return go({ name: 'bygg', ev: S.route.ev, arr: id }); }
    if (act === 'add-arr') { const a = E.addArrangement(S.route.ev, 'Nytt arrangemang'); return go({ name: 'bygg', ev: S.route.ev, arr: a }); }
    if (act === 'done') { toast('Sparat'); return go({ name: 'hem' }); }
    if (act === 'receipt') { S.receipt = !S.receipt; return render(); }
    if (act === 'open-picker') { S.picker = true; render(); const h = $('#pk-h'); if (h && mqMobile.matches) h.focus({ preventScroll: true }); return; }
    if (act === 'close-picker') { S.picker = false; render(); const b = $('[data-fk="open-picker"]'); if (b && mqMobile.matches) b.focus({ preventScroll: true }); return; }
    if (act === 'filter') { S.filter = id; return render(); }
    if (act === 'own-toggle') { S.own = !S.own; render(); if (S.own) { const f = $('#ownform input'); if (f) f.focus(); } return; }
    if (act === 'del') { S.confirm = true; return render('del-yes'); }
    if (act === 'del-no') { S.confirm = false; return render('del'); }
    if (act === 'del-yes') { E.removeArrangement(S.route.arr); const j = E.job(S.route.ev); return go(j && j.arrangements.length ? { name: 'bygg', ev: j.id, arr: j.arrangements[0].id } : { name: 'hem' }); }
    if (act === 'pk-inc') { const arr = ensureArr(); E.addFlower(arr, id); render(); return patchAfter(); }
    if (act === 'pk-dec' || act === 'item-dec') {
      const item = act === 'pk-dec' ? A.items.find(i => i.flowerId === id) : A.items.find(i => i.id === id);
      if (!item) return; if (item.qty <= 1) E.removeItem(item.id); else E.setQty(item.id, item.qty - 1);
      render(); return patchAfter();
    }
    if (act === 'item-inc') { const item = A.items.find(i => i.id === id); E.setQty(item.id, item.qty + 1); render(); return patchAfter(); }
    if (act === 'cnt-dec' || act === 'cnt-inc') { E.setCount(S.route.arr, A.qty + (act === 'cnt-inc' ? 1 : -1)); render(); return patchAfter(); }
  }
  const patchAfter = () => { const A = arrangementNow(); announce(A && A.state === 'ok' ? 'Kundpris ' + A.price + ' ' + A.basis : 'Välj blommor så visas priset'); };
  function onInput(e) {
    const t = e.target;
    if (t.id === 'pk-q') { S.q = t.value; const ul = $('#pk-list'); if (ul) { const tmp = document.createElement('div'); tmp.innerHTML = pickerHtml(arrangementNow()); const nu = $('#pk-list', tmp); if (nu) ul.innerHTML = nu.innerHTML; } return; }
    if (t.id === 'labor') {
      const A = arrangementNow(); if (!A) return;
      const ok = attempt(() => E.setLabor(A.id, t.value)); S.invalid = ok ? null : true; t.setAttribute('aria-invalid', ok ? 'false' : 'true'); if (ok) patch();
    }
  }
  function onChange(e) {
    const t = e.target;
    if (t.id === 'arr-name') { const A = arrangementNow(); if (A) { E.rename(A.id, t.value); patch(); } }
  }
  function onSubmit(e) {
    if (e.target.id !== 'ownform') return; e.preventDefault();
    const f = e.target, n = f.n.value.trim(), c = f.c.value.replace(/[\s ]/g, '').replace(',', '.');
    if (!n || !/^\d{1,9}(\.\d{1,2})?$/.test(c)) { toast('Skriv ett namn och en kalkylkostnad i kronor, till exempel 40 eller 62,50.'); return; }
    const arr = ensureArr(); E.addOwn(arr, n, c); S.own = false; render('own-toggle'); patchAfter();
  }
  function onKey(e) {
    if (e.key === 'Escape') { if (S.receipt) { S.receipt = false; render('receipt'); } else if (S.picker && mqMobile.matches) { S.picker = false; render(); const b = $('[data-fk="open-picker"]'); if (b) b.focus({ preventScroll: true }); } }
    if (e.key === 'Tab' && S.picker && mqMobile.matches) {   // håller tangentbordsfokus i blomvalet
      const p = $('#picker'); const f = $$('button:not(:disabled),input', p); if (!f.length) return;
      if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); } else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
    }
  }
  document.addEventListener('click', onClick); document.addEventListener('input', onInput); document.addEventListener('change', onChange); document.addEventListener('submit', onSubmit); document.addEventListener('keydown', onKey);
  mqMobile.addEventListener('change', () => { S.picker = false; render(); });

  // ---------- start ----------
  S.route = parseHash();
  if (params.has('bygg') && S.route.name === 'hem') { const j = E.jobs()[0]; S.route = { name: 'bygg', ev: j.id, arr: E.job(j.id).arrangements[0].id }; }
  if (params.has('inkop') && S.route.name === 'hem') { const j0 = E.jobs()[0]; S.route = { name: 'inkop', ev: j0.id }; }
  render();
  if (S.photo === 'none') { const im = new Image(); im.onload = () => { S.photo = 'real'; render(); }; im.src = 'media/hem.jpg'; }
  window.__studio = { E, S, go, render };   // för tester
})();
