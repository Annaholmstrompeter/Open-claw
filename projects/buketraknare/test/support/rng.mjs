// Återskapningsbar slumpgenerator för egenskapstester (samma frö ger alltid samma följd).
export function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
export const pickOf = r => a => a[Math.floor(r() * a.length)];
export const intIn = r => (lo, hi) => lo + Math.floor(r() * (hi - lo + 1));
