/* Buketträknaren: floristens arbetsyta. Kund, jobb (Event), arrangemang och rader (ArrangementItem).
 *
 *   Shop ── Customer ── Event ── Arrangement ── ArrangementItem   (SUPPLIER | OWN_STOCK | HOME_GROWN | MANUAL)
 *
 * Allt är enkel JSON, så att samma tillstånd kan sparas lokalt nu och på en server senare. Alla rader har id, shopId, createdAt,
 * updatedAt, rev och deletedAt (mjuk radering). Den här modulen känner inte till skärmar, webbläsaren eller lagring (se store.js).
 *
 * priceEvent knyter ihop det hela: rader → inköpsplan (bara det som ska beställas) → pris per arrangemang → jobbets summa.
 * Egna tillägg påverkar kundpriset men skapar aldrig ett inköpsbehov. Beräknat och presenterat kundpris följer med båda.
 *
 * Offert och kundorder (avsnitt 8.6 i planen) skiljer tre priser åt, och alla tre sparas:
 *   BERÄKNAT      det exakta ekonomiska resultatet (667,75 kr)       QuoteSnapshot.lines[].calculated
 *   PRESENTERAT   det avrundade pris floristen erbjuder (670 kr)     QuoteSnapshot.lines[].presented
 *   ÖVERENSKOMMET det kunden faktiskt köper för (650 kr)             CustomerOrder.lines[].agreed
 * Det överenskomna är som standard det presenterade, men kan vara lägre eller högre. Skillnaden förstör aldrig den ursprungliga kalkylen.
 * En skickad offert och en kundorder ändras aldrig. En ändring ger en ny version (checkImmutability, som store.js tillämpar).
 *
 * Ingen momssats finns här. Satsen slås upp i regeluppsättningarna (tax.js). Utan egna regler används floristens egen
 * momsinställning (legacy-user-setting), som aldrig är verifierad och inte får användas för en faktura.
 */
(function (root, factory) {
  var d = (typeof module === 'object' && module.exports)
    ? { M: require('./money.js'), T: require('./tax.js'), P: require('./pricing.js'), PU: require('./purchase.js'), I: require('./items.js') }
    : { M: root.BRMoney, T: root.BRTax, P: root.BRPricing, PU: root.BRPurchase, I: root.BRItems };
  var api = factory(d.M, d.T, d.P, d.PU, d.I);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.BRWorkspace = api;
})(typeof self !== 'undefined' ? self : this, function (M, T, P, PU, I) {
  'use strict';
  const { Money, Frac, ROUNDING, EconomyError, Rate } = M;

  const SHOP_ID = 'shop_local';
  const VERSION = 1;
  const EVENT_TYPES = Object.freeze(['wedding', 'funeral', 'bouquet', 'other']);
  const HORIZONS = Object.freeze(['today', 'week', 'later', 'event']);
  const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

  class WorkspaceError extends Error {
    constructor(problems) {
      super(problems.map(p => p.message).join('; '));
      this.name = 'WorkspaceError';
      this.problems = problems;
    }
  }
  const prob = (code, message, where) => ({ code, message, where: where || null });
  const fail = (code, message, where) => { throw new WorkspaceError([prob(code, message, where)]); };
  const clone = o => (o === undefined ? undefined : JSON.parse(JSON.stringify(o)));
  const isDate = s => typeof s === 'string' && DATE_RE.test(s);

  // ---------- sammanhang: klocka och id:n kommer utifrån, så att tester är återskapningsbara ----------
  function defaultContext() {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    const rand = n => {
      let out = '';
      const c = typeof globalThis !== 'undefined' && globalThis.crypto && globalThis.crypto.getRandomValues;
      if (c) { const a = new Uint8Array(n); globalThis.crypto.getRandomValues(a); for (let i = 0; i < n; i++) out += chars[a[i] % chars.length]; }
      else for (let i = 0; i < n; i++) out += chars[Math.floor(Math.random() * chars.length)];
      return out;
    };
    return { now: () => new Date().toISOString(), newId: prefix => prefix + '_' + Date.now().toString(36) + rand(6) };
  }

  // ---------- inställningar för prissättning ----------
  function defaultPricing(over) {
    return {
      currency: 'SEK',
      markupBp: 5000,                                              // påslag på kalkylkostnaden, hundradels procent (50 %)
      hourlyLaborRate: Money.fromDecimal('250').toJSON(),
      defaultLaborFee: null,
      goodsTaxCategory: 'arrangement_goods', laborTaxCategory: 'labor',
      rounding: { step: Money.fromDecimal('5').toJSON(), mode: 'CEIL' },
      packMode: 'WHOLE_PACKS',
      shipping: { fee: null, freeFrom: null },
      legacyVatPercent: '25',                                      // floristens egen momsinställning. Inte en verifierad regel.
      ...(over || {})
    };
  }

  /** Läser inställningarna som Money och tal. Kastar WorkspaceError om något är fel. */
  function readPricing(p) {
    const problems = [];
    const money = (j, what, optional) => {
      if (j === null || j === undefined) { if (!optional) problems.push(prob('bad_pricing', what + ' saknas', 'shop.pricing')); return null; }
      try { return Money.fromJSON(j); } catch (e) { problems.push(prob('bad_pricing', what + ' måste vara ett belopp', 'shop.pricing')); return null; }
    };
    const out = { cur: p && p.currency };
    if (!p || typeof p.currency !== 'string' || !/^[A-Z]{3}$/.test(p.currency)) problems.push(prob('bad_pricing', 'valutan saknas eller är ogiltig', 'shop.pricing'));
    try { Rate.check(p.markupBp, 'påslaget'); } catch (e) { problems.push(prob('bad_pricing', 'påslaget måste vara ett heltal i hundradels procent', 'shop.pricing')); }
    out.markupBp = p && p.markupBp;
    out.hourly = money(p && p.hourlyLaborRate, 'timpriset', true);
    out.defaultFee = money(p && p.defaultLaborFee, 'standardavgiften för arbete', true);
    out.step = money(p && p.rounding && p.rounding.step, 'avrundningssteget');
    if (out.step && !out.step.toFrac().gt(0n)) problems.push(prob('bad_pricing', 'avrundningssteget måste vara större än noll', 'shop.pricing'));
    out.mode = p && p.rounding && p.rounding.mode;
    if (!Object.values(ROUNDING).includes(out.mode)) problems.push(prob('bad_pricing', 'okänt avrundningsläge', 'shop.pricing'));
    if (!PU.PACK_MODES.includes(p && p.packMode)) problems.push(prob('bad_pricing', 'okänt läge för förpackningar', 'shop.pricing'));
    out.packMode = p && p.packMode;
    out.shipFee = money(p && p.shipping && p.shipping.fee, 'fraktavgiften', true);
    out.freeFrom = money(p && p.shipping && p.shipping.freeFrom, 'gränsen för fri frakt', true);
    for (const k of ['goodsTaxCategory', 'laborTaxCategory']) if (!T.TAX_CATEGORIES.includes(p && p[k])) problems.push(prob('bad_pricing', k + ' är ingen momskategori', 'shop.pricing'));
    out.goodsCat = p && p.goodsTaxCategory; out.laborCat = p && p.laborTaxCategory;
    try { T.legacyUserSettingRuleSet(p.legacyVatPercent); } catch (e) { problems.push(prob('bad_pricing', 'momsinställningen måste vara ett tal', 'shop.pricing')); }
    out.legacyVatPercent = p && p.legacyVatPercent;
    if (problems.length) throw new WorkspaceError(problems);
    return out;
  }

  // ---------- skapa ----------
  function createWorkspace(ctx, opts) {
    const o = opts || {}, now = ctx.now();
    const st = { v: VERSION, rev: 1, shop: { id: SHOP_ID, name: o.name || 'Min butik', pricing: defaultPricing(o.pricing), createdAt: now, updatedAt: now, rev: 1 }, customers: [], events: [], arrangements: [], items: [], materials: [], quotes: [], orders: [] };
    readPricing(st.shop.pricing);
    return st;
  }

  function stamp(ctx, prefix, fields) {
    const now = ctx.now();
    return { id: ctx.newId(prefix), shopId: SHOP_ID, ...fields, createdAt: now, updatedAt: now, rev: 1, deletedAt: null };
  }
  function touch(ctx, e) { e.updatedAt = ctx.now(); e.rev += 1; return e; }
  const live = list => list.filter(e => e.deletedAt === null);
  const byId = (list, id) => list.find(e => e.id === id) || null;
  function need(list, id, what) { const e = byId(list, id); if (!e || e.deletedAt !== null) fail('not_found', what + ' finns inte: ' + String(id), what); return e; }
  function text(v, what, required) {
    const s = v === undefined || v === null ? '' : String(v).trim();
    if (required && !s) fail('required', what + ' måste fyllas i', what);
    return s;
  }

  // ---------- kunder ----------
  function addCustomer(st, ctx, spec) {
    const s = spec || {};
    const kind = s.customerKind === undefined ? 'PRIVATE' : s.customerKind;
    if (!P.CUSTOMER_KINDS.includes(kind)) fail('bad_customer_kind', 'okänd kundtyp: ' + kind, 'customerKind');
    const c = stamp(ctx, 'cus', { name: text(s.name, 'namn', true), email: text(s.email), phone: text(s.phone), notes: text(s.notes), customerKind: kind });
    st.customers.push(c);
    return c;
  }
  function updateCustomer(st, ctx, id, patch) {
    const c = need(st.customers, id, 'kund'), p = patch || {};
    if (p.name !== undefined) c.name = text(p.name, 'namn', true);
    for (const k of ['email', 'phone', 'notes']) if (p[k] !== undefined) c[k] = text(p[k]);
    if (p.customerKind !== undefined) { if (!P.CUSTOMER_KINDS.includes(p.customerKind)) fail('bad_customer_kind', 'okänd kundtyp', 'customerKind'); c.customerKind = p.customerKind; }
    return touch(ctx, c);
  }

  // ---------- jobb (Event) ----------
  function readFees(fees, cur) {
    return (fees || []).map((f, i) => {
      let amount;
      try { amount = Money.fromJSON(f.amount); } catch (e) { fail('bad_fee', 'avgiften måste ha ett belopp', 'fees'); }
      if (amount.isNegative() || amount.currency !== cur) fail('bad_fee', 'avgiften måste vara icke-negativ i ' + cur, 'fees');
      if (f.basis !== 'ex' && f.basis !== 'inc') fail('bad_fee', 'avgiften måste anges med eller utan moms (ex eller inc)', 'fees');
      if (!T.TAX_CATEGORIES.includes(f.taxCategory)) fail('bad_fee', 'avgiften behöver en momskategori', 'fees');
      return { id: f.id || 'fee' + (i + 1), kind: f.kind || 'other', label: text(f.label), amount: amount.toJSON(), basis: f.basis, taxCategory: f.taxCategory };
    });
  }
  function readOnHand(o) {
    const out = {};
    for (const [k, v] of Object.entries(o || {})) {
      if (!Number.isSafeInteger(v) || v < 0) fail('bad_on_hand', 'antalet hemma måste vara ett heltal från 0: ' + k, 'onHand');
      if (v > 0) out[k] = v;
    }
    return out;
  }
  function readEventFields(st, s, base) {
    const out = { ...base };
    if (s.name !== undefined) out.name = text(s.name, 'namn', true);
    if (s.customerId !== undefined) { if (s.customerId !== null) need(st.customers, s.customerId, 'kund'); out.customerId = s.customerId; }
    if (s.type !== undefined) { if (!EVENT_TYPES.includes(s.type)) fail('bad_event_type', 'okänd typ av jobb: ' + s.type, 'type'); out.type = s.type; }
    if (s.usage !== undefined) {
      const u = s.usage || {};
      if (!HORIZONS.includes(u.horizon)) fail('bad_usage', 'okänd tidshorisont: ' + String(u.horizon), 'usage');
      if (u.date !== null && u.date !== undefined && !isDate(u.date)) fail('bad_date', 'datum måste vara ÅÅÅÅ-MM-DD', 'usage');
      out.usage = { horizon: u.horizon, date: u.date || null };
    }
    if (s.origin !== undefined) out.origin = readOrigin(s.origin, 'legacy_order');
    for (const k of ['eventDate', 'deliveryDate']) if (s[k] !== undefined) { if (s[k] !== null && !isDate(s[k])) fail('bad_date', k + ' måste vara ÅÅÅÅ-MM-DD', k); out[k] = s[k]; }
    if (s.notes !== undefined) out.notes = text(s.notes);
    if (s.fees !== undefined) out.fees = readFees(s.fees, st.shop.pricing.currency);
    if (s.onHand !== undefined) out.onHand = readOnHand(s.onHand);
    return out;
  }
  /** Var ett jobb eller arrangemang kommer ifrån (till exempel den gamla appens order). Bara en uppgift, ändrar aldrig något. */
  function readOrigin(o, kind) {
    if (o === null) return null;
    if (!o || o.kind !== kind) fail('bad_origin', 'okänt ursprung: ' + JSON.stringify(o), 'origin');
    return clone(o);
  }
  function createEvent(st, ctx, spec) {
    const base = { origin: null, customerId: null, name: '', type: 'other', usage: { horizon: 'week', date: null }, eventDate: null, deliveryDate: null, status: 'planning', notes: '', fees: [], onHand: {} };
    const fields = readEventFields(st, spec || {}, base);
    text(fields.name, 'namn', true);
    const e = stamp(ctx, 'evt', fields);
    st.events.push(e);
    return e;
  }
  function updateEvent(st, ctx, id, patch) {
    const e = need(st.events, id, 'jobb');
    Object.assign(e, readEventFields(st, patch || {}, e));
    return touch(ctx, e);
  }
  function setOnHand(st, ctx, eventId, articleKey, n) {
    const e = need(st.events, eventId, 'jobb');
    return updateEvent(st, ctx, e.id, { onHand: { ...e.onHand, [articleKey]: n } });
  }

  // ---------- arrangemang ----------
  function readLabor(j, cur) {
    if (j === null || j === undefined) return null;
    try {
      if (j.mode === 'fixed') { const fee = Money.fromJSON(j.fee); if (fee.isNegative() || fee.currency !== cur) throw new Error(); return { mode: 'fixed', fee: fee.toJSON() }; }
      if (j.mode === 'timed') { const r = Money.fromJSON(j.hourlyRate), mins = M.parseDecimal(j.minutes); if (r.isNegative() || r.currency !== cur || mins.isNegative()) throw new Error(); return { mode: 'timed', minutes: String(j.minutes), hourlyRate: r.toJSON() }; }
    } catch (e) { /* faller igenom till felet nedan */ }
    return fail('bad_labor', 'arbetet måste vara { mode: fixed, fee } eller { mode: timed, minutes, hourlyRate }', 'laborOverride');
  }
  function readArrangementFields(st, s, base) {
    const out = { ...base };
    if (s.name !== undefined) out.name = text(s.name, 'namn', true);
    if (s.kind !== undefined) out.kind = text(s.kind) || 'bouquet';
    if (s.quantity !== undefined) { if (!Number.isSafeInteger(s.quantity) || s.quantity < 1) fail('bad_quantity', 'antalet arrangemang måste vara ett heltal från 1', 'quantity'); out.quantity = s.quantity; }
    if (s.estimatedMinutes !== undefined) { if (s.estimatedMinutes !== null && (!Number.isSafeInteger(s.estimatedMinutes) || s.estimatedMinutes < 0)) fail('bad_minutes', 'minuterna måste vara ett heltal från 0', 'estimatedMinutes'); out.estimatedMinutes = s.estimatedMinutes; }
    if (s.markupOverrideBp !== undefined) { if (s.markupOverrideBp !== null) { try { Rate.check(s.markupOverrideBp, 'påslaget'); } catch (e) { fail('bad_markup', 'påslaget måste vara ett heltal i hundradels procent', 'markupOverrideBp'); } } out.markupOverrideBp = s.markupOverrideBp; }
    if (s.laborOverride !== undefined) out.laborOverride = readLabor(s.laborOverride, st.shop.pricing.currency);
    if (s.notes !== undefined) out.notes = text(s.notes);
    if (s.origin !== undefined) out.origin = readOrigin(s.origin, 'legacy_bouquet');
    return out;
  }
  function addArrangement(st, ctx, eventId, spec) {
    need(st.events, eventId, 'jobb');
    const base = { origin: null, eventId, name: '', kind: 'bouquet', quantity: 1, estimatedMinutes: null, markupOverrideBp: null, laborOverride: null, notes: '' };
    const fields = readArrangementFields(st, spec || {}, base);
    text(fields.name, 'namn', true);
    const a = stamp(ctx, 'arr', fields);
    st.arrangements.push(a);
    return a;
  }
  function updateArrangement(st, ctx, id, patch) {
    const a = need(st.arrangements, id, 'arrangemang');
    Object.assign(a, readArrangementFields(st, patch || {}, a));
    return touch(ctx, a);
  }

  // ---------- rader ----------
  /** Kundtypen för ett arrangemang (via jobbet och kunden). Utan kund gäller privatkund. */
  function customerKindOf(st, arrangementId) {
    const a = byId(st.arrangements, arrangementId), ev = a && byId(st.events, a.eventId), c = ev && ev.customerId ? byId(st.customers, ev.customerId) : null;
    return c ? c.customerKind : 'PRIVATE';
  }
  function addItem(st, ctx, arrangementId, spec) {
    need(st.arrangements, arrangementId, 'arrangemang');
    const normalized = I.normalizeItem({ ...(spec || {}), id: ctx.newId('itm') }, { currency: st.shop.pricing.currency, defaultBasis: I.defaultPriceBasis(customerKindOf(st, arrangementId)) });
    const now = ctx.now();
    const it = { ...normalized, arrangementId, shopId: SHOP_ID, createdAt: now, updatedAt: now, rev: 1, deletedAt: null };
    st.items.push(it);
    return it;
  }
  function updateItem(st, ctx, id, patch) {
    const it = need(st.items, id, 'rad'), p = patch || {};
    const merged = { ...it, ...p, pricing: { ...it.pricing, ...(p.pricing || {}) } };
    const normalized = I.normalizeItem(merged, { currency: st.shop.pricing.currency, defaultBasis: I.defaultPriceBasis(customerKindOf(st, it.arrangementId)) });
    Object.assign(it, normalized);
    return touch(ctx, it);
  }
  function removeItem(st, ctx, id) { const it = need(st.items, id, 'rad'); it.deletedAt = ctx.now(); return touch(ctx, it); }
  function removeArrangement(st, ctx, id) {
    const a = need(st.arrangements, id, 'arrangemang');
    for (const it of live(st.items)) if (it.arrangementId === a.id) { it.deletedAt = ctx.now(); touch(ctx, it); }
    a.deletedAt = ctx.now();
    return touch(ctx, a);
  }
  function removeEvent(st, ctx, id) {
    const e = need(st.events, id, 'jobb');
    for (const a of live(st.arrangements)) if (a.eventId === e.id) removeArrangement(st, ctx, a.id);
    e.deletedAt = ctx.now();
    return touch(ctx, e);
  }

  // ---------- frågor ----------
  const customers = st => live(st.customers);
  const eventsOf = (st, customerId) => live(st.events).filter(e => customerId === undefined || e.customerId === customerId);
  const arrangementsOf = (st, eventId) => live(st.arrangements).filter(a => a.eventId === eventId);
  const itemsOf = (st, arrangementId) => live(st.items).filter(i => i.arrangementId === arrangementId);

  /**
   * VAD SOM ANVÄNDS och VAD SOM MÅSTE BESTÄLLAS för ett jobb.
   *   used           alla rader, i alla arrangemang (det som påverkar kundpriset)
   *   wholesaler     bara grossistartiklar som ska beställas, summerade per artikel över alla arrangemang
   *   elsewhere      rader som ska köpas någon annanstans än hos grossisten (MANUAL med requiresPurchase)
   *   notOrdered     rader som används men inte beställs (eget lager, egen trädgård, ...)
   */
  function purchaseNeeds(st, eventId) {
    need(st.events, eventId, 'jobb');
    const used = [], wholesale = new Map(), elsewhere = [], notOrdered = [];
    for (const a of arrangementsOf(st, eventId)) for (const it of itemsOf(st, a.id)) {
      const qty = I.quantityOf(it).mul(Frac.of(BigInt(a.quantity)));
      used.push({ itemId: it.id, arrangementId: a.id, source: it.source, name: it.name, quantity: qty });
      const n = I.purchaseNeed(it);
      if (n === 'WHOLESALER') {
        const key = I.articleKey(it.articleRef), row = wholesale.get(key) || { articleKey: key, articleRef: it.articleRef, needed: Frac.of(0n), lines: [] };
        row.needed = row.needed.add(qty); row.lines.push({ arrangementId: a.id, itemId: it.id }); wholesale.set(key, row);
      } else if (n === 'ELSEWHERE') elsewhere.push({ itemId: it.id, arrangementId: a.id, name: it.name, quantity: qty });
      else notOrdered.push({ itemId: it.id, arrangementId: a.id, source: it.source, name: it.name, quantity: qty });
    }
    return { used, wholesaler: [...wholesale.values()], elsewhere, notOrdered };
  }

  // ---------- pris ----------
  const laborJson = j => (j.mode === 'fixed' ? { mode: 'fixed', fee: Money.fromJSON(j.fee) } : { mode: 'timed', minutes: M.parseDecimal(j.minutes), hourlyRate: Money.fromJSON(j.hourlyRate) });

  /**
   * Räknar priset för ett jobb. opts:
   *   catalog    { [connectionId:supplierProductId]: { name, packSize, packPrice: Money|null, source } }  grossistens artiklar och priser
   *   taxDate    datum som styr momssatsen. Utan det används leveransdatum, annars eventdatum, annars opts.today
   *   today      'ÅÅÅÅ-MM-DD' om jobbet saknar datum
   *   ruleSets   regeluppsättningar. Utan dem används floristens egen momsinställning (inte verifierad)
   *   customerKind  överstyr kundtypen
   * Ger { status, purchaseComplete, plan, needs, arrangements[{ arrangementId, name, quantity, result }], job }.
   */
  function priceEvent(st, eventId, opts) {
    const o = opts || {};
    const ev = need(st.events, eventId, 'jobb');
    const pr = readPricing(st.shop.pricing);
    const cur = pr.cur;
    const taxDate = o.taxDate || ev.deliveryDate || ev.eventDate || o.today;
    if (!isDate(taxDate)) fail('no_tax_date', 'jobbet saknar datum för momssatsen (ange taxDate eller today)', 'taxDate');
    const ruleSets = o.ruleSets || [T.legacyUserSettingRuleSet(pr.legacyVatPercent)];
    const customer = ev.customerId ? byId(st.customers, ev.customerId) : null;
    const customerKind = o.customerKind || (customer && customer.customerKind) || 'PRIVATE';
    const arrs = arrangementsOf(st, eventId);
    const catalog = o.catalog || {};

    // 1. inköpsplan: bara grossistartiklar som ska beställas
    const plan = PU.planPurchase({
      currency: cur, packMode: pr.packMode, catalog, onHand: ev.onHand,
      shipping: { fee: pr.shipFee, freeFrom: pr.freeFrom },
      arrangements: arrs.map(a => {
        const items = itemsOf(st, a.id);
        return { id: a.id, quantity: a.quantity, nonEmpty: items.length > 0,
          items: items.filter(it => I.purchaseNeed(it) === 'WHOLESALER').map(it => ({ id: it.id, articleKey: I.articleKey(it.articleRef), quantity: I.quantityOf(it) })) };
      })
    });

    // 2. pris per arrangemang
    const common = { currency: cur, taxDate, ruleSets, rounding: { step: pr.step, mode: pr.mode }, customerKind };
    const inputs = arrs.map(a => {
      const items = itemsOf(st, a.id), planned = plan.arrangements.find(x => x.id === a.id);
      if (items.length === 0) return { a, input: { ...common, costLines: [], labor: { mode: 'none' }, markupBp: 0 } };
      const costLines = items.map(it => I.itemToCostLine(it, planned.items.find(x => x.itemId === it.id)));
      if (planned.freightShare.gt(0n)) costLines.push({ id: 'frakt', kind: 'freight', cost: planned.freightShare, markup: true, source: { kind: 'MANUAL', ref: 'shipping-setting' } });
      const labor = P.resolveLabor({ defaultLaborFee: pr.defaultFee, hourlyLaborRate: pr.hourly }, { laborOverride: a.laborOverride ? laborJson(a.laborOverride) : undefined, estimatedMinutes: a.estimatedMinutes });
      return { a, input: { ...common, costLines, labor, markupBp: a.markupOverrideBp === null ? pr.markupBp : a.markupOverrideBp, goodsTaxCategory: pr.goodsCat, laborTaxCategory: pr.laborCat } };
    });
    const results = inputs.map(x => ({ arrangementId: x.a.id, name: x.a.name, quantity: x.a.quantity, result: P.priceArrangement(x.input) }));

    // 3. jobbets summa
    const job = P.priceJob({
      ...common,
      lines: inputs.map(x => ({ id: x.a.id, qty: x.a.quantity, arrangement: x.input })),
      fees: (ev.fees || []).map(f => ({ id: f.id, basis: f.basis, amount: Money.fromJSON(f.amount), taxCategory: f.taxCategory }))
    });
    // kundpriset kan vara fullständigt även om ett grossistpris saknas (till exempel för en rad med fast kundpris). Det redovisas för sig.
    return { status: job.status === 'OK' ? 'OK' : 'INCOMPLETE', purchaseComplete: plan.missing.length === 0 && plan.noPrice.length === 0, eventId, taxDate, customerKind, plan, needs: purchaseNeeds(st, eventId), arrangements: results, job };
  }

  // ---------- offert (QuoteSnapshot) och kundorder (CustomerOrder) ----------
  const QUOTE_STATUS = Object.freeze(['draft', 'sent', 'accepted', 'superseded']);
  const ORDER_STATUS = Object.freeze(['active', 'superseded', 'cancelled']);
  const QUOTE_NEXT = Object.freeze({ draft: ['sent', 'accepted', 'superseded'], sent: ['accepted', 'superseded'], accepted: ['superseded'], superseded: [] });
  const ORDER_NEXT = Object.freeze({ active: ['superseded', 'cancelled'], superseded: [], cancelled: [] });
  const jsonOf = x => JSON.parse(JSON.stringify(x));
  const times = (m, n) => Money.of(m.amount * BigInt(n), m.currency);
  const sumMoney = (list, cur) => list.reduce((s, x) => s.add(x), Money.zero(cur));
  const sumFrac = list => Frac.sum(list);
  const quotesOf = (st, eventId) => (st.quotes || []).filter(q => q.eventId === eventId && q.deletedAt === null);
  const ordersOf = (st, eventId) => (st.orders || []).filter(o => o.eventId === eventId && o.deletedAt === null);
  const activeOrderOf = (st, eventId) => ordersOf(st, eventId).find(o => o.status === 'active') || null;

  /** Moms per sats, sammanslagen över flera listor av { rateBp, exVat, vat, incVat } (Money). */
  function mergeRates(lists, cur) {
    const map = new Map();
    for (const g of lists.flat()) {
      const x = map.get(g.rateBp) || { rateBp: g.rateBp, exVat: Money.zero(cur), vat: Money.zero(cur), incVat: Money.zero(cur) };
      x.exVat = x.exVat.add(g.exVat); x.vat = x.vat.add(g.vat); x.incVat = x.incVat.add(g.incVat); map.set(g.rateBp, x);
    }
    return [...map.values()].sort((a, b) => a.rateBp - b.rateBp);
  }
  const moneyRates = list => list.map(g => ({ rateBp: g.rateBp, exVat: Money.fromJSON(g.exVat), vat: Money.fromJSON(g.vat), incVat: Money.fromJSON(g.incVat) }));
  const ratesJson = list => list.map(g => ({ rateBp: g.rateBp, exVat: g.exVat.toJSON(), vat: g.vat.toJSON(), incVat: g.incVat.toJSON() }));

  /**
   * Fryser jobbets pris som en offert. Både det BERÄKNADE (exakta) och det PRESENTERADE (avrundade) priset sparas, med avrundningsregel,
   * regelversion och prisstatus. Kräver ett fullständigt pris: en offert med ett pris som saknas skapas aldrig. Tidigare offerter för jobbet
   * som inte är godkända ersätts (superseded). opts som för priceEvent.
   */
  function createQuote(st, ctx, eventId, opts) {
    need(st.events, eventId, 'jobb');
    const res = priceEvent(st, eventId, opts);
    if (res.status !== 'OK') {
      const why = res.arrangements.filter(a => a.result.status === 'INCOMPLETE').map(a => a.name + ': ' + a.result.reasons.map(r => r.code + (r.id ? ' ' + r.id : '') + (r.category ? ' ' + r.category : '')).join(', '));
      fail('incomplete_price', 'offerten kan inte skapas medan priset är ofullständigt' + (why.length ? ' (' + why.join('; ') + ')' : ''), 'quote');
    }
    const pr = readPricing(st.shop.pricing), cur = pr.cur;
    const priced = res.arrangements.filter(a => a.result.status === 'OK');
    if (!priced.length && !res.job.fees.length) fail('empty_job', 'jobbet har inget att offerera', 'quote');
    const lines = priced.map(a => ({
      arrangementId: a.arrangementId, name: a.name, quantity: a.quantity, priceStatus: a.result.priceStatus,
      calculated: jsonOf(a.result.calculated), presented: jsonOf(a.result.presented), goodsRateBp: a.result.breakdown.components[0].rateBp,
      ruleSetRefs: a.result.breakdown.rule.refs, allVerified: a.result.breakdown.rule.allVerified,
      profitabilityInputs: jsonOf(a.result.breakdown.profitabilityInputs)
    }));
    const version = (quotesOf(st, eventId).reduce((m, q) => Math.max(m, q.version), 0)) + 1;
    for (const q of quotesOf(st, eventId)) if (q.status === 'draft' || q.status === 'sent') { q.status = 'superseded'; q.supersededAt = ctx.now(); touch(ctx, q); }
    const q = stamp(ctx, 'qte', {
      eventId, version, status: 'draft', sentAt: null, acceptedAt: null, supersededAt: null,
      currency: cur, taxDate: res.taxDate, customerKind: res.customerKind, rounding: { step: pr.step.toJSON(), mode: pr.mode },
      priceStatus: res.job.priceStatus, ruleSetRefs: res.job.rule.refs, allVerified: res.job.rule.allVerified,
      lines, fees: jsonOf(res.job.fees),
      totals: { calculated: jsonOf(res.job.calculated), presented: jsonOf(res.job.presented), vatByRate: jsonOf(res.job.vatByRate) }
    });
    st.quotes = st.quotes || [];
    st.quotes.push(q);
    return q;
  }

  function sendQuote(st, ctx, quoteId) {
    const q = need(st.quotes || [], quoteId, 'offert');
    if (q.status !== 'draft') fail('bad_transition', 'bara ett utkast kan skickas (offerten är ' + q.status + ')', 'quote');
    q.status = 'sent'; q.sentAt = ctx.now();
    return touch(ctx, q);
  }

  /**
   * Kunden säger ja. Skapar en kundorder av offerten och fryser det ÖVERENSKOMNA priset per arrangemang.
   * opts: { approvedBy (vem hos floristen som registrerade kundens ja), agreed: { [arrangementId]: belopp per styck inkl. moms (Money som JSON) }, note }
   * Saknas ett överenskommet pris för ett arrangemang gäller det presenterade. Ett lägre eller högre överenskommet pris ändrar aldrig offerten:
   * skillnaden mot det presenterade och mot det beräknade sparas på raden.
   */
  function acceptQuote(st, ctx, quoteId, opts) {
    const o = opts || {};
    const q = need(st.quotes || [], quoteId, 'offert');
    if (q.status !== 'draft' && q.status !== 'sent') fail('bad_transition', 'bara en offert som inte är ersatt kan godkännas (offerten är ' + q.status + ')', 'quote');
    const approvedBy = text(o.approvedBy, 'vem som godkände', true);
    const agreedIn = o.agreed || {};
    for (const k of Object.keys(agreedIn)) if (!q.lines.some(l => l.arrangementId === k)) fail('bad_agreed', 'överenskommet pris för ett arrangemang som inte finns i offerten: ' + k, 'agreed');
    const cur = q.currency;
    const lines = q.lines.map(l => {
      let unit;
      if (agreedIn[l.arrangementId] === undefined) unit = Money.fromJSON(l.presented.incVat);
      else { try { unit = Money.fromJSON(agreedIn[l.arrangementId]); } catch (e) { fail('bad_agreed', 'det överenskomna priset måste vara ett belopp', 'agreed'); } }
      if (unit.currency !== cur || unit.isNegative()) fail('bad_agreed', 'det överenskomna priset måste vara icke-negativt i ' + cur, 'agreed');
      const split = P.allocateAgreed({ agreedIncVat: unit, presentedByRate: moneyRates(l.presented.byRate), fallbackRateBp: l.goodsRateBp });
      const presentedInc = Money.fromJSON(l.presented.incVat);
      return {
        arrangementId: l.arrangementId, name: l.name, quantity: l.quantity,
        calculated: clone(l.calculated), presented: { incVat: l.presented.incVat, exVat: l.presented.exVat, vat: l.presented.vat },
        agreed: { unitIncVat: split.incVat.toJSON(), unitExVat: split.exVat.toJSON(), unitVat: split.vat.toJSON(), byRate: ratesJson(split.byRate) },
        adjustment: { unitIncVat: split.incVat.sub(presentedInc).toJSON(), unitVsCalculated: split.incVat.toFrac().sub(Frac.fromJSON(l.calculated.incVat)).toJSON() }
      };
    });
    const feeAmounts = q.fees.map(f => ({ ex: Money.fromJSON(f.amounts.exVat), vat: Money.fromJSON(f.amounts.vat), inc: Money.fromJSON(f.amounts.incVat), rateBp: f.amounts.vatRate }));
    const feeRates = feeAmounts.map(f => ({ rateBp: f.rateBp, exVat: f.ex, vat: f.vat, incVat: f.inc }));
    const lineRates = lines.map(l => moneyRates(l.agreed.byRate).map(g => ({ rateBp: g.rateBp, exVat: times(g.exVat, l.quantity), vat: times(g.vat, l.quantity), incVat: times(g.incVat, l.quantity) })));
    const byRate = mergeRates([...lineRates, feeRates], cur);
    const agreedInc = sumMoney(byRate.map(g => g.incVat), cur);
    const presentedInc = Money.fromJSON(q.totals.presented.incVat);
    const prior = ordersOf(st, q.eventId);
    for (const x of prior) if (x.status === 'active') { x.status = 'superseded'; x.supersededAt = ctx.now(); touch(ctx, x); }
    for (const x of quotesOf(st, q.eventId)) if (x.id !== q.id && x.status === 'accepted') { x.status = 'superseded'; x.supersededAt = ctx.now(); touch(ctx, x); }
    const order = stamp(ctx, 'ord', {
      eventId: q.eventId, quoteId: q.id, quoteVersion: q.version, version: prior.reduce((m, x) => Math.max(m, x.version), 0) + 1, status: 'active',
      approvedAt: ctx.now(), approvedBy, note: text(o.note), supersededAt: null,
      currency: cur, taxDate: q.taxDate, customerKind: q.customerKind, ruleSetRefs: q.ruleSetRefs, allVerified: q.allVerified,
      lines, fees: clone(q.fees),
      totals: {
        calculatedIncVat: q.totals.calculated.incVat, presentedIncVat: q.totals.presented.incVat,
        agreedIncVat: agreedInc.toJSON(), agreedExVat: sumMoney(byRate.map(g => g.exVat), cur).toJSON(), agreedVat: sumMoney(byRate.map(g => g.vat), cur).toJSON(),
        adjustmentIncVat: agreedInc.sub(presentedInc).toJSON(), vatByRate: ratesJson(byRate)
      }
    });
    st.orders = st.orders || [];
    st.orders.push(order);
    q.status = 'accepted'; q.acceptedAt = ctx.now(); touch(ctx, q);
    return order;
  }

  function cancelOrder(st, ctx, orderId) {
    const o = need(st.orders || [], orderId, 'kundorder');
    if (o.status !== 'active') fail('bad_transition', 'bara en aktiv kundorder kan avbrytas (ordern är ' + o.status + ')', 'order');
    o.status = 'cancelled'; o.supersededAt = ctx.now();
    return touch(ctx, o);
  }

  /** Läser de tre prisnivåerna för en orderrad: beräknat, presenterat och överenskommet (per styck, inkl. moms). */
  function priceLevels(line) {
    return {
      calculatedIncVat: Frac.fromJSON(line.calculated.incVat),
      presentedIncVat: Money.fromJSON(line.presented.incVat),
      agreedIncVat: Money.fromJSON(line.agreed.unitIncVat),
      adjustmentIncVat: Money.fromJSON(line.adjustment.unitIncVat),
      agreedVsCalculated: Frac.fromJSON(line.adjustment.unitVsCalculated)
    };
  }

  /** Kontroll av en offert (lista med problem, tom = bra). */
  function validateQuote(q, cur) {
    const p = [], at = m => prob('bad_quote', 'offert ' + q.id + ': ' + m, q.id);
    try {
      if (!QUOTE_STATUS.includes(q.status)) p.push(at('okänd status ' + q.status));
      if (!Number.isSafeInteger(q.version) || q.version < 1) p.push(at('ogiltig version'));
      if (q.currency !== cur) p.push(at('fel valuta'));
      if (!Array.isArray(q.lines) || !Array.isArray(q.fees)) return [...p, at('rader och avgifter måste vara listor')];
      const incs = [], calcs = [];
      for (const l of q.lines) {
        const pi = Money.fromJSON(l.presented.incVat), pe = Money.fromJSON(l.presented.exVat), pv = Money.fromJSON(l.presented.vat);
        if (!pe.add(pv).eq(pi)) p.push(at('presenterat exkl. moms + moms är inte inkl. moms (' + l.arrangementId + ')'));
        if (!sumMoney(moneyRates(l.presented.byRate).map(g => g.incVat), cur).eq(pi)) p.push(at('momsraderna summerar inte till det presenterade priset (' + l.arrangementId + ')'));
        const ce = Frac.fromJSON(l.calculated.exVat), cv = Frac.fromJSON(l.calculated.vat), ci = Frac.fromJSON(l.calculated.incVat);
        if (!ce.add(cv).eq(ci)) p.push(at('beräknat exkl. moms + moms är inte inkl. moms (' + l.arrangementId + ')'));
        if (!Frac.fromJSON(l.presented.rounding).eq(pi.toFrac().sub(ci))) p.push(at('avrundningen är inte presenterat minus beräknat (' + l.arrangementId + ')'));
        if (!Number.isSafeInteger(l.quantity) || l.quantity < 1) p.push(at('ogiltigt antal'));
        incs.push(times(pi, l.quantity)); calcs.push(ci.mul(Frac.of(BigInt(l.quantity))));
      }
      for (const f of q.fees) { const fi = Money.fromJSON(f.amounts.incVat); incs.push(fi); calcs.push(fi.toFrac()); }
      if (!sumMoney(incs, cur).eq(Money.fromJSON(q.totals.presented.incVat))) p.push(at('summan av raderna är inte det presenterade totalet'));
      if (!sumFrac(calcs).eq(Frac.fromJSON(q.totals.calculated.incVat))) p.push(at('summan av raderna är inte det beräknade totalet'));
    } catch (e) { p.push(at('kan inte läsas: ' + (e && e.message))); }
    return p;
  }

  /** Kontroll av en kundorder (lista med problem, tom = bra). */
  function validateOrder(o, cur) {
    const p = [], at = m => prob('bad_order', 'kundorder ' + o.id + ': ' + m, o.id);
    try {
      if (!ORDER_STATUS.includes(o.status)) p.push(at('okänd status ' + o.status));
      if (!Number.isSafeInteger(o.version) || o.version < 1) p.push(at('ogiltig version'));
      if (o.currency !== cur) p.push(at('fel valuta'));
      if (typeof o.approvedBy !== 'string' || !o.approvedBy.trim()) p.push(at('vem som godkände saknas'));
      if (!Array.isArray(o.lines) || !Array.isArray(o.fees)) return [...p, at('rader och avgifter måste vara listor')];
      const agreedIncs = [], rateLists = [], presIncs = [], calcs = [];
      for (const l of o.lines) {
        const lv = priceLevels(l);
        const ai = lv.agreedIncVat, ae = Money.fromJSON(l.agreed.unitExVat), av = Money.fromJSON(l.agreed.unitVat);
        if (!ae.add(av).eq(ai)) p.push(at('överenskommet exkl. moms + moms är inte inkl. moms (' + l.arrangementId + ')'));
        if (!sumMoney(moneyRates(l.agreed.byRate).map(g => g.incVat), cur).eq(ai)) p.push(at('momsraderna summerar inte till det överenskomna priset (' + l.arrangementId + ')'));
        if (!ai.sub(lv.presentedIncVat).eq(lv.adjustmentIncVat)) p.push(at('prisjusteringen är inte överenskommet minus presenterat (' + l.arrangementId + ')'));
        if (!ai.toFrac().sub(lv.calculatedIncVat).eq(lv.agreedVsCalculated)) p.push(at('skillnaden mot det beräknade stämmer inte (' + l.arrangementId + ')'));
        agreedIncs.push(times(ai, l.quantity)); presIncs.push(times(lv.presentedIncVat, l.quantity)); calcs.push(lv.calculatedIncVat.mul(Frac.of(BigInt(l.quantity))));
        rateLists.push(moneyRates(l.agreed.byRate).map(g => ({ rateBp: g.rateBp, exVat: times(g.exVat, l.quantity), vat: times(g.vat, l.quantity), incVat: times(g.incVat, l.quantity) })));
      }
      for (const f of o.fees) { const fi = Money.fromJSON(f.amounts.incVat); agreedIncs.push(fi); presIncs.push(fi); calcs.push(fi.toFrac()); rateLists.push([{ rateBp: f.amounts.vatRate, exVat: Money.fromJSON(f.amounts.exVat), vat: Money.fromJSON(f.amounts.vat), incVat: fi }]); }
      const t = o.totals, agreed = sumMoney(agreedIncs, cur);
      if (!agreed.eq(Money.fromJSON(t.agreedIncVat))) p.push(at('summan av raderna är inte det överenskomna totalet'));
      if (!sumMoney(presIncs, cur).eq(Money.fromJSON(t.presentedIncVat))) p.push(at('summan av raderna är inte det presenterade totalet'));
      if (!sumFrac(calcs).eq(Frac.fromJSON(t.calculatedIncVat))) p.push(at('summan av raderna är inte det beräknade totalet'));
      if (!Money.fromJSON(t.agreedExVat).add(Money.fromJSON(t.agreedVat)).eq(agreed)) p.push(at('totalt exkl. moms + moms är inte inkl. moms'));
      if (!agreed.sub(Money.fromJSON(t.presentedIncVat)).eq(Money.fromJSON(t.adjustmentIncVat))) p.push(at('total prisjustering stämmer inte'));
      if (!sumMoney(mergeRates(rateLists, cur).map(g => g.incVat), cur).eq(agreed)) p.push(at('momsraderna summerar inte till det överenskomna totalet'));
    } catch (e) { p.push(at('kan inte läsas: ' + (e && e.message))); }
    return p;
  }

  /**
   * Jämför arbetsytan före och efter en ändring och ger problem om en offert eller kundorder har ändrats på ett sätt som inte är tillåtet.
   * Innehållet i en offert eller order är oföränderligt. Bara status får gå framåt (QUOTE_NEXT, ORDER_NEXT), och inget får raderas.
   * store.js anropar den vid varje sparning.
   */
  function checkImmutability(before, after) {
    const p = [];
    const one = (kind, list0, list1, next, volatile) => {
      const now = new Map((list1 || []).map(x => [x.id, x]));
      for (const a of list0 || []) {
        const b = now.get(a.id);
        if (!b) { p.push(prob('immutable', kind + ' ' + a.id + ' har tagits bort', a.id)); continue; }
        const strip = x => { const c = clone(x); for (const k of volatile) delete c[k]; return JSON.stringify(c); };
        if (strip(a) !== strip(b)) p.push(prob('immutable', kind + ' ' + a.id + ' har ändrats (en skickad eller godkänd ' + kind + ' ändras aldrig, gör en ny version)', a.id));
        if (a.status !== b.status && !(next[a.status] || []).includes(b.status)) p.push(prob('immutable', kind + ' ' + a.id + ': status får inte gå från ' + a.status + ' till ' + b.status, a.id));
        for (const k of ['sentAt', 'acceptedAt', 'supersededAt']) if (a[k] !== undefined && a[k] !== null && a[k] !== b[k]) p.push(prob('immutable', kind + ' ' + a.id + ': ' + k + ' får inte ändras', a.id));
      }
    };
    one('offert', before.quotes, after.quotes, QUOTE_NEXT, ['status', 'sentAt', 'acceptedAt', 'supersededAt', 'updatedAt', 'rev']);
    one('kundorder', before.orders, after.orders, ORDER_NEXT, ['status', 'supersededAt', 'updatedAt', 'rev']);
    return p;
  }

  // ---------- kontroll av hela arbetsytan ----------
  /** Lista med problem (tom = bra). Används när något läses från lagring och före varje sparning. */
  function validateWorkspace(st) {
    const p = [];
    if (!st || typeof st !== 'object') return [prob('bad_state', 'arbetsytan saknas')];
    if (st.v !== VERSION) p.push(prob('bad_version', 'okänd version: ' + String(st.v)));
    if (!Number.isSafeInteger(st.rev) || st.rev < 1) p.push(prob('bad_rev', 'rev måste vara ett heltal från 1'));
    if (!st.shop || st.shop.id !== SHOP_ID) p.push(prob('bad_shop', 'butiken saknas'));
    else { try { readPricing(st.shop.pricing); } catch (e) { p.push(...(e.problems || [prob('bad_pricing', e.message)])); } }
    for (const k of ['customers', 'events', 'arrangements', 'items', 'materials']) if (!Array.isArray(st[k])) p.push(prob('bad_state', k + ' måste vara en lista'));
    if (p.length) return p;
    const seen = new Set();
    for (const [kind, list] of [['kund', st.customers], ['jobb', st.events], ['arrangemang', st.arrangements], ['rad', st.items]]) for (const e of list) {
      if (!e || typeof e.id !== 'string' || !e.id) { p.push(prob('bad_id', kind + ' saknar id')); continue; }
      if (seen.has(e.id)) p.push(prob('duplicate_id', 'id används två gånger: ' + e.id));
      seen.add(e.id);
      if (e.shopId !== SHOP_ID) p.push(prob('bad_shop', kind + ' ' + e.id + ' hör till en annan butik', e.id));
      if (!Number.isSafeInteger(e.rev) || e.rev < 1) p.push(prob('bad_rev', kind + ' ' + e.id + ' har ogiltig rev', e.id));
      if (e.deletedAt === undefined) p.push(prob('bad_state', kind + ' ' + e.id + ' saknar deletedAt', e.id));
    }
    const cur = st.shop.pricing.currency;
    for (const c of st.customers) if (!P.CUSTOMER_KINDS.includes(c.customerKind)) p.push(prob('bad_customer_kind', 'kund ' + c.id + ' har okänd kundtyp', c.id));
    for (const e of st.events) {
      if (e.customerId !== null && !byId(st.customers, e.customerId)) p.push(prob('dangling', 'jobb ' + e.id + ' pekar på en kund som inte finns', e.id));
      if (!EVENT_TYPES.includes(e.type)) p.push(prob('bad_event_type', 'jobb ' + e.id + ' har okänd typ', e.id));
      try { readFees(e.fees, cur); readOnHand(e.onHand); } catch (x) { p.push(...(x.problems || [])); }
    }
    for (const a of st.arrangements) {
      if (!byId(st.events, a.eventId)) p.push(prob('dangling', 'arrangemang ' + a.id + ' pekar på ett jobb som inte finns', a.id));
      if (!Number.isSafeInteger(a.quantity) || a.quantity < 1) p.push(prob('bad_quantity', 'arrangemang ' + a.id + ' har ogiltigt antal', a.id));
    }
    for (const k of ['quotes', 'orders']) if (st[k] !== undefined && !Array.isArray(st[k])) p.push(prob('bad_state', k + ' måste vara en lista'));
    const versions = new Set();
    for (const q of Array.isArray(st.quotes) ? st.quotes : []) {
      if (!q || typeof q.id !== 'string' || seen.has(q.id)) { p.push(prob('duplicate_id', 'offert saknar id eller använder ett id två gånger')); continue; }
      seen.add(q.id);
      if (!byId(st.events, q.eventId)) p.push(prob('dangling', 'offert ' + q.id + ' pekar på ett jobb som inte finns', q.id));
      if (versions.has('q' + q.eventId + ':' + q.version)) p.push(prob('duplicate_version', 'offert ' + q.id + ': versionen finns redan för jobbet', q.id));
      versions.add('q' + q.eventId + ':' + q.version);
      p.push(...validateQuote(q, cur));
    }
    for (const o of Array.isArray(st.orders) ? st.orders : []) {
      if (!o || typeof o.id !== 'string' || seen.has(o.id)) { p.push(prob('duplicate_id', 'kundorder saknar id eller använder ett id två gånger')); continue; }
      seen.add(o.id);
      const qq = byId(st.quotes || [], o.quoteId);
      if (!qq || qq.eventId !== o.eventId) p.push(prob('dangling', 'kundorder ' + o.id + ' pekar på en offert som inte finns för samma jobb', o.id));
      if (versions.has('o' + o.eventId + ':' + o.version)) p.push(prob('duplicate_version', 'kundorder ' + o.id + ': versionen finns redan för jobbet', o.id));
      versions.add('o' + o.eventId + ':' + o.version);
      p.push(...validateOrder(o, cur));
    }
    for (const it of st.items) {
      if (!byId(st.arrangements, it.arrangementId)) p.push(prob('dangling', 'rad ' + it.id + ' pekar på ett arrangemang som inte finns', it.id));
      for (const x of I.validateItem(it, { currency: cur })) p.push(prob(x.code, 'rad ' + it.id + ': ' + x.message, it.id));
    }
    return p;
  }

  return {
    SHOP_ID, VERSION, EVENT_TYPES, HORIZONS, WorkspaceError,
    defaultContext, defaultPricing, readPricing, createWorkspace,
    addCustomer, updateCustomer, createEvent, updateEvent, setOnHand,
    addArrangement, updateArrangement, addItem, updateItem, removeItem, removeArrangement, removeEvent,
    customers, eventsOf, arrangementsOf, itemsOf, purchaseNeeds, priceEvent, validateWorkspace,
    QUOTE_STATUS, ORDER_STATUS, QUOTE_NEXT, ORDER_NEXT, quotesOf, ordersOf, activeOrderOf, createQuote, sendQuote, acceptQuote, cancelOrder, priceLevels, validateQuote, validateOrder, checkImmutability, customerKindOf
  };
});
