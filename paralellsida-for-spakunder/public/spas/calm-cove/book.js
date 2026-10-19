/* The example booking page shows what a spa would see: where the guest came from (the address carries it; nothing is stored). */
(function () {
  'use strict';
  var q = new URLSearchParams(location.search);
  var back = document.querySelector('[data-back]');
  if (back) back.addEventListener('click', function () { if (history.length > 1) history.back(); else location.href = '../../index.html?s=calm-cove#/'; });
  var box = document.querySelector('[data-source]');
  if (!box || !q.get('utm_source')) return;
  box.textContent = 'A guest came from the Body Mind Earth ritual (' + q.get('utm_source') + ' · ' + (q.get('utm_medium') || '') + ' · ' + (q.get('utm_campaign') || '') + '). In the spa’s own statistics this booking is counted as coming from the ritual.';
})();
