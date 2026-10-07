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
    const st = { v: VERSION, rev: 1, shop: { id: SHOP_ID, name: o.name || 'Min butik', pricing: defaultPricing(o.pricing), createdAt: now, updatedAt: now, rev: 1 }, customers: [], events: [], arrangements: [], items: [], materials: [] };
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
    for (const k of ['eventDate', 'deliveryDate']) if (s[k] !== undefined) { if (s[k] !== null && !isDate(s[k])) fail('bad_date', k + ' måste vara ÅÅÅÅ-MM-DD', k); out[k] = s[k]; }
    if (s.notes !== undefined) out.notes = text(s.notes);
    if (s.fees !== undefined) out.fees = readFees(s.fees, st.shop.pricing.currency);
    if (s.onHand !== undefined) out.onHand = readOnHand(s.onHand);
    return out;
  }
  function createEvent(st, ctx, spec) {
    const base = { customerId: null, name: '', type: 'other', usage: { horizon: 'week', date: null }, eventDate: null, deliveryDate: null, status: 'planning', notes: '', fees: [], onHand: {} };
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
    return out;
  }
  function addArrangement(st, ctx, eventId, spec) {
    need(st.events, eventId, 'jobb');
    const base = { eventId, name: '', kind: 'bouquet', quantity: 1, estimatedMinutes: null, markupOverrideBp: null, laborOverride: null, notes: '' };
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
  function addItem(st, ctx, arrangementId, spec) {
    need(st.arrangements, arrangementId, 'arrangemang');
    const normalized = I.normalizeItem({ ...(spec || {}), id: ctx.newId('itm') }, { currency: st.shop.pricing.currency });
    const now = ctx.now();
    const it = { ...normalized, arrangementId, shopId: SHOP_ID, createdAt: now, updatedAt: now, rev: 1, deletedAt: null };
    st.items.push(it);
    return it;
  }
  function updateItem(st, ctx, id, patch) {
    const it = need(st.items, id, 'rad'), p = patch || {};
    const merged = { ...it, ...p, pricing: { ...it.pricing, ...(p.pricing || {}) } };
    const normalized = I.normalizeItem(merged, { currency: st.shop.pricing.currency });
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
    customers, eventsOf, arrangementsOf, itemsOf, purchaseNeeds, priceEvent, validateWorkspace
  };
});
