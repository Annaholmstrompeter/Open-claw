/* A spa's own page: the address ?s=<name> brings in that spa's small settings file (spas/<name>/spa.js) before the app starts,
   and gives the browser that spa's own app manifest and icon, so that "Add to home screen" keeps THAT spa's page, name and icon.
   Without ?s= nothing of that happens and the sanctuary is exactly as it is for everyone else.
   This file runs in the page's head, before the app, so that the links it writes are there when the browser looks for them. */
(function () {
  'use strict';
  // The house shop: where the "Refill" button goes for a spa that has no web shop of its own (with the spa's name added to the
  // address, so that the shop's statistics show which spa the order came from). Leave empty until that shop can take orders:
  // a spa without a shop of its own then simply has no "Refill" button.
  window.BME_HOUSE_SHOP = '';

  var q = location.search;
  // A spa's own page is its own folder, <site>/spas/<name>/ (the page there is made by tools/build-content.py; every address in it is
  // relative to the site's root through its <base>). Its app then covers only that folder, so that one spa's app never takes over
  // another spa's links. The older form <site>/?s=<name> still works.
  var pm = /\/spas\/([a-z0-9-]{2,40})\/(?:index\.html)?$/.exec(location.pathname);
  var m = pm || /[?&]s=([a-z0-9-]{2,40})(?:&|$)/.exec(q);
  var v = /[?&]v=([0-9a-z]{1,16})(?:&|$)/.exec(q);
  var vq = v ? '?v=' + v[1] : '';
  var dir = m ? 'spas/' + m[1] + '/' : '';
  document.write(
    '<link rel="manifest" href="' + (m ? dir + 'manifest.webmanifest' + vq : 'manifest.webmanifest') + '">' +
    '<link rel="icon" type="image/png" href="' + (m ? dir + 'icon-192.png' + vq : 'assets/icon-192.png') + '">' +
    '<link rel="apple-touch-icon" href="' + (m ? dir + 'icon-180.png' + vq : 'assets/icon-180.png') + '">'
  );
  if (m) document.write('<script src="' + dir + 'spa.js' + vq + '"><\/script>');
})();
