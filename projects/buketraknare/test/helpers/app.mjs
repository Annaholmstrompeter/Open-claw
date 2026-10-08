// Testhjälpare: laddar public/index.html i jsdom med fast klocka, egen lagring och falsk fetch.
// Testerna går bara via det floristen ser (knappar, texter) och via test-kroken window.buketraknare,
// aldrig via interna nycklar, så att samma tester gäller både före och efter en ändring av modellen.
import { JSDOM } from 'jsdom';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

process.env.TZ = 'Europe/Stockholm';

const PUBLIC = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'public');
const RAW = fs.readFileSync(path.join(PUBLIC, 'index.html'), 'utf8');
// lokala <script src="..."> läggs in i sidan, så att det fungerar likadant när skript flyttas till egna filer
const HTML = RAW.replace(/<script src="([^":]+)"><\/script>/g, (m, src) =>
  '<script>' + fs.readFileSync(path.join(PUBLIC, src), 'utf8') + '</script>'
);

export const NOW = '2026-10-07T10:00:00';
export const keyOf = s => String(s || '').normalize('NFC').trim().replace(/\s+/g, ' ').toLowerCase();
export const wait = (ms = 0) => new Promise(r => setTimeout(r, ms));

export const DEFAULT_SETTINGS = {
  mode: 'whole', markupPct: 50, hourly: 250, vatPct: 25, roundStep: 5,
  sizes: [
    { id: 'liten', name: 'Liten', stems: 9, minutes: 15, wrap: 15 },
    { id: 'medel', name: 'Medel', stems: 15, minutes: 25, wrap: 25 },
    { id: 'stor', name: 'Stor', stems: 25, minutes: 40, wrap: 40 }
  ],
  minOrder: 0, shipFee: 0, freeFrom: 0
};

/** En vara i prislistan: [namn, kategori, antal per förp, pris per förp, enhet, uppd] */
export function item([namn, kategori = 'Blommor', paket = 10, pris = 0, enhet = 'pack', uppd]) {
  const i = { namn, kategori, enhet, paket, pris, farg: '' };
  if (uppd) i.uppd = uppd;
  return i;
}

/** Bygger ett sparat tillstånd i det gamla formatet (v1), som en riktig användare kan ha i sin telefon. */
export function v1State({ items = [], buketter, hemma = {}, settings = {}, kalla = 'egen', recipes = [], datum = '2026-10-07', wholesaler } = {}) {
  const labels = {};
  items.forEach(i => { labels[keyOf(i.namn)] = i.namn; });
  const toKeys = o => Object.fromEntries(Object.entries(o).map(([n, q]) => { labels[keyOf(n)] = labels[keyOf(n)] || n; return [keyOf(n), q]; }));
  return {
    v: 1,
    priceList: { meta: { namn: kalla === 'tom' ? 'Ingen prislista än' : 'Min prislista', datum, kalla }, items },
    settings: { ...DEFAULT_SETTINGS, ...settings },
    labels,
    wholesaler: { namn: '', url: '', ai: 'chatgpt', mode: 'skarm', readCode: '', ...(wholesaler || {}) },
    order: {
      buketter: (buketter || [{ size: 'medel', qty: 1, items: {} }]).map((b, n) => ({ id: 'b' + (n + 1), size: b.size || 'medel', qty: b.qty || 1, items: toKeys(b.items || {}) })),
      hemma: toKeys(hemma), active: 'b1', seq: (buketter || [1]).length
    },
    recipes: recipes.map((r, n) => ({ id: 'r' + (n + 1), name: r.name, size: r.size || 'medel', items: toKeys(r.items) }))
  };
}

/**
 * Laddar appen. Alternativ:
 *  now      – fast klocka
 *  storage  – startvärden för localStorage ({nyckel: text}), t.ex. { 'buketraknare.v1': JSON.stringify(v1State(...)) }
 *  fetch    – falsk fetch(url, init); standard: ingen uppkoppling
 *  claude   – falsk window.claude (för "Claude i sidan")
 *  images   – true = falska createImageBitmap/canvas så att bilder kan förminskas
 *  failWrite – lagringsnyckel vars skrivning ska kasta QuotaExceededError
 */
export async function loadApp({ now = NOW, storage = {}, fetch, claude, images = false, failWrite } = {}) {
  const calls = { fetch: [], scroll: 0, clipboard: [] };
  const dom = new JSDOM(HTML, {
    url: 'https://buketraknare.test/',
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    beforeParse(window) {
      const RealDate = window.Date;
      const fixed = new RealDate(now).getTime();
      class FakeDate extends RealDate {
        constructor(...a) { if (a.length === 0) super(fixed); else super(...a); }
        static now() { return fixed; }
      }
      window.Date = FakeDate;
      for (const [k, v] of Object.entries(storage)) window.localStorage.setItem(k, v);
      if (failWrite) {           // simulerar full lagring (QuotaExceededError) för en viss nyckel
        const real = window.Storage.prototype.setItem;
        window.Storage.prototype.setItem = function (k, v) { if (k === failWrite) throw new window.DOMException('full', 'QuotaExceededError'); return real.call(this, k, v); };
      }
      window.fetch = async (url, init) => {
        calls.fetch.push({ url: String(url), init });
        if (!fetch) throw new Error('offline');
        return fetch(String(url), init);
      };
      window.HTMLElement.prototype.scrollIntoView = () => { calls.scroll++; };
      window.scrollTo = () => {};
      Object.defineProperty(window.navigator, 'clipboard', { configurable: true, value: { writeText: async t => { calls.clipboard.push(t); } } });
      if (claude) window.claude = claude;
      if (images) {
        window.createImageBitmap = async () => ({ width: 100, height: 50 });
        window.HTMLCanvasElement.prototype.getContext = () => ({ fillRect() {}, drawImage() {}, set fillStyle(v) {} });
        window.HTMLCanvasElement.prototype.toBlob = function (cb) { cb(new window.Blob([new Uint8Array([1, 2, 3, 4])], { type: 'image/jpeg' })); };
        if (!window.Blob.prototype.arrayBuffer) window.Blob.prototype.arrayBuffer = async function () { return new Uint8Array([1, 2, 3, 4]).buffer; };
      }
    }
  });
  const { window } = dom;
  const doc = window.document;
  const app = {
    window, doc, calls,
    hook: window.buketraknare,
    calc: () => window.buketraknare.calc(),
    $: s => doc.querySelector(s),
    $$: s => [...doc.querySelectorAll(s)],
    text: s => (doc.querySelector(s)?.textContent || '').replace(/\s+/g, ' ').trim(),
    storage: () => Object.fromEntries(Array.from({ length: window.localStorage.length }, (_, i) => { const k = window.localStorage.key(i); return [k, window.localStorage.getItem(k)]; })),
    close: () => window.close()
  };
  app.click = el => { if (typeof el === 'string') el = app.$(el); if (!el) throw new Error('hittar inte elementet att klicka på'); el.click(); };
  app.set = (el, value, type = 'change') => {
    if (typeof el === 'string') el = app.$(el);
    if (!el) throw new Error('hittar inte fältet');
    el.value = value;
    el.dispatchEvent(new window.Event(type, { bubbles: true }));
  };
  app.tab = name => app.click(`[data-tab="${name}"]`);
  app.tileText = name => (app.tile(name)?.textContent || '').replace(/\s+/g, ' ').trim();
  app.tile = name => app.$$('#tiles .tile').find(t => t.querySelector('.tile-name')?.textContent === name);
  app.add = (name, n = 1) => { for (let i = 0; i < n; i++) { const t = app.tile(name); if (!t) throw new Error('ingen knapp för ' + name); app.click(t.querySelector('.tile-main')); } };
  app.dec = name => app.click(app.tile(name).querySelector('.minus'));
  app.count = name => Number(app.tile(name)?.querySelector('.count')?.textContent || 0);
  app.settle = async (n = 4) => { for (let i = 0; i < n; i++) await wait(0); };
  await app.settle();
  return app;
}

/** Hittar köpraden för en vara i resultatet från calc(), oberoende av hur nyckeln ser ut. */
export const buyOf = (C, namn) => Object.values(C.buy).find(b => b.it.namn === namn);
export const rowOf = (C, i = 0) => C.rows[i];
