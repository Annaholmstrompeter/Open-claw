// Gemensamt för webbläsartesterna: en riktig Chromium (lokal), en tom profil i minnet och en "människa" som loggar in.
import fs from 'node:fs';
import { chromium } from 'playwright-core';
import { USER, PASS } from './mock-shop.mjs';

export const CHROME = process.env.CHROME_PATH || ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome', '/usr/bin/chromium', '/usr/bin/google-chrome'].find(p => fs.existsSync(p));
export const wait = ms => new Promise(r => setTimeout(r, ms));

export async function launchTestBrowser() {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox', '--no-first-run'] });
  const context = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  return { browser, context, page };
}

/** Människan loggar in direkt på butikens egen inloggningssida. Uppgifterna går aldrig genom PoC:ns kod. */
export async function humanLogin(page, shopUrl) {
  await page.goto(shopUrl + '/login');
  await page.fill('#user', USER);
  await page.fill('#pass', PASS);
  await Promise.all([page.waitForURL('**/sortiment**'), page.click('button[type=submit]')]);
}
