// Startar en riktig webbläsare på den här datorn, med en tom profil i minnet (inget sparas på disk av oss, och Playwright raderar sin tillfälliga mapp när den stängs).
// Floristen loggar in direkt i det fönstret. Lösenordet passerar aldrig den här koden. Chrome erbjuder inte att spara lösenord i ett sådant privat fönster.
// Vi döljer inte att webbläsaren styrs: standardflaggorna behålls (Chrome visar sin "styrs av automatiserad programvara"-rad).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright-core';
import { envWithoutSecrets } from './secrets.mjs';

export function findChrome(env = process.env, platform = process.platform, exists = fs.existsSync) {
  if (env.CHROME_PATH) return exists(env.CHROME_PATH) ? env.CHROME_PATH : null;
  const list = platform === 'darwin' ? ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Chromium.app/Contents/MacOS/Chromium']
    : platform === 'win32' ? [env['PROGRAMFILES'] + '\\Google\\Chrome\\Application\\chrome.exe', env['PROGRAMFILES(X86)'] + '\\Google\\Chrome\\Application\\chrome.exe', env['LOCALAPPDATA'] + '\\Google\\Chrome\\Application\\chrome.exe']
    : ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser'];
  return list.find(p => p && exists(p)) || null;
}

export const BASE_ARGS = ['--no-first-run', '--no-default-browser-check', '--disable-sync', '--disable-extensions', '--disable-background-networking'];

/** Ger { browser, context, page, tmpParent }. Utan executablePath används den installerade Google Chrome (channel: chrome). */
export async function launchLocal({ executablePath, headless = false, extraArgs = [] } = {}) {
  const opts = { headless, args: [...BASE_ARGS, ...extraArgs] };
  const exe = executablePath || process.env.CHROME_PATH;
  if (exe) opts.executablePath = exe; else opts.channel = 'chrome';
  // Webbläsarens tillfälliga mappar läggs i en egen föräldramapp som vi själva raderar vid avslut (och som gör det exakt att kontrollera att inget finns kvar).
  const tmpParent = fs.mkdtempSync(path.join(os.tmpdir(), 'grossistagent-'));
  const saved = { TMPDIR: process.env.TMPDIR, TEMP: process.env.TEMP, TMP: process.env.TMP };
  process.env.TMPDIR = process.env.TEMP = process.env.TMP = tmpParent;
  opts.env = envWithoutSecrets(process.env);            // webbläsaren får aldrig se API-nyckeln eller andra hemligheter i miljön
  let browser;
  try { browser = await chromium.launch(opts); }
  catch (e) { fs.rmSync(tmpParent, { recursive: true, force: true }); throw new Error('Kunde inte starta Chrome: ' + String(e.message).split('\n')[0].slice(0, 160) + '. Installera Google Chrome, eller ange CHROME_PATH (se README).'); }
  finally { for (const [k, v] of Object.entries(saved)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; } }
  const context = await browser.newContext({ viewport: headless ? { width: 1280, height: 900 } : null, serviceWorkers: 'block', acceptDownloads: false, locale: 'sv-SE' });
  const page = await context.newPage();
  return { browser, context, page, tmpParent };
}
