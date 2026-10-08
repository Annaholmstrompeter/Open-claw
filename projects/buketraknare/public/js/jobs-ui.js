/* Buketträknaren: jobbskärmarna ("Jobb"-fliken): nytt jobb, jobbet, bukettbyggaren och kalkyl/inköp.
 *
 * Skärmen räknar ingenting själv. Allt går via arbetsytan (workspace.js), prismotorn och bryggan (bridge.js). Priserna kommer från den
 * gamla prislistan (bryggan bygger katalogen vid varje visning). Ändringar sparas direkt (store.js): det finns ingen Spara-knapp
 * att glömma, och "Sparat ✓" visar att det gick. Går det inte att spara står det, och det man ser finns då bara kvar i sidan.
 *
 * Fyra lägen (host.firstChild.dataset.mode): 'new' (nytt jobb), 'overview' (jobbet), 'builder' (bukettbyggaren) och 'calc' (kalkyl och
 * inköp). Alla delar av ett öppet jobb finns alltid i sidan och läget bestämmer bara vilken som syns (CSS), så att en dator kan visa
 * jobbet och byggaren sida vid sida medan en telefon visar en i taget.
 *
 * "Skapa en bukett" från startsidan öppnar byggaren utan jobb ('draft'). Jobbet (typ Bukett, utan kund) och arrangemanget skapas
 * först när något läggs till, så att inga tomma jobb samlas.
 *
 * Den här filen rör aldrig den gamla appens lagring. Lagringen skickas in utifrån (opts.storage), och arbetsytan har en egen nyckel.
 * Ingen flyttalsräkning: belopp är exakta (money.js) och visas med heltalsaritmetik.
 */
(function (root, factory) {
  var d = (typeof module === 'object' && module.exports)
    ? { M: require('./core/money.js'), W: require('./core/workspace.js'), S: require('./core/store.js'), B: require('./core/bridge.js'), I: require('./core/items.js') }
    : { M: root.BRMoney, W: root.BRWorkspace, S: root.BRStore, B: root.BRBridge, I: root.BRItems };
  var api = factory(d.M, d.W, d.S, d.B, d.I);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.BRJobsUI = api;
})(typeof self !== 'undefined' ? self : this, function (M, W, S, B, I) {
  'use strict';
  const { Money, Frac, ROUNDING } = M;
  const NBSP = ' ';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const MONTHS = ['januari', 'februari', 'mars', 'april', 'maj', 'juni', 'juli', 'augusti', 'september', 'oktober', 'november', 'december'];
  const EVENT_TYPES = [['wedding', 'Bröllop'], ['funeral', 'Begravning'], ['bouquet', 'Bukett'], ['other', 'Annat']];
  const KINDS = [['PRIVATE', 'Privatkund', 'Pris inkl. moms'], ['BUSINESS', 'Företag', 'Pris exkl. moms']];
  const SOURCES = [['OWN_STOCK', 'Eget lager'], ['HOME_GROWN', 'Egen trädgård'], ['MANUAL', 'Köpt separat']];
  const KIND_LABEL = { SUPPLIER: 'Grossist', OWN_STOCK: 'Eget lager', HOME_GROWN: 'Egen trädgård', MANUAL: 'Köpt separat' };
  const typeLabel = t => (EVENT_TYPES.find(x => x[0] === t) || ['', 'Annat'])[1];
  const icon = n => '<svg class="i" aria-hidden="true" focusable="false"><use href="#i-' + n + '"></use></svg>';

  // ---------- visning av belopp (heltalsaritmetik) ----------
  const group = digits => digits.replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
  function kr(m) {                                               // Money → "1 495 kr" eller "667,75 kr"
    const neg = m.amount < 0n, a = neg ? -m.amount : m.amount, whole = a / 100n, ore = a % 100n;
    return (neg ? '−' : '') + group(String(whole)) + (ore === 0n ? '' : ',' + String(ore).padStart(2, '0')) + NBSP + 'kr';
  }
  const krFrac = f => kr(Money.fromFrac(f, ROUNDING.HALF_UP, 'SEK'));      // bara för visning av ett exakt bråk i ören
  const times = (m, n) => Money.of(m.amount * BigInt(n), m.currency);
  const longDate = d => (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)) ? parseInt(d.slice(8, 10), 10) + ' ' + MONTHS[parseInt(d.slice(5, 7), 10) - 1] : '';
  /** Ett antal (exakt bråk) som text med högst tre decimaler: 7 eller 2,5. */
  function fracText(f) {
    const whole = f.n / f.d, rem = f.n % f.d;
    if (rem === 0n) return String(whole);
    return String(whole) + ',' + String(rem * 1000n / f.d).padStart(3, '0').replace(/0+$/, '');
  }
  const packLabel = (unit, size) => (size > 1 && String(unit || '').toLowerCase() === 'pack') ? size + '-pack' : size === 1 ? 'styck' : unit ? unit + ' à ' + size : size + ' per förp.';

  class UserError extends Error {}
  const MONEY_RE = /^\d{1,9}([.,]\d{1,2})?$/, INT_RE = /^\d{1,6}$/, DEC_RE = /^\d{1,6}([.,]\d{1,3})?$/;
  const squash = t => String(t == null ? '' : t).replace(/[\s ]/g, '');
  function parseMoney(t, what) { const v = squash(t); if (!MONEY_RE.test(v)) throw new UserError('Skriv ' + what + ' i kronor, till exempel 125 eller 62,50.'); return Money.fromDecimal(v); }
  function parseCount(t, what, min) { const v = squash(t); if (!INT_RE.test(v) || M.toSafeInt(BigInt(v)) < min) throw new UserError(what + ' måste vara ett heltal' + (min > 0 ? ' från ' + min : '') + '.'); return M.toSafeInt(BigInt(v)); }
  function parseQty(t) { const v = squash(t); if (!DEC_RE.test(v) || !M.parseDecimal(v).gt(0n)) throw new UserError('Antalet måste vara ett tal större än noll.'); return v.replace(',', '.'); }
  const needText = (t, what) => { const v = String(t == null ? '' : t).trim(); if (!v) throw new UserError(what + ' måste fyllas i.'); return v; };

  /** Texten för ett fel från arbetsytan (alla meddelanden är på svenska). */
  function messageOf(e) {
    if (e instanceof UserError) return e.message;
    const ps = e && e.problems;
    if (ps && ps.length) return ps.map(p => { const t = String(p.message || ''); return (t.charAt(0).toUpperCase() + t.slice(1)).replace(/([^.!?])$/, '$1.'); }).join(' ');
    return 'Något gick fel: ' + String((e && e.message) || e);
  }

  /** Val-knappar (radioknappar som ser ut som chips) som styr ett dolt fält. Det dolda fältet är det formuläret läser. */
  function choiceHtml(hiddenId, hiddenName, value, legend, options) {
    return '<input type="hidden" id="' + hiddenId + '" name="' + hiddenName + '" value="' + esc(value) + '">'
      + '<div class="choice" role="radiogroup" aria-label="' + esc(legend) + '">' + options.map(([v, label, sub]) =>
        '<label class="choice-opt"><input type="radio" name="' + hiddenName + '-choice" value="' + esc(v) + '" data-choice="' + hiddenId + '"' + (v === value ? ' checked' : '') + '><span class="choice-label">' + esc(label) + '</span>'
        + (sub ? '<small>' + esc(sub) + '</small>' : '') + '</label>').join('') + '</div>';
  }

  // ---------- montering ----------
  /**
   * Monterar jobbskärmarna i host. opts: { getView: () => den gamla appens vy, today: () => 'ÅÅÅÅ-MM-DD', storage: localStorage (eller likt),
   * ctx?: { now, newId }, setPrice?: (productId, { paket, pris }) => void (skriver ett pris i prislistan), navigate?: (flik) => void,
   * onChange?, onStatus?: (true|false|null) => void, onMode?: (läge) => void }.
   * Ger { activate, idle, state, view, summaries, startDraft, startNewJob, openJob, mode }. activate() läser om och visar. idle() väntar tills allt är sparat (för tester).
   */
  function mount(host, opts) {
    const o = opts || {};
    const adapter = S.createLocalStorageAdapter(o.storage);
    const ctx = o.ctx || W.defaultContext();
    const store = S.createWorkspaceStore(adapter, W, ctx, { create: {} });
    const doc = host.ownerDocument;
    const ui = { eventId: null, arrId: null, q: '', msg: null, msgFresh: false, saved: null, newJob: false, editJob: false, view: 'job', draft: false, draftArr: { name: '', qty: 1 }, ownOpen: false, confirm: null, note: null, blocked: null, mode: null, focusNext: false, focusPriceFor: null, moreOpen: false };
    let ws = null, view = null, opened = false;
    const inflight = new Set();

    const track = p => { inflight.add(p); const done = () => inflight.delete(p); p.then(done, done); return p; };
    const live = list => list.filter(e => e.deletedAt === null);
    const eventsList = () => live(ws.events);
    const customerOf = ev => (ev && ev.customerId ? ws.customers.find(c => c.id === ev.customerId) : null) || null;
    const arrsOf = id => live(ws.arrangements).filter(a => a.eventId === id);
    const itemsOf = id => live(ws.items).filter(i => i.arrangementId === id);
    const todayStr = () => (o.today ? o.today() : '');
    const notify = () => { if (o.onChange) o.onChange(); if (o.onStatus) o.onStatus(ui.saved); };

    // ---------- hämta, spegla och spara ----------
    async function openStore() {
      const r = await store.open();
      if (!r.ok) { ui.blocked = r; return false; }
      ws = r.state; opened = true; ui.saved = r.saved === false ? false : null;      // "Sparat ✓" visas först när något faktiskt sparats
      return true;
    }
    /** Kör en ändring och visar resultatet. onOk(resultat) körs före ritningen, så att läget är rätt när skärmen ritas. Ger resultatet, eller undefined om det inte gick. */
    function change(fn, onOk) {
      return track((async () => {
        const r = await store.update(fn);
        if (r.state) ws = r.state;
        if (r.ok) {
          ui.saved = r.saved; ui.msg = r.saved ? null : { kind: 'warn', text: 'Det gick inte att spara (lagringen är full eller blockerad). Det du ser finns bara kvar tills du lämnar sidan.' };
          if (!r.saved) ui.msgFresh = true;
          if (onOk) onOk(r.result);
        }
        else if (r.reason === 'conflict') { ui.saved = false; ui.msg = { kind: 'bad', text: 'Jobben har ändrats i ett annat fönster. Ladda om sidan så ser du det senaste. Din senaste ändring sparades inte.' }; ui.msgFresh = true; }
        else { ui.saved = false; ui.msg = { kind: 'bad', text: messageOf(r.error || r) }; ui.msgFresh = true; }
        render();
        return r.ok ? r.result : undefined;
      })());
    }
    /** Som change, men skapar jobbet (typ Bukett, utan kund) och arrangemanget först om byggaren är öppen utan jobb. fn(d, c, arrangemangsId) ger resultatet. */
    function changeInArr(fn) {
      return change((d, c) => {
        let made = null, arrId = ui.arrId;
        if (!arrId) {
          const ev = W.createEvent(d, c, { name: draftName(), type: 'bouquet' });
          const a = W.addArrangement(d, c, ev.id, { name: ui.draftArr.name || 'Bukett', quantity: ui.draftArr.qty });
          made = { eventId: ev.id, arrId: a.id }; arrId = a.id;
        }
        return { made, out: fn(d, c, arrId) };
      }, r => { if (r.made) { ui.eventId = r.made.eventId; ui.arrId = r.made.arrId; ui.draft = false; ui.draftArr = { name: '', qty: 1 }; } }).then(r => (r ? r.out : undefined));
    }
    const draftName = () => { const t = longDate(todayStr()); return t ? 'Bukett ' + t : 'Ny bukett'; };

    /** Speglar den gamla appens inställningar och flyttar över den nuvarande ordern en gång. Skriver bara om något faktiskt ändras. */
    async function connect() {
      view = o.getView();
      const probe = JSON.parse(JSON.stringify(ws)), pctx = W.defaultContext();
      const rep = B.connect(probe, pctx, view);
      if (rep.settings.status === 'unsupported') ui.note = { kind: 'warn', text: 'Några inställningar i Inställningar går inte att räkna exakt med ännu (' + rep.settings.problems.map(p => p.message).join('; ') + '). Jobben räknar med de inställningar som gällde sist.' };
      if (rep.settings.status === 'updated' || rep.order.status === 'imported') {
        await change((d, c) => B.connect(d, c, view));
        if (rep.order.status === 'imported') {
          const mine = ws.events.find(e => e.origin && e.origin.kind === 'legacy_order'); if (mine && !ui.draft && !ui.newJob) ui.eventId = mine.id;
          ui.note = { kind: 'ok', text: 'Din nuvarande order finns nu som jobbet "Min order". Fliken Snabbkalkyl är oförändrad, och ändringar här ändrar den inte.' };
        }
      }
      if (rep.order.status === 'unsupported') ui.note = { kind: 'warn', text: 'Din nuvarande order går inte att flytta över exakt (' + rep.order.problems.map(p => p.message).join('; ') + '). Den ligger kvar i fliken Snabbkalkyl.' };
    }

    async function activate() {
      try {
        if (!opened && !(await openStore())) { render(); return; }
        ui.blocked = null; view = o.getView();
        await connect();
        const evs = eventsList();
        if (!ui.draft && !ui.newJob) {
          if (!ui.eventId || !evs.some(e => e.id === ui.eventId)) {
            const latest = evs.slice().sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0))[0];
            ui.eventId = latest ? latest.id : null;
          }
          if (!evs.length) ui.newJob = true;
        }
        if (ui.arrId && !live(ws.arrangements).some(a => a.id === ui.arrId)) ui.arrId = null;
      } catch (e) { ui.msg = { kind: 'bad', text: messageOf(e) }; ui.msgFresh = true; }
      render();
    }

    // ---------- pris ----------
    function priceOf(eventId) {
      const { catalog } = B.catalogFromView(view, { today: todayStr() });
      return { res: W.priceEvent(ws, eventId, { catalog, today: todayStr() }), catalog };
    }

    /** Vad som hindrar ett pris, på klartext. Bara sådant floristen kan åtgärda. */
    function problemsOf(res, catalog) {
      const items = live(ws.items), nameOfKey = k => (catalog[k] && catalog[k].name) || (items.find(i => i.articleRef && I.articleKey(i.articleRef) === k) || {}).name || k;
      const out = [];
      for (const k of res.plan.noPrice) out.push('Pris saknas för ' + nameOfKey(k));
      for (const k of res.plan.missing) out.push(nameOfKey(k) + ' finns inte i prislistan');
      for (const x of res.arrangements) for (const r of x.result.reasons || []) {
        if (r.code === 'tax_unknown') out.push('Momssats saknas för ' + (r.category || 'en rad'));
        else if (r.code === 'sale_price_missing') out.push('Fast pris saknas för ' + ((items.find(i => i.id === r.id) || {}).name || 'en rad'));
      }
      return [...new Set(out)];
    }

    /** Korta rader till startsidan: senaste jobben med pris. Läser bara, ändrar inget. */
    function summaries() {
      if (!ws) return [];
      try { view = o.getView(); } catch (e) { return []; }
      return eventsList().slice().sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0)).map(e => {
        const c = customerOf(e), arrs = arrsOf(e.id);
        let price = { kind: 'empty', text: 'Tomt' };
        try {
          const { res } = priceOf(e.id), kind = (c && c.customerKind) || 'PRIVATE';
          if (res.status !== 'OK' || res.job.status !== 'OK') price = { kind: 'missing', text: 'Pris saknas' };
          else if (res.job.lines.some(l => l.result.status === 'OK')) price = { kind: 'ok', mark: res.job.statusMark || '', text: kr(kind === 'BUSINESS' ? res.job.totalExVat : res.job.totalIncVat), tail: kind === 'BUSINESS' ? 'exkl. moms' : 'inkl. moms' };
        } catch (x) { price = { kind: 'missing', text: 'Pris saknas' }; }
        return { id: e.id, name: e.name, customer: c ? c.name : '', type: typeLabel(e.type), date: longDate(e.eventDate), arrangements: arrs.length, price };
      });
    }

    // ---------- visning ----------
    function arrPriceHtml(a, ar, customerKind) {
      const r = ar.result;
      if (r.status === 'EMPTY') return '<span class="muted">Tomt: lägg till blommor</span>';
      if (r.status === 'INCOMPLETE') return '<span class="badge warn">Pris saknas</span>';
      const unit = customerKind === 'BUSINESS' ? r.presented.exVat : r.presented.incVat;
      const tail = customerKind === 'BUSINESS' ? ' exkl. moms' : '';
      const one = '<strong>' + esc(r.statusMark) + NBSP + kr(unit) + '</strong>' + tail;
      return a.quantity > 1 ? one + ' × ' + a.quantity + ' = <strong>' + esc(r.statusMark) + NBSP + kr(times(unit, a.quantity)) + '</strong>' + tail : one;
    }

    function breakdownHtml(r) {
      const b = r.breakdown, row = (label, val) => '<dt>' + label + '</dt><dd>' + val + '</dd>';
      const parts = [row('Material (kalkylkostnad)', krFrac(b.materials.total)), row('Påslag', krFrac(b.markup.amount))];
      if (b.fixedPrice && b.fixedPrice.lines.length) parts.push(row('Fasta kundpriser (exkl. moms)', krFrac(b.fixedPrice.exVat)));
      parts.push(row('Arbete', krFrac(b.labor.amount)), row('Summa exkl. moms', krFrac(r.calculated.exVat)), row('Moms', krFrac(r.calculated.vat)), row('Beräknat pris', krFrac(r.calculated.incVat)),
        row('Avrundning', krFrac(r.presented.rounding)), row('Pris till kund', kr(r.presented.incVat)));
      return '<details class="j-how"><summary>Så räknades priset</summary><dl class="lines">' + parts.join('') + '</dl></details>';
    }

    /** Fält för att skriva in priset på en vara som saknar det. Sparas i prislistan (samma som fliken Blommor). */
    function priceFormHtml(productId, name) {
      return '<form class="j-priceform" data-jform="price" data-id="' + esc(productId) + '">'
        + '<p class="small j-priceform-h"><strong>Vad kostar ' + esc(name) + '?</strong> Det du betalar grossisten, exkl. moms.</p>'
        + '<div class="j-priceform-row"><label class="field"><span>Antal per förpackning</span><input name="paket" type="text" inputmode="numeric" value="10" aria-label="Antal per förpackning, ' + esc(name) + '"></label>'
        + '<label class="field"><span>Pris per förpackning (kr)</span><input name="pris" type="text" inputmode="decimal" placeholder="t.ex. 120" aria-label="Pris per förpackning i kronor, ' + esc(name) + '"></label>'
        + '<button type="submit" class="btn">Spara pris</button></div></form>';
    }

    function itemRowHtml(it, catalog) {
      const label = KIND_LABEL[it.source] || it.source;
      let info = '', needsPrice = null;
      if (it.source === 'SUPPLIER') {
        const art = catalog[I.articleKey(it.articleRef)];
        const pp = art && art.packPrice;
        info = pp ? kr(pp) + ' per förpackning om ' + art.packSize : '<span class="badge warn">pris saknas</span>';
        if (!art) info = '<span class="badge warn">finns inte i prislistan</span>';
        else if (!pp) needsPrice = it.articleRef.supplierProductId;
      } else {
        const p = it.pricing, st = I.priceState(it);
        if (p.mode === 'INCLUDED') info = 'Ingår utan extra kostnad (0 kr)';
        else if (p.mode === 'FIXED_SALE_PRICE') info = 'Fast pris ' + kr(Money.fromJSON(p.unitSalePrice.amount)) + (p.unitSalePrice.basis === 'ex' ? ' exkl. moms' : ' inkl. moms') + ' per styck';
        else info = 'Standardpåslag på kalkylkostnad ' + kr(Money.fromJSON(p.unitCostBasis)) + ' per styck';
        if (st === 'PRICE_MISSING') info = '<span class="badge warn">pris saknas</span>';
      }
      const whole = /^\d+$/.test(String(it.quantity));
      const qty = '<div class="stepper j-qty"' + (whole ? '' : ' data-plain="1"') + '>' + (whole ? '<button type="button" class="stepper-btn" data-j="itemstep" data-dir="-1" data-id="' + esc(it.id) + '" aria-label="Färre ' + esc(it.name) + '"' + (+it.quantity <= 1 ? ' disabled' : '') + '>' + icon('minus') + '</button>' : '')
        + '<input type="text" inputmode="decimal" data-jf="itemqty" data-id="' + esc(it.id) + '" value="' + esc(it.quantity) + '" aria-label="Antal ' + esc(it.name) + '">'
        + (whole ? '<button type="button" class="stepper-btn" data-j="itemstep" data-dir="1" data-id="' + esc(it.id) + '" aria-label="Fler ' + esc(it.name) + '">' + icon('plus') + '</button>' : '') + '</div>';
      return '<li class="j-item" data-id="' + esc(it.id) + '"><div class="j-item-main"><div class="j-item-name"><strong>' + esc(it.name) + '</strong> <span class="badge">' + esc(label) + '</span></div><div class="muted small">' + info + '</div></div>'
        + qty + '<button type="button" class="icon-btn j-rm" data-j="rmitem" data-id="' + esc(it.id) + '" aria-label="Ta bort ' + esc(it.name) + '">' + icon('x') + '</button>'
        + (needsPrice ? priceFormHtml(needsPrice, it.name) : '') + '</li>';
    }

    /** Blommorna som kort. Antalet i det öppna arrangemanget syns på kortet. */
    function resultsHtml(catalog, its) {
      const q = String(ui.q || '').trim().toLowerCase();
      const items = view.priceList.items.filter(i => !q || String(i.namn).toLowerCase().includes(q));
      if (!items.length) return '<p class="muted small">Ingen blomma i prislistan matchar. Lägg till nya blommor under Blommor.</p>';
      const have = {}; for (const it of its) if (it.source === 'SUPPLIER' && it.articleRef.connectionId === B.MANUAL_CONNECTION) have[it.articleRef.supplierProductId] = it.quantity;
      return '<ul class="j-tiles">' + items.slice(0, 30).map(i => {
        const art = catalog[B.articleKey(i.id)], pp = art && art.packPrice, n = have[i.id];
        const meta = pp
          ? (art.source.kind === 'STALE' ? 'ca' + NBSP : '') + krFrac(pp.toFrac().div(Frac.of(BigInt(art.packSize)))) + '/st · ' + esc(packLabel(art.unit, art.packSize))
          : 'pris saknas';
        return '<li><button type="button" class="j-tile' + (n ? ' on' : '') + '" data-j="addflower" data-id="' + esc(i.id) + '"' + (i.farg ? ' style="--c:' + esc(i.farg) + '"' : '') + '>'
          + '<span class="j-tile-name">' + esc(i.namn) + '</span><span class="j-tile-meta' + (pp ? '' : ' nop') + '">' + meta + '</span>'
          + (n ? '<span class="j-tile-count" aria-label="' + esc(n) + ' tillagda">' + esc(n) + '</span>' : '') + '</button></li>';
      }).join('') + '</ul>' + (items.length > 30 ? '<p class="muted small">Visar de första 30. Skriv mer i sökfältet.</p>' : '');
    }

    function jobFormHtml() {
      const names = [...new Set(live(ws.customers).map(c => c.name))];
      return '<div class="j-screen j-screen--new"><header class="page-head"><p class="eyebrow">Kundjobb</p><h2 class="display" tabindex="-1" data-focus="1">Nytt jobb</h2>'
        + '<p class="lede">Berätta vem jobbet är till och vad det gäller. Arrangemang och blommor lägger du till sedan.</p></header>'
        + '<form id="jf-job" data-jform="newjob" class="j-form" novalidate>'
        + '<section class="card j-step"><h3 class="j-step-h"><span class="j-step-n" aria-hidden="true">1</span>Kund</h3>'
        + '<label class="field"><span>Kundens namn <span class="hint">(valfritt)</span></span><input id="jf-customer" name="customer" type="text" list="jf-customers" autocomplete="off" placeholder="t.ex. Emma Svensson"></label><datalist id="jf-customers">' + names.map(n => '<option value="' + esc(n) + '">').join('') + '</datalist>'
        + choiceHtml('jf-kind', 'kind', 'PRIVATE', 'Kundtyp', KINDS) + '</section>'
        + '<section class="card j-step"><h3 class="j-step-h"><span class="j-step-n" aria-hidden="true">2</span>Vad gäller det?</h3>'
        + choiceHtml('jf-type', 'type', 'wedding', 'Typ av jobb', EVENT_TYPES.map(([v, t]) => [v, t]))
        + '<label class="field"><span>Datum <span class="hint">(valfritt)</span></span><input id="jf-date" name="date" type="date"></label>'
        + '<label class="field"><span>Jobbets namn <span class="hint">(föreslås, du kan ändra)</span></span><input id="jf-name" name="name" type="text" autocomplete="off" placeholder="t.ex. Emma &amp; Johan"></label></section>'
        + '<div class="j-actions"><button type="submit" class="btn primary lg">Skapa jobb</button>' + (eventsList().length ? '<button type="button" class="btn text" data-j="cancelnewjob">Avbryt</button>' : '') + '</div></form></div>';
    }

    function editFormHtml(ev, customer) {
      const names = [...new Set(live(ws.customers).map(c => c.name))];
      return '<form id="jf-edit" data-jform="edit" class="j-form" novalidate><h2 class="section-title" tabindex="-1" data-focus="1">Ändra uppgifter</h2>'
        + '<label class="field"><span>Kundens namn <span class="hint">(lämna tomt för ingen kund)</span></span><input id="je-customer" name="customer" type="text" list="je-customers" autocomplete="off" value="' + esc(customer ? customer.name : '') + '"></label><datalist id="je-customers">' + names.map(n => '<option value="' + esc(n) + '">').join('') + '</datalist>'
        + '<label class="field"><span>Jobbets namn</span><input id="je-name" name="name" type="text" autocomplete="off" value="' + esc(ev.name) + '"></label>'
        + '<div class="field"><span class="fieldlabel" id="je-type-l">Typ av jobb</span>' + choiceHtml('je-type', 'type', ev.type, 'Typ av jobb', EVENT_TYPES.map(([v, t]) => [v, t])) + '</div>'
        + '<label class="field"><span>Datum <span class="hint">(valfritt)</span></span><input id="je-date" name="date" type="date" value="' + esc(ev.eventDate || '') + '"></label>'
        + '<div class="j-actions"><button type="submit" class="btn primary">Spara ändringar</button><button type="button" class="btn text" data-j="canceledit">Avbryt</button></div></form>';
    }

    function ownFormHtml(kind) {
      const basis = I.defaultPriceBasis(kind);
      return '<details id="j-own" class="j-own"' + (ui.ownOpen ? ' open' : '') + '><summary>' + icon('plus') + '<span>Eget material</span><small>band, vas, kvistar från trädgården …</small></summary>'
        + '<form id="jf-own" data-jform="own" class="j-form" data-pmode="STANDARD_MARKUP" novalidate>'
        + '<label class="field"><span>Vad är det? <span class="hint">(till exempel kvistar, band, vas)</span></span><input id="jf-own-name" name="name" type="text" autocomplete="off"></label>'
        + '<div class="grid-2"><label class="field"><span>Antal</span><input id="jf-own-qty" name="qty" type="text" inputmode="decimal" value="1"></label>'
        + '<label class="field"><span>Varifrån</span><select id="jf-own-source" name="source">' + SOURCES.map(([v, t]) => '<option value="' + v + '">' + t + '</option>').join('') + '</select></label></div>'
        + '<fieldset><legend>Hur ska kunden betala för det?</legend>'
        + '<label class="radio"><input type="radio" name="j-pmode" value="STANDARD_MARKUP" checked><span>Påslag på min kostnad</span><small>Du anger vad det kostar dig, och påslaget läggs på. Ange en kostnad även om du inte köpte något idag.</small></label>'
        + '<label class="field j-cost"><span>Min kostnad per styck, exkl. moms (kr)</span><input id="jf-own-cost" name="cost" type="text" inputmode="decimal" placeholder="t.ex. 25"></label>'
        + '<label class="radio"><input type="radio" name="j-pmode" value="FIXED_SALE_PRICE"><span>Fast pris till kunden</span><small>Kunden betalar precis det du anger, utan påslag.</small></label>'
        + '<div class="grid-2 j-fixed"><label class="field"><span>Pris per styck (kr)</span><input id="jf-own-price" name="price" type="text" inputmode="decimal" placeholder="t.ex. 75"></label>'
        + '<label class="field"><span>Priset är</span><select id="jf-own-basis" name="basis"><option value="inc"' + (basis === 'inc' ? ' selected' : '') + '>inkl. moms</option><option value="ex"' + (basis === 'ex' ? ' selected' : '') + '>exkl. moms</option></select></label></div>'
        + '<label class="radio"><input type="radio" name="j-pmode" value="INCLUDED"><span>Ingår utan extra kostnad</span><small>Kunden betalar inget extra för det här (0 kr). Det är ditt val, inte ett saknat pris.</small></label>'
        + '</fieldset>'
        + '<div class="j-actions"><button type="submit" class="btn primary">Lägg till materialet</button></div></form></details>';
    }

    /** Arrangemangets pris i byggarens fasta prisfält. */
    function pricebarHtml(a, ar, kind, needsPrice) {
      let body;
      if (!a || !ar || ar.result.status === 'EMPTY') body = '<span class="eyebrow">Kundpris</span><span class="j-pb-amt muted">Välj blommor så visas priset</span>';
      else if (ar.result.status === 'INCOMPLETE') body = '<span class="eyebrow">Kundpris</span><span class="j-pb-amt">Pris saknas</span><span class="small muted">Lägg in priset på raden ovan.</span>';
      else {
        const r = ar.result, unit = kind === 'BUSINESS' ? r.presented.exVat : r.presented.incVat, tail = kind === 'BUSINESS' ? 'exkl. moms' : 'inkl. moms';
        body = '<span class="eyebrow">Kundpris</span><span class="j-pb-amt"><span class="j-mark">' + esc(r.statusMark) + '</span> ' + kr(unit) + ' <span class="j-unit">' + tail + '</span></span>'
          + (a.quantity > 1 ? '<span class="small muted">× ' + a.quantity + ' = ' + kr(times(unit, a.quantity)) + '</span>' : '<span class="small muted">' + (r.priceStatus === 'CONFIRMED' ? 'Bekräftat pris' : 'Ungefärligt pris') + '</span>');
      }
      const act = needsPrice && ar && ar.result.status === 'INCOMPLETE' ? '<button type="button" class="btn lg" data-j="gotoprice">Fyll i pris</button>' : '<button type="button" class="btn primary lg" data-j="close">Klart</button>';
      return '<div class="j-pricebar"><div class="j-pb-text">' + body + '</div>' + act + '</div>';
    }

    function builderHtml(ev, a, ar, its, catalog, kind) {
      const fee = a && a.laborOverride && a.laborOverride.mode === 'fixed' ? Money.fromJSON(a.laborOverride.fee) : null;
      const name = a ? a.name : (ui.draftArr.name || 'Bukett'), qty = a ? a.quantity : ui.draftArr.qty;
      const backText = ui.draft ? 'Till startsidan' : 'Tillbaka till jobbet';
      let h = '<section class="j-builder" id="j-detail" aria-label="' + esc(name) + '">'
        + '<div class="j-bhead"><button type="button" class="btn text back" data-j="close">' + icon('back') + '<span>' + backText + '</span></button>'
        + '<p class="eyebrow">Bukettbyggare</p><h2 class="display" tabindex="-1" data-focus="1">' + esc(name) + '</h2>'
        + '<p class="j-meta">' + (ev ? esc(ev.name) : 'Ett nytt arbete. Sparas när du lägger till något.') + '</p></div>'
        + '<section class="card j-block" aria-label="Det här ingår"><h3>Det här ingår</h3>'
        + (its.length ? '<ul class="j-list">' + its.map(i => itemRowHtml(i, catalog)).join('') + '</ul>' : '<p class="muted">Inget tillagt än. Tryck på en blomma nedan.</p>') + '</section>'
        + '<section class="card j-block j-search" aria-label="Lägg till blommor"><h3>Lägg till blommor</h3><label class="field"><span class="vh">Sök blommor</span><input id="j-search" type="search" autocomplete="off" placeholder="Sök i dina blommor" value="' + esc(ui.q) + '"></label>'
        + '<div id="j-results">' + resultsHtml(catalog, its) + '</div></section>'
        + ownFormHtml(kind)
        + '<section class="card j-block" aria-label="Arbete"><h3>Arbete</h3><label class="field"><span>Arbete, kr exkl. moms <span class="hint">(per arrangemang, lämna tomt om inget ska tas ut)</span></span>'
        + '<input id="j-labor" type="text" inputmode="decimal" data-jf="labor" value="' + (fee ? esc(fee.toDecimalString().replace('.', ',').replace(/,00$/, '')) : '') + '" placeholder="t.ex. 125"></label>'
        + (fee ? '<p class="small">Arbete: <strong>' + kr(fee) + '</strong></p>' : '<p class="muted small">Inget arbete angivet. Priset innehåller bara material och påslag.</p>') + '</section>'
        + '<div class="card j-namerow"><label class="field"><span>Namn</span><input id="j-arr-name" type="text" data-jf="arrname" value="' + esc(name) + '"></label>'
        + '<div class="field"><label for="j-arr-qty">Antal likadana</label><div class="stepper"><button type="button" class="stepper-btn" data-j="arrstep" data-dir="-1" aria-label="Färre likadana">' + icon('minus') + '</button>'
        + '<input id="j-arr-qty" type="text" inputmode="numeric" data-jf="arrqty" value="' + qty + '"><button type="button" class="stepper-btn" data-j="arrstep" data-dir="1" aria-label="Fler likadana">' + icon('plus') + '</button></div></div></div>';
      if (ar && ar.result.status === 'OK') h += breakdownHtml(ar.result);
      if (a) h += '<div class="j-dangerzone"><button type="button" class="btn danger text" data-j="rmarr">' + (ui.confirm === 'arr' ? 'Säker? Tryck igen för att ta bort arrangemanget' : 'Ta bort arrangemanget') + '</button></div>';
      const needsPrice = its.some(i => i.source === 'SUPPLIER' && catalog[I.articleKey(i.articleRef)] && !catalog[I.articleKey(i.articleRef)].packPrice);
      h += pricebarHtml(a, ar, kind, needsPrice) + '</section>';
      return h;
    }

    function totalHtml(res, catalog, kind) {
      const job = res.job;
      if (res.status !== 'OK' || job.status !== 'OK') {
        const all = problemsOf(res, catalog);
        return '<p class="eyebrow">Kundpris</p><p class="j-big">Kundpriset kan inte räknas än</p>' + (all.length ? '<ul class="plain">' + all.map(w => '<li>' + esc(w) + '</li>').join('') + '</ul>' : '') + '<p class="muted small">Pris saknas för något. Skriv in det på raden i arrangemanget, under Blommor, eller välj ett fast pris på ett eget material.</p>';
      }
      const hasAny = job.lines.some(l => l.result.status === 'OK');
      if (!hasAny) return '<p class="eyebrow">Kundpris</p><p class="muted">Lägg till arrangemang och blommor så räknas kundpriset här.</p>';
      let h = '<p class="eyebrow">Kundpris för hela jobbet</p>';
      const mark = job.statusMark ? '<span class="j-mark">' + esc(job.statusMark) + '</span> ' : '';
      if (kind === 'BUSINESS') h += '<p class="j-big">' + mark + '<span class="j-amt">' + kr(job.totalExVat) + '</span> <span class="j-unit">exkl. moms</span></p><p>+ moms ' + kr(job.totalVat) + ' = <strong>' + kr(job.totalIncVat) + '</strong> inkl. moms</p>';
      else h += '<p class="j-big">' + mark + '<span class="j-amt">' + kr(job.totalIncVat) + '</span> <span class="j-unit">inkl. moms</span></p><p class="muted small">varav moms ' + kr(job.totalVat) + '</p>';
      h += '<p class="muted small">' + (job.priceStatus === 'CONFIRMED' ? '✓ Alla priser är bekräftade.' : '≈ Ungefärligt: något pris är äldre än idag.') + '</p>';
      if (!job.rule.allVerified) h += '<p class="muted small">Moms: din egen inställning (' + esc(ws.shop.pricing.legacyVatPercent) + ' %), inte kontrollerad mot en officiell regel. Priset är ett arbetsunderlag, inte en faktura.</p>';
      h += '<button type="button" class="btn primary" data-j="opencalc">' + icon('calc') + '<span>Se kalkyl och inköp</span></button>';
      return h;
    }

    /** Kalkyl och inköp: hur kundpriset byggs upp, de tre prisnivåerna och vad som ska köpas. Allt kommer ur priceEvent(). */
    function calcHtml(ev, res, catalog, kind) {
      const job = res.job;
      let h = '<section class="j-calc" id="j-calc" aria-label="Kalkyl och inköp"><div class="j-bhead"><button type="button" class="btn text back" data-j="closecalc">' + icon('back') + '<span>Tillbaka till jobbet</span></button>'
        + '<p class="eyebrow">' + esc(ev.name) + '</p><h2 class="display" tabindex="-1" data-focus="1">Kalkyl och inköp</h2></div>';
      if (res.status !== 'OK' || job.status !== 'OK') {
        const all = problemsOf(res, catalog);
        return h + '<div class="card"><p class="j-big">Kalkylen kan inte räknas än</p>' + (all.length ? '<ul class="plain">' + all.map(w => '<li>' + esc(w) + '</li>').join('') + '</ul>' : '') + '<p class="muted small">Pris saknas för något. Skriv in det på raden i arrangemanget, så räknas allt här.</p></div></section>';
      }
      const lines = job.lines.filter(l => l.result.status === 'OK');
      if (!lines.length) return h + '<div class="card"><p class="muted">Lägg till arrangemang och blommor så räknas kalkylen här.</p></div></section>';
      const sum = pick => Frac.sum(lines.map(l => pick(l.result).mul(Frac.of(BigInt(l.qty)))));
      const material = sum(r => r.breakdown.materials.total), markup = sum(r => r.breakdown.markup.amount), labor = sum(r => r.breakdown.labor.amount), fixed = sum(r => r.breakdown.fixedPrice.exVat);
      const hasFixed = lines.some(l => l.result.breakdown.fixedPrice && l.result.breakdown.fixedPrice.lines.length);
      const fees = job.fees && job.fees.length ? Frac.sum(job.fees.map(f => f.amounts.exVat.toFrac())) : null;
      const mark = job.statusMark ? job.statusMark + NBSP : '';
      const row = (label, val, cls) => '<dt' + (cls ? ' class="' + cls + '"' : '') + '>' + label + '</dt><dd' + (cls ? ' class="' + cls + '"' : '') + '>' + val + '</dd>';
      // 1. kundpriset och vad det består av
      h += '<section class="card j-block"><p class="eyebrow">Kundpris</p><p class="j-big"><span class="j-mark">' + esc(job.statusMark || '') + '</span> <span class="j-amt">' + kr(kind === 'BUSINESS' ? job.totalExVat : job.totalIncVat) + '</span> <span class="j-unit">' + (kind === 'BUSINESS' ? 'exkl. moms' : 'inkl. moms') + '</span></p>'
        + '<h3>Så byggs priset upp</h3><dl class="lines j-calc-lines">'
        + row('Material (din kalkylkostnad)', krFrac(material)) + row('Påslag', krFrac(markup)) + (hasFixed ? row('Fasta kundpriser (exkl. moms)', krFrac(fixed)) : '') + row('Arbete', krFrac(labor)) + (fees ? row('Avgifter', krFrac(fees)) : '')
        + row('Summa exkl. moms', krFrac(job.calculated.exVat), 'sum') + row('Moms', krFrac(job.calculated.vat)) + row('Beräknat pris inkl. moms', krFrac(job.calculated.incVat), 'sum')
        + row('Avrundning', krFrac(job.presented.rounding)) + row('Pris till kund inkl. moms', kr(job.totalIncVat), 'sum') + '</dl>'
        + '<p class="muted small">Belopp visas avrundade till ören. Räknat av appens prismotor, aldrig av AI.</p></section>';
      // 2. beräknat, presenterat, överenskommet
      const order = (ws.orders || []).filter(x => x.eventId === ev.id && x.deletedAt === null && x.status === 'active')[0] || null;
      h += '<section class="card j-block"><h3>Beräknat, presenterat och överenskommet</h3><dl class="lines j-levels">'
        + row('Beräknat <small>exakt, före avrundning</small>', krFrac(job.calculated.incVat))
        + row('Presenterat <small>det du säger till kunden</small>', kr(job.totalIncVat))
        + (order ? row('Överenskommet <small>kundens ja, version ' + esc(order.version) + '</small>', kr(Money.fromJSON(order.totals.agreedIncVat))) : '') + '</dl>'
        + (order ? '<p class="muted small">Det överenskomna priset är sparat och ändras aldrig av att kalkylen ändras. ' + (Money.fromJSON(order.totals.presentedIncVat).amount === job.totalIncVat.amount ? '' : 'Kalkylen ovan har ändrats sedan dess.') + '</p>' : '')
        + '</section>';
      // 3. inköp
      const plan = res.plan, reqs = plan.requirements;
      h += '<section class="card j-block"><h3>Inköp hos grossisten</h3>';
      if (!reqs.length) h += '<p class="muted">Inga grossistvaror att köpa i det här jobbet.</p>';
      else {
        h += '<ul class="j-buy">' + reqs.map(r => '<li class="j-buy-row"><div class="j-buy-name"><strong>' + esc((catalog[r.key] && catalog[r.key].name) || r.name) + '</strong><span class="muted small">' + esc(packLabel((catalog[r.key] || {}).unit, r.packSize)) + (r.hasPrice ? ' · ' + kr(r.packPrice) + ' per förpackning' : '') + '</span></div>'
          + (r.hasPrice
            ? '<div class="j-buy-num"><span>Behövs <b>' + r.needed + '</b></span><span>Köp <b>' + r.packs + ' × ' + r.packSize + '</b> = ' + r.bought + '</span><span class="' + (r.leftover > 0 ? 'over' : '') + '">Över <b>' + r.leftover + '</b></span><span class="j-buy-cost">' + krFrac(r.cost) + '</span></div>'
            : '<div class="j-buy-num"><span>Behövs <b>' + r.needed + '</b></span><span class="badge warn">pris saknas</span></div>') + '</li>').join('') + '</ul>'
          + '<dl class="lines j-calc-lines">' + row('Summa inköp, exkl. moms' + (plan.noPrice.length ? ' (delsumma)' : ''), krFrac(plan.purchaseSum), 'sum')
          + (plan.shipping.total.gt(0n) ? row('Frakt', krFrac(plan.shipping.total)) : '') + '</dl>'
          + '<p class="muted small">Blir över: ' + plan.leftover.stems + ' stjälkar, värde ' + krFrac(plan.leftover.value) + '. ' + (ws.shop.pricing.packMode === 'WHOLE_PACKS' ? 'Det ingår i kundpriset, eftersom hela förpackningen debiteras.' : 'Det tas inte ut i kundpriset.') + '</p>';
      }
      if (res.needs.elsewhere.length) h += '<p class="small"><strong>Köps någon annanstans:</strong> ' + res.needs.elsewhere.map(x => esc(x.name) + ' (' + esc(fracText(x.quantity)) + ')').join(', ') + '.</p>';
      if (res.needs.notOrdered.length) h += '<p class="small muted">Beställs inte (eget lager och egen trädgård): ' + [...new Set(res.needs.notOrdered.map(x => x.name))].map(esc).join(', ') + '.</p>';
      h += '</section></section>';
      return h;
    }

    function blockedHtml() {
      const b = ui.blocked;
      const why = b.reason === 'corrupt' || b.reason === 'invalid' ? 'Det sparade jobbunderlaget går inte att läsa. Det är inte överskrivet och inte raderat.' : 'Lagringen i den här webbläsaren är inte tillgänglig, så jobben kan inte sparas här.';
      return '<div class="note bad" role="alert">' + esc(why) + ' De andra flikarna fungerar som vanligt och är inte påverkade.</div>';
    }

    function render() {
      const before = ui.mode;
      let mode = 'overview';
      if (ui.blocked) { host.innerHTML = blockedHtml(); ui.mode = 'blocked'; modeChanged(before); return; }
      if (!ws) { host.innerHTML = '<p class="muted">Läser in jobben…</p>'; return; }
      const evs = eventsList(), ev = evs.find(e => e.id === ui.eventId) || null;
      const customer = customerOf(ev), kind = (customer && customer.customerKind) || 'PRIVATE';
      let body = '';
      const alertHtml = ui.msg ? '<div class="note ' + esc(ui.msg.kind) + ' j-alert" id="j-alert" role="alert">' + esc(ui.msg.text) + '</div>' : '';
      const noteNow = ui.note;
      if (ui.draft && !ui.newJob) {
        mode = 'builder';
        const { catalog } = B.catalogFromView(view, { today: todayStr() });
        body = builderHtml(null, null, null, [], catalog, 'PRIVATE');
      } else if (ui.newJob || !ev) { mode = 'new'; body = jobFormHtml(); }
      else {
        let priced0;
        try { priced0 = priceOf(ev.id); } catch (e) { host.innerHTML = '<div class="j-wrap"><div class="note bad" role="alert">' + esc(messageOf(e)) + '</div></div>'; return; }
        const { res, catalog } = priced0;
        const arrs = arrsOf(ev.id), priced = new Map(res.arrangements.map(x => [x.arrangementId, x]));
        const a = arrs.find(x => x.id === ui.arrId) || null;
        mode = a ? 'builder' : ui.view === 'calc' ? 'calc' : 'overview';
        // 1. kund och jobb
        let top = '<section class="card j-job" aria-label="Kund och jobb">';
        if (ui.editJob) top += editFormHtml(ev, customer);
        else {
          top += '<div class="j-job-top"><div><p class="eyebrow">Kundjobb</p><h2 class="display j-job-name">' + esc(ev.name) + '</h2>'
            + '<p class="j-meta">' + (customer ? esc(customer.name) + ' · ' : 'Ingen kund · ') + esc(typeLabel(ev.type)) + (ev.eventDate ? ' · ' + esc(longDate(ev.eventDate)) : '') + '</p></div>'
            + '<button type="button" class="btn sm" data-j="editjob">Ändra uppgifter</button></div>';
          top += '<details class="j-more" id="j-more"' + (ui.moreOpen ? ' open' : '') + '><summary>Byt jobb, kundtyp, ta bort</summary><div class="j-job-ctl">'
            + '<label class="field j-switch" data-count="' + evs.length + '"><span>Jobb</span><select id="j-job" data-jf="job">' + evs.map(e => { const c = customerOf(e); return '<option value="' + esc(e.id) + '"' + (e.id === ev.id ? ' selected' : '') + '>' + esc(e.name + (c && !e.name.includes(c.name) ? ' (' + c.name + ')' : '') + (e.eventDate ? ', ' + longDate(e.eventDate) : '')) + '</option>'; }).join('') + '</select></label>';
          if (customer) top += '<label class="field"><span>Kundtyp</span><select id="j-kind" data-jf="kind"><option value="PRIVATE"' + (kind === 'PRIVATE' ? ' selected' : '') + '>Privatkund (priser inkl. moms)</option><option value="BUSINESS"' + (kind === 'BUSINESS' ? ' selected' : '') + '>Företag (priser exkl. moms)</option></select></label>';
          top += '<div class="row"><button type="button" class="btn sm" data-j="newjob">' + icon('plus') + '<span>Nytt jobb</span></button></div>';
          top += '</div>';
          if (ev.origin && ev.origin.kind === 'legacy_order') top += '<p class="muted small">Det här jobbet kom från din order i fliken Snabbkalkyl. Ändringar här ändrar inte den.</p>';
          top += '<div class="j-dangerzone"><button type="button" class="btn danger text" data-j="rmjob">' + (ui.confirm === 'job' ? 'Säker? Tryck igen för att ta bort jobbet' : 'Ta bort jobbet') + '</button></div></details>';
        }
        top += '</section>';
        // 2. arrangemang
        let arr = '<section class="j-section j-arrs" aria-label="Arrangemang"><h2 class="section-title">Arrangemang</h2>';
        arr += arrs.length ? '<ul class="j-list">' + arrs.map(x => {
          const ar = priced.get(x.id), open = x.id === ui.arrId;
          return '<li class="j-arr' + (open ? ' on' : '') + '" data-id="' + esc(x.id) + '"><div class="j-item-main"><button type="button" class="link" data-j="open" data-id="' + esc(x.id) + '" aria-expanded="' + open + '">' + esc(x.name) + (x.quantity > 1 ? ' ×' + x.quantity : '') + '</button>'
            + '<div class="small">' + (ar ? arrPriceHtml(x, ar, kind) : '') + '</div></div><span class="j-arr-go" aria-hidden="true">' + icon('next') + '</span></li>';
        }).join('') + '</ul>' : '<p class="muted">Inga arrangemang än. Ett arrangemang kan vara en brudbukett, bordsdekorationer eller en krans. Lägg till det första här under.</p>';
        arr += '<form id="jf-arr" data-jform="arr" class="card j-addarr" novalidate><label class="field"><span>Namn på arrangemanget</span><input id="jf-arr-name" name="name" type="text" autocomplete="off" placeholder="t.ex. Brudbukett"></label>'
          + '<div class="field"><label for="jf-arr-qty">Antal</label><div class="stepper"><button type="button" class="stepper-btn" data-j="fieldstep" data-for="jf-arr-qty" data-dir="-1" aria-label="Färre">' + icon('minus') + '</button>'
          + '<input id="jf-arr-qty" name="qty" type="text" inputmode="numeric" value="1"><button type="button" class="stepper-btn" data-j="fieldstep" data-for="jf-arr-qty" data-dir="1" aria-label="Fler">' + icon('plus') + '</button></div></div>'
          + '<button type="submit" class="btn' + (arrs.length ? '' : ' primary') + '">' + icon('plus') + '<span>Lägg till arrangemang</span></button></form></section>';
        // 4. kundpris
        const tot = '<section class="card j-total" id="j-total" aria-label="Kundpris">' + totalHtml(res, catalog, kind) + '</section>';
        body = '<div class="j-overview">' + top + arr + tot + '</div>' + (a ? builderHtml(ev, a, priced.get(a.id), itemsOf(a.id), catalog, kind) : '') + (mode === 'calc' ? calcHtml(ev, res, catalog, kind) : '');
      }
      ui.mode = mode;
      const noteHtml = noteNow && mode === 'overview' ? '<div class="note ' + esc(noteNow.kind) + '">' + esc(noteNow.text) + '</div>' : '';
      if (noteNow && mode !== 'overview' && mode !== 'blocked') ui.note = null;          // noten har setts: den följer inte med in i byggaren
      host.innerHTML = '<div class="j-wrap" data-mode="' + mode + '"><h1 class="vh">Jobb</h1><div id="j-status" role="status" aria-live="polite" class="j-status">' + (ui.saved === true ? 'Sparat ✓' : ui.saved === false ? 'Inte sparat' : '') + '</div>' + alertHtml + noteHtml + body + '</div>';
      modeChanged(before);
      if (ui.msgFresh) { ui.msgFresh = false; const al = host.querySelector('#j-alert'); if (al && al.scrollIntoView) al.scrollIntoView({ block: 'center' }); }
      if (ui.focusPriceFor) { const id = ui.focusPriceFor; ui.focusPriceFor = null; focusPrice(id); }
      announce(); notify();
    }

    /** När läget byter (till exempel från jobbet till byggaren) flyttas fokus till rubriken och sidan rullas upp. */
    const FOCUS = { builder: '#j-detail [data-focus]', calc: '#j-calc [data-focus]', new: '.j-screen--new [data-focus]', overview: '.j-job-name' };
    function modeChanged(before) {
      if (o.onMode) o.onMode(ui.mode);
      const moved = before !== null && before !== ui.mode;
      if (!moved && !ui.focusNext) return;
      if (host.hidden) return;                                   // fliken syns inte än: fokus flyttas när den visas (focusNext ligger kvar)
      ui.focusNext = false;
      try { doc.defaultView.scrollTo(0, 0); } catch (e) { /* ingen rullning i den här miljön */ }
      const t = host.querySelector(FOCUS[ui.mode] || '.j-wrap');
      if (t) { if (!t.hasAttribute('tabindex')) t.setAttribute('tabindex', '-1'); if (t.focus) t.focus({ preventScroll: true }); }
    }
    /** Läser upp kundpriset när det ändras (skärmläsare). Själva ritningen byter ut hela elementet, så den kan inte själv vara en live-region. */
    let lastSaid = '';
    function announce() {
      const el = ui.mode === 'builder' ? host.querySelector('.j-pb-text') : null;
      const text = el ? el.innerHTML.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() : '';          // med mellanrum mellan elementen, så att det läses som en mening
      if (text && text !== lastSaid && o.announce) o.announce(text);
      lastSaid = text;
    }

    // ---------- händelser ----------
    function currentEvent() { return ws.events.find(e => e.id === ui.eventId && e.deletedAt === null); }
    /** Fel från formulär visas i formuläret (fälten behålls), övriga fel som ruta överst. */
    const guard = (fn, form) => async () => {
      try { await fn(); }
      catch (e) {
        if (form && form.isConnected && e instanceof UserError) { formError(form, e.message); return; }
        ui.msg = { kind: 'bad', text: messageOf(e) }; ui.msgFresh = true; ui.saved = null; render();
      }
    };
    function formError(form, text) {
      ui.msg = null; const old = host.querySelector('#j-alert'); if (old) old.remove();          // ett nytt fel i formuläret ersätter en äldre ruta överst
      let el = form.querySelector('.form-error');
      if (!el) { el = doc.createElement('p'); el.className = 'note bad form-error'; el.setAttribute('role', 'alert'); const act = form.querySelector('.j-actions'); form.insertBefore(el, act || null); }
      el.textContent = text;
      if (el.scrollIntoView) el.scrollIntoView({ block: 'center' });
    }
    /** Flyttar till prisfältet för en vara som saknar pris, så att man ser frågan där man är. */
    function focusPrice(productId) {
      const f = host.querySelector(productId ? '.j-priceform[data-id="' + productId + '"]' : '.j-priceform');
      if (!f) return;
      if (f.scrollIntoView) f.scrollIntoView({ block: 'center' });
      const inp = f.querySelector('input[name="pris"]'); if (inp && inp.focus) inp.focus({ preventScroll: true });
    }
    function suggestName(form) {
      const name = form.elements.name; if (!name || name.dataset.touched) return;
      const cust = String((form.elements.customer || {}).value || '').trim(), t = typeLabel((form.elements.type || {}).value);
      name.value = cust ? cust + ' – ' + t : t;
    }
    const intOf = s => M.toSafeInt(M.parseDecimal(String(s)).n);
    const atLeast1 = n => (n < 1 ? 1 : n);
    const stepQty = (item, dir) => atLeast1(intOf(item.quantity) + dir);

    host.addEventListener('click', e => {
      const t = e.target.closest('[data-j]'); if (!t || !host.contains(t)) return;
      const id = t.dataset.id, cmd = t.dataset.j;
      if (cmd !== 'rmjob' && cmd !== 'rmarr' && ui.confirm) { ui.confirm = null; }
      if (cmd === 'newjob' || cmd === 'cancelnewjob') { ui.newJob = cmd === 'newjob'; ui.arrId = null; render(); return; }
      if (cmd === 'editjob') { ui.editJob = true; render(); return; }
      if (cmd === 'canceledit') { ui.editJob = false; render(); return; }
      if (cmd === 'open') { ui.arrId = ui.arrId === id ? null : id; ui.view = 'job'; ui.q = ''; render(); return; }
      if (cmd === 'close') {
        if (ui.draft) { ui.draft = false; ui.draftArr = { name: '', qty: 1 }; ui.q = ''; render(); if (o.navigate) o.navigate('hem'); return; }
        ui.arrId = null; render(); return;
      }
      if (cmd === 'gotoprice') { focusPrice(); return; }
      if (cmd === 'opencalc') { ui.view = 'calc'; render(); return; }
      if (cmd === 'closecalc') { ui.view = 'job'; render(); return; }
      if (cmd === 'rmjob') {
        if (ui.confirm !== 'job') { ui.confirm = 'job'; ui.moreOpen = true; render(); return; }
        ui.confirm = null; const evId = ui.eventId;
        track(guard(async () => { await change((d, c) => W.removeEvent(d, c, evId)); ui.eventId = null; ui.arrId = null; const evs = eventsList(); ui.eventId = evs.length ? evs[0].id : null; ui.newJob = !evs.length; render(); })());
        return;
      }
      if (cmd === 'rmarr') {
        if (ui.confirm !== 'arr') { ui.confirm = 'arr'; render(); return; }
        ui.confirm = null; const arrId = ui.arrId;
        track(guard(() => change((d, c) => W.removeArrangement(d, c, arrId), () => { ui.arrId = null; }))());
        return;
      }
      if (cmd === 'rmitem') { track(guard(() => change((d, c) => W.removeItem(d, c, id)))()); return; }
      if (cmd === 'itemstep') {
        const dir = +t.dataset.dir;
        track(guard(() => change((d, c) => { const it = W.itemsOf(d, ui.arrId).find(x => x.id === id); return W.updateItem(d, c, id, { quantity: stepQty(it, dir) }); }))());
        return;
      }
      if (cmd === 'arrstep') {
        const dir = +t.dataset.dir;
        if (!ui.arrId) { ui.draftArr.qty = atLeast1(ui.draftArr.qty + dir); render(); return; }
        track(guard(() => change((d, c) => { const a = d.arrangements.find(x => x.id === ui.arrId); return W.updateArrangement(d, c, ui.arrId, { quantity: atLeast1(a.quantity + dir) }); }))());
        return;
      }
      if (cmd === 'fieldstep') {
        const inp = host.querySelector('#' + t.dataset.for); if (!inp) return;
        const cur = INT_RE.test(squash(inp.value)) ? intOf(squash(inp.value)) : 1;
        inp.value = String(atLeast1(cur + (+t.dataset.dir))); return;
      }
      if (cmd === 'addflower') {
        const art = view.priceList.items.find(i => i.id === id); if (!art) return;
        if (!(+art.pris > 0)) ui.focusPriceFor = id;
        track(guard(() => changeInArr((d, c, arrId) => {
          const same = W.itemsOf(d, arrId).find(i => i.source === 'SUPPLIER' && i.articleRef.connectionId === B.MANUAL_CONNECTION && i.articleRef.supplierProductId === id);
          if (same) return W.updateItem(d, c, same.id, { quantity: M.toSafeInt(M.parseDecimal(same.quantity).add(Frac.of(1n)).n) });
          return W.addItem(d, c, arrId, { source: 'SUPPLIER', name: art.namn, articleRef: { connectionId: B.MANUAL_CONNECTION, supplierProductId: id }, quantity: 1 });
        }))());
      }
    });

    host.addEventListener('change', e => {
      const t = e.target;
      if (t.dataset && t.dataset.choice) {                  // val-knapp: det dolda fältet följer med
        const hid = host.querySelector('#' + t.dataset.choice); if (hid) hid.value = t.value;
        const form = t.closest('form'); if (form && t.dataset.choice.endsWith('type')) suggestName(form);
        return;
      }
      if ((t.id === 'jf-type' || t.id === 'jf-kind' || t.id === 'je-type') && t.type === 'hidden') {          // det dolda fältet sattes direkt: knapparna följer med
        host.querySelectorAll('input[data-choice="' + t.id + '"]').forEach(r => { r.checked = r.value === t.value; });
        if (t.id !== 'jf-kind') suggestName(t.closest('form'));
        return;
      }
      if (t.name === 'j-pmode') { const form = t.closest('form'); if (form) form.dataset.pmode = t.value; return; }
      const f = t.dataset && t.dataset.jf; if (!f) return;
      if (f === 'job') { ui.eventId = t.value; ui.arrId = null; ui.q = ''; ui.confirm = null; ui.editJob = false; ui.view = 'job'; render(); return; }
      track(guard(async () => {
        const ev = currentEvent();
        if (f === 'kind') { const c = ev && customerOf(ev); if (c) await change((d, cx) => W.updateCustomer(d, cx, c.id, { customerKind: t.value })); return; }
        if (f === 'arrname') {
          const n = needText(t.value, 'Namnet');
          if (!ui.arrId) { ui.draftArr.name = n; return; }
          await change((d, c) => W.updateArrangement(d, c, ui.arrId, { name: n })); return;
        }
        if (f === 'arrqty') {
          const n = parseCount(t.value, 'Antalet arrangemang', 1);
          if (!ui.arrId) { ui.draftArr.qty = n; return; }
          await change((d, c) => W.updateArrangement(d, c, ui.arrId, { quantity: n })); return;
        }
        if (f === 'labor') {
          const v = squash(t.value);
          const labor = v === '' ? null : { mode: 'fixed', fee: parseMoney(v, 'arbetet').toJSON() };
          await changeInArr((d, c, arrId) => W.updateArrangement(d, c, arrId, { laborOverride: labor })); return;
        }
        if (f === 'itemqty') { const q = parseQty(t.value); await change((d, c) => W.updateItem(d, c, t.dataset.id, { quantity: q })); }
      })());
    });

    host.addEventListener('toggle', e => { if (e.target && e.target.id === 'j-own') ui.ownOpen = e.target.open; if (e.target && e.target.id === 'j-more') ui.moreOpen = e.target.open; }, true);

    host.addEventListener('input', e => {
      const t = e.target;
      if (t.id === 'j-search') {
        ui.q = t.value;
        const box = host.querySelector('#j-results');
        if (box) { const a = ui.arrId ? itemsOf(ui.arrId) : []; box.innerHTML = resultsHtml(B.catalogFromView(view, { today: todayStr() }).catalog, a); }          // bara träfflistan ritas om, inte fältet man skriver i
        return;
      }
      if (t.name === 'name' && t.closest('form[data-jform="newjob"]')) { t.dataset.touched = '1'; return; }
      if (t.name === 'customer') { const form = t.closest('form[data-jform="newjob"]'); if (form) suggestName(form); }
    });

    host.addEventListener('submit', e => {
      const form = e.target.closest('form[data-jform]'); if (!form) return;
      e.preventDefault();
      const val = n => { const el = form.elements[n]; return el ? el.value : ''; };
      const kind = form.dataset.jform;
      track(guard(async () => {
        if (kind === 'newjob') {
          const name = needText(val('name'), 'Jobbets namn'), customerName = String(val('customer')).trim();
          const type = val('type'), date = val('date') || null, custKind = val('kind');
          const id = await change((d, c) => {
            let cu = null;
            if (customerName) { cu = live(d.customers).find(x => x.name.trim().toLowerCase() === customerName.toLowerCase()) || W.addCustomer(d, c, { name: customerName, customerKind: custKind }); }
            return W.createEvent(d, c, { name, customerId: cu ? cu.id : null, type, eventDate: date }).id;
          });
          if (id) { ui.eventId = id; ui.arrId = null; ui.newJob = false; ui.draft = false; ui.ownOpen = false; ui.moreOpen = false; ui.view = 'job'; render(); }
          return;
        }
        if (kind === 'edit') {
          const ev = currentEvent(); if (!ev) throw new UserError('Jobbet finns inte längre.');
          const name = needText(val('name'), 'Jobbets namn'), customerName = String(val('customer')).trim(), type = val('type'), date = val('date') || null;
          const ok = await change((d, c) => {
            let cu = null;
            const cur = d.events.find(x => x.id === ev.id), curC = cur.customerId ? d.customers.find(x => x.id === cur.customerId) : null;
            if (customerName) {
              cu = live(d.customers).find(x => x.name.trim().toLowerCase() === customerName.toLowerCase());
              if (!cu && curC && live(d.events).filter(x => x.customerId === curC.id).length === 1) cu = W.updateCustomer(d, c, curC.id, { name: customerName });      // rättar stavningen om ingen annan använder kunden
              if (!cu) cu = W.addCustomer(d, c, { name: customerName, customerKind: curC ? curC.customerKind : 'PRIVATE' });
            }
            W.updateEvent(d, c, ev.id, { name, customerId: cu ? cu.id : null, type, eventDate: date });
            return true;
          });
          if (ok) { ui.editJob = false; render(); }
          return;
        }
        if (kind === 'price') {
          if (!o.setPrice) throw new UserError('Det går inte att skriva in priser här just nu. Skriv in det under Blommor.');
          const paket = parseCount(val('paket'), 'Antal per förpackning', 1), pris = parseMoney(val('pris'), 'priset per förpackning');
          if (pris.amount <= 0n) throw new UserError('Priset måste vara större än noll. Saknas priset, lämna raden som den är.');
          o.setPrice(form.dataset.id, { paket, pris: pris.toDecimalString() });
          view = o.getView(); render(); return;
        }
        if (kind === 'arr') {
          const ev = currentEvent(); if (!ev) throw new UserError('Skapa eller välj ett jobb först.');
          const name = needText(val('name'), 'Namnet på arrangemanget'), qty = parseCount(val('qty'), 'Antalet arrangemang', 1);
          const id = await change((d, c) => W.addArrangement(d, c, ev.id, { name, quantity: qty }).id);
          if (id) { ui.arrId = id; ui.q = ''; ui.view = 'job'; render(); }
          return;
        }
        if (kind === 'own') {
          if (!ui.arrId && !ui.draft) throw new UserError('Öppna ett arrangemang först.');
          const name = needText(val('name'), 'Namnet på tillägget'), qty = parseQty(val('qty')), source = val('source');
          const mode = (form.querySelector('input[name="j-pmode"]:checked') || {}).value || 'STANDARD_MARKUP';
          let pricing;
          if (mode === 'STANDARD_MARKUP') pricing = { mode, unitCostBasis: parseMoney(val('cost'), 'kalkylkostnaden').toJSON() };
          else if (mode === 'FIXED_SALE_PRICE') pricing = { mode, unitSalePrice: { amount: parseMoney(val('price'), 'priset').toJSON(), basis: val('basis') } };
          else pricing = { mode: 'INCLUDED' };
          const spec = { source, name, quantity: qty, pricing };
          if (source === 'MANUAL') spec.requiresPurchase = true;
          const snap = [...form.elements].filter(el => el.name && el.type !== 'radio' && el.type !== 'submit').map(el => [el.name, el.value]);
          const r = await changeInArr((d, c, arrId) => W.addItem(d, c, arrId, spec));
          if (r) { ui.ownOpen = false; render(); }
          else { ui.ownOpen = true; const nf = host.querySelector('#jf-own'); if (nf) { for (const [n, v] of snap) if (nf.elements[n]) nf.elements[n].value = v; const rd = nf.querySelector('input[name="j-pmode"][value="' + mode + '"]'); if (rd) { rd.checked = true; nf.dataset.pmode = mode; } const od = host.querySelector('#j-own'); if (od) od.open = true; } }
        }
      }, form)());
    });

    return {
      activate: () => track(activate()),
      idle: async () => { while (inflight.size) await Promise.all([...inflight]); },
      state: () => (ws ? JSON.parse(JSON.stringify(ws)) : null),
      view: () => view,
      mode: () => ui.mode,
      blocked: () => !!ui.blocked,
      summaries,
      /** Öppnar byggaren utan jobb. Jobbet skapas när något läggs till. */
      startDraft() { ui.focusNext = true; ui.draft = true; ui.newJob = false; ui.editJob = false; ui.arrId = null; ui.view = 'job'; ui.draftArr = { name: '', qty: 1 }; ui.q = ''; ui.confirm = null; if (ws || ui.blocked) render(); },
      /** Öppnar formuläret för ett nytt jobb. */
      startNewJob() { ui.focusNext = true; ui.newJob = true; ui.draft = false; ui.editJob = false; ui.arrId = null; ui.view = 'job'; ui.confirm = null; if (ws || ui.blocked) render(); },
      /** Öppnar ett jobb (och eventuellt ett arrangemang) från startsidan. */
      openJob(id) { ui.focusNext = true; ui.eventId = id; ui.arrId = null; ui.newJob = false; ui.draft = false; ui.editJob = false; ui.view = 'job'; ui.confirm = null; if (ws || ui.blocked) render(); }
    };
  }

  return { mount, kr, messageOf };
});
