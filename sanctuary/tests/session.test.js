// Unit tests for the shared session (no browser, no network).  Run:  node --test sanctuary/tests/
const test = require('node:test');
const assert = require('node:assert/strict');
const Core = require('../public/assets/together/session.js');
const { Session, ClockSync, positionAt, makeRoomId, parseRoomId, C } = Core;

/* A tiny fake "internet" joining transports in one room, with a delay and a fault switch. */
class Net {
  constructor(delay) { this.delay = delay || 0; this.clients = []; }
  transport() {
    const net = this;
    const t = {
      h: null, meta: null, up: true, lat: net.delay,
      // like the real service: first "you are in", then who was already here (without you), then you appear when you say who you are
      connect(room, id, h) {
        t.h = h; t.id = id; net.clients.push(t);
        setTimeout(() => {
          h.status('online');
          h.presence(net.clients.filter((c) => c !== t && c.up && c.meta).map((c) => ({ ...c.meta })));
        }, 1);
      },
      track(meta) { t.meta = meta; setTimeout(() => net.presence(), 3 + t.lat); },   // a round trip to the service
      send(m) {
        if (!t.up) return;
        net.clients.forEach((o) => { if (o !== t && o.up && o.h) setTimeout(() => o.up && o.h.message(JSON.parse(JSON.stringify(m))), t.lat + o.lat); });
      },
      close() { net.clients = net.clients.filter((o) => o !== t); t.up = false; net.presence(); },
      drop() { t.up = false; t.h.status('lost'); net.presence(); },
      restore() { t.up = true; t.h.status('online'); net.presence(); }
    };
    return t;
  }
  presence() {
    const list = this.clients.filter((c) => c.up && c.meta).map((c) => c.meta);
    this.clients.forEach((c) => { if (c.up && c.h) c.h.presence(list.map((m) => ({ ...m }))); });
  }
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, ms = 3000) {
  const end = Date.now() + ms;
  while (Date.now() < end) { if (fn()) return; await wait(10); }
  throw new Error('timed out waiting for: ' + fn);
}
function pair(opts = {}) {
  const net = new Net(opts.delay || 0);
  const skew = opts.skew || 0;                       // guest's clock is this many ms ahead of the host's
  const host = new Session({ role: 'host', room: 'r', transport: net.transport() });
  const guest = new Session({ role: 'guest', room: 'r', transport: net.transport(), now: () => Date.now() + skew });
  return { net, host, guest, skew };
}

test('room ids: long, random, with an end date', () => {
  const now = Date.now(), a = makeRoomId(now), b = makeRoomId(now);
  assert.notEqual(a, b);
  assert.match(a, /^[0-9a-z]{6,10}-[a-z2-7]{26}$/);
  assert.equal(parseRoomId(a).expires, now + C.ROOM_TTL);
  assert.equal(parseRoomId('short'), null);
  assert.equal(parseRoomId('abcdef-' + 'a'.repeat(25)), null);
  assert.equal(parseRoomId(null), null);
});

test('positionAt: waiting, playing and paused', () => {
  const tl = { status: 'playing', refTime: 10000, pos: 5 };
  assert.equal(positionAt(tl, 9000), 5);           // not started yet: stays at the start point
  assert.equal(positionAt(tl, 10000), 5);
  assert.equal(positionAt(tl, 12500), 7.5);
  assert.equal(positionAt({ status: 'paused', refTime: 1, pos: 42 }, 99999), 42);
  assert.equal(positionAt({ status: 'lobby' }, 5), 0);
});

test('clock: finds the offset between two clocks, trusting the quickest rounds', () => {
  const cs = new ClockSync();
  const OFFSET = 4321;                                // host is 4321 ms ahead of the guest
  const rounds = [[20, 20], [200, 20], [20, 300], [25, 25], [22, 23], [900, 20]]; // [there, back] latencies
  let t = 100000;
  for (const [there, back] of rounds) {
    const t0 = t, t1 = t0 + there + OFFSET, t3 = t0 + there + back;
    cs.add(t0, t1, t3); t += 1000;
  }
  const e = cs.estimate();
  assert.ok(Math.abs(e.offset - OFFSET) < 6, 'offset ' + e.offset);
  assert.ok(e.rtt <= 50);
});

test('clock: a lopsided path is the limit, and is bounded by half the round trip', () => {
  const cs = new ClockSync();
  // 100 ms there, 20 ms back, every time: the true offset is 0 but the estimate is off by (100-20)/2 = 40
  for (let i = 0; i < 6; i++) cs.add(1000 * i, 1000 * i + 100, 1000 * i + 120);
  assert.ok(Math.abs(cs.estimate().offset) <= 60);
});

test('two phones meet, get ready, and begin; a skewed guest clock does not matter', async () => {
  const { host, guest, skew } = pair({ delay: 15, skew: 7777 });
  const hostTl = [], guestTl = [];
  host.on('timeline', (t) => hostTl.push(t));
  guest.on('timeline', (t) => guestTl.push(t));
  host.start(); guest.start();
  await until(() => host.view().peer.present && guest.view().peer.present && guest.view().clockSynced);
  assert.equal(host.view().canBegin, false);       // nobody ready yet
  host.setPrepared(true); host.setReady(true);
  assert.equal(host.view().canBegin, false);       // the guest has not said "ready"
  guest.setPrepared(true); guest.setReady(true);
  await until(() => host.view().canBegin);
  assert.equal(guest.begin(), false);              // only the host can begin
  assert.equal(host.begin(), true);
  await until(() => guestTl.length === 1);
  const a = hostTl[0], b = guestTl[0];
  assert.equal(a.status, 'playing');
  assert.equal(b.seq, a.seq);
  // the same moment on both phones' own clocks, despite the 7.7 s skew
  const hostStartsAt = a.refTime;                                 // host clock
  const guestSharedAtThatInstant = guest.sharedNow();
  const hostNowReal = host.sharedNow();
  assert.ok(Math.abs(guestSharedAtThatInstant - hostNowReal) < 40, 'shared clocks agree within 40 ms: ' + (guestSharedAtThatInstant - hostNowReal));
  assert.ok(hostStartsAt - hostNowReal > C.BEGIN_LEAD - 100);
  host.destroy(); guest.destroy();
});

test('pause and resume from either phone; the latest command wins on both', async () => {
  const { host, guest } = pair({ delay: 5 });
  const g = [], h = [];
  host.on('timeline', (t) => h.push(t)); guest.on('timeline', (t) => g.push(t));
  host.start(); guest.start();
  await until(() => host.view().peer.present && guest.view().clockSynced);
  host.setPrepared(true); host.setReady(true); guest.setPrepared(true); guest.setReady(true);
  await until(() => host.view().canBegin);
  host.begin();
  await until(() => g.length === 1);
  assert.equal(guest.pause(), true);               // the guest pauses
  await until(() => h.length === 2);
  assert.equal(h[1].status, 'paused');
  assert.equal(host.tl.seq, guest.tl.seq);
  assert.equal(host.resume(), true);               // the host resumes
  await until(() => g.length === 3);
  assert.equal(g[2].status, 'playing');
  assert.equal(g[2].pos, h[1].pos);                // from exactly where it stopped
  assert.equal(host.pause() && guest.pause() !== undefined, true);
  host.destroy(); guest.destroy();
});

test('two commands at the same instant: both phones end up on the same one', async () => {
  const { host, guest } = pair({ delay: 30 });
  host.start(); guest.start();
  await until(() => host.view().peer.present && guest.view().clockSynced);
  host.setPrepared(true); host.setReady(true); guest.setPrepared(true); guest.setReady(true);
  await until(() => host.view().canBegin);
  host.begin();
  await until(() => guest.tl.seq === 1);
  host.pause(); guest.pause();                     // both press pause at once
  await wait(200);
  assert.equal(host.tl.seq, guest.tl.seq);
  assert.equal(host.tl.by, guest.tl.by);
  assert.equal(host.tl.status, 'paused');
  host.destroy(); guest.destroy();
});

test('a lost connection does not stop the timeline; the phones catch up when it returns', async () => {
  const { net, host, guest } = pair({ delay: 5 });
  host.start(); guest.start();
  await until(() => host.view().peer.present && guest.view().clockSynced);
  host.setPrepared(true); host.setReady(true); guest.setPrepared(true); guest.setReady(true);
  await until(() => host.view().canBegin);
  host.begin();
  await until(() => guest.tl.seq === 1);
  const gt = net.clients.find((c) => c.id === guest.id);
  gt.drop();
  assert.equal(guest.view().reconnecting, true);
  host.pause();                                    // happens while the guest is offline
  await wait(60);
  assert.equal(guest.tl.status, 'playing');        // the guest has not heard yet
  gt.restore();                                    // back online: it says hello, the host answers with the timeline
  await until(() => guest.tl.status === 'paused');
  assert.equal(guest.view().reconnecting, false);
  host.destroy(); guest.destroy();
});

test('a partner who says goodbye is gone at once; one who just flickers is not announced', async () => {
  const { net, host, guest } = pair();
  host.start(); guest.start();
  await until(() => host.view().peer.present);
  const gt = net.clients.find((c) => c.id === guest.id);
  gt.drop();                                       // a flicker
  await wait(60);
  assert.equal(host.view().peer.present, false);
  assert.equal(host.view().peer.away, true);
  assert.equal(host.view().peer.left, false);
  gt.restore();
  await until(() => host.view().peer.present);
  assert.equal(host.view().peer.away, false);
  guest.leave();                                   // an explicit goodbye
  await until(() => host.view().peer.left);
  assert.equal(host.view().peer.present, false);
  host.destroy();
});

test('a partner gone for longer than the grace period is announced', async () => {
  C.PEER_GRACE = 80;
  const { net, host, guest } = pair();
  host.start(); guest.start();
  await until(() => host.view().peer.present);
  net.clients.find((c) => c.id === guest.id).drop();
  await until(() => host.view().peer.left);
  host.destroy(); guest.destroy();
  C.PEER_GRACE = 9000;
});

test('a reloaded phone replaces its older copy; it rejoins a ritual already under way', async () => {
  const net = new Net(5);
  const host = new Session({ role: 'host', room: 'r', transport: net.transport() });
  const guest1 = new Session({ role: 'guest', room: 'r', transport: net.transport() });
  host.start(); guest1.start();
  await until(() => host.view().peer.present && guest1.view().clockSynced);
  host.setPrepared(true); host.setReady(true); guest1.setPrepared(true); guest1.setReady(true);
  await until(() => host.view().canBegin);
  host.begin();
  await until(() => guest1.tl.seq === 1);
  // the guest reloads the page: a new session with a new id, while the old presence is still around
  const guest2 = new Session({ role: 'guest', room: 'r', transport: net.transport(), now: () => Date.now() + 50 });
  const got = [];
  guest2.on('timeline', (t) => got.push(t));
  guest2.start();
  await until(() => guest1.view().replaced);       // the older copy is told it was replaced
  assert.equal(guest2.view().replaced, false);
  await until(() => got.length === 1);             // and the newcomer is told where the ritual is
  assert.equal(got[0].status, 'playing');
  host.destroy(); guest1.destroy(); guest2.destroy();
});

test('a guest that has not measured its clock does not act on shared time', async () => {
  const net = new Net(5);
  const host = new Session({ role: 'host', room: 'r', transport: net.transport() });
  const guest = new Session({ role: 'guest', room: 'r', transport: net.transport(), now: () => Date.now() + 3000 });
  const seen = [];
  guest.on('timeline', (t) => seen.push(t));
  guest.tl = { seq: 0, by: '', status: 'lobby', refTime: 0, pos: 0 };
  guest._onMessage({ v: 1, id: 'host-x', k: 'tl', tl: { seq: 1, by: 'host-x', status: 'playing', refTime: Date.now() + 5000, pos: 0 } });
  assert.equal(seen.length, 0, 'held back until the clock is measured');
  host.start(); guest.start();
  await until(() => seen.length === 1);
  assert.ok(guest.view().clockSynced);
  host.destroy(); guest.destroy();
});

test('begin is refused until everything is in place', async () => {
  const { host, guest } = pair();
  host.start(); guest.start();
  await until(() => host.view().peer.present);
  assert.equal(host.begin(), false);
  host.setPrepared(true); host.setReady(true);
  assert.equal(host.begin(), false);
  guest.setPrepared(true);                         // prepared but has not tapped "ready"
  await wait(40);
  assert.equal(host.begin(), false);
  guest.setReady(true);
  await until(() => host.view().canBegin);
  assert.equal(host.begin(), true);
  assert.equal(host.begin(), false);               // not twice
  host.destroy(); guest.destroy();
});

test('a newer window wins even when its phone\'s clock is far behind', async () => {
  const net = new Net(5);
  const host = new Session({ role: 'host', room: 'r', transport: net.transport() });
  const first = new Session({ role: 'guest', room: 'r', transport: net.transport(), now: () => Date.now() + 9000 });   // clock 9 s ahead
  host.start(); first.start();
  await until(() => host.view().peer.present && first.view().clockSynced);
  const second = new Session({ role: 'guest', room: 'r', transport: net.transport(), now: () => Date.now() - 9000 });  // clock 9 s behind
  second.start();
  await until(() => first.view().replaced);
  await wait(60);
  assert.equal(second.view().replaced, false, 'the window that arrived last stays');
  host.destroy(); first.destroy(); second.destroy();
});

/* ——— found by an independent review: each of these failed before it was fixed ——— */

async function running(opts = {}) {
  const net = new Net(opts.delay || 5);
  const host = new Session({ role: 'host', room: 'r', transport: net.transport(), seat: 'HOSTSEAT' });
  const guest = new Session({ role: 'guest', room: 'r', transport: net.transport(), seat: 'S1', now: () => Date.now() + (opts.skew || 0) });
  host.start(); guest.start();
  await until(() => host.view().peer.present && guest.view().clockSynced);
  host.setPrepared(true); host.setReady(true); guest.setPrepared(true); guest.setReady(true);
  await until(() => host.view().canBegin);
  host.begin();
  await until(() => guest.tl.seq === 1);
  return { net, host, guest };
}

test('a command made while this phone is offline reaches the other one when the line is back', async () => {
  const { net, host, guest } = await running();
  const gt = net.clients.find((c) => c.id === guest.id);
  gt.drop();
  assert.equal(guest.pause(), true);              // the guest pauses into a dead line
  await wait(60);
  assert.equal(host.tl.status, 'playing', 'the host has not heard');
  gt.restore();
  await until(() => host.tl.status === 'paused');  // and now it has: the guest says where it is
  assert.equal(host.tl.seq, guest.tl.seq);
  host.destroy(); guest.destroy();
});

test('the timeline is repeated now and then, so one lost message is not lost for good', async () => {
  C.RESEND = 60;
  const { net, host, guest } = await running();
  // the guest's phone silently loses what it sends for a moment (the host did not hear the pause)
  const gt = net.clients.find((c) => c.id === guest.id);
  gt.up = false; guest.pause(); gt.up = true;
  await until(() => host.tl.status === 'paused', 2000);
  host.destroy(); guest.destroy();
  C.RESEND = 15000;
});

test('a slow start that got there in the end is no longer an error', async () => {
  const net = new Net(0);
  const host = new Session({ role: 'host', room: 'r', transport: net.transport() });
  host.start();
  await until(() => host.status === 'online');
  host._onStatus('error', { code: 'unavailable' });
  assert.deepEqual(host.view().error, { code: 'unavailable' });
  host._onStatus('lost'); host._onStatus('online');
  assert.equal(host.view().error, null);
  host.destroy();
});

test('what the other phone sends is checked before it is believed', async () => {
  const { host, guest } = await running();
  const real = { ...host.tl };
  const bad = [
    { seq: 1e300, by: 'x', status: 'paused', refTime: Date.now(), pos: 1 },
    { seq: 5, by: 'x', status: 'paused', refTime: Date.now(), pos: 'abc' },
    { seq: 5, by: 'x', status: 'paused', refTime: Date.now(), pos: NaN },
    { seq: 5, by: 'x', status: 'paused', refTime: Date.now(), pos: -3 },
    { seq: 5, by: 'x', status: 'exploding', refTime: Date.now(), pos: 1 },
    { seq: 5.5, by: 'x', status: 'paused', refTime: Date.now(), pos: 1 },
    { seq: 5, by: 'x', status: 'playing', refTime: Date.now() + 3600e3, pos: 1 },   // a countdown an hour long
    { seq: 5, by: { evil: 1 }, status: 'paused', refTime: Date.now(), pos: 1 },
    null, 'x', 7
  ];
  for (const tl of bad) host._onMessage({ v: 1, id: guest.id, k: 'tl', tl });
  assert.deepEqual(host.tl, real, 'none of them was adopted');
  host._onMessage({ v: 1, id: guest.id, k: 'tl', tl: { seq: 2, by: guest.id, status: 'paused', refTime: host.sharedNow(), pos: 4 } });
  assert.equal(host.tl.seq, 2, 'while a proper one is');
  host.destroy(); guest.destroy();
});

test('a guest cannot act on shared time before its clock is measured', () => {
  const net = new Net(0);
  const guest = new Session({ role: 'guest', room: 'r', transport: net.transport(), now: () => Date.now() + 3600e3 });
  guest.tl = { seq: 1, by: 'h', status: 'playing', refTime: Date.now(), pos: 0 };
  assert.equal(guest.pause(), false);
  assert.equal(guest.tl.seq, 1);
});

test('three slow round trips do not count as a measured clock', () => {
  const net = new Net(0);
  const guest = new Session({ role: 'guest', room: 'r', transport: net.transport() });
  for (let i = 0; i < 4; i++) guest._onMessage({ v: 1, id: 'host', k: 'pong', to: guest.id, n: i, t0: guest.now() - 3000, t1: guest.now() - 1500 });
  assert.equal(guest.clk, false);
});

test('someone else with the link cannot take the guest\'s seat, nor give the host orders', async () => {
  const { net, host, guest } = await running();
  const stranger = new Session({ role: 'guest', room: 'r', transport: net.transport(), seat: 'S2' });
  stranger.start();
  await until(() => stranger.view().refused);
  assert.equal(guest.view().replaced, false, 'the guest stays');
  assert.equal(guest.view().refused, false);
  assert.equal(host.partnerId, guest.id, 'the host still listens to the guest');
  stranger._send({ k: 'tl', tl: { seq: 99, by: stranger.id, status: 'paused', refTime: host.sharedNow(), pos: 10 } });
  await wait(80);
  assert.equal(host.tl.status, 'playing', 'orders from the stranger are not followed');
  assert.equal(stranger.pause(), false, 'and the stranger cannot give any');
  host.destroy(); guest.destroy(); stranger.destroy();
});

test('the same person reloading takes over the seat, and the old copy is ignored from then on', async () => {
  const { net, host, guest } = await running();
  const again = new Session({ role: 'guest', room: 'r', transport: net.transport(), seat: 'S1' });
  const got = [];
  again.on('timeline', (t) => got.push(t));
  again.start();
  await until(() => guest.view().replaced);
  assert.equal(again.view().replaced, false);
  assert.equal(again.view().refused, false);
  await until(() => host.partnerId === again.id);
  guest._send({ k: 'tl', tl: { seq: 50, by: guest.id, status: 'paused', refTime: host.sharedNow(), pos: 3 } });   // the stale copy speaks
  await wait(80);
  assert.equal(host.tl.status, 'playing', 'the old copy is not obeyed');
  await until(() => got.length === 1);             // the new copy is told where the ritual is, without having to ask twice
  assert.equal(got[0].status, 'playing');
  host.destroy(); guest.destroy(); again.destroy();
});
