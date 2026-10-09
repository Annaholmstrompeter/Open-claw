/* Maison Studio: lager ovanpå Buketträknarens riktiga prismotor (js/engine/, oförändrade kopior av public/js/core/).
 * Prototypen räknar inget själv: allt går genom BRWorkspace.priceEvent. Den här filen översätter bara motorns svar till det skärmen visar. */
(function (root, factory) {
  var d = (typeof module === 'object' && module.exports)
    ? { M: require('./engine/money.js'), W: require('./engine/workspace.js'), B: require('./engine/bridge.js'), D: require('./studio-data.js') }
    : { M: root.BRMoney, W: root.BRWorkspace, B: root.BRBridge, D: root.StudioData };
  var api = factory(d.M, d.W, d.B, d.D);
  if (typeof module === 'object' && module.exports) module.exports = api; else root.StudioEngine = api;
})(typeof self !== 'undefined' ? self : this, function (M, W, B, D) {
  'use strict';
  const { Money, ROUNDING } = M;
  const NBSP = ' ';
  const MONTHS = ['januari', 'februari', 'mars', 'april', 'maj', 'juni', 'juli', 'augusti', 'september', 'oktober', 'november', 'december'];
  const TYPE = { wedding: 'Bröllop', funeral: 'Begravning', bouquet: 'Bukett', other: 'Annat' };
  const group = digits => digits.replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
  function kr(m) {
    const neg = m.amount < 0n, a = neg ? -m.amount : m.amount, whole = a / 100n, ore = a % 100n;
    return (neg ? '−' : '') + group(String(whole)) + (ore === 0n ? '' : ',' + String(ore).padStart(2, '0')) + NBSP + 'kr';
  }
  const krFrac = f => kr(Money.fromFrac(f, ROUNDING.HALF_UP, 'SEK'));
  const longDate = d => (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)) ? parseInt(d.slice(8, 10), 10) + ' ' + MONTHS[parseInt(d.slice(5, 7), 10) - 1] : '';
  const packLabel = (unit, size) => (size > 1 && String(unit || '').toLowerCase() === 'pack') ? size + '-pack' : size === 1 ? 'styck' : unit ? unit + ' à ' + size : size + ' per förp.';
  const times = (m, n) => Money.of(m.amount * BigInt(n), m.currency);
  const daysBetween = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);


  // ---------- inköpsenhet: det floristen faktiskt köper, med styckpriset som räknat värde i parentes ----------
  const krOf = n => kr(Money.fromDecimal(String(n)));
  const cap = w => w.charAt(0).toUpperCase() + w.slice(1);
  /** { unit: '165 kr/bunt', desc: 'Bunt om 5 st · (33 kr/st)' }. Styckpriset är alltid ett räknat värde i parentes (≈ om det inte går jämnt upp). Bara varor som säljs styckvis har styckpris som verkligt pris. */
  function unitInfo(f) {
    const size = f.paket, unit = String(f.enhet || '').toLowerCase(), cents = Math.round(f.pris * 100);
    if (size === 1) return { unit: krOf(f.pris) + '/st', desc: 'Säljs styckvis', word: 'st' };
    const exact = cents % size === 0, stem = (exact ? '' : '≈' + NBSP) + kr(Money.fromFrac(new M.Frac(BigInt(cents), BigInt(size)), ROUNDING.HALF_UP, 'SEK')) + '/st';
    if (unit === 'pack') return { unit: krOf(f.pris) + '/' + size + '-pack', desc: '(' + stem + ')', word: size + '-pack' };
    const word = unit || 'förp.';
    return { unit: krOf(f.pris) + '/' + word, desc: cap(word) + ' om ' + size + ' st · (' + stem + ')', word };
  }
  const buyWhat = (f, packs) => { const size = f.paket, unit = String(f.enhet || '').toLowerCase();
    return size === 1 ? packs + ' st' : unit === 'pack' ? packs + ' × ' + size + '-pack' : unit === 'bunt' ? packs + (packs === 1 ? ' bunt' : ' buntar') : packs + ' × ' + (unit || 'förp.') + ' à ' + size; };
  /** "Köper 2 buntar · 330 kr", "Köper 1 × 10-pack · 99 kr", "Köper 2 st · 78 kr" */
  const buyText = (f, packs, cost, shared) => (shared ? 'Hela jobbet köper ' : 'Köper ') + buyWhat(f, packs) + ' · ' + cost;

  function create() {
    const TODAY = D.TODAY;
    let tick = Date.parse('2026-10-08T08:00:00Z'), seq = 0;
    const ctx = { now: () => new Date((tick += 1000)).toISOString(), newId: p => p + '_' + (++seq) };
    const ws = W.createWorkspace(ctx, { name: 'Min butik' });
    B.syncSettings(ws, ctx, D.SETTINGS);
    const view = { priceList: { items: D.FLOWERS.map(f => ({ ...f })) } };       // prislistan är kvar som enda källa, katalogen byggs om vid varje beräkning
    const flowerByName = n => D.FLOWERS.find(f => f.namn === n);
    const art = id => ({ connectionId: B.MANUAL_CONNECTION, supplierProductId: id });
    const fixed = kr0 => ({ mode: 'fixed', fee: Money.fromDecimal(String(kr0)).toJSON() });
    const live = l => l.filter(e => e.deletedAt === null);

    // ---------- startdata ----------
    for (const j of D.JOBS) {
      const cu = W.addCustomer(ws, ctx, { name: j.customer, customerKind: j.kind });
      const ev = W.createEvent(ws, ctx, { name: j.name, customerId: cu.id, type: j.type, eventDate: j.date || undefined });
      for (const a of j.arrangements) {
        const ar = W.addArrangement(ws, ctx, ev.id, { name: a.name, quantity: a.qty });
        for (const [n, q] of a.parts) W.addItem(ws, ctx, ar.id, { source: 'SUPPLIER', name: n, articleRef: art(flowerByName(n).id), quantity: q });
        if (a.own) W.addItem(ws, ctx, ar.id, { source: 'OWN_STOCK', name: a.own[0], quantity: 1, pricing: { mode: 'STANDARD_MARKUP', unitCostBasis: Money.fromDecimal(String(a.own[1])).toJSON() } });
        W.updateArrangement(ws, ctx, ar.id, { laborOverride: fixed(a.labor) });
      }
    }

    // ---------- läsning ----------
    const catalog = () => B.catalogFromView(view, { today: TODAY }).catalog;
    const priceOf = eventId => W.priceEvent(ws, eventId, { catalog: catalog(), today: TODAY });
    const customerOf = ev => (ev.customerId ? ws.customers.find(c => c.id === ev.customerId) : null) || null;
    const kindOf = ev => (customerOf(ev) || {}).customerKind || 'PRIVATE';
    const itemsOf = arrId => live(ws.items).filter(i => i.arrangementId === arrId);
    const arrsOf = evId => live(ws.arrangements).filter(a => a.eventId === evId);
    const fresh = f => { const d = daysBetween(f.uppd, TODAY); return d <= 0 ? { ok: true, days: 0 } : { ok: false, days: d }; };
    const flowerOfItem = it => D.FLOWERS.find(f => it.articleRef && it.articleRef.supplierProductId === f.id) || null;

    function jobs() {      // senaste först
      return live(ws.events).slice().sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0)).map(e => job(e.id, true));
    }
    function composition(evId) {   // blommor och antal över hela jobbet, för kompositionsraden på Hem
      const out = new Map();
      for (const a of arrsOf(evId)) for (const it of itemsOf(a.id)) { const f = flowerOfItem(it); if (!f) continue; out.set(f.id, { name: f.namn, color: f.farg, n: (out.get(f.id) || { n: 0 }).n + Number(it.quantity) * a.quantity }); }
      return [...out.values()];
    }
    function job(evId, light) {
      const ev = live(ws.events).find(e => e.id === evId); if (!ev) return null;
      const cu = customerOf(ev), kind = kindOf(ev), arrs = arrsOf(ev.id);
      let res = null, price = { kind: 'empty', text: 'Tomt' };
      try {
        res = priceOf(ev.id);
        if (res.status !== 'OK' || res.job.status !== 'OK') price = { kind: 'missing', text: 'Pris saknas' };
        else if (res.job.lines.some(l => l.result.status === 'OK')) price = { kind: 'ok', mark: res.job.statusMark || '', text: kr(kind === 'BUSINESS' ? res.job.totalExVat : res.job.totalIncVat), basis: kind === 'BUSINESS' ? 'exkl. moms' : 'inkl. moms' };
      } catch (x) { price = { kind: 'missing', text: 'Pris saknas' }; }
      const out = { id: ev.id, name: ev.name, customer: cu ? cu.name : '', kind, type: TYPE[ev.type] || 'Annat', date: longDate(ev.eventDate), price, composition: composition(ev.id), arrangementCount: arrs.length };
      if (light) return out;
      out.vat = res && res.job && res.job.status === 'OK' ? kr(res.job.totalVat) : '';
      out.arrangements = arrs.map(a => arrangementSummary(a, res, kind));
      return out;
    }
    function arrangementSummary(a, res, kind) {
      const ar = res && res.arrangements.find(x => x.arrangementId === a.id), r = ar && ar.result;
      const base = { id: a.id, name: a.name, qty: a.quantity };
      if (!r || r.status === 'EMPTY') return { ...base, state: 'empty' };
      if (r.status !== 'OK') return { ...base, state: 'missing' };
      const unit = kind === 'BUSINESS' ? r.presented.exVat : r.presented.incVat;
      return { ...base, state: 'ok', mark: r.statusMark, unit: kr(unit), total: a.quantity > 1 ? kr(times(unit, a.quantity)) : null, basis: kind === 'BUSINESS' ? 'exkl. moms' : 'inkl. moms' };
    }
    function arrangement(evId, arrId) {
      const ev = live(ws.events).find(e => e.id === evId), a = live(ws.arrangements).find(x => x.id === arrId); if (!ev || !a) return null;
      const kind = kindOf(ev), res = priceOf(ev.id), ar = res.arrangements.find(x => x.arrangementId === a.id), r = ar && ar.result;
      const cat = catalog();
      const reqs = new Map(res.plan.requirements.map(r => [r.key, r]));
      const items = itemsOf(a.id).map(it => {
        const f = flowerOfItem(it), supplier = it.source === 'SUPPLIER';
        const c = supplier ? cat[B.articleKey(f.id)] : null;
        return { id: it.id, name: it.name, qty: Number(it.quantity), supplier, tag: supplier ? 'Grossist' : (it.source === 'OWN_STOCK' ? 'Eget lager' : it.source === 'HOME_GROWN' ? 'Egen trädgård' : 'Köpt separat'),
          color: f ? f.farg : null, flowerId: f ? f.id : null,
          packText: supplier ? '' : (it.pricing && it.pricing.mode === 'STANDARD_MARKUP' ? 'Standardpåslag på kalkylkostnad ' + kr(Money.fromJSON(it.pricing.unitCostBasis)) + ' per styck' : ''),
          unit: supplier ? unitInfo(f).unit : '', desc: supplier ? unitInfo(f).desc : '', old: supplier ? !fresh(f).ok : false,
          buy: supplier && reqs.get(B.articleKey(f.id)) && reqs.get(B.articleKey(f.id)).hasPrice ? (() => { const r = reqs.get(B.articleKey(f.id)); const used = Number(it.quantity) * a.quantity; return buyText(f, r.packs, krFrac(r.cost), Number(r.needed) > used); })() : '' };
      });
      const stems = items.filter(i => i.supplier).reduce((s, i) => s + i.qty, 0);
      const labor = a.laborOverride && a.laborOverride.mode === 'fixed' ? Money.fromJSON(a.laborOverride.fee) : null;
      const out = { eventId: ev.id, eventName: ev.name, id: a.id, name: a.name, qty: a.quantity, kind, items, stems, sorts: items.filter(i => i.supplier).length,
        labor: labor ? String(labor.amount / 100n) + (labor.amount % 100n ? ',' + String(labor.amount % 100n).padStart(2, '0') : '') : '', state: 'empty',
        composition: items.filter(i => i.supplier).map(i => ({ name: i.name, color: i.color, n: i.qty })) };
      if (r && r.status === 'OK') {
        const unit = kind === 'BUSINESS' ? r.presented.exVat : r.presented.incVat, b = r.breakdown;
        Object.assign(out, { state: 'ok', mark: r.statusMark, price: kr(unit), unitAmount: unit.amount, basis: kind === 'BUSINESS' ? 'exkl. moms' : 'inkl. moms',
          receipt: [['Material (kalkylkostnad)', krFrac(b.materials.total)], ['Påslag', krFrac(b.markup.amount)], ['Arbete', krFrac(b.labor.amount)], ['Summa exkl. moms', krFrac(r.calculated.exVat), 'sum'],
            ['Moms', krFrac(r.calculated.vat)], ['Beräknat pris', krFrac(r.calculated.incVat), 'sum'], ['Avrundning', krFrac(r.presented.rounding)], ['Pris till kund', kr(r.presented.incVat), 'total']] });
      } else if (r && r.status === 'INCOMPLETE') out.state = 'missing';
      return out;
    }
    // ---------- sortiment: kategorier, undergrupper och sök ----------
    // Varje artikel har exakt ett hem (en kategori och en undergrupp). Sök täcker hela sortimentet oavsett kategori.
    const baseChar = ch => ch.toLowerCase().normalize('NFD')[0];
    const foldRaw = s => String(s == null ? '' : s).replace(/[\s\S]/g, baseChar);       // gemener utan diakriter, samma längd som originalet (för markering)
    const fold = s => foldRaw(s).replace(/\s+/g, ' ').trim();
    const collator = new Intl.Collator('sv');
    const catIx = new Map(D.CATEGORIES.map((c, i) => [c.id, i]));
    const grpIx = new Map(D.CATEGORIES.flatMap(c => c.groups.map((g, i) => [c.id + '/' + g.id, i])));
    const catName = new Map(D.CATEGORIES.map(c => [c.id, c.name]));
    const grpName = new Map(D.CATEGORIES.flatMap(c => c.groups.map(g => [c.id + '/' + g.id, g.name])));
    const FL = D.FLOWERS.map(f => {
      const u = unitInfo(f), fr = fresh(f), gk = f.kategori + '/' + f.grupp;
      return { id: f.id, name: f.namn, cat: f.kategori, grp: f.grupp, catName: catName.get(f.kategori), grpName: grpName.get(gk), color: f.farg, unit: u.unit, desc: u.desc, old: !fr.ok, days: fr.days,
        nameKey: fold(f.namn), words: fold(f.namn).split(' '), aliasKeys: (f.sok || []).map(fold),
        catWords: fold(catName.get(f.kategori) + ' ' + grpName.get(gk)).split(' '), order: 0 };
    }).sort((a, b) => (catIx.get(a.cat) - catIx.get(b.cat)) || (grpIx.get(a.cat + '/' + a.grp) - grpIx.get(b.cat + '/' + b.grp)) || collator.compare(a.name, b.name));
    FL.forEach((f, i) => { f.order = i; });
    const flowerById = new Map(FL.map(f => [f.id, f]));
    const flowers = () => FL;
    const flower = id => flowerById.get(id) || null;
    function categories() {
      return D.CATEGORIES.map(c => ({ id: c.id, name: c.name, count: FL.filter(f => f.cat === c.id).length,
        groups: c.groups.map(g => ({ id: g.id, name: g.name, count: FL.filter(f => f.cat === c.id && f.grp === g.id).length })) }));
    }
    const inCategory = (catId, grpId) => FL.filter(f => f.cat === catId && (!grpId || grpId === 'alla' || f.grp === grpId));
    /** 10 namnet börjar med ordet, 8 ett ord i namnet börjar med det, 5 del av namnet, 4 och 3 synonym, 1 kategori eller undergrupp. 0 = ingen träff. */
    function scoreToken(f, t) {
      if (f.nameKey.startsWith(t)) return 10;
      if (f.words.some(w => w.startsWith(t))) return 8;
      if (t.length > 1 && f.nameKey.includes(t)) return 5;
      if (f.aliasKeys.some(a => a.startsWith(t) || a.split(' ').some(w => w.startsWith(t)))) return 4;
      if (t.length > 1 && f.aliasKeys.some(a => a.includes(t))) return 3;
      if (f.catWords.some(w => w.startsWith(t))) return 1;
      return 0;
    }
    /** Hela sortimentet, oberoende av kategori. Alla ord måste träffa. Bäst träff först, därefter A till Ö. */
    function search(q) {
      const toks = fold(q).split(' ').filter(Boolean); if (!toks.length) return [];
      const hits = [];
      for (const f of FL) { let sum = 0; for (const t of toks) { const s = scoreToken(f, t); if (!s) { sum = 0; break; } sum += s; } if (sum) hits.push([sum, f]); }
      return hits.sort((a, b) => (b[0] - a[0]) || collator.compare(a[1].name, b[1].name)).map(h => h[1]);
    }
    /** Inköpsöversikt för ett jobb, rakt ur arbetsytans inköpsplan (hela förpackningar, det som blir över ingår i kundpriset). */
    function purchase(evId) {
      const ev = live(ws.events).find(e => e.id === evId); if (!ev) return null;
      const res = priceOf(ev.id), plan = res.plan;
      const rows = plan.requirements.map(r => { const f = D.FLOWERS.find(x => B.articleKey(x.id) === r.key), u = unitInfo(f);
        return { name: f.namn, color: f.farg, unit: u.unit, desc: u.desc, needed: Number(r.needed), packs: r.packs, bought: r.bought, leftover: r.leftover, hasPrice: r.hasPrice, cost: r.hasPrice ? krFrac(r.cost) : '', buy: r.hasPrice ? buyWhat(f, r.packs) + ' (' + r.bought + ' st)' : '' }; });
      return { eventId: ev.id, name: ev.name, rows, sum: krFrac(plan.purchaseSum), leftoverStems: plan.leftover.stems, leftoverValue: krFrac(plan.leftover.value), wholePacks: ws.shop.pricing.packMode === 'WHOLE_PACKS',
        notOrdered: [...new Set(res.needs.notOrdered.map(x => x.name))] };
    }
    function priceListStatus() { const old = D.FLOWERS.filter(f => !fresh(f).ok); return { total: D.FLOWERS.length, today: D.FLOWERS.length - old.length, old: old.map(f => ({ name: f.namn, days: fresh(f).days })) }; }

    // ---------- ändringar (allt via arbetsytans egna funktioner) ----------
    const draft = () => { const ev = W.createEvent(ws, ctx, { name: 'Bukett 8 oktober', type: 'bouquet' }); const a = W.addArrangement(ws, ctx, ev.id, { name: 'Bukett', quantity: 1 }); return { eventId: ev.id, arrId: a.id }; };
    function addFlower(arrId, flowerId) {
      const f = D.FLOWERS.find(x => x.id === flowerId), same = itemsOf(arrId).find(i => i.source === 'SUPPLIER' && i.articleRef.supplierProductId === flowerId);
      if (same) W.updateItem(ws, ctx, same.id, { quantity: Number(same.quantity) + 1 }); else W.addItem(ws, ctx, arrId, { source: 'SUPPLIER', name: f.namn, articleRef: art(f.id), quantity: 1 });
    }
    /** Lägger tillbaka en borttagen blomma med det antal stjälkar den hade (för "Ångra"). */
    function restoreFlower(arrId, flowerId, qty) {
      addFlower(arrId, flowerId);
      const it = itemsOf(arrId).find(i => i.source === 'SUPPLIER' && i.articleRef.supplierProductId === flowerId);
      if (it && qty > 1) W.updateItem(ws, ctx, it.id, { quantity: Math.max(1, Math.round(qty)) });
    }
    const setQty = (itemId, q) => W.updateItem(ws, ctx, itemId, { quantity: Math.max(1, Math.round(q)) });
    const removeItem = itemId => W.removeItem(ws, ctx, itemId);
    const setCount = (arrId, n) => W.updateArrangement(ws, ctx, arrId, { quantity: Math.max(1, Math.round(n)) });
    const setLabor = (arrId, text) => {
      const v = String(text || '').replace(/[\s ]/g, '').replace(',', '.');
      if (v === '') return W.updateArrangement(ws, ctx, arrId, { laborOverride: null });
      if (!/^\d{1,9}(\.\d{1,2})?$/.test(v)) throw new Error('Skriv arbetet i kronor, till exempel 350 eller 62,50.');
      W.updateArrangement(ws, ctx, arrId, { laborOverride: fixed(v) });
    };
    const rename = (arrId, name) => { const n = String(name || '').trim(); if (n) W.updateArrangement(ws, ctx, arrId, { name: n }); };
    const addOwn = (arrId, name, cost) => W.addItem(ws, ctx, arrId, { source: 'OWN_STOCK', name: String(name).trim(), quantity: 1, pricing: { mode: 'STANDARD_MARKUP', unitCostBasis: Money.fromDecimal(String(cost)).toJSON() } });
    const removeArrangement = arrId => W.removeArrangement(ws, ctx, arrId);
    const removeJob = evId => W.removeEvent(ws, ctx, evId);
    const addArrangement = (evId, name) => W.addArrangement(ws, ctx, evId, { name: name || 'Nytt arrangemang', quantity: 1 }).id;
    return { jobs, job, arrangement, flowers, flower, categories, inCategory, search, fold, foldRaw, purchase, unitInfo: f => unitInfo(D.FLOWERS.find(x => x.id === f)), priceListStatus, draft, addFlower, restoreFlower, setQty, removeItem, setCount, setLabor, rename, removeArrangement, removeJob, addArrangement, addOwn, kr, TODAY };
  }
  return { create, kr };
});
