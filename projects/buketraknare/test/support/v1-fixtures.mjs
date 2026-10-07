// Gemensamma tillstånd i det gamla formatet (v1) som både migreringstesterna och differenstestet använder.
import { v1State, item } from '../helpers/app.mjs';

// ---------- fixturer: tillstånd som riktiga användare kan ha i sin telefon ----------

export const COMMON = ['Röd ros', 'Rosa ros', 'Vit ros', 'Gul ros', 'Tulpan', 'Nejlika', 'Solros', 'Alstroemeria', 'Lisianthus', 'Gerbera',
  'Krysantemum', 'Lilja', 'Freesia', 'Hortensia', 'Ranunkel', 'Iris', 'Pion', 'Eukalyptus', 'Slöjflor', 'Ruscus'];

export function fixtures() {
  const out = {};
  out['tom start'] = v1State({ items: COMMON.map(n => item([n, n.match(/Eukal|Slöj|Ruscus/) ? 'Grönt' : 'Blommor', 1, 0, ''])), kalla: 'tom' });
  out['egen lista med order, hemma och recept'] = v1State({
    items: [
      item(['Röd ros', 'Blommor', 10, 120, 'pack', '2026-10-07']),
      item(['Rosa ros', 'Blommor', 10, 105.5, 'pack', '2026-09-20']),
      item(['Tulpan', 'Blommor', 10, 55, 'bunt']),               // pris men ingen uppdateringsdag
      item(['Nejlika', 'Blommor', 20, 0, 'bunt', '2026-10-01']), // dag men inget pris (tömt pris)
      item(['Pion', 'Blommor', 5, 0, '']),                        // helt utan pris
      item(['Eukalyptus', 'Grönt', 10, 65, 'bunt', '2026-10-07'])
    ],
    buketter: [
      { size: 'liten', qty: 1, items: { 'Röd ros': 3, 'Eukalyptus': 2 } },
      { size: 'stor', qty: 3, items: { 'Rosa ros': 12, 'Tulpan': 6, 'Pelargon': 2 } } // Pelargon finns inte i listan
    ],
    hemma: { 'Röd ros': 4, 'Pelargon': 1 },
    recipes: [{ name: 'Vår', size: 'liten', items: { 'Tulpan': 5, 'Dahlia': 1 } }, { name: 'Ros', items: { 'Röd ros': 12 } }],
    settings: { markupPct: 60, hourly: 300, vatPct: 12, roundStep: 10, mode: 'used', shipFee: 79, freeFrom: 600, minOrder: 300 },
    wholesaler: { namn: 'Min grossist', url: 'https://grossist.example', ai: 'claude', mode: 'agent', readCode: 'hemlig' },
    kalla: 'uppdaterad'
  });
  out['svåra namn'] = v1State({
    items: ['Röd ros 60 cm', 'Åäö-blomma', 'Blomma "citat"', "Apostrof's", '<script>alert(1)</script>', 'Ännu en  blomma', 'Emoji 🌹', 'ÉCLAT', 'a/b\\c'].map(n => item([n, 'Övrigt', 10, 10, 'bunt', '2026-10-01'])),
    buketter: [{ items: { 'Röd ros 60 cm': 2, 'Åäö-blomma': 3, 'Blomma "citat"': 1, '<script>alert(1)</script>': 4, 'Emoji 🌹': 5 } }]
  });
  out['dubbletter av samma namn'] = v1State({
    items: [item(['Rosa ros', 'Blommor', 10, 100, 'pack', '2026-10-01']), item(['rosa  ros', 'Blommor', 20, 150, 'bunt', '2026-10-02'])],
    buketter: [{ items: { 'Rosa ros': 4 } }]
  });
  out['stor lista'] = v1State({
    items: Array.from({ length: 250 }, (_, i) => item([`Blomma ${i}`, i % 2 ? 'Blommor' : 'Grönt', (i % 5) + 1, i % 7 ? 10 + i : 0, 'bunt', i % 3 ? '2026-10-0' + ((i % 7) + 1) : undefined])),
    buketter: [{ items: { 'Blomma 3': 3, 'Blomma 249': 2 } }]
  });
  return out;
}

function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

const POOL = ['Röd ros', 'rosa  ros', 'Rosa ros', 'Åäö', 'Blomma "x"', '<b>fet</b>', 'a', 'A', 'ÉCLAT', 'éclat', '🌹', 'Tulpan  ', ' Tulpan', 'ros/ros', '\\', 'x'.repeat(60), 'Ett långt namn med många ord och siffror 123 456'];
const DAYS = [undefined, '2026-10-07', '2026-09-30', '2025-12-24'];

/** Ett slumpat men återskapningsbart v1-tillstånd (samma n ger alltid samma tillstånd). */
export function randomV1State(n) {
  const pool = POOL, days = DAYS;
  const r = rng(n + 1);
  const pick = a => a[Math.floor(r() * a.length)];
  const items = Array.from({ length: Math.floor(r() * 12) }, () => item([pick(pool), pick(['Blommor', 'Grönt', 'Övrigt', '']), Math.floor(r() * 25) + 1, pick([0, 0, 12.5, 99, 120, 1234.56]), pick(['pack', 'bunt', 'styck', '']), pick(days)]));
  const names = [...items.map(i => i.namn), 'Okänd vara', 'Dahlia'];
  const mk = () => Object.fromEntries(Array.from({ length: Math.floor(r() * 5) }, () => [pick(names), Math.floor(r() * 9) + 1]));
  const v1 = v1State({
    items, buketter: Array.from({ length: Math.floor(r() * 3) + 1 }, () => ({ size: pick(['liten', 'medel', 'stor']), qty: Math.floor(r() * 4) + 1, items: mk() })),
    hemma: mk(), recipes: Array.from({ length: Math.floor(r() * 3) }, (_, i) => ({ name: 'R' + i, items: mk() })), kalla: pick(['tom', 'egen', 'import', 'uppdaterad', 'exempel']),
    settings: { mode: pick(['whole', 'used']), roundStep: pick([1, 5, 10]), markupPct: pick([0, 50, 80]), hourly: pick([0, 250]), vatPct: pick([0, 12, 25]), shipFee: pick([0, 0, 59]), freeFrom: pick([0, 300]), minOrder: pick([0, 0, 200]) }
  });
  return v1;
}

/** Ett slumpat tillstånd där allt i ordern finns i listan och har pris, så att priser och paket räknas på riktigt. */
export function randomCleanV1State(n) {
  const r = rng(n * 7919 + 13);
  const pick = a => a[Math.floor(r() * a.length)];
  const names = ['Röd ros', 'Rosa ros', 'Tulpan', 'Nejlika', 'Gerbera', 'Eukalyptus', 'Gipsört', 'Lisianthus'];
  const items = names.slice(0, 3 + Math.floor(r() * 6)).map(nm => item([nm, 'Blommor', pick([1, 5, 10, 10, 20]), pick([35, 55, 70, 105, 120, 129.5]), pick(['pack', 'bunt']), pick(['2026-10-07', '2026-10-07', '2026-10-05', '2026-09-20'])]));
  const mk = (max) => Object.fromEntries(Array.from({ length: 1 + Math.floor(r() * max) }, () => [pick(items).namn, Math.floor(r() * 12) + 1]));
  return v1State({
    items, kalla: 'egen',
    buketter: Array.from({ length: Math.floor(r() * 3) + 1 }, () => ({ size: pick(['liten', 'medel', 'stor']), qty: Math.floor(r() * 3) + 1, items: mk(4) })),
    hemma: r() < 0.4 ? mk(2) : {},
    settings: { mode: pick(['whole', 'used']), roundStep: pick([1, 5, 10]), markupPct: pick([0, 50, 80]), hourly: pick([0, 250, 400]), vatPct: pick([0, 12, 25]), shipFee: pick([0, 59, 99]), freeFrom: pick([0, 250, 600]), minOrder: pick([0, 0, 300]) }
  });
}
