// Testhjälpare: ett flyttal som exakt bråk. Ett flyttal är alltid ett exakt tal (heltal gånger en tvåpotens), så det går att
// föra över till den exakta motorn utan att något avrundas. Används bara för att mata den nya motorn med de mellanvärden
// som den gamla, flyttalsbaserade motorn räknat fram. Ligger i test/, inte i produktionskoden, eftersom produktionskoden inte får röra flyttal.
import M from '../../public/js/core/money.js';

export function fracFromFloat(x) {
  if (typeof x !== 'number' || !Number.isFinite(x)) throw new Error('inte ett ändligt tal: ' + x);
  if (x === 0) return M.Frac.of(0n);
  const dv = new DataView(new ArrayBuffer(8));
  dv.setFloat64(0, x);
  const bits = dv.getBigUint64(0);
  const sign = bits >> 63n ? -1n : 1n;
  const exp = Number((bits >> 52n) & 0x7ffn);
  const mant = bits & ((1n << 52n) - 1n);
  const m = exp === 0 ? mant : mant | (1n << 52n);
  const e = exp === 0 ? -1074 : exp - 1075;
  return e >= 0 ? M.Frac.of(sign * m * (1n << BigInt(e))) : M.Frac.of(sign * m, 1n << BigInt(-e));
}

/** Bråk till flyttal, bara för att jämföra mot den gamla motorn i tester. */
export function floatFromFrac(f) { return Number(f.n) / Number(f.d); }
