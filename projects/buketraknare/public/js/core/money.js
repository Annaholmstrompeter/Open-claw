/* Buketträknaren: pengar som exakta tal.
 *
 * Ny ekonomikod använder ALDRIG flyttal. Här finns två saker:
 *   Frac   ett exakt bråk av heltal (BigInt). Mellanräkningar sker alltid som Frac, så 186 ÷ 12 eller 100 ÷ 3 tappar inget.
 *   Money  ett belopp i hela ören (BigInt) och en valutakod. Det är det som sparas och visas.
 * Avrundning sker bara när koden uttryckligen ber om det (roundInt, roundToStep, Money.fromFrac), med ett namngivet läge:
 *   FLOOR    nedåt (mot minus oändlighet)
 *   CEIL     uppåt (mot plus oändlighet)
 *   HALF_UP  närmaste heltal, exakt hälften bort från noll
 * Procentsatser lagras som heltal i hundradels procent ("bp"): 25 % = 2500, 120 % = 12000.
 *
 * Valutans minsta enhet är alltid 1/100 här (SEK och EUR). Omräkning mellan valutor finns inte och byggs inte nu.
 *
 * Laddas som <script> i appen (window.BRMoney) och som modul i Node (tester och server).
 * En test kontrollerar att filen inte innehåller flyttalsanrop (Math., parseFloat, toFixed, Number(, decimaltal i kod).
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.BRMoney = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const ROUNDING = Object.freeze({ FLOOR: 'FLOOR', CEIL: 'CEIL', HALF_UP: 'HALF_UP' });
  const CURRENCY_RE = /^[A-Z]{3}$/;
  const MINOR_PER_MAJOR = 100n;
  const MAX_EXPONENT = 30;

  class EconomyError extends Error {
    constructor(code, message, details) {
      super(message || code);
      this.name = 'EconomyError';
      this.code = code;
      if (details !== undefined) this.details = details;
    }
  }

  // ---------- heltalshjälpare (BigInt) ----------
  function toBig(x, what) {
    if (typeof x === 'bigint') return x;
    if (typeof x === 'number') {
      if (!Number.isSafeInteger(x)) throw new EconomyError('not_integer', (what || 'värdet') + ' måste vara ett heltal, fick ' + String(x));
      return BigInt(x);
    }
    if (typeof x === 'string' && /^-?\d+$/.test(x)) return BigInt(x);
    throw new EconomyError('not_integer', (what || 'värdet') + ' måste vara ett heltal');
  }
  const babs = x => (x < 0n ? -x : x);
  function gcd(a, b) { a = babs(a); b = babs(b); while (b !== 0n) { const t = a % b; a = b; b = t; } return a; }
  /** Golvdivision för positiv nämnare (BigInt-divisionen trunkerar mot noll). */
  function floorDiv(a, b) { let q = a / b; if (a % b < 0n) q -= 1n; return q; }
  /** BigInt till vanligt heltal (för små värden som procentsatser). Går via text, aldrig via flyttal. */
  function toSafeInt(x) {
    const n = parseInt(x.toString(), 10);
    if (!Number.isSafeInteger(n)) throw new EconomyError('overflow', 'heltalet är för stort');
    return n;
  }

  // ---------- Frac: exakt bråk ----------
  class Frac {
    constructor(n, d) { this.n = n; this.d = d; Object.freeze(this); }
    static of(n, d) {
      n = toBig(n, 'täljare'); d = d === undefined ? 1n : toBig(d, 'nämnare');
      if (d === 0n) throw new EconomyError('division_by_zero', 'division med noll');
      if (d < 0n) { n = -n; d = -d; }
      const g = gcd(n, d);
      return new Frac(n / g, d / g);
    }
    static from(x) {
      if (x instanceof Frac) return x;
      if (x instanceof Money) return x.toFrac();
      return Frac.of(x);
    }
    static sum(list) { let s = Frac.of(0n); for (const x of list) s = s.add(Frac.from(x)); return s; }
    add(o) { o = Frac.from(o); return Frac.of(this.n * o.d + o.n * this.d, this.d * o.d); }
    sub(o) { o = Frac.from(o); return Frac.of(this.n * o.d - o.n * this.d, this.d * o.d); }
    mul(o) { o = Frac.from(o); return Frac.of(this.n * o.n, this.d * o.d); }
    div(o) { o = Frac.from(o); if (o.n === 0n) throw new EconomyError('division_by_zero', 'division med noll'); return Frac.of(this.n * o.d, this.d * o.n); }
    neg() { return new Frac(-this.n, this.d); }
    abs() { return new Frac(babs(this.n), this.d); }
    cmp(o) { o = Frac.from(o); const l = this.n * o.d, r = o.n * this.d; return l < r ? -1 : l > r ? 1 : 0; }
    eq(o) { return this.cmp(o) === 0; }
    lt(o) { return this.cmp(o) < 0; }
    lte(o) { return this.cmp(o) <= 0; }
    gt(o) { return this.cmp(o) > 0; }
    gte(o) { return this.cmp(o) >= 0; }
    isZero() { return this.n === 0n; }
    isNegative() { return this.n < 0n; }
    isInteger() { return this.d === 1n; }
    sign() { return this.n < 0n ? -1 : this.n > 0n ? 1 : 0; }
    floor() { return floorDiv(this.n, this.d); }
    ceil() { return -floorDiv(-this.n, this.d); }
    toString() { return this.d === 1n ? this.n.toString() : this.n + '/' + this.d; }
    toJSON() { return { n: this.n.toString(), d: this.d.toString() }; }
    static fromJSON(o) { return Frac.of(toBig(o.n, 'n'), toBig(o.d, 'd')); }
  }

  /** Avrundar ett bråk till heltal med ett namngivet läge. */
  function roundInt(frac, mode) {
    const f = Frac.from(frac);
    switch (mode) {
      case ROUNDING.FLOOR: return f.floor();
      case ROUNDING.CEIL: return f.ceil();
      case ROUNDING.HALF_UP: {
        // närmaste heltal, hälften bort från noll
        const a = f.abs();
        const r = floorDiv(2n * a.n + a.d, 2n * a.d);
        return f.n < 0n ? -r : r;
      }
      default: throw new EconomyError('unknown_rounding', 'okänt avrundningsläge: ' + String(mode));
    }
  }

  /** Avrundar till en multipel av steget (båda i samma enhet). Steget måste vara positivt. */
  function roundToStep(frac, step, mode) {
    const s = Frac.from(step);
    if (!s.gt(0n)) throw new EconomyError('bad_step', 'avrundningssteget måste vara större än noll');
    return Frac.from(roundInt(Frac.from(frac).div(s), mode)).mul(s);
  }

  // ---------- decimaltal i text ----------
  /** Tolkar "186", "186,50", "-0.5", "1 234,5", "1e3" som exakt bråk. Tal tolkas via sin text, aldrig via flyttalsaritmetik. */
  function parseDecimal(input) {
    let s = typeof input === 'number' ? String(input) : input;
    if (typeof s !== 'string') throw new EconomyError('bad_decimal', 'ett tal eller en text väntades');
    s = s.replace(/[\s ]/g, '');
    const m = /^([+-])?(\d*)(?:[.,](\d*))?(?:[eE]([+-]?\d+))?$/.exec(s);
    if (!m || (m[2] === '' && (m[3] === undefined || m[3] === ''))) throw new EconomyError('bad_decimal', 'inte ett tal: ' + JSON.stringify(input));
    const intPart = m[2] || '', frac = m[3] || '';
    let exp = m[4] === undefined ? 0 : parseInt(m[4], 10);
    if (!Number.isSafeInteger(exp) || exp > MAX_EXPONENT || exp < -MAX_EXPONENT) throw new EconomyError('bad_decimal', 'exponenten är för stor');
    let digits = BigInt(intPart + frac || '0');
    let scale = frac.length - exp;
    if (m[1] === '-') digits = -digits;
    return scale >= 0 ? Frac.of(digits, 10n ** BigInt(scale)) : Frac.of(digits * 10n ** BigInt(-scale));
  }

  // ---------- Money ----------
  function checkCurrency(c) {
    if (typeof c !== 'string' || !CURRENCY_RE.test(c)) throw new EconomyError('bad_currency', 'valutakod måste vara tre versaler, till exempel SEK');
    return c;
  }

  class Money {
    constructor(amount, currency) { this.amount = amount; this.currency = currency; Object.freeze(this); }
    /** `amount` är hela ören. */
    static of(amount, currency) { return new Money(toBig(amount, 'beloppet'), checkCurrency(currency === undefined ? 'SEK' : currency)); }
    static zero(currency) { return Money.of(0n, currency); }
    /** Kronor som text eller tal ("186,50"). Fler än två decimaler avvisas, de avrundas aldrig tyst. */
    static fromDecimal(v, currency) {
      const minor = parseDecimal(v).mul(MINOR_PER_MAJOR);
      if (!minor.isInteger()) throw new EconomyError('too_many_decimals', 'ett belopp får ha högst två decimaler: ' + JSON.stringify(v));
      return Money.of(minor.n, currency);
    }
    /** Ett bråk i ören avrundat till hela ören med ett uttalat läge. */
    static fromFrac(frac, mode, currency) { return Money.of(roundInt(frac, mode), currency); }
    static fromJSON(o) { return Money.of(toBig(o.amount, 'amount'), o.currency); }
    static sum(list, currency) { let s = Money.zero(currency); for (const x of list) s = s.add(x); return s; }
    same(o) { if (!(o instanceof Money)) throw new EconomyError('not_money', 'ett belopp väntades'); if (o.currency !== this.currency) throw new EconomyError('currency_mismatch', 'olika valutor: ' + this.currency + ' och ' + o.currency); }
    add(o) { this.same(o); return new Money(this.amount + o.amount, this.currency); }
    sub(o) { this.same(o); return new Money(this.amount - o.amount, this.currency); }
    neg() { return new Money(-this.amount, this.currency); }
    abs() { return new Money(babs(this.amount), this.currency); }
    cmp(o) { this.same(o); return this.amount < o.amount ? -1 : this.amount > o.amount ? 1 : 0; }
    eq(o) { return this.cmp(o) === 0; }
    lt(o) { return this.cmp(o) < 0; }
    lte(o) { return this.cmp(o) <= 0; }
    gt(o) { return this.cmp(o) > 0; }
    gte(o) { return this.cmp(o) >= 0; }
    isZero() { return this.amount === 0n; }
    isNegative() { return this.amount < 0n; }
    toFrac() { return Frac.of(this.amount); }
    toDecimalString() {
      const a = babs(this.amount), cents = a % MINOR_PER_MAJOR;
      return (this.amount < 0n ? '-' : '') + (a / MINOR_PER_MAJOR) + '.' + (cents < 10n ? '0' : '') + cents;
    }
    toString() { return this.toDecimalString() + ' ' + this.currency; }
    toJSON() { return { amount: this.amount.toString(), currency: this.currency }; }
  }

  // ---------- procentsatser (hundradels procent, "bp") ----------
  const Rate = {
    /** "25", "12,5", 25, 12.5 → 2500, 1250. Fler än två decimaler i procent avvisas. */
    fromPercent(v) {
      const bp = parseDecimal(v).mul(100n);
      if (!bp.isInteger()) throw new EconomyError('bad_rate', 'en procentsats får ha högst två decimaler: ' + JSON.stringify(v));
      if (bp.isNegative()) throw new EconomyError('bad_rate', 'en procentsats får inte vara negativ');
      return toSafeInt(bp.n);
    },
    /** Heltal bp som bråk: 2500 → 1/4. */
    toFrac(bp) { return Frac.of(toBig(bp, 'procentsats'), 10000n); },
    toPercentString(bp) {
      const b = toBig(bp, 'procentsats');
      const whole = b / 100n, rest = b % 100n;
      return rest === 0n ? String(whole) : whole + '.' + ((rest < 10n ? '0' : '') + rest).replace(/0$/, '');
    },
    check(bp, what) {
      if (!Number.isSafeInteger(bp) || bp < 0) throw new EconomyError('bad_rate', (what || 'procentsatsen') + ' måste vara ett heltal i hundradels procent, 0 eller mer');
      return bp;
    }
  };

  return { ROUNDING, EconomyError, Frac, Money, Rate, roundInt, roundToStep, parseDecimal, toSafeInt };
});
