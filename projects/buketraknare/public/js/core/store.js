/* Buketträknaren: lagringsgränssnitt för arbetsytan (workspace.js).
 *
 * Arbetsytan är enkel JSON och vet inget om var den sparas. Det här är gränssnittet mellan den och en lagringsplats:
 *   adapter    { read() → { ok, data|null }, write(data, { expectedRev }) → { ok } | { ok: false, reason } }   (båda asynkrona)
 *   store      öppnar, ändrar och sparar arbetsytan: open(), update(fn), state()
 * Lokalt i telefonen (nu) är adaptern localStorage. På en server (senare, MVP 2) blir det en databas, och resten ändras inte.
 *
 * Regler som store tillämpar:
 *   - Ett ändringsförsök (update) körs på en kopia. Blir resultatet ogiltigt, eller kastar ändringen, sparas ingenting och
 *     den sparade arbetsytan är oförändrad.
 *   - Trasig eller ogiltig lagring skrivs aldrig över tyst. open() ger ett fel och lämnar originalet orört.
 *   - Går det inte att skriva (full lagring) fortsätter appen att fungera i minnet och får veta det (saved: false).
 *   - Två flikar eller enheter som ändrar samma arbetsyta upptäcks med rev. Den som kommer sist får 'conflict', ingen tyst överskrivning.
 *   - Nyckeln är egen (buketraknare.workspace.v1). Den gamla appens lagring (buketraknare.v1 och v2) rörs aldrig.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.BRStore = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const DEFAULT_KEY = 'buketraknare.workspace.v1';
  const clone = o => JSON.parse(JSON.stringify(o));

  /** Lagring i minnet. Används i tester och som reserv när ingen annan lagring finns. */
  function createMemoryAdapter(initial) {
    let stored = initial === undefined ? null : JSON.stringify(initial);
    return {
      async read() { return { ok: true, data: stored === null ? null : JSON.parse(stored), raw: stored }; },
      async write(data, opts) {
        const cur = stored === null ? null : JSON.parse(stored);
        if (opts && opts.expectedRev !== undefined && cur && cur.rev !== opts.expectedRev) return { ok: false, reason: 'conflict', currentRev: cur.rev };
        stored = JSON.stringify(data);
        return { ok: true };
      },
      raw: () => stored
    };
  }

  /** Lagring i localStorage (eller något med samma getItem/setItem). Kastar aldrig: fel blir { ok: false }. */
  function createLocalStorageAdapter(storage, key) {
    const k = key || DEFAULT_KEY;
    const readRaw = () => { try { return { ok: true, raw: storage.getItem(k) }; } catch (e) { return { ok: false, reason: 'unavailable', error: String(e && e.message || e) }; } };
    return {
      async read() {
        const r = readRaw();
        if (!r.ok) return r;
        if (r.raw === null || r.raw === undefined) return { ok: true, data: null, raw: null };
        try { return { ok: true, data: JSON.parse(r.raw), raw: r.raw }; } catch (e) { return { ok: false, reason: 'corrupt', raw: r.raw }; }
      },
      async write(data, opts) {
        const cur = readRaw();
        if (cur.ok && cur.raw && opts && opts.expectedRev !== undefined) {
          let parsed = null; try { parsed = JSON.parse(cur.raw); } catch (e) { parsed = null; }
          if (parsed && parsed.rev !== opts.expectedRev) return { ok: false, reason: 'conflict', currentRev: parsed.rev };
        }
        try { storage.setItem(k, JSON.stringify(data)); return { ok: true }; } catch (e) { return { ok: false, reason: 'write_failed', error: String(e && e.message || e) }; }
      }
    };
  }

  /**
   * Arbetsytans lagring. W är workspace.js (BRWorkspace), ctx är { now, newId }.
   * open() ger { ok: true, state, created } eller { ok: false, reason: 'corrupt' | 'invalid' | 'unavailable', problems?, raw? }.
   * update(fn) kör fn(draft, ctx) på en kopia och ger { ok, saved, state } eller { ok: false, reason: 'invalid' | 'error' | 'conflict' | 'not_open', ... }.
   */
  function createWorkspaceStore(adapter, W, ctx, opts) {
    const o = opts || {};
    let current = null, storedRev, queue = Promise.resolve();      // storedRev: den rev som senast är känd i lagringen (kan släpa efter om skrivning misslyckats)

    async function open() {
      const r = await adapter.read();
      if (!r.ok) return { ok: false, reason: r.reason, raw: r.raw === undefined ? null : r.raw, error: r.error };
      if (r.data === null) {
        const fresh = W.createWorkspace(ctx, o.create);
        const w = await adapter.write(fresh, { expectedRev: undefined });
        current = fresh; storedRev = w.ok ? fresh.rev : undefined;
        return { ok: true, created: true, state: clone(current), saved: w.ok };
      }
      const problems = W.validateWorkspace(r.data);
      if (problems.length) return { ok: false, reason: 'invalid', problems, raw: r.raw };
      current = r.data; storedRev = r.data.rev;
      return { ok: true, created: false, state: clone(current), saved: true };
    }

    function update(fn) {
      const run = async () => {
        if (!current) return { ok: false, reason: 'not_open' };
        const draft = clone(current);
        let out;
        try { out = fn(draft, ctx); } catch (e) { return { ok: false, reason: 'error', error: e, problems: e && e.problems }; }
        draft.rev = current.rev + 1;
        draft.shop.updatedAt = ctx.now();
        const problems = W.validateWorkspace(draft);
        if (problems.length) return { ok: false, reason: 'invalid', problems };
        const frozen = typeof W.checkImmutability === 'function' ? W.checkImmutability(current, draft) : [];     // en skickad offert och en kundorder ändras aldrig
        if (frozen.length) return { ok: false, reason: 'immutable', problems: frozen };
        const w = await adapter.write(draft, { expectedRev: storedRev });
        if (!w.ok && w.reason === 'conflict') return { ok: false, reason: 'conflict', currentRev: w.currentRev, state: clone(current) };
        // full lagring: arbetet finns kvar i minnet och användaren får veta att det inte sparades
        current = draft; if (w.ok) storedRev = draft.rev;
        return { ok: true, saved: w.ok, writeError: w.ok ? undefined : w.reason, result: out, state: clone(current) };
      };
      const p = queue.then(run, run);
      queue = p.catch(() => {});
      return p;
    }

    /** Läser om från lagringen (till exempel efter en konflikt). */
    async function reload() {
      const r = await adapter.read();
      if (!r.ok || r.data === null) return { ok: false, reason: r.reason || 'empty' };
      const problems = W.validateWorkspace(r.data);
      if (problems.length) return { ok: false, reason: 'invalid', problems };
      current = r.data; storedRev = r.data.rev;
      return { ok: true, state: clone(current) };
    }

    return { open, update, reload, state: () => (current ? clone(current) : null) };
  }

  return { DEFAULT_KEY, createMemoryAdapter, createLocalStorageAdapter, createWorkspaceStore };
});
