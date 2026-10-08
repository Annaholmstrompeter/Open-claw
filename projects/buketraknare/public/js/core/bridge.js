/* Buketträknaren: bryggan mellan den nuvarande appen (prislista, inställningar, order) och den nya arbetsytan (workspace.js).
 *
 * Den gamla appen är oförändrad och räknar fortfarande med calc(). Bryggan läser dess vy (BRModel.viewOf) och gör tre saker:
 *
 *   1. KATALOG     prislistan blir grossistkatalog för den nya prismotorn (catalogFromView). Priserna kopieras aldrig in i arbetsytan:
 *                  prislistan är kvar som enda källa och katalogen byggs om vid varje beräkning.
 *   2. INSTÄLLNINGAR  påslag, timpris, avrundning, förpackningsläge, frakt och moms speglas ett steg åt ett håll, från den gamla appens
 *                  inställningar till arbetsytan (pricingFromSettings, syncSettings). Inget skrivs tillbaka.
 *   3. ORDER       den nuvarande ordern kan flyttas över ETT enda gång till ett jobb som heter "Min order" (importLegacyOrder).
 *                  Importen är idempotent (ett jobb med ursprunget legacy_order finns redan = inget görs) och allt eller inget.
 *
 * VÄGEN TILLBAKA: legacyOrderFromWorkspace gör om ett jobb till en order i den gamla appens format, och säger vad som inte kan
 * uttryckas där (egna tillägg, fasta priser, arbete). Bryggan ändrar ALDRIG den gamla appens tillstånd: den tar emot en vy och
 * ger tillbaka nya värden. Arbetsytan har en egen lagringsnyckel, så att ta bort den ger exakt den gamla appen igen.
 *
 * Det som inte kan flyttas över exakt (ett pris med fler än två decimaler, ett bråkantal) flyttas inte över. Det rapporteras och
 * den gamla appen fortsätter att fungera som förut. Inget avrundas tyst.
 */
(function (root, factory) {
  var d = (typeof module === 'object' && module.exports)
    ? { M: require('./money.js'), W: require('./workspace.js') }
    : { M: root.BRMoney, W: root.BRWorkspace };
  var api = factory(d.M, d.W);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.BRBridge = api;
})(typeof self !== 'undefined' ? self : this, function (M, W) {
  'use strict';
  const { Money, Rate } = M;

  const MANUAL = 'conn_manual';                       // samma id som den gamla appens egna prislista (BRModel.MANUAL_CONNECTION_ID)
  const articleKey = productId => MANUAL + ':' + productId;
  const productIdOf = key => (typeof key === 'string' && key.startsWith(MANUAL + ':') ? key.slice(MANUAL.length + 1) : null);
  const problem = (code, message, where) => ({ code, message, where: where || null });
  const isInt = n => Number.isSafeInteger(n);

  /** Ett tal från den gamla appen som decimalsträng. Null om det inte är ett vanligt, ändligt tal (inga exponenter, ingen NaN). */
  function plain(x) {
    const n = typeof x === 'string' && x.trim() !== '' ? Number(x) : x;
    if (typeof n !== 'number' || !Number.isFinite(n)) return null;
    const s = String(n);
    return /^-?\d+(\.\d+)?$/.test(s) ? s : null;
  }

  // ---------- 1. katalog ----------
  /**
   * Prislistan (vyn) som grossistkatalog. Nyckel: 'conn_manual:' + varans id. Pris saknas = null (aldrig 0 kr).
   * Priskälla: ett pris som floristen skrev eller verifierade idag är MANUAL (bekräftat), allt annat STALE (ungefärligt, ≈).
   * Ett pris med fler än två decimaler kan inte vara ett exakt belopp. Då saknas priset och det står i warnings.
   */
  function catalogFromView(view, opts) {
    const o = opts || {}, today = o.today;
    const catalog = {}, warnings = [];
    for (const it of (view && view.priceList && view.priceList.items) || []) {
      const packSize = Math.max(1, Math.round(+it.paket || 1));          // som calc(): indexList
      const price = Math.max(0, +it.pris || 0);
      let packPrice = null;
      if (price > 0) {
        const s = plain(price);
        try { if (s === null) throw new Error('inte ett vanligt tal'); packPrice = Money.fromDecimal(s); }
        catch (e) { warnings.push(problem('bad_price', 'priset för ' + it.namn + ' kan inte vara ett exakt belopp i kronor och ören och räknas som saknat', it.id)); }
      }
      catalog[articleKey(it.id)] = {
        name: it.namn, packSize, packPrice, unit: it.enhet || '', category: it.kategori || '', verifiedOn: it.uppd || null,
        source: { kind: it.uppd && it.uppd === today ? 'MANUAL' : 'STALE' }
      };
    }
    return { catalog, warnings };
  }

  // ---------- 2. inställningar ----------
  /** Den gamla appens inställningar som arbetsytans prissättning. Ger { ok, pricing } eller { ok: false, problems }. */
  function pricingFromSettings(S) {
    const problems = [], s = S || {};
    const num = (v, what, min) => { const t = plain(v); if (t === null || +t < min) { problems.push(problem('bad_setting', what + ' är inte ett giltigt tal', what)); return null; } return t; };
    const money = (t, what) => { if (t === null) return null; try { return Money.fromDecimal(t); } catch (e) { problems.push(problem('bad_setting', what + ' kan inte vara ett exakt belopp i kronor och ören', what)); return null; } };
    let markupBp = null;
    const mk = num(s.markupPct, 'påslaget', 0);
    if (mk !== null) { try { markupBp = Rate.fromPercent(mk); } catch (e) { problems.push(problem('bad_setting', 'påslaget får ha högst två decimaler', 'påslaget')); } }
    const hourly = money(num(s.hourly, 'timpriset', 0), 'timpriset');
    const vat = num(s.vatPct, 'momsen', 0);
    const stepRaw = plain(s.roundStep);
    if (stepRaw === null) problems.push(problem('bad_setting', 'avrundningen är inte ett giltigt tal', 'avrundningen'));
    const step = stepRaw !== null && +stepRaw > 0 ? money(stepRaw, 'avrundningen') : Money.fromDecimal('1');
    const roundingMode = stepRaw !== null && +stepRaw > 0 ? 'CEIL' : 'HALF_UP';                 // som calc(): steg 0 = närmaste hela krona
    const shipRaw = plain(s.shipFee), freeRaw = plain(s.freeFrom);
    if (shipRaw === null) problems.push(problem('bad_setting', 'fraktavgiften är inte ett giltigt tal', 'frakten'));
    if (freeRaw === null) problems.push(problem('bad_setting', 'gränsen för fri frakt är inte ett giltigt tal', 'frakten'));
    const fee = shipRaw !== null && +shipRaw > 0 ? money(shipRaw, 'fraktavgiften') : null;
    const freeFrom = freeRaw !== null && +freeRaw > 0 ? money(freeRaw, 'gränsen för fri frakt') : null;
    if (problems.length) return { ok: false, problems };
    return {
      ok: true,
      pricing: {
        markupBp, hourlyLaborRate: hourly.toJSON(), rounding: { step: step.toJSON(), mode: roundingMode },
        packMode: s.mode === 'whole' ? 'WHOLE_PACKS' : 'USED_ONLY',
        shipping: { fee: fee ? fee.toJSON() : null, freeFrom: freeFrom ? freeFrom.toJSON() : null },
        legacyVatPercent: vat                                                           // floristens egen inställning, aldrig verifierad
      }
    };
  }

  /**
   * Speglar den gamla appens inställningar till arbetsytan (ett håll). Ändrar bara det som skiljer sig.
   * Går något inte att uttrycka exakt lämnas arbetsytans inställningar som de var och orsaken ges.
   * Ger { status: 'unchanged' | 'updated' | 'unsupported', changed?, problems? }.
   */
  function syncSettings(st, ctx, settings) {
    const r = pricingFromSettings(settings);
    if (!r.ok) return { status: 'unsupported', problems: r.problems };
    const cur = st.shop.pricing, changed = Object.keys(r.pricing).filter(k => JSON.stringify(cur[k]) !== JSON.stringify(r.pricing[k]));
    if (!changed.length) return { status: 'unchanged' };
    const patch = {}; for (const k of changed) patch[k] = r.pricing[k];
    W.updatePricing(st, ctx, patch);
    return { status: 'updated', changed };
  }

  // ---------- 3. order → jobb ----------
  const sizeOf = (S, id) => ((S && S.sizes) || []).find(x => x.id === id) || ((S && S.sizes) || [])[0] || null;
  const nonEmpty = b => Object.values(b.items || {}).some(n => n > 0);

  /** Kan den nuvarande ordern flyttas över exakt? Ger en lista med problem (tom = ja). Ändrar ingenting. */
  function checkLegacyOrder(view) {
    const p = [], S = view.settings || {}, ord = view.order || {};
    (ord.buketter || []).forEach((b, i) => {
      const at = 'bukett ' + (i + 1);
      if (!isInt(b.qty) || b.qty < 1) p.push(problem('bad_quantity', at + ' har ett antal som inte är ett heltal från 1', at));
      const entries = Object.entries(b.items || {}).filter(([, n]) => n > 0);
      if (entries.some(([, n]) => !isInt(n))) p.push(problem('bad_quantity', at + ' har ett antal blommor som inte är ett heltal', at));
      if (entries.length) {
        const size = sizeOf(S, b.size);
        if (!size || !isInt(size.minutes) || size.minutes < 0) p.push(problem('bad_minutes', at + ' har en storlek med minuter som inte är ett heltal', at));
        if (size && +size.wrap > 0) { const t = plain(size.wrap); try { if (t === null) throw new Error(); Money.fromDecimal(t); } catch (e) { p.push(problem('bad_wrap', at + ' har emballage som inte kan vara ett exakt belopp', at)); } }
      }
    });
    return p;
  }

  const hasLegacyJob = st => st.events.some(e => e.origin && e.origin.kind === 'legacy_order');

  /**
   * Flyttar den nuvarande ordern ("Min order") över till ett jobb. Görs en gång: finns redan ett jobb med ursprunget legacy_order
   * (även ett som floristen tagit bort) görs inget. En tom order ger inget jobb. Går något inte att flytta över exakt görs ingenting alls.
   * Ger { status: 'imported' | 'exists' | 'nothing_to_import' | 'unsupported', eventId?, arrangementIds?, problems? }.
   */
  function importLegacyOrder(st, ctx, view) {
    if (hasLegacyJob(st)) { const e = st.events.find(x => x.origin && x.origin.kind === 'legacy_order'); return { status: 'exists', eventId: e.id }; }
    const S = view.settings || {}, ord = view.order || {}, buketter = ord.buketter || [];
    const hemma = {};
    for (const [k, v] of Object.entries(ord.hemma || {})) { const n = Math.max(0, Math.round(+v || 0)); if (n > 0) hemma[articleKey(k)] = n; }   // som calc()
    if (!buketter.some(nonEmpty) && !Object.keys(hemma).length) return { status: 'nothing_to_import' };
    const problems = checkLegacyOrder(view);
    if (problems.length) return { status: 'unsupported', problems };

    const labels = view.labels || {}, names = new Map(((view.priceList && view.priceList.items) || []).map(i => [i.id, i.namn]));
    const ev = W.createEvent(st, ctx, { name: 'Min order', origin: { kind: 'legacy_order', activeBouquetId: ord.active || null, seq: ord.seq || buketter.length } });
    W.updateEvent(st, ctx, ev.id, { onHand: hemma });
    const arrangementIds = [];
    buketter.forEach((b, i) => {
      const entries = Object.entries(b.items || {}).filter(([, n]) => n > 0), size = sizeOf(S, b.size);
      const arr = W.addArrangement(st, ctx, ev.id, {
        name: 'Bukett ' + (i + 1), quantity: b.qty, estimatedMinutes: entries.length ? size.minutes : null,
        notes: size ? 'Storlek: ' + size.name : '', origin: { kind: 'legacy_bouquet', bouquetId: b.id, size: b.size }
      });
      arrangementIds.push(arr.id);
      for (const [k, n] of entries) {
        W.addItem(st, ctx, arr.id, { source: 'SUPPLIER', name: names.get(k) || labels[k] || k, articleRef: { connectionId: MANUAL, supplierProductId: k }, quantity: n });
      }
      if (entries.length && size && +size.wrap > 0) {
        W.addItem(st, ctx, arr.id, { source: 'OWN_STOCK', kind: 'packaging', name: 'Emballage', quantity: 1, pricing: { mode: 'STANDARD_MARKUP', unitCostBasis: Money.fromDecimal(plain(size.wrap)).toJSON() } });
      }
    });
    return { status: 'imported', eventId: ev.id, arrangementIds };
  }

  /** Allt bryggan gör vid start: spegla inställningarna och flytta över ordern en gång. Ger rapporten från båda. */
  function connect(st, ctx, view) {
    return { settings: syncSettings(st, ctx, view.settings), order: importLegacyOrder(st, ctx, view) };
  }

  // ---------- vägen tillbaka: jobb → order i den gamla appens format ----------
  /**
   * Gör ett jobb till en order i den gamla appens format (nycklar är varans id). Ändrar inget. Ger { order, lost }.
   * lost säger vad som inte kan uttryckas i den gamla ordern: rader som inte är grossistvaror från den egna prislistan,
   * bråkantal, fasta priser, eget arbete, egna tillägg. Storleken är den som arrangemanget kom ifrån, annars den med samma antal minuter.
   */
  function legacyOrderFromWorkspace(st, eventId, settings) {
    const ev = st.events.find(e => e.id === eventId && e.deletedAt === null);
    if (!ev) throw new Error('jobbet finns inte: ' + eventId);
    const lost = [], buketter = [], taken = new Set();
    const arrs = st.arrangements.filter(a => a.eventId === ev.id && a.deletedAt === null);
    arrs.forEach((a, i) => {
      let id = a.origin && a.origin.kind === 'legacy_bouquet' && typeof a.origin.bouquetId === 'string' && !taken.has(a.origin.bouquetId) ? a.origin.bouquetId : null;
      for (let n = i + 1; !id; n++) if (!taken.has('b' + n)) id = 'b' + n;
      taken.add(id);
      let size = a.origin && a.origin.kind === 'legacy_bouquet' ? a.origin.size : null;
      if (size === null || size === undefined) {
        const hit = ((settings && settings.sizes) || []).find(x => x.minutes === a.estimatedMinutes);
        size = hit ? hit.id : ((settings && settings.sizes && settings.sizes[0] && settings.sizes[0].id) || 'medel');
        lost.push(problem('size_guessed', a.name + ': storleken är gissad', a.id));
      }
      const items = {};
      for (const it of st.items.filter(x => x.arrangementId === a.id && x.deletedAt === null)) {
        const pid = it.source === 'SUPPLIER' && it.articleRef && it.articleRef.connectionId === MANUAL ? it.articleRef.supplierProductId : null;
        let q = null;
        try { const f = M.parseDecimal(it.quantity); q = f.isInteger() ? M.toSafeInt(f.n) : null; } catch (e) { q = null; }
        if (pid === null) { if (!(a.origin && a.origin.kind === 'legacy_bouquet' && it.source === 'OWN_STOCK' && it.kind === 'packaging' && it.name === 'Emballage')) lost.push(problem('not_representable', a.name + ': ' + it.name + ' kan inte uttryckas i den gamla ordern', it.id)); continue; }
        if (!isInt(q) || q < 1) { lost.push(problem('fractional_quantity', a.name + ': ' + it.name + ' har ett antal som inte är ett heltal', it.id)); continue; }
        items[pid] = (items[pid] || 0) + q;
      }
      if (a.laborOverride) lost.push(problem('labor_not_representable', a.name + ': eget arbete kan inte uttryckas i den gamla ordern', a.id));
      buketter.push({ id, size, qty: a.quantity, items });
    });
    const hemma = {};
    for (const [k, n] of Object.entries(ev.onHand || {})) { const pid = productIdOf(k); if (pid !== null && n > 0) hemma[pid] = n; }
    const o = ev.origin && ev.origin.kind === 'legacy_order' ? ev.origin : {};
    const ids = buketter.map(b => b.id);
    const active = ids.includes(o.activeBouquetId) ? o.activeBouquetId : (ids[0] || null);
    return { order: { buketter, hemma, active, seq: Math.max(isInt(o.seq) ? o.seq : 0, buketter.length) }, lost };
  }

  return { MANUAL_CONNECTION: MANUAL, articleKey, productIdOf, catalogFromView, pricingFromSettings, syncSettings, checkLegacyOrder, importLegacyOrder, connect, legacyOrderFromWorkspace };
});
