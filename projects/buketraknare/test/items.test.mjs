// ArrangementItem: grossistartiklar OCH egna material i samma arrangemang. Källmodell, requiresPurchase, prissättningssätt,
// noll inköpskostnad ≠ noll värde, och att egna material aldrig kräver en SupplierProduct.
import test from 'node:test';
import assert from 'node:assert/strict';
import M from '../public/js/core/money.js';
import I from '../public/js/core/items.js';

const { Money, Frac } = M;
const mj = s => Money.fromDecimal(s).toJSON();
const codes = fn => { try { fn(); } catch (e) { if (e instanceof I.ItemValidationError) return e.problems.map(p => p.code); throw e; } return []; };
const ref = { connectionId: 'conn_manual', supplierProductId: 'fp_avalanche-60' };
const cur = { currency: 'SEK' };

const supplier = (over = {}) => ({ id: 'i1', source: 'SUPPLIER', name: 'Avalanche 60 cm', articleRef: ref, quantity: 12, ...over });
const own = (source, over = {}) => ({ id: 'i2', source, name: 'Sidenband', quantity: 1, pricing: { mode: 'STANDARD_MARKUP', unitCostBasis: mj('20') }, ...over });
const fixedPrice = (amount, basis = 'inc') => ({ mode: 'FIXED_SALE_PRICE', unitSalePrice: { amount: mj(amount), basis } });

test('grossistartikel: kräver en artikel, beställs alltid och får sin kostnad ur grossistens pris', () => {
  const it = I.normalizeItem(supplier(), cur);
  assert.equal(it.requiresPurchase, true); assert.equal(it.kind, 'flowers'); assert.equal(it.pricing.mode, 'STANDARD_MARKUP');
  assert.equal(it.pricing.unitCostBasis, null); assert.equal(it.pricing.unitExternalCost, null);
  assert.equal(I.purchaseNeed(it), 'WHOLESALER');
  assert.equal(I.articleKey(it.articleRef), 'conn_manual:fp_avalanche-60');
  assert.deepEqual(codes(() => I.normalizeItem(supplier({ articleRef: null }), cur)), ['supplier_needs_article']);
  assert.deepEqual(codes(() => I.normalizeItem(supplier({ articleRef: { connectionId: 'c' } }), cur)), ['supplier_needs_article']);
  assert.deepEqual(codes(() => I.normalizeItem(supplier({ requiresPurchase: false }), cur)), ['requires_purchase_conflict']);
  assert.deepEqual(codes(() => I.normalizeItem(supplier({ pricing: { mode: 'STANDARD_MARKUP', unitCostBasis: mj('5') } }), cur)), ['supplier_cost_from_quote']);
  assert.deepEqual(codes(() => I.normalizeItem(supplier({ quantity: 2.5 }), cur)), ['bad_quantity']);                 // stjälkar är hela
});

test('Avalanche 50 och 60 är olika artiklar och olika inköpsnycklar', () => {
  const a50 = I.normalizeItem(supplier({ articleRef: { connectionId: 'conn_manual', supplierProductId: 'fp_avalanche-50' } }), cur);
  const a60 = I.normalizeItem(supplier(), cur);
  assert.notEqual(I.articleKey(a50.articleRef), I.articleKey(a60.articleRef));
});

test('egna material kräver ingen SupplierProduct och beställs inte', () => {
  for (const source of ['OWN_STOCK', 'HOME_GROWN']) {
    const it = I.normalizeItem(own(source), cur);
    assert.equal(it.articleRef, null); assert.equal(it.requiresPurchase, false); assert.equal(I.purchaseNeed(it), null, source);
  }
  assert.equal(I.normalizeItem(own('MANUAL'), cur).requiresPurchase, false);
  assert.equal(I.purchaseNeed(I.normalizeItem(own('MANUAL'), cur)), null);
  assert.equal(I.normalizeItem(own('OWN_STOCK'), cur).kind, 'accessories');
  assert.equal(I.normalizeItem(own('HOME_GROWN'), cur).kind, 'flowers');
});

test('requiresPurchase: eget lager och egen trädgård beställs aldrig, ett manuellt material kan behöva köpas någon annanstans', () => {
  assert.deepEqual(codes(() => I.normalizeItem(own('OWN_STOCK', { requiresPurchase: true }), cur)), ['requires_purchase_conflict']);
  assert.deepEqual(codes(() => I.normalizeItem(own('HOME_GROWN', { requiresPurchase: true }), cur)), ['requires_purchase_conflict']);
  const manual = I.normalizeItem(own('MANUAL', { requiresPurchase: true, name: 'Antik vas' }), cur);
  assert.equal(I.purchaseNeed(manual), 'ELSEWHERE');                       // aldrig 'WHOLESALER': hamnar inte i grossistens beställning
  assert.deepEqual(codes(() => I.normalizeItem(own('OWN_STOCK', { articleRef: ref }), cur)), ['article_on_non_supplier']);
  assert.deepEqual(codes(() => I.normalizeItem(own('MANUAL', { requiresPurchase: 'ja' }), cur)), ['bad_requires_purchase']);
});

test('källor: okända avvisas och LEFTOVER är en reserverad plats som inte är aktiverad', () => {
  assert.deepEqual(codes(() => I.normalizeItem(own('LEFTOVER'), cur)), ['source_not_enabled']);
  assert.deepEqual(codes(() => I.normalizeItem(own('GARDEN'), cur)), ['bad_source']);
  assert.deepEqual([...I.SOURCES], ['SUPPLIER', 'OWN_STOCK', 'HOME_GROWN', 'MANUAL']);
  assert.deepEqual([...I.RESERVED_SOURCES], ['LEFTOVER']);
});

test('NOLL INKÖPSKOSTNAD BETYDER INTE NOLL VÄRDE: tre skilda fält, och noll kalkylkostnad godtas inte tyst', () => {
  // dahlior från egen trädgård: extern kostnad 0, men värde
  const asked = codes(() => I.normalizeItem(own('HOME_GROWN', { name: 'Dahlia', quantity: 5, pricing: { mode: 'STANDARD_MARKUP', unitCostBasis: mj('0') } }), cur));
  assert.deepEqual(asked, ['zero_cost_needs_value']);                       // standardpåslag på 0 kr ger 0 kr: kräver ett värde
  assert.deepEqual(codes(() => I.normalizeItem(own('HOME_GROWN', { name: 'Dahlia', pricing: { mode: 'STANDARD_MARKUP' } }), cur)), ['cost_basis_missing']);
  const withValue = I.normalizeItem(own('HOME_GROWN', { name: 'Dahlia', quantity: 5, pricing: { mode: 'STANDARD_MARKUP', unitCostBasis: mj('8') } }), cur);
  assert.equal(withValue.pricing.unitExternalCost.amount, '0');             // extern inköpskostnad är 0 (standard för egna material)
  const fixedValue = I.normalizeItem(own('HOME_GROWN', { name: 'Dahlia', quantity: 5, pricing: { ...fixedPrice('25'), unitExternalCost: mj('0') } }), cur);
  assert.equal(fixedValue.pricing.mode, 'FIXED_SALE_PRICE');
  assert.deepEqual(codes(() => I.normalizeItem(own('HOME_GROWN', { name: 'Dahlia', pricing: fixedPrice('0') }), cur)), []);   // 0 kr som kundpris är ett uttryckligt val
});

test('prissättningssätt: standardpåslag eller fast kundpris, med eller utan moms', () => {
  assert.deepEqual([...I.PRICING_MODES], ['STANDARD_MARKUP', 'FIXED_SALE_PRICE']);
  assert.deepEqual(codes(() => I.normalizeItem(own('OWN_STOCK', { pricing: { mode: 'GRATIS' } }), cur)), ['bad_pricing_mode']);
  assert.deepEqual(codes(() => I.normalizeItem(own('OWN_STOCK', { pricing: { mode: 'FIXED_SALE_PRICE' } }), cur)), ['sale_price_missing']);
  assert.deepEqual(codes(() => I.normalizeItem(own('OWN_STOCK', { pricing: fixedPrice('75', 'kanske') }), cur)), ['bad_sale_basis']);
  assert.deepEqual(codes(() => I.normalizeItem(own('OWN_STOCK', { pricing: fixedPrice('-1') }), cur)), ['negative_amount']);
  assert.deepEqual(codes(() => I.normalizeItem(own('OWN_STOCK', { pricing: { mode: 'STANDARD_MARKUP', unitCostBasis: mj('-5') } }), cur)), ['negative_amount']);
  assert.deepEqual(codes(() => I.normalizeItem(own('OWN_STOCK', { pricing: { mode: 'STANDARD_MARKUP', unitCostBasis: { amount: 'abc', currency: 'SEK' } } }), cur)), ['bad_money']);
  assert.deepEqual(codes(() => I.normalizeItem(own('OWN_STOCK', { pricing: { mode: 'STANDARD_MARKUP', unitCostBasis: Money.of(100n, 'EUR').toJSON() } }), cur)), ['currency_mismatch']);
  // en grossistartikel kan också säljas till ett fast pris (kostnaden kommer fortfarande från grossisten)
  assert.deepEqual(codes(() => I.normalizeItem(supplier({ pricing: fixedPrice('45') }), cur)), []);
});

test('moms gäller även egna tillägg: varje rad kan få en momskategori oavsett källa, och ingen sats gissas', () => {
  for (const source of ['SUPPLIER', 'OWN_STOCK', 'HOME_GROWN', 'MANUAL']) {
    const spec = source === 'SUPPLIER' ? supplier({ taxCategory: 'plants' }) : own(source, { taxCategory: 'plants' });
    assert.equal(I.normalizeItem(spec, cur).taxCategory, 'plants', source);
  }
  assert.equal(I.normalizeItem(own('OWN_STOCK'), cur).taxCategory, null);          // utan kategori gäller butikens standard för varor
  assert.deepEqual(codes(() => I.normalizeItem(own('OWN_STOCK', { taxCategory: 'momsfritt' }), cur)), ['bad_tax_category']);
  assert.equal('vatRate' in I.normalizeItem(own('OWN_STOCK'), cur), false);        // raden bär aldrig en sats
  assert.equal('rateBp' in I.normalizeItem(own('OWN_STOCK'), cur).pricing, false);
});

test('övrig kontroll: namn, antal, typ och id', () => {
  assert.deepEqual(codes(() => I.normalizeItem(own('OWN_STOCK', { name: ' ' }), cur)), ['bad_name']);
  assert.deepEqual(codes(() => I.normalizeItem(own('OWN_STOCK', { quantity: 0 }), cur)), ['bad_quantity']);
  assert.deepEqual(codes(() => I.normalizeItem(own('OWN_STOCK', { quantity: 'många' }), cur)), ['bad_quantity']);
  assert.deepEqual(codes(() => I.normalizeItem(own('OWN_STOCK', { kind: 'ting' }), cur)), ['bad_kind']);
  assert.deepEqual(codes(() => I.normalizeItem(own('OWN_STOCK', { id: '' }), cur)), ['bad_id']);
  assert.equal(I.normalizeItem(own('OWN_STOCK', { quantity: '2,5' }), cur).quantity, '2.5');       // meter sidenband
  assert.equal(I.quantityOf(I.normalizeItem(own('OWN_STOCK', { quantity: '2,5' }), cur)).toString(), '5/2');
  assert.equal(codes(() => I.normalizeItem(own('OWN_STOCK', { id: '' }), cur)).length, 1);
});

test('MANUAL kan ha samma namn som en grossistartikel men pekar aldrig på en (inga dolda kopplingar)', () => {
  const it = I.normalizeItem(own('MANUAL', { name: 'Avalanche 60 cm' }), cur);
  assert.equal(it.articleRef, null); assert.equal(I.purchaseNeed(it), null);
});

test('Mina material finns som en reserverad plats (materialRef) som inte används än', () => {
  assert.equal(I.normalizeItem(own('OWN_STOCK'), cur).materialRef, null);
  assert.equal(I.normalizeItem(own('OWN_STOCK', { materialRef: 'mat_sidenband' }), cur).materialRef, 'mat_sidenband');
});

test('raden är enkel JSON och tål att sparas och läsas tillbaka', () => {
  for (const spec of [supplier(), own('OWN_STOCK', { pricing: fixedPrice('75') }), own('HOME_GROWN', { quantity: 5, pricing: { mode: 'STANDARD_MARKUP', unitCostBasis: mj('8') } })]) {
    const it = I.normalizeItem(spec, cur);
    const back = JSON.parse(JSON.stringify(it));
    assert.deepEqual(back, it);
    assert.deepEqual(I.validateItem(back, cur), []);
  }
});

// ---------- från rad till motorn ----------
test('itemToCostLine: egna material räknar ur raden, grossistartiklar ur inköpsplanen', () => {
  const dahlia = I.normalizeItem(own('HOME_GROWN', { id: 'd', name: 'Dahlia', quantity: 5, pricing: { mode: 'STANDARD_MARKUP', unitCostBasis: mj('8') } }), cur);
  const l = I.itemToCostLine(dahlia);
  assert.equal(l.cost.toString(), '4000'); assert.equal(l.pricing, 'STANDARD_MARKUP'); assert.equal(l.markup, true);
  assert.deepEqual(l.source, { kind: 'MANUAL', ref: 'own:HOME_GROWN' });
  const band = I.normalizeItem(own('OWN_STOCK', { id: 'b', pricing: { mode: 'FIXED_SALE_PRICE', unitCostBasis: mj('20'), unitSalePrice: { amount: mj('75'), basis: 'inc' } } }), cur);
  const lb = I.itemToCostLine(band);
  assert.equal(lb.pricing, 'FIXED_SALE_PRICE'); assert.equal(lb.cost.toString(), '2000'); assert.equal(lb.salePrice.amount.toString(), '7500'); assert.equal(lb.salePrice.basis, 'inc');
  const dahlias = I.normalizeItem(own('HOME_GROWN', { id: 'e', name: 'Dahlia', quantity: 5, pricing: { mode: 'FIXED_SALE_PRICE', unitCostBasis: mj('0'), unitSalePrice: { amount: mj('25'), basis: 'inc' } } }), cur);
  assert.equal(I.itemToCostLine(dahlias).salePrice.amount.toString(), '12500');      // 5 × 25 kr
  assert.equal(I.itemToCostLine(dahlias).cost.toString(), '0');                       // kostnaden är 0 men priset är det inte
  const sup = I.normalizeItem(supplier({ id: 's' }), cur);
  const ok = I.itemToCostLine(sup, { status: 'ok', cost: Frac.of(5000n), source: { kind: 'LIVE' } });
  assert.equal(ok.cost.toString(), '5000'); assert.deepEqual(ok.source, { kind: 'LIVE' });
  assert.equal(I.itemToCostLine(sup, { status: 'no_price', cost: null }).cost, null);
  assert.equal(I.itemToCostLine(sup).cost, null);
  const noCost = I.normalizeItem(own('OWN_STOCK', { id: 'v', name: 'Antik vas', pricing: fixedPrice('250') }), cur);
  assert.equal(I.itemToCostLine(noCost).cost, null);                                   // ingen påhittad kostnad
});
