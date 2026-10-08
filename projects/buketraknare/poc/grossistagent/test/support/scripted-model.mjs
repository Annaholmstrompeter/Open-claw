// Ett MANUS som beter sig som en välartad modell: observe → search → inspect_json → set_extraction → find_products → report_candidates.
// Det är inte en AI och bevisar inget om modellens omdöme. Det används för att köra självtestets hela kedja (kontrollsida → session → verktyg → butik → kontroller)
// utan en riktig modell, och för att provoceras: en "dålig modell" som hittar på artiklar, ändrar förpackning eller försöker lägga i varukorg ska fångas av kontrollerna.
import { toolUse, parse } from './fake-client.mjs';

export const FIELDS = { id: 'artikelnr', name: 'benamning', variant: 'sort', color: 'farg', lengthCm: 'langd_cm', packSize: 'forpackning.antal', price: 'pris.belopp', priceUnit: 'pris.per', priceIncludesVat: 'pris.inklmoms', currency: 'pris.valuta', availability: 'lager.status', offer: 'kampanj' };

/** spec: { searches: ['ros'], find: {…}, picks: [{ id, reason, needed? }], summary, extraTool?: [name, input] } → lista med steg för fake-anthropic. */
export function taskSteps(spec) {
  // beforeFirst: något som händer "utanför" modellen mitt i uppgiften (testet använder det för att låtsas att skyddet brustit och ett muterande anrop nått butiken)
  const steps = [spec.beforeFirst ? async () => { await spec.beforeFirst(); return toolUse('observe', {}); } : toolUse('observe', {})];
  for (const q of spec.searches) {
    let j = null;
    steps.push(toolUse('search', { text: q }));
    steps.push((body, results) => { j = parse(results[0]).json_svar.at(-1).id; return toolUse('inspect_json', { response_id: j, path: 'resultat.artiklar' }); });
    steps.push(() => toolUse('set_extraction', { source: 'json', response_id: j, items_path: 'resultat.artiklar', fields: FIELDS }));
  }
  if (spec.extraTool) steps.push(toolUse(spec.extraTool[0], spec.extraTool[1]));
  steps.push(toolUse('find_products', spec.find || {}));
  steps.push(toolUse('report_candidates', { picks: spec.picks, summary: spec.summary || 'Förslag.' }));
  return steps;
}

/** Ett manus per självtestuppgift, i samma ordning som SELFTEST_TASKS. Kan skrivas över per uppgift (over: { t1: spec, … }). */
export const GOOD_SPECS = {
  t1: { searches: ['ros'], find: { text: 'ros', color: 'vit' }, picks: [{ id: 'R-1001', reason: 'Ren vit, 60 cm', needed: 25 }, { id: 'R-1003', reason: 'Krämvit, romantisk', needed: 25 }], summary: 'Två passande sorter.' },
  t2: { searches: ['ros'], find: { text: 'ros', min_length_cm: 60 }, picks: [{ id: 'R-1001', reason: 'Vit, 60 cm' }, { id: 'R-1003', reason: 'Krämvit, 60 cm' }] },
  t3: { searches: ['ros', 'eukalyptus'], find: {}, picks: [{ id: 'R-1003', reason: 'Krämvit, mjuk' }, { id: 'R-1001', reason: 'Vit' }, { id: 'E-4001', reason: 'Grönt som finns' }] },
  t4: { searches: ['ros'], find: { text: 'ros' }, picks: [{ id: 'R-1005', reason: 'Veckans erbjudande, men slut i lager' }] },
  t5: { searches: ['eukalyptus'], find: {}, picks: [{ id: 'E-4001', reason: 'Eukalyptus Cinerea', needed: 30 }] }
};

export const selftestSteps = (over = {}) => ['t1', 't2', 't3', 't4', 't5'].flatMap(k => taskSteps(over[k] || GOOD_SPECS[k]));
