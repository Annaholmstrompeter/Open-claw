// Does TOGETHER leave the rest of the sanctuary exactly as it was?
// Renders every address of the sanctuary (welcome, the five rituals in all their states, about, close)
// in an older copy of the site and in this one, and lists every difference.
//
//   node e2e/regression.mjs [older git revision]        default: origin/ccr-b32990fc-q1bykk (the sanctuary before TOGETHER)
//
// Expected, and only this: the list of rituals gains the Rituals | Together tabs, the menu gains "Together" and "Home" (the way back to the front page; the logo is a link there too),
// the front page ('#/') is redesigned on purpose (2026-10-09, from Anna's mockup; no shop), and so is the list of rituals
// ('#/rituals': a carousel of five large pictures, 2026-10-09), and so is each ritual's own page ('#/r/<id>', 2026-10-09);
// so are the pages where the ritual is heard and what follows it (2026-10-10: the night ground with gold lines, the photograph rising out of the dark; the old label colours are gone);
// every other page gains a quiet "Home" link (a way back to the front page).
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { startServer } from './server.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const NEW = path.resolve(here, '../../public');
const REV = process.argv[2] || 'origin/ccr-b32990fc-q1bykk';
const CHROME = process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const repo = execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd: here }).toString().trim();
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bme-old-'));
execFileSync('sh', ['-c', `git -C "${repo}" archive "${REV}" sanctuary/public | tar -x -C "${tmp}"`]);
const OLD = path.join(tmp, 'sanctuary/public');

const routes = ['#/', '#/rituals', '#/about', '#/close'];
for (const id of ['balance', 'luminance', 'kindness', 'serenity', 'presence']) routes.push('#/r/' + id, '#/r/' + id + '/s', '#/r/' + id + '/e', '#/r/' + id + '/done');

const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
async function render(publicDir) {
  const srv = await startServer({ publicDir, recording: null, mockUrl: null });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  const page = await ctx.newPage();
  const out = {};
  for (const r of routes) {
    await page.goto(srv.base + 'index.html' + r);
    await page.reload();
    await page.waitForSelector('#stage section');
    await page.waitForTimeout(150);
    out[r] = await page.evaluate(() => ({
      stage: document.getElementById('stage').innerHTML,
      page: document.documentElement.getAttribute('data-page'), c: document.documentElement.getAttribute('data-c'),
      ground: document.documentElement.hasAttribute('data-ground'), tg: document.documentElement.getAttribute('data-tg'),
      title: document.title, theme: document.querySelector('meta[name="theme-color"]').content
    }));
  }
  out.__menu = await page.evaluate(() => document.getElementById('menu').innerHTML.replace(/\s+/g, ' '));
  await ctx.close(); srv.stop();
  return out;
}
const a = await render(OLD), b = await render(NEW);
await browser.close();
fs.rmSync(tmp, { recursive: true, force: true });

const tabs = (h) => h.replace(/<nav class="tg-tabs"[\s\S]*?<\/nav>/, '');
let unexpected = 0;
// the one thing added to the other pages: a quiet link back to the front page
function withoutHome(html) { return html.replace('<a href="#/"><span>Home</span></a>', '').replace('<nav class="quiet"></nav>', ''); }

for (const k of Object.keys(a)) {
  const x = JSON.stringify(a[k]), y = JSON.stringify(b[k]);
  if (x === y) { console.log('same     ', k); continue; }
  if (k === '#/') { console.log('on purpose', k, '(the front page, redesigned)'); continue; }
  if (k === '#/rituals') { console.log('on purpose', k, '(the list of rituals, now a carousel)'); continue; }
  if (/^#\/r\/[a-z]+$/.test(k) && a[k].title === b[k].title && a[k].page === b[k].page) { console.log('on purpose', k, "(the ritual's own page, in the carousel's style)"); continue; }
  if (/^#\/r\/[a-z]+\/(s|e|done)$/.test(k) && a[k].title === b[k].title && a[k].page === b[k].page && a[k].ground === b[k].ground) { console.log('on purpose', k, '(where the ritual is heard, and what follows: the same quiet look)'); continue; }
  if (typeof b[k] === 'object' && withoutHome(b[k].stage) === a[k].stage && ['page', 'c', 'ground', 'tg', 'title', 'theme'].every((f) => a[k][f] === b[k][f])) { console.log('+ Home    ', k, '(a link back to the front page, nothing else)'); continue; }
  if (false && tabs(b[k].stage) === a[k].stage && ['page', 'c', 'ground', 'title', 'theme'].every((f) => a[k][f] === b[k][f])) { console.log('tabs only', k); continue; }
  if (k === '__menu' && b[k].replace(/\s*<a href="#\/together">Together<\/a>/, '').replace(/\s*<a href="#\/">Home<\/a>/, '') === a[k]) { console.log('menu +2  ', k, '(the Together link, and a way back to the front page)'); continue; }
  unexpected++;
  console.log('DIFFERENT', k);
}
console.log(unexpected ? `\n${unexpected} unexpected difference(s)` : '\nNothing else changed.');
process.exit(unexpected ? 1 : 0);
