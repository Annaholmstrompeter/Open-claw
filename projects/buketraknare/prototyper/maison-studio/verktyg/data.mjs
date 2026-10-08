// Kontroller av sortimentet, kategorierna, sökningen och favoriterna. Körs i Node utan webbläsare: node verktyg/data.mjs
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const D = require(ROOT + '/js/studio-data.js'), SE = require(ROOT + '/js/studio-engine.js'), SF = require(ROOT + '/js/studio-favorites.js');
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  FEL:', m); } };
const eq = (a, e, m) => ok(JSON.stringify(a) === JSON.stringify(e), m + ' (fick ' + JSON.stringify(a) + ', väntade ' + JSON.stringify(e) + ')');
const E = SE.create();
const nb = s => String(s).replace(/\u00A0/g, ' ');

console.log('1. Taxonomi: varje artikel har exakt ett hem');
const cats = new Map(D.CATEGORIES.map(c => [c.id, new Set(c.groups.map(g => g.id))]));
eq(new Set(D.FLOWERS.map(f => f.id)).size, D.FLOWERS.length, 'artikel-id är unika');
eq(new Set(D.FLOWERS.map(f => f.namn)).size, D.FLOWERS.length, 'artikelnamn är unika (annars går två rader inte att skilja åt)');
for (const f of D.FLOWERS) ok(cats.has(f.kategori) && cats.get(f.kategori).has(f.grupp), f.namn + ' har en kategori och undergrupp som finns');
const homes = new Map(); for (const c of E.categories()) for (const f of E.inCategory(c.id)) homes.set(f.id, (homes.get(f.id) || 0) + 1);
ok([...homes.values()].every(n => n === 1) && homes.size === D.FLOWERS.length, 'ingen artikel finns i två kategorier och ingen saknar kategori');
eq(E.categories().reduce((s, c) => s + c.count, 0), D.FLOWERS.length, 'kategoriernas antal summerar till hela sortimentet');
ok(E.categories().every(c => c.groups.reduce((s, g) => s + g.count, 0) === c.count), 'undergruppernas antal summerar till kategorin');
ok(E.categories().every(c => c.groups.every(g => g.count > 0)), 'ingen undergrupp är tom');
eq(E.categories().length, 7, 'sju kategorier');
ok(D.FLOWERS.length >= 80, 'sortimentet är stort nog att visa strukturen: ' + D.FLOWERS.length + ' artiklar');

console.log('2. Prioritetsordningen följs (ett urval gränsfall)');
const home = n => { const f = D.FLOWERS.find(x => x.namn === n); return f.kategori + '/' + f.grupp; };
eq(home('Torkad gipsört'), 'torkat/torkat', 'torkad gipsört → Torkat (torkat går före art)');
eq(home('Gipsört'), 'utfyllnad/luftig', 'färsk gipsört → Utfyllnad');
eq(home('Rosenhips'), 'kvist/bar', 'rosenhips är ett bär, inte en ros');
eq(home('Eukalyptus'), 'gront/eukalyptus', 'eukalyptus är grönt');
eq(home('Dahlia'), 'lok/sommar', 'dahlia växer från knöl → Lökblommor');
eq(home('Gladiolus'), 'lok/sommar', 'gladiolus är en spirform men växer från knöl → Lökblommor');
eq(home('Grenros rosa'), 'rosor/gren', 'grenros → Rosor');
eq(home('Spraynejlika'), 'utfyllnad/spray', 'spraynejlika är liten och grenad → Utfyllnad');
eq(home('Nejlika'), 'huvud/runda', 'stor nejlika → Huvudblommor');

console.log('3. Sök täcker hela sortimentet, ignorerar diakriter och hittar synonymer');
const names = q => E.search(q).map(f => f.name);
ok(names('gipsort').includes('Gipsört') && names('gipsort').includes('Torkad gipsört'), 'gipsort (utan ö) hittar båda gipsörterna i olika kategorier');
ok(names('brudslöja').includes('Gipsört'), 'synonymen brudslöja hittar Gipsört');
ok(names('eucalyptus').length === 3, 'synonymen eucalyptus hittar tre eukalyptus');
ok(names('peony')[0] === 'Pion' && names('hydrangea')[0] === 'Hortensia', 'engelska namn hittar rätt artikel först');
eq(names('pion')[0], 'Pion', 'bästa träffen först');
ok(names('vit ros').every(n => /vit/i.test(n) && /ros/i.test(n)) && names('vit ros').length >= 3, 'flera ord måste alla träffa: ' + names('vit ros').join(', '));
eq(E.search('grönt').length, 10, 'sök på kategorinamnet visar kategorin (grönt: 10)');
eq(E.search('   ').length, 0, 'tomt sökord ger inga träffar');
eq(E.search('qzx').length, 0, 'ord utan träff ger ingen träff');
ok(E.search('r').every(f => f.words.some(w => w.startsWith('r')) || f.aliasKeys.some(a => a.split(' ').some(w => w.startsWith('r'))) || f.catWords.some(w => w.startsWith('r'))), 'ett enda tecken träffar bara ordstarter (inga träffar mitt i ord)');
const cross = E.search('ros').map(f => f.cat); ok(new Set(cross).size > 1, 'sökning går över kategorigränser (ros finns i flera kategorier)');
// alla artiklar går att hitta på sitt eget namn
ok(D.FLOWERS.every(f => E.search(f.namn)[0] && E.search(f.namn).some(x => x.id === f.id)), 'varje artikel hittas när man skriver hela namnet');
ok(D.FLOWERS.every(f => E.search(E.foldRaw(f.namn)).some(x => x.id === f.id)), 'varje artikel hittas utan å, ä, ö och versaler');

console.log('4. Priser och inköpsenhet är desamma som förut');
const u = id => { const x = E.unitInfo(id); return { unit: nb(x.unit), desc: nb(x.desc) }; };
eq([u('p04').unit, u('p04').desc], ['165 kr/bunt', 'Bunt om 5 st · (33 kr/st)'], 'Pion');
eq([u('p01').unit, u('p01').desc], ['99 kr/10-pack', '(9,90 kr/st)'], 'Rosa ros');
eq([u('p09').unit, u('p09').desc], ['39 kr/st', 'Säljs styckvis'], 'Hortensia');
eq([u('p69').unit, u('p69').desc], ['119 kr/bunt', 'Bunt om 3 st · (≈ 39,67 kr/st)'], 'Magnolia: styckpriset går inte jämnt upp och markeras med ≈');
eq([u('p25').unit, u('p25').desc], ['79 kr/bunt', 'Bunt om 20 st · (3,95 kr/st)'], 'Nejlika: bunt om 20');
const J = E.jobs().map(j => nb(j.name + ' | ' + j.price.text + ' ' + j.price.basis));
eq(J, ['Emma & Johan – bröllop | 5 115 kr inkl. moms', 'Karin Lindgren – begravning | 1 615 kr inkl. moms', 'Födelsedagsbukett Maria | 705 kr inkl. moms', 'Restaurang Lilja – veckoblommor | 448 kr exkl. moms'], 'de fyra jobben har samma priser som i appen och i förra granskningen (5 115, 1 615, 705, 448 exkl. moms)');
eq(E.priceListStatus().old.map(o => o.name).sort(), ['Alstroemeria', 'Ranunkel', 'Solros'], 'äldre priser: Ranunkel, Alstroemeria och Solros (≈), som förut');

console.log('5. Favoriter: en lista per florist, sparas, tål trasig lagring');
const mem = () => { const m = {}; return { getItem: k => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = v; }, _m: m }; };
const valid = new Set(D.FLOWERS.map(f => f.id));
let st = mem(), F = SF.create(st, D.FLORISTS, valid);
eq(F.list(), D.FLORISTS[0].favorites, 'första gången: florist Elsas startlista');
ok(F.toggle('p14') === true && F.has('p14'), 'ett tryck lägger till en favorit'); ok(F.toggle('p14') === false && !F.has('p14'), 'ett tryck till tar bort den');
F.toggle('p14'); const afterAdd = F.list();
F.setCurrent('mia'); eq(F.list(), D.FLORISTS[1].favorites, 'Mia har en egen lista'); ok(!F.has('p14'), 'Elsas ändring syns inte hos Mia');
F.toggle('p20'); F.setCurrent('elsa'); eq(F.list(), afterAdd, 'Elsas lista är kvar när man byter tillbaka'); ok(!F.has('p20'), 'Mias ändring syns inte hos Elsa');
const F2 = SF.create(st, D.FLORISTS, valid); eq(F2.current(), 'elsa', 'vald florist sparas'); eq(F2.list(), afterAdd, 'listan finns kvar efter omladdning (ny instans, samma lagring)');
F2.clear(); eq(F2.list(), [], 'töm listan'); F2.reset(); eq(F2.list(), D.FLORISTS[0].favorites, 'återställ ger startlistan');
ok(SF.create(st, D.FLORISTS, valid).toggle('finns-inte') === false, 'okänt artikel-id ignoreras');
const broken = { getItem() { throw new Error('blockerad'); }, setItem() { throw new Error('blockerad'); } };
const F3 = SF.create(broken, D.FLORISTS, valid); F3.toggle('p14'); ok(F3.has('p14') && F3.isPersisted() === false, 'blockerad lagring: fungerar i minnet och säger att den inte sparas');
const bad = mem(); bad.setItem(SF.PREFIX + 'elsa', '{trasig json'); eq(SF.create(bad, D.FLORISTS, valid).list(), D.FLORISTS[0].favorites, 'trasig lagrad data: startlistan används, inget kraschar');
const stale = mem(); stale.setItem(SF.PREFIX + 'elsa', JSON.stringify({ v: 1, items: ['p04', 'borttagen-artikel'] })); eq(SF.create(stale, D.FLORISTS, valid).list(), ['p04'], 'artiklar som inte längre finns i prislistan tas bort ur listan');
const noStore = SF.create(null, D.FLORISTS, valid); noStore.toggle('p14'); ok(noStore.has('p14'), 'utan lagring alls: fungerar i minnet');

console.log('6. Ångra: en borttagen blomma kommer tillbaka med sitt antal');
{ const e = SE.create(), j = e.jobs().find(x => /Lilja/.test(x.name)), a = e.job(j.id).arrangements[0], flower = e.flowers().find(f => f.name === 'Tulpan');
  const before = e.arrangement(j.id, a.id), item = before.items.find(i => i.flowerId === flower.id), price = before.price;
  e.removeItem(item.id); ok(e.arrangement(j.id, a.id).price !== price, 'priset ändras när blomman tas bort');
  e.restoreFlower(a.id, flower.id, item.qty); const after = e.arrangement(j.id, a.id);
  eq(after.items.find(i => i.flowerId === flower.id).qty, item.qty, 'antalet stjälkar är samma som före borttagningen (' + item.qty + ')'); eq(after.price, price, 'priset är tillbaka: ' + price); }
console.log('\nRESULTAT: ' + pass + ' ok, ' + fail + ' fel'); process.exit(fail ? 1 : 0);
