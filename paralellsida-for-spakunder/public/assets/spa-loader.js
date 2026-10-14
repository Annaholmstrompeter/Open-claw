/* A spa's own page: the address ?s=<name> brings in that spa's small settings file (spas/<name>/spa.js) before the app starts.
   Without ?s= nothing happens and the sanctuary is exactly as it is for everyone else. */
(function () {
  'use strict';
  var q = location.search;
  var m = /[?&]s=([a-z0-9-]{2,40})(?:&|$)/.exec(q);
  if (!m) return;
  var v = /[?&]v=([0-9a-z]{1,16})(?:&|$)/.exec(q);
  document.write('<script src="spas/' + m[1] + '/spa.js' + (v ? '?v=' + v[1] : '') + '"><\/script>');
})();
