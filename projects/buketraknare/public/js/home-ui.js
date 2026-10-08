/* Buketträknaren: startsidan ("Hem").
 *
 * Bara visning. Startsidan räknar ingenting och sparar ingenting: den får färdiga rader (jobb med pris i text) av jobbskärmen
 * och ger tillbaka vad floristen tryckte på (skapa en bukett, planera ett kundjobb, öppna ett jobb).
 *
 * Inga bilder: ikonerna är enkla linjeikoner som ritas i sidan (symbolerna ligger i index.html).
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.BRHomeUI = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const icon = n => '<svg class="i" aria-hidden="true" focusable="false"><use href="#i-' + n + '"></use></svg>';
  const SHOW = 5;

  function priceHtml(p) {
    if (p.kind === 'ok') return '<span class="h-job-price"><span class="j-mark">' + esc(p.mark) + '</span> ' + esc(p.text) + ' <small>' + esc(p.tail) + '</small></span>';
    if (p.kind === 'missing') return '<span class="badge warn">Pris saknas</span>';
    return '<span class="h-job-price muted">Tomt</span>';
  }

  /** d: { jobs: [{ id, name, customer, type, date, price }], jobsReady, noPrices } */
  function homeHtml(d) {
    const jobs = d.jobs || [];
    let h = '<div class="h-wrap"><header class="page-head"><p class="eyebrow">Din studio</p><h1 class="display xl" id="h-title" tabindex="-1">Vad vill du skapa idag?</h1></header>'
      + '<div class="h-actions">'
      + '<button type="button" class="h-action h-action--bouquet" data-home="bouquet"><span class="h-ico">' + icon('bouquet') + '</span><span class="h-title">Skapa en bukett</span><span class="h-sub">Välj blommor och se kundpriset direkt.</span><span class="h-go" aria-hidden="true">' + icon('next') + '</span></button>'
      + '<button type="button" class="h-action h-action--job" data-home="job"><span class="h-ico">' + icon('clipboard') + '</span><span class="h-title">Planera ett kundjobb</span><span class="h-sub">Bröllop, begravning eller en kund med flera arrangemang.</span><span class="h-go" aria-hidden="true">' + icon('next') + '</span></button>'
      + '</div>';
    if (d.noPrices) h += '<p class="note h-note">Du har inte lagt in några priser än. Det går bra: när du väljer en blomma frågar appen vad den kostar, och sedan räknas kundpriset direkt.</p>';
    h += '<section class="h-recent" aria-labelledby="h-recent-h"><h2 class="section-title" id="h-recent-h">Senaste arbeten</h2>';
    if (d.loading) h += '';
    else if (!d.jobsReady) h += '<p class="muted">Jobben kunde inte läsas just nu. Du kan fortfarande skapa en bukett eller räkna i Snabbkalkyl.</p>';
    else if (!jobs.length) {
      h += '<div class="card h-empty"><p><strong>Inga arbeten än.</strong></p><p class="muted">Det första tar ungefär en minut. Börja med en bukett, eller planera ett jobb för en kund.</p>'
        + (d.noPrices ? '<p><button type="button" class="link" data-home="example">Utforska först med exempeldata</button></p>' : '') + '</div>';
    } else {
      h += '<ul class="h-list">' + jobs.slice(0, SHOW).map(j => '<li><button type="button" class="h-job" data-home="open" data-id="' + esc(j.id) + '"><span class="h-job-main"><span class="h-job-name">' + esc(j.name) + '</span>'
        + '<span class="h-job-meta">' + [j.customer, j.type, j.date].filter(Boolean).map(esc).join(' · ') + '</span></span>' + priceHtml(j.price) + '<span class="h-go" aria-hidden="true">' + icon('next') + '</span></button></li>').join('') + '</ul>';
      if (jobs.length > SHOW) h += '<p><button type="button" class="link" data-home="alljobs">Visa alla ' + jobs.length + ' jobb</button></p>';
    }
    return h + '</section></div>';
  }

  /** Monterar startsidan i host. opts.onAction(kind, id, element) körs när floristen trycker. */
  function mount(host, opts) {
    const o = opts || {};
    host.addEventListener('click', e => {
      const t = e.target.closest('[data-home]'); if (!t || !host.contains(t)) return;
      if (o.onAction) o.onAction(t.dataset.home, t.dataset.id || null, t);
    });
    return { render: d => { host.innerHTML = homeHtml(d || {}); } };
  }

  return { mount, homeHtml };
});
