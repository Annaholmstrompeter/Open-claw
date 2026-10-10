// Browser tests for TOGETHER: two phones (two separate browser contexts) in one shared ritual.
//
//   cd sanctuary/tests && npm install && node e2e/run.mjs
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
  // both lengths are always there: Presence has the short recording (a button), the extended one is not in yet (quiet, not pressable)
  assert.equal(await p.page.locator('.ri-btn').count(), 2);
  assert.equal(await p.page.locator('a.ri-btn').count(), 1);
  assert.equal(await p.page.getAttribute('.ri-btn.ri-off', 'aria-disabled'), 'true');
  assert.match(await p.page.textContent('.ri-btn.ri-off'), /Extended ritual/);
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
  // as bare as possible: one button (play), the line to drag, and no links underneath (the menu has the way home)
  assert.equal(await p.page.locator('.player button').count(), 1, 'one button');
  assert.equal(await p.page.locator('.player a').count(), 0, 'no links on the page itself');
  assert.match(await p.page.textContent('.player .eyebrow'), /Extended ritual/);
  // a ritual without any recording yet shows both lengths, quiet, and nothing to press
  await open(p, '#/r/luminance');
  await p.page.waitForSelector('.ri-off');
  assert.equal(await p.page.locator('.ri-btn.ri-off').count(), 2);
  assert.equal(await p.page.locator('a.ri-btn').count(), 0);
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
