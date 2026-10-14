/*
 * Body Mind Earth — TOGETHER
 * How the two phones talk: Supabase Realtime (Presence for "who is here and ready", Broadcast for the
 * commands). The Supabase client is a separate file that is loaded only when a shared session opens.
 *
 * What goes over the wire: a random room name, a random id per phone, ready flags, and timeline numbers.
 * No names, no audio, no location. Nothing is stored; the room disappears when both phones leave.
 *
 * A second, local transport (two tabs of one browser) exists only for trying the screens on
 * localhost without any server. It is never used on the real address.
 */
(function () {
  'use strict';

  var EVENT = 'm';

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = src;
      s.async = true;
      s.onload = resolve;
      s.onerror = function () { reject(new Error('could not load ' + src)); };
      document.head.appendChild(s);
    });
  }

  /* ——— Supabase Realtime ——— */
  function SupabaseTransport(cfg, base) {
    this.cfg = cfg;
    this.base = base;
    this.client = null;
    this.channel = null;
  }
  SupabaseTransport.prototype.connect = function (room, id, h) {
    var self = this;
    var go = function () {
      var endpoint = String(self.cfg.supabaseUrl).replace(/\/+$/, '').replace(/^http/i, 'ws') + '/realtime/v1';
      try {
        self.client = new window.BMERealtime.RealtimeClient(endpoint, {
          params: { apikey: self.cfg.supabaseAnonKey },
          heartbeatIntervalMs: 15000
        });
        // a topic name no one can guess: the room name itself is the key
        self.channel = self.client.channel('bme-together:' + room, {
          config: { broadcast: { self: false, ack: false }, presence: { key: id } }
        });
      } catch (e) {
        h.status('error', { code: 'unavailable' });
        return;
      }
      var ch = self.channel;
      ch.on('broadcast', { event: EVENT }, function (msg) { h.message(msg && msg.payload); });
      ch.on('presence', { event: 'sync' }, function () {
        var state = ch.presenceState(), list = [];
        Object.keys(state).forEach(function (k) {
          var metas = state[k];
          if (metas && metas.length) list.push(metas[metas.length - 1]); // the latest word from each phone
        });
        h.presence(list);
      });
      ch.subscribe(function (status) {
        if (status === 'SUBSCRIBED') h.status('online');
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') h.status('lost');
      });
    };
    if (window.BMERealtime) go();
    else loadScript(this.base + 'vendor/realtime.min.js').then(go, function () { h.status('error', { code: 'unavailable' }); });
  };
  SupabaseTransport.prototype.track = function (meta) {
    if (this.channel) this.channel.track(meta);
  };
  SupabaseTransport.prototype.send = function (m) {
    if (this.channel) this.channel.send({ type: 'broadcast', event: EVENT, payload: m });
  };
  SupabaseTransport.prototype.close = function () {
    var client = this.client, channel = this.channel;
    this.channel = null;
    this.client = null;
    // a moment's grace, so that the last words ("goodbye") are on their way before the line is closed
    setTimeout(function () {
      try {
        if (channel) channel.untrack();
        if (client) { client.removeAllChannels(); client.disconnect(); }
      } catch (e) { /* leaving anyway */ }
    }, 300);
  };

  /* ——— Two tabs of one browser, for trying the screens on localhost ——— */
  function LocalTransport() { this.bc = null; this.timer = null; this.peers = {}; this.me = null; this.meta = null; }
  LocalTransport.prototype.connect = function (room, id, h) {
    var self = this;
    this.id = id;
    this.h = h;
    this.bc = new BroadcastChannel('bme-together:' + room);
    this.bc.onmessage = function (ev) {
      var d = ev.data || {};
      if (d.p === 'meta') { self.peers[d.meta.id] = { meta: d.meta, seen: Date.now() }; self._sync(); }
      else if (d.p === 'gone') { delete self.peers[d.id]; self._sync(); }
      else if (d.p === 'msg') h.message(d.m);
    };
    this.timer = setInterval(function () {
      if (self.meta) self.bc.postMessage({ p: 'meta', meta: self.meta });
      var cut = Date.now() - 6000, changed = false;
      Object.keys(self.peers).forEach(function (k) { if (self.peers[k].seen < cut) { delete self.peers[k]; changed = true; } });
      if (changed) self._sync();
    }, 1500);
    setTimeout(function () { h.status('online'); }, 0);
  };
  LocalTransport.prototype._sync = function () {
    var list = [];
    if (this.meta) list.push(this.meta);
    var self = this;
    Object.keys(this.peers).forEach(function (k) { list.push(self.peers[k].meta); });
    this.h.presence(list);
  };
  LocalTransport.prototype.track = function (meta) {
    this.meta = meta;
    if (this.bc) this.bc.postMessage({ p: 'meta', meta: meta });
    this._sync();
  };
  LocalTransport.prototype.send = function (m) { if (this.bc) this.bc.postMessage({ p: 'msg', m: m }); };
  LocalTransport.prototype.close = function () {
    clearInterval(this.timer);
    if (this.bc) { this.bc.postMessage({ p: 'gone', id: this.id }); this.bc.close(); }
    this.bc = null;
  };

  function isLocalhost() {
    return /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
  }

  // -> { kind, make() } or { kind: 'none' }
  function choose() {
    var cfg = window.BME_TOGETHER || {};
    var base = cfg.base || 'assets/together/';
    if (cfg.supabaseUrl && cfg.supabaseAnonKey) {
      return { kind: 'supabase', make: function () { return new SupabaseTransport(cfg, base); } };
    }
    if (cfg.local !== false && isLocalhost() && typeof BroadcastChannel !== 'undefined') {
      return { kind: 'local', make: function () { return new LocalTransport(); } };
    }
    return { kind: 'none' };
  }

  window.BMETransport = { choose: choose, loadScript: loadScript };
})();
