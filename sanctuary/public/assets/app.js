/*
 * Body Mind Earth — Sensory Ritual
 * A deliberately small router. No dependencies, no network calls, no tracking, nothing stored.
 * All words come from content.js (generated from the labels and Anna's own manuscripts,
 * see tools/build-content.py); all pictures come from the labels (tools/extract-label-art.py).
 *
 * Routes (hash based, so the browser's back button always works):
 *   #/                      welcome
 *   #/rituals               choose your ritual
 *   #/r/<id>                a ritual: the product, its affirmation, ingredients
 *   #/r/<id>/s/<n>          short meditation, screen n      (/e/<n> = extended)
 *   #/r/<id>/s/<N+1>        the quiet ending
 *   #/about                 Sensory Enrichment
 *   #/close                 closing: back to the sanctuary
 */
(function () {
  'use strict';

  var DATA = window.SANCTUARY;
  var stage = document.getElementById('stage');
  var menu = document.getElementById('menu');
  var menuBtn = document.getElementById('menu-btn');
  var themeMeta = document.querySelector('meta[name="theme-color"]');
  var PAPER = '#fff7e9';
  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Interface words only. Everything the guest reads about the products or the rituals is in content.js.
  var UI = {
    brand: 'Body Mind Earth',
    sub: 'Sensory Ritual',
    tagline: 'Your sanctuary,|wherever you are.',
    footline: 'Rituals for a more present you',
    begin: 'Begin your experience',
    chooseTitle: 'Choose your ritual',
    aboutLink: 'About Sensory Enrichment',
    aboutEyebrow: 'Sensory Enrichment',
    closeLink: 'Close your visit',
    shortRitual: 'Short ritual',
    extended: 'Extended ritual',
    cont: 'Continue',
    back: 'Back',
    formulaTitle: 'Formula',
    activesTitle: 'Actives',
    vegan: 'Vegan formula',
    ingredientsTitle: 'Ingredients',
    ingredientsSummary: 'Formula & ingredients',
    reminder: 'A reminder of the world we share',
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
    return installEvent ? '<button class="btn ghost" type="button" data-install-btn>' + UI.install + '</button>' : '';
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

  /* ——— the menu: three places, nothing else ——— */
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
     Each returns { title, kind, html, theme?, ... }. 'kind' drives the look (see style.css):
     welcome, list, intro (colour hero on cream), med and end (full colour ground), about, close. */

  function photo() { return '<div class="photo" aria-hidden="true"></div>'; }

  function welcome() {
    return {
      title: UI.brand + ' — ' + UI.sub,
      kind: 'welcome',
      html:
        '<section class="screen welcome">' +
        photo() +
        '<div class="welcome-head">' + logo('mark') +
        '<p class="brand-name">' + wordmark() + '</p><p class="brand-sub">' + UI.sub + '</p></div>' +
        '<div class="welcome-body">' +
        '<h1 class="tagline">' + br(UI.tagline) + '</h1>' +
        '<div class="rule" aria-hidden="true"></div>' +
        '<p class="text">' + UI.footline + '</p>' +
        '<a class="btn primary" href="#/rituals"><span>' + UI.begin + '</span>' + arrow() + '</a>' +
        '</div></section>'
    };
  }

  function rituals() {
    var tiles = DATA.rituals.map(function (r) {
      return '<li><a class="tile" data-c="' + r.id + '" href="#/r/' + r.id + '">' +
        img(r.img.botanical, 'tile-art') +
        '<span class="tile-text">' +
        '<span class="name">' + r.id + '</span>' +
        '<span class="kind">' + esc(r.kind) + '</span>' +
        '<span class="kind">' + esc(r.scent) + '</span>' +
        '</span>' +
        '<svg class="chev" viewBox="0 0 10 18" aria-hidden="true"><path d="M1 1l8 8-8 8"/></svg>' +
        '</a></li>';
    }).join('');
    return {
      title: UI.chooseTitle + ' — ' + UI.brand,
      kind: 'list',
      html:
        '<section class="screen top-aligned">' +
        '<h1 class="title caps">' + UI.chooseTitle + '</h1>' +
        '<p class="text sub-title">' + UI.footline + '</p>' +
        '<ul class="ritual-list">' + tiles + '</ul>' +
        '<nav class="quiet">' +
        '<a href="#/about"><span>' + UI.aboutLink + '</span></a>' +
        '<a href="#/close"><span>' + UI.closeLink + '</span></a>' +
        '</nav></section>'
    };
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

  function ritualIntro(r) {
    // the three ritual lines of the label, read as one short passage
    var prose = [r.rows.scent, r.rows.touch, r.rows.feel].map(esc).join(' ');
    return {
      title: cap(r.id) + ' — ' + UI.brand,
      kind: 'intro',
      theme: r,
      html:
        '<section class="screen intro">' +
        '<div class="hero on-colour">' +
        img(r.img.botanical, 'hero-art') +
        '<p class="eyebrow">' + UI.sub + '</p>' +
        '<h1 class="display">' + r.id + '</h1>' +
        '<p class="product-line">' + esc(r.kind) + ' · ' + esc(r.scent) + '</p>' +
        logo('mark small') +
        '<p class="aff-caps">' + esc(r.affirmation) + '</p>' +
        '</div>' +
        '<div class="intro-body">' +
        '<p class="prose">' + prose + '</p>' +
        '<p class="with">' + esc(r.tone) + ' · with ' + r.with.map(esc).join(' · ') + '</p>' +
        '<div class="actions">' +
        '<a class="btn primary" href="#/r/' + r.id + '/s/1"><span>' + UI.shortRitual + '</span>' + arrow() + '</a>' +
        '<a class="btn ghost" href="#/r/' + r.id + '/e/1"><span>' + UI.extended + '</span></a>' +
        '</div>' +
        '<details class="formula"><summary>' + UI.ingredientsSummary + '</summary>' + labelCard(r) + '</details>' +
        '</div></section>'
    };
  }

  function meditation(r, mode, n) {
    var screens = mode === 'e' ? r.extended : r.short;
    var total = screens.length;
    var s = screens[n - 1];
    var base = '#/r/' + r.id + '/' + mode + '/';
    var prev = n === 1 ? '#/r/' + r.id : base + (n - 1);
    var seenAff = false;
    var lines = s.l.map(function (l) {
      if (l.indexOf('§ ') !== 0) return '<p class="line">' + esc(l) + '</p>';
      var mark = seenAff ? '' : logo('mark small aff-mark');
      seenAff = true;
      return mark + '<p class="line aff">' + esc(l.slice(2)) + '</p>';
    }).join('');
    var breathHtml = s.b
      ? '<div class="breath"><div class="orb-ring"><div class="orb"></div></div>' +
        '<p class="breath-label" aria-live="polite"></p>' +
        '<button class="btn ghost" type="button" data-breath aria-pressed="false">' + UI.breathBegin + '</button></div>'
      : '';
    return {
      title: cap(r.id) + ' — ' + UI.brand,
      kind: 'med',
      theme: r,
      html:
        '<section class="screen med">' +
        '<p class="eyebrow">' + r.id + ' · ' + (mode === 'e' ? UI.extended : UI.shortRitual) + '</p>' +
        '<progress class="prog" max="' + total + '" value="' + n + '" aria-label="' + n + ' / ' + total + '"></progress>' +
        '<div class="lines">' + lines + '</div>' +
        breathHtml +
        '<nav class="steps-nav">' +
        '<a class="btn primary" data-next href="' + base + (n + 1) + '"><span>' + UI.cont + '</span>' + arrow() + '</a>' +
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
      kind: 'end',
      theme: r,
      html:
        '<section class="screen end">' +
        logo('mark small') +
        '<h1 class="affirmation">' + esc(r.affirmation) + '</h1>' +
        '<div class="rule" aria-hidden="true"></div>' +
        speciesCard(r) +
        '<div class="actions">' +
        '<a class="btn primary" href="#/rituals"><span>' + UI.returnRituals + '</span>' + arrow() + '</a>' +
        '<nav class="quiet"><a href="#/r/' + next.id + '"><span>' + UI.nextRitual + ': ' + cap(next.id) + '</span></a>' + other + '</nav>' +
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
      html:
        '<section class="screen about top-aligned">' +
        '<p class="eyebrow">' + UI.aboutEyebrow + '</p>' +
        '<h1 class="title caps">' + esc(DATA.intro[0]) + '</h1>' +
        '<div class="rule" aria-hidden="true"></div>' +
        paras +
        '<div class="reminder-row" role="group" aria-label="' + UI.reminder + '">' +
        '<div class="sp-row">' + species + '</div>' +
        '<p class="reminder">' + UI.reminder + '</p></div>' +
        '<a class="btn primary" href="#/rituals"><span>' + UI.returnRituals + '</span>' + arrow() + '</a>' +
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
      kind: 'close',
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
        '</div>' +
        '<p class="small-caps footline">' + wordmark() + '</p>' +
        '</div></section>'
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
    var coloured = page.kind === 'med' || page.kind === 'end';
    if (page.theme) {
      root.setAttribute('data-c', page.theme.id);
      if (themeMeta) themeMeta.setAttribute('content', page.kind === 'intro' || coloured ? page.theme.color : PAPER);
    } else {
      root.removeAttribute('data-c');
      if (themeMeta) themeMeta.setAttribute('content', PAPER);
    }
    root.setAttribute('data-page', page.kind);
    if (coloured) root.setAttribute('data-ground', ''); else root.removeAttribute('data-ground');
    document.title = page.title;
    stage.innerHTML = page.html;
    setMenuClosed();
    window.scrollTo(0, 0);
    try { stage.focus({ preventScroll: true }); } catch (e) { stage.focus(); }
    bindBreath();
    bindInstall();
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
