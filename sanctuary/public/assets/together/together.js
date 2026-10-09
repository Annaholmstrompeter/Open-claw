/*
 * Body Mind Earth — TOGETHER (A Ritual for Two)
 * The screens. A separate module: the sanctuary works without it, and it works without the sanctuary's
 * other screens. The router in app.js hands any "#/together/…" address to screen() below.
 *
 *   #/together                          the landing
 *   #/together/rituals                  choose a ritual for two
 *   #/together/<id>                     a ritual for two: what it is, how to begin
 *   #/together/solo/<id>                listen together on one device
 *   #/together/host/<id>/<room>         the person who invited (QR code and link, then the ritual)
 *   #/together/join/<id>/<room>         the person who was invited (the link they were sent)
 *
 * Words about the rituals come from content.js (SANCTUARY.together). Words of the interface are here.
 * Needs: session.js (the shared timeline), transport.js (Supabase Realtime), player.js (the recording).
 */
(function () {
  'use strict';

  var Core = window.BMECore, P = window.BMEPlayer;
  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var root = document.documentElement;
  var themeMeta = document.querySelector('meta[name="theme-color"]');
  var PAPER = '#fff7e9', STONE = '#3f3428';

  var UI = {
    tabRituals: 'Rituals',
    tabTogether: 'Together',
    begin: 'Begin Your Ritual',
    privacy: 'No names, no accounts. A private room exists only while you are both in it.',
    chooseTitle: 'A Ritual for Two',
    chooseSub: 'Choose your ritual',
    forTwo: 'For two',
    about: 'About',
    minutes: 'minutes',
    backTogether: 'Together',
    invite: 'Invite Your Partner',
    oneDevice: 'Listen Together on One Device',
    oneDeviceNote: 'Two Bluetooth headphones can work on one phone, if your phone and headphones allow it. This website cannot switch that on for you: look for audio sharing in your phone’s Bluetooth settings.',
    notReady: 'The recording for this ritual is being prepared. Shared sessions open as soon as it is ready.',
    notAvailable: 'Shared sessions are not available right now. You can still listen together on one device.',
    inviteTitle: 'Invite your partner',
    inviteText: 'Show this code, or send the link. Your partner opens it on their own phone.',
    share: 'Share link',
    copy: 'Copy link',
    copied: 'Link copied',
    cancel: 'Cancel',
    leave: 'Leave',
    almost: 'Your shared moment is almost here.',
    waitHost: 'Waiting for your partner to open the ritual.',
    opening: 'Opening your shared space…',
    bothHere: 'You are both here.',
    headphones: 'Connect your headphones to your own phone. Then tap I’m Ready, which switches on the sound on this phone.',
    preparing: 'Preparing your recording…',
    switching: 'Switching on the sound…',
    ready: 'I’m Ready',
    youReady: 'Ready',
    waitPartner: 'Waiting for your partner…',
    waitBegin: 'Waiting for your partner to begin.',
    beginTogether: 'Begin Together',
    you: 'You',
    partner: 'Your partner',
    stHere: 'Here',
    stReady: 'Ready',
    stWaiting: 'Waiting',
    stAway: 'Away',
    breathe: 'Close your eyes if you wish.',
    beginsSoon: 'Your ritual begins in a moment.',
    pause: 'Pause',
    resume: 'Resume',
    paused: 'Paused',
    partnerPaused: 'Your partner paused.',
    pausedText: 'Resume when you are both ready.',
    underway: 'Your ritual is under way.',
    rejoin: 'Tap to join your partner',
    rejoinText: 'Your phone asks for one more tap before it plays.',
    partnerLeft: 'Your partner has left the ritual.',
    partnerLeftText: 'Your recording carries on. You can stay as long as you wish.',
    reconnecting: 'Reconnecting…',
    endTitle: 'Take a moment.',
    endText: 'Notice what you feel. Carry it with you into the rest of your day.',
    returnTogether: 'Return to Together',
    again: 'Begin again',
    back15: 'Back 15 seconds',
    play: 'Play',
    position: 'Position',
    missing: 'This recording is not available yet.',
    soloEyebrow: 'On one device',
    soloHint: 'Put on your headphones, or share the sound between two, and sit comfortably together.',
    errConfigTitle: 'Shared sessions are not switched on yet.',
    errExpiredTitle: 'This invitation has ended.',
    errExpiredText: 'Ask your partner for a new one.',
    errBadTitle: 'This invitation is not valid.',
    errBadText: 'Ask your partner to send it again.',
    errUnavailTitle: 'We cannot reach the shared space.',
    errUnavailText: 'Check your connection and try again.',
    errFullTitle: 'This ritual already has two people.',
    errFullText: 'If one of them is you, on another phone, close it there and try again.',
    errReplacedTitle: 'This ritual is open in another window.',
    errReplacedText: 'Continue there, or return to Together.',
    errMissingTitle: 'The recording is being prepared.',
    errMissingText: 'This ritual will be ready to share soon.',
    errNetworkTitle: 'We could not fetch the recording.',
    errNetworkText: 'Check your connection and try again.',
    retry: 'Try again'
  };

  function data() { return (window.SANCTUARY && window.SANCTUARY.together) || null; }
  function ritual(id) {
    var d = data();
    if (!d) return null;
    for (var i = 0; i < d.rituals.length; i++) if (d.rituals[i].id === id) return d.rituals[i];
    return null;
  }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function arrow() { return '<svg class="arr" viewBox="0 0 24 12" aria-hidden="true"><path d="M1 6h21M17 1l5 5-5 5"/></svg>'; }
  function fmt(s) {
    if (!isFinite(s) || s < 0) return '0:00';
    var m = Math.floor(s / 60), r = Math.floor(s % 60);
    return m + ':' + (r < 10 ? '0' : '') + r;
  }
  function go(hash) {
    var A = window.SANCTUARY_APP;
    if (A && A.navigate) A.navigate(hash); else location.hash = hash;
  }

  var ICON = {
    play: '<svg class="i-play" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.2l11 6.8-11 6.8z"/></svg>',
    pause: '<svg class="i-pause" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5h3.4v14H7zM13.6 5H17v14h-3.4z"/></svg>',
    restart: '<svg viewBox="0 0 24 24" aria-hidden="true" class="i-line"><path d="M4.5 12a7.5 7.5 0 1 0 2.4-5.5M4.5 4.5v4.4h4.4"/></svg>',
    share: '<svg viewBox="0 0 24 24" aria-hidden="true" class="i-line"><path d="M12 15V4M8 8l4-4 4 4M5 13v6h14v-6"/></svg>'
  };

  /* ——— small pieces of the design ——— */

  // Two rings that come together: you, and your partner. When both are here the rings overlap.
  function rings(you, partner) {
    return '<svg class="tg-rings" data-you="' + you + '" data-partner="' + partner + '" viewBox="0 0 160 90" aria-hidden="true">' +
      '<path class="lens" d="M80 24.6A30 30 0 0 0 80 65.4A30 30 0 0 0 80 24.6Z"/>' +
      '<g class="ra"><circle cx="58" cy="45" r="30"/></g><g class="rb"><circle cx="102" cy="45" r="30"/></g></svg>';
  }
  function light() { return '<div class="tg-light" aria-hidden="true"><i class="a"></i><i class="b"></i></div>'; }

  // The two top-level sections as quiet tabs.
  function tabs(active) {
    return '<nav class="tg-tabs" aria-label="Sections">' +
      '<a href="#/rituals"' + (active === 'rituals' ? ' aria-current="page"' : '') + '><span>' + UI.tabRituals + '</span></a>' +
      '<a href="#/together"' + (active === 'together' ? ' aria-current="page"' : '') + '><span>' + UI.tabTogether + '</span></a>' +
      '</nav>';
  }

  function setLook(mode) {
    // 'light': cream and champagne; 'scene': the quiet water-light view while the ritual plays
    root.setAttribute('data-tg', mode);
    if (themeMeta) themeMeta.setAttribute('content', mode === 'scene' ? STONE : PAPER);
  }
  // (the colour of the phone's status bar is not put back here: app.js sets it again for every screen it draws)
  function clearLook() {
    root.removeAttribute('data-tg');
    root.classList.remove('tg-still');
  }
  function addScene() {
    if (document.querySelector('.tg-scene')) return;
    var d = document.createElement('div');
    d.className = 'tg-scene';
    d.setAttribute('aria-hidden', 'true');
    d.innerHTML = '<i class="a"></i><i class="b"></i><i class="v"></i>';
    document.body.appendChild(d);
  }
  function removeScene() {
    var s = document.querySelector('.tg-scene');
    if (s) s.remove();
  }
  function onVisibility() { root.classList.toggle('tg-still', document.hidden); }

  /* ——— the screens that only read ——— */

  function landing() {
    var d = data(), L = d.landing;
    return {
      title: L.title + ' — ' + L.brand,
      kind: 'together',
      look: 'light',
      html:
        '<section class="screen top-aligned tg tg-landing">' +
        tabs('together') +
        '<div class="tg-hero">' + light() + rings('here', 'here') + '</div>' +
        '<p class="eyebrow">' + esc(L.brand) + '</p>' +
        '<h1 class="tg-title">' + esc(L.title) + '</h1>' +
        '<p class="tg-sub">' + esc(L.sub) + '</p>' +
        '<div class="rule" aria-hidden="true"></div>' +
        '<p class="text tg-lead">' + esc(L.lead) + '</p>' +
        '<p class="text tg-intro">' + esc(L.intro) + '</p>' +
        '<a class="btn primary" href="#/together/rituals"><span>' + UI.begin + '</span>' + arrow() + '</a>' +
        '</section>'
    };
  }

  function choose() {
    var d = data();
    var cards = d.rituals.map(function (r) {
      return '<li><a class="tg-card" href="#/together/' + r.id + '">' +
        '<span class="tg-card-art">' + light() + rings('here', 'here') + '</span>' +
        '<span class="tg-card-text"><span class="name">' + esc(r.title) + '</span>' +
        '<span class="kind">' + esc(r.subtitle) + '</span>' +
        '<span class="meta">' + r.minutes + ' ' + UI.minutes + ' · ' + UI.forTwo + '</span></span>' +
        '<svg class="chev" viewBox="0 0 10 18" aria-hidden="true"><path d="M1 1l8 8-8 8"/></svg>' +
        '</a></li>';
    }).join('');
    return {
      title: UI.chooseTitle + ' — Body Mind Earth',
      kind: 'together',
      look: 'light',
      html:
        '<section class="screen top-aligned tg">' +
        tabs('together') +
        '<h1 class="title caps">' + UI.chooseTitle + '</h1>' +
        '<p class="text sub-title">' + UI.chooseSub + '</p>' +
        '<ul class="tg-list">' + cards + '</ul>' +
        '</section>'
    };
  }

  function ritualPage(r) {
    return {
      title: r.title + ' — Body Mind Earth',
      kind: 'together',
      look: 'light',
      mount: function (stage) { checkRecording(r, stage.querySelector('[data-note]')); bindInvite(r, stage); },
      html:
        '<section class="screen top-aligned tg tg-ritual">' +
        '<a class="tg-back" href="#/together/rituals"><svg viewBox="0 0 10 18" aria-hidden="true"><path d="M9 1L1 9l8 8"/></svg><span>' + UI.backTogether + '</span></a>' +
        '<div class="tg-hero tg-hero-ritual">' + light() + rings('here', 'here') +
        '<div class="tg-hero-text"><p class="eyebrow">' + UI.chooseTitle + '</p>' +
        '<h1 class="tg-title small">' + esc(r.title) + '</h1>' +
        '<p class="tg-sub">' + esc(r.subtitle) + '</p></div></div>' +
        '<p class="small-caps tg-meta">' + UI.about + ' ' + r.minutes + ' ' + UI.minutes + ' · ' + UI.forTwo + '</p>' +
        '<p class="prose tg-prose">' + esc(r.lead) + '</p>' +
        '<p class="tg-consent">' + esc(r.consent) + '</p>' +
        '<div class="actions tg-actions">' +
        '<button class="btn primary" type="button" data-invite><span>' + UI.invite + '</span>' + arrow() + '</button>' +
        '<p class="notice tg-note" data-note hidden></p>' +
        '<a class="btn ghost" href="#/together/solo/' + r.id + '"><span>' + UI.oneDevice + '</span></a>' +
        '</div>' +
        '<p class="text fine tg-fine">' + UI.oneDeviceNote + '</p>' +
        '<p class="text fine tg-fine">' + esc(r.disclaimer) + '</p>' +
        '<p class="small-caps tg-privacy">' + UI.privacy + '</p>' +
        '</section>'
    };
  }

  // Is the recording there yet? A missing file can come back as the home page, so the type is checked too.
  function checkRecording(r, note) {
    if (!note || !window.fetch) return;
    fetch(r.audio.src, { method: 'HEAD' }).then(function (res) {
      var type = res.headers.get('content-type') || '';
      if (!res.ok || !/^(audio\/|video\/mp4|application\/(ogg|octet-stream))/i.test(type)) {
        note.textContent = UI.notReady; note.hidden = false;
        var inv = note.parentNode.querySelector('[data-invite]');
        if (inv) inv.disabled = true;
      }
    }).catch(function () { /* offline: say nothing */ });
  }

  function bindInvite(r, stage) {
    var b = stage.querySelector('[data-invite]'), note = stage.querySelector('[data-note]');
    if (!b) return;
    b.addEventListener('click', function () {
      var choice = window.BMETransport.choose();
      if (choice.kind === 'none') { note.textContent = UI.notAvailable; note.hidden = false; return; }
      go('#/together/host/' + r.id + '/' + Core.makeRoomId(Date.now()));
    });
  }

  /* ——— one device: the plain player ——— */

  function soloPage(r) {
    var state = { player: null, scene: false };
    return {
      title: r.title + ' — Body Mind Earth',
      kind: 'together',
      look: 'light',
      scene: true,
      mount: function (stage) { soloMount(r, stage, state); },
      unmount: function () { soloUnmount(state); },
      html:
        '<section class="screen tg tg-solo" data-solo data-state="paused">' +
        '<div class="tg-solo-head">' +
        '<p class="eyebrow">' + UI.soloEyebrow + '</p>' +
        '<h1 class="tg-title small">' + esc(r.title) + '</h1>' +
        '<p class="tg-sub">' + esc(r.subtitle) + '</p></div>' +
        '<div class="tg-solo-art">' + rings('here', 'here') + '</div>' +
        '<p class="text tg-hint">' + UI.soloHint + '</p>' +
        '<div class="deck">' +
        '<div class="seek"><span class="t" data-now>0:00</span>' +
        '<input class="range" type="range" min="0" max="1000" step="1" value="0" data-range aria-label="' + UI.position + '">' +
        '<span class="t" data-total>' + fmt(r.minutes * 60) + '</span></div>' +
        '<div class="controls">' +
        '<button class="ctl" type="button" data-restart aria-label="' + UI.again + '">' + ICON.restart + '<span class="cap">' + UI.again + '</span></button>' +
        '<button class="ctl play" type="button" data-toggle data-state="paused" aria-label="' + UI.play + '">' + ICON.play + ICON.pause + '</button>' +
        '<button class="ctl" type="button" data-back15 aria-label="' + UI.back15 + '"><span class="ctl-text">−15</span><span class="cap">15 s back</span></button>' +
        '</div>' +
        '<p class="notice" data-notice hidden>' + UI.missing + '</p></div>' +
        '<nav class="quiet"><a href="#/together/' + r.id + '"><span>' + esc(r.title) + '</span></a></nav>' +
        '</section>'
    };
  }

  function soloMount(r, stage, state) {
    var el = stage.querySelector('[data-solo]');
    var toggle = el.querySelector('[data-toggle]'), now = el.querySelector('[data-now]'), total = el.querySelector('[data-total]');
    var range = el.querySelector('[data-range]'), notice = el.querySelector('[data-notice]');
    var pl = new P.SoloPlayer(r.audio.src);
    state.player = pl;
    var dragging = false;
    function refresh() {
      var a = pl.audio, playing = !a.paused && !a.ended && !pl.failed;
      el.setAttribute('data-state', playing ? 'playing' : 'paused');
      toggle.setAttribute('data-state', playing ? 'playing' : 'paused');
      toggle.setAttribute('aria-label', playing ? UI.pause : UI.play);
      now.textContent = fmt(a.currentTime || 0);
      if (isFinite(a.duration)) total.textContent = fmt(a.duration);
      if (!dragging && isFinite(a.duration) && a.duration > 0) {
        var v = Math.round((a.currentTime / a.duration) * 1000);
        range.value = v;
        range.style.setProperty('--p', (v / 10) + '%');
      }
      notice.hidden = !pl.failed;
      if (playing && !state.scene) { state.scene = true; addScene(); setLook('scene'); }
    }
    pl.onchange = refresh;
    toggle.addEventListener('click', function () { pl.toggle(); setMedia(r, pl); });
    el.querySelector('[data-restart]').addEventListener('click', function () { pl.seek(0); if (pl.audio.paused) pl.toggle(); });
    el.querySelector('[data-back15]').addEventListener('click', function () { pl.seek(pl.audio.currentTime - 15); });
    range.addEventListener('input', function () {
      dragging = true;
      if (isFinite(pl.audio.duration)) pl.seek((range.value / 1000) * pl.audio.duration);
      range.style.setProperty('--p', (range.value / 10) + '%');
    });
    range.addEventListener('change', function () { dragging = false; });
    addScene();
    document.addEventListener('visibilitychange', onVisibility);
    refresh();
  }
  function soloUnmount(state) {
    if (state.player) state.player.destroy();
    document.removeEventListener('visibilitychange', onVisibility);
    if ('mediaSession' in navigator) { try { navigator.mediaSession.playbackState = 'none'; } catch (e) { /* ok */ } }
    removeScene();
    clearLook();
  }
  function setMedia(r, pl) {
    if (!('mediaSession' in navigator) || typeof MediaMetadata === 'undefined') return;
    navigator.mediaSession.metadata = new MediaMetadata({ title: r.title, artist: 'Body Mind Earth', album: UI.chooseTitle });
    var set = function (a, fn) { try { navigator.mediaSession.setActionHandler(a, fn); } catch (e) { /* unsupported */ } };
    set('play', function () { pl.toggle(); });
    set('pause', function () { pl.toggle(); });
    set('seekbackward', function () { pl.seek(pl.audio.currentTime - 15); });
    set('seekforward', function () { pl.seek(pl.audio.currentTime + 15); });
  }

  /* ——— two phones: the shared session ——— */

  function errorPage(code, r) {
    var map = {
      config: [UI.errConfigTitle, UI.notAvailable],
      expired: [UI.errExpiredTitle, UI.errExpiredText],
      invalid: [UI.errBadTitle, UI.errBadText],
      unavailable: [UI.errUnavailTitle, UI.errUnavailText],
      replaced: [UI.errReplacedTitle, UI.errReplacedText],
      full: [UI.errFullTitle, UI.errFullText],
      missing: [UI.errMissingTitle, UI.errMissingText],
      network: [UI.errNetworkTitle, UI.errNetworkText]
    };
    var m = map[code] || map.unavailable;
    return '<p class="eyebrow">' + esc(r ? r.title : UI.chooseTitle) + '</p>' +
      rings('here', 'none') +
      '<h1 class="tg-wait">' + m[0] + '</h1><p class="text">' + m[1] + '</p>' +
      '<div class="actions">' +
      (code === 'unavailable' || code === 'network' || code === 'full' ? '<button class="btn primary" type="button" data-act="retry"><span>' + UI.retry + '</span></button>' : '') +
      '<a class="btn ghost" href="#/together' + (r ? '/' + r.id : '') + '"><span>' + UI.returnTogether + '</span></a></div>';
  }

  function sessionPage(role, r, room, seat) {
    var parsed = Core.parseRoomId(room);
    var choice = window.BMETransport ? window.BMETransport.choose() : { kind: 'none' };
    var fatal = null;
    if (!parsed) fatal = 'invalid';
    else if (parsed.expires < Date.now()) fatal = 'expired';
    else if (choice.kind === 'none') fatal = 'config';
    var inner = fatal
      ? errorPage(fatal, r)
      : '<p class="eyebrow">' + esc(r.title) + '</p>' + rings('here', 'none') + '<h1 class="tg-wait">' + UI.opening + '</h1>';
    var ctl = { destroyed: false };
    return {
      title: r.title + ' — Body Mind Earth',
      kind: 'together',
      look: 'light',
      scene: !fatal,
      mount: function (stage) { if (!fatal) sessionMount(role, r, room, seat, choice, stage, ctl); },
      unmount: function () { sessionUnmount(ctl); },
      html: '<section class="screen tg tg-session"><div class="tg-live" data-live aria-live="polite">' + inner + '</div></section>'
    };
  }

  function sessionMount(role, r, room, seatIn, choice, stage, ctl) {
    var live = stage.querySelector('[data-live]');
    // A seat is a random word that lives in this phone's address bar only. A reload keeps it (same person, takes the
    // seat back); the invitation link has none, so someone else with the link gets a different one and is turned away.
    var seat = /^[a-z2-7]{6,20}$/.test(seatIn || '') ? seatIn : Core.randomText(10);
    if (seat !== seatIn && /^#\/together\/(host|join)\//.test(location.hash)) {
      try { history.replaceState(null, '', location.pathname + location.search + location.hash.replace(/\/+$/, '') + '/' + seat); } catch (e) { /* kept in memory only */ }
    }
    var base = (window.BME_TOGETHER && window.BME_TOGETHER.base) || 'assets/together/';
    var link = location.href.split('#')[0] + '#/together/join/' + r.id + '/' + room;

    var session = new Core.Session({ role: role, room: room, seat: seat, transport: choice.make() });
    var player = new P.SyncedPlayer({ src: r.audio.src, sharedNow: function () { return session.sharedNow(); } });
    ctl.session = session; ctl.player = player;
    var ui = { sig: '', prep: 0, prepErr: null, unlocking: false, ended: false, copied: false, qr: null, started: false, wake: null, wakeBusy: false, phaseId: '' };
    ctl.ui = ui;
    if (window.BME_TOGETHER && window.BME_TOGETHER.debug) window.__tg = { session: session, player: player, ui: ui };

    addScene();
    document.addEventListener('visibilitychange', onVisibility);
    requestWake(ui, ctl);

    /* what is on screen right now */
    function phase() {
      var v = session.view();
      if (v.refused) return { id: 'error', code: 'full' };
      if (v.replaced) return { id: 'error', code: 'replaced' };
      if (v.error) return { id: 'error', code: v.error.code };
      if (ui.prepErr) return { id: 'error', code: ui.prepErr, soft: true };
      if (v.status === 'idle' || v.status === 'connecting') return { id: 'connecting' };
      if (ui.ended) return { id: 'ended' };
      var tl = v.tl;
      if (tl.status === 'paused') return { id: 'paused' };
      if (tl.status === 'playing') {
        var startsIn = tl.refTime - session.sharedNow();
        if (startsIn > 0) return { id: 'countdown' };
        // the phone refused to start the sound by itself, or this phone arrived after the start (a reload)
        if (player.state === 'blocked' || player.state === 'idle') return { id: 'rejoin' };
        return { id: 'playing' };
      }
      if (!v.peer.present) return { id: role === 'host' ? 'invite' : 'waithost' };
      return { id: 'ready' };
    }

    function badge(who, v) {
      var st;
      if (who === 'you') st = v.self.ready ? 'ready' : 'here';
      else st = v.peer.present ? (v.peer.ready ? 'ready' : 'here') : (v.peer.away ? 'away' : 'waiting');
      var label = { ready: UI.stReady, here: UI.stHere, waiting: UI.stWaiting, away: UI.stAway }[st];
      return '<span class="tg-badge" data-st="' + st + '"><span class="who">' + (who === 'you' ? UI.you : UI.partner) + '</span><span class="st">' + label + '</span></span>';
    }
    function ringsFor(v) {
      var partner = v.peer.present ? (v.peer.ready ? 'ready' : 'here') : 'none';
      return rings(v.self.ready ? 'ready' : 'here', partner);
    }
    function receipt(v) { return '<div class="tg-receipt">' + badge('you', v) + badge('partner', v) + '</div>'; }

    function html(ph, v) {
      var title = '<p class="eyebrow">' + esc(r.title) + '</p>';
      var recNote = ui.prepErr === 'missing' ? '<p class="notice">' + UI.notReady + '</p>' : '';
      switch (ph.id) {
        case 'connecting':
          return title + rings('here', 'none') + '<h1 class="tg-wait">' + UI.opening + '</h1>';
        case 'error':
          return errorPage(ph.code, r);
        case 'invite':
          return title +
            '<h1 class="title tg-h">' + UI.inviteTitle + '</h1>' +
            '<p class="text">' + UI.inviteText + '</p>' +
            '<div class="tg-qr" data-qr></div>' +
            '<div class="tg-link-row">' +
            (navigator.share ? '<button class="btn primary" type="button" data-act="share"><span>' + UI.share + '</span>' + ICON.share + '</button>' : '') +
            '<button class="btn ' + (navigator.share ? 'ghost' : 'primary') + '" type="button" data-act="copy"><span data-copy-label>' + (ui.copied ? UI.copied : UI.copy) + '</span></button>' +
            '</div>' +
            '<p class="tg-linktext" data-link>' + esc(link) + '</p>' +
            rings('here', 'none') +
            '<p class="tg-wait-line">' + UI.almost + '</p>' +
            (v.peer.left ? '<p class="notice">' + UI.partnerLeft + ' ' + '</p>' : '') +
            recNote +
            '<nav class="quiet"><button class="linkish" type="button" data-act="leave"><span>' + UI.cancel + '</span></button></nav>';
        case 'waithost':
          return title + rings('here', 'none') +
            '<h1 class="tg-wait">' + UI.almost + '</h1><p class="text">' + UI.waitHost + '</p>' +
            recNote +
            '<nav class="quiet"><button class="linkish" type="button" data-act="leave"><span>' + UI.leave + '</span></button></nav>';
        case 'ready': {
          var button;
          if (ui.prepErr) button = '';
          else if (!v.self.prep) button = '<button class="btn primary" type="button" disabled><span>' + UI.preparing + '</span></button>' +
            '<div class="tg-bar" aria-hidden="true"><i data-bar></i></div>';
          else if (ui.unlocking) button = '<button class="btn primary" type="button" disabled><span>' + UI.switching + '</span></button>';
          else if (!v.self.ready) button = '<button class="btn primary" type="button" data-act="ready"><span>' + UI.ready + '</span></button>';
          else if (role === 'host' && v.peer.ready) button = '<button class="btn primary" type="button" data-act="begin"' + (v.canBegin ? '' : ' disabled') + '><span>' + UI.beginTogether + '</span>' + arrow() + '</button>';
          else button = '<button class="btn ghost" type="button" disabled><span>' + UI.youReady + '</span></button>';
          var line = '';
          if (v.self.ready && !v.peer.ready) line = '<p class="tg-wait-line">' + UI.waitPartner + '</p>';
          else if (v.self.ready && v.peer.ready && role === 'guest') line = '<p class="tg-wait-line">' + UI.almost + '</p><p class="text">' + UI.waitBegin + '</p>';
          return title + ringsFor(v) +
            '<h1 class="title tg-h">' + UI.bothHere + '</h1>' +
            (v.self.ready ? '' : '<p class="text">' + UI.headphones + '</p>') +
            receipt(v) + '<div class="actions">' + button + '</div>' + line + recNote +
            '<nav class="quiet"><button class="linkish" type="button" data-act="leave"><span>' + UI.leave + '</span></button></nav>';
        }
        case 'countdown':
          return '<p class="eyebrow">' + esc(r.title) + '</p>' +
            '<div class="tg-count" data-count></div>';
        case 'playing':
          return '<p class="eyebrow">' + esc(r.title) + '</p>' +
            rings('here', v.peer.present ? 'here' : 'none') +
            '<div class="tg-progress"><span data-now>0:00</span><div class="tg-line"><i data-line></i></div><span data-total>' + fmt(totalSeconds()) + '</span></div>' +
            '<button class="ctl play" type="button" data-act="pause" aria-label="' + UI.pause + '">' + ICON.pause + '</button>' +
            '<p class="tg-quiet" data-quiet></p>';
        case 'paused': {
          var mine = v.tl.by === session.id;
          return '<p class="eyebrow">' + esc(r.title) + '</p>' + rings('here', v.peer.present ? 'here' : 'none') +
            '<h1 class="tg-wait">' + (mine ? UI.paused : UI.partnerPaused) + '</h1>' +
            '<p class="text">' + UI.pausedText + '</p>' +
            '<div class="actions"><button class="btn primary" type="button" data-act="resume"><span>' + UI.resume + '</span></button></div>' +
            '<nav class="quiet"><button class="linkish" type="button" data-act="leave"><span>' + UI.leave + '</span></button></nav>';
        }
        case 'rejoin': {
          var wait = !player.prepared;
          return '<p class="eyebrow">' + esc(r.title) + '</p>' + rings('here', v.peer.present ? 'here' : 'none') +
            '<h1 class="tg-wait">' + UI.underway + '</h1><p class="text">' + UI.rejoinText + '</p>' +
            '<div class="actions"><button class="btn primary" type="button" data-act="rejoin"' + (wait ? ' disabled' : '') + '><span>' + (wait ? UI.preparing : UI.rejoin) + '</span></button></div>' +
            '<nav class="quiet"><button class="linkish" type="button" data-act="leave"><span>' + UI.leave + '</span></button></nav>';
        }
        case 'ended':
          return rings('here', 'here') + '<h1 class="tg-wait">' + UI.endTitle + '</h1><p class="text">' + UI.endText + '</p>' +
            '<div class="actions"><button class="btn primary" type="button" data-act="done"><span>' + UI.returnTogether + '</span></button></div>';
      }
      return '';
    }

    function totalSeconds() { return player.duration || r.minutes * 60; }

    function render() {
      if (ctl.destroyed) return;
      var v = session.view(), ph = phase();
      if ((v.replaced || v.refused) && !ctl.dead) {      // not our seat any more: stop listening, stop playing, say so
        ctl.dead = true;
        session.destroy(); player.destroy(); releaseWake(ui);
      }
      ui.phaseId = ph.id;
      // awake while waiting (the phone must not lock before the ritual starts), free to sleep while it plays
      if (ph.id === 'playing' || ph.id === 'ended' || ph.id === 'error') releaseWake(ui); else if (!document.hidden) requestWake(ui, ctl);
      var sig = ph.id + '|' + (ph.code || '') + '|' + v.self.ready + v.self.prep + '|' + v.peer.present + v.peer.ready + v.peer.away + v.peer.left + '|' +
        v.canBegin + '|' + ui.unlocking + ui.copied + '|' + v.tl.status + v.tl.by + '|' + (ph.id === 'ready' ? player.prepared : '') + '|' + role;
      setLook(ph.id === 'countdown' || ph.id === 'playing' || ph.id === 'paused' || ph.id === 'rejoin' || ph.id === 'ended' ? 'scene' : 'light');
      if (sig !== ui.sig) {
        ui.sig = sig;
        live.setAttribute('data-phase', ph.id);
        live.innerHTML = html(ph, v);
        if (ph.id === 'invite') drawQr();
        if (ph.id === 'playing') setMedia2();
      }
      tick();
    }

    // things that move every moment: the countdown, the time, the progress
    function tick() {
      var ph = ui.sig.split('|')[0], tl = session.tl;
      if (ph === 'countdown') {
        var box = live.querySelector('[data-count]');
        var left = (tl.refTime - session.sharedNow()) / 1000;
        if (left <= 0) { render(); return; }
        var key = left > 3.4 ? 'wait' : String(Math.ceil(left));
        if (box && box.getAttribute('data-k') !== key) {
          box.setAttribute('data-k', key);
          box.innerHTML = key === 'wait'
            ? '<p class="tg-breathe">' + UI.breathe + '</p><p class="tg-soft">' + UI.beginsSoon + '</p>'
            : '<span class="tg-num">' + key + '</span>';
        }
      } else if (ph === 'playing') {
        var pos = Math.max(0, Math.min(totalSeconds(), Core.positionAt(tl, session.sharedNow())));
        var n = live.querySelector('[data-now]'), line = live.querySelector('[data-line]'), tot = live.querySelector('[data-total]');
        if (n) n.textContent = fmt(pos);
        if (tot) tot.textContent = fmt(totalSeconds());
        if (line) line.style.setProperty('--p', (pos / totalSeconds() * 100).toFixed(2) + '%');
        var v = session.view(), q = live.querySelector('[data-quiet]');
        if (q) q.textContent = v.reconnecting ? UI.reconnecting : (v.peer.left ? UI.partnerLeft + ' ' + UI.partnerLeftText : '');
      } else if (ph === 'ready') {
        var bar = live.querySelector('[data-bar]');
        if (bar) bar.style.setProperty('--p', Math.round(ui.prep * 100) + '%');
      }
    }

    function drawQr() {
      var box = live.querySelector('[data-qr]');
      if (!box) return;
      function paint() {
        var q = window.BMEQR.qrcode(0, 'M');
        q.addData(link); q.make();
        var n = q.getModuleCount(), d = '', m = 2;
        for (var y = 0; y < n; y++) for (var x = 0; x < n; x++) if (q.isDark(y, x)) d += 'M' + (x + m) + ' ' + (y + m) + 'h1v1h-1z';
        box.innerHTML = '<svg viewBox="0 0 ' + (n + 2 * m) + ' ' + (n + 2 * m) + '" role="img" aria-label="QR code with the invitation link" shape-rendering="crispEdges"><path d="' + d + '"/></svg>';
      }
      if (window.BMEQR) paint();
      else window.BMETransport.loadScript(base + 'vendor/qrcode.min.js').then(paint, function () { /* the link below still works */ });
    }

    function setMedia2() {
      if (!('mediaSession' in navigator) || typeof MediaMetadata === 'undefined') return;
      navigator.mediaSession.metadata = new MediaMetadata({ title: r.title, artist: 'Body Mind Earth', album: UI.chooseTitle });
      var set = function (a, fn) { try { navigator.mediaSession.setActionHandler(a, fn); } catch (e) { /* unsupported */ } };
      set('play', function () { session.resume(); });
      set('pause', function () { session.pause(); });
      set('seekbackward', null); set('seekforward', null); set('seekto', null);
    }

    /* what the buttons do */
    live.addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('[data-act]') : null;
      if (!b || b.disabled) return;
      var act = b.getAttribute('data-act');
      if (act === 'ready') {
        ui.unlocking = true; render();
        // this tap is what switches the sound on, on this phone
        player.unlock().then(function () { ui.unlocking = false; session.setReady(true); render(); });
      } else if (act === 'begin') { session.begin(); }
      else if (act === 'pause') { session.pause(); }
      else if (act === 'resume') { session.resume(); }
      else if (act === 'rejoin') { player.rejoin().then(render); }
      else if (act === 'copy') { copyText(link, function () { ui.copied = true; render(); setTimeout(function () { ui.copied = false; render(); }, 2200); }); }
      else if (act === 'share') { try { navigator.share({ title: r.title, text: r.title + ' — ' + UI.chooseTitle, url: link }).catch(function () {}); } catch (err) { /* cancelled */ } }
      else if (act === 'retry') { location.reload(); }
      else if (act === 'leave' || act === 'done') { session.leave(); go('#/together/' + r.id); }
    });

    session.on('change', render);
    session.on('timeline', function (tl) { player.apply(tl); render(); });
    player.on('state', render);
    player.on('attached', render);
    player.on('interrupted', function () { session.pause(); });   // a call, headphones taken out: both pause
    player.on('error', function () { ui.prepErr = 'network'; render(); });
    player.on('state', function (s) { if (s === 'ended') { ui.ended = true; releaseWake(ui); render(); } });
    player.on('state', function (s) { if (s === 'playing') releaseWake(ui); });

    ctl.timer = setInterval(tick, 250);
    window.addEventListener('pagehide', ctl.onHide = function () { try { session.leave(); } catch (e) { /* closing */ } });
    // a page brought back from the browser's memory has lost its session: start afresh
    window.addEventListener('pageshow', ctl.onShow = function (e) { if (e.persisted) location.reload(); });
    // the screen lock is let go whenever the page is hidden; take it again when it is back (while waiting)
    document.addEventListener('visibilitychange', ctl.onWake = function () {
      if (!document.hidden && !ctl.destroyed && ui.phaseId !== 'playing' && ui.phaseId !== 'ended' && ui.phaseId !== 'error') requestWake(ui, ctl);
    });

    player.prepare(function (p) { ui.prep = p; tick(); }).then(function () {
      session.setPrepared(true); render();
    }, function (e) {
      ui.prepErr = e && e.code === 'missing' ? 'missing' : 'network';
      render();
    });
    session.start();
    render();
  }

  function sessionUnmount(ctl) {
    ctl.destroyed = true;
    clearInterval(ctl.timer);
    if (ctl.onHide) window.removeEventListener('pagehide', ctl.onHide);
    if (ctl.onShow) window.removeEventListener('pageshow', ctl.onShow);
    if (ctl.onWake) document.removeEventListener('visibilitychange', ctl.onWake);
    if (ctl.session) ctl.session.leave();
    if (ctl.player) ctl.player.destroy();
    if (ctl.ui) releaseWake(ctl.ui);
    document.removeEventListener('visibilitychange', onVisibility);
    if ('mediaSession' in navigator) {
      try { navigator.mediaSession.playbackState = 'none'; ['play', 'pause'].forEach(function (a) { navigator.mediaSession.setActionHandler(a, null); }); } catch (e) { /* ok */ }
    }
    if (window.__tg) delete window.__tg;
    removeScene();
    clearLook();
  }

  function requestWake(ui, ctl) {
    try {
      if (ui.wake || ui.wakeBusy || !(navigator.wakeLock && navigator.wakeLock.request)) return;
      ui.wakeBusy = true;
      navigator.wakeLock.request('screen').then(function (l) {
        ui.wakeBusy = false;
        if (ctl && ctl.destroyed) { try { l.release(); } catch (e) { /* ok */ } return; }   // the screen was left meanwhile
        ui.wake = l;
        l.addEventListener('release', function () { if (ui.wake === l) ui.wake = null; });
      }, function () { ui.wakeBusy = false; /* fine without */ });
    } catch (e) { ui.wakeBusy = false; }
  }
  function releaseWake(ui) {
    try { if (ui.wake) { var l = ui.wake; ui.wake = null; l.release(); } } catch (e) { /* ok */ }
  }

  function copyText(text, done) {
    function fallback() {
      var t = document.createElement('textarea');
      t.value = text; t.setAttribute('readonly', '');
      t.className = 'tg-offscreen';
      document.body.appendChild(t); t.select();
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (e) { /* nothing more to try */ }
      t.remove();
      if (ok) done();
    }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, fallback);
    else fallback();
  }

  /* ——— the door from app.js ——— */

  // parts: ['together', ...]  ->  { title, kind, html, look, mount?, unmount?, scene? }
  function screen(parts) {
    var d = data();
    if (!d || !Core || !P) return null;
    var a = parts[1];
    if (!a) return landing();
    if (a === 'rituals') return choose();
    if (a === 'solo') { var rs = ritual(parts[2]); return rs ? soloPage(rs) : choose(); }
    if (a === 'host' || a === 'join') {
      var rr = ritual(parts[2]);
      if (!rr) return choose();
      return sessionPage(a === 'host' ? 'host' : 'guest', rr, parts[3] || '', parts[4] || '');
    }
    var r = ritual(a);
    return r ? ritualPage(r) : landing();
  }

  // Called by app.js when a Together screen is on show: sets the colours and the water-light behind it.
  function enter(page) {
    setLook(page.look || 'light');
    if (page.scene) { addScene(); document.addEventListener('visibilitychange', onVisibility); }
    else { removeScene(); }
  }
  // Called by app.js when any other screen is shown: put the sanctuary's own look back.
  function clear() { clearLook(); removeScene(); document.removeEventListener('visibilitychange', onVisibility); }

  window.BMETogether = { screen: screen, tabs: tabs, enter: enter, clear: clear, available: function () { return !!data() && !!Core && !!P; } };
})();
