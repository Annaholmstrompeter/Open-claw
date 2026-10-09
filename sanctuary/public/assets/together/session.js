/*
 * Body Mind Earth — TOGETHER
 * The shared session: who is in the room, who is ready, and one timeline both phones follow.
 * No audio, no screen and no network code lives here; it talks to a transport (transport.js) and
 * reports changes. That keeps it small enough to test on its own (see sanctuary/tests).
 *
 * The idea in four lines:
 *  - A room is a long random name. Nothing is stored anywhere; the room exists while two phones are in it.
 *  - Both phones follow one timeline: "at shared time T the recording is at position P and playing".
 *    Begin, pause and resume are just a new timeline with a higher number. Whoever acts, both follow.
 *  - Shared time is the host's clock. The guest measures how far its own clock is from the host's
 *    (a few quick ping/pong rounds, trusting the quickest) and adds that difference.
 *  - After the start, each phone plays the recording by itself. The network only carries commands,
 *    so a dropped connection never interrupts the ritual.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.BMECore = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var C = {
    BEGIN_LEAD: 7000,        // ms from "Begin Together" to the first sound (a quiet breath, then 3-2-1)
    RESUME_LEAD: 3000,       // ms from "Resume" to sound
    PING_BURST: 8,           // quick rounds when the room opens
    PING_GAP: 220,           // ms between them
    PING_REFRESH: 30000,     // ms between later check-ups
    CLOCK_MIN_SAMPLES: 3,    // rounds needed before the clock counts as measured
    PEER_GRACE: 9000,        // ms a partner may be silent before we say they have left
    CONNECT_TIMEOUT: 14000,  // ms before "we cannot reach the service" is shown
    ROOM_TTL: 3 * 60 * 60 * 1000, // an invitation lives three hours
    EVENT: 'm'
  };

  var ALPHABET = 'abcdefghijklmnopqrstuvwxyz234567';

  /* ——— room names: unguessable, with a built-in end date ——— */
  function randomBytes(n) {
    var b = new Uint8Array(n);
    var c = (typeof crypto !== 'undefined' && crypto) || (typeof self !== 'undefined' && self.crypto);
    if (!c || !c.getRandomValues) throw new Error('No secure random source');
    c.getRandomValues(b);
    return b;
  }
  function randomText(n) {
    var b = randomBytes(n), s = '';
    for (var i = 0; i < n; i++) s += ALPHABET.charAt(b[i] & 31); // 32 letters: every value equally likely
    return s;
  }
  // "<expiry in base 36>-<26 letters = 130 bits>"
  function makeRoomId(nowMs, ttl) {
    return (nowMs + (ttl || C.ROOM_TTL)).toString(36) + '-' + randomText(26);
  }
  function parseRoomId(id) {
    var m = /^([0-9a-z]{4,10})-([a-z2-7]{26})$/.exec(id || '');
    if (!m) return null;
    return { expires: parseInt(m[1], 36) };
  }

  /* ——— the difference between two clocks ——— */
  function ClockSync() { this.samples = []; }
  // t0: guest's clock when it asked, t1: host's clock when it answered, t3: guest's clock when the answer arrived
  ClockSync.prototype.add = function (t0, t1, t3) {
    var rtt = t3 - t0;
    if (!(rtt >= 0) || rtt > 8000) return;
    this.samples.push({ rtt: rtt, offset: t1 - (t0 + t3) / 2 });
    if (this.samples.length > 14) this.samples.shift();
  };
  // The quickest rounds are the most trustworthy: take the median of the three quickest.
  ClockSync.prototype.estimate = function () {
    if (!this.samples.length) return null;
    var best = this.samples.slice().sort(function (a, b) { return a.rtt - b.rtt; }).slice(0, 3);
    var offs = best.map(function (s) { return s.offset; }).sort(function (a, b) { return a - b; });
    return { offset: offs[Math.floor(offs.length / 2)], rtt: best[0].rtt, n: this.samples.length };
  };

  /* ——— the timeline ——— */
  // status: 'lobby' | 'playing' | 'paused'. While playing, the recording is at tl.pos at shared time tl.refTime
  // (a start in the future means: wait, then begin from tl.pos).
  function positionAt(tl, t) {
    if (!tl || tl.status === 'lobby') return 0;
    if (tl.status === 'paused') return tl.pos;
    if (t < tl.refTime) return tl.pos;
    return tl.pos + (t - tl.refTime) / 1000;
  }
  function isNewer(a, b) {
    return a.seq > b.seq || (a.seq === b.seq && String(a.by) < String(b.by));
  }

  /* ——— the session ——— */
  function Session(o) {
    this.role = o.role;                       // 'host' | 'guest'
    this.room = o.room;
    this.id = o.id || randomText(12);
    this.tx = o.transport;
    this.now = o.now || function () { return Date.now(); };
    this.clock = new ClockSync();
    this.offset = 0;                          // shared time = own time + offset (the host is the reference)
    this.clk = this.role === 'host';          // the guest's clock is "measured" once enough rounds are in
    this.joinedAt = this.now();
    this.self = { ready: false, prep: false };
    this.tl = { seq: 0, by: '', status: 'lobby', refTime: 0, pos: 0 };
    this.status = 'idle';                     // idle | connecting | online | lost | closed
    this.error = null;                        // { code }
    this.peer = null;                         // the other person's last presence
    this.peerHere = false;                    // ... and whether they are in the room right now
    this.peerSeen = false;
    this.peerLeft = false;
    this.replaced = false;
    this._order = {};                         // who showed up in which order, as seen by this phone (clocks are not compared)
    this._seq = 0;
    this._h = {};
    this._pingN = 0;
    this._timers = [];
    this._graceTimer = null;
    this._pendingTl = null;
  }

  Session.prototype.on = function (ev, fn) { (this._h[ev] = this._h[ev] || []).push(fn); return this; };
  Session.prototype._emit = function (ev, a) {
    var list = this._h[ev] || [];
    for (var i = 0; i < list.length; i++) { try { list[i](a); } catch (e) { if (typeof console !== 'undefined') console.error(e); } }
  };
  Session.prototype._changed = function () { this._emit('change', this.view()); };
  Session.prototype._later = function (fn, ms) {
    var t = setTimeout(fn, ms);
    this._timers.push(t);
    return t;
  };

  Session.prototype.sharedNow = function () { return this.now() + this.offset; };

  Session.prototype.meta = function () {
    return { id: this.id, role: this.role, ready: this.self.ready, prep: this.self.prep, clk: this.clk, t: this.joinedAt };
  };

  Session.prototype.start = function () {
    var self = this;
    if (this.status !== 'idle') return;
    this.status = 'connecting';
    this._changed();
    this._later(function () {
      if (self.status === 'connecting') { self.error = { code: 'unavailable' }; self._changed(); }
    }, C.CONNECT_TIMEOUT);
    this.tx.connect(this.room, this.id, {
      message: function (m) { self._onMessage(m); },
      presence: function (list) { self._onPresence(list); },
      status: function (s, info) { self._onStatus(s, info); }
    });
  };

  Session.prototype._send = function (m) {
    m.v = 1; m.id = this.id;
    try { this.tx.send(m); } catch (e) { /* the connection will report itself */ }
  };
  Session.prototype._track = function () {
    try { this.tx.track(this.meta()); } catch (e) { /* ditto */ }
  };

  Session.prototype._onStatus = function (s, info) {
    if (this.status === 'closed') return;
    if (s === 'online') {
      var again = this.status === 'lost';
      this.status = 'online';
      this._track();
      this._send({ k: 'hello' });
      if (this.role === 'guest') this._startClock(again);
    } else if (s === 'lost') {
      // while still connecting the connection keeps trying by itself; the screen shows an error after a while
      if (this.status === 'online') this.status = 'lost';
    } else if (s === 'error') {
      this.error = { code: (info && info.code) || 'unavailable' };
    }
    this._changed();
  };

  /* clock: a quick burst, then a check-up every half minute */
  Session.prototype._startClock = function (refresh) {
    var self = this, n = refresh ? 3 : C.PING_BURST;
    for (var i = 0; i < n; i++) {
      this._later(function () { self._ping(); }, i * C.PING_GAP);
    }
    if (!this._clockLoop) {
      this._clockLoop = setInterval(function () {
        if (self.status === 'online') for (var j = 0; j < 3; j++) self._later(function () { self._ping(); }, j * C.PING_GAP);
      }, C.PING_REFRESH);
    }
  };
  Session.prototype._ping = function () {
    if (this.status !== 'online') return;
    this._send({ k: 'ping', n: ++this._pingN, t0: this.now() });
  };

  Session.prototype._onMessage = function (m) {
    if (!m || m.v !== 1 || m.id === this.id) return;
    if (m.k === 'ping') {
      if (this.role === 'host') this._send({ k: 'pong', to: m.id, n: m.n, t0: m.t0, t1: this.now() });
    } else if (m.k === 'pong') {
      if (m.to !== this.id || this.role !== 'guest') return;
      this.clock.add(m.t0, m.t1, this.now());
      var est = this.clock.estimate();
      if (est) {
        this.offset = est.offset;
        this.rtt = est.rtt;
        if (!this.clk && est.n >= C.CLOCK_MIN_SAMPLES) {
          this.clk = true;
          this._track();
          if (this._pendingTl) { var p = this._pendingTl; this._pendingTl = null; this._emit('timeline', p); }
        }
        this._changed();
      }
    } else if (m.k === 'tl') {
      this._adopt(m.tl);
    } else if (m.k === 'hello') {
      // someone (re)joined: if the ritual is under way, tell them where it is
      if (this.tl.status !== 'lobby') this._send({ k: 'tl', tl: this.tl });
    } else if (m.k === 'bye') {
      (this._goneIds = this._goneIds || {})[m.id] = true;
      this._peerGone(true);
    }
  };

  Session.prototype._adopt = function (tl) {
    if (!tl || typeof tl.seq !== 'number' || !isNewer(tl, this.tl)) return;
    this.tl = { seq: tl.seq, by: tl.by, status: tl.status, refTime: tl.refTime, pos: tl.pos };
    // a guest whose clock is not measured yet must not act on shared time
    if (this.role === 'guest' && !this.clk) this._pendingTl = this.tl;
    else this._emit('timeline', this.tl);
    this._changed();
  };

  /* presence: who is here */
  Session.prototype._onPresence = function (list) {
    var me = this, gone = this._goneIds || {};
    var others = (list || []).filter(function (p) { return p && p.id && p.id !== me.id && !gone[p.id]; });
    // Two people only: one host and one guest. If the same role turns up again (a reload, or another
    // window) the newest one stays and the older one is told it has been replaced. "Newest" is the one
    // this phone saw arrive last: phones' clocks can differ by seconds, so they are not compared.
    var batch = null;
    (list || []).forEach(function (p) {
      if (p && p.id && !me._order[p.id]) { batch = batch || ++me._seq; me._order[p.id] = batch; }
    });
    var mine = this._order[this.id] || 0;
    this.replaced = !!mine && others.some(function (p) {
      var o = me._order[p.id];
      return p.role === me.role && (o > mine || (o === mine && ((p.t > me.joinedAt) || (p.t === me.joinedAt && p.id > me.id))));
    });
    // the partner is whoever has the other role
    var partners = others.filter(function (p) { return p.role !== me.role; });
    partners.sort(function (a, b) { return b.t - a.t; });
    var peer = partners[0] || null;
    if (peer) {
      clearTimeout(this._graceTimer);
      this._graceTimer = null;
      this.peerSeen = true;
      this.peerLeft = false;
      this.peer = peer;
      this.peerHere = true;
    } else if (this.peerHere) {
      // gone for the moment; a flicker should not be announced, so there is a short grace period
      var self = this;
      this.peerHere = false;
      if (!this._graceTimer) this._graceTimer = setTimeout(function () { self._graceTimer = null; self._peerGone(false); }, C.PEER_GRACE);
    }
    this._changed();
  };
  Session.prototype._peerGone = function (explicit) {
    clearTimeout(this._graceTimer);
    this._graceTimer = null;
    if (!this.peerSeen && !explicit) return;
    this.peer = null;
    this.peerHere = false;
    this.peerLeft = this.peerSeen;
    this._changed();
  };

  /* what the screen needs to know */
  Session.prototype.view = function () {
    var p = this.peerHere ? this.peer : null;
    return {
      role: this.role,
      status: this.status,
      error: this.error,
      replaced: this.replaced,
      reconnecting: this.status === 'lost',
      clockSynced: this.clk,
      rtt: this.rtt,
      self: { ready: this.self.ready, prep: this.self.prep },
      peer: {
        present: !!p,
        away: !p && this.peerSeen && !this.peerLeft,      // silent for a moment
        left: this.peerLeft,
        ready: !!(p && p.ready),
        prep: !!(p && p.prep),
        clk: !!(p && p.clk)
      },
      tl: this.tl,
      canBegin: this.canBegin()
    };
  };

  Session.prototype.canBegin = function () {
    var p = this.peerHere ? this.peer : null;
    return this.role === 'host' && this.status === 'online' && !!p && p.ready && p.clk &&
      this.self.ready && this.self.prep && this.tl.status === 'lobby';
  };

  /* what each person can do */
  Session.prototype.setPrepared = function (v) { this.self.prep = !!v; this._track(); this._changed(); };
  Session.prototype.setReady = function (v) { this.self.ready = !!v; this._track(); this._changed(); };

  Session.prototype._command = function (f) {
    var tl = { seq: this.tl.seq + 1, by: this.id, status: f.status, refTime: f.refTime, pos: f.pos };
    this.tl = tl;
    this._send({ k: 'tl', tl: tl });
    this._emit('timeline', tl);
    this._changed();
    return true;
  };
  Session.prototype.begin = function () {
    if (!this.canBegin()) return false;
    return this._command({ status: 'playing', refTime: this.sharedNow() + C.BEGIN_LEAD, pos: 0 });
  };
  Session.prototype.pause = function () {
    if (this.tl.status !== 'playing') return false;
    var t = this.sharedNow();
    return this._command({ status: 'paused', refTime: t, pos: positionAt(this.tl, t) });
  };
  Session.prototype.resume = function () {
    if (this.tl.status !== 'paused') return false;
    return this._command({ status: 'playing', refTime: this.sharedNow() + C.RESUME_LEAD, pos: this.tl.pos });
  };

  Session.prototype.leave = function () {
    if (this.status === 'closed') return;
    this._send({ k: 'bye' });
    this.destroy();
  };
  Session.prototype.destroy = function () {
    this.status = 'closed';
    this._timers.forEach(clearTimeout);
    this._timers = [];
    clearInterval(this._clockLoop);
    clearTimeout(this._graceTimer);
    try { this.tx.close(); } catch (e) { /* closing anyway */ }
  };

  return {
    C: C, makeRoomId: makeRoomId, parseRoomId: parseRoomId, randomText: randomText,
    ClockSync: ClockSync, positionAt: positionAt, isNewer: isNewer, Session: Session
  };
});
