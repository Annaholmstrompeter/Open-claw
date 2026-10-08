#!/usr/bin/env node
// Startar försöket: öppnar en riktig Chrome på grossistens inloggning och en kontrollsida i den vanliga webbläsaren.
//   node src/cli.mjs --shop https://webbutiken.example/ [--model claude-sonnet-5-5] [--effort low] [--max-pages 100] [--out ./out] [--no-open]
//   node src/cli.mjs --demo        provar allt mot en PÅHITTAD butik på den här datorn (testkund / hemligt-123), utan någon florist och utan något riktigt konto
// Kräver ANTHROPIC_API_KEY i miljön (aldrig i en fil). Utan den går inloggningen att prova men agenten kan inte svara.
import { spawn } from 'node:child_process';
import Anthropic from '@anthropic-ai/sdk';
import { createSession } from './session.mjs';
import { startControlServer } from './server.mjs';

const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf('--' + name); return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : def; };
const flag = name => args.includes('--' + name);
let shop = opt('shop'), demoShop = null;
if (flag('demo')) {
  const { startMockShop, USER, PASS } = await import('../test/support/mock-shop.mjs');
  demoShop = await startMockShop(); shop = demoShop.url + '/sortiment';
  console.log('DEMO: en påhittad butik körs lokalt. Logga in med  ' + USER + '  /  ' + PASS + '  (påhittade uppgifter). Inget riktigt konto används.');
}
if (!shop || flag('help')) {
  console.log('Användning: node src/cli.mjs --shop <webbutikens adress> [--model claude-sonnet-5-5] [--effort low|medium|high] [--max-pages 100] [--out ./out] [--no-open]\n            node src/cli.mjs --demo   (provar mot en påhittad butik)');
  console.log('Exempel:    ANTHROPIC_API_KEY=… node src/cli.mjs --shop https://shop.blomstergrossisten.net/   (adressen är ej verifierad, kontrollera den i floristens webbläsare)');
  process.exit(shop ? 0 : 2);
}
if (!process.env.ANTHROPIC_API_KEY) console.warn('OBS: ANTHROPIC_API_KEY saknas. Inloggningen går att prova, men agenten kan inte svara.');

let server, session;
try {
  session = await createSession({
    shopUrl: shop, model: opt('model', 'claude-sonnet-5-5'), effort: opt('effort', 'low'), headless: flag('headless'), extraArgs: flag('no-sandbox') ? ['--no-sandbox'] : [],
    executablePath: process.env.CHROME_PATH || undefined,
    limits: { maxPageLoads: Number(opt('max-pages', '100')), minGapMs: 2000 },
    makeClient: () => new Anthropic()
  });
  server = await startControlServer({ session, saveDir: opt('out', './out'), onEnd: () => { if (demoShop) demoShop.close().catch(() => {}); process.exit(0); } });
} catch (e) { console.error('Kunde inte starta: ' + e.message); process.exit(1); }

console.log('\nEn Chrome har öppnats på grossistens inloggning. Logga in där (aldrig här).');
console.log('Kontrollsidan (öppna i din vanliga webbläsare):\n  ' + server.url + '\n');
if (!flag('no-open')) {
  const cmd = process.platform === 'darwin' ? ['open', [server.url]] : process.platform === 'win32' ? ['cmd', ['/c', 'start', '', server.url]] : ['xdg-open', [server.url]];
  try { spawn(cmd[0], cmd[1], { stdio: 'ignore', detached: true }).on('error', () => {}).unref(); } catch (e) { /* öppna adressen för hand */ }
}
const stop = async () => { try { await session.end(); } catch (e) { /* redan stängd */ } if (demoShop) await demoShop.close().catch(() => {}); process.exit(0); };
process.on('SIGINT', stop); process.on('SIGTERM', stop);
