// Det Anna faktiskt kör: launcher-filerna startar src/launcher.mjs. Här körs den som en egen process:
//   setup       nyckeln skrivs i en riktig (pty) terminal och syns inte, sparas med rätt rättigheter, och kontrolleras mot en lokal testserver
//   start       processen startar kontrollsidan, visar "AI ansluten ✓" eller ett tydligt fel, och stängs av knappen Stäng programmet
//   delete-key  raderar den sparade nyckeln
// pty-testerna kräver python3 (bara för testet; själva programmet behöver det inte).
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { startFakeAnthropic } from './support/fake-anthropic.mjs';
import { endTurn } from './support/fake-client.mjs';
import { CHROME } from './support/browser.mjs';

const pocRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const rnd = tag => 'sk-ant-api03-' + tag + '-' + crypto.randomBytes(18).toString('hex');
const hasPython = spawnSync('python3', ['-c', 'import pty, select'], { stdio: 'ignore' }).status === 0;
const tmp = p => fs.mkdtempSync(path.join(os.tmpdir(), p));
const baseEnv = home => ({ PATH: process.env.PATH, HOME: home, CHROME_PATH: CHROME, GROSSISTAGENT_HOME: path.join(home, '.grossistagent'), LANG: 'C.UTF-8' });

const PTY = `
import os, pty, sys, select, time, json
args, env, sends = json.loads(sys.argv[1]), json.loads(sys.argv[2]), json.loads(sys.argv[3])
pid, fd = pty.fork()
if pid == 0:
    os.chdir(sys.argv[4]); os.execvpe(args[0], args, env)
buf, pos, idx, deadline = b'', 0, 0, time.time() + 60
while time.time() < deadline:
    r, _, _ = select.select([fd], [], [], 0.2)
    if r:
        try: data = os.read(fd, 4096)
        except OSError: break
        if not data: break
        buf += data
    if idx < len(sends) and sends[idx][0].encode() in buf[pos:]:
        time.sleep(0.6)                      # låt programmet hinna slå av ekot, som en människa som klistrar in
        os.write(fd, sends[idx][1].encode()); pos = len(buf); idx += 1
_, status = os.waitpid(pid, 0)
print(json.dumps({'output': buf.decode('utf-8', 'replace'), 'exit': os.waitstatus_to_exitcode(status), 'sent': idx}))
`;
/** Kör programmet i en pty. Asynkront, så att testets egen (fake) API-server kan svara medan programmet väntar. */
function inTerminal(args, env, sends) {
  const dir = tmp('ga-pty-'); const script = path.join(dir, 'pty.py'); fs.writeFileSync(script, PTY);
  return new Promise((resolve, reject) => {
    const child = spawn('python3', ['-I', script, JSON.stringify([process.execPath, ...args]), JSON.stringify(env), JSON.stringify(sends), pocRoot], { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '', err = '';
    child.stdout.on('data', d => { out += d; }); child.stderr.on('data', d => { err += d; });
    const timer = setTimeout(() => { child.kill('SIGKILL'); reject(new Error('terminaltestet hängde: ' + out + err)); }, 90000);
    child.on('exit', code => { clearTimeout(timer); fs.rmSync(dir, { recursive: true, force: true }); if (code !== 0) return reject(new Error('python fel: ' + err)); try { resolve(JSON.parse(out)); } catch (e) { reject(e); } });
  });
}
const keyFile = home => path.join(home, '.grossistagent', 'anthropic-key.txt');

test('SETUP i en riktig terminal: nyckeln syns inte när den skrivs, kontrolleras hos (test)servern, sparas med rätt rättigheter utanför repot, och skrivs aldrig ut', { skip: !hasPython && 'python3 saknas' }, async () => {
  const KEY = rnd('SETUP'); const home = tmp('ga-setup-home-');
  const api = await startFakeAnthropic({ key: KEY, steps: [endTurn('OK')] });
  try {
    const r = await inTerminal(['src/launcher.mjs', 'setup', '--test-api', api.url], baseEnv(home), [['Klistra in nyckeln', 'abc\r'], ['Klistra in nyckeln', KEY + '\r']]);
    assert.equal(r.exit, 0, r.output); assert.equal(r.sent, 2);
    assert.ok(!r.output.includes(KEY) && !r.output.includes('sk-ant-api03'), 'nyckeln syntes i terminalen');
    for (const must of ['GROSSISTAGENT: SETUP', '✓ Node.js', '✓ Google Chrome hittades', 'platform.claude.com', 'Settings → API Keys', 'Det där ser inte ut som en Anthropic-nyckel', 'Kontrollerar nyckeln', '✓ Nyckeln är sparad i', 'AI ansluten ✓', 'KLART', '2-STARTA-GROSSISTAGENT']) assert.ok(r.output.includes(must), 'saknas i utskriften: ' + must + '\n' + r.output);
    assert.equal(fs.readFileSync(keyFile(home), 'utf8'), KEY + '\n');
    if (process.platform !== 'win32') { assert.equal(fs.statSync(keyFile(home)).mode & 0o777, 0o600); assert.equal(fs.statSync(path.dirname(keyFile(home))).mode & 0o777, 0o700); }
    assert.equal(api.requests.length, 1); assert.equal(api.requests[0].headers['x-api-key'], KEY); assert.deepEqual(api.violations, []);
    assert.ok(!keyFile(home).startsWith(pocRoot), 'utanför repot');
    // kör SETUP igen: nyckeln finns, svara nej
    const again = await inTerminal(['src/launcher.mjs', 'setup', '--test-api', api.url], baseEnv(home), [['Vill du byta ut den?', 'n\r']]);
    assert.equal(again.exit, 0); assert.ok(again.output.includes('En nyckel finns redan') && again.output.includes('KLART')); assert.ok(!again.output.includes(KEY));
    assert.equal(fs.readFileSync(keyFile(home), 'utf8'), KEY + '\n');
  } finally { await api.close(); fs.rmSync(home, { recursive: true, force: true }); }
});

test('SETUP med fel nyckel: tydligt besked, inget sparas efter tre försök, och den felaktiga nyckeln skrivs aldrig ut', { skip: !hasPython && 'python3 saknas' }, async () => {
  const GOOD = rnd('RIKTIG'), BAD = rnd('FEL'); const home = tmp('ga-setup-bad-');
  const api = await startFakeAnthropic({ key: GOOD, steps: [] });
  try {
    const r = await inTerminal(['src/launcher.mjs', 'setup', '--test-api', api.url], baseEnv(home), [['Klistra in nyckeln', BAD + '\r'], ['Klistra in nyckeln', BAD + '\r'], ['Klistra in nyckeln', BAD + '\r']]);
    assert.equal(r.exit, 1, r.output); assert.equal(r.sent, 3);
    assert.equal((r.output.match(/API-nyckeln godkändes inte \(401\)/g) || []).length, 3); assert.ok(r.output.includes('Ingen nyckel sparades'));
    assert.ok(!r.output.includes(BAD) && !r.output.includes(GOOD) && !r.output.includes('sk-ant-api03'));
    assert.ok(!fs.existsSync(keyFile(home)), 'ingen fil för en nyckel som inte godkänts');
  } finally { await api.close(); fs.rmSync(home, { recursive: true, force: true }); }
});

test('RADERA NYCKEL: den sparade filen försvinner, och nyckeln nämns aldrig', { skip: !hasPython && 'python3 saknas' }, async () => {
  const KEY = rnd('RADERA'); const home = tmp('ga-del-');
  fs.mkdirSync(path.join(home, '.grossistagent'), { recursive: true }); fs.writeFileSync(keyFile(home), KEY + '\n', { mode: 0o600 });
  try {
    const no = await inTerminal(['src/launcher.mjs', 'delete-key'], baseEnv(home), [['Radera den sparade', 'n\r']]);
    assert.ok(no.output.includes('Ingenting raderades')); assert.ok(fs.existsSync(keyFile(home)));
    const yes = await inTerminal(['src/launcher.mjs', 'delete-key'], baseEnv(home), [['Radera den sparade', 'j\r']]);
    assert.equal(yes.exit, 0); assert.ok(yes.output.includes('✓ Den sparade nyckeln är raderad') && yes.output.includes('platform.claude.com')); assert.ok(!yes.output.includes(KEY));
    assert.ok(!fs.existsSync(keyFile(home)));
  } finally { fs.rmSync(home, { recursive: true, force: true }); }
});

/** Startar `launcher start` som egen process. Ger { url, port, token, out(), stop(), exited } */
function startLauncher(env, extra) {
  const child = spawn(process.execPath, ['src/launcher.mjs', 'start', '--no-open', '--headless', '--no-sandbox', ...extra], { cwd: pocRoot, env, stdio: ['ignore', 'pipe', 'pipe'] });
  let out = '';
  child.stdout.on('data', d => { out += d; }); child.stderr.on('data', d => { out += d; });
  const exited = new Promise(r => child.on('exit', code => r(code)));
  return new Promise((resolve, reject) => {
    const t0 = Date.now();
    const timer = setInterval(() => {
      const m = out.match(/http:\/\/127\.0\.0\.1:(\d+)\/\?t=([A-Za-z0-9_-]+)/);
      if (m) { clearInterval(timer); resolve({ port: Number(m[1]), token: m[2], out: () => out, exited, kill: () => child.kill('SIGKILL') }); }
      else if (Date.now() - t0 > 20000) { clearInterval(timer); child.kill('SIGKILL'); reject(new Error('startade inte: ' + out)); }
    }, 100);
  });
}
const get = (l, p, headers = {}) => new Promise((resolve, reject) => { http.get({ host: '127.0.0.1', port: l.port, path: p, headers: { 'x-poc-token': l.token, ...headers } }, res => { let d = ''; res.on('data', c => { d += c; }); res.on('end', () => resolve({ status: res.statusCode, text: d, json: (() => { try { return JSON.parse(d); } catch (e) { return null; } })() })); }).on('error', reject); });
const post = (l, p, body) => new Promise((resolve, reject) => { const req = http.request({ host: '127.0.0.1', port: l.port, method: 'POST', path: p, headers: { 'x-poc-token': l.token, 'content-type': 'application/json' } }, res => { let d = ''; res.on('data', c => { d += c; }); res.on('end', () => resolve({ status: res.statusCode, json: (() => { try { return JSON.parse(d); } catch (e) { return null; } })() })); }); req.on('error', reject); req.end(JSON.stringify(body || {})); });
const until = async (fn, ms = 15000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const v = await fn(); if (v) return v; await new Promise(r => setTimeout(r, 150)); } throw new Error('tidsgräns'); };

test('START som egen process: "AI ansluten ✓" på startskärmen, samtyckesrutan har Annas ordalydelse, nyckeln syns varken i sidan eller utskriften, och Stäng programmet avslutar processen', async () => {
  const KEY = rnd('START'); const home = tmp('ga-start-home-');
  fs.mkdirSync(path.join(home, '.grossistagent'), { recursive: true }); fs.writeFileSync(keyFile(home), KEY + '\n', { mode: 0o600 });
  const api = await startFakeAnthropic({ key: KEY, steps: [endTurn('OK')] });
  const l = await startLauncher(baseEnv(home), ['--test-api', api.url]);
  try {
    const st = await until(async () => { const s = (await get(l, '/api/state')).json; return s.ai && s.ai.kind !== 'ej_kontrollerad' ? s : null; });
    assert.deepEqual([st.stage, st.ai.ok, st.ai.message], ['start', true, 'AI ansluten ✓']);
    const page = await get(l, '/?t=' + l.token);
    assert.equal(page.status, 200); assert.ok(page.text.includes('Kontoinnehavaren samtycker till detta begränsade read-only-test med sitt eget konto. Testet får inte genomföra köp eller ändra konto/order.'));
    assert.ok(page.text.includes('Starta DEMO') && page.text.includes('Starta RIKTIG GROSSIST'));
    await until(() => /AI ansluten ✓/.test(l.out()));
    for (const secret of [KEY, 'sk-ant']) { assert.ok(!l.out().includes(secret), 'nyckeln i utskriften'); assert.ok(!page.text.includes(secret) && !JSON.stringify(st).includes(secret), 'nyckeln i sidan'); }
    assert.equal(api.requests[0].headers['x-api-key'], KEY);
    assert.equal((await post(l, '/api/quit')).status, 200);
    assert.equal(await Promise.race([l.exited, new Promise(r => setTimeout(() => r('hängde kvar'), 5000))]), 0);
    assert.ok(l.out().includes('Programmet är stängt'));
  } finally { l.kill(); await api.close(); fs.rmSync(home, { recursive: true, force: true }); }
});

test('START utan nyckel: tydligt fel (hänvisar till 1-SETUP) och ingen session kan startas', async () => {
  const home = tmp('ga-start-nokey-');
  const l = await startLauncher(baseEnv(home), []);
  try {
    const st = await until(async () => { const s = (await get(l, '/api/state')).json; return s.ai && s.ai.kind !== 'ej_kontrollerad' ? s : null; });
    assert.deepEqual([st.ai.ok, st.ai.kind], [false, 'nokey']); assert.match(st.ai.message, /ingen API-nyckel.*1-SETUP/);
    await until(() => /AI ej ansluten/.test(l.out()));
    const b = await post(l, '/api/begin', { mode: 'demo' }); assert.equal(b.status, 409);
    await post(l, '/api/quit'); assert.equal(await Promise.race([l.exited, new Promise(r => setTimeout(() => r('hängde kvar'), 5000))]), 0);
  } finally { l.kill(); fs.rmSync(home, { recursive: true, force: true }); }
});

test('launcher-filerna: finns för Windows och Mac, anropar rätt kommandon, och Mac-filerna är körbara', () => {
  const read = f => fs.readFileSync(path.join(pocRoot, f), 'utf8');
  for (const [name, cmd] of [['1-SETUP', 'setup'], ['2-STARTA-GROSSISTAGENT', 'start'], ['3-RADERA-NYCKEL', 'delete-key']]) {
    const bat = read(name + '.bat'), mac = read(name + '.command');
    assert.ok(bat.includes('node src\\launcher.mjs ' + cmd), name + '.bat'); assert.ok(mac.includes('node src/launcher.mjs ' + cmd), name + '.command');
    assert.ok(bat.includes('\r\n') && !/[^\x00-\x7f]/.test(bat), name + '.bat: CRLF och bara ASCII');
    assert.ok(mac.startsWith('#!/bin/bash\n') && !mac.includes('\r'), name + '.command');
    if (process.platform !== 'win32') assert.ok(fs.statSync(path.join(pocRoot, name + '.command')).mode & 0o111, name + '.command ska vara körbar');
    assert.ok(/nodejs\.org/.test(bat) && /nodejs\.org/.test(mac), 'hänvisar till Node.js om det saknas');
  }
  assert.ok(read('1-SETUP.bat').includes('npm install') && read('1-SETUP.command').includes('npm install'));
  for (const f of ['1-SETUP.bat', '1-SETUP.command', '2-STARTA-GROSSISTAGENT.bat', '2-STARTA-GROSSISTAGENT.command', '3-RADERA-NYCKEL.bat', '3-RADERA-NYCKEL.command']) assert.ok(!/sk-ant|ANTHROPIC/.test(read(f)), 'ingen nyckel eller miljövariabel i ' + f);
});
