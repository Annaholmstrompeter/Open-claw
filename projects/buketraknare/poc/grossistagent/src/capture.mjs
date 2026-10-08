// Fångar de JSON-svar som sidan själv hämtar (strukturerad data först), och beskriver dem kort för agenten.
// Bara svarens innehåll sparas (i minnet). Aldrig anropets rubriker, cookies eller kropp (bara kroppens nyckelnamn).
import { safePath } from './guard.mjs';

const MAX_DEPTH = 5, MAX_KEYS = 40;

/** Kompakt form av ett JSON-värde: nycklar och typer, aldrig värden. */
export function shapeOf(v, depth = 0) {
  if (v === null) return 'null';
  if (Array.isArray(v)) return depth >= MAX_DEPTH ? ['…'] : v.length ? [shapeOf(v[0], depth + 1), '×' + v.length] : ['tom'];
  if (typeof v === 'object') {
    if (depth >= MAX_DEPTH) return '{…}';
    const out = {}; const keys = Object.keys(v);
    for (const k of keys.slice(0, MAX_KEYS)) out[k] = shapeOf(v[k], depth + 1);
    if (keys.length > MAX_KEYS) out['…'] = '+' + (keys.length - MAX_KEYS) + ' nycklar';
    return out;
  }
  return typeof v;
}

/** Hämtar ett värde med sökväg som "resultat.artiklar[0].pris.belopp". Ger undefined om det saknas. Ingen kod körs. */
export function getPath(obj, path) {
  if (path === '' || path === undefined || path === null) return obj;
  const parts = String(path).split('.').flatMap(seg => { if (seg === '') return [null]; const m = seg.match(/^([^\[\]]*)((?:\[\d+\])*)$/); if (!m) return [null]; const out = m[1] === '' ? [] : [m[1]]; for (const i of m[2].matchAll(/\[(\d+)\]/g)) out.push(Number(i[1])); return out; });
  let cur = obj;
  for (const p of parts) {
    if (p === null || cur === null || cur === undefined) return undefined;
    if (typeof p === 'number') { if (!Array.isArray(cur)) return undefined; cur = cur[p]; }
    else { if (typeof cur !== 'object' || Array.isArray(cur) || !Object.prototype.hasOwnProperty.call(cur, p)) return undefined; cur = cur[p]; }
  }
  return cur;
}

export function createCapture(opts = {}) {
  const max = opts.maxResponses || 30, maxBytes = opts.maxBytes || 1_500_000;
  let seq = 0, pending = 0; const list = [];
  const now = opts.now || (() => new Date().toISOString());

  function attach(page) {
    page.on('response', async res => {
      pending++;
      try {
        const req = res.request(), type = req.resourceType();
        if (type !== 'xhr' && type !== 'fetch') return;
        if (!/json/i.test(res.headers()['content-type'] || '')) return;
        if (res.status() < 200 || res.status() >= 300) return;
        const text = await res.text();
        if (text.length > maxBytes) return;
        const json = JSON.parse(text);
        const u = new URL(req.url());
        let requestShape = null;
        try { const pd = req.postData(); if (pd) { const pj = JSON.parse(pd); requestShape = Object.keys(pj && typeof pj === 'object' ? pj : {}).slice(0, 12); } } catch (e) { /* ingen JSON-kropp */ }
        const id = 'j' + (++seq);
        list.push({ id, at: now(), method: req.method(), host: u.hostname, path: safePath(u), status: res.status(), bytes: text.length, shape: shapeOf(json), requestKeys: requestShape, json });
        if (list.length > max) list.shift();
      } catch (e) { /* svar som inte går att läsa (omdirigering, avbruten) är inte intressanta */ }
      finally { pending--; }
    });
  }

  const brief = e => ({ id: e.id, method: e.method, host: e.host, path: e.path, status: e.status, bytes: e.bytes, requestKeys: e.requestKeys, shape: e.shape });
  return {
    attach,
    /** Väntar tills alla svar som just kommit har lästs (högst 2 s). */
    async whenIdle() { const t0 = Date.now(); while (pending > 0 && Date.now() - t0 < 2000) await new Promise(r => setTimeout(r, 25)); },
    list: () => list.map(brief),
    get: id => list.find(e => e.id === id) || null,
    latest: () => list[list.length - 1] || null,
    clear: () => { list.length = 0; },
    /** Sanerad strukturbild: bara adressmönster och nyckelnamn. Inga värden. */
    structure: () => list.map(e => ({ method: e.method, host: e.host, path: e.path, status: e.status, requestKeys: e.requestKeys, shape: e.shape }))
  };
}
