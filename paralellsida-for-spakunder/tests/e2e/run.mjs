// Browser tests for TOGETHER: two phones (two separate browser contexts) in one shared ritual.
//
//   cd paralellsida-for-spakunder/tests && npm install && node e2e/run.mjs
//
// What is real here: the site's own files and Content-Security-Policy, two separate browsers with
// their own clocks (the guest's is set several seconds wrong on purpose), @supabase/realtime-js
// talking its real wire protocol, real <audio> playback of a real mp3, real taps.
// What is not: the Realtime server (a local stand-in, mock-realtime.mjs), the network (localhost,
// with some added delay), and the phones: this is Chromium, not iPhone Safari or Android Chrome.
// SHOTS=dir  saves a screenshot of every phase.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import jsQR from 'jsqr';
import { PNG } from 'pngjs';
import { startMock } from './mock-realtime.mjs';
import { startServer } from './server.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.resolve(here, '../../public');
const CHROME = process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const SHOTS = process.env.SHOTS || '';
const TONE_SECONDS = 22;
const SKEW = 4321;                         // the guest's clock is this many ms ahead of the host's

let mock, srv, srvNoConfig, srvNoRecording, browser, tmp, recording;

before(async () => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'together-'));
  recording = path.join(tmp, 'tone.mp3');
  // a 22 s test tone, constant bit rate like the real recordings; never part of the site
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', `sine=frequency=330:duration=${TONE_SECONDS}`, '-ac', '2', '-b:a', '192k', '-c:a', 'libmp3lame', recording]);
  mock = await startMock({ latency: [15, 45] });
  srv = await startServer({ publicDir: PUBLIC, recording, mockUrl: mock.url });
  srvNoConfig = await startServer({ publicDir: PUBLIC, recording, mockUrl: null });
  srvNoRecording = await startServer({ publicDir: PUBLIC, recording: null, mockUrl: mock.url });
  browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
  if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
});
after(async () => {
  await browser.close(); mock.stop(); srv.stop(); srvNoConfig.stop(); srvNoRecording.stop();
  fs.rmSync(tmp, { recursive: true, force: true });
});

/* ——— helpers ——— */
const [DW, DH] = (process.env.SIZE || '390x844').split('x').map(Number);   // SIZE=360x640 to see every phase on a small phone
async function phone({ skew = 0, reduced = false, size = { width: DW, height: DH }, blockStarts = 0, base = srv } = {}) {
  const ctx = await browser.newContext({ viewport: size, serviceWorkers: 'block', reducedMotion: reduced ? 'reduce' : 'no-preference' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' || /Content Security Policy|Refused to/.test(m.text())) errors.push(m.type() + ': ' + m.text()); });
  if (skew) await page.addInitScript((s) => { const n = Date.now.bind(Date); Date.now = () => n() + s; }, skew);
  if (blockStarts) {
    // pretends to be a phone that refuses to start the recording by itself: the first N starts are refused
    await page.addInitScript((n) => {
      window.__block = n;
      const play = HTMLMediaElement.prototype.play;
      HTMLMediaElement.prototype.play = function () {
        if (window.__block > 0 && this.duration > 5) { window.__block--; return Promise.reject(new DOMException('blocked', 'NotAllowedError')); }
        return play.apply(this, arguments);
      };
    }, blockStarts);
  }
  return { ctx, page, errors, skew, base };
}
const phase = (p) => p.page.getAttribute('[data-live]', 'data-phase');
async function waitPhase(p, name, timeout = 20000) {
  try { await p.page.waitForSelector(`[data-live][data-phase="${name}"]`, { timeout }); }
  catch (e) { throw new Error(`waiting for phase "${name}", but it is "${await phase(p).catch(() => '?')}"`); }
}
// (waits for the screen's own fade-in to finish, so the picture shows what a person would see)
async function shot(p, name) { if (SHOTS) { await sleep(1900); await p.page.screenshot({ path: path.join(SHOTS, name + '.png') }); } }
async function audioNow(p) {
  return p.page.evaluate((skew) => {
    const a = window.__tg.player.audio;
    return { t: Date.now() - skew, ct: a.currentTime, paused: a.paused, rate: a.playbackRate };
  }, p.skew);
}
// how far apart (ms) the two recordings are right now; + means the second phone is ahead
async function syncError(a, b) {
  const [x, y] = await Promise.all([audioNow(a), audioNow(b)]);
  return (y.t - y.ct * 1000) - (x.t - x.ct * 1000);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function open(p, hash) { await p.page.goto(p.base.base + 'index.html' + hash); await p.page.waitForSelector('#stage section'); }

// both phones in a room, both ready; host has "Begin Together" available
async function pairUp({ guestOpts = {}, hostOpts = {} } = {}) {
  const host = await phone(hostOpts);
  const guest = await phone({ skew: SKEW, ...guestOpts });
  await open(host, '#/together/heart-to-heart');
  await host.page.waitForFunction(() => document.querySelector('[data-invite]'));
  await host.page.click('[data-invite]');
  await waitPhase(host, 'invite');
  await host.page.waitForSelector('[data-qr] svg path');
  await shot(host, 'a0-host-invite');
  const link = (await host.page.textContent('[data-link]')).trim();
  // the drawn QR code really holds the invitation link (read back with an independent decoder)
  const png = PNG.sync.read(await host.page.locator('[data-qr]').screenshot());
  const code = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);
  assert.ok(code, 'the QR code can be read');
  assert.equal(code.data, link, 'and it says the same as the link');
  assert.match(link, /#\/together\/join\/heart-to-heart\/[0-9a-z]+-[a-z2-7]{26}$/, 'a long, unguessable room name');
  await open(guest, link.slice(link.indexOf('#')));
  await waitPhase(host, 'ready'); await waitPhase(guest, 'ready');
  return { host, guest, link };
}
async function bothReady(host, guest) {
  for (const p of [host, guest]) {
    await p.page.waitForSelector('[data-act="ready"]:not([disabled])', { timeout: 20000 });
    await p.page.click('[data-act="ready"]');
  }
  await host.page.waitForSelector('[data-act="begin"]:not([disabled])', { timeout: 20000 });
}
async function closeAll(...ps) { for (const p of ps) await p.ctx.close(); }
const noErrors = (...ps) => ps.forEach((p) => assert.deepEqual(p.errors.filter((e) => !/favicon|404/.test(e)), [], 'no console errors or CSP violations'));

/* ——— the tests ——— */

test('Together is in the menu (and its own pages have the Rituals | Together tabs); the five rituals are still there', async () => {
  const p = await phone();
  await open(p, '#/rituals');
  assert.equal(await p.page.locator('.rc-slide').count(), 5);
  await p.page.click('#menu-btn');
  assert.ok(await p.page.locator('#menu a[href="#/together"]').isVisible());
  await p.page.click('#menu a[href="#/together"]');
  await p.page.waitForSelector('.tg-landing');
  assert.match(await p.page.textContent('.tg-landing h1'), /Together/i);
  assert.match(await p.page.textContent('.tg-landing'), /A Ritual for Two/);
  assert.match(await p.page.textContent('.tg-landing'), /Begin Your Ritual/);
  assert.match(await p.page.textContent('.tg-landing'), /side by side, or facing each other/);
  assert.equal(await p.page.locator('.tg-tabs a').count(), 2);
  await p.page.click('a[href="#/together/rituals"]');
  await p.page.click('a[href="#/together/heart-to-heart"]');
  await p.page.waitForSelector('.tg-ritual');
  assert.match(await p.page.textContent('.tg-ritual'), /Heart to Heart/i);
  // the ritual is only listened to: nothing of it is written out
  assert.equal(await p.page.locator('.tg-phases').count(), 0);
  assert.doesNotMatch(await p.page.textContent('.tg-ritual'), /Arrival|Heart Connection|Shared Breathing|Deepening|Integration|hand over your/i);
  assert.match(await p.page.textContent('.tg-ritual'), /always optional/);
  assert.match(await p.page.textContent('.tg-ritual'), /Invite Your Partner/);
  assert.match(await p.page.textContent('.tg-ritual'), /Listen Together on One Device/);
  noErrors(p); await closeAll(p);
});

test('two phones: invite, QR and link, ready, begin together, start in step, pause, resume, a dropped line, and the end', { timeout: 120000 }, async () => {
  const { host, guest, link } = await pairUp();
  assert.match(link, /#\/together\/join\/heart-to-heart\/[0-9a-z]+-[a-z2-7]{26}$/, 'a long, unguessable room name');
  await shot(host, 'a-host-both-here'); await shot(guest, 'a-guest-both-here');
  assert.equal(await host.page.getAttribute('.tg-rings', 'data-partner'), 'here', 'the rings have come together');
  assert.match(await host.page.textContent('.tg-receipt'), /Your partner\s*Here/);

  // before anyone is ready, "Begin" is not on offer
  assert.equal(await host.page.locator('[data-act="begin"]').count(), 0);
  // the host taps ready first: waits, the guest taps, then the host can begin
  await host.page.waitForSelector('[data-act="ready"]:not([disabled])', { timeout: 20000 });
  await host.page.click('[data-act="ready"]');
  await host.page.waitForFunction(() => /Waiting for your partner/.test(document.querySelector('[data-live]').textContent));
  await guest.page.waitForSelector('[data-act="ready"]:not([disabled])', { timeout: 20000 });
  await guest.page.click('[data-act="ready"]');
  await host.page.waitForSelector('[data-act="begin"]:not([disabled])', { timeout: 20000 });
  assert.match(await guest.page.textContent('[data-live]'), /Your shared moment is almost here/);
  assert.match(await host.page.textContent('.tg-receipt'), /Your partner\s*Ready/);
  await shot(host, 'b-host-both-ready'); await shot(guest, 'b-guest-both-ready');

  await host.page.click('[data-act="begin"]');
  await waitPhase(host, 'countdown'); await waitPhase(guest, 'countdown');
  await shot(host, 'c-countdown-breath'); await shot(guest, 'c-guest-countdown');
  await waitPhase(host, 'playing', 15000); await waitPhase(guest, 'playing', 15000);
  // a shared ritual in progress is not left by a stray touch: no Back to be seen on either phone while it plays
  for (const x of [host, guest]) assert.equal(await x.page.evaluate(() => getComputedStyle(document.getElementById('back')).visibility), 'hidden', 'no Back during the shared ritual');
  await sleep(1800);
  await shot(host, 'd-host-playing'); await shot(guest, 'd-guest-playing');

  // in step? (the guest's clock is 4.3 s wrong; shared time makes up for it)
  const early = await syncError(host, guest);
  await sleep(4000);
  const later = await syncError(host, guest);
  console.log(`      sync: ${early.toFixed(0)} ms after 2 s, ${later.toFixed(0)} ms after 6 s`);
  assert.ok(Math.abs(early) < 150, 'in step within 150 ms after two seconds: ' + early);
  assert.ok(Math.abs(later) < 100, 'in step within 100 ms after six seconds: ' + later);
  const est = await guest.page.evaluate(() => window.__tg.session.offset);
  assert.ok(Math.abs(est - -SKEW) < 120, 'the guest measured its clock error (' + est + ' ms, expected ' + -SKEW + ')');

  // the guest pauses: both pause, at the same place
  await guest.page.click('[data-act="pause"]');
  await waitPhase(host, 'paused'); await waitPhase(guest, 'paused');
  await sleep(500);
  const ph = await audioNow(host), pg = await audioNow(guest);
  assert.ok(ph.paused && pg.paused, 'both recordings stopped');
  assert.ok(Math.abs(ph.ct - pg.ct) < 0.15, `stopped at the same place (${ph.ct.toFixed(2)} / ${pg.ct.toFixed(2)})`);
  assert.match(await host.page.textContent('[data-live]'), /Your partner paused/);
  assert.match(await guest.page.textContent('[data-live]'), /Paused/);
  await shot(host, 'e-host-partner-paused'); await shot(guest, 'e-guest-paused');
  const stoppedAt = ph.ct;

  // the host resumes: both start again, from where they stopped, together
  await host.page.click('[data-act="resume"]');
  await waitPhase(host, 'playing', 15000); await waitPhase(guest, 'playing', 15000);
  await sleep(2500);
  const after1 = await audioNow(host);
  assert.ok(!after1.paused && after1.ct > stoppedAt - 0.2 && after1.ct < stoppedAt + 5, `carried on from the pause (${stoppedAt.toFixed(2)} → ${after1.ct.toFixed(2)})`);
  const resumed = await syncError(host, guest);
  console.log(`      sync after resume: ${resumed.toFixed(0)} ms`);
  assert.ok(Math.abs(resumed) < 120, 'in step after resume: ' + resumed);

  // the line drops: the recordings carry on by themselves, and both phones find each other again
  const before = await audioNow(guest);
  mock.dropAll();
  await sleep(1500);
  const during = await audioNow(guest);
  assert.ok(during.ct > before.ct + 1, 'the recording does not stop when the connection does');
  await guest.page.waitForFunction(() => window.__tg.session.view().status === 'online' && window.__tg.session.view().peer.present, null, { timeout: 25000 });
  await host.page.waitForFunction(() => window.__tg.session.view().status === 'online' && window.__tg.session.view().peer.present, null, { timeout: 25000 });
  const reunited = await syncError(host, guest);
  assert.ok(Math.abs(reunited) < 120, 'still in step after the line came back: ' + reunited);

  // the end
  await waitPhase(host, 'ended', 30000); await waitPhase(guest, 'ended', 30000);
  assert.match(await host.page.textContent('[data-live]'), /Take a moment/);
  await shot(host, 'f-ended');
  noErrors(host, guest);
  await closeAll(host, guest);
});

test('a phone that refuses to start the sound by itself asks for one tap, then joins the right place', { timeout: 90000 }, async () => {
  const { host, guest } = await pairUp({ guestOpts: { blockStarts: 1 } });
  await bothReady(host, guest);
  await host.page.click('[data-act="begin"]');
  await waitPhase(guest, 'rejoin', 20000);
  assert.match(await guest.page.textContent('[data-live]'), /Tap to join your partner/);
  await shot(guest, 'g-guest-needs-tap');
  await waitPhase(host, 'playing', 15000);
  await sleep(1200);
  await guest.page.click('[data-act="rejoin"]');
  await waitPhase(guest, 'playing', 10000);
  await sleep(1500);
  const err = await syncError(host, guest);
  console.log(`      sync after the extra tap: ${err.toFixed(0)} ms`);
  assert.ok(Math.abs(err) < 150, 'joined the right place in the recording: ' + err);
  noErrors(host, guest); await closeAll(host, guest);
});

test('a phone that reloads in the middle comes back to the right place; a partner who leaves is told of', { timeout: 90000 }, async () => {
  const { host, guest, link } = await pairUp();
  await bothReady(host, guest);
  await host.page.click('[data-act="begin"]');
  await waitPhase(host, 'playing', 15000); await waitPhase(guest, 'playing', 15000);
  await sleep(1500);
  // the guest's page reloads (a phone discarding a tab does the same)
  await guest.page.reload();
  await waitPhase(guest, 'rejoin', 25000);
  await guest.page.waitForSelector('[data-act="rejoin"]:not([disabled])', { timeout: 20000 });
  await shot(guest, 'h-guest-after-reload');
  await guest.page.click('[data-act="rejoin"]');
  await waitPhase(guest, 'playing', 10000);
  await sleep(1500);
  const err = await syncError(host, guest);
  console.log(`      sync after a reload: ${err.toFixed(0)} ms`);
  assert.ok(Math.abs(err) < 200, 'back in the right place after a reload: ' + err);
  // the guest leaves for good: the host's recording carries on, and a quiet line says so
  await guest.page.goto(host.base.base + 'index.html#/rituals');
  await host.page.waitForFunction(() => /Your partner has left/.test(document.querySelector('[data-quiet]')?.textContent || ''), null, { timeout: 20000 });
  await shot(host, 'i-host-partner-left');
  const a = await audioNow(host); await sleep(800); const b = await audioNow(host);
  assert.ok(b.ct > a.ct + 0.5 && !b.paused, 'the remaining phone keeps playing');
  noErrors(host, guest); await closeAll(host, guest);
});

test('someone else with the link is turned away without disturbing the ritual; the same person in a new window takes the seat back', { timeout: 90000 }, async () => {
  const { host, guest, link } = await pairUp();
  assert.match(guest.page.url(), /#\/together\/join\/heart-to-heart\/[0-9a-z]+-[a-z2-7]{26}\/[a-z2-7]{10}$/, 'a reload will find its own seat in the address');
  await bothReady(host, guest);
  await host.page.click('[data-act="begin"]');
  await waitPhase(host, 'playing', 15000); await waitPhase(guest, 'playing', 15000);

  // a stranger opens the invitation link while the ritual is under way
  const stranger = await phone({ skew: 120 });
  await open(stranger, link.slice(link.indexOf('#')));
  await waitPhase(stranger, 'error', 15000);
  assert.match(await stranger.page.textContent('[data-live]'), /already has two people/);
  await shot(stranger, 'm-stranger-turned-away');
  await sleep(1500);
  assert.equal(await phase(guest), 'playing', 'the guest is left alone');
  assert.equal(await phase(host), 'playing', 'and so is the host');
  const err = await syncError(host, guest);
  assert.ok(Math.abs(err) < 150, 'still in step: ' + err);

  // the same person opens their own address in a new window: that window takes the seat, the old one steps aside
  const again = await phone({ skew: SKEW });
  await open(again, guest.page.url().slice(guest.page.url().indexOf('#')));
  await waitPhase(guest, 'error', 20000);
  assert.match(await guest.page.textContent('[data-live]'), /open in another window/);
  assert.ok((await audioNow(guest)).paused, 'the old window is silent');
  await waitPhase(again, 'rejoin', 20000);
  assert.equal(await phase(host), 'playing', 'the host keeps playing');
  noErrors(host); await closeAll(host, guest, stranger, again);
});

test('bad, expired and unconfigured invitations explain themselves; a missing recording closes the invitation', async () => {
  const a = await phone();
  await open(a, '#/together/join/heart-to-heart/nonsense');
  assert.match(await a.page.textContent('[data-live]'), /not valid/);
  const old = (Date.now() - 1000).toString(36) + '-' + 'a'.repeat(26);
  await open(a, '#/together/join/heart-to-heart/' + old);
  await a.page.reload();
  assert.match(await a.page.textContent('[data-live]'), /has ended/);
  await shot(a, 'j-expired');

  const b = await phone({ base: srvNoConfig });
  await open(b, '#/together/heart-to-heart');
  await b.page.click('[data-invite]');
  assert.match(await b.page.textContent('[data-note]'), /not available right now/);
  // and the one-device way is still there
  assert.ok(await b.page.locator('a[href="#/together/solo/heart-to-heart"]').isVisible());

  const c = await phone({ base: srvNoRecording });
  await open(c, '#/together/heart-to-heart');
  await c.page.waitForSelector('[data-note]:not([hidden])');
  assert.match(await c.page.textContent('[data-note]'), /being prepared/);
  assert.equal(await c.page.locator('[data-invite]').isDisabled(), true);
  await shot(c, 'k-no-recording');
  await closeAll(a, b, c);
});

test('one device: the plain player, the water-light while it plays, and the way back', { timeout: 60000 }, async () => {
  const p = await phone();
  await open(p, '#/together/solo/heart-to-heart');
  assert.equal(await p.page.getAttribute('html', 'data-tg'), 'light');
  await p.page.click('[data-toggle]');
  await p.page.waitForFunction(() => document.querySelector('[data-solo]').getAttribute('data-state') === 'playing');
  assert.equal(await p.page.getAttribute('html', 'data-tg'), 'scene');
  await sleep(2600);
  await shot(p, 'l-solo-playing');
  await p.page.fill('[data-range]', '500');
  await p.page.dispatchEvent('[data-range]', 'input');
  await p.page.click('[data-toggle]');
  await p.page.waitForFunction(() => document.querySelector('[data-solo]').getAttribute('data-state') === 'paused');
  await p.page.click('a[href="#/together/heart-to-heart"]');
  await p.page.waitForSelector('.tg-ritual');
  assert.equal(await p.page.getAttribute('html', 'data-tg'), 'light');
  assert.equal(await p.page.locator('.tg-scene').count(), 0, 'the water-light is gone with the ritual');
  noErrors(p); await closeAll(p);
});

test('choose your ritual: five large pictures in a carousel, one for each ritual', async () => {
  const p = await phone();
  await open(p, '#/rituals');
  await p.page.waitForSelector('.rc-slide');
  const names = await p.page.$$eval('.rc-name', (ns) => ns.map((n) => n.textContent.trim().toLowerCase()));
  assert.deepEqual(names, ['balance', 'luminance', 'kindness', 'serenity', 'presence']);
  assert.equal(await p.page.locator('[data-rc-dot]').count(), 5);
  assert.equal(await p.page.getAttribute('[data-rc-dot="0"]', 'aria-current'), 'true');
  // five different pictures, each large (a good part of the screen's width)
  const srcs = await p.page.$$eval('.rc-photo img', (is) => is.map((i) => i.getAttribute('src')));
  assert.equal(new Set(srcs).size, 5);
  const w = await p.page.$eval('.rc-photo', (e) => e.getBoundingClientRect().width);
  assert.ok(w > 0.6 * DW, 'the picture is large: ' + w + ' px of ' + DW);
  // the dots move the carousel, and each ritual opens
  await p.page.click('[data-rc-dot="3"]');
  await p.page.waitForFunction(() => document.querySelector('[data-rc-dot="3"]').getAttribute('aria-current') === 'true');
  assert.equal(await p.page.evaluate(() => document.querySelector('.rc-slide:nth-child(4)').getAttribute('data-c')), 'serenity');
  await p.page.click('.rc-slide:nth-child(4) a');
  await p.page.waitForSelector('.screen.intro');
  assert.match(await p.page.title(), /Serenity/);
  // back again: the carousel is where it was left
  await p.page.goBack();
  await p.page.waitForSelector('.rc-slide');
  await p.page.waitForFunction(() => document.querySelector('[data-rc-dot="3"]').getAttribute('aria-current') === 'true');
  const over = await p.page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert.ok(over <= 0, 'no sideways scrolling');
  noErrors(p); await closeAll(p);
});

test('the front page: one photograph, one door, and no shop', async () => {
  const p = await phone();
  await open(p, '#/');
  await p.page.waitForSelector('.front');
  assert.equal((await p.page.textContent('.front-title')).trim(), 'The Art of Conscious Care');
  assert.match(await p.page.textContent('.front'), /Sensory Enrichment Skincare/);
  assert.equal(await p.page.locator('.front a.btn').count(), 1, 'one door');
  assert.equal(await p.page.getAttribute('.front a.btn', 'href'), '#/rituals');
  // no shop: no basket, no price, no link that leaves the sanctuary, on the page or in the menu
  const hrefs = await p.page.$$eval('a[href]', (as) => as.map((a) => a.getAttribute('href')));
  assert.ok(hrefs.every((h) => h.startsWith('#/')), 'every link stays inside the sanctuary: ' + hrefs.join(' '));
  const all = (await p.page.textContent('body')).toLowerCase();
  for (const w of ['shop', 'cart', 'basket', 'checkout', 'buy now', 'add to bag']) assert.ok(!all.includes(w), 'no "' + w + '"');
  assert.equal(await p.page.locator('[aria-label*="bag" i], [aria-label*="cart" i], [aria-label*="basket" i]').count(), 0);
  await p.page.click('.front a.btn');
  await p.page.waitForSelector('.rc-track');
  noErrors(p); await closeAll(p);
});

test('the way back to the front page: the logo and the menu\'s Home, from the rituals and from a ritual', async () => {
  const p = await phone();
  await open(p, '#/rituals');                                  // an address that goes straight past the front page
  await p.page.waitForSelector('.rc-track');
  await p.page.click('a.head-brand');
  await p.page.waitForSelector('.front');
  assert.equal(await p.page.evaluate(() => document.documentElement.getAttribute('data-page')), 'welcome');
  await p.page.click('.front a.btn');
  await p.page.waitForSelector('.rc-track');
  await p.page.click('.rc-frame');                             // into a ritual
  await p.page.waitForSelector('.screen:not(.rituals-screen)');
  await p.page.click('#menu-btn');
  await p.page.click('#menu a[href="#/"]');                    // Home in the menu
  await p.page.waitForSelector('.front');
  assert.equal(await p.page.evaluate(() => location.hash), '#/');
  noErrors(p); await closeAll(p);
});

test('a ritual\'s own page: the picture, two ways to listen, what to read, and a way Home from every page', async () => {
  const p = await phone();
  await open(p, '#/r/presence');
  await p.page.waitForSelector('.ri-hero img');
  assert.equal((await p.page.textContent('h1.rc-name')).trim().toLowerCase(), 'presence');
  assert.match(await p.page.textContent('.rc-kind'), /Body Lotion · Raspberry/);
  assert.equal(await p.page.getAttribute('.ri-btn.primary', 'href'), '#/r/presence/s');
  // both lengths, both with their recording: two buttons to press, each with its length
  assert.equal(await p.page.locator('a.ri-btn').count(), 2);
  assert.equal(await p.page.getAttribute('a.ri-btn:not(.primary)', 'href'), '#/r/presence/e');
  assert.equal(await p.page.locator('.ri-off').count(), 0);
  assert.match(await p.page.textContent('a.ri-btn.primary'), /4 min/);
  assert.match(await p.page.textContent('a.ri-btn:not(.primary)'), /11 min/);
  assert.equal(await p.page.locator('.rd').count(), 3, 'three things to read');
  assert.equal(await p.page.locator('.rd[open]').count(), 1, 'the first is open');
  assert.match(await p.page.textContent('.rd[open]'), /250 ml/);
  await p.page.click('.rd:nth-of-type(3) summary');
  assert.match(await p.page.textContent('.rd:nth-of-type(3)'), /Rubus Idaeus/, 'the ingredients open');
  // the ritual's page no longer wears the ritual's colour: it is the carousel's quiet page
  assert.equal(await p.page.evaluate(() => document.documentElement.hasAttribute('data-ground')), false);
  // Home from every kind of page
  for (const h of ['#/r/presence', '#/r/presence/done', '#/about', '#/close', '#/rituals']) {
    await open(p, h);
    await p.page.click(h === '#/rituals' ? 'a.head-brand' : '#stage a[href="#/"]');
    await p.page.waitForSelector('.front');
  }
  // the bare listening page has no links of its own: the logo and the menu take you home
  await open(p, '#/r/presence/s');
  await p.page.click('a.head-brand');
  await p.page.waitForSelector('.front');
  await open(p, '#/r/presence/s');
  await p.page.click('#menu-btn');
  await p.page.click('#menu a[href="#/"]');
  await p.page.waitForSelector('.front');
  // where it is heard: the framed picture with the name, the controls, and the way home
  await open(p, '#/r/presence/e');
  assert.equal((await p.page.textContent('.player h1.pl-name')).trim().toLowerCase(), 'presence');
  assert.equal(await p.page.locator('.player .pl-hero img').count(), 1);
  // the old label colours are gone: the ground is the night ground, whatever the ritual
  assert.equal(await p.page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--bg').trim()), '#1b140e');
  assert.equal(await p.page.evaluate(() => document.documentElement.hasAttribute('data-c')), false);
  for (const sel of ['[data-toggle]', '[data-range]', '[data-now]', '[data-total]']) assert.equal(await p.page.locator('.player ' + sel).count(), 1, sel);
  // as bare as possible: one button (play), the line to drag, no links on the page itself; Back (the one in the corner) goes to the ritual's page
  assert.equal(await p.page.locator('.player button').count(), 1, 'one button');
  assert.equal(await p.page.locator('.player a').count(), 0, 'no links on the page itself');
  assert.equal(await p.page.getAttribute('#back', 'href'), '#/r/presence');
  await p.page.click('#back');
  await p.page.waitForSelector('.ri-hero');
  assert.equal(await p.page.locator('a.ri-btn').count(), 2, 'both lengths to choose between');
  await open(p, '#/r/presence/e');
  assert.match(await p.page.textContent('.player .eyebrow'), /Extended ritual/);
  // a recording that is not in yet: its length is still shown, quiet, with nothing to press (the recordings are
  // made to look missing here: Luminance has neither, Presence lacks the extended one)
  const q = await phone();
  await q.ctx.route('**/assets/content.js*', async (route) => {
    const res = await route.fetch();
    const text = await res.text();
    const data = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1));
    const by = (id) => data.rituals.find((r) => r.id === id).audio;
    by('luminance').short.ready = false; by('luminance').extended.ready = false; by('presence').extended.ready = false;
    await route.fulfill({ status: 200, contentType: 'text/javascript', body: 'window.SANCTUARY = ' + JSON.stringify(data) + ';' });
  });
  await open(q, '#/r/luminance');
  await q.page.waitForSelector('.ri-off');
  assert.equal(await q.page.locator('.ri-btn.ri-off').count(), 2);
  assert.equal(await q.page.locator('a.ri-btn').count(), 0);
  await open(q, '#/r/presence');
  await q.page.waitForFunction(() => { const h = document.querySelector('h1.rc-name'); return h && h.textContent.trim() === 'presence'; });
  assert.equal(await q.page.locator('a.ri-btn').count(), 1);
  assert.equal(await q.page.getAttribute('.ri-btn.ri-off', 'aria-disabled'), 'true');
  assert.match(await q.page.textContent('.ri-btn.ri-off'), /Extended ritual/);
  noErrors(q); await closeAll(q);
  // the front page has its own way to Sensory Enrichment
  await open(p, '#/');
  await p.page.click('.front-menu a');
  await p.page.waitForSelector('.screen.about');
  // listening starts from the ritual's page
  await open(p, '#/r/presence');
  await p.page.click('.ri-btn.primary');
  await p.page.waitForSelector('[data-player="presence:short"]');
  noErrors(p); await closeAll(p);
});

test('Back on every page but the front page, each to the page before it', async () => {
  const p = await phone();
  const pages = [
    ['#/rituals', '#/'], ['#/r/presence', '#/rituals'], ['#/r/presence/s', '#/r/presence'], ['#/r/presence/e', '#/r/presence'],
    ['#/r/presence/done', '#/r/presence'], ['#/about', '#/'], ['#/close', '#/'],
    ['#/together', '#/'], ['#/together/rituals', '#/together'], ['#/together/heart-to-heart', '#/together/rituals'],
    ['#/together/solo/heart-to-heart', '#/together/heart-to-heart'],
    ['#/together/host/heart-to-heart/not-a-room/not-a-seat', '#/together/heart-to-heart']
  ];
  await open(p, '#/');
  assert.equal(await p.page.isVisible('#back'), false, 'no Back on the front page');
  for (const [hash, to] of pages) {
    await open(p, hash);
    // the page swaps after a short fade: wait for Back to point where it should (the check below says it if not)
    await p.page.waitForFunction((t) => document.getElementById('back').getAttribute('href') === t && !document.getElementById('back').hidden, to, { timeout: 5000 }).catch(() => {});
    assert.equal(await p.page.getAttribute('#back', 'href'), to, hash + ' goes back to ' + to);
    assert.equal(await p.page.isVisible('#back'), true, hash + ': Back is in view');
    // at the bottom of the screen, where the thumb rests, in the middle
    const box = await p.page.locator('#back').boundingBox();
    const vp = p.page.viewportSize();
    assert.ok(box.y + box.height > vp.height - 70 && box.y > vp.height * 0.8, hash + ': Back is at the bottom (y ' + Math.round(box.y) + ' of ' + vp.height + ')');
    assert.ok(Math.abs(box.x + box.width / 2 - vp.width / 2) < 4, hash + ': Back is centred');
  }
  // and it works: from the rituals, back to the front page; from the ritual, back to the carousel
  await open(p, '#/rituals');
  await p.page.waitForSelector('.rc-track');
  await p.page.click('#back');
  await p.page.waitForSelector('.front');
  await open(p, '#/r/kindness');
  await p.page.waitForSelector('.ri-hero');
  await p.page.click('#back');
  await p.page.waitForSelector('.rc-track');
  noErrors(p); await closeAll(p);
});

test('a spa\'s own page: its picture and name, its thanks and the way to book; the ordinary page is untouched', async () => {
  const p = await phone();
  await p.page.goto(p.base.base + 'index.html?s=horizon-hill#/');
  await p.page.waitForSelector('.front-spa');
  assert.match(await p.page.textContent('.spa-welcome'), /Horizon Hill Spa/);
  assert.equal(await p.page.getAttribute('.spa-photo img', 'src'), 'spas/horizon-hill/hero.webp');
  await p.page.waitForFunction(() => { const i = document.querySelector('.spa-photo img'); return i && i.complete && i.naturalWidth > 0; });
  assert.equal(await p.page.locator('.btn.primary').count(), 1, 'still one door');
  // the way to book: the spa's own page, in a new tab, told only where the guest came from
  const book = p.page.locator('.front-menu a[target="_blank"]');
  assert.equal(await book.count(), 1);
  const href = await book.getAttribute('href');
  assert.match(href, /utm_source=bodymindearth/);
  assert.match(href, /utm_campaign=horizon-hill/);
  assert.match(await book.getAttribute('rel'), /noopener/);
  assert.match(await p.page.textContent('#menu'), /Book a visit/);
  // after a ritual: the spa's thanks, and the same way to book
  await p.page.goto(p.base.base + 'index.html?s=horizon-hill#/r/presence/done');
  await p.page.reload();
  await p.page.waitForSelector('.spa-thanks');
  assert.match(await p.page.textContent('.spa-thanks'), /Thank you for taking this moment/);
  assert.match(await p.page.getAttribute('.spa-thanks a.btn', 'href'), /utm_source=bodymindearth/);
  assert.match(await p.page.textContent('.spa-thanks a.btn'), /Experience the ritual at Horizon Hill Spa/);
  // ... and the way to refill: the spa's own shop, in a new tab, told which spa the guest came from
  const shop = p.page.locator('.spa-thanks a.btn', { hasText: 'Refill your products' });
  assert.equal(await shop.count(), 1);
  assert.match(await shop.getAttribute('href'), /^spas\/horizon-hill\/shop\.html\?utm_source=bodymindearth&utm_medium=ritual&utm_content=refill&utm_campaign=horizon-hill$/);
  assert.equal(await shop.getAttribute('target'), '_blank');
  assert.match(await shop.getAttribute('rel'), /noopener/);
  // the example booking page tells what the spa would see
  const b = await p.ctx.newPage();
  await b.goto(p.base.base + 'spas/horizon-hill/book.html?utm_source=bodymindearth&utm_medium=ritual&utm_campaign=horizon-hill');
  assert.match(await b.textContent('[data-source]'), /came from the Body Mind Earth ritual/);
  await b.close();
  const sh = await p.ctx.newPage();
  await sh.goto(p.base.base + 'spas/horizon-hill/shop.html?utm_source=bodymindearth&utm_medium=ritual&utm_content=refill&utm_campaign=horizon-hill');
  assert.match(await sh.textContent('[data-source]'), /came from the Body Mind Earth ritual/);
  await sh.close();
  noErrors(p);
  // the ordinary address has none of it
  await p.page.goto(p.base.base + 'index.html#/');
  await p.page.reload();
  await p.page.waitForSelector('.front');
  assert.equal(await p.page.locator('.front-spa, .spa-photo, .spa-thanks, [target="_blank"]').count(), 0);
  // an address with a spa that does not exist is just the ordinary page
  await p.page.goto(p.base.base + 'index.html?s=no-such-spa#/');
  await p.page.reload();
  await p.page.waitForSelector('.front');
  assert.equal(await p.page.locator('.front-spa').count(), 0);
  await closeAll(p);
});

test('a spa\'s page can be kept as an app: its own manifest, name and icon; the ordinary page keeps the ordinary ones', async () => {
  const p = await phone();
  const cdp = await p.ctx.newCDPSession(p.page);
  await p.page.goto(p.base.base + 'index.html?s=horizon-hill#/');
  await p.page.waitForSelector('.front-spa');
  // the links the browser looks at are the spa's
  assert.equal(await p.page.getAttribute('link[rel="manifest"]', 'href'), 'spas/horizon-hill/manifest.webmanifest');
  assert.equal(await p.page.getAttribute('link[rel="apple-touch-icon"]', 'href'), 'spas/horizon-hill/icon-180.png');
  assert.equal(await p.page.getAttribute('meta[name="apple-mobile-web-app-title"]', 'content'), 'Horizon');
  // the manifest as the browser reads it
  const { url, data, errors } = await cdp.send('Page.getAppManifest');
  assert.match(url, /spas\/horizon-hill\/manifest\.webmanifest$/);
  assert.deepEqual(errors, []);
  const m = JSON.parse(data);
  assert.equal(m.name, 'Horizon Hill Spa');
  assert.equal(m.short_name, 'Horizon');
  assert.equal(m.display, 'standalone');
  const base = p.base.base;
  // the app opens the spa's page, not the ordinary one, and stays within the site
  const resolved = new URL(m.start_url, base + 'spas/horizon-hill/manifest.webmanifest');
  assert.equal(resolved.href, base + '?s=horizon-hill');
  assert.equal(new URL(m.scope, base + 'spas/horizon-hill/manifest.webmanifest').href, base);
  // every icon it names exists and is the size it says
  for (const ic of m.icons) {
    const res = await p.page.request.get(new URL(ic.src, base + 'spas/horizon-hill/manifest.webmanifest').href);
    assert.equal(res.status(), 200);
    assert.equal(PNG.sync.read(await res.body()).width, parseInt(ic.sizes, 10));
  }
  assert.equal(PNG.sync.read(await (await p.page.request.get(base + 'spas/horizon-hill/icon-180.png')).body()).width, 180);
  // would Chromium offer to install it?
  // (the test browser is a private window, so "in-incognito" is the one answer that is expected; anything else is a real problem)
  const inst = await cdp.send('Page.getInstallabilityErrors');
  assert.deepEqual(inst.installabilityErrors.filter((e) => e.errorId !== 'in-incognito'), [], 'installability: ' + JSON.stringify(inst.installabilityErrors));
  noErrors(p);
  // the ordinary page: the ordinary manifest and icon
  await p.page.goto(base + 'index.html#/');
  await p.page.reload();
  await p.page.waitForSelector('.front');
  assert.equal(await p.page.getAttribute('link[rel="manifest"]', 'href'), 'manifest.webmanifest');
  assert.equal(await p.page.getAttribute('link[rel="apple-touch-icon"]', 'href'), 'assets/icon-180.png');
  assert.equal(await p.page.getAttribute('meta[name="apple-mobile-web-app-title"]', 'content'), 'Sanctuary');
  assert.equal(await p.page.locator('#menu a[href="#/install"]').count(), 0, 'the ordinary page keeps its three places');
  await closeAll(p);
});

test('"Add to your phone": Android offers the browser\'s own install, iPhone gets the steps, an app inside another app is told to open the browser', async () => {
  const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
  const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36';
  const LINKEDIN = IPHONE + ' [LinkedInApp]';
  const open = async (userAgent) => {
    const ctx = await browser.newContext({ viewport: { width: DW, height: DH }, serviceWorkers: 'block', userAgent });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(srv.base + 'index.html?s=horizon-hill#/');
    await page.waitForSelector('.front-spa');
    return { ctx, page, errors };
  };
  // the way in: a quiet link on the front page, and the menu
  let t = await open(ANDROID);
  assert.equal(await t.page.locator('.front-menu a[href="#/install"]').count(), 1);
  assert.equal(await t.page.locator('#menu a[href="#/install"]').count(), 1);
  // Android: before the browser offers it, the menu route is explained; once it offers it, there is a button, and it uses the browser's own prompt
  await t.page.evaluate(() => document.querySelector('.front-menu a[href="#/install"]').click());
  await t.page.waitForSelector('.install');
  assert.match(await t.page.textContent('.install'), /Install app|Add to Home screen/);
  assert.equal(await t.page.locator('[data-install-btn]').count(), 0);
  await t.page.evaluate(() => {
    const e = new Event('beforeinstallprompt', { cancelable: true });
    e.prompt = () => { window.__prompted = (window.__prompted || 0) + 1; return Promise.resolve(); };
    e.userChoice = Promise.resolve({ outcome: 'accepted' });
    window.dispatchEvent(e);
  });
  await t.page.waitForSelector('[data-install-btn]');
  assert.equal(await t.page.locator('[data-install-note]').isHidden(), true);
  await t.page.click('[data-install-btn]');
  assert.equal(await t.page.evaluate(() => window.__prompted), 1, 'the browser\'s install prompt was asked for by the tap');
  // it worked: the guest is taken to the front page, which says so (no install page left to keep tapping on)
  await t.page.waitForSelector('.front-spa');
  assert.match(await t.page.textContent('.front-menu .install-done'), /Added to your home screen/);
  assert.equal(await t.page.locator('#stage a[data-install-go], #stage [data-install-btn]').count(), 0);
  assert.deepEqual(t.errors, []);
  assert.equal(await t.page.evaluate(() => window.__prompted), 1, 'Chrome: the install prompt at once, no hand-over');
  await t.ctx.close();
  // iPhone: no prompt exists there; the three steps, with the share icon
  t = await open(IPHONE);
  await t.page.evaluate(() => document.querySelector('.front-menu a[href="#/install"]').click());
  await t.page.waitForSelector('.install-steps');
  assert.equal(await t.page.locator('.install-steps li').count(), 3);
  assert.equal(await t.page.locator('.install-steps svg.install-share').count(), 1);
  assert.match(await t.page.textContent('.install-steps'), /Add to Home Screen/);
  assert.equal(await t.page.locator('[data-install-btn]').count(), 0);
  assert.deepEqual(t.errors, []);
  await t.ctx.close();
  // inside LinkedIn's own browser the home screen cannot be reached: say so
  t = await open(LINKEDIN);
  await t.page.evaluate(() => document.querySelector('.front-menu a[href="#/install"]').click());
  await t.page.waitForSelector('.install');
  assert.match(await t.page.textContent('.install'), /open inside another app/i);
  assert.equal(await t.page.locator('.install-steps').count(), 0);
  await t.ctx.close();
  // already on the home screen: no install links, and the page says so
  const ctx = await browser.newContext({ viewport: { width: DW, height: DH }, serviceWorkers: 'block', userAgent: IPHONE });
  const page = await ctx.newPage();
  await page.addInitScript(() => { Object.defineProperty(navigator, 'standalone', { value: true }); });
  await page.goto(srv.base + 'index.html?s=horizon-hill#/');
  await page.waitForSelector('.front-spa');
  assert.equal(await page.locator('a[href="#/install"]').count(), 0);
  await page.goto(srv.base + 'index.html?s=horizon-hill#/install');
  await page.reload();
  await page.waitForSelector('.install');
  assert.match(await page.textContent('.install'), /already using it/);
  await ctx.close();
});

test('one tap installs, and the guest can tell it worked: back on the front page, where the link now says "Added to your home screen"', async () => {
  const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36';
  const offer = (page, outcome = 'accepted') => page.evaluate((o) => {
    const e = new Event('beforeinstallprompt', { cancelable: true });
    e.prompt = () => { window.__prompted = (window.__prompted || 0) + 1; return Promise.resolve(); };
    e.userChoice = Promise.resolve({ outcome: o });
    window.dispatchEvent(e);
  }, outcome);
  const fresh = async (hash, ua = ANDROID) => {
    const ctx = await browser.newContext({ viewport: { width: DW, height: DH }, serviceWorkers: 'block', userAgent: ua });
    const page = await ctx.newPage();
    await page.goto(srv.base + 'index.html?s=horizon-hill' + hash);
    if (hash.includes('/r/')) await page.reload();
    return { ctx, page };
  };
  // Chrome, from the front page: one tap, the install dialog at once, no page in between, and then the confirmation in the link's place
  let { ctx, page } = await fresh('#/');
  await page.waitForSelector('.front-spa');
  await offer(page);
  await page.evaluate(() => document.querySelector('.front-menu a[data-install-go]').click());
  assert.equal(await page.evaluate(() => window.__prompted), 1, 'one tap, the browser\'s install dialog');
  await page.waitForSelector('.front-menu .install-done');
  assert.match(await page.textContent('.front-menu .install-done'), /Added to your home screen/);
  await page.waitForSelector('.toast.on');
  assert.match(await page.textContent('.toast'), /Added to your home screen/);
  assert.equal(await page.locator('.install').count(), 0, 'no page in between');
  assert.equal(await page.locator('#stage a[data-install-go]').count(), 0, 'nothing left to tap');
  await page.click('#menu-btn');
  assert.equal(await page.locator('#menu a[data-install-go]').isHidden(), true, 'nor in the menu');
  await ctx.close();
  // the guest says no to the dialog: nothing changes
  ({ ctx, page } = await fresh('#/'));
  await page.waitForSelector('.front-spa');
  await offer(page, 'dismissed');
  await page.evaluate(() => document.querySelector('.front-menu a[data-install-go]').click());
  assert.equal(await page.evaluate(() => window.__prompted), 1);
  await page.waitForTimeout(400);
  assert.equal(await page.locator('.front-menu .install-done').count(), 0);
  assert.equal(await page.locator('.front-menu a[data-install-go]').count(), 1, 'the link is still there to try again');
  await ctx.close();
  // from the page after a ritual: it worked, so back to the front page
  ({ ctx, page } = await fresh('#/r/presence/done'));
  await page.waitForSelector('.spa-thanks');
  await offer(page);
  await page.click('.end a[data-install-go]');
  await page.waitForSelector('.front-spa');
  assert.match(await page.textContent('.front-menu .install-done'), /Added to your home screen/);
  await ctx.close();
  // the phone reports the install by itself (appinstalled), whatever the guest was doing
  ({ ctx, page } = await fresh('#/rituals'));
  await page.waitForSelector('.carousel, .list, [data-page]');
  await page.evaluate(() => window.dispatchEvent(new Event('appinstalled')));
  await page.waitForSelector('.front-spa');
  assert.equal(await page.locator('.front-menu .install-done').count(), 1);
  await ctx.close();
  // Brave: no hand-over to another browser (Android would ask "Choose activity"): the same one tap, the browser's own install
  ctx = await browser.newContext({ viewport: { width: DW, height: DH }, serviceWorkers: 'block', userAgent: ANDROID });
  page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Page.enable');
  const asked = [];
  cdp.on('Page.frameRequestedNavigation', (e) => asked.push(e.url));
  await page.addInitScript(() => { navigator.brave = { isBrave: () => Promise.resolve(true) }; });
  await page.goto(srv.base + 'index.html?s=horizon-hill#/');
  await page.waitForSelector('.front-spa');
  await offer(page);
  await page.evaluate(() => document.querySelector('.front-menu a[data-install-go]').click());
  assert.equal(await page.evaluate(() => window.__prompted), 1, 'Brave installs at the tap, like any browser');
  assert.deepEqual(asked.filter((u) => !u.startsWith(srv.base)), [], 'no hand-over to another app: ' + JSON.stringify(asked));
  await page.waitForSelector('.front-menu .install-done');
  await ctx.close();
  // not offered by the browser (iPhone, or Android before the browser has offered it): the link leads to the steps, which end by saying where the app will be
  ({ ctx, page } = await fresh('#/', 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1'));
  await page.waitForSelector('.front-spa');
  await page.evaluate(() => document.querySelector('.front-menu a[data-install-go]').click());
  await page.waitForSelector('.install-steps');
  assert.match(await page.textContent('.install-after'), /home screen/);
  await ctx.close();
});

test('install first: the front page of a spa opens with a sheet that adds it to the phone with one tap; nothing about another browser', async () => {
  const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36';
  const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
  const offer = (page) => page.evaluate(() => {
    const e = new Event('beforeinstallprompt', { cancelable: true });
    e.prompt = () => { window.__prompted = (window.__prompted || 0) + 1; return Promise.resolve(); };
    e.userChoice = Promise.resolve({ outcome: 'accepted' });
    window.dispatchEvent(e);
  });
  const fresh = async (hash, ua, init) => {
    const ctx = await browser.newContext({ viewport: { width: DW, height: DH }, serviceWorkers: 'block', userAgent: ua });
    const page = await ctx.newPage();
    if (init) await page.addInitScript(init);
    await page.goto(srv.base + 'index.html' + hash);
    return { ctx, page };
  };
  // Android, first visit: Chrome offers the install only after a tap and 30 seconds on the page, so it has not offered it yet. The sheet is there
  // all the same, its button says where to tap, and once the browser offers the install the sheet turns into the one-tap button
  let { ctx, page } = await fresh('?s=horizon-hill#/', ANDROID);
  await page.waitForSelector('#install-sheet.on');
  assert.equal(await page.getAttribute('#install-sheet', 'data-mode'), 'wait');
  assert.match(await page.textContent('#install-sheet [data-install-go]'), /Add to home screen/);
  await page.click('#install-sheet [data-install-go]');
  await page.waitForSelector('#install-sheet[data-mode="steps"]');
  assert.match(await page.textContent('#install-sheet'), /Install app|Add to Home screen/);
  assert.equal(await page.locator('#install-sheet svg.install-dots').count(), 1);
  assert.equal(await page.locator('#install-sheet [data-install-go]').count(), 0);
  assert.equal(await page.locator('#install-sheet [data-sheet-close]').count(), 1, 'the steps can be put away');
  await offer(page);
  await page.waitForSelector('#install-sheet[data-mode="go"].on');
  assert.equal(await page.evaluate(() => window.__prompted || 0), 0, 'nothing is asked of the phone until the guest taps');
  await page.click('#install-sheet [data-install-go]');
  assert.equal(await page.evaluate(() => window.__prompted), 1);
  await page.waitForSelector('.toast.on');
  await ctx.close();
  // the browser has offered the install before the sheet rises: the button at once; accepted: front page, confirmation, no sheet
  ({ ctx, page } = await fresh('?s=horizon-hill#/', ANDROID));
  await page.waitForSelector('.front-spa');
  await offer(page);
  await page.waitForSelector('#install-sheet.on');
  assert.match(await page.textContent('#install-sheet'), /Keep this sanctuary\s*on your phone/);
  assert.match(await page.textContent('#install-sheet [data-install-go]'), /Add to home screen/);
  assert.doesNotMatch(await page.textContent('#install-sheet'), /brave|chrome/i);
  await page.click('#install-sheet [data-install-go]');
  assert.equal(await page.evaluate(() => window.__prompted), 1, 'one tap, the install dialog');
  await page.waitForSelector('.toast.on');
  await page.waitForFunction(() => !document.getElementById('install-sheet'));
  assert.match(await page.textContent('.front-menu .install-done'), /Added to your home screen/);
  await ctx.close();
  // no "Not now" button: the sheet stays until the guest answers. Saying no in the phone's own dialog is that answer: the sheet goes and does
  // not come back while the guest looks around; the quiet link is still there
  ({ ctx, page } = await fresh('?s=horizon-hill#/', ANDROID));
  await page.waitForSelector('.front-spa');
  await page.evaluate(() => {
    const e = new Event('beforeinstallprompt', { cancelable: true });
    e.prompt = () => { window.__prompted = (window.__prompted || 0) + 1; return Promise.resolve(); };
    e.userChoice = Promise.resolve({ outcome: 'dismissed' });
    window.dispatchEvent(e);
  });
  await page.waitForSelector('#install-sheet.on');
  assert.equal(await page.locator('#install-sheet [data-sheet-close]').count(), 0, 'no "Not now"');
  assert.doesNotMatch(await page.textContent('#install-sheet'), /not now/i);
  assert.equal(await page.evaluate(() => document.documentElement.getAttribute('data-sheet')), 'go');
  await page.click('#install-sheet [data-install-go]');
  await page.waitForFunction(() => !document.getElementById('install-sheet'));
  assert.equal(await page.evaluate(() => document.documentElement.hasAttribute('data-sheet')), false);
  await page.click('.front-menu a[href="#/about"]');
  await page.waitForSelector('.about');
  await page.click('a[href="#/"]');
  await page.waitForSelector('.front-spa');
  await page.waitForTimeout(1500);
  assert.equal(await page.locator('#install-sheet').count(), 0, 'not asked again');
  assert.equal(await page.locator('.front-menu a[data-install-go]').count(), 1);
  await ctx.close();
  // only on the front page: not on the rituals, nor on a ritual's page
  ({ ctx, page } = await fresh('?s=horizon-hill#/rituals', ANDROID));
  await page.waitForSelector('[data-page]');
  await offer(page);
  await page.waitForTimeout(1500);
  assert.equal(await page.locator('#install-sheet').count(), 0);
  await ctx.close();
  // the ordinary sanctuary (no spa) has no sheet
  ({ ctx, page } = await fresh('#/', ANDROID));
  await page.waitForSelector('.front');
  await offer(page);
  await page.waitForTimeout(1500);
  assert.equal(await page.locator('#install-sheet').count(), 0);
  await ctx.close();
  // already on the home screen: no sheet
  ({ ctx, page } = await fresh('?s=horizon-hill#/', IPHONE, () => { Object.defineProperty(navigator, 'standalone', { value: true }); }));
  await page.waitForSelector('.front-spa');
  await page.waitForTimeout(1500);
  assert.equal(await page.locator('#install-sheet').count(), 0);
  await ctx.close();
  // iPhone: it cannot be asked, so the sheet says where to tap (the share icon), with no install button
  ({ ctx, page } = await fresh('?s=horizon-hill#/', IPHONE));
  await page.waitForSelector('#install-sheet.on');
  assert.match(await page.textContent('#install-sheet'), /Add to Home Screen/);
  assert.equal(await page.locator('#install-sheet svg.install-share').count(), 1);
  assert.equal(await page.locator('#install-sheet [data-install-go]').count(), 0);
  await page.click('#install-sheet [data-sheet-close]');
  assert.equal(await page.locator('#install-sheet').count(), 0);
  await ctx.close();
  // inside another app's browser (LinkedIn) it cannot be added: no sheet
  ({ ctx, page } = await fresh('?s=horizon-hill#/', IPHONE + ' [LinkedInApp]'));
  await page.waitForSelector('.front-spa');
  await page.waitForTimeout(1500);
  assert.equal(await page.locator('#install-sheet').count(), 0);
  await ctx.close();
  // on a computer: nothing to offer
  ({ ctx, page } = await fresh('?s=horizon-hill#/', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'));
  await page.waitForSelector('.front-spa');
  await page.waitForTimeout(1500);
  assert.equal(await page.locator('#install-sheet').count(), 0);
  await ctx.close();
});

test('refill: the spa\'s own shop; else the house shop with the spa\'s name in the address; else no button', async () => {
  const HOUSE = 'https://shop.example.com/collections/refills';
  const noOwnShop = async (route) => {
    const res = await route.fetch();
    await route.fulfill({ response: res, body: (await res.text()).replace('"shopUrl": "spas/horizon-hill/shop.html"', '"shopUrl": ""') });
  };
  const withHouse = async (route) => {
    const res = await route.fetch();
    await route.fulfill({ response: res, body: (await res.text()).replace("window.BME_HOUSE_SHOP = '';", "window.BME_HOUSE_SHOP = '" + HOUSE + "';") });
  };
  // 1. no shop of its own and no house shop: no button anywhere (nothing that leads nowhere)
  let p = await phone();
  await p.page.route('**/spas/horizon-hill/spa.js*', noOwnShop);
  await p.page.goto(p.base.base + 'index.html?s=horizon-hill#/r/presence/done');
  await p.page.reload();
  await p.page.waitForSelector('.spa-thanks');
  assert.equal(await p.page.locator('.spa-thanks a.btn').count(), 1, 'only the booking button');
  assert.equal(await p.page.locator('#menu a', { hasText: 'Refill' }).count(), 0);
  await closeAll(p);
  // 2. no shop of its own, but a house shop: the button goes there, and the shop can see which spa it came from
  p = await phone();
  await p.page.route('**/spas/horizon-hill/spa.js*', noOwnShop);
  await p.page.route('**/assets/spa-loader.js*', withHouse);
  await p.page.goto(p.base.base + 'index.html?s=horizon-hill#/r/presence/done');
  await p.page.reload();
  await p.page.waitForSelector('.spa-thanks');
  const refill = p.page.locator('.spa-thanks a.btn', { hasText: 'Refill your products' });
  assert.equal(await refill.getAttribute('href'), HOUSE + '?utm_source=bodymindearth&utm_medium=ritual&utm_content=refill&utm_campaign=horizon-hill');
  assert.equal(await refill.getAttribute('target'), '_blank');
  assert.equal(await p.page.locator('#menu a', { hasText: 'Refill products' }).count(), 1);
  await closeAll(p);
  // 3. the spa's own shop wins over the house shop
  p = await phone();
  await p.page.route('**/assets/spa-loader.js*', withHouse);
  await p.page.goto(p.base.base + 'index.html?s=horizon-hill#/r/presence/done');
  await p.page.reload();
  await p.page.waitForSelector('.spa-thanks');
  assert.match(await p.page.locator('.spa-thanks a.btn', { hasText: 'Refill your products' }).getAttribute('href'), /^spas\/horizon-hill\/shop\.html\?/);
  await closeAll(p);
});

test('the sanctuary\'s own five rituals play as before', { timeout: 60000 }, async () => {
  const p = await phone();
  await open(p, '#/r/balance/s');
  await p.page.click('[data-toggle]');
  await p.page.waitForFunction(() => document.querySelector('[data-player]').getAttribute('data-state') === 'playing', null, { timeout: 15000 });
  assert.ok(!(await p.page.evaluate(() => !!document.documentElement.getAttribute('data-tg'))), 'no Together look leaks into the rituals');
  // the line is the way to move about in it: drag it to the middle and the clock follows
  await p.page.fill('[data-range]', '500');
  await p.page.dispatchEvent('[data-range]', 'input');
  const clock = await p.page.textContent('[data-now]');
  const [mm, ss] = clock.split(':').map(Number);
  assert.ok(mm * 60 + ss > 30, 'the clock moved with the line: ' + clock);
  await p.page.click('#menu-btn');
  await p.page.click('#menu a[href="#/rituals"]');
  await p.page.waitForSelector('.rc-track');
  assert.equal(await p.page.locator('.rc-slide').count(), 5);
  await closeAll(p);
});

test('reduced motion: nothing moves, everything still works', { timeout: 60000 }, async () => {
  const p = await phone({ reduced: true });
  await open(p, '#/together');
  const anim = await p.page.evaluate(() => getComputedStyle(document.querySelector('.tg-hero .tg-light i.a')).animationDuration);
  assert.ok(parseFloat(anim) < 0.01, 'the light stands still: ' + anim);
  await closeAll(p);
});

test('small phones (360 × 640): nothing is cut off sideways, the button is reachable', async () => {
  const p = await phone({ size: { width: 360, height: 640 } });
  for (const h of ['#/together', '#/together/rituals', '#/together/heart-to-heart', '#/together/solo/heart-to-heart']) {
    await open(p, h);
    await p.page.waitForTimeout(700);
    const over = await p.page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    assert.ok(over <= 0, `${h}: no sideways scrolling (${over}px over)`);
    await shot(p, 'small-' + h.replace(/[^a-z]+/g, '-'));
  }
  await closeAll(p);
});
