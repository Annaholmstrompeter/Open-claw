/* Buketträknaren: den minimala jobbskärmen ("Jobb"-fliken).
 *
 * Bara det som behövs för att pröva det riktiga arbetsflödet:
 *   skapa kund och jobb → skapa arrangemang → lägga till blomma → lägga till eget material → ange arbete → se kundpris → öppna igen.
 *
 * Skärmen räknar ingenting själv. Allt går via arbetsytan (workspace.js), prismotorn och bryggan (bridge.js). Priserna kommer från den
 * gamla prislistan (bryggan bygger katalogen vid varje visning). Ändringar sparas direkt (store.js): det finns ingen Spara-knapp
 * att glömma, och "Sparat ✓" visar att det gick. Går det inte att spara står det, och det man ser finns då bara kvar i sidan.
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
  const NBSP = ' ';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const MONTHS = ['januari', 'februari', 'mars', 'april', 'maj', 'juni', 'juli', 'augusti', 'september', 'oktober', 'november', 'december'];
  const EVENT_TYPES = [['wedding', 'Bröllop'], ['funeral', 'Begravning'], ['bouquet', 'Bukett'], ['other', 'Annat']];
  const SOURCES = [['OWN_STOCK', 'Eget lager'], ['HOME_GROWN', 'Egen trädgård'], ['MANUAL', 'Köpt separat']];
  const KIND_LABEL = { SUPPLIER: 'Grossist', OWN_STOCK: 'Eget lager', HOME_GROWN: 'Egen trädgård', MANUAL: 'Köpt separat' };

  // ---------- visning av belopp (heltalsaritmetik) ----------
  const group = digits => digits.replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
  function kr(m) {                                               // Money → "1 495 kr" eller "667,75 kr"
    const neg = m.amount < 0n, a = neg ? -m.amount : m.amount, whole = a / 100n, ore = a % 100n;
    return (neg ? '−' : '') + group(String(whole)) + (ore === 0n ? '' : ',' + String(ore).padStart(2, '0')) + NBSP + 'kr';
  }
  const krFrac = f => kr(Money.fromFrac(f, ROUNDING.HALF_UP, 'SEK'));      // bara för visning av ett exakt bråk i ören
  const times = (m, n) => Money.of(m.amount * BigInt(n), m.currency);
  const longDate = d => (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)) ? parseInt(d.slice(8, 10), 10) + ' ' + MONTHS[parseInt(d.slice(5, 7), 10) - 1] : '';

  class UserError extends Error {}
  const MONEY_RE = /^\d{1,9}([.,]\d{1,2})?$/, INT_RE = /^\d{1,6}$/, DEC_RE = /^\d{1,6}([.,]\d{1,3})?$/;
  const squash = t => String(t == null ? '' : t).replace(/[\s ]/g, '');
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

  // ---------- montering ----------
  /**
   * Monterar jobbskärmen i host. opts: { getView: () => den gamla appens vy, today: () => 'ÅÅÅÅ-MM-DD', storage: localStorage (eller likt), ctx?: { now, newId } }.
   * Ger { activate, idle, state, view }. activate() läser om och visar. idle() väntar tills allt är sparat (för tester).
   */
  function mount(host, opts) {
    const o = opts || {};
    const adapter = S.createLocalStorageAdapter(o.storage);
    const ctx = o.ctx || W.defaultContext();
    const store = S.createWorkspaceStore(adapter, W, ctx, { create: {} });
    const doc = host.ownerDocument;
    const ui = { eventId: null, arrId: null, q: '', msg: null, saved: null, newJob: false, ownOpen: false, confirm: null, note: null, blocked: null };
    let ws = null, view = null, opened = false;
    const inflight = new Set();

    const track = p => { inflight.add(p); const done = () => inflight.delete(p); p.then(done, done); return p; };
    const live = list => list.filter(e => e.deletedAt === null);
    const eventsList = () => live(ws.events);
    const customerOf = ev => (ev && ev.customerId ? ws.customers.find(c => c.id === ev.customerId) : null) || null;
    const arrsOf = id => live(ws.arrangements).filter(a => a.eventId === id);
    const itemsOf = id => live(ws.items).filter(i => i.arrangementId === id);
    const todayStr = () => (o.today ? o.today() : '');

    // ---------- hämta, spegla och spara ----------
    async function openStore() {
      const r = await store.open();
      if (!r.ok) { ui.blocked = r; return false; }
      ws = r.state; opened = true; ui.saved = r.saved === false ? false : null;      // "Sparat ✓" visas först när något faktiskt sparats
      return true;
    }
    /** Kör en ändring och visar resultatet. Ger true om den gick. */
    function change(fn) {
      return track((async () => {
        const r = await store.update(fn);
        if (r.state) ws = r.state;
        if (r.ok) { ui.saved = r.saved; ui.msg = r.saved ? null : { kind: 'warn', text: 'Det gick inte att spara (lagringen är full eller blockerad). Det du ser finns bara kvar tills du lämnar sidan.' }; }
        else if (r.reason === 'conflict') { ui.saved = false; ui.msg = { kind: 'bad', text: 'Jobben har ändrats i ett annat fönster. Ladda om sidan så ser du det senaste. Din senaste ändring sparades inte.' }; }
        else { ui.saved = false; ui.msg = { kind: 'bad', text: messageOf(r.error || r) }; }
        render();
        return r.ok ? r.result : undefined;
      })());
    }

    /** Speglar den gamla appens inställningar och flyttar över den nuvarande ordern en gång. Skriver bara om något faktiskt ändras. */
    async function connect() {
      view = o.getView();
      const probe = JSON.parse(JSON.stringify(ws)), pctx = W.defaultContext();
      const rep = B.connect(probe, pctx, view);
      if (rep.settings.status === 'unsupported') ui.note = { kind: 'warn', text: 'Några inställningar i Inställningar går inte att räkna exakt med ännu (' + rep.settings.problems.map(p => p.message).join('; ') + '). Jobben räknar med de inställningar som gällde sist.' };
      if (rep.settings.status === 'updated' || rep.order.status === 'imported') {
        await change((d, c) => B.connect(d, c, view));
        if (rep.order.status === 'imported') {
          const mine = ws.events.find(e => e.origin && e.origin.kind === 'legacy_order'); if (mine) ui.eventId = mine.id;
          ui.note = { kind: 'ok', text: 'Din nuvarande order finns nu som jobbet "Min order". Fliken Bukett är oförändrad, och ändringar här ändrar den inte.' };
        }
      }
      if (rep.order.status === 'unsupported') ui.note = { kind: 'warn', text: 'Din nuvarande order går inte att flytta över exakt (' + rep.order.problems.map(p => p.message).join('; ') + '). Den ligger kvar i fliken Bukett.' };
    }

    async function activate() {
      try {
        if (!opened && !(await openStore())) { render(); return; }
        ui.blocked = null; view = o.getView();
        await connect();
        const evs = eventsList();
        if (!ui.eventId || !evs.some(e => e.id === ui.eventId)) {
          const latest = evs.slice().sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0))[0];
          ui.eventId = latest ? latest.id : null;
        }
        if (ui.arrId && !live(ws.arrangements).some(a => a.id === ui.arrId)) ui.arrId = null;
        if (!evs.length) ui.newJob = true;
      } catch (e) { ui.msg = { kind: 'bad', text: messageOf(e) }; }
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
      return '<details><summary>Så räknades priset</summary><dl class="lines">' + parts.join('') + '</dl></details>';
    }

    function itemRowHtml(it, catalog) {
      const label = KIND_LABEL[it.source] || it.source;
      let info = '';
      if (it.source === 'SUPPLIER') {
        const art = catalog[I.articleKey(it.articleRef)];
        const pp = art && art.packPrice;
        info = pp ? kr(pp) + ' per förpackning om ' + art.packSize : '<span class="badge warn">pris saknas</span>';
        if (!art) info = '<span class="badge warn">finns inte i prislistan</span>';
      } else {
        const p = it.pricing, st = I.priceState(it);
        if (p.mode === 'INCLUDED') info = 'Ingår utan extra kostnad (0 kr)';
        else if (p.mode === 'FIXED_SALE_PRICE') info = 'Fast pris ' + kr(Money.fromJSON(p.unitSalePrice.amount)) + (p.unitSalePrice.basis === 'ex' ? ' exkl. moms' : ' inkl. moms') + ' per styck';
        else info = 'Standardpåslag på kalkylkostnad ' + kr(Money.fromJSON(p.unitCostBasis)) + ' per styck';
        if (st === 'PRICE_MISSING') info = '<span class="badge warn">pris saknas</span>';
      }
      return '<li class="j-item" data-id="' + esc(it.id) + '"><div class="j-item-main"><strong>' + esc(it.name) + '</strong> <span class="badge">' + esc(label) + '</span><div class="muted small">' + info + '</div></div>'
        + '<label class="field j-qty"><span class="vh">Antal</span><input type="text" inputmode="decimal" data-jf="itemqty" data-id="' + esc(it.id) + '" value="' + esc(it.quantity) + '" aria-label="Antal ' + esc(it.name) + '"></label>'
        + '<button type="button" class="btn" data-j="rmitem" data-id="' + esc(it.id) + '" aria-label="Ta bort ' + esc(it.name) + '">Ta bort</button></li>';
    }

    function resultsHtml() {
      const q = String(ui.q || '').trim().toLowerCase();
      const items = view.priceList.items.filter(i => !q || String(i.namn).toLowerCase().includes(q));
      if (!items.length) return '<p class="muted small">Ingen blomma i prislistan matchar. Lägg till nya blommor under Prislista.</p>';
      return '<ul class="j-list">' + items.slice(0, 30).map(i => {
        const has = +i.pris > 0;
        return '<li class="j-flower"><div class="j-item-main"><strong>' + esc(i.namn) + '</strong><div class="muted small">' + esc(i.paket) + ' per förpackning, ' + (has ? esc(String(i.pris).replace('.', ',')) + NBSP + 'kr per förpackning' : 'pris saknas') + '</div></div>'
          + '<button type="button" class="btn" data-j="addflower" data-id="' + esc(i.id) + '">Lägg till ' + esc(i.namn) + '</button></li>';
      }).join('') + '</ul>' + (items.length > 30 ? '<p class="muted small">Visar de första 30. Skriv mer i sökfältet.</p>' : '');
    }

    function jobFormHtml() {
      const names = [...new Set(live(ws.customers).map(c => c.name))];
      return '<form id="jf-job" data-jform="newjob" class="j-form"><h3>Nytt jobb</h3>'
        + '<label class="field"><span>Kund</span><input id="jf-customer" name="customer" type="text" list="jf-customers" autocomplete="off" placeholder="t.ex. Emma Svensson"></label><datalist id="jf-customers">' + names.map(n => '<option value="' + esc(n) + '">').join('') + '</datalist>'
        + '<label class="field"><span>Kundtyp</span><select id="jf-kind" name="kind"><option value="PRIVATE">Privatkund (priser inkl. moms)</option><option value="BUSINESS">Företag (priser exkl. moms)</option></select></label>'
        + '<label class="field"><span>Jobbets namn</span><input id="jf-name" name="name" type="text" autocomplete="off" placeholder="t.ex. Emma &amp; Johan"></label>'
        + '<div class="grid-2"><label class="field"><span>Typ av jobb</span><select id="jf-type" name="type">' + EVENT_TYPES.map(([v, t]) => '<option value="' + v + '">' + t + '</option>').join('') + '</select></label>'
        + '<label class="field"><span>Datum <span class="hint">(valfritt)</span></span><input id="jf-date" name="date" type="date"></label></div>'
        + '<div class="row"><button type="submit" class="btn primary">Skapa jobb</button>' + (eventsList().length ? '<button type="button" class="btn" data-j="cancelnewjob">Avbryt</button>' : '') + '</div></form>';
    }

    function ownFormHtml() {
      const ev = ws.events.find(e => e.id === ui.eventId), kind = (customerOf(ev) || {}).customerKind || 'PRIVATE';
      const basis = I.defaultPriceBasis(kind);
      return '<details id="j-own"' + (ui.ownOpen ? ' open' : '') + '><summary><strong>+ Eget tillägg</strong></summary>'
        + '<form id="jf-own" data-jform="own" class="j-form">'
        + '<label class="field"><span>Vad är det? <span class="hint">(till exempel kvistar, band, vas)</span></span><input id="jf-own-name" name="name" type="text" autocomplete="off"></label>'
        + '<div class="grid-2"><label class="field"><span>Antal</span><input id="jf-own-qty" name="qty" type="text" inputmode="decimal" value="1"></label>'
        + '<label class="field"><span>Varifrån</span><select id="jf-own-source" name="source">' + SOURCES.map(([v, t]) => '<option value="' + v + '">' + t + '</option>').join('') + '</select></label></div>'
        + '<fieldset><legend>Pris till kunden</legend>'
        + '<label class="radio"><input type="radio" name="j-pmode" value="STANDARD_MARKUP" checked><span>Standardpåslag</span><small>Påslaget läggs på en kalkylkostnad som du anger. Kalkylkostnaden räknas även om du inte köpte något idag.</small></label>'
        + '<label class="field j-cost"><span>Kalkylkostnad per styck, exkl. moms (kr)</span><input id="jf-own-cost" name="cost" type="text" inputmode="decimal" placeholder="t.ex. 25"></label>'
        + '<label class="radio"><input type="radio" name="j-pmode" value="FIXED_SALE_PRICE"><span>Fast pris</span><small>Kunden betalar precis det du anger, utan påslag.</small></label>'
        + '<div class="grid-2 j-fixed"><label class="field"><span>Pris per styck (kr)</span><input id="jf-own-price" name="price" type="text" inputmode="decimal" placeholder="t.ex. 75"></label>'
        + '<label class="field"><span>Priset är</span><select id="jf-own-basis" name="basis"><option value="inc"' + (basis === 'inc' ? ' selected' : '') + '>inkl. moms</option><option value="ex"' + (basis === 'ex' ? ' selected' : '') + '>exkl. moms</option></select></label></div>'
        + '<label class="radio"><input type="radio" name="j-pmode" value="INCLUDED"><span>Ingår utan extra kostnad</span><small>Kunden betalar inget extra för det här (0 kr). Det är ditt val, inte ett saknat pris.</small></label>'
        + '</fieldset>'
        + '<div class="row"><button type="submit" class="btn primary">Lägg till tillägget</button></div></form></details>';
    }

    function render() {
      if (ui.blocked) { host.innerHTML = blockedHtml(); return; }
      if (!ws) { host.innerHTML = '<p class="muted">Läser in jobben…</p>'; return; }
      const evs = eventsList(), ev = evs.find(e => e.id === ui.eventId) || null;
      const customer = customerOf(ev), kind = (customer && customer.customerKind) || 'PRIVATE';
      let html = '<div class="j-grid">';
      html += '<div id="j-status" role="status" aria-live="polite" class="muted small">' + (ui.saved === true ? 'Sparat ✓' : ui.saved === false ? 'Inte sparat' : '') + '</div>';
      if (ui.msg) html += '<div class="note ' + esc(ui.msg.kind) + '" role="alert">' + esc(ui.msg.text) + '</div>';
      if (ui.note) html += '<div class="note ' + esc(ui.note.kind) + '">' + esc(ui.note.text) + '</div>';

      // 1. kund och jobb
      html += '<section class="card" aria-label="Kund och jobb"><div class="head-row"><h2 class="section-title">Kund och jobb</h2>' + (evs.length && !ui.newJob ? '<button type="button" class="btn" data-j="newjob">+ Nytt jobb</button>' : '') + '</div>';
      if (ui.newJob || !ev) html += jobFormHtml();
      else {
        html += '<label class="field"><span>Jobb</span><select id="j-job" data-jf="job">' + evs.map(e => { const c = customerOf(e); return '<option value="' + esc(e.id) + '"' + (e.id === ev.id ? ' selected' : '') + '>' + esc(e.name + (c ? ' (' + c.name + ')' : '') + (e.eventDate ? ', ' + longDate(e.eventDate) : '')) + '</option>'; }).join('') + '</select></label>';
        const typ = (EVENT_TYPES.find(t => t[0] === ev.type) || ['', 'Annat'])[1];
        html += '<p class="muted small">' + (customer ? esc(customer.name) + ' · ' : 'Ingen kund · ') + esc(typ) + (ev.eventDate ? ' · ' + esc(longDate(ev.eventDate)) : '') + '</p>';
        if (customer) html += '<label class="field"><span>Kundtyp</span><select id="j-kind" data-jf="kind"><option value="PRIVATE"' + (kind === 'PRIVATE' ? ' selected' : '') + '>Privatkund (priser inkl. moms)</option><option value="BUSINESS"' + (kind === 'BUSINESS' ? ' selected' : '') + '>Företag (priser exkl. moms)</option></select></label>';
        if (ev.origin && ev.origin.kind === 'legacy_order') html += '<p class="muted small">Det här jobbet kom från din order i fliken Bukett. Ändringar här ändrar inte den.</p>';
        html += '<div class="row"><button type="button" class="btn danger" data-j="rmjob">' + (ui.confirm === 'job' ? 'Säker? Tryck igen för att ta bort jobbet' : 'Ta bort jobbet') + '</button></div>';
      }
      html += '</section>';

      if (ev && !ui.newJob) {
        let priced0;
        try { priced0 = priceOf(ev.id); } catch (e) { host.innerHTML = html + '<div class="note bad" role="alert">' + esc(messageOf(e)) + '</div></div>'; return; }
        const { res, catalog } = priced0;
        const arrs = arrsOf(ev.id), priced = new Map(res.arrangements.map(x => [x.arrangementId, x]));
        // 2. arrangemang
        html += '<section class="card" aria-label="Arrangemang"><h2 class="section-title">Arrangemang</h2>';
        html += arrs.length ? '<ul class="j-list">' + arrs.map(a => {
          const ar = priced.get(a.id), open = a.id === ui.arrId;
          return '<li class="j-arr' + (open ? ' on' : '') + '" data-id="' + esc(a.id) + '"><div class="j-item-main"><button type="button" class="link" data-j="open" data-id="' + esc(a.id) + '" aria-expanded="' + open + '">' + esc(a.name) + (a.quantity > 1 ? ' ×' + a.quantity : '') + '</button>'
            + '<div class="small">' + (ar ? arrPriceHtml(a, ar, kind) : '') + '</div></div></li>';
        }).join('') + '</ul>' : '<p class="muted">Inga arrangemang än. Lägg till det första här under.</p>';
        html += '<form id="jf-arr" data-jform="arr" class="j-form row"><label class="field"><span>Namn</span><input id="jf-arr-name" name="name" type="text" autocomplete="off" placeholder="t.ex. Brudbukett"></label>'
          + '<label class="field j-qty"><span>Antal</span><input id="jf-arr-qty" name="qty" type="text" inputmode="numeric" value="1"></label><button type="submit" class="btn primary">+ Arrangemang</button></form></section>';

        // 3. det öppna arrangemanget
        const a = arrs.find(x => x.id === ui.arrId);
        if (a) {
          const ar = priced.get(a.id), its = itemsOf(a.id);
          const fee = a.laborOverride && a.laborOverride.mode === 'fixed' ? Money.fromJSON(a.laborOverride.fee) : null;
          html += '<section class="card" id="j-detail" aria-label="' + esc(a.name) + '"><div class="head-row"><h2 class="section-title">' + esc(a.name) + '</h2><button type="button" class="btn" data-j="close">Stäng</button></div>'
            + '<div class="grid-2"><label class="field"><span>Namn</span><input id="j-arr-name" type="text" data-jf="arrname" value="' + esc(a.name) + '"></label>'
            + '<label class="field"><span>Antal arrangemang</span><input id="j-arr-qty" type="text" inputmode="numeric" data-jf="arrqty" value="' + a.quantity + '"></label></div>'
            + '<label class="field"><span>Arbete, kr exkl. moms <span class="hint">(per arrangemang, lämna tomt om inget ska tas ut)</span></span><input id="j-labor" type="text" inputmode="decimal" data-jf="labor" value="' + (fee ? esc(fee.toDecimalString().replace('.', ',').replace(/,00$/, '')) : '') + '" placeholder="t.ex. 125"></label>'
            + (fee ? '<p class="small">Arbete: <strong>' + kr(fee) + '</strong></p>' : '<p class="muted small">Inget arbete angivet.</p>');
          html += '<h3>Det här ingår</h3>' + (its.length ? '<ul class="j-list">' + its.map(i => itemRowHtml(i, catalog)).join('') + '</ul>' : '<p class="muted">Inget tillagt än.</p>');
          html += '<div class="j-search"><label class="field"><span>Sök blommor</span><input id="j-search" type="search" autocomplete="off" placeholder="Sök i din prislista" value="' + esc(ui.q) + '"></label><div id="j-results">' + resultsHtml() + '</div></div>';
          html += ownFormHtml();
          if (ar && ar.result.status === 'OK') html += breakdownHtml(ar.result);
          html += '</section>';
        }

        // 4. kundpris
        html += '<section class="card j-total" id="j-total" aria-label="Kundpris">' + totalHtml(res, catalog, kind) + '</section>';
      }
      html += '</div>';
      host.innerHTML = html;
    }

    function totalHtml(res, catalog, kind) {
      const job = res.job;
      if (res.status !== 'OK' || job.status !== 'OK') {
        const all = problemsOf(res, catalog);
        return '<h2 class="section-title">Kundpris</h2><p class="j-big">Kundpriset kan inte räknas än</p>' + (all.length ? '<ul class="plain">' + all.map(w => '<li>' + esc(w) + '</li>').join('') + '</ul>' : '') + '<p class="muted small">Pris saknas för något. Fyll i det under Prislista, eller välj ett fast pris på ett eget tillägg.</p>';
      }
      const hasAny = job.lines.some(l => l.result.status === 'OK');
      if (!hasAny) return '<h2 class="section-title">Kundpris</h2><p class="muted">Lägg till arrangemang och blommor så räknas kundpriset här.</p>';
      let h = '<h2 class="section-title">Kundpris</h2>';
      const mark = job.statusMark ? esc(job.statusMark) + NBSP : '';
      if (kind === 'BUSINESS') h += '<p class="j-big">' + mark + kr(job.totalExVat) + ' exkl. moms</p><p>+ moms ' + kr(job.totalVat) + ' = <strong>' + kr(job.totalIncVat) + '</strong> inkl. moms</p>';
      else h += '<p class="j-big">' + mark + kr(job.totalIncVat) + ' inkl. moms</p><p class="muted small">varav moms ' + kr(job.totalVat) + '</p>';
      h += '<p class="muted small">' + (job.priceStatus === 'CONFIRMED' ? '✓ Alla priser är bekräftade.' : '≈ Ungefärligt: något pris är äldre än idag.') + '</p>';
      if (!job.rule.allVerified) h += '<p class="muted small">Moms: din egen inställning (' + esc(ws.shop.pricing.legacyVatPercent) + ' %), inte kontrollerad mot en officiell regel. Priset är ett arbetsunderlag, inte en faktura.</p>';
      return h;
    }

    function blockedHtml() {
      const b = ui.blocked;
      const why = b.reason === 'corrupt' || b.reason === 'invalid' ? 'Det sparade jobbunderlaget går inte att läsa. Det är inte överskrivet och inte raderat.' : 'Lagringen i den här webbläsaren är inte tillgänglig, så jobben kan inte sparas här.';
      return '<div class="note bad" role="alert">' + esc(why) + ' De andra flikarna fungerar som vanligt och är inte påverkade.</div>';
    }

    // ---------- händelser ----------
    function currentEvent() { return ws.events.find(e => e.id === ui.eventId && e.deletedAt === null); }
    const guard = fn => async () => { try { await fn(); } catch (e) { ui.msg = { kind: 'bad', text: messageOf(e) }; ui.saved = null; render(); } };

    host.addEventListener('click', e => {
      const t = e.target.closest('[data-j]'); if (!t || !host.contains(t)) return;
      const id = t.dataset.id, cmd = t.dataset.j;
      if (cmd !== 'rmjob' && ui.confirm) ui.confirm = null;
      if (cmd === 'newjob') { ui.newJob = true; render(); return; }
      if (cmd === 'cancelnewjob') { ui.newJob = false; render(); return; }
      if (cmd === 'open') { ui.arrId = ui.arrId === id ? null : id; ui.q = ''; render(); return; }
      if (cmd === 'close') { ui.arrId = null; render(); return; }
      if (cmd === 'rmjob') {
        if (ui.confirm !== 'job') { ui.confirm = 'job'; render(); return; }
        ui.confirm = null; const evId = ui.eventId;
        track(guard(async () => { await change((d, c) => W.removeEvent(d, c, evId)); ui.eventId = null; ui.arrId = null; const evs = eventsList(); ui.eventId = evs.length ? evs[0].id : null; ui.newJob = !evs.length; render(); })());
        return;
      }
      if (cmd === 'rmitem') { track(guard(() => change((d, c) => W.removeItem(d, c, id)))()); return; }
      if (cmd === 'addflower') {
        const arrId = ui.arrId, art = view.priceList.items.find(i => i.id === id); if (!arrId || !art) return;
        track(guard(() => change((d, c) => {
          const same = W.itemsOf(d, arrId).find(i => i.source === 'SUPPLIER' && i.articleRef.connectionId === B.MANUAL_CONNECTION && i.articleRef.supplierProductId === id);
          if (same) return W.updateItem(d, c, same.id, { quantity: M.toSafeInt(M.parseDecimal(same.quantity).add(Frac.of(1n)).n) });
          return W.addItem(d, c, arrId, { source: 'SUPPLIER', name: art.namn, articleRef: { connectionId: B.MANUAL_CONNECTION, supplierProductId: id }, quantity: 1 });
        }))());
      }
    });

    host.addEventListener('change', e => {
      const t = e.target, f = t.dataset && t.dataset.jf; if (!f) return;
      if (f === 'job') { ui.eventId = t.value; ui.arrId = null; ui.q = ''; ui.confirm = null; render(); return; }
      track(guard(async () => {
        const ev = currentEvent();
        if (f === 'kind') { const c = ev && customerOf(ev); if (c) await change((d, cx) => W.updateCustomer(d, cx, c.id, { customerKind: t.value })); return; }
        if (f === 'arrname') { const n = needText(t.value, 'Namnet'); await change((d, c) => W.updateArrangement(d, c, ui.arrId, { name: n })); return; }
        if (f === 'arrqty') { const n = parseCount(t.value, 'Antalet arrangemang', 1); await change((d, c) => W.updateArrangement(d, c, ui.arrId, { quantity: n })); return; }
        if (f === 'labor') {
          const v = squash(t.value);
          const labor = v === '' ? null : { mode: 'fixed', fee: parseMoney(v, 'arbetet').toJSON() };
          await change((d, c) => W.updateArrangement(d, c, ui.arrId, { laborOverride: labor })); return;
        }
        if (f === 'itemqty') { const q = parseQty(t.value); await change((d, c) => W.updateItem(d, c, t.dataset.id, { quantity: q })); }
      })());
    });

    host.addEventListener('toggle', e => { if (e.target && e.target.id === 'j-own') ui.ownOpen = e.target.open; }, true);

    host.addEventListener('input', e => {
      if (e.target.id !== 'j-search') return;
      ui.q = e.target.value;
      const box = host.querySelector('#j-results'); if (box) box.innerHTML = resultsHtml();          // bara träfflistan ritas om, inte fältet man skriver i
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
          if (id) { ui.eventId = id; ui.arrId = null; ui.newJob = false; ui.ownOpen = false; render(); }
          return;
        }
        const ev = currentEvent(); if (!ev) throw new UserError('Skapa eller välj ett jobb först.');
        if (kind === 'arr') {
          const name = needText(val('name'), 'Namnet på arrangemanget'), qty = parseCount(val('qty'), 'Antalet arrangemang', 1);
          const id = await change((d, c) => W.addArrangement(d, c, ev.id, { name, quantity: qty }).id);
          if (id) { ui.arrId = id; ui.q = ''; render(); }
          return;
        }
        if (kind === 'own') {
          if (!ui.arrId) throw new UserError('Öppna ett arrangemang först.');
          const name = needText(val('name'), 'Namnet på tillägget'), qty = parseQty(val('qty')), source = val('source');
          const mode = (form.querySelector('input[name="j-pmode"]:checked') || {}).value || 'STANDARD_MARKUP';
          let pricing;
          if (mode === 'STANDARD_MARKUP') pricing = { mode, unitCostBasis: parseMoney(val('cost'), 'kalkylkostnaden').toJSON() };
          else if (mode === 'FIXED_SALE_PRICE') pricing = { mode, unitSalePrice: { amount: parseMoney(val('price'), 'priset').toJSON(), basis: val('basis') } };
          else pricing = { mode: 'INCLUDED' };
          const spec = { source, name, quantity: qty, pricing };
          if (source === 'MANUAL') spec.requiresPurchase = true;
          const arrId = ui.arrId;
          const r = await change((d, c) => W.addItem(d, c, arrId, spec));
          if (r) { ui.ownOpen = false; render(); } else ui.ownOpen = true;
        }
      })());
    });

    return {
      activate: () => track(activate()),
      idle: async () => { while (inflight.size) await Promise.all([...inflight]); },
      state: () => (ws ? JSON.parse(JSON.stringify(ws)) : null),
      view: () => view
    };
  }

  return { mount, kr, messageOf };
});
