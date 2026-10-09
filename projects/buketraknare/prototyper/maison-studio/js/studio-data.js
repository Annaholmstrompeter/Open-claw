/* Maison Studio: testdata. Allt är påhittat men rimligt (samma data som i granskningsbilderna). Priser i kronor exkl. moms per förpackning.
 * Datumet är fast (2026-10-08) så att prototypen ser likadan ut vilken dag den öppnas.
 * Sortimentet är påhittat och inte en riktig grossists prislista. De 13 första artiklarna (p01 till p13) är oförändrade från förra granskningen,
 * så alla jobbpriser är desamma som förut. De övriga finns för att visa hur kategorierna fungerar i ett stort sortiment. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api; else root.StudioData = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const TODAY = '2026-10-08';
  const iso = (daysAgo) => { const d = new Date(Date.UTC(2026, 9, 8 - daysAgo)); return d.toISOString().slice(0, 10); };

  /* ---------- kategorier ----------
   * Varje artikel har exakt ett hem: en kategori och en undergrupp. Ingen artikel ligger i två kategorier.
   * Hemmet avgörs av första raden som stämmer (prioritetsordning, se README):
   *   1 torkad eller konserverad            → Torkat
   *   2 en rosblomma                         → Rosor
   *   3 gröna blad, gräs eller ormbunke      → Grönt
   *   4 gren, kvist, bär eller barr          → Kvistar & bär
   *   5 växer från lök eller knöl            → Lökblommor
   *   6 liten, grenad, luftig eller spirform → Utfyllnad
   *   7 övriga stora blommor                 → Huvudblommor
   * Färg och säsong är inga kategorier. De hittas med sök. */
  const CATEGORIES = [
    ['rosor', 'Rosor', [['stor', 'Storblommiga'], ['gren', 'Grenrosor'], ['tradgard', 'Trädgårdsrosor']]],
    ['huvud', 'Huvudblommor', [['runda', 'Runda och fylliga'], ['tallrik', 'Tallriksformade'], ['exotiska', 'Exotiska']]],
    ['lok', 'Lökblommor', [['var', 'Vårblommor'], ['liljor', 'Liljor och kalla'], ['sommar', 'Sommarknölar']]],
    ['utfyllnad', 'Utfyllnad', [['spray', 'Spray och grenade'], ['luftig', 'Luftiga'], ['struktur', 'Spirer och struktur']]],
    ['gront', 'Grönt', [['eukalyptus', 'Eukalyptus'], ['blad', 'Bladgrönt'], ['gras', 'Gräs och ormbunke']]],
    ['kvist', 'Kvistar & bär', [['blommande', 'Blommande kvistar'], ['bar', 'Bär och frukt'], ['barr', 'Barr och julgrönt']]],
    ['torkat', 'Torkat', [['torkat', 'Torkat'], ['konserverat', 'Konserverat']]]
  ].map(([id, name, groups]) => ({ id, name, groups: groups.map(([gid, gname]) => ({ id: gid, name: gname })) }));

  // [id, namn, kategori, undergrupp, enhet, stjälkar per förpackning, pris per förpackning, färg, dagar sedan priset uppdaterades, sökord]
  const FLOWERS = [
    // Rosor
    ['p01', 'Rosa ros 50 cm', 'rosor', 'stor', 'pack', 10, 99, '#E58FA8', 0, ['rose']], ['p02', 'Vit ros 60 cm', 'rosor', 'stor', 'pack', 10, 109, '#E9E3D3', 0, ['rose']], ['p03', 'Röd ros 60 cm', 'rosor', 'stor', 'pack', 10, 119, '#B8243B', 0, ['rose']],
    ['p14', 'Gul ros 50 cm', 'rosor', 'stor', 'pack', 10, 95, '#E8C547', 0, ['rose']], ['p15', 'Persika ros 60 cm', 'rosor', 'stor', 'pack', 10, 115, '#F0A981', 0, ['rose']], ['p16', 'Cerise ros 50 cm', 'rosor', 'stor', 'pack', 10, 99, '#C93A78', 0, ['rose']],
    ['p17', 'Krämvit ros 70 cm', 'rosor', 'stor', 'pack', 10, 139, '#F1E8CF', 0, ['rose']],
    ['p18', 'Grenros vit', 'rosor', 'gren', 'bunt', 10, 119, '#EFEAE0', 0, ['sprayros', 'rose']], ['p19', 'Grenros rosa', 'rosor', 'gren', 'bunt', 10, 115, '#F0B6C6', 0, ['sprayros', 'rose']], ['p20', 'Grenros persika', 'rosor', 'gren', 'bunt', 10, 115, '#F2B591', 0, ['sprayros', 'rose']],
    ['p21', 'Trädgårdsros persika', 'rosor', 'tradgard', 'bunt', 10, 195, '#F2A98C', 0, ['rose', 'engelsk ros']], ['p22', 'Trädgårdsros rosa', 'rosor', 'tradgard', 'bunt', 10, 199, '#EBA0B8', 0, ['rose', 'engelsk ros']], ['p23', 'Trädgårdsros krämvit', 'rosor', 'tradgard', 'bunt', 10, 189, '#F3EBD8', 0, ['rose', 'engelsk ros']],
    // Huvudblommor
    ['p04', 'Pion', 'huvud', 'runda', 'bunt', 5, 165, '#EDB2C2', 0, ['pioner', 'peony']], ['p09', 'Hortensia', 'huvud', 'runda', 'styck', 1, 39, '#8AA9D8', 0, ['hydrangea']],
    ['p24', 'Krysantemum stor', 'huvud', 'runda', 'bunt', 10, 129, '#F5F1E4', 0, ['chrysanthemum', 'disbud']], ['p25', 'Nejlika', 'huvud', 'runda', 'bunt', 20, 79, '#D8587A', 0, ['carnation', 'dianthus']],
    ['p10', 'Solros', 'huvud', 'tallrik', 'bunt', 10, 95, '#E3B02A', 5, ['sunflower']], ['p26', 'Gerbera', 'huvud', 'tallrik', 'bunt', 10, 99, '#F28C4B', 0, []], ['p27', 'Zinnia', 'huvud', 'tallrik', 'bunt', 10, 89, '#E3664F', 0, []],
    ['p28', 'Protea', 'huvud', 'exotiska', 'styck', 1, 75, '#D77A8A', 0, []], ['p29', 'Anthurium', 'huvud', 'exotiska', 'styck', 1, 35, '#C42E3A', 0, ['flamingoblomma']], ['p30', 'Orkidé Cymbidium', 'huvud', 'exotiska', 'styck', 1, 49, '#C98BB9', 0, ['orkide', 'cymbidium']],
    ['p31', 'Strelitzia', 'huvud', 'exotiska', 'styck', 1, 39, '#E8861F', 0, ['paradisfågel']],
    // Lökblommor
    ['p07', 'Tulpan', 'lok', 'var', 'bunt', 10, 59, '#D9553F', 0, ['tulip', 'tulpaner']], ['p32', 'Tulpan vit', 'lok', 'var', 'bunt', 10, 59, '#EFEBDD', 0, ['tulip', 'tulpaner']], ['p33', 'Tulpan rosa', 'lok', 'var', 'bunt', 10, 59, '#EDA0B6', 0, ['tulip', 'tulpaner']],
    ['p34', 'Narciss', 'lok', 'var', 'bunt', 10, 49, '#F2D24A', 0, ['påsklilja', 'narcissus']], ['p35', 'Hyacint', 'lok', 'var', 'bunt', 10, 99, '#7F8FD1', 0, ['hyacinth']], ['p36', 'Anemon', 'lok', 'var', 'bunt', 10, 89, '#6E4A8E', 0, ['anemone']],
    ['p06', 'Ranunkel', 'lok', 'var', 'bunt', 10, 119, '#E8935A', 2, ['ranunculus', 'smörblomma']], ['p37', 'Freesia', 'lok', 'var', 'bunt', 10, 79, '#F2E3A0', 0, ['fresia']], ['p38', 'Iris', 'lok', 'var', 'bunt', 10, 79, '#4B58B8', 0, []],
    ['p39', 'Lilja rosa', 'lok', 'liljor', 'bunt', 5, 129, '#F2C4D4', 0, ['lily', 'liljor']], ['p40', 'Lilja vit', 'lok', 'liljor', 'bunt', 5, 139, '#F4F0E6', 0, ['lily', 'liljor']], ['p41', 'Kalla', 'lok', 'liljor', 'bunt', 10, 129, '#F5F0DC', 0, ['calla', 'zantedeschia']],
    ['p42', 'Amaryllis', 'lok', 'liljor', 'styck', 1, 29, '#C0262F', 0, []],
    ['p43', 'Dahlia', 'lok', 'sommar', 'bunt', 5, 99, '#E36A5A', 0, ['dahlior']], ['p44', 'Gladiolus', 'lok', 'sommar', 'bunt', 10, 99, '#E2548C', 0, ['gladiol']], ['p45', 'Allium', 'lok', 'sommar', 'bunt', 5, 95, '#B896D1', 0, ['prydnadslök']],
    // Utfyllnad
    ['p05', 'Lisianthus', 'utfyllnad', 'spray', 'bunt', 10, 125, '#9C86CE', 0, ['eustoma']], ['p08', 'Alstroemeria', 'utfyllnad', 'spray', 'bunt', 10, 79, '#E39AC4', 3, ['alstromeria', 'inkalilja']],
    ['p46', 'Spraynejlika', 'utfyllnad', 'spray', 'bunt', 10, 69, '#E98AA8', 0, ['grennejlika']], ['p47', 'Santini', 'utfyllnad', 'spray', 'bunt', 10, 69, '#F0EFD8', 0, ['spraykrysantemum']],
    ['p12', 'Gipsört', 'utfyllnad', 'luftig', 'bunt', 5, 69, '#CFD6CF', 0, ['brudslöja', 'gypsophila']], ['p48', 'Vaxblomma', 'utfyllnad', 'luftig', 'bunt', 10, 99, '#F3C8D6', 0, ['waxflower']],
    ['p49', 'Limonium', 'utfyllnad', 'luftig', 'bunt', 10, 59, '#8D7EC8', 0, ['statice']], ['p50', 'Veronica', 'utfyllnad', 'luftig', 'bunt', 10, 79, '#8E7CC3', 0, []], ['p51', 'Astilbe', 'utfyllnad', 'luftig', 'bunt', 10, 89, '#F0B9D0', 0, []],
    ['p52', 'Solidago', 'utfyllnad', 'luftig', 'bunt', 10, 59, '#E8C93A', 0, ['gullris']],
    ['p53', 'Delphinium', 'utfyllnad', 'struktur', 'bunt', 10, 139, '#5A6FC4', 0, ['riddarsporre']], ['p54', 'Lejongap', 'utfyllnad', 'struktur', 'bunt', 10, 109, '#E6A0B0', 0, ['snapdragon']], ['p55', 'Lupin', 'utfyllnad', 'struktur', 'bunt', 10, 99, '#8E6FB5', 0, ['lupiner']],
    ['p56', 'Bupleurum', 'utfyllnad', 'struktur', 'bunt', 10, 69, '#B8CC6A', 0, []], ['p57', 'Craspedia', 'utfyllnad', 'struktur', 'bunt', 10, 79, '#F0C419', 0, ['billy buttons', 'trumpinne']], ['p58', 'Eryngium', 'utfyllnad', 'struktur', 'bunt', 10, 89, '#7FA6B4', 0, ['martorn']],
    ['p59', 'Astrantia', 'utfyllnad', 'struktur', 'bunt', 10, 109, '#E8D6DC', 0, ['stjärnflocka']],
    // Grönt
    ['p11', 'Eukalyptus', 'gront', 'eukalyptus', 'bunt', 10, 79, '#8BA796', 0, ['eucalyptus']], ['p60', 'Eukalyptus parvifolia', 'gront', 'eukalyptus', 'bunt', 10, 85, '#98AE9B', 0, ['eucalyptus']], ['p61', 'Eukalyptus silverdollar', 'gront', 'eukalyptus', 'bunt', 10, 89, '#A9BFB0', 0, ['eucalyptus']],
    ['p13', 'Ruscus', 'gront', 'blad', 'bunt', 10, 59, '#4B7A5C', 0, []], ['p62', 'Salal', 'gront', 'blad', 'bunt', 10, 69, '#3F6B49', 0, []], ['p63', 'Pittosporum', 'gront', 'blad', 'bunt', 10, 69, '#5B8A5A', 0, []],
    ['p64', 'Murgröna', 'gront', 'blad', 'bunt', 10, 59, '#3E6A3A', 0, ['hedera']], ['p65', 'Monsterablad', 'gront', 'blad', 'styck', 1, 19, '#2F6B45', 0, ['monstera']],
    ['p66', 'Ormbunke', 'gront', 'gras', 'bunt', 10, 59, '#4E7F4F', 0, []], ['p67', 'Prydnadsgräs', 'gront', 'gras', 'bunt', 10, 59, '#B9C07A', 0, ['gräs']],
    // Kvistar och bär
    ['p68', 'Körsbärsblom', 'kvist', 'blommande', 'bunt', 5, 129, '#F5D3DC', 0, ['prunus', 'körsbär']], ['p69', 'Magnolia', 'kvist', 'blommande', 'bunt', 3, 119, '#F0E6EA', 0, []], ['p70', 'Pil', 'kvist', 'blommande', 'bunt', 10, 69, '#A59B7A', 0, ['salix', 'sälg', 'kattungar']],
    ['p71', 'Hypericum', 'kvist', 'bar', 'bunt', 10, 79, '#C8473A', 0, ['johannesört']], ['p72', 'Snöbär', 'kvist', 'bar', 'bunt', 5, 69, '#F2EEF0', 0, []], ['p73', 'Rosenhips', 'kvist', 'bar', 'bunt', 10, 79, '#D2552F', 0, ['hips']],
    ['p74', 'Gran', 'kvist', 'barr', 'bunt', 5, 59, '#2D5A3F', 0, ['julgran', 'barr']], ['p75', 'Nobilisgran', 'kvist', 'barr', 'bunt', 5, 89, '#3A6B52', 0, ['barr']],
    // Torkat
    ['p76', 'Torkad gipsört', 'torkat', 'torkat', 'bunt', 5, 79, '#F1ECE0', 0, ['brudslöja']], ['p77', 'Pampasgräs', 'torkat', 'torkat', 'bunt', 5, 99, '#E7D8BF', 0, []], ['p78', 'Harsvans', 'torkat', 'torkat', 'bunt', 10, 59, '#EFE3D0', 0, ['bunny tails', 'lagurus']],
    ['p79', 'Torkad lavendel', 'torkat', 'torkat', 'bunt', 10, 69, '#9C86B8', 0, []], ['p80', 'Torkad hortensia', 'torkat', 'torkat', 'styck', 1, 29, '#B8A0A8', 0, []],
    ['p81', 'Konserverad eukalyptus', 'torkat', 'konserverat', 'bunt', 10, 99, '#9CA89A', 0, []], ['p82', 'Konserverad ruscus', 'torkat', 'konserverat', 'bunt', 10, 79, '#6B7F5F', 0, []]
  ].map(([id, namn, kategori, grupp, enhet, paket, pris, farg, ago, sok]) => ({ id, namn, kategori, grupp, enhet, paket, pris, farg, uppd: iso(ago), sok }));

  /* ---------- florister och deras favoriter ----------
   * Prototypen kan inte logga in. Två påhittade florister visar att favoriter hör till floristen och inte till butiken.
   * Startlistorna är påhittade och används bara första gången. Därefter sparas ändringar i webbläsaren (se studio-favorites.js). */
  const FLORISTS = [
    { id: 'elsa', name: 'Elsa', favorites: ['p01', 'p04', 'p05', 'p07', 'p06', 'p11', 'p12', 'p13'] },
    { id: 'mia', name: 'Mia', favorites: ['p02', 'p09', 'p34', 'p36', 'p32', 'p11', 'p12'] }
  ];

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
  return { TODAY, CATEGORIES, FLOWERS, FLORISTS, SETTINGS, JOBS };
});
