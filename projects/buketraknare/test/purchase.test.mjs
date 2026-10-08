// Exakt inköpsplan: hela förpackningar, delning mellan arrangemang, hemmalager och frakt. Samt egenskapstest.
import test from 'node:test';
import assert from 'node:assert/strict';
import M from '../public/js/core/money.js';
import PU from '../public/js/core/purchase.js';
import { rng, intIn, pickOf } from './support/rng.mjs';

const { Money, Frac, EconomyError } = M;
const K = s => Money.fromDecimal(s);
const F = (n, d = 1) => Frac.of(BigInt(n), BigInt(d));
const code = fn => { try { fn(); } catch (e) { return e instanceof EconomyError ? e.code : 'other:' + e.message; } return null; };
const kr = f => Money.fromFrac(f, 'HALF_UP', 'SEK').toDecimalString();

const art = (packSize, price, extra = {}) => ({ name: 'x', packSize, packPrice: price === null ? null : K(price), source: { kind: 'LIVE' }, ...extra });
const arr = (id, quantity, items) => ({ id, quantity, items });
const item = (id, key, quantity) => ({ id, articleKey: key, quantity });
const plan = (over = {}) => PU.planPurchase({ currency: 'SEK', arrangements: [], catalog: {}, onHand: {}, packMode: 'WHOLE_PACKS', shipping: {}, ...over });
const req = (p, key) => p.requirements.find(r => r.key === key);

test('hela förpackningar: 83 behövs, 20-pack ger 5 förpackningar, 100 stjälkar och 17 över', () => {
  const p = plan({ arrangements: [arr('a', 1, [item('i', 'x', 83)])], catalog: { x: art(20, '100') } });
  const r = req(p, 'x');
  assert.deepEqual([r.needed, r.toBuy, r.packs, r.bought, r.leftover], [83, 83, 5, 100, 17]);
  assert.equal(kr(r.cost), '500.00');
  assert.equal(kr(r.usedCost), '500.00');                                  // hela förpackningar räknas in
  assert.equal(kr(r.leftoverValue), '85.00');                              // 17 × 5 kr
  assert.equal(p.leftover.stems, 17);
});

test('bara det som används: kostnaden är det som går åt, inte hela förpackningarna', () => {
  const p = plan({ packMode: 'USED_ONLY', arrangements: [arr('a', 1, [item('i', 'x', 83)])], catalog: { x: art(20, '100') } });
  assert.equal(kr(req(p, 'x').cost), '500.00');                           // inköpssumman är densamma
  assert.equal(kr(req(p, 'x').usedCost), '415.00');                       // 83 × 5 kr
});

test('förpackningar delas mellan arrangemang: behovet summeras över alla arrangemang och antal', () => {
  const p = plan({ arrangements: [arr('a', 3, [item('i1', 'x', 4)]), arr('b', 2, [item('i2', 'x', 5)])], catalog: { x: art(10, '100') } });
  const r = req(p, 'x');
  assert.deepEqual([r.needed, r.packs, r.bought, r.leftover], [22, 3, 30, 8]);   // 3 × 4 + 2 × 5 = 22
  assert.equal(kr(p.purchaseSum), '300.00');
  // varje rad bär sin andel efter hur mycket den används: 4 av 22 stjälkar för en enhet av arrangemang a
  assert.equal(p.arrangements[0].items[0].cost.toString(), '60000/11');   // 4 × 30000 ören ÷ 22
  assert.equal(p.arrangements[1].items[0].cost.toString(), '75000/11');
  // kostnaden går åt exakt: antal × andel summerar till hela kostnaden
  const total = Frac.sum(p.arrangements.map(a => a.materialCost.mul(F(a.quantity))));
  assert.equal(total.toString(), '30000');
});

test('hemmalager: det som finns hemma behöver inte köpas, och mer än behovet räknas bara till behovet', () => {
  const base = { arrangements: [arr('a', 3, [item('i1', 'x', 4)]), arr('b', 2, [item('i2', 'x', 5)])], catalog: { x: art(10, '100') } };
  const some = req(plan({ ...base, onHand: { x: 5 } }), 'x');
  assert.deepEqual([some.needed, some.onHand, some.toBuy, some.packs], [22, 5, 17, 2]);
  const lots = req(plan({ ...base, onHand: { x: 99 } }), 'x');
  assert.deepEqual([lots.onHand, lots.toBuy, lots.packs, lots.bought, lots.leftover], [22, 0, 0, 0, 0]);
  assert.equal(kr(lots.cost), '0.00');
  assert.equal(kr(plan({ ...base, onHand: { x: 99 } }).purchaseSum), '0.00');
});

test('artikel som saknas i katalogen eller saknar pris ger en rad utan pris, aldrig 0 kr', () => {
  const p = plan({ arrangements: [arr('a', 1, [item('i1', 'saknas', 3), item('i2', 'gratis', 3), item('i3', 'nollpris', 3), item('i4', 'ok', 3)])],
    catalog: { gratis: art(10, null), nollpris: art(10, '0'), ok: art(10, '50') } });
  assert.deepEqual(p.missing, ['saknas']);
  assert.deepEqual(p.noPrice, ['gratis', 'nollpris']);
  assert.deepEqual(p.arrangements[0].items.map(i => [i.itemId, i.status, i.cost === null ? null : kr(i.cost)]), [['i1', 'missing', null], ['i2', 'no_price', null], ['i3', 'no_price', null], ['i4', 'ok', '50.00']]);   // hela förpackningen på 50 kr går åt till de tre stjälkarna
  assert.equal(PU.planPurchase({ currency: 'SEK', packMode: 'USED_ONLY', arrangements: [arr('a', 1, [item('i4', 'ok', 3)])], catalog: { ok: art(10, '50') }, onHand: {}, shipping: {} }).arrangements[0].items[0].cost.toString(), '1500');   // bara det som används: 3 × 5 kr
  assert.equal(p.arrangements[0].complete, false);
  assert.equal(req(p, 'gratis').hasPrice, false); assert.equal(req(p, 'gratis').packPrice, null);
  assert.equal(p.leftover.stems, 7);                                      // bara artiklar med pris räknas som överskott
});

test('frakt: avgift, fri frakt från ett belopp och ingen frakt utan inköp', () => {
  const at = (fee, freeFrom, onHand = {}) => plan({ arrangements: [arr('a', 1, [item('i', 'x', 30)])], catalog: { x: art(10, '100') }, onHand, shipping: { fee: fee && K(fee), freeFrom: freeFrom && K(freeFrom) } });
  assert.deepEqual([kr(at('79', '600').shipping.total), at('79', '600').shipping.rule], ['79.00', 'CHARGED']);       // 300 kr: under gränsen
  assert.deepEqual([kr(at('79', '300').shipping.total), at('79', '300').shipping.rule], ['0.00', 'FREE_FROM_REACHED']);   // exakt på gränsen
  assert.deepEqual([kr(at('79', '299,99').shipping.total), at('79', '299,99').shipping.rule], ['0.00', 'FREE_FROM_REACHED']);
  assert.deepEqual([kr(at('79', '300,01').shipping.total), at('79', '300,01').shipping.rule], ['79.00', 'CHARGED']);
  assert.deepEqual([kr(at('79', null).shipping.total), at('79', null).shipping.rule], ['79.00', 'CHARGED']);            // ingen gräns för fri frakt
  assert.deepEqual([kr(at(null, '600').shipping.total), at(null, '600').shipping.rule], ['0.00', 'NONE']);
  assert.deepEqual([kr(at('0', null).shipping.total), at('0', null).shipping.rule], ['0.00', 'NONE']);
  assert.deepEqual([kr(at('79', null, { x: 30 }).shipping.total), at('79', null, { x: 30 }).shipping.rule], ['0.00', 'NONE']);   // allt finns hemma: inget köps, ingen frakt
});

test('frakt fördelas på arrangemangen efter hur mycket blommor de innehåller, och summan är exakt', () => {
  const p = plan({ arrangements: [arr('a', 3, [item('i1', 'x', 4)]), arr('b', 2, [item('i2', 'x', 5)])], catalog: { x: art(10, '100') }, shipping: { fee: K('79') } });
  assert.equal(p.arrangements[0].freightShare.toString(), '15800/11'); assert.equal(p.arrangements[1].freightShare.toString(), '19750/11');
  const total = Frac.sum(p.arrangements.map(a => a.freightShare.mul(F(a.quantity))));
  assert.equal(total.toString(), '7900');                                  // exakt 79 kr, ingen öre försvinner
  assert.equal(plan({ arrangements: [arr('a', 1, [item('i', 'x', 3)])], catalog: { x: art(10, '100') } }).arrangements[0].freightShare.toString(), '0');
});

test('tomma arrangemang delar inte på frakten och ingen artikel räknas två gånger', () => {
  const p = plan({ arrangements: [arr('tom', 5, []), arr('a', 1, [item('i1', 'x', 3), item('i2', 'x', 3)])], catalog: { x: art(10, '100') }, shipping: { fee: K('50') } });
  assert.equal(req(p, 'x').needed, 6);
  assert.equal(p.arrangements[0].freightShare.toString(), '0'); assert.equal(p.arrangements[0].nonEmpty, false);
  assert.equal(p.arrangements[1].freightShare.toString(), '5000');
  assert.equal(p.arrangements[1].items.length, 2);
});

test('felaktiga indata avvisas', () => {
  const ok = { arrangements: [arr('a', 1, [item('i', 'x', 1)])], catalog: { x: art(10, '100') } };
  assert.equal(code(() => plan({ ...ok, packMode: 'ALLA' })), 'bad_pack_mode');
  assert.equal(code(() => plan({ ...ok, arrangements: [arr('a', 0, [item('i', 'x', 1)])] })), 'bad_quantity');
  assert.equal(code(() => plan({ ...ok, arrangements: [arr('a', 1.5, [item('i', 'x', 1)])] })), 'bad_quantity');
  assert.equal(code(() => plan({ ...ok, arrangements: [arr('a', 1, [item('i', 'x', 0)])] })), 'bad_quantity');
  assert.equal(code(() => plan({ ...ok, arrangements: [arr('a', 1, [item('i', 'x', 2.5)])] })), 'bad_quantity');
  assert.equal(code(() => plan({ ...ok, catalog: { x: art(0, '100') } })), 'bad_quantity');
  assert.equal(code(() => plan({ ...ok, catalog: { x: art(10, '100', { packPrice: Money.of(100, 'EUR') }) } })), 'bad_price');
  assert.equal(code(() => plan({ ...ok, catalog: { x: art(10, '100', { packPrice: 100 }) } })), 'bad_price');
  assert.equal(code(() => plan({ ...ok, onHand: { x: -1 } })), 'bad_quantity');
  assert.equal(code(() => plan({ ...ok, onHand: { x: 1.5 } })), 'bad_quantity');
  assert.equal(code(() => plan({ ...ok, shipping: { fee: Money.of(100, 'EUR') } })), 'bad_shipping');
});

test('egenskaper: förpackningar, kostnad och frakt går ihop exakt (1 500 slumpade planer)', () => {
  const r = rng(77), int = intIn(r), pick = pickOf(r);
  for (let i = 0; i < 1500; i++) {
    const keys = ['a', 'b', 'c', 'd'].slice(0, int(1, 4));
    const catalog = Object.fromEntries(keys.map(k => [k, art(int(1, 50), pick([null, '0', '1,5', '12,34', '99', '1234,56']))]));
    const arrangements = Array.from({ length: int(1, 4) }, (_, a) => arr('r' + a, int(1, 6), Array.from({ length: int(0, 4) }, (_, j) => item(`r${a}i${j}`, pick(keys), int(1, 30)))));
    const onHand = Object.fromEntries(keys.filter(() => r() < 0.4).map(k => [k, int(0, 120)]));
    const packMode = pick(['WHOLE_PACKS', 'USED_ONLY']);
    const p = PU.planPurchase({ currency: 'SEK', arrangements, catalog, onHand, packMode, shipping: { fee: pick([null, K('79'), K('0'), K('12,5')]), freeFrom: pick([null, K('600'), K('50')]) } });
    for (const q of p.requirements) {
      assert.ok(q.bought >= q.toBuy && q.bought - q.toBuy < q.packSize, 'färsta antalet förpackningar som räcker');
      assert.ok(q.packs === 0 || (q.packs - 1) * q.packSize < q.toBuy, 'inte en förpackning för mycket');
      assert.equal(q.toBuy + q.onHand, q.needed);
      assert.equal(q.leftover, q.bought - q.toBuy);
      assert.ok(q.onHand <= q.needed);
    }
    // all förpackningskostnad (priset på det som används) fördelas på raderna, exakt
    const allocated = Frac.sum(p.arrangements.map(a => a.items.filter(x => x.cost !== null).reduce((s, x) => s.add(x.cost.mul(F(a.quantity))), F(0))));
    assert.ok(allocated.eq(Frac.sum(p.requirements.filter(q => q.hasPrice).map(q => q.usedCost))), 'kostnaden fördelas exakt');
    if (p.shipping.total.gt(F(0))) {
      const f = Frac.sum(p.arrangements.map(a => a.freightShare.mul(F(a.quantity))));
      assert.ok(f.eq(p.shipping.total), 'frakten fördelas exakt');
      assert.ok(p.purchaseSum.gt(F(0)));
    } else assert.ok(p.arrangements.every(a => a.freightShare.isZero()));
    assert.ok(p.purchaseSum.eq(Frac.sum(p.requirements.map(q => q.cost))));
  }
});
