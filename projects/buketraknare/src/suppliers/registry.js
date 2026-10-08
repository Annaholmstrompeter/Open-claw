// Här registreras alla grossister. Att lägga till en ny grossist = en mapp under src/suppliers/<id>/ och en rad här.
// Resten av appen (räknemotor, skärmar, matchning, prisuppdatering) behöver inte ändras.
import { assertConnector } from './contract.js';

export function createRegistry(connectors = []) {
  const map = new Map();
  const api = {
    register(connector) {
      assertConnector(connector);
      if (map.has(connector.id)) throw new Error('grossisten finns redan: ' + connector.id);
      map.set(connector.id, connector);
      return api;
    },
    get(id) {
      const c = map.get(id);
      if (!c) throw new Error('okänd grossist: ' + id);
      return c;
    },
    has: id => map.has(id),
    /** Det appen visar i "Vilken grossist handlar du av?". Inga hemligheter, ingen intern teknik. */
    list: () => [...map.values()].map(c => ({ id: c.id, displayName: c.displayName, authKinds: [...c.capabilities.authKinds] }))
  };
  connectors.forEach(c => api.register(c));
  return api;
}

// Pilotgrossisten läggs till här när den är vald och undersökt:
//   import { createLambes } from './lambes/connector.js';
//   export const registry = createRegistry([createLambes({ http })]);
export const registry = createRegistry([]);
