/*
 * Body Mind Earth — Sensory Ritual
 * A deliberately small router. No dependencies, no network calls, no tracking, nothing stored.
 * All words come from content.js (generated from Anna's own texts, see tools/build-content.py).
 *
 * Routes (hash based, so the browser's back button always works):
 *   #/                      welcome
 *   #/rituals               the five rituals
 *   #/r/<id>                a ritual: its scent, touch and feel, affirmation and ingredients
 *   #/r/<id>/s/<n>          short meditation, screen n      (/e/<n> = extended)
 *   #/r/<id>/s/<N+1>        the quiet ending
 *   #/about                 Sensory Enrichment
 *   #/close                 closing — back to the sanctuary
 */
(function () {
  'use strict';

  var DATA = window.SANCTUARY;
  var ART = window.SANCTUARY_ART;
  var stage = document.getElementById('stage');
  var backLink = document.getElementById('nav-back');
  var themeMeta = document.querySelector('meta[name="theme-color"]');
  var SAND = '#efe6d6';
  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Interface words only. Everything the guest reads about the products or the rituals is in content.js.
  var UI = {
    brand: 'Body Mind Earth',
    sub: 'Sensory Ritual',
    tagline: 'Your sanctuary,|wherever you are.',
    footline: 'Rituals for a more present you',
    enter: 'Enter',
    ritualsTitle: 'Five rituals',
    aboutLink: 'About Sensory Enrichment',
    aboutEyebrow: 'Sensory Enrichment',
    closeLink: 'Close your visit',
    navRituals: 'Rituals',
    begin: 'Begin the ritual',
    extended: 'Extended ritual',
    cont: 'Continue',
    back: 'Back',
    scent: 'The Scent',
    touch: 'The Touch',
    feel: 'The Feel',
    formula: 'Our Formula',
    essentials: 'Advanced Essentials',
    ingredients: 'Ingredients (INCI)',
    ingredientsSummary: 'Formula & ingredients',
    breathBegin: 'Begin breathing',
    breathPause: 'Pause',
    breathAgain: 'Breathe again',
    breathIn: 'Breathe in',
    breathOut: 'Breathe out',
    breathRest: 'Rest here.',
    nextRitual: 'Next ritual',
    returnRituals: 'Return to the rituals',
    closeTitle: 'Return to your sanctuary,|whenever you wish.',
    closeText: 'You can return to this feeling whenever you need it throughout your day.',
    install: 'Add to home screen',
    iosHint: 'On iPhone: tap the share icon, then “Add to Home Screen”.',
    privacyTitle: 'Privacy',
    privacy: 'This sanctuary keeps nothing about you. No cookies, no accounts, no tracking.'
  };

  function br(s) { return s.split('|').join('<br>'); }
  function plain(s) { return s.split('|').join(' '); }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  // Escapes text for display; a dash never starts a line (it stays with the word before it).
  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/ \u2014 /g, '\u00A0\u2014 ');
  }

  function ritualById(id) {
    for (var i = 0; i < DATA.rituals.length; i++) if (DATA.rituals[i].id === id) return DATA.rituals[i];
    return null;
  }

  /* ——— breathing (three slow breaths; in 4s, out 6s) ——— */
  var breath = { timer: null, running: false, count: 0 };

  function stopBreath() {
    clearTimeout(breath.timer);
    breath.running = false;
    breath.count = 0;
  }

  function bindBreath() {
    var orb = stage.querySelector('.orb');
    var label = stage.querySelector('.breath-label');
    var btn = stage.querySelector('[data-breath]');
    if (!orb || !btn) return;

    function reset(text, btnText) {
      orb.className = 'orb';
      label.textContent = text || '';
      btn.textContent = btnText;
      btn.setAttribute('aria-pressed', 'false');
    }

    function cycle() {
      if (!breath.running) return;
      if (breath.count >= 3) {
        stopBreath();
        reset(UI.breathRest, UI.breathAgain);
        return;
      }
      label.textContent = UI.breathIn;
      orb.className = 'orb in';
      breath.timer = setTimeout(function () {
        if (!breath.running) return;
        label.textContent = UI.breathOut;
        orb.className = 'orb out';
        breath.timer = setTimeout(function () {
          breath.count += 1;
          cycle();
        }, 6000);
      }, 4000);
    }

    btn.addEventListener('click', function () {
      if (breath.running) {
        stopBreath();
        reset('', UI.breathBegin);
      } else {
        breath.running = true;
        breath.count = 0;
        btn.textContent = UI.breathPause;
        btn.setAttribute('aria-pressed', 'true');
        cycle();
      }
    });
  }

  /* ——— install to home screen (Android prompt, iOS hint) ——— */
  var installEvent = null;
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    installEvent = e;
    var slot = stage.querySelector('[data-install]');
    if (slot) slot.innerHTML = installButton();
    bindInstall();
  });
  function installButton() {
    return installEvent ? '<button class="btn" type="button" data-install-btn>' + UI.install + '</button>' : '';
  }
  function bindInstall() {
    var b = stage.querySelector('[data-install-btn]');
    if (!b || !installEvent) return;
    b.addEventListener('click', function () {
      installEvent.prompt();
      installEvent = null;
      b.hidden = true;
    });
  }
  function isStandalone() {
    return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone === true;
  }
  function isIOS() {
    return /iphone|ipad|ipod/i.test(navigator.userAgent) && !isStandalone();
  }

  /* ——— screens ——— */
  function arrowBack() {
    return '<svg viewBox="0 0 9 14" fill="none" stroke="currentColor" stroke-width="1" aria-hidden="true"><path d="M8 1 2 7l6 6"/></svg>';
  }

  function welcome() {
    return {
      title: UI.brand + ' — ' + UI.sub,
      html:
        '<section class="screen welcome">' +
        '<img class="mark" src="assets/logo.svg" alt="">' +
        '<p class="brand"><span class="brand-name">' + UI.brand + '</span><br><span class="brand-sub">' + UI.sub + '</span></p>' +
        '<div class="rule" aria-hidden="true"></div>' +
        '<h1 class="tagline">' + br(UI.tagline) + '</h1>' +
        '<a class="btn" href="#/rituals">' + UI.enter + '</a>' +
        '<p class="small-caps footline">' + UI.footline + '</p>' +
        '</section>'
    };
  }

  function rituals() {
    var tiles = DATA.rituals.map(function (r) {
      return '<li><a class="tile" data-c="' + r.id + '" href="#/r/' + r.id + '">' +
        '<span class="art" aria-hidden="true">' + ART[r.id] + '</span>' +
        '<span class="num">' + r.num + '</span>' +
        '<span class="name">' + r.id + '</span>' +
        '<span class="kind">' + esc(r.kind) + ' · ' + esc(r.scent) + '</span></a></li>';
    }).join('');
    return {
      title: UI.ritualsTitle + ' — ' + UI.brand,
      html:
        '<section class="screen top-aligned">' +
        '<p class="eyebrow">' + UI.sub + '</p>' +
        '<h1 class="title">' + UI.ritualsTitle + '</h1>' +
        '<ul class="ritual-list">' + tiles + '</ul>' +
        '<nav class="quiet">' +
        '<a href="#/about"><span>' + UI.aboutLink + '</span></a>' +
        '<a href="#/close"><span>' + UI.closeLink + '</span></a>' +
        '</nav></section>'
    };
  }

  function ritualIntro(r) {
    var rows =
      '<div><dt>' + UI.scent + '</dt><dd>' + esc(r.rows.scent) + '</dd></div>' +
      '<div><dt>' + UI.touch + '</dt><dd>' + esc(r.rows.touch) + '</dd></div>' +
      '<div><dt>' + UI.feel + '</dt><dd>' + esc(r.rows.feel) + '</dd></div>';
    var badges = r.badges.map(function (b) { return '<li>' + esc(b) + '</li>'; }).join('');
    var details =
      '<details class="formula"><summary>' + UI.ingredientsSummary + '</summary>' +
      '<h2>' + UI.formula + '</h2><p>' + esc(r.formula) + '</p>' +
      (r.essentials ? '<h2>' + UI.essentials + '</h2><p>' + esc(r.essentials) + '</p>' : '') +
      '<ul class="badges">' + badges + '</ul>' +
      '<h2>' + UI.ingredients + '</h2><p class="inci">' + esc(r.inci) + '</p></details>';
    return {
      title: cap(r.id) + ' — ' + UI.brand,
      theme: r,
      back: true,
      html:
        '<section class="screen intro">' +
        '<div class="ritual-art" aria-hidden="true">' + ART[r.id] + '</div>' +
        '<p class="eyebrow">' + r.num + ' · ' + esc(r.kind) + ' · ' + esc(r.scent) + '</p>' +
        '<h1 class="display">' + r.id + '</h1>' +
        '<p class="product">' + esc(r.title) + '</p>' +
        '<dl class="rows">' + rows + '</dl>' +
        '<p class="aff-line">' + esc(r.affirmation) + '</p>' +
        '<div class="actions">' +
        '<a class="btn primary" href="#/r/' + r.id + '/s/1">' + UI.begin + '</a>' +
        '<a class="linkish" href="#/r/' + r.id + '/e/1"><span>' + UI.extended + '</span></a>' +
        '</div>' +
        details +
        '</section>'
    };
  }

  function meditation(r, mode, n) {
    var screens = mode === 'e' ? r.extended : r.short;
    var total = screens.length;
    var s = screens[n - 1];
    var base = '#/r/' + r.id + '/' + mode + '/';
    var prev = n === 1 ? '#/r/' + r.id : base + (n - 1);
    var lines = s.l.map(function (l) {
      return l.indexOf('§ ') === 0
        ? '<p class="line aff">' + esc(l.slice(2)) + '</p>'
        : '<p class="line">' + esc(l) + '</p>';
    }).join('');
    var breathHtml = s.b
      ? '<div class="breath"><div class="orb-ring"><div class="orb"></div></div>' +
        '<p class="breath-label" aria-live="polite"></p>' +
        '<button class="btn" type="button" data-breath aria-pressed="false">' + UI.breathBegin + '</button></div>'
      : '';
    return {
      title: cap(r.id) + ' — ' + UI.brand,
      theme: r,
      back: true,
      html:
        '<section class="screen med">' +
        '<p class="eyebrow">' + r.id + ' · ' + (mode === 'e' ? UI.extended : 'Short ritual') + '</p>' +
        '<progress class="prog" max="' + total + '" value="' + n + '" aria-label="' + n + ' / ' + total + '"></progress>' +
        '<div class="lines">' + lines + '</div>' +
        breathHtml +
        '<nav class="steps-nav">' +
        '<a class="btn primary" data-next href="' + base + (n + 1) + '">' + UI.cont + '</a>' +
        '<a class="linkish" data-prev href="' + prev + '"><span>' + UI.back + '</span></a>' +
        '</nav></section>'
    };
  }

  function ritualEnd(r, mode) {
    var idx = DATA.rituals.indexOf(r);
    var next = DATA.rituals[(idx + 1) % DATA.rituals.length];
    var other = mode === 's'
      ? '<a href="#/r/' + r.id + '/e/1"><span>' + UI.extended + '</span></a>'
      : '';
    return {
      title: cap(r.id) + ' — ' + UI.brand,
      theme: r,
      back: true,
      html:
        '<section class="screen end">' +
        '<div class="ritual-art small" aria-hidden="true">' + ART[r.id] + '</div>' +
        '<h1 class="affirmation">' + esc(r.affirmation) + '</h1>' +
        '<div class="rule" aria-hidden="true"></div>' +
        '<a class="btn primary" href="#/rituals">' + UI.returnRituals + '</a>' +
        '<nav class="quiet"><a href="#/r/' + next.id + '"><span>' + UI.nextRitual + ': ' + cap(next.id) + '</span></a>' + other + '</nav>' +
        '</section>'
    };
  }

  function about() {
    var paras = DATA.intro.slice(1).map(function (p, i, all) {
      return '<p class="text' + (i === all.length - 1 ? ' big' : '') + '">' + esc(p) + '</p>';
    }).join('');
    return {
      title: UI.aboutEyebrow + ' — ' + UI.brand,
      back: true,
      html:
        '<section class="screen about top-aligned">' +
        '<p class="eyebrow">' + UI.aboutEyebrow + '</p>' +
        '<h1 class="title">' + esc(DATA.intro[0]) + '</h1>' +
        paras +
        '<div class="rule" aria-hidden="true"></div>' +
        '<a class="btn primary" href="#/rituals">' + UI.returnRituals + '</a>' +
        '<h2>' + UI.privacyTitle + '</h2>' +
        '<p class="text fine">' + UI.privacy + '</p>' +
        /* CONTACT (optional): when a contact address is decided, add it here, e.g.
           '<p class="text fine"><a href="mailto:hello@example.se">hello@example.se</a></p>' + */
        '</section>'
    };
  }

  function closing() {
    return {
      title: plain(UI.closeTitle) + ' — ' + UI.brand,
      back: true,
      html:
        '<section class="screen closing">' +
        '<img class="mark" src="assets/logo.svg" alt="">' +
        '<h1 class="tagline">' + br(UI.closeTitle) + '</h1>' +
        '<div class="rule" aria-hidden="true"></div>' +
        '<p class="text">' + UI.closeText + '</p>' +
        '<div class="actions">' +
        '<a class="btn primary" href="#/rituals">' + UI.returnRituals + '</a>' +
        '<div data-install>' + installButton() + '</div>' +
        (isIOS() ? '<p class="install-hint">' + UI.iosHint + '</p>' : '') +
        '</div>' +
        '<p class="small-caps footline">' + UI.brand + ' · ' + UI.sub + '</p>' +
        '</section>'
    };
  }

  /* ——— routing ——— */
  function resolve() {
    var parts = route.replace(/^#\/?/, '').split('/').filter(Boolean);
    if (!parts.length) return welcome();
    if (parts[0] === 'rituals') return rituals();
    if (parts[0] === 'about') return about();
    if (parts[0] === 'close') return closing();
    if (parts[0] === 'r') {
      var r = ritualById(parts[1]);
      if (!r) return rituals();
      if (!parts[2]) return ritualIntro(r);
      var mode = parts[2] === 'e' ? 'e' : 's';
      var total = (mode === 'e' ? r.extended : r.short).length;
      var n = parseInt(parts[3], 10);
      if (isNaN(n) || n < 1) n = 1;
      if (n > total) return ritualEnd(r, mode);
      return meditation(r, mode, n);
    }
    return welcome();
  }

  function draw() {
    stopBreath();
    var page = resolve();
    var root = document.documentElement;
    if (page.theme) {
      root.setAttribute('data-c', page.theme.id);
      if (themeMeta) themeMeta.setAttribute('content', page.theme.color);
    } else {
      root.removeAttribute('data-c');
      if (themeMeta) themeMeta.setAttribute('content', SAND);
    }
    document.title = page.title;
    stage.innerHTML = page.html;
    backLink.hidden = !page.back;
    if (page.back) backLink.innerHTML = arrowBack() + '<span>' + UI.navRituals + '</span>';
    window.scrollTo(0, 0);
    try { stage.focus({ preventScroll: true }); } catch (e) { stage.focus(); }
    bindBreath();
    bindInstall();
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

  function show() {
    if (route === shown) return;
    var firstDraw = shown === null;
    shown = route;
    clearTimeout(swapTimer);
    if (firstDraw || reduced) {
      draw();
      return;
    }
    stage.classList.add('leaving');
    swapTimer = setTimeout(function () {
      draw();
      stage.classList.remove('leaving');
    }, 280);
  }

  document.addEventListener('click', function (e) {
    var a = e.target.closest ? e.target.closest('a[href^="#/"]') : null;
    if (!a || e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey) return;
    e.preventDefault();
    navigate(a.getAttribute('href'));
  });

  // Arrow keys move through a meditation on larger screens.
  window.addEventListener('keydown', function (e) {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    var sel = e.key === 'ArrowRight' ? '[data-next]' : e.key === 'ArrowLeft' ? '[data-prev]' : null;
    var a = sel && stage.querySelector(sel);
    if (a) navigate(a.getAttribute('href'));
  });

  // The browser's own back and forward buttons.
  window.addEventListener('hashchange', function () {
    route = location.hash || '#/';
    show();
  });
  show();

  /* ——— offline support: the whole sanctuary is cached after the first visit ——— */
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function () { /* optional */ });
    });
  }
})();
