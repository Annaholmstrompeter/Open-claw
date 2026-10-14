// A small stand-in for Supabase Realtime, for testing TOGETHER without the internet.
// It speaks the Phoenix channel protocol that @supabase/realtime-js (vsn 2.0.0) uses: JSON arrays
// [join_ref, ref, topic, event, payload], binary "user broadcast" frames, presence_state / presence_diff.
// It follows the client's own serializer (node_modules/@supabase/realtime-js/dist/main/lib/serializer.js);
// it is NOT the real service, so a green run here does not prove the real Supabase accepts everything.
import { WebSocketServer } from 'ws';

export function startMock({ latency = [0, 0], log = false } = {}) {
  const wss = new WebSocketServer({ host: '127.0.0.1', port: 0 });
  const topics = new Map();   // topic -> Set(sock)
  const presence = new Map(); // topic -> Map(key -> meta)
  const stats = { connections: 0, broadcasts: 0, joins: 0, tracks: 0 };
  let refCounter = 1;
  const enc = new TextEncoder(), dec = new TextDecoder();

  const wait = () => latency[1] ? latency[0] + Math.random() * (latency[1] - latency[0]) : 0;
  const later = (fn) => { const d = wait(); if (d) setTimeout(fn, d); else fn(); };
  const sendJson = (sock, arr) => later(() => { if (sock.ws.readyState === 1) sock.ws.send(JSON.stringify(arr)); });
  const sendBin = (sock, buf) => later(() => { if (sock.ws.readyState === 1) sock.ws.send(buf, { binary: true }); });

  function presenceState(topic) {
    const st = {};
    for (const [k, m] of (presence.get(topic) || new Map())) st[k] = { metas: [m] };
    return st;
  }
  function diff(topic, joins, leaves) {
    for (const s of topics.get(topic) || []) {
      if (s.presenceOn.has(topic)) sendJson(s, [null, null, topic, 'presence_diff', { joins, leaves }]);
    }
  }
  function leave(sock, topic) {
    const room = topics.get(topic);
    if (room) room.delete(sock);
    const pres = presence.get(topic);
    const key = sock.keys.get(topic);
    if (pres && key !== undefined && pres.has(key)) {
      const old = pres.get(key);
      pres.delete(key);
      diff(topic, {}, { [key]: { metas: [old] } });
    }
    sock.keys.delete(topic);
    sock.presenceOn.delete(topic);
  }

  function binBroadcast(topic, event, payloadBytes, encoding) {
    const t = enc.encode(topic), e = enc.encode(event);
    const out = new Uint8Array(5 + t.length + e.length + payloadBytes.length);
    out[0] = 4; out[1] = t.length; out[2] = e.length; out[3] = 0; out[4] = encoding;
    out.set(t, 5); out.set(e, 5 + t.length); out.set(payloadBytes, 5 + t.length + e.length);
    return out;
  }

  wss.on('connection', (ws, req) => {
    stats.connections++;
    const sock = { ws, keys: new Map(), presenceOn: new Set(), url: req.url };
    wss.clients.forEach(() => {});
    ws.on('message', (data, isBinary) => {
      if (isBinary) {
        // kind 3 = user broadcast push: [3, joinRefLen, refLen, topicLen, eventLen, metaLen, encoding, ...]
        const b = new Uint8Array(data);
        if (b[0] !== 3) return;
        let o = 7;
        const jr = b[1], rf = b[2], tl = b[3], el = b[4], ml = b[5], encoding = b[6];
        o += jr + rf;
        const topic = dec.decode(b.slice(o, o + tl)); o += tl;
        const event = dec.decode(b.slice(o, o + el)); o += el + ml;
        const payload = b.slice(o);
        stats.broadcasts++;
        const frame = binBroadcast(topic, event, payload, encoding);
        for (const s of topics.get(topic) || []) if (s !== sock) sendBin(s, frame);
        return;
      }
      let msg;
      try { msg = JSON.parse(data.toString()); } catch { return; }
      const [joinRef, ref, topic, event, payload] = msg;
      if (log) console.log('<-', event, topic, JSON.stringify(payload).slice(0, 120));
      if (event === 'heartbeat') return sendJson(sock, [null, ref, 'phoenix', 'phx_reply', { status: 'ok', response: {} }]);
      if (event === 'phx_join') {
        stats.joins++;
        const cfg = (payload && payload.config) || {};
        if (!topics.has(topic)) topics.set(topic, new Set());
        if (!presence.has(topic)) presence.set(topic, new Map());
        topics.get(topic).add(sock);
        sock.keys.set(topic, cfg.presence && cfg.presence.key !== undefined ? cfg.presence.key : String(refCounter));
        sendJson(sock, [joinRef, ref, topic, 'phx_reply', { status: 'ok', response: { postgres_changes: [] } }]);
        if (cfg.presence && cfg.presence.enabled) {
          sock.presenceOn.add(topic);
          sendJson(sock, [null, null, topic, 'presence_state', presenceState(topic)]);
        }
        return;
      }
      if (event === 'presence') {
        const p = payload || {};
        const key = sock.keys.get(topic);
        const pres = presence.get(topic);
        if (!pres || key === undefined) return;
        if (p.event === 'track') {
          stats.tracks++;
          const old = pres.get(key);
          const meta = Object.assign({}, p.payload, { phx_ref: String(refCounter++) });
          pres.set(key, meta);
          diff(topic, { [key]: { metas: [meta] } }, old ? { [key]: { metas: [old] } } : {});
        } else if (p.event === 'untrack' && pres.has(key)) {
          const old = pres.get(key);
          pres.delete(key);
          diff(topic, {}, { [key]: { metas: [old] } });
        }
        return sendJson(sock, [joinRef, ref, topic, 'phx_reply', { status: 'ok', response: {} }]);
      }
      if (event === 'phx_leave') {
        leave(sock, topic);
        sendJson(sock, [joinRef, ref, topic, 'phx_reply', { status: 'ok', response: {} }]);
        return sendJson(sock, [joinRef, null, topic, 'phx_close', {}]);
      }
      if (event === 'access_token') return sendJson(sock, [joinRef, ref, topic, 'phx_reply', { status: 'ok', response: {} }]);
    });
    ws.on('close', () => { for (const t of [...sock.keys.keys()]) leave(sock, t); });
  });

  return new Promise((resolve) => wss.on('listening', () => {
    const port = wss.address().port;
    resolve({
      port, url: 'http://127.0.0.1:' + port, stats,
      // cut every connection, as a dead network would; clients reconnect by themselves
      dropAll() { for (const c of wss.clients) c.terminate(); },
      peers(topicPart) { let n = 0; for (const [t, set] of topics) if (!topicPart || t.includes(topicPart)) n += set.size; return n; },
      stop() { for (const c of wss.clients) c.terminate(); wss.close(); }
    });
  }));
}
