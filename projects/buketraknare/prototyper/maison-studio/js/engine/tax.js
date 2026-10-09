/* Buketträknaren: skatteregler som versionerade data (TaxRuleSet).
 *
 * Det här är STRUKTUREN. Den här filen innehåller inga officiella svenska momssatser och förklarar inte
 * att någon sats är "rätt". Reglerna är data med giltighetstid, källa och verifieringsstatus. Ingen annan kod
 * i appen får känna till en momssats: man frågar resolveRate(kategori, datum) och får satsen och regelversionen.
 *
 * Tre slags källor:
 *   official      en människa har kontrollerat satsen mot en officiell källa (länk, vem, när). Det enda som får verifieras.
 *   user_setting  floristens egen inställning i appen (dagens "Moms (%)"). Aldrig verifierad.
 *   fixture       testdata. Aldrig verifierad. Finns bara i tester.
 *
 * Verifieringsstatus 'verified' kräver källan 'official' med länk, verifiedBy och verifiedAt. Allt annat är 'unverified'.
 * En faktura får inte godkännas med en regeluppsättning som inte är verified (assertVerified).
 *
 * Ett publicerat TaxRuleSet är fryst och ändras aldrig. En ny regel är en ny version. När ett dokument godkänns kopieras
 * satsen och regelversionen in på raden (freezeRate), så en senare regeländring kan inte ändra ett gammalt dokument.
 */
(function (root, factory) {
  var dep = (typeof module === 'object' && module.exports) ? require('./money.js') : root.BRMoney;
  var api = factory(dep);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.BRTax = api;
})(typeof self !== 'undefined' ? self : this, function (M) {
  'use strict';
  const { EconomyError, Rate } = M;

  /** Vad en rad ÄR. Kategorin är inte en sats. Satsen slås upp i ett TaxRuleSet. */
  const TAX_CATEGORIES = Object.freeze(['flowers', 'plants', 'accessories', 'arrangement_goods', 'labor', 'delivery', 'setup', 'other']);
  const SOURCE_KINDS = Object.freeze(['official', 'user_setting', 'fixture']);
  const ROUNDING_LEVELS = Object.freeze(['line', 'rate_summary']);
  const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
  const LEGACY_ID = 'legacy-user-setting';

  function deepFreeze(o) { if (o && typeof o === 'object' && !Object.isFrozen(o)) { Object.freeze(o); Object.values(o).forEach(deepFreeze); } return o; }
  const isDate = s => typeof s === 'string' && DATE_RE.test(s);

  /** Bygger och validerar en regeluppsättning. Kastar EconomyError('bad_rule_set') med alla fel. */
  function createRuleSet(spec) {
    const p = [];
    const s = spec || {};
    if (typeof s.id !== 'string' || !s.id.trim()) p.push('id saknas');
    if (!Number.isSafeInteger(s.version) || s.version < 1) p.push('version måste vara ett heltal från 1');
    if (!isDate(s.validFrom)) p.push('validFrom måste vara ett datum ÅÅÅÅ-MM-DD');
    if (s.validTo !== null && s.validTo !== undefined && (!isDate(s.validTo) || (isDate(s.validFrom) && s.validTo < s.validFrom))) p.push('validTo måste vara null eller ett datum efter validFrom');
    const rates = {};
    if (!s.rates || typeof s.rates !== 'object') p.push('rates saknas');
    else for (const [cat, bp] of Object.entries(s.rates)) {
      if (!TAX_CATEGORIES.includes(cat)) p.push('okänd skattekategori: ' + cat);
      else if (!Number.isSafeInteger(bp) || bp < 0 || bp > 10000) p.push('sats för ' + cat + ' måste vara ett heltal i hundradels procent, 0 till 10000');
      else rates[cat] = bp;
    }
    const level = s.roundingLevel === undefined ? 'line' : s.roundingLevel;
    if (!ROUNDING_LEVELS.includes(level)) p.push('okänd avrundningsnivå: ' + level);
    const src = s.source || {};
    if (!SOURCE_KINDS.includes(src.kind)) p.push('source.kind måste vara en av ' + SOURCE_KINDS.join(', '));
    const ver = s.verification || { status: 'unverified' };
    if (ver.status !== 'verified' && ver.status !== 'unverified') p.push('verification.status måste vara verified eller unverified');
    if (ver.status === 'verified') {
      if (src.kind !== 'official') p.push('bara en officiell källa kan vara verifierad (inte ' + src.kind + ')');
      if (!src.url) p.push('en verifierad regel kräver source.url');
      if (!ver.verifiedBy) p.push('en verifierad regel kräver verification.verifiedBy');
      if (!isDate(ver.verifiedAt)) p.push('en verifierad regel kräver verification.verifiedAt (datum)');
    }
    if (p.length) throw new EconomyError('bad_rule_set', 'ogiltig regeluppsättning: ' + p.join('; '), p);
    return deepFreeze({
      id: s.id, version: s.version, validFrom: s.validFrom, validTo: s.validTo === undefined ? null : s.validTo,
      rates, roundingLevel: level,
      source: { kind: src.kind, url: src.url || null, note: src.note || null },
      verification: ver.status === 'verified' ? { status: 'verified', verifiedBy: ver.verifiedBy, verifiedAt: ver.verifiedAt } : { status: 'unverified', verifiedBy: null, verifiedAt: null }
    });
  }

  /**
   * Regeluppsättningen som bara speglar floristens egen momsinställning (dagens "Moms (%)").
   * Alla kategorier får samma sats. ALDRIG verifierad, och kan därför inte användas för en faktura.
   * Den finns för att den nya motorn ska kunna räkna exakt som den gamla appen gör, utan att någon sats hårdkodas.
   */
  function legacyUserSettingRuleSet(vatPercent, opts) {
    const bp = Rate.fromPercent(vatPercent);
    const rates = {};
    TAX_CATEGORIES.forEach(c => { rates[c] = bp; });
    return createRuleSet({
      id: LEGACY_ID, version: (opts && opts.version) || 1, validFrom: '1900-01-01', validTo: null, rates, roundingLevel: 'line',
      source: { kind: 'user_setting', note: 'Floristens egen inställning i appen. Inte en verifierad regel.' },
      verification: { status: 'unverified' }
    });
  }

  const inForce = (rs, date) => rs.validFrom <= date && (rs.validTo === null || date <= rs.validTo);

  /** Väljer vilken regeluppsättning som gäller ett datum: samma id med högst version. Två olika id samtidigt är tvetydigt. */
  function selectRuleSet(ruleSets, date) {
    if (!isDate(date)) return { ok: false, reason: 'bad_date' };
    const live = (ruleSets || []).filter(rs => inForce(rs, date));
    if (!live.length) return { ok: false, reason: 'no_rule_set' };
    if (new Set(live.map(rs => rs.id)).size > 1) return { ok: false, reason: 'ambiguous_rule_set' };
    return { ok: true, ruleSet: live.reduce((a, b) => (b.version > a.version ? b : a)) };
  }

  /**
   * Satsen för en kategori ett datum. Ger { ok: true, rateBp, ruleSetRef, verification, sourceKind, ... }
   * eller { ok: false, reason } där reason är bad_date, no_rule_set, ambiguous_rule_set, unknown_category eller rate_missing.
   * Okänd sats ger aldrig en gissad sats.
   */
  function resolveRate(ruleSets, category, date) {
    if (!TAX_CATEGORIES.includes(category)) return { ok: false, reason: 'unknown_category', category };
    const sel = selectRuleSet(ruleSets, date);
    if (!sel.ok) return { ok: false, reason: sel.reason, category };
    const rs = sel.ruleSet;
    if (!Object.prototype.hasOwnProperty.call(rs.rates, category)) return { ok: false, reason: 'rate_missing', category, ruleSetRef: ref(rs) };
    return { ok: true, category, date, rateBp: rs.rates[category], ruleSetId: rs.id, version: rs.version, ruleSetRef: ref(rs), verification: rs.verification.status, sourceKind: rs.source.kind, roundingLevel: rs.roundingLevel };
  }

  const ref = rs => rs.id + '@' + rs.version;

  /** En faktura (och annat som är bindande) kräver en verifierad regel. */
  function assertVerified(resolved) {
    if (!resolved || !resolved.ok) throw new EconomyError('no_rule', 'ingen regel hittades' + (resolved && resolved.reason ? ': ' + resolved.reason : ''));
    if (resolved.verification !== 'verified') throw new EconomyError('unverified_rule', 'regeln ' + resolved.ruleSetRef + ' är inte verifierad mot en officiell källa och får inte användas för en faktura');
    return resolved;
  }

  /** Det som kopieras in på en rad när ett dokument godkänns. Oföränderligt, så en senare regeländring inte påverkar det. */
  function freezeRate(resolved) {
    if (!resolved || !resolved.ok) throw new EconomyError('no_rule', 'kan inte frysa en okänd sats');
    return Object.freeze({ category: resolved.category, date: resolved.date, rateBp: resolved.rateBp, ruleSetRef: resolved.ruleSetRef, verification: resolved.verification, sourceKind: resolved.sourceKind });
  }

  return { TAX_CATEGORIES, SOURCE_KINDS, ROUNDING_LEVELS, LEGACY_ID, createRuleSet, legacyUserSettingRuleSet, selectRuleSet, resolveRate, assertVerified, freezeRate };
});
