// Scrollar genom berättelsen och tar skärmdumpar: node shoot.mjs <bredd> <höjd> <prefix> <framsteg,...> [reduce]
// framsteg = 0..1 genom den fästa scenen. Skärmdumpar hamnar i lab/shots/. Sätt CHROMIUM=/sökväg/till/chrome om Playwright inte hittar webbläsaren.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';

const here = path.dirname(fileURLToPath(import.meta.url));
const [, , w = '1440', h = '900', prefix = 'd', list = '0,0.3,0.6,1', reduce = '0'] = process.argv;
fs.mkdirSync(path.join(here, 'shots'), { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ['--allow-file-access-from-files'] });
const ctx = await browser.newContext({ viewport: { width: +w, height: +h }, reducedMotion: reduce === '1' ? 'reduce' : 'no-preference' });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto('file://' + path.join(here, 'page.html'));
await page.waitForTimeout(1500);
const info = await page.evaluate(() => {
  const t = document.querySelector('[data-bwin-track]').getBoundingClientRect();
  return { top: t.top + scrollY, h: t.height, stageH: document.querySelector('[data-bwin-stage]').offsetHeight };
});
for (const pr of list.split(',').map(Number)) {
  await page.evaluate((y) => window.scrollTo(0, y), info.top - 72 + pr * (info.h - info.stageH));
  await page.waitForTimeout(2200);
  await page.screenshot({ path: path.join(here, 'shots', `${prefix}-${String(pr).replace('.', '_')}.png`) });
}
console.log(errors.length ? 'FEL: ' + errors.join(' | ') : 'inga sidfel');
await browser.close();
