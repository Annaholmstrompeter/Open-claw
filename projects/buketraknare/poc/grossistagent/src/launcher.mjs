#!/usr/bin/env node
// Startpunkten för floristens och Annas dubbelklickfiler:
//   setup       en gång: kontrollerar Node och Chrome och lägger in API-nyckeln på ett säkert sätt (den syns inte när du skriver)
//   start       startar kontrollsidan. Där väljer du DEMO eller RIKTIG GROSSIST, och Chrome öppnas
//   delete-key  raderar den sparade nyckeln
// Nyckeln skrivs aldrig ut, loggas aldrig och sparas aldrig i repot (se secrets.mjs).
import { spawn } from 'node:child_process';
import readline from 'node:readline/promises';
import { pathToFileURL } from 'node:url';
import { createSession } from './session.mjs';
import { startControlServer } from './server.mjs';
import { createAiService, createAiClient, checkAi, API_BASE } from './ai.mjs';
import { loadKey, saveKey, deleteKey, readHidden, looksLikeKey, keyPaths, redact } from './secrets.mjs';
import { findChrome } from './launch.mjs';
import { startMockShop } from './demo-shop.mjs';

const args = process.argv.slice(2);
const cmd = args[0];
const opt = (name, def) => { const i = args.indexOf('--' + name); return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : def; };
const flag = name => args.includes('--' + name);
const say = (...a) => console.log(...a);
const MODEL = opt('model', 'claude-sonnet-5-5');
const API = opt('test-api', API_BASE);            // --test-api godtas bara om adressen är lokal (testserver). Läses aldrig från miljön.
const line = '────────────────────────────────────────────────────────────';

const KEY_HELP = [
  'Så får du en API-nyckel (gör det i din vanliga webbläsare):',
  '  1. Gå till  https://platform.claude.com  och logga in (eller skapa ett konto).',
  '  2. Lägg in en liten summa under Plans & Billing, till exempel 10 dollar. Då kan det aldrig kosta mer än så.',
  '  3. Gå till Settings → API Keys → Create Key. Ge den ett namn, till exempel "grossistagent". Kopiera nyckeln (den börjar med sk-ant-).',
  '  4. Tips: under Limits för arbetsytan kan du sätta ett utgiftstak. Menynamnen kan se lite annorlunda ut.',
  '  Nyckeln visas bara en gång hos Anthropic. Skicka den aldrig till någon, och klistra aldrig in den i en chatt.'
].join('\n');

async function yesNo(q, def = false) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try { const a = (await rl.question(q + (def ? ' (J/n) ' : ' (j/N) '))).trim().toLowerCase(); if (!a) return def; return a.startsWith('j') || a.startsWith('y'); } finally { rl.close(); }
}

/** Provar en nyckel mot Anthropic utan att spara den. */
async function tryKey(key) { return checkAi({ client: createAiClient({ apiKey: key, baseURL: API }), model: MODEL }); }

async function setup() {
  say('\n' + line + '\n GROSSISTAGENT: SETUP (görs en gång)\n' + line);
  const major = Number(process.versions.node.split('.')[0]);
  if (major < 20) { say('✗ Node.js ' + process.versions.node + ' är för gammal. Installera version 20 eller senare från https://nodejs.org (välj LTS).'); process.exitCode = 1; return; }
  say('✓ Node.js ' + process.versions.node);
  const chrome = findChrome();
  if (chrome) say('✓ Google Chrome hittades'); else say('✗ Google Chrome hittades inte. Installera det från https://www.google.com/chrome/ och kör SETUP igen. (Har du Chrome på ett ovanligt ställe: se README.)');

  const existing = loadKey();
  say('\nAPI-nyckel för AI-modellen:');
  if (existing.key) {
    say('✓ En nyckel finns redan (' + existing.source + ').');
    if (existing.source.startsWith('miljö')) say('  (Den kommer från en miljövariabel och byts inte här.)');
    else if (!(await yesNo('  Vill du byta ut den?'))) { await finish(chrome); return; }
    else say('');
  }
  if (!existing.key || !existing.source.startsWith('miljö')) {
    say(KEY_HELP + '\n');
    for (let attempt = 1; attempt <= 3; attempt++) {
      let typed;
      try { typed = await readHidden('Klistra in nyckeln här och tryck Enter (den syns inte på skärmen): '); } catch (e) { say('Avbrutet.'); process.exitCode = 1; return; }
      if (!typed) { say('Inget inklistrat.'); continue; }
      if (!looksLikeKey(typed)) { say('✗ Det där ser inte ut som en Anthropic-nyckel (den börjar med sk-ant- och är lång). Försök igen.'); continue; }
      say('  Kontrollerar nyckeln hos Anthropic (kostar ungefär 0,04 kr)…');
      const r = await tryKey(typed);
      if (!r.ok && r.kind === 'auth') { say('✗ ' + r.message + '\n'); continue; }
      const file = saveKey(typed);
      typed = null;
      say('✓ Nyckeln är sparad i  ' + file + '  (utanför repot; bara ditt användarkonto har tillgång).');
      say(r.ok ? r.message : '! Nyckeln är sparad men gick inte att verifiera nu:\n  ' + r.message);
      await finish(chrome);
      return;
    }
    say('✗ Ingen nyckel sparades. Kör SETUP igen när du har nyckeln.'); process.exitCode = 1; return;
  }
  await finish(chrome);
}

async function finish(chrome) {
  say('\n' + line);
  say(chrome ? ' KLART. Nästa steg: dubbelklicka på  2-STARTA-GROSSISTAGENT.' : ' Nästan klart: installera Chrome (se ovan), sedan dubbelklicka på  2-STARTA-GROSSISTAGENT.');
  say(line + '\n');
}

async function removeKey() {
  say('\n' + line + '\n GROSSISTAGENT: RADERA NYCKELN\n' + line);
  const { file } = keyPaths();
  if (!(await yesNo('Radera den sparade API-nyckeln (' + file + ')?'))) { say('Ingenting raderades.'); return; }
  deleteKey();
  say('✓ Den sparade nyckeln är raderad från den här datorn.');
  if (process.env.ANTHROPIC_API_KEY) say('! Obs: en nyckel finns också i miljövariabeln ANTHROPIC_API_KEY. Den rörs inte härifrån.');
  say('Vill du göra nyckeln obrukbar helt: radera den i Anthropics konsol (platform.claude.com → Settings → API Keys).\n');
}

function openInBrowser(url) {
  const c = process.platform === 'darwin' ? ['open', [url]] : process.platform === 'win32' ? ['cmd', ['/c', 'start', '', url]] : ['xdg-open', [url]];
  try { spawn(c[0], c[1], { stdio: 'ignore', detached: true }).on('error', () => {}).unref(); } catch (e) { /* adressen skrivs ut nedan */ }
}

/**
 * Sätter ihop programmet: AI-tjänsten, Chrome-sökvägen och funktionen som startar en session (DEMO eller RIKTIG GROSSIST).
 * Används av start() och av testerna (som kör hela kedjan i samma process).
 */
export function buildApp({ env = process.env, model = MODEL, baseURL = API, chromePath = env.CHROME_PATH || findChrome(env), headless = false, extraArgs = [], say: log = () => {} } = {}) {
  const ai = createAiService({ env, model, baseURL });
  let demoShop = null;
  const chrome = chromePath ? { ok: true } : { ok: false, message: 'Google Chrome hittades inte. Installera Chrome (https://www.google.com/chrome/) och starta om.' };
  const closeDemo = async () => { if (demoShop) { await demoShop.close().catch(() => {}); demoShop = null; } };
  const begin = async (mode, { shopUrl }) => {
    let url;
    if (mode === 'demo') { demoShop = await startMockShop(); url = demoShop.url + '/sortiment'; }
    else {
      let u; try { u = new URL(String(shopUrl || '').trim()); } catch (e) { throw new Error('Webbutikens adress är ogiltig. Den ska börja med https://'); }
      if (u.protocol !== 'https:') throw new Error('Webbutikens adress måste börja med https://');
      url = u.href;
    }
    try {
      const session = await createSession({ shopUrl: url, mode, model, executablePath: chromePath || undefined, headless, extraArgs, makeClient: () => ai.makeClient() });
      log('  ▶ Session startad (' + (mode === 'demo' ? 'DEMO' : 'RIKTIG GROSSIST') + '). Chrome är öppen.');
      return session;
    } catch (e) { await closeDemo(); throw new Error(redact(e.message)); }
  };
  return { ai, begin, chrome, closeDemo, demoShop: () => demoShop };
}

async function start() {
  const app = buildApp({ headless: flag('headless'), extraArgs: flag('no-sandbox') ? ['--no-sandbox'] : [], say });
  const server = await startControlServer({
    ai: app.ai, begin: app.begin, chrome: app.chrome, saveDir: opt('out', './out'),
    onEnd: async () => { say('  ■ Sessionen är avslutad och raderad.'); await app.closeDemo(); },
    onQuit: async () => { await app.closeDemo(); say('Programmet är stängt.'); process.exit(0); }
  });
  say('\n' + line + '\n GROSSISTAGENT\n' + line);
  say('Kontrollsidan öppnas i din vanliga webbläsare. Låt det här fönstret vara öppet medan du jobbar.');
  say('Om sidan inte öppnas av sig själv, kopiera den här adressen till webbläsaren:\n  ' + server.url + '\n');
  if (!flag('no-open')) openInBrowser(server.url);
  const r = await app.ai.check();
  say(r.ok ? r.message + '  (modell ' + MODEL + ')' : '✗ ' + r.message);
  const stop = async () => { const s = server.session(); if (s) await s.end().catch(() => {}); await app.closeDemo(); process.exit(0); };
  process.on('SIGINT', stop); process.on('SIGTERM', stop);
  return server;
}

export async function main() {
  process.on('uncaughtException', e => { console.error('\nOväntat fel: ' + redact(e && e.message || e)); process.exit(1); });
  process.on('unhandledRejection', e => { console.error('\nOväntat fel: ' + redact(e && e.message || e)); process.exit(1); });
  try {
    if (cmd === 'setup') return await setup();
    if (cmd === 'start') return await start();
    if (cmd === 'delete-key') return await removeKey();
    say('Användning: node src/launcher.mjs setup | start | delete-key');
    process.exitCode = 2;
  } catch (e) {
    console.error('\nNågot gick fel: ' + redact(e && e.message || e));
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
