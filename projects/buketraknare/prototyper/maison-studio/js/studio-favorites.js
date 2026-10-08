/* Maison Studio: favoriter per florist.
 *
 * Prototypen kan inte logga in, så favoriterna sparas lokalt i webbläsaren (localStorage), en lista per florist.
 * Om lagring är blockerad (privat läge, inbäddad sida) används minnet i stället och listan försvinner vid omladdning. Inget kraschar.
 *
 * I den riktiga appen hör listan till floristens konto och inte till butiken eller enheten. Då är detta samma gränssnitt, men
 * lagringen byts mot en lista på kontot som synkas mellan telefon och dator. En favorit pekar på artikeln (grossist och artikelnummer)
 * och aldrig på en kopia av priset: priser, enheter och förpackningar hämtas alltid ur prislistan. Se "Så sparas favoriter" i blomvalet. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api; else root.StudioFavorites = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const PREFIX = 'maison-studio.favoriter.v1.';
  const CURRENT = 'maison-studio.florist.v1';

  /** storage: något med getItem/setItem (localStorage) eller null. florists: [{ id, name, favorites: [artikel-id] }]. valid: Set med artikel-id som finns i prislistan. */
  function create(storage, florists, valid) {
    const mem = {};                                   // reserv när lagring saknas eller kastar fel
    let persisted = !!storage;
    const read = k => { if (storage) { try { const v = storage.getItem(k); if (v !== null) return v; } catch (e) { persisted = false; } } return Object.prototype.hasOwnProperty.call(mem, k) ? mem[k] : null; };
    const write = (k, v) => { mem[k] = v; if (storage) { try { storage.setItem(k, v); } catch (e) { persisted = false; } } };
    const known = id => !valid || valid.has(id);
    const byId = id => florists.find(f => f.id === id) || null;
    const seed = id => (byId(id) ? byId(id).favorites : []).filter(known);

    let current = (() => { const c = read(CURRENT); return byId(c) ? c : florists[0].id; })();
    const cache = {};                                 // florist-id → array av artikel-id i den ordning de lades till
    function load(id) {
      if (cache[id]) return cache[id];
      let list = null;
      const raw = read(PREFIX + id);
      if (raw !== null) { try { const j = JSON.parse(raw); if (j && j.v === 1 && Array.isArray(j.items)) list = j.items.filter(x => typeof x === 'string' && known(x)); } catch (e) { list = null; } }
      return (cache[id] = list || seed(id).slice());
    }
    const save = id => write(PREFIX + id, JSON.stringify({ v: 1, items: cache[id] }));

    return {
      florists: () => florists.map(f => ({ id: f.id, name: f.name })),
      current: () => current,
      currentName: () => byId(current).name,
      /** Byter florist. Varje florist har sin egen lista. */
      setCurrent(id) { if (!byId(id)) return false; current = id; write(CURRENT, id); return true; },
      list: () => load(current).slice(),
      has: id => load(current).includes(id),
      count: () => load(current).length,
      /** Lägger till eller tar bort. Ger true om artikeln nu är en favorit. */
      toggle(id) {
        if (!known(id)) return false;
        const l = load(current), i = l.indexOf(id);
        if (i >= 0) l.splice(i, 1); else l.push(id);
        save(current); return i < 0;
      },
      clear() { cache[current] = []; save(current); },
      /** Tillbaka till påhittade startlistan för den valda floristen. */
      reset() { cache[current] = seed(current).slice(); save(current); },
      isPersisted: () => persisted
    };
  }
  return { create, PREFIX, CURRENT };
});
