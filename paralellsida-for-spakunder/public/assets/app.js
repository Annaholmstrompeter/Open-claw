/*
 * Body Mind Earth — Sensory Ritual
 * A deliberately small router and player. No dependencies, no network calls except the recording
 * itself, no tracking, nothing stored. The rituals are heard, never read: a ritual opens on a
 * picture and one line from the meditation, and starts to play.
 * All words come from content.js (see tools/build-content.py); all pictures come from the labels.
 *
 * Routes (hash based, so the browser's back button always works):
 *   #/                      welcome
 *   #/rituals               choose your ritual
 *   #/r/<id>                a ritual: the product, its affirmation, ingredients
 *   #/r/<id>/s              the short ritual, playing      (/e = the extended ritual)
 *   #/r/<id>/done           the quiet ending
 *   #/about                 Sensory Enrichment (with the spoken introduction)
 *   #/close                 closing: back to the sanctuary
 *   #/together/…            TOGETHER, a ritual for two: its own module (assets/together/), see together.js
 */
(function () {
  'use strict';

  var DATA = window.SANCTUARY;
  var stage = document.getElementById('stage');
  var menu = document.getElementById('menu');
  var menuBtn = document.getElementById('menu-btn');
  var themeMeta = document.querySelector('meta[name="theme-color"]');
  // A spa's own page (?s=<name>): its picture, its name, its thanks and its way to book. Nothing else changes.
  var SPA = window.BME_SPA && window.BME_SPA.name ? window.BME_SPA : null;
  var PAPER = '#fff7e9';
  var NIGHT = '#1b140e';   // the ground where the ritual is heard
  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Interface words only. Everything the guest reads about the products is in content.js.
  var UI = {
    brand: 'Body Mind Earth',
    sub: 'Sensory Ritual',
    footline: 'Rituals for a more present you',
    frontEyebrow: 'Sensory Enrichment Skincare',
    frontTitle: 'The Art of Conscious Care',
    frontText: 'Natural skincare with guided sensory rituals, bringing moments of conscious care into your everyday life.',
    discover: 'Discover the Rituals',
    chooseTitle: 'Choose your ritual',
    enterRitual: 'Enter the ritual',
    aboutLink: 'About Sensory Enrichment',
    home: 'Home',
    back: 'Back',
    allRituals: 'All rituals',
    aboutProduct: 'About the product',
    minShort: 'min',
    soon: 'Soon',
    spaWelcome: 'Welcome to',
    spaBook: 'Experience the ritual at',
    spaBookShort: 'Experience it at the spa',
    spaMenuBook: 'Book a visit',
    spaShop: 'Refill your products',
    spaMenuShop: 'Refill products',
    spaInstall: 'Add to your phone',
    installTitle: 'Keep this sanctuary|on your phone',
    installLead: 'Add it to your home screen and return to your rituals with one tap, wherever you are.',
    installAlready: 'You are already using it from your home screen.',
    installAndroid: 'Tap the button, then “Install”.',
    installAndroidMenu: 'Open the browser menu (the three dots) and choose “Install app” or “Add to Home screen”.',
    installIosStep1: 'Tap the share icon',
    installIosStep1b: 'in your browser’s bar.',
    installIosStep2: 'Choose “Add to Home Screen”.',
    installIosStep3: 'Tap “Add”.',
    installIosDone: 'Then find it waiting on your home screen.',
    installDone: 'Added to your home screen',
    sheetTitle: 'Keep this sanctuary|on your phone',
    sheetText: 'One tap, and it is always with you.',
    sheetIos1: 'Tap the share icon',
    sheetIos2: 'in your browser’s bar, then “Add to Home Screen”.',
    sheetGotIt: 'Got it',
    installInApp: 'This page is open inside another app. Open it in Safari (iPhone) or Chrome (Android) to add it to your home screen.',
    installOther: 'Open this page on your phone to add it to the home screen.',
    aboutEyebrow: 'Sensory Enrichment',
    closeLink: 'Close your visit',
    shortRitual: 'Short ritual',
    extended: 'Extended ritual',
    theRitual: 'The ritual',
    formulaTitle: 'Formula',
    activesTitle: 'Actives',
    vegan: 'Vegan formula',
    ingredientsTitle: 'Ingredients',
    ingredientsSummary: 'Formula & ingredients',
    reminder: 'A reminder of the world we share',
    play: 'Play',
    pause: 'Pause',
    beginAgain: 'Begin again',
    back15: 'Back 15 seconds',
    back15Cap: '15 s back',
    position: 'Position',
    listenIntro: 'Listen to the introduction',
    missing: 'This recording is not available yet.',
    listenAgain: 'Listen again',
    nextRitual: 'Next ritual',
    returnRituals: 'Return to the rituals',
    closeTitle: 'Return to your sanctuary,|whenever you wish.',
    closeText: 'You can return to this feeling whenever you need it throughout your day.',
    install: 'Add to home screen',
    iosHint: 'On iPhone: tap the share icon, then “Add to Home Screen”.',
    privacyTitle: 'Privacy',
    privacy: 'This sanctuary keeps nothing about you. No cookies, no accounts, no tracking.'
  };

  // the way to book at the spa: its own page, told where the guest came from (so the spa sees what the ritual brings)
  function bookHref() {
    var u = SPA && SPA.bookUrl || '';
    if (!u || /^(tel|mailto):/.test(u)) return u;
    return u + (u.indexOf('?') < 0 ? '?' : '&') + 'utm_source=bodymindearth&utm_medium=ritual&utm_campaign=' + encodeURIComponent(SPA.slug || 'spa');
  }
  // the way to refill: the spa's own shop, else the house shop (if it can take orders); told which spa the guest came from
  function shopHref() {
    if (!SPA) return '';
    var own = SPA.shopUrl || '';
    var u = own || window.BME_HOUSE_SHOP || '';
    if (!u) return '';
    if (/^(tel|mailto):/.test(u)) return u;
    return u + (u.indexOf('?') < 0 ? '?' : '&') + 'utm_source=bodymindearth&utm_medium=ritual&utm_content=refill&utm_campaign=' + encodeURIComponent(SPA.slug || 'spa');
  }
  function shopLink(cls) {
    var h = shopHref();
    return h ? '<a class="' + cls + '" href="' + esc(h) + '" target="_blank" rel="noopener noreferrer"><span>' + UI.spaShop + '</span></a>' : '';
  }
  function installLink() {
    if (!SPA) return '';
    if (addedToHome) return '<span class="install-done" role="status">' + UI.installDone + '</span>';
    return !isStandalone() ? '<a href="#/install" data-install-go><span>' + UI.spaInstall + '</span></a>' : '';
  }
  function spaMark() {
    return SPA.logo ? '<img class="spa-logo" src="' + esc(SPA.logo) + '" alt="' + esc(SPA.name) + '">' : '<span class="spa-name">' + esc(SPA.name) + '</span>';
  }
  function bookLink(cls, short) {
    return SPA && SPA.bookUrl
      ? '<a class="' + cls + '" href="' + esc(bookHref()) + '" target="_blank" rel="noopener noreferrer"><span>' + (short ? UI.spaBookShort : UI.spaBook + ' ' + esc(SPA.name)) + '</span></a>'
      : '';
  }
  function spaDemoNote() { return SPA && SPA.demo ? '<p class="spa-demo">' + esc(SPA.name) + ' is a fictional example.</p>' : ''; }

  function br(s) { return s.split('|').join('<br>'); }
  function plain(s) { return s.split('|').join(' '); }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  // Escapes text for display; a dash never starts a line (it stays with the word before it).
  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/ — /g, ' — ');
  }
  function img(src, cls, alt) {
    return '<img' + (cls ? ' class="' + cls + '"' : '') + ' src="' + src + '" alt="' + (alt || '') + '" decoding="async">';
  }
  function logo(cls) { return img(DATA.logo, cls || 'mark'); }
  function arrow() {
    return '<svg class="arr" viewBox="0 0 24 12" aria-hidden="true"><path d="M1 6h21M17 1l5 5-5 5"/></svg>';
  }
  // "Body Mind Earth" with the three gold letters of the label wordmark.
  function wordmark() { return 'B<i>O</i>DY MI<i>N</i>D <i>E</i>ARTH'; }
  function fmt(s) {
    if (!isFinite(s) || s < 0) return '–:––';
    var m = Math.floor(s / 60), r = Math.floor(s % 60);
    return m + ':' + (r < 10 ? '0' : '') + r;
  }

  function ritualById(id) {
    for (var i = 0; i < DATA.rituals.length; i++) if (DATA.rituals[i].id === id) return DATA.rituals[i];
    return null;
  }

  /* ——— the recording: one audio element for the whole visit ———
     It is started inside the guest's tap (so phones allow it), then the screen follows it. */
  var audio = new Audio();
  audio.preload = 'metadata';
  var session = null; // { kind: 'ritual' | 'intro', id, mode, src, failed }
  var view = null;    // the player controls on the screen right now

  var ICON = {
    play: '<svg class="i-play" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.2l11 6.8-11 6.8z"/></svg>',
    pause: '<svg class="i-pause" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5h3.4v14H7zM13.6 5H17v14h-3.4z"/></svg>',
    restart: '<svg viewBox="0 0 24 24" aria-hidden="true" class="i-line"><path d="M4.5 12a7.5 7.5 0 1 0 2.4-5.5M4.5 4.5v4.4h4.4"/></svg>'
  };

  function target(spec) {
    if (spec === 'intro') return { kind: 'intro', id: 'intro', mode: 'intro', src: DATA.introAudio };
    var p = spec.split(':');
    var r = ritualById(p[0]);
    if (!r || !r.audio[p[1]]) return null;
    return { kind: 'ritual', id: p[0], mode: p[1], src: r.audio[p[1]].src };
  }

  function select(t) {
    if (session && session.src === t.src) return false;
    session = t;
    session.failed = false;
    audio.src = t.src;
    return true;
  }

  function startListening(spec, keepPlace) {
    var t = target(spec);
    if (!t) return;
    var changed = select(t);
    if (!changed && !keepPlace) { try { audio.currentTime = 0; } catch (e) { /* not ready yet */ } }
    var p = audio.play();
    if (p && p.catch) p.catch(refresh);
    setMediaSession();
    refresh();
  }

  function stopListening() {
    audio.pause();
    if (session) { audio.removeAttribute('src'); audio.load(); }
    session = null;
    view = null;
    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'none';
  }

  function togglePlay() {
    if (!session) return;
    if (audio.paused) {
      var p = audio.play();
      if (p && p.catch) p.catch(refresh);
    } else {
      audio.pause();
    }
  }

  function seekTo(seconds) {
    if (!isFinite(audio.duration)) return;
    audio.currentTime = Math.max(0, Math.min(audio.duration, seconds));
  }

  function refresh() {
    if (!view) return;
    var playing = !!session && !session.failed && !audio.paused && !audio.ended;
    var state = playing ? 'playing' : 'paused';
    if (view.root) view.root.setAttribute('data-state', state);
    if (view.toggle) {
      view.toggle.setAttribute('data-state', state);
      view.toggle.setAttribute('aria-label', playing ? UI.pause : UI.play);
    }
    var dur = audio.duration;
    if (view.now) view.now.textContent = fmt(audio.currentTime || 0);
    if (view.total) view.total.textContent = fmt(dur);
    if (view.range && !view.dragging && isFinite(dur) && dur > 0) {
      var v = Math.round((audio.currentTime / dur) * 1000);
      view.range.value = v;
      view.range.style.setProperty('--p', (v / 10) + '%');
    }
    if (view.notice) view.notice.hidden = !(session && session.failed);
  }

  ['play', 'pause', 'timeupdate', 'loadedmetadata', 'durationchange', 'seeked', 'playing', 'waiting'].forEach(function (ev) {
    audio.addEventListener(ev, refresh);
  });
  audio.addEventListener('error', function () {
    if (session) session.failed = true;
    refresh();
  });
  audio.addEventListener('ended', function () {
    if (session && session.kind === 'ritual') {
      navigate('#/r/' + session.id + '/done');
    } else {
      refresh();
    }
  });

  function setMediaSession() {
    if (!('mediaSession' in navigator) || !session || typeof MediaMetadata === 'undefined') return;
    var title = session.kind === 'intro'
      ? UI.aboutEyebrow + ' — Introduction'
      : cap(session.id) + ' — ' + (session.mode === 'extended' ? UI.extended : UI.shortRitual);
    navigator.mediaSession.metadata = new MediaMetadata({
      title: title,
      artist: UI.brand,
      album: UI.sub,
      artwork: [{ src: DATA.logo, sizes: '239x237', type: 'image/webp' }]
    });
    var set = function (a, fn) { try { navigator.mediaSession.setActionHandler(a, fn); } catch (e) { /* unsupported */ } };
    set('play', togglePlay);
    set('pause', togglePlay);
    set('seekbackward', function () { seekTo(audio.currentTime - 15); });
    set('seekforward', function () { seekTo(audio.currentTime + 15); });
    set('seekto', function (d) { if (d && typeof d.seekTime === 'number') seekTo(d.seekTime); });
  }

  // Connect the buttons on the screen to the recording.
  function bindPlayer() {
    var root = stage.querySelector('[data-player]');
    if (!root) { view = null; return; }
    view = {
      root: root,
      toggle: root.querySelector('[data-toggle]'),
      now: root.querySelector('[data-now]'),
      total: root.querySelector('[data-total]'),
      range: root.querySelector('[data-range]'),
      notice: root.querySelector('[data-notice]'),
      dragging: false
    };
    if (view.toggle && !view.toggle.hasAttribute('data-listen')) view.toggle.addEventListener('click', togglePlay);
    var again = root.querySelector('[data-restart]');
    if (again) again.addEventListener('click', function () { seekTo(0); if (audio.paused) togglePlay(); });
    var back = root.querySelector('[data-back15]');
    if (back) back.addEventListener('click', function () { seekTo(audio.currentTime - 15); });
    if (view.range) {
      view.range.addEventListener('input', function () {
        view.dragging = true;
        if (isFinite(audio.duration)) seekTo((view.range.value / 1000) * audio.duration);
        view.range.style.setProperty('--p', (view.range.value / 10) + '%');
        if (view.now) view.now.textContent = fmt(audio.currentTime);
      });
      view.range.addEventListener('change', function () { view.dragging = false; });
    }
    // reached by address (a reload): get the recording ready, ask for a tap to begin
    var spec = root.getAttribute('data-player');
    var t = target(spec);
    if (t && (!session || session.src !== t.src)) { select(t); setMediaSession(); }
    refresh();
  }

  /* ——— install to home screen (Android prompt, iOS hint) ——— */
  var installEvent = null;
  var addedToHome = false;   // set when the phone says the app is on the home screen
  var sheetDismissed = false; // the guest has answered (said no in the phone's own dialog, or "Got it" on iPhone): not asked again until the page is opened anew (nothing is stored on the phone)
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    installEvent = e;
    var slot = stage.querySelector('[data-install]');
    if (slot) slot.innerHTML = installButton();
    var note = stage.querySelector('[data-install-note]');
    if (note) note.hidden = true;
    bindInstall();
    syncInstallSheet();
  });
  function installButton() {
    return installEvent ? '<button class="btn ghost" type="button" data-install-btn>' + UI.install + '</button>' : '';
  }
  function bindInstall() {
    var b = stage.querySelector('[data-install-btn]');
    if (!b || !installEvent) return;
    b.addEventListener('click', runInstall);
  }
  // ONE tap installs: the browser's own install dialog at once (the install sheet on the front page, and the "Add to your phone" links
  // after the ritual and in the menu, all come here directly when the browser offers it; the install page is only the way for the
  // phones that need steps). Whichever browser the guest is in installs it: Chrome makes a real app; a browser that can only make a
  // shortcut (Brave) puts its own badge on the icon. Handing over to another browser is not done: Android then always asks the guest
  // to "choose activity", and a web page cannot hide that.
  function runInstall() {
    var ev = installEvent;
    if (!ev) return;
    var own = function () {
      if (!installEvent) return;
      var e2 = installEvent;
      installEvent = null;
      var bs = document.querySelectorAll('[data-install-btn]');
      for (var i = 0; i < bs.length; i++) bs[i].hidden = true;
      try { var r = e2.prompt(); if (r && r.catch) r.catch(function () { /* declined */ }); } catch (err) { /* nothing to show */ }
      if (e2.userChoice && e2.userChoice.then) {
        e2.userChoice.then(function (c) {
          if (c && c.outcome === 'accepted') installedNow();
          else { sheetDismissed = true; syncInstallSheet(); }
        }, function () { /* no answer: the guest stays */ });
      }
    };
    own();
  }
  // It worked: nothing more asks for it, and the guest lands on the front page, where the "Add to your phone" link has turned into a
  // quiet "Added to your home screen". (Otherwise the page looks the same and the guest keeps tapping, not knowing it worked.)
  function installedNow() {
    if (addedToHome) return;
    addedToHome = true;
    installEvent = null;
    var gone = document.querySelectorAll('[data-install-btn], #menu [data-install-go]');
    for (var i = 0; i < gone.length; i++) gone[i].hidden = true;
    if (route === '#/') { shown = null; show(); } else navigate('#/');
    syncInstallSheet();
    notify(UI.installDone);
  }
  window.addEventListener('appinstalled', installedNow);
  // a short, clear word that something happened: it stays a few seconds, then goes by itself
  // The install sheet: the first thing a guest meets on a spa's front page, so the page is on the phone before it can be lost with the
  // QR code. Android offers the browser's own install at one tap; iPhone cannot be asked, so it says where to tap. Not inside another
  // app's browser (it cannot install), not once installed, not after the guest has answered, and only on the front page.
  function sheetMode() {
    if (!SPA || addedToHome || sheetDismissed || isStandalone() || inAppBrowser()) return '';
    if (!activePage || activePage.kind !== 'welcome') return '';
    if (installEvent) return 'go';
    return isIOSDevice() ? 'ios' : '';
  }
  function syncInstallSheet() {
    var mode = sheetMode();
    var el = document.getElementById('install-sheet');
    if (!mode) {
      if (el && el.parentNode) el.parentNode.removeChild(el);
      document.documentElement.removeAttribute('data-sheet');
      return;
    }
    if (el && el.getAttribute('data-mode') === mode) return;
    if (el && el.parentNode) el.parentNode.removeChild(el);
    el = document.createElement('div');
    el.id = 'install-sheet';
    el.className = 'install-sheet';
    el.setAttribute('role', 'region');
    el.setAttribute('aria-label', plain(UI.sheetTitle));
    el.setAttribute('data-mode', mode);
    var share = '<svg class="install-share" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15V3M8 7l4-4 4 4M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1"/></svg>';
    el.innerHTML =
      '<h2 class="sheet-title">' + br(UI.sheetTitle) + '</h2>' +
      (mode === 'go'
        ? '<p class="sheet-text">' + UI.sheetText + '</p>' +
          '<button class="btn primary" type="button" data-install-go><span>' + UI.install + '</span></button>'
        : '<p class="sheet-text">' + UI.sheetIos1 + ' ' + share + ' ' + UI.sheetIos2 + '</p>' +
          '<button class="sheet-close" type="button" data-sheet-close>' + UI.sheetGotIt + '</button>');
    document.body.appendChild(el);
    document.documentElement.setAttribute('data-sheet', mode);
    // the welcome picture first, then the sheet rises
    setTimeout(function () { el.className = 'install-sheet on'; }, reduced ? 20 : 1100);
  }
  function notify(text) {
    var t = document.createElement('div');
    t.className = 'toast';
    t.setAttribute('role', 'status');
    t.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg><span>' + esc(text) + '</span>';
    document.body.appendChild(t);
    setTimeout(function () { t.className = 'toast on'; }, 40);
    setTimeout(function () {
      t.className = 'toast';
      setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 700);
    }, 5000);
  }
  function isStandalone() {
    return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone === true;
  }
  function isIOS() {
    return isIOSDevice() && !isStandalone();
  }
  function isIOSDevice() {
    return /iphone|ipad|ipod/i.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
  }
  function isAndroid() { return /android/i.test(navigator.userAgent); }
  // a page opened inside another app's own browser (LinkedIn, Instagram, Facebook ...) cannot be added to the home screen
  function inAppBrowser() { return /FBAN|FBAV|Instagram|LinkedInApp|Snapchat|TikTok|MicroMessenger|Line\/|; wv\)/i.test(navigator.userAgent); }

  /* ——— the menu: three places, nothing else ——— */
  if (SPA && SPA.bookUrl) {
    var menuBook = document.createElement('a');
    menuBook.href = bookHref();
    menuBook.target = '_blank';
    menuBook.rel = 'noopener noreferrer';
    menuBook.textContent = UI.spaMenuBook;
    menu.appendChild(menuBook);
  }
  if (shopHref()) {
    var menuShop = document.createElement('a');
    menuShop.href = shopHref();
    menuShop.target = '_blank';
    menuShop.rel = 'noopener noreferrer';
    menuShop.textContent = UI.spaMenuShop;
    menu.appendChild(menuShop);
  }
  if (SPA && !isStandalone()) {
    var menuInstall = document.createElement('a');
    menuInstall.href = '#/install';
    menuInstall.setAttribute('data-install-go', '');
    menuInstall.textContent = UI.spaInstall;
    menu.appendChild(menuInstall);
  }
  // the name under the icon on the phone's home screen is the spa's
  if (SPA) {
    var appTitle = document.querySelector('meta[name="apple-mobile-web-app-title"]');
    if (appTitle) appTitle.setAttribute('content', SPA.shortName || SPA.name);
  }

  function setMenu(open) {
    menu.hidden = !open;
    menuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) {
      var first = menu.querySelector('a');
      if (first) first.focus();
    } else {
      menuBtn.focus({ preventScroll: true });
    }
  }
  menuBtn.addEventListener('click', function () { setMenu(menu.hidden); });
  document.getElementById('menu-close').addEventListener('click', function () { setMenu(false); });
  window.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !menu.hidden) setMenu(false);
  });

  /* ——— screens ———
     Each returns { title, kind, html }. 'kind' drives the look (see style.css):
     welcome, list, intro (the ritual's own quiet page), player and end (full colour ground), about, close. */

  function photo() { return '<div class="photo" aria-hidden="true"></div>'; }

  // TOGETHER is a separate module; the sanctuary works the same without it.
  function tgTabs(active) { return window.BMETogether && window.BMETogether.available() ? window.BMETogether.tabs(active) : ''; }

  // The front page: a calm header, one photograph, a few words, one door. No shop.
  function welcome() {
    if (SPA) {
      return {
        title: SPA.name + ' — ' + UI.brand,
        kind: 'welcome',
        html:
          '<section class="screen front front-spa">' +
          '<div class="front-photo spa-photo" aria-hidden="true"><img src="' + esc(SPA.hero) + '" alt="" width="1500" height="1364" decoding="async">' +
          '<div class="spa-welcome"><p class="spa-welcome-eyebrow">' + UI.spaWelcome + '</p>' + spaMark() + '</div></div>' +
          '<div class="front-copy">' +
          '<p class="eyebrow">' + UI.frontEyebrow + '</p>' +
          '<h1 class="front-title">' + UI.frontTitle + '</h1>' +
          '<p class="text">' + UI.frontText + '</p>' +
          '<a class="btn primary" href="#/rituals"><span>' + UI.discover + '</span>' + arrow() + '</a>' +
          '<nav class="quiet front-menu" aria-label="' + UI.aboutEyebrow + '"><a href="#/about"><span>' + UI.aboutLink + '</span></a>' + bookLink('', true) + installLink() + '</nav>' +
          spaDemoNote() +
          '</div></section>'
      };
    }
    return {
      title: UI.brand + ' — ' + UI.sub,
      kind: 'welcome',
      html:
        '<section class="screen front">' +
        '<div class="front-photo" aria-hidden="true"></div>' +
        '<div class="front-copy">' +
        '<p class="eyebrow">' + UI.frontEyebrow + '</p>' +
        '<h1 class="front-title">' + UI.frontTitle + '</h1>' +
        '<p class="text">' + UI.frontText + '</p>' +
        '<a class="btn primary" href="#/rituals"><span>' + UI.discover + '</span>' + arrow() + '</a>' +
        '<nav class="quiet front-menu" aria-label="' + UI.aboutEyebrow + '"><a href="#/about"><span>' + UI.aboutLink + '</span></a></nav>' +
        '</div></section>'
    };
  }

  // The picture the guest was last looking at: back from a ritual, the carousel is where it was left.
  var lastSlide = 0;

  // Choose your ritual: one large picture at a time in a thin pale frame, the name over it, dots below, one button.
  // Nothing else on the page (the menu has the rest).
  function rituals() {
    var slides = DATA.rituals.map(function (r, i) {
      return '<li class="rc-slide" data-c="' + r.id + '">' +
        '<a class="rc-frame" href="#/r/' + r.id + '" aria-label="' + cap(r.id) + ', ' + esc(r.kind) + ', ' + esc(r.scent) + '">' +
        '<span class="rc-photo"><img src="' + r.img.photo + '" alt="" width="900" height="1125" decoding="async"' + (i ? ' loading="lazy"' : '') + '>' +
        '<span class="rc-name">' + r.id + '</span></span></a>' +
        '<p class="rc-kind">' + esc(r.kind) + ' · ' + esc(r.scent) + '</p>' +
        '</li>';
    }).join('');
    var dots = DATA.rituals.map(function (r, i) {
      return '<button class="rc-dot" type="button" data-rc-dot="' + i + '" aria-label="' + cap(r.id) + '"></button>';
    }).join('');
    return {
      title: UI.chooseTitle + ' — ' + UI.brand,
      kind: 'list',
      back: '#/',
      mount: bindCarousel,
      html:
        '<section class="screen top-aligned rituals-screen">' +
        '<h1 class="sr-only">' + UI.chooseTitle + '</h1>' +
        '<div class="rc" role="region" aria-roledescription="carousel" aria-label="' + UI.chooseTitle + '">' +
        '<ul class="rc-track" data-rc-track tabindex="0">' + slides + '</ul>' +
        '<div class="rc-dots" data-rc-dots>' + dots + '</div></div>' +
        '<a class="rc-cta" data-rc-cta href="#/r/' + DATA.rituals[0].id + '"><span>' + UI.enterRitual + '</span>' + arrow() + '</a>' +
        '</section>'
    };
  }

  // Swipe (or use the dots): the dot of the picture in view is lit, and the button below goes to that ritual.
  function bindCarousel(root) {
    var track = root.querySelector('[data-rc-track]');
    if (!track) return;
    var slides = track.children, dots = root.querySelectorAll('[data-rc-dot]'), cta = root.querySelector('[data-rc-cta]');
    var frame = null;
    function left(i) { return slides[i].offsetLeft - slides[0].offsetLeft; }
    function go(i, smooth) { track.scrollTo({ left: left(i), behavior: smooth && !reduced ? 'smooth' : 'auto' }); }
    function mark() {
      var best = 0, gap = Infinity;
      for (var i = 0; i < slides.length; i++) {
        var d = Math.abs(left(i) - track.scrollLeft);
        if (d < gap) { gap = d; best = i; }
      }
      lastSlide = best;
      for (var j = 0; j < dots.length; j++) dots[j].setAttribute('aria-current', j === best ? 'true' : 'false');
      cta.setAttribute('href', '#/r/' + DATA.rituals[best].id);
    }
    track.addEventListener('scroll', function () {
      if (!frame) frame = requestAnimationFrame(function () { frame = null; mark(); });
    }, { passive: true });
    for (var k = 0; k < dots.length; k++) {
      (function (i) { dots[i].addEventListener('click', function () { go(i, true); }); })(k);
    }
    go(lastSlide, false);
    mark();
  }

  // The cream middle panel of the label: formula, actives, ingredients, origin.
  function labelCard(r) {
    var actives = r.actives
      ? '<h3>' + UI.activesTitle + '</h3><p>' + r.actives.map(esc).join(' · ') + '</p>'
      : '';
    return '<div class="label-card">' +
      '<h3>' + UI.formulaTitle + '</h3><p>' + esc(r.formula) + '</p>' +
      actives +
      (r.vegan ? '<p class="vegan">' + UI.vegan + '</p>' : '') +
      '<h4>' + UI.ingredientsTitle + '</h4><p class="inci">' + esc(r.ingredients) + '</p>' +
      '<p class="origin">' + esc(r.natural) + '</p>' +
      (r.labCreated ? '<p class="lab">' + esc(r.labCreated) + '</p>' : '') +
      (r.footnote ? '<p class="foot">' + esc(r.footnote) + '</p>' : '') +
      '</div>';
  }

  // "A reminder of the world we share": the species engraved on the label.
  function speciesCard(r) {
    var sp = r.species;
    return '<aside class="species">' +
      '<div class="sp-body">' +
      '<div class="sp-text"><p class="sp-name">' + esc(sp.name) + '</p><p class="sp-latin">' + esc(sp.latin) + '</p>' +
      '<p class="sp-note">' + sp.note.map(esc).join('<br>') + '</p></div>' +
      img(r.img.species, 'sp-art') +
      '</div>' +
      '<p class="reminder">' + UI.reminder + '</p>' +
      '</aside>';
  }

  function playMark() { return '<svg class="ri-play" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.2l11 6.8-11 6.8z"/></svg>'; }
  function homeLink() { return '<a href="#/"><span>' + UI.home + '</span></a>'; }

  // One section of the ritual's page: a title that opens and closes.
  function section(title, body, open) {
    return '<details class="rd"' + (open ? ' open' : '') + '><summary>' + title + '</summary><div class="rd-body">' + body + '</div></details>';
  }

  // A ritual: the same quiet page as the carousel. The picture, what it is, two ways to listen, then what to read.
  function ritualIntro(r) {
    function mins(a) { return a.min ? '<em>' + Math.round(a.min) + ' ' + UI.minShort + '</em>' : ''; }
    // both lengths are always there; one whose recording is not in yet is shown, but quiet and not pressable (no button leads to silence)
    var first = true;
    var listen = '<div class="ri-listen">' + [['short', UI.shortRitual, 's'], ['extended', UI.extended, 'e']].map(function (L) {
      var a = r.audio[L[0]];
      if (!a.ready) return '<span class="ri-btn ri-off" aria-disabled="true">' + playMark() + '<span>' + L[1] + '</span><em>' + UI.soon + '</em></span>';
      var cls = first ? ' primary' : '';
      first = false;
      return '<a class="ri-btn' + cls + '" data-listen="' + r.id + ':' + L[0] + '" href="#/r/' + r.id + '/' + L[2] + '">' + playMark() + '<span>' + L[1] + '</span>' + mins(a) + '</a>';
    }).join('') + '</div>';
    // the three ritual lines of the label, read as one short passage
    var prose = [r.rows.scent, r.rows.touch, r.rows.feel].map(esc).join(' ');
    var facts =
      '<p>' + esc(r.tone) + ' · with ' + r.with.map(esc).join(' · ') + '</p>' +
      '<p>' + esc(r.size) + '</p>' +
      '<p>' + (r.vegan ? UI.vegan + ' · ' : '') + esc(r.natural) + '</p>';
    return {
      title: cap(r.id) + ' — ' + UI.brand,
      kind: 'intro',
      back: '#/rituals',
      html:
        '<section class="screen top-aligned intro">' +
        '<div class="ri-hero"><div class="rc-frame"><div class="rc-photo">' +
        '<img src="' + r.img.photo + '" alt="" width="900" height="1125" decoding="async">' +
        '<h1 class="rc-name">' + r.id + '</h1></div></div></div>' +
        '<div class="ri-body">' +
        '<p class="rc-kind">' + esc(r.kind) + ' · ' + esc(r.scent) + '</p>' +
        '<p class="ri-aff">' + esc(r.affirmation) + '</p>' +
        listen +
        '<div class="ri-more">' +
        section(UI.aboutProduct, facts, true) +
        section(UI.theRitual, '<p>' + prose + '</p>') +
        section(UI.ingredientsSummary, labelCard(r)) +
        '</div>' +
        '<nav class="quiet">' + homeLink() + '</nav>' +
        '</div></section>'
    };
  }

  // The ritual, heard: the product's photograph rising out of the dark, the name, one line from the recording,
  // the line to drag, and one button, and a Back to the ritual's page (to choose the other length). The menu has the way home.
  function player(r, mode) {
    var key = mode === 'e' ? 'extended' : 'short';
    var a = r.audio[key];
    return {
      title: cap(r.id) + ' — ' + UI.brand,
      kind: 'player',
      back: '#/r/' + r.id,
      html:
        '<section class="screen player" data-player="' + r.id + ':' + key + '" data-state="paused">' +
        '<div class="pl-hero" aria-hidden="true"><img src="' + r.img.photo + '" alt="" width="900" height="1125" decoding="async"></div>' +
        '<h1 class="pl-name">' + r.id + '</h1>' +
        '<p class="eyebrow">' + (key === 'extended' ? UI.extended : UI.shortRitual) + '</p>' +
        '<blockquote class="quote"><p>“' + esc(a.quote) + '”</p></blockquote>' +
        '<div class="deck">' +
        '<div class="seek"><span class="t" data-now>0:00</span>' +
        '<input class="range" type="range" min="0" max="1000" step="1" value="0" data-range aria-label="' + UI.position + '">' +
        '<span class="t" data-total>–:––</span></div>' +
        '<div class="controls">' +
        '<button class="ctl play" type="button" data-toggle data-state="paused" aria-label="' + UI.play + '">' + ICON.play + ICON.pause + '</button>' +
        '</div>' +
        '<p class="notice" data-notice hidden>' + UI.missing + '</p>' +
        '</div></section>'
    };
  }

  function ritualEnd(r) {
    var idx = DATA.rituals.indexOf(r);
    var next = DATA.rituals[(idx + 1) % DATA.rituals.length];
    return {
      title: cap(r.id) + ' — ' + UI.brand,
      kind: 'end',
      back: '#/r/' + r.id,
      html:
        '<section class="screen end">' +
        '<h1 class="affirmation">' + esc(r.affirmation) + '</h1>' +
        '<div class="rule" aria-hidden="true"></div>' +
        (SPA ? '<div class="spa-thanks">' + spaMark() + '<p class="spa-thanks-text">' + esc(SPA.thanks || '') + '</p>' + bookLink('btn ghost') + shopLink('btn ghost') + spaDemoNote() + '</div>' : '') +
        speciesCard(r) +
        '<div class="actions">' +
        '<a class="btn primary" href="#/rituals"><span>' + UI.returnRituals + '</span>' + arrow() + '</a>' +
        '<nav class="quiet"><a href="#/r/' + next.id + '"><span>' + UI.nextRitual + ': ' + cap(next.id) + '</span></a>' +
        '<a data-listen="' + r.id + ':short" href="#/r/' + r.id + '/s"><span>' + UI.listenAgain + '</span></a>' + installLink() + homeLink() + '</nav>' +
        '</div>' +
        '</section>'
    };
  }

  function about() {
    var paras = DATA.intro.slice(1).map(function (p, i, all) {
      return '<p class="text' + (i === all.length - 1 ? ' big' : '') + '">' + esc(p) + '</p>';
    }).join('');
    var species = DATA.rituals.map(function (r) {
      return img(r.img.species, 'sp-mini', r.species.name);
    }).join('');
    return {
      title: UI.aboutEyebrow + ' — ' + UI.brand,
      kind: 'about',
      back: '#/',
      html:
        '<section class="screen about top-aligned">' +
        '<p class="eyebrow">' + UI.aboutEyebrow + '</p>' +
        '<h1 class="title caps">' + esc(DATA.intro[0]) + '</h1>' +
        '<div class="listen" data-player="intro" data-state="paused">' +
        '<button class="ctl play small" type="button" data-listen="intro" data-toggle data-state="paused" aria-label="' + UI.listenIntro + '">' + ICON.play + ICON.pause + '</button>' +
        '<div class="listen-text"><p class="listen-title">' + UI.listenIntro + '</p>' +
        '<p class="listen-time"><span data-now>0:00</span> / <span data-total>1:22</span></p>' +
        '<input class="range" type="range" min="0" max="1000" step="1" value="0" data-range aria-label="' + UI.position + '">' +
        '<p class="notice" data-notice hidden>' + UI.missing + '</p></div></div>' +
        '<div class="rule" aria-hidden="true"></div>' +
        paras +
        '<div class="reminder-row" role="group" aria-label="' + UI.reminder + '">' +
        '<div class="sp-row">' + species + '</div>' +
        '<p class="reminder">' + UI.reminder + '</p></div>' +
        '<a class="btn primary" href="#/rituals"><span>' + UI.returnRituals + '</span>' + arrow() + '</a>' +
        '<nav class="quiet">' + homeLink() + '</nav>' +
        '<h2>' + UI.privacyTitle + '</h2>' +
        '<p class="text fine">' + UI.privacy + '</p>' +
        /* CONTACT (optional): when a contact address is decided, add it here, e.g.
           '<p class="text fine"><a href="mailto:hello@example.se">hello@example.se</a></p>' + */
        '</section>'
    };
  }

  // "Add to your phone": what to do depends on the phone. Android's own prompt when the browser offers it, the steps on iPhone.
  function installPage() {
    var shareIcon = '<svg class="install-share" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15V3M8 7l4-4 4 4M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1"/></svg>';
    var body;
    if (isStandalone()) {
      body = '<p class="text">' + UI.installAlready + '</p>';
    } else if (inAppBrowser()) {
      body = '<p class="text">' + UI.installInApp + '</p>';
    } else if (isIOSDevice()) {
      body = '<ol class="install-steps">' +
        '<li><span>' + UI.installIosStep1 + ' ' + shareIcon + ' ' + UI.installIosStep1b + '</span></li>' +
        '<li><span>' + UI.installIosStep2 + '</span></li>' +
        '<li><span>' + UI.installIosStep3 + '</span></li></ol>' +
        '<p class="text fine install-after">' + UI.installIosDone + '</p>';
    } else if (isAndroid()) {
      body = '<div data-install>' + installButton() + '</div>' +
        '<p class="text fine" data-install-note' + (installEvent ? ' hidden' : '') + '>' + UI.installAndroidMenu + '</p>';
    } else {
      body = '<p class="text">' + UI.installOther + '</p>';
    }
    return {
      title: UI.spaInstall + ' — ' + UI.brand,
      kind: 'install',
      back: '#/',
      html:
        '<section class="screen about top-aligned install">' +
        (SPA ? '<div class="spa-thanks">' + spaMark() + '</div>' : '') +
        '<h1 class="title">' + br(UI.installTitle) + '</h1>' +
        '<p class="text">' + UI.installLead + '</p>' +
        '<div class="rule" aria-hidden="true"></div>' + body +
        '<nav class="quiet">' + homeLink() + '</nav>' +
        '</section>'
    };
  }

  function closing() {
    return {
      title: plain(UI.closeTitle) + ' — ' + UI.brand,
      kind: 'close',
      back: '#/',
      html:
        '<section class="screen closing">' +
        photo() +
        '<div class="welcome-head">' + logo('mark') + '</div>' +
        '<div class="welcome-body">' +
        '<h1 class="tagline">' + br(UI.closeTitle) + '</h1>' +
        '<div class="rule" aria-hidden="true"></div>' +
        '<p class="text">' + UI.closeText + '</p>' +
        '<div class="actions">' +
        '<a class="btn primary" href="#/rituals"><span>' + UI.returnRituals + '</span>' + arrow() + '</a>' +
        '<div data-install>' + installButton() + '</div>' +
        (isIOS() ? '<p class="install-hint">' + UI.iosHint + '</p>' : '') +
        '<nav class="quiet">' + homeLink() + '</nav>' +
        '</div>' +
        '<p class="small-caps footline">' + wordmark() + '</p>' +
        '</div></section>'
    };
  }

  /* ——— routing ——— */
  // Where Back goes from a TOGETHER screen: the one before it (landing, the choice, the ritual's page, then the screens that begin from it).
  function togetherBack(parts) {
    var a = parts[1];
    if (!a) return '#/';
    if (a === 'rituals') return '#/together';
    if (a === 'solo' || a === 'host' || a === 'join') return '#/together/' + (parts[2] || 'rituals');
    return '#/together/rituals';
  }

  function resolve() {
    var parts = route.replace(/^#\/?/, '').split('/').filter(Boolean);
    if (!parts.length) return welcome();
    if (parts[0] === 'rituals') return rituals();
    if (parts[0] === 'about') return about();
    if (parts[0] === 'close') return closing();
    if (parts[0] === 'install') return installPage();
    if (parts[0] === 'together') {
      var tp = window.BMETogether && window.BMETogether.screen(parts);
      if (!tp) return rituals();
      tp.back = togetherBack(parts);
      return tp;
    }
    if (parts[0] === 'r') {
      var r = ritualById(parts[1]);
      if (!r) return rituals();
      lastSlide = DATA.rituals.indexOf(r);
      if (!parts[2]) return ritualIntro(r);
      if (parts[2] === 'done') return ritualEnd(r);
      return player(r, parts[2] === 'e' ? 'e' : 's');
    }
    return welcome();
  }

  var activePage = null; // a screen that has something to clean up when it is left (TOGETHER's sessions)

  function draw() {
    if (activePage && activePage.unmount) { try { activePage.unmount(); } catch (e) { /* leaving anyway */ } }
    activePage = null;
    var page = resolve();
    var root = document.documentElement;
    // the recording only plays on its own screen (and on the introduction's)
    if (page.kind !== 'player' && !(page.kind === 'about' && session && session.kind === 'intro' && !audio.paused)) {
      stopListening();
    }
    view = null;
    var coloured = page.kind === 'player' || page.kind === 'end';
    root.removeAttribute('data-c');
    if (themeMeta) themeMeta.setAttribute('content', coloured ? NIGHT : PAPER);
    root.setAttribute('data-page', page.kind);
    // Back: every page but the front page says where it goes
    var backEl = document.getElementById('back');
    if (backEl) {
      backEl.hidden = !page.back;
      if (page.back) backEl.setAttribute('href', page.back);
    }
    if (page.back) root.setAttribute('data-back', ''); else root.removeAttribute('data-back');
    try {
      if (page.kind === 'together') window.BMETogether.enter(page);
      else if (window.BMETogether) window.BMETogether.clear();
    } catch (e) { /* TOGETHER can never take the rest of the sanctuary down */ }
    if (coloured) root.setAttribute('data-ground', ''); else root.removeAttribute('data-ground');
    document.title = page.title;
    stage.innerHTML = page.html;
    setMenuClosed();
    window.scrollTo(0, 0);
    try { stage.focus({ preventScroll: true }); } catch (e) { stage.focus(); }
    bindPlayer();
    bindInstall();
    activePage = page;
    if (page.mount) { try { page.mount(stage); } catch (e) { /* the screen stays; the fade-out must not be left on */ } }
    syncInstallSheet();
  }

  function setMenuClosed() {
    menu.hidden = true;
    menuBtn.setAttribute('aria-expanded', 'false');
  }

  // The route lives in memory and is mirrored to the address bar, so navigation also works
  // where the address bar cannot be written (for example inside an embedded preview).
  var route = location.hash || '#/';
  var shown = null;
  var swapTimer = null;

  function navigate(hash) {
    route = hash;
    try { if (location.hash !== hash) location.hash = hash; } catch (e) { /* in-memory route still works */ }
    show();
  }

  window.SANCTUARY_APP = { navigate: navigate };

  function show() {
    if (route === shown) { setMenuClosed(); return; }
    var firstDraw = shown === null;
    shown = route;
    clearTimeout(swapTimer);
    if (firstDraw || reduced) {
      draw();
      return;
    }
    setMenuClosed();
    stage.classList.add('leaving');
    swapTimer = setTimeout(function () {
      draw();
      stage.classList.remove('leaving');
    }, 280);
  }

  document.addEventListener('click', function (e) {
    var close = e.target.closest ? e.target.closest('[data-sheet-close]') : null;
    if (close) { sheetDismissed = true; syncInstallSheet(); return; }
    var go = e.target.closest ? e.target.closest('[data-install-go]') : null;
    if (go && installEvent && !e.defaultPrevented && !e.button && !e.metaKey && !e.ctrlKey && !e.shiftKey) {
      e.preventDefault();
      setMenuClosed();
      runInstall();
      return;
    }
    var el = e.target.closest ? e.target.closest('[data-listen]') : null;
    if (el) {
      // the tap that starts the recording: the browser only allows sound that starts here
      var spec = el.getAttribute('data-listen');
      if (spec === 'intro' && session && session.kind === 'intro') {
        togglePlay();           // the introduction's own play button
        e.preventDefault();
        return;
      }
      startListening(spec);
      if (spec === 'intro') { e.preventDefault(); return; }
    }
    var a = e.target.closest ? e.target.closest('a[href^="#/"]') : null;
    if (!a || e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey) return;
    e.preventDefault();
    navigate(a.getAttribute('href'));
  });

  // The browser's own back and forward buttons.
  window.addEventListener('hashchange', function () {
    route = location.hash || '#/';
    show();
  });
  show();

  /* ——— offline support: the pages and pictures are cached after the first visit ——— */
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function () { /* optional */ });
    });
  }
})();
