// Kontrollerna som 1-SETUP kör. Varje kontroll ger { id, ok, blocking, label, hint }: label säger vad som hittades, hint (på enkel svenska) vad Anna ska göra om det saknas.
// Kontrollerna ändrar ingenting bestående: de skriver och raderar en provfil, startar och stänger en tom Chrome, och öppnar och stänger en lokal port.
import fs from 'node:fs';
import os from 'node:os';
import net from 'node:net';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { findChrome, launchLocal } from './launch.mjs';
import { keyPaths } from './secrets.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
export const projectDir = path.resolve(here, '..');

const OS_NAME = { win32: 'Windows', darwin: 'Mac', linux: 'Linux' };

export function checkOs({ platform = process.platform, release = os.release(), arch = process.arch } = {}) {
  const name = OS_NAME[platform];
  if (!name) return { id: 'os', ok: false, blocking: true, label: 'Operativsystemet (' + platform + ') är inte provat', hint: 'Programmet är gjort för Windows och Mac (och Linux). Fråga Anna eller Claude hur du går vidare.' };
  return { id: 'os', ok: true, blocking: false, label: name + ' ' + release + ' (' + arch + ')' };
}

export function checkNode({ version = process.versions.node } = {}) {
  const major = Number(version.split('.')[0]);
  if (major < 20) return { id: 'node', ok: false, blocking: true, label: 'Node.js ' + version + ' är för gammal', hint: 'Installera Node.js version 20 eller senare från https://nodejs.org (välj LTS), starta om datorn och dubbelklicka på 1-SETUP igen.' };
  return { id: 'node', ok: true, blocking: false, label: 'Node.js ' + version };
}

/** Programmet läser Buketträknarens beräkningskod två mappar upp. Flyttas bara grossistagent-mappen ur den uppackade mappen fungerar inte beräkningen. */
export function checkProjectFolder({ dir = projectDir, exists = fs.existsSync } = {}) {
  const need = ['package.json', 'src/launcher.mjs', 'src/plan.mjs', '../../public/js/core/purchase.js', '../../public/js/core/money.js'];
  const missing = need.filter(f => !exists(path.join(dir, f)));
  if (missing.length) return { id: 'mapp', ok: false, blocking: true, label: 'Programmappen är ofullständig (saknar ' + missing.join(', ') + ')', hint: 'Packa upp hela ZIP-filen igen och använd mappen projects/buketraknare/poc/grossistagent därifrån. Flytta inte bara den mappen till ett annat ställe.' };
  return { id: 'mapp', ok: true, blocking: false, label: 'Programmappen är komplett' };
}

/** Beroendena (AI-biblioteket och webbläsarstyrningen) ska finnas under node_modules. */
export function checkDependencies({ dir = projectDir } = {}) {
  const req = createRequire(path.join(dir, 'package.json'));
  const out = [];
  for (const [pkg, what] of [['@anthropic-ai/sdk', 'AI-biblioteket'], ['playwright-core', 'webbläsarstyrningen']]) {
    try { req.resolve(pkg); } catch (e) { try { req.resolve(pkg + '/package.json'); } catch (e2) { out.push(what + ' (' + pkg + ')'); } }
  }
  if (out.length) return { id: 'beroenden', ok: false, blocking: true, label: 'Saknar: ' + out.join(', '), hint: 'Dubbelklicka på 1-SETUP igen med internet på. Den installerar det som saknas automatiskt (kan ta några minuter).' };
  return { id: 'beroenden', ok: true, blocking: false, label: 'Installerade bibliotek: AI-biblioteket och webbläsarstyrningen' };
}

/** Provar att skriva, läsa och radera en fil i en mapp. Skapar mappen om den saknas och tar bort den igen om vi skapade den. */
export function checkWritable(dir, name, { fsx = fs } = {}) {
  let created = false;
  try {
    if (!fsx.existsSync(dir)) { fsx.mkdirSync(dir, { recursive: true }); created = true; }
    const f = path.join(dir, '.grossistagent-skrivtest-' + process.pid);
    fsx.writeFileSync(f, 'ok'); const back = fsx.readFileSync(f, 'utf8'); fsx.rmSync(f, { force: true });
    if (back !== 'ok') throw new Error('läste inte tillbaka det som skrevs');
    if (created) { try { fsx.rmdirSync(dir); } catch (e) { /* innehåller något annat: lämna */ } }
    return { id: 'skriv:' + name, ok: true, blocking: false, label: 'Får skriva och radera i ' + name };
  } catch (e) {
    return { id: 'skriv:' + name, ok: false, blocking: true, label: 'Får inte skriva i ' + name + ' (' + dir + ')', hint: 'Programmet behöver kunna skapa tillfälliga filer där. Kontrollera att mappen inte är skrivskyddad, att disken inte är full, och att ett antivirusprogram inte blockerar. (' + String(e.code || e.message).slice(0, 60) + ')' };
  }
}

/** Kan en lokal port öppnas? Kontrollsidan väljer själv en ledig port, så det är sällan ett problem, men en brandvägg eller säkerhetsprogram kan stoppa det. */
export function checkLocalPort({ listen = (cb) => { const s = net.createServer(); s.once('error', e => cb(e)); s.listen(0, '127.0.0.1', () => { const port = s.address().port; s.close(() => cb(null, port)); }); } } = {}) {
  return new Promise(resolve => listen((err, port) => {
    if (err) resolve({ id: 'port', ok: false, blocking: true, label: 'Kunde inte öppna en lokal port (' + (err.code || err.message) + ')', hint: 'Ett säkerhetsprogram eller en brandvägg stoppar troligen programmet från att öppna en port på den egna datorn (127.0.0.1). Tillåt det för den här mappen och försök igen.' });
    else resolve({ id: 'port', ok: true, blocking: false, label: 'Lokal port ledig (provade port ' + port + '; programmet väljer själv en ledig port varje gång)' });
  }));
}

export function checkChromeFound({ env = process.env, platform = process.platform } = {}) {
  const exe = findChrome(env, platform);
  if (!exe) return { id: 'chrome', ok: false, blocking: true, label: 'Google Chrome hittades inte', hint: 'Installera Google Chrome från https://www.google.com/chrome/ och dubbelklicka på 1-SETUP igen. (Ligger Chrome på ett ovanligt ställe: se README, avsnittet om CHROME_PATH.)', exe: null };
  return { id: 'chrome', ok: true, blocking: false, label: 'Google Chrome hittades', exe };
}

/** Startar en tom, osynlig Chrome, öppnar en tom sida och stänger den igen. Bevisar att Chrome går att styra, och att den tillfälliga mappen raderas efteråt. */
export async function checkChromeStarts({ exe, launch = launchLocal, rm = p => fs.rmSync(p, { recursive: true, force: true }) } = {}) {
  let parent = null;
  try {
    const extra = typeof process.getuid === 'function' && process.getuid() === 0 ? ['--no-sandbox'] : [];
    const l = await launch({ executablePath: exe || undefined, headless: true, extraArgs: extra });
    parent = l.tmpParent;
    await l.page.goto('about:blank');
    const version = l.browser.version();
    await l.browser.close();
    if (parent) rm(parent);
    const left = parent && fs.existsSync(parent);
    return { id: 'chromestart', ok: !left, blocking: !!left, label: left ? 'Chrome startade men den tillfälliga mappen gick inte att radera' : 'Chrome startar och stängs utan rester (version ' + version + ')', hint: left ? 'Stäng alla Chrome-fönster och försök igen.' : undefined };
  } catch (e) {
    if (parent) { try { fs.rmSync(parent, { recursive: true, force: true }); } catch (e2) { /* ok */ } }
    return { id: 'chromestart', ok: false, blocking: true, label: 'Chrome gick inte att starta', hint: 'Stäng alla Chrome-fönster och försök igen. Fungerar det inte: installera om Google Chrome. Felet var: ' + String(e && e.message || e).split('\n')[0].slice(0, 160) };
  }
}

/** Alla kontroller utom nyckeln och AI-anslutningen (de görs av setup). Stannar vid första blockerande fel i grunderna (Node, mapp, beroenden), eftersom resten då inte går att prova. */
export async function runBasicChecks({ say = () => {}, env = process.env, skipChromeStart = false, nodeVersion = process.versions.node } = {}) {
  const results = [];
  const push = r => { results.push(r); say((r.ok ? '✓ ' : '✗ ') + r.label); if (!r.ok && r.hint) say('    → ' + r.hint); return r; };
  push(checkOs());
  if (!push(checkNode({ version: nodeVersion })).ok) return results;
  if (!push(checkProjectFolder()).ok) return results;
  if (!push(checkDependencies()).ok) return results;
  push(checkWritable(os.tmpdir(), 'den tillfälliga mappen'));
  push(checkWritable(keyPaths(env).dir, 'din användarmapp (där nyckeln sparas)'));
  push(checkWritable(path.join(process.cwd(), 'out'), 'mappen för rapporter'));
  push(await checkLocalPort());
  const chrome = push(checkChromeFound({ env }));
  if (chrome.ok && !skipChromeStart) push(await checkChromeStarts({ exe: chrome.exe }));
  return results;
}
