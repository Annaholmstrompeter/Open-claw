/*
 * Body Mind Earth — TOGETHER
 * The recording on this phone. Two players live here:
 *
 *  SyncedPlayer  plays the recording by following the shared timeline (see session.js).
 *  SoloPlayer    "Listen Together on One Device": a plain player, like the one on the rituals.
 *
 * SyncedPlayer, in short:
 *  - The whole recording is fetched into memory first, so nothing can stall once it has begun
 *    and the network is only needed for the commands.
 *  - Phones only allow sound that a person has asked for. The tap on "I'm Ready" switches the sound on
 *    (a silent half second is played inside that tap). Later, starts that come over the network
 *    are then allowed. If a phone refuses anyway, the person is asked for one tap and
 *    joins the right place in the recording.
 *  - The start is scheduled for the shared moment, ahead of it by the time this phone needs to start
 *    sound. After that the position is checked every second against the timeline:
 *    small differences are corrected by playing a hair faster or slower, large ones by a jump.
 *  - The audio is played by the phone itself, so locking the screen does not stop it.
 */
(function () {
  'use strict';

  var Core = window.BMECore;

  /* a short silence, made on the fly (no file, nothing to download) */
  function silentWavUrl() {
    var n = 4000, rate = 8000, buf = new Uint8Array(44 + n), v = new DataView(buf.buffer);
    function str(o, s) { for (var i = 0; i < s.length; i++) buf[o + i] = s.charCodeAt(i); }
    str(0, 'RIFF'); v.setUint32(4, 36 + n, true); str(8, 'WAVE'); str(12, 'fmt ');
    v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, rate, true); v.setUint32(28, rate, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true);
    str(36, 'data'); v.setUint32(40, n, true);
    for (var i = 44; i < buf.length; i++) buf[i] = 128; // 8-bit silence
    return URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
  }

  function fail(code, detail) { var e = new Error(code); e.code = code; e.detail = detail; return e; }

  function SyncedPlayer(o) {
    this.src = o.src;
    this.sharedNow = o.sharedNow;
    this.audio = new Audio();
    this.audio.preload = 'auto';
    this.h = {};
    this.state = 'idle';       // idle | countdown | playing | paused | blocked | ended
    this.prepared = false;
    this.unlocked = false;
    this.attached = false;
    this.startLatency = 120;   // ms between asking for sound and hearing it; measured when sound is switched on
    this.duration = 0;
    this.tl = null;
    this._blob = null;
    this._started = false;
    this._expectPause = 0;
    this._pendingSeek = null;
    this._timer = null;
    this._tick = null;
    this._nudging = false;
    this._wire();
  }

  SyncedPlayer.prototype.on = function (ev, fn) { (this.h[ev] = this.h[ev] || []).push(fn); return this; };
  SyncedPlayer.prototype._emit = function (ev, a) {
    var l = this.h[ev] || [];
    for (var i = 0; i < l.length; i++) { try { l[i](a); } catch (e) { if (window.console) console.error(e); } }
  };
  SyncedPlayer.prototype._set = function (s) {
    if (this.state === s) return;
    this.state = s;
    this._emit('state', s);
  };

  SyncedPlayer.prototype._wire = function () {
    var self = this, a = this.audio;
    a.addEventListener('loadedmetadata', function () {
      self.duration = a.duration;
      if (self._pendingSeek !== null) { try { a.currentTime = self._pendingSeek; } catch (e) { /* later */ } self._pendingSeek = null; }
    });
    a.addEventListener('ended', function () {
      if (!self.attached) return;         // the silence used for switching sound on ends by itself
      self._stopTimers(); self._started = false; self._set('ended');
    });
    a.addEventListener('pause', function () {
      if (self._expectPause > 0) { self._expectPause--; return; }
      // Paused by someone else: a call, headphones taken out, the lock screen. Tell the session.
      if (self.attached && self.tl && self.tl.status === 'playing' && self._started && !a.ended) {
        self._started = false;
        self._stopTimers();
        self._emit('interrupted');
      }
    });
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) self.check();
    });
  };

  SyncedPlayer.prototype._pause = function () {
    if (!this.audio.paused) { this._expectPause++; this.audio.pause(); }
  };
  SyncedPlayer.prototype._stopTimers = function () {
    clearTimeout(this._timer); this._timer = null;
    clearInterval(this._tick); this._tick = null;
  };
  SyncedPlayer.prototype._seek = function (pos) {
    var a = this.audio;
    if (a.readyState >= 1) { try { a.currentTime = Math.max(0, pos); } catch (e) { this._pendingSeek = pos; } }
    else this._pendingSeek = pos;
  };

  /* 1. fetch the whole recording into memory */
  SyncedPlayer.prototype.prepare = function (onProgress) {
    var self = this;
    return fetch(this.src).then(function (res) {
      // a missing file can come back as the home page: that is not a recording
      var type = res.headers.get('content-type') || '';
      if (!res.ok || !/^(audio\/|video\/mp4|application\/(ogg|octet-stream))/i.test(type)) throw fail('missing');
      var total = +res.headers.get('content-length') || 0;
      if (res.body && res.body.getReader && total) {
        var reader = res.body.getReader(), chunks = [], got = 0;
        var pump = function () {
          return reader.read().then(function (r) {
            if (r.done) return new Blob(chunks, { type: type });
            chunks.push(r.value); got += r.value.length;
            if (onProgress) onProgress(Math.min(1, got / total));
            return pump();
          });
        };
        return pump();
      }
      return res.blob();
    }).then(function (blob) {
      self._blob = URL.createObjectURL(blob);
      self.prepared = true;
      if (onProgress) onProgress(1);
      // never replace the silence used for switching sound on while that is happening
      if (self.unlocked || self._unlockFailed) self._attach();
      return self;
    }, function (e) {
      throw e && e.code ? e : fail('network', e);
    });
  };

  /* the real recording takes over from the silence */
  SyncedPlayer.prototype._attach = function () {
    var self = this, a = this.audio;
    if (this.attached || !this._blob) return Promise.resolve();
    return new Promise(function (resolve, reject) {
      var done = false;
      function ok() { if (done) return; done = true; cleanup(); self.attached = true; self._emit('attached'); if (self.tl) self.apply(self.tl); resolve(); }
      function bad() { if (done) return; done = true; cleanup(); reject(fail('decode')); }
      function cleanup() { a.removeEventListener('canplay', ok); a.removeEventListener('error', bad); clearTimeout(to); }
      var to = setTimeout(ok, 15000); // some phones stay quiet about it; carry on
      a.addEventListener('canplay', ok);
      a.addEventListener('error', bad);
      a.src = self._blob;
      a.load();
    }).catch(function (e) { self._emit('error', e); });
  };

  /* 2. switch the sound on — must be called straight from a tap */
  SyncedPlayer.prototype.unlock = function () {
    var self = this, a = this.audio;
    if (this.unlocked) return Promise.resolve(true);
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) { /* not everywhere */ }
    if (!this.attached) a.src = silentWavUrl();
    var t0 = performance.now();
    var p;
    try { p = a.play(); } catch (e) { p = Promise.reject(e); }
    return Promise.resolve(p).then(function () {
      self.startLatency = Math.max(0, Math.min(350, performance.now() - t0));
      self._pause();
      self.unlocked = true;
      return self._attach().then(function () { return true; });
    }, function () {
      self._unlockFailed = true;   // the start will ask for one more tap
      return self._attach().then(function () { return false; });
    });
  };

  /* 3. follow the timeline */
  SyncedPlayer.prototype.apply = function (tl) {
    this.tl = tl;
    this._stopTimers();
    if (!this.attached) return;           // picked up again when the recording is in place
    var self = this;
    if (tl.status === 'paused') {
      this._started = false;
      this._pause();
      this._seek(tl.pos);
      this._set('paused');
      return;
    }
    if (tl.status !== 'playing') return;
    var startsIn = tl.refTime - this.sharedNow();
    if (startsIn > 0) {
      this._started = false;
      this._pause();
      this._seek(tl.pos);
      this._set('countdown');
      var wait = startsIn - this.startLatency;
      this._timer = setTimeout(function () { self._fireAt(tl.refTime - self.startLatency); }, Math.max(0, wait - 40));
    } else {
      this._startNow();                   // joining late, or a reload
    }
  };
  // the last few milliseconds are waited out in small steps, since timers are never exact
  SyncedPlayer.prototype._fireAt = function (when) {
    var self = this;
    (function spin() {
      if (self.sharedNow() >= when || when - self.sharedNow() > 200) return self._startNow();
      self._timer = setTimeout(spin, 2);
    })();
  };
  SyncedPlayer.prototype._startNow = function () {
    var self = this, a = this.audio, tl = this.tl;
    if (!tl || tl.status !== 'playing') return;
    var exp = Core.positionAt(tl, this.sharedNow());
    if (isFinite(a.duration) && exp >= a.duration - 0.25) { this._set('ended'); return; }
    if (Math.abs(a.currentTime - exp) > 0.15 || a.readyState < 1) this._seek(exp);
    var p;
    try { p = a.play(); } catch (e) { p = Promise.reject(e); }
    this._started = true;
    Promise.resolve(p).then(function () {
      if (self.tl !== tl) return;
      self._set('playing');
      self._stopTimers();
      self._tick = setInterval(function () { self.check(); }, 1000);
    }, function (e) {
      if (self.tl !== tl || (e && e.name === 'AbortError')) return;   // we paused or moved on ourselves
      self._started = false;
      self._set('blocked');               // the screen offers one tap to join the right place
    });
  };

  /* one tap from the person, when the phone refused: join where the others are */
  SyncedPlayer.prototype.rejoin = function () {
    var self = this;
    if (!this.attached) return this.unlock().then(function () { if (self.tl) self.apply(self.tl); });
    if (this.tl && this.tl.status === 'playing') this._startNow();
    return Promise.resolve();
  };

  /* every second: where should we be, and where are we? */
  SyncedPlayer.prototype.check = function () {
    var a = this.audio, tl = this.tl;
    if (!this._started || !tl || tl.status !== 'playing' || a.paused || a.ended) return;
    var exp = Core.positionAt(tl, this.sharedNow()), d = a.currentTime - exp; // + : ahead of the others
    this.drift = d;
    var ad = Math.abs(d);
    var t = Date.now();
    if (ad > 0.6 && t - (this._lastJump || 0) > 4000) {
      this._lastJump = t;                 // a jump (not more often than every few seconds), allowing for its own duration
      this._seek(exp + 0.08);
      a.playbackRate = 1; this._nudging = false;
    } else if (ad > 0.06 || (this._nudging && ad > 0.02)) {
      a.playbackRate = d > 0 ? 0.97 : 1.03;   // a hair slower or faster: not noticeable, closes ~30 ms every second
      this._nudging = true;
    } else if (this._nudging) {
      a.playbackRate = 1; this._nudging = false;
    }
  };

  SyncedPlayer.prototype.position = function () { return this.audio.currentTime || 0; };

  SyncedPlayer.prototype.destroy = function () {
    this._stopTimers();
    try { this._expectPause++; this.audio.pause(); this.audio.removeAttribute('src'); this.audio.load(); } catch (e) { /* leaving */ }
    if (this._blob) URL.revokeObjectURL(this._blob);
    this._blob = null;
    this.h = {};
  };

  /* ——— one phone, one recording: the plain player ——— */
  function SoloPlayer(src) {
    this.src = src;
    this.audio = new Audio();
    this.audio.preload = 'metadata';
    this.audio.src = src;
    this.failed = false;
    var self = this;
    this.audio.addEventListener('error', function () { self.failed = true; if (self.onchange) self.onchange(); });
    ['play', 'pause', 'timeupdate', 'loadedmetadata', 'durationchange', 'seeked', 'playing', 'waiting', 'ended'].forEach(function (ev) {
      self.audio.addEventListener(ev, function () { if (self.onchange) self.onchange(ev); });
    });
  }
  SoloPlayer.prototype.toggle = function () {
    var a = this.audio;
    if (a.paused) { var p = a.play(); if (p && p.catch) p.catch(function () {}); } else a.pause();
  };
  SoloPlayer.prototype.seek = function (s) {
    if (isFinite(this.audio.duration)) this.audio.currentTime = Math.max(0, Math.min(this.audio.duration, s));
  };
  SoloPlayer.prototype.destroy = function () {
    try { this.audio.pause(); this.audio.removeAttribute('src'); this.audio.load(); } catch (e) { /* leaving */ }
    this.onchange = null;
  };

  window.BMEPlayer = { SyncedPlayer: SyncedPlayer, SoloPlayer: SoloPlayer };
})();
