/* Maison Studio: testdata. Allt är påhittat men rimligt (samma data som i granskningsbilderna). Priser i kronor exkl. moms per förpackning.
 * Datumet är fast (2026-10-08) så att prototypen ser likadan ut vilken dag den öppnas. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api; else root.StudioData = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const TODAY = '2026-10-08';
  const iso = (daysAgo) => { const d = new Date(Date.UTC(2026, 9, 8 - daysAgo)); return d.toISOString().slice(0, 10); };
  // [id, namn, kategori, enhet, stjälkar per förpackning, pris per förpackning, färg, dagar sedan priset uppdaterades]
  const FLOWERS = [
    ['p01', 'Rosa ros 50 cm', 'Blommor', 'pack', 10, 99, '#E58FA8', 0], ['p02', 'Vit ros 60 cm', 'Blommor', 'pack', 10, 109, '#E9E3D3', 0], ['p03', 'Röd ros 60 cm', 'Blommor', 'pack', 10, 119, '#B8243B', 0],
    ['p04', 'Pion', 'Blommor', 'bunt', 5, 165, '#EDB2C2', 0], ['p05', 'Lisianthus', 'Blommor', 'bunt', 10, 125, '#9C86CE', 0], ['p06', 'Ranunkel', 'Blommor', 'bunt', 10, 119, '#E8935A', 2],
    ['p07', 'Tulpan', 'Blommor', 'bunt', 10, 59, '#D9553F', 0], ['p08', 'Alstroemeria', 'Blommor', 'bunt', 10, 79, '#E39AC4', 3], ['p09', 'Hortensia', 'Blommor', 'styck', 1, 39, '#8AA9D8', 0],
    ['p10', 'Solros', 'Blommor', 'bunt', 10, 95, '#E3B02A', 5], ['p11', 'Eukalyptus', 'Grönt', 'bunt', 10, 79, '#8BA796', 0], ['p12', 'Gipsört', 'Grönt', 'bunt', 5, 69, '#CFD6CF', 0], ['p13', 'Ruscus', 'Grönt', 'bunt', 10, 59, '#4B7A5C', 0]
  ].map(([id, namn, kategori, enhet, paket, pris, farg, ago]) => ({ id, namn, kategori, enhet, paket, pris, farg, uppd: iso(ago) }));

  const SETTINGS = { mode: 'whole', markupPct: 50, hourly: 250, vatPct: 25, roundStep: 5, shipFee: 0, freeFrom: 0 };

  // Jobb i den ordning de skapades (det sista som skapas visas först på Hem). parts = [blomma, antal]; own = [namn, kalkylkostnad]
  const JOBS = [
    { name: 'Restaurang Lilja – veckoblommor', customer: 'Restaurang Lilja', kind: 'BUSINESS', type: 'other', date: null,
      arrangements: [{ name: 'Entrébukett', qty: 1, labor: 150, parts: [['Tulpan', 15], ['Eukalyptus', 4]] }] },
    { name: 'Födelsedagsbukett Maria', customer: 'Maria Holm', kind: 'PRIVATE', type: 'bouquet', date: '2026-10-14',
      arrangements: [{ name: 'Födelsedagsbukett', qty: 1, labor: 180, parts: [['Rosa ros 50 cm', 7], ['Hortensia', 2], ['Eukalyptus', 3]] }] },
    { name: 'Karin Lindgren – begravning', customer: 'Karin Lindgren', kind: 'PRIVATE', type: 'funeral', date: '2026-10-17',
      arrangements: [{ name: 'Kistdekoration', qty: 1, labor: 450, own: ['Band', 45], parts: [['Vit ros 60 cm', 20], ['Alstroemeria', 10], ['Gipsört', 10], ['Eukalyptus', 10]] }] },
    { name: 'Emma & Johan – bröllop', customer: 'Emma Svensson', kind: 'PRIVATE', type: 'wedding', date: '2027-06-12',
      arrangements: [
        { name: 'Brudbukett', qty: 1, labor: 350, own: ['Sidenband', 40], parts: [['Pion', 10], ['Rosa ros 50 cm', 6], ['Lisianthus', 5], ['Eukalyptus', 3]] },
        { name: 'Bordsdekoration', qty: 8, labor: 110, parts: [['Ranunkel', 3], ['Tulpan', 4], ['Gipsört', 2]] },
        { name: 'Corsage', qty: 4, labor: 90, parts: [['Vit ros 60 cm', 1], ['Eukalyptus', 1]] }] }
  ];
  return { TODAY, FLOWERS, SETTINGS, JOBS };
});
