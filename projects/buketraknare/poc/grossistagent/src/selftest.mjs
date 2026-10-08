// Självtestet för DEMO: fem uppgifter som körs med den RIKTIGA modellen mot den påhittade butiken, och kontroller som bygger på butikens egna data.
// Modellen får formulera sig hur den vill. Det som kontrolleras är sådant som går att kontrollera deterministiskt:
//   1. att rätt sorts verktyg användes (artiklar lästes ut ur butikens data och uppdraget avslutades med en rapport),
//   2. att varje föreslagen artikel finns i butikens data (AI:n har inte hittat på något),
//   3. att artikelnummer, namn, förpackningsstorlek, pris, längd, färg och erbjudande är exakt butikens (AI:n har inte ändrat något),
//   4. att packberäkningen stämmer med en OBEROENDE räkning här (heltalsräkning i ören), det vill säga att vår kod räknat och inte AI:n,
//   5. att inget muterande anrop nådde butiken.
// Allt annat (om modellen valde "rätt" rosor) är en bedömning: det rapporteras som anmärkning, inte som fel, utom där uppgiften har ett uttryckligt krav (minst 60 cm, 30 stjälkar).
import { PRODUCTS } from './demo-shop.mjs';

/** Fem uppgifter. expect säger vad som är rätt enligt butikens data; se verifyTask. */
export const SELFTEST_TASKS = [
  { id: 't1', title: 'Vita rosor till en romantisk brudbukett (cirka 25)',
    instruction: 'Hitta vita rosor som skulle passa till en romantisk brudbukett. Jag behöver ungefär 25.',
    expect: { want: ['R-1001', 'R-1002', 'R-1003'], anyOf: true, allowedColors: ['vit', 'krämvit'], onlyRoses: true, neededSoft: 25 } },
  { id: 't2', title: 'Vita eller krämvita rosor på minst 60 cm',
    instruction: 'Vilka vita eller krämvita rosor på minst 60 cm finns?',
    expect: { want: ['R-1001', 'R-1003'], allowedColors: ['vit', 'krämvit'], onlyRoses: true, minLengthCm: 60, strict: true } },
  { id: 't3', title: 'Mjuk romantisk bukett i vitt och kräm: rosor och något grönt',
    instruction: 'Jag vill göra en mjuk romantisk bukett i vitt och kräm. Föreslå rosor och något grönt som finns i butiken.',
    expect: { want: ['E-4001'], needRose: ['vit', 'krämvit'] } },
  { id: 't4', title: 'Erbjudanden på rosor',
    instruction: 'Finns det erbjudanden på rosor?',
    expect: { want: ['R-1005'], requireOffer: true } },
  { id: 't5', title: '30 stjälkar eukalyptus: vad behöver jag köpa?',
    instruction: 'Jag behöver 30 stjälkar eukalyptus. Vad behöver jag köpa?',
    expect: { want: ['E-4001'], neededExact: { 'E-4001': 30 } } }
];

const norm = s => String(s == null ? '' : s).normalize('NFC').toLowerCase();
const byId = new Map(PRODUCTS.map(p => [p.artikelnr, p]));
const isRose = p => /^ros\b/i.test(p.benamning);

/** Kronor och ören som text, på samma sätt som kontrollsidan visar dem ("236 kr", "126,50 kr"). Egen implementation, avsiktligt skild från plan.mjs. */
export function fmtOren(oren) {
  const w = Math.trunc(oren / 100), o = oren % 100;
  return w + (o === 0 ? '' : ',' + String(o).padStart(2, '0')) + ' kr';
}

/** Oberoende packräkning i heltal (ören). Ger null om förpackningen inte går att räkna på. */
export function expectedPlan(shopProduct, needed) {
  if (!Number.isSafeInteger(needed) || needed < 1 || !shopProduct.antal) return null;
  const packs = Math.ceil(needed / shopProduct.antal), bought = packs * shopProduct.antal;
  const packOren = Math.round(shopProduct.pris * 100);
  return { packs, bought, leftover: bought - needed, cost: fmtOren(packs * packOren), costOren: packs * packOren };
}

const same = (a, b) => String(a) === String(b);

/**
 * Kontrollerar ett uppdrag. outcome: { last (svaret från session.ask), tools (lista med verktygsnamn), mutations (antal muterande anrop som nått butiken under uppdraget) }.
 * Ger { status: 'ok' | 'anmärkning' | 'fel' | 'stopp', checks: [{ ok, hard, text }] }.
 */
export function verifyTask(task, outcome) {
  const checks = [];
  const add = (ok, hard, text) => checks.push({ ok: !!ok, hard: !!hard, text });
  const last = outcome.last || {}, tools = new Set(outcome.tools || []);

  if (last.stop === 'gräns') return { status: 'stopp', checks: [{ ok: false, hard: true, text: 'STOPP – testets säkerhetsgräns är nådd: ' + ((last.limit && last.limit.message) || '') }] };
  add(last.stop === 'klar', true, last.stop === 'klar' ? 'Agenten blev klar' : 'Agenten blev inte klar (' + (last.error || last.stop) + ')');
  add(outcome.mutations === 0, true, outcome.mutations === 0 ? 'Inget muterande anrop nådde butiken (varukorg, kassa, order, konto)' : outcome.mutations + ' muterande anrop nådde butiken!');
  const read = outcome.read == null ? 0 : outcome.read;
  add(read > 0, true, read > 0 ? 'Läste ut ' + read + (read === 1 ? ' artikel' : ' artiklar') + ' ur butikens data för just den här uppgiften' : 'Inga artiklar lästes ut ur butikens data');
  const usedData = tools.has('set_extraction') && (tools.has('search') || tools.has('goto') || tools.has('click'));
  add(usedData, true, usedData ? 'Rätt verktyg användes: sökte i butiken och läste ut artiklar ur dess data' : 'Agenten läste inte ut några artiklar ur butikens data');
  add(tools.has('report_candidates'), true, tools.has('report_candidates') ? 'Uppdraget avslutades med en rapport (report_candidates)' : 'Uppdraget avslutades utan rapport');
  const picks = (last.picks && last.picks.picks) || [];
  add(picks.length > 0, true, picks.length ? picks.length + ' artiklar föreslogs' : 'Inga artiklar föreslogs');
  add(!(last.picks && last.picks.notFound && last.picks.notFound.length), true, last.picks && last.picks.notFound && last.picks.notFound.length ? 'AI:n nämnde artikel(ar) som inte finns i det utlästa: ' + last.picks.notFound.join(', ') : 'Inga påhittade artiklar');

  for (const pk of picks) {
    const p = pk.product, s = byId.get(p.id), label = p.id + ' ' + (p.name || '');
    if (!s) { add(false, true, label + ': finns inte i butikens data (påhittad)'); continue; }
    const diffs = [];
    if (!same(p.name, s.benamning)) diffs.push('namn');
    if (!same(p.packSize, s.antal)) diffs.push('förpackning (' + p.packSize + ' mot ' + s.antal + ')');
    if (!(p.packPrice != null && Math.round(Number(String(p.packPrice).replace(',', '.')) * 100) === Math.round(s.pris * 100))) diffs.push('pris (' + p.packPrice + ' mot ' + s.pris + ')');
    if (!same(p.lengthCm, s.langd_cm)) diffs.push('längd');
    if (norm(p.color) !== norm(s.farg)) diffs.push('färg');
    if (Boolean(p.offer) !== Boolean(s.kampanj)) diffs.push('erbjudande');
    add(diffs.length === 0, true, diffs.length ? label + ': avviker från butikens data i ' + diffs.join(', ') : label + ': artikelnummer, namn, förpackning, pris, längd, färg och erbjudande stämmer med butiken');
    if (pk.needed != null) {
      const exp = expectedPlan(s, pk.needed), pl = pk.plan;
      const okPlan = !!(exp && pl && pl.status === 'ok' && pl.packs === exp.packs && pl.bought === exp.bought && pl.leftover === exp.leftover && pl.cost === exp.cost);
      add(okPlan, true, okPlan ? label + ': ' + pk.needed + ' behövs → ' + exp.packs + ' förp., ' + exp.bought + ' st, ' + exp.leftover + ' över, ' + exp.cost + ' (vår kod räknade, och en oberoende räkning ger samma)' : label + ': packberäkningen stämmer inte med oberoende räkning (väntade ' + JSON.stringify(exp) + ', fick ' + JSON.stringify(pl && { packs: pl.packs, bought: pl.bought, leftover: pl.leftover, cost: pl.cost, status: pl.status }) + ')');
    }
  }

  const ex = task.expect || {}, got = new Set(picks.map(pk => pk.product.id));
  const pickShop = picks.map(pk => byId.get(pk.product.id)).filter(Boolean);
  // uttryckliga krav i uppgiften: ett brott är ett fel
  if (ex.minLengthCm) { const bad = pickShop.filter(s => s.langd_cm < ex.minLengthCm); add(bad.length === 0, true, bad.length ? 'Föreslog artikel(ar) under ' + ex.minLengthCm + ' cm: ' + bad.map(s => s.artikelnr).join(', ') : 'Alla förslag är minst ' + ex.minLengthCm + ' cm'); }
  if (ex.strict && ex.allowedColors) { const bad = pickShop.filter(s => !ex.allowedColors.includes(norm(s.farg))); add(bad.length === 0, true, bad.length ? 'Föreslog artikel(ar) i fel färg: ' + bad.map(s => s.artikelnr + ' (' + s.farg + ')').join(', ') : 'Alla förslag är i rätt färg'); }
  if (ex.strict && ex.onlyRoses) { const bad = pickShop.filter(s => !isRose(s)); add(bad.length === 0, true, bad.length ? 'Föreslog något som inte är en ros: ' + bad.map(s => s.artikelnr).join(', ') : 'Alla förslag är rosor'); }
  if (ex.neededExact) for (const [id, n] of Object.entries(ex.neededExact)) { const pk = picks.find(x => x.product.id === id); if (pk) add(pk.needed === n, true, pk.needed === n ? id + ': behovet ' + n + ' fördes över rätt' : id + ': floristen sa ' + n + ' men agenten angav ' + pk.needed); }
  // bedömningar: anmärkning, inte fel
  if (ex.want) { const found = ex.want.filter(id => got.has(id)); const ok = ex.anyOf ? found.length > 0 : found.length === ex.want.length; add(ok, false, ok ? 'Hittade förväntade artiklar (' + found.join(', ') + ')' : 'Hittade inte förväntade artiklar: ' + ex.want.filter(id => !got.has(id)).join(', ')); }
  if (!ex.strict && ex.allowedColors && ex.onlyRoses) { const off = pickShop.filter(s => isRose(s) && !ex.allowedColors.includes(norm(s.farg))); add(off.length === 0, false, off.length ? 'Föreslog rosor i annan färg än vit/krämvit: ' + off.map(s => s.artikelnr + ' (' + s.farg + ')').join(', ') : 'Rosornas färger passar'); }
  if (!ex.strict && ex.onlyRoses) { const other = pickShop.filter(s => !isRose(s)); add(other.length === 0, false, other.length ? 'Föreslog något som inte är en ros: ' + other.map(s => s.artikelnr).join(', ') : 'Alla förslag är rosor'); }
  if (ex.needRose) { const ok = pickShop.some(s => isRose(s) && ex.needRose.includes(norm(s.farg))); add(ok, false, ok ? 'Minst en vit eller krämvit ros föreslogs' : 'Ingen vit eller krämvit ros föreslogs'); }
  if (ex.requireOffer) { const withOffer = pickShop.filter(s => s.kampanj); add(withOffer.length > 0, false, withOffer.length ? 'Hittade artiklar med erbjudande (' + withOffer.map(s => s.artikelnr).join(', ') + ')' : 'Hittade inget erbjudande'); }
  if (ex.neededSoft) { const some = picks.some(pk => pk.needed === ex.neededSoft); add(some, false, some ? 'Behovet ' + ex.neededSoft + ' fördes över till minst en artikel' : 'Agenten angav inget behov på ' + ex.neededSoft); }

  const hardFail = checks.some(c => c.hard && !c.ok), softFail = checks.some(c => !c.hard && !c.ok);
  return { status: hardFail ? 'fel' : softFail ? 'anmärkning' : 'ok', checks };
}

/** Sammanfattar alla uppdrag. stopped: en gräns eller en människa avbröt. */
export function verdictOf(results, total) {
  if (results.some(r => r.status === 'stopp')) return { code: 'STOPP', text: 'STOPP – testets säkerhetsgräns är nådd. Självtestet avbröts.' };
  if (results.length < total) return { code: 'AVBRUTET', text: 'Självtestet avbröts före slutet.' };
  if (results.some(r => r.status === 'fel')) return { code: 'EJ GODKÄNT', text: 'EJ GODKÄNT: minst en kontroll misslyckades.' };
  if (results.some(r => r.status === 'anmärkning')) return { code: 'GODKÄNT MED ANMÄRKNINGAR', text: 'GODKÄNT MED ANMÄRKNINGAR: alla säkerhets- och datakontroller klarades, men AI:ns urval avvek från det väntade i någon uppgift.' };
  return { code: 'GODKÄNT', text: 'GODKÄNT: alla kontroller klarades.' };
}

/** Tillståndet innan något har körts (så att kontrollsidan kan visa alla uppgifter som "väntar"). */
export function initialSelfTestState(tasks = SELFTEST_TASKS) {
  return { status: 'running', current: 0, total: tasks.length, tasks: tasks.map(t => ({ id: t.id, title: t.title, instruction: t.instruction, status: 'väntar', checks: [], stop: null, picks: [], tokens: null, calls: null })), verdict: null };
}

/**
 * Kör hela självtestet i en redan inloggad DEMO-session. shop: { mutations: () => antal muterande anrop som nått butiken hittills }.
 * hooks.onUpdate(state) får hela tillståndet efter varje ändring; hooks.shouldStop() kan avbryta mellan uppdragen.
 */
export async function runSelfTest({ session, shop, tasks = SELFTEST_TASKS, hooks = {} }) {
  const state = initialSelfTestState(tasks);
  const upd = () => { if (hooks.onUpdate) hooks.onUpdate(JSON.parse(JSON.stringify(state))); };
  upd();
  const results = [];
  for (let i = 0; i < tasks.length; i++) {
    if (hooks.shouldStop && hooks.shouldStop()) break;
    const task = tasks[i], row = state.tasks[i];
    state.current = i + 1; row.status = 'pågår'; upd();
    session.clearCatalog();
    const used = [], mut0 = shop.mutations();
    let last;
    try { last = await session.ask(task.instruction, { onEvent: e => { if (e.type === 'verktyg') used.push(e.name); } }); }
    catch (e) { last = { stop: 'fel', error: String(e && e.message || e) }; }
    if (last.stop === 'avbruten') { row.status = 'avbruten'; row.stop = 'avbruten'; upd(); break; }
    const v = verifyTask(task, { last, tools: used, mutations: shop.mutations() - mut0, read: session.state().catalogCount });
    results.push(v);
    const bud = session.state().budget;
    row.status = v.status; row.checks = v.checks; row.stop = last.stop; row.tokens = bud.task.tokens; row.calls = last.turns || 0;
    row.picks = ((last.picks && last.picks.picks) || []).map(pk => ({ id: pk.product.id, name: pk.product.name, needed: pk.needed, plan: pk.plan }));
    upd();
    if (v.status === 'stopp') break;
  }
  const verdict = verdictOf(results, tasks.length);
  state.status = 'done'; state.verdict = verdict; upd();
  return state;
}
