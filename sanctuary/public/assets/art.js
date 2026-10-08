/*
 * Botanical line drawings, one per ritual. Pure SVG strokes in currentColor,
 * so each can be tinted by the screen it sits on. No images to download.
 */
window.SANCTUARY_ART = (function () {
  function r1(n) { return Math.round(n * 10) / 10; }

  // A single leaf with a faint midrib, pointing along +x, rotated r degrees.
  function leaf(x, y, r, s) {
    return '<g transform="translate(' + r1(x) + ' ' + r1(y) + ') rotate(' + r1(r) + ') scale(' + s + ')">' +
      '<path d="M0 0C9-13 30-13 42 0C30 13 9 13 0 0Z"/><path d="M3 0L37 0" opacity=".55"/></g>';
  }

  function point(p, t) {
    var u = 1 - t;
    return [
      u * u * u * p[0][0] + 3 * u * u * t * p[1][0] + 3 * u * t * t * p[2][0] + t * t * t * p[3][0],
      u * u * u * p[0][1] + 3 * u * u * t * p[1][1] + 3 * u * t * t * p[2][1] + t * t * t * p[3][1]
    ];
  }

  function angle(p, t) {
    var u = 1 - t;
    var dx = 3 * u * u * (p[1][0] - p[0][0]) + 6 * u * t * (p[2][0] - p[1][0]) + 3 * t * t * (p[3][0] - p[2][0]);
    var dy = 3 * u * u * (p[1][1] - p[0][1]) + 6 * u * t * (p[2][1] - p[1][1]) + 3 * t * t * (p[3][1] - p[2][1]);
    return Math.atan2(dy, dx) * 180 / Math.PI;
  }

  // A curved stem with leaves alternating along it and one at the tip.
  function branch(p, n, size, spread, from) {
    var out = '<path d="M' + p[0].join(' ') + 'C' + p[1].join(' ') + ' ' + p[2].join(' ') + ' ' + p[3].join(' ') + '"/>';
    for (var i = 0; i < n; i++) {
      var t = from + (0.97 - from) * (i / Math.max(1, n - 1));
      var pt = point(p, t);
      var side = i % 2 ? 1 : -1;
      out += leaf(pt[0], pt[1], angle(p, t) + side * spread, r1(size * (1 - 0.3 * t)));
    }
    var tip = point(p, 1);
    out += leaf(tip[0], tip[1], angle(p, 1), r1(size * 0.8));
    return out;
  }

  function svg(inner) {
    return '<svg viewBox="0 0 200 200" fill="none" stroke="currentColor" stroke-width="1.15" ' +
      'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + inner + '</svg>';
  }

  var art = {};

  // Bergamot: a leafy sprig with a single fruit hanging from it.
  var bergamotStem = [[30, 186], [52, 138], [96, 110], [158, 30]];
  var hook = point(bergamotStem, 0.5);
  var fx = hook[0] + 24, fy = hook[1] + 40;
  art.balance = svg(
    branch(bergamotStem, 6, 0.62, 52, 0.22) +
    '<path d="M' + r1(hook[0]) + ' ' + r1(hook[1]) + 'C' + r1(hook[0] + 8) + ' ' + r1(hook[1] + 8) + ' ' + r1(fx - 2) + ' ' + r1(fy - 30) + ' ' + r1(fx) + ' ' + r1(fy - 21) + '"/>' +
    '<ellipse cx="' + r1(fx) + '" cy="' + r1(fy) + '" rx="23" ry="21"/>' +
    '<path d="M' + r1(fx - 8) + ' ' + r1(fy + 19) + 'q8 4 16 0"/>' +
    '<path d="M' + r1(fx - 14) + ' ' + r1(fy - 4) + 'q4-9 14-12" opacity=".6"/>'
  );

  // Apricot: a fruit with its crease, a smaller one behind, and soft rays.
  var rays = '';
  for (var i = 0; i < 7; i++) {
    var a = (-72 + i * 22) * Math.PI / 180;
    rays += '<path d="M' + r1(112 + 56 * Math.cos(a)) + ' ' + r1(106 + 56 * Math.sin(a)) + 'L' +
      r1(112 + 68 * Math.cos(a)) + ' ' + r1(106 + 68 * Math.sin(a)) + '" opacity=".6"/>';
  }
  art.luminance = svg(
    '<circle cx="152" cy="142" r="24" opacity=".8"/>' +
    '<path d="M152 118C143 132 143 152 152 166" opacity=".8"/>' +
    '<circle cx="98" cy="116" r="38"/>' +
    '<path d="M98 78C84 100 84 132 98 154"/>' +
    '<path d="M98 78C99 66 104 58 113 53"/>' +
    leaf(103, 63, -32, 0.9) +
    leaf(101, 67, 22, 0.62) +
    '<path d="M76 100q4-12 14-17" opacity=".6"/>' +
    rays
  );

  // Cherry: two fruits on joined stems with a pair of leaves.
  art.kindness = svg(
    '<circle cx="70" cy="144" r="24"/>' +
    '<circle cx="132" cy="152" r="24"/>' +
    '<path d="M72 120C78 92 92 66 108 46"/>' +
    '<path d="M132 128C130 100 122 70 108 46"/>' +
    '<path d="M58 134q3-9 12-12" opacity=".6"/>' +
    '<path d="M120 142q3-9 12-12" opacity=".6"/>' +
    leaf(108, 46, -28, 1.15) +
    leaf(108, 46, -150, 0.95)
  );

  // Serenity (macadamia): a branch of long glossy leaves, nuts sitting close along the stem.
  var macadamia = [[26, 38], [88, 20], [150, 56], [176, 168]];
  var nuts = '';
  [0.34, 0.44, 0.54, 0.64, 0.74].forEach(function (t, i) {
    var h = point(macadamia, t);
    var a = (angle(macadamia, t) + (i % 2 ? 90 : -90)) * Math.PI / 180;
    var cx = h[0] + 8.5 * Math.cos(a), cy = h[1] + 8.5 * Math.sin(a);
    nuts += '<circle cx="' + r1(cx) + '" cy="' + r1(cy) + '" r="6.2"/>' +
      '<path d="M' + r1(cx - 2.6) + ' ' + r1(cy - 1.4) + 'q1.6-2.4 4-2.6" opacity=".6"/>';
  });
  art.serenity = svg(branch(macadamia, 6, 0.56, 62, 0.12) + nuts);

  // Presence (raspberry): a berry of small rounded drupelets, a short stem and leaves.
  var berry = '';
  [[3, 92], [4, 103], [5, 114], [5, 125], [4, 136], [3, 147]].forEach(function (row) {
    for (var j = 0; j < row[0]; j++) {
      berry += '<circle cx="' + r1(100 + (j - (row[0] - 1) / 2) * 13.2) + '" cy="' + row[1] + '" r="6.1"/>';
    }
  });
  art.presence = svg(
    '<path d="M100 84C100 68 104 56 114 46"/>' +
    leaf(112, 48, -26, 0.95) +
    leaf(104, 70, -160, 0.6) +
    leaf(100, 86, -40, 0.42) +
    leaf(100, 86, -140, 0.42) +
    berry
  );

  return art;
})();
