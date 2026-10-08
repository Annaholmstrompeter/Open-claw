// Korta statusrader för floristen och operatören. Skrivs av vår kod utifrån vilket verktyg som körs och vad det gav.
// Modellens egna resonemang och löpande text visas aldrig.

const q = s => '«' + String(s == null ? '' : s).replace(/\s+/g, ' ').trim().slice(0, 60) + '»';

/** Raden som visas när ett verktyg börjar. */
export function statusBefore(name, input = {}) {
  switch (name) {
    case 'observe': return 'Tittar på sidan…';
    case 'goto': return 'Öppnar en sida…';
    case 'click': return 'Klickar vidare…';
    case 'search': return 'Söker efter ' + q(input.text) + '…';
    case 'inspect_json': return 'Läser produktinformation…';
    case 'dom_outline': return 'Läser sidans uppbyggnad…';
    case 'set_extraction': return 'Läser ut produkterna på sidan…';
    case 'find_products': return 'Filtrerar produkterna…';
    case 'report_candidates': return 'Sammanställer förslag…';
    default: return 'Arbetar…';
  }
}

const n = (x, one, many) => x + ' ' + (x === 1 ? one : many);

/** Raden som visas när ett verktyg är klart (eller null om det inte behövs). r är verktygets resultat som objekt (eller null), isError om det nekades eller misslyckades. */
export function statusAfter(name, input = {}, r = null, isError = false, errorText = '') {
  if (isError) {
    if (/^Nekad/.test(errorText)) return 'Skyddet stoppade ett steg: ' + errorText.replace(/^Nekad:\s*/, '').slice(0, 140);
    if (/Gränsen för/.test(errorText)) return errorText.slice(0, 140);
    return 'Ett steg misslyckades, försöker på annat sätt…';
  }
  if (!r || typeof r !== 'object') return null;
  switch (name) {
    case 'set_extraction': return typeof r.antal === 'number' ? 'Läste ut ' + n(r.antal, 'produkt', 'produkter') + (r.begransad ? ' (taket för testet nått)' : '') + '…' : null;
    case 'find_products': return typeof r.traffar === 'number' ? 'Hittade ' + n(r.traffar, 'produkt', 'produkter') + '…' : null;
    case 'search': return 'Sökningen är gjord…';
    case 'report_candidates': return 'Klart ✓';
    default: return null;
  }
}
