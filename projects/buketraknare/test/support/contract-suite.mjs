// Kontraktssviten: samma tester för varje grossistadapter. En ny grossist är klar när den klarar den här sviten.
import test from 'node:test';
import assert from 'node:assert/strict';
import M from '../../public/js/core/model.js';
import { assertConnector, ConnectorError, ERROR_CODES } from '../../src/suppliers/contract.js';
import { v1State, item } from '../helpers/app.mjs';

/**
 * @param {object} cfg
 *   label    namn i testutskriften
 *   make()   -> { connector, backend, rejected }   (en ny, ren instans per test)
 *   connect  { ... }  indata som ger en lyckad anslutning       bad  { ... } indata som ska avvisas
 *   ids      id:n som finns hos grossisten     unknown  ett id som inte finns
 *   query    en sökning som träffar          queryHits antal träffar
 */
export function defineContractTests(cfg) {
  const t = (name, fn) => test(`[kontrakt: ${cfg.label}] ${name}`, fn);
  const connected = async s => ({ credentials: (await s.connector.completeConnect(cfg.connect)).credentials });
  const code = async p => { try { await p; } catch (e) { return e; } return null; };

  t('adaptern uppfyller gränssnittet', () => {
    const { connector } = cfg.make();
    assertConnector(connector);
  });

  t('anslutning: rätt uppgifter ger en anslutning, fel uppgifter avvisas utan att något sparas', async () => {
    const s = cfg.make();
    const start = await s.connector.startConnect({});
    assert.ok(['redirect', 'liveView', 'feedUrlForm'].includes(start.kind), 'startConnect: ' + start.kind);
    const done = await s.connector.completeConnect(cfg.connect);
    assert.ok(s.connector.capabilities.authKinds.includes(done.authKind));
    assert.ok(done.credentials && typeof done.credentials === 'object');
    const err = await code(s.connector.completeConnect(cfg.bad));
    assert.ok(err instanceof ConnectorError, 'fel uppgifter ger ConnectorError');
    assert.equal(err.code, 'AUTH_EXPIRED');
  });

  t('status: ansluten, behöver ny inloggning, otillgänglig och bortkopplad', async () => {
    const s = cfg.make();
    const conn = await connected(s);
    assert.equal((await s.connector.status(conn)).status, 'connected');
    s.backend.ctl.expired = true;
    assert.equal((await s.connector.status(conn)).status, 'needsReauth');
    s.backend.ctl.expired = false; s.backend.ctl.down = true;
    assert.equal((await s.connector.status(conn)).status, 'degraded');
    assert.equal((await s.connector.status(null)).status, 'disconnected');
    await s.connector.disconnect(conn);
  });

  t('sökning: träffar, sidor och tom sökning, alltid i gemensamt format', async () => {
    const s = cfg.make();
    const conn = await connected(s);
    const hit = await s.connector.searchProducts(conn, cfg.query, { limit: 10 });
    assert.equal(hit.items.length, cfg.queryHits);
    hit.items.forEach(p => M.normalizeSupplierProduct(p));
    const all = await s.connector.searchProducts(conn, '', { limit: 1 });
    assert.equal(all.items.length, 1);
    assert.ok(all.nextCursor, 'det finns fler sidor');
    const next = await s.connector.searchProducts(conn, '', { limit: 1, cursor: all.nextCursor });
    assert.notEqual(next.items[0].supplierProductId, all.items[0].supplierProductId);
    const none = await s.connector.searchProducts(conn, 'finns-inte-alls-xyz', {});
    assert.deepEqual(none.items, []);
    assert.equal(none.nextCursor, null);
  });

  t('getProducts: ger det som efterfrågas och utelämnar okända id:n', async () => {
    const s = cfg.make();
    const conn = await connected(s);
    const got = await s.connector.getProducts(conn, [...cfg.ids, cfg.unknown]);
    assert.deepEqual(got.map(p => p.supplierProductId).sort(), [...cfg.ids].sort());
    got.forEach(p => { const n = M.normalizeSupplierProduct(p); assert.ok(n.stemsPerPack >= 1); assert.ok(n.name); });
  });

  t('getPrices: bara de efterfrågade, giltiga, med uttrycklig valuta, moms, tid och källa', async () => {
    const s = cfg.make();
    const conn = await connected(s);
    const quotes = await s.connector.getPrices(conn, [...cfg.ids, cfg.unknown], { deliveryDate: '2026-10-08' });
    assert.deepEqual(quotes.map(q => q.supplierProductId).sort(), [...cfg.ids].sort(), 'okända id:n utelämnas');
    for (const q of quotes) {
      const n = M.normalizeQuote(q);
      assert.ok(n.packPrice === null || n.packPrice > 0, 'aldrig 0 kr');
      assert.match(n.currency, /^[A-Z]{3}$/);
      assert.equal(typeof q.priceIncludesVat, 'boolean', 'moms anges uttryckligt, aldrig gissat');
      assert.ok(s.connector.capabilities.strategies.includes(n.strategy), 'källan är en deklarerad strategi');
      assert.ok(Date.parse(n.fetchedAt) <= Date.now() + 60000, 'hämtad inte i framtiden');
    }
  });

  t('felen är begripliga: utgången inloggning, spärr, driftstopp och ändrad sida', async () => {
    const s = cfg.make();
    const conn = await connected(s);
    const ids = cfg.ids;
    s.backend.ctl.expired = true;
    assert.equal((await code(s.connector.getPrices(conn, ids))).code, 'AUTH_EXPIRED');
    s.backend.ctl.expired = false; s.backend.ctl.limitedSeconds = 30;
    const rl = await code(s.connector.getPrices(conn, ids));
    assert.equal(rl.code, 'RATE_LIMITED');
    assert.equal(rl.retryAfterMs, 30000, 'väntetiden följer med');
    s.backend.ctl.limitedSeconds = null; s.backend.ctl.down = true;
    assert.equal((await code(s.connector.getPrices(conn, ids))).code, 'UNAVAILABLE');
    s.backend.ctl.down = false; s.backend.ctl.garbled = true;
    assert.equal((await code(s.connector.getPrices(conn, ids))).code, 'SITE_CHANGED');
    s.backend.ctl.garbled = false;
    const ok = await s.connector.getPrices(conn, ids);
    assert.equal(ok.length, ids.length, 'fungerar igen när felet är borta');
    for (const e of [await code(s.connector.getPrices(conn, ids))]) assert.equal(e, null);
    assert.ok(ERROR_CODES.length >= 8);
  });

  t('endast läsande anrop, bara mot grossistens domäner', async () => {
    const s = cfg.make();
    const conn = await connected(s);
    await s.connector.searchProducts(conn, cfg.query, {});
    await s.connector.getProducts(conn, cfg.ids);
    await s.connector.getPrices(conn, cfg.ids);
    await s.connector.status(conn);
    assert.ok(s.backend.requests.length > 0);
    assert.ok(s.backend.requests.every(r => r.method === 'GET'), 'allt är GET');
    assert.deepEqual(s.rejected, [], 'inget anrop nekades av domänskyddet');
    assert.deepEqual(Object.keys(s.http).sort(), ['getJson', 'getText'], 'hjälparen har inga skrivande metoder');
  });

  t('det adaptern levererar tas emot av modellen utan ändringar någon annanstans', async () => {
    const s = cfg.make();
    const conn = await connected(s);
    const page = await s.connector.searchProducts(conn, '', { limit: 50 });
    const quotes = await s.connector.getPrices(conn, page.items.map(p => p.supplierProductId));
    const st = M.migrateV1toV2(v1State({ items: [item(['Röd ros', 'Blommor', 10, 120, 'pack', '2026-10-01'])] }));
    M.upsertConnection(st, { id: 'conn_x', supplierId: s.connector.id, authKind: s.connector.capabilities.authKinds[0], status: 'connected' });
    M.ingestSupplierData(st, 'conn_x', { products: page.items, quotes }, { today: '2026-10-07', now: '2026-10-07T07:00:00.000Z', complete: true });
    assert.equal(st.supplierProducts.filter(p => p.connectionId === 'conn_x').length, page.items.length);
    assert.equal(st.quotes.filter(q => q.connectionId === 'conn_x').length, quotes.length);
  });
}
