// Kontrollerna som 1-SETUP kör: operativsystem, Node, programmappen, biblioteken, skrivrättigheter, lokal port, Chrome (hittas och startar) och att inget lämnas kvar.
// Varje kontroll provas både när allt är bra och när något saknas, med en förklaring på enkel svenska och vad Anna ska göra.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { checkOs, checkNode, checkProjectFolder, checkDependencies, checkWritable, checkLocalPort, checkChromeFound, checkChromeStarts, runBasicChecks, projectDir } from '../src/checks.mjs';
import { CHROME } from './support/browser.mjs';

const tmp = p => fs.mkdtempSync(path.join(os.tmpdir(), p));

test('operativsystem och Node: Windows, Mac och Linux godkänns; okända system och Node äldre än 20 stoppar med en hänvisning', () => {
  for (const [platform, name] of [['win32', 'Windows'], ['darwin', 'Mac'], ['linux', 'Linux']]) { const r = checkOs({ platform, release: '10.0.1', arch: 'x64' }); assert.equal(r.ok, true); assert.match(r.label, new RegExp('^' + name + ' 10\\.0\\.1 \\(x64\\)')); }
  const bad = checkOs({ platform: 'freebsd' }); assert.deepEqual([bad.ok, bad.blocking], [false, true]); assert.match(bad.hint, /Windows och Mac/);
  assert.equal(checkNode({ version: '22.1.0' }).ok, true); assert.equal(checkNode({ version: '20.0.0' }).ok, true);
  for (const v of ['18.19.0', '16.20.2', '19.9.0']) { const r = checkNode({ version: v }); assert.deepEqual([r.ok, r.blocking], [false, true]); assert.match(r.hint, /nodejs\.org.*LTS/); assert.match(r.label, new RegExp(v.replace(/\./g, '\\.'))); }
});

test('programmappen: komplett här; saknas beräkningskoden två mappar upp (mappen flyttad ur ZIP-filen) får Anna veta att hela ZIP-filen ska packas upp', () => {
  assert.equal(checkProjectFolder().ok, true);
  const r = checkProjectFolder({ exists: f => !/purchase\.js$/.test(f) });
  assert.deepEqual([r.ok, r.blocking], [false, true]); assert.match(r.label, /saknar \.\.\/\.\.\/public\/js\/core\/purchase\.js/); assert.match(r.hint, /Packa upp hela ZIP-filen/);
  assert.equal(checkProjectFolder({ exists: () => false }).ok, false);
});

test('biblioteken: finns här; saknas de listas båda i klartext och Anna ombeds köra 1-SETUP igen (som installerar dem själv)', () => {
  assert.equal(checkDependencies().ok, true);
  const empty = tmp('ga-nodeps-'); fs.writeFileSync(path.join(empty, 'package.json'), '{}');
  try {
    const r = checkDependencies({ dir: empty });
    assert.deepEqual([r.ok, r.blocking], [false, true]); assert.match(r.label, /AI-biblioteket \(@anthropic-ai\/sdk\), webbläsarstyrningen \(playwright-core\)/); assert.match(r.hint, /1-SETUP igen.*installerar det som saknas automatiskt/);
  } finally { fs.rmSync(empty, { recursive: true, force: true }); }
});

test('skrivrättigheter: skriver, läser och raderar en provfil; skapar och tar bort en mapp som saknas; ett fel ger en begriplig förklaring', () => {
  const base = tmp('ga-write-'); const sub = path.join(base, 'ny', 'mapp');
  try {
    assert.equal(checkWritable(base, 'provmappen').ok, true);
    const r = checkWritable(sub, 'en ny mapp'); assert.equal(r.ok, true); assert.ok(!fs.existsSync(sub), 'den skapade mappen togs bort igen'); assert.deepEqual(fs.readdirSync(base).filter(f => f.includes('skrivtest')), [], 'ingen provfil kvar');
    const denied = checkWritable(base, 'skrivskyddad mapp', { fsx: { ...fs, writeFileSync() { const e = new Error('nekad'); e.code = 'EACCES'; throw e; } } });
    assert.deepEqual([denied.ok, denied.blocking], [false, true]); assert.match(denied.label, /Får inte skriva i skrivskyddad mapp/); assert.match(denied.hint, /skrivskyddad.*disken.*antivirus.*EACCES/s);
    const mismatch = checkWritable(base, 'trasig disk', { fsx: { ...fs, readFileSync: () => 'fel' } }); assert.equal(mismatch.ok, false);
  } finally { fs.rmSync(base, { recursive: true, force: true }); }
});

test('lokal port: ledig här; om en brandvägg eller ett säkerhetsprogram stoppar det får Anna veta det', async () => {
  const ok = await checkLocalPort(); assert.equal(ok.ok, true); assert.match(ok.label, /Lokal port ledig/);
  const bad = await checkLocalPort({ listen: cb => cb(Object.assign(new Error('x'), { code: 'EACCES' })) });
  assert.deepEqual([bad.ok, bad.blocking], [false, true]); assert.match(bad.label, /EACCES/); assert.match(bad.hint, /brandvägg|säkerhetsprogram/);
});

test('Chrome: hittas via CHROME_PATH eller vanliga platser, saknas det förklaras hur man installerar det, och en riktig start/stängning lämnar inga rester', async () => {
  const found = checkChromeFound({ env: { CHROME_PATH: CHROME } }); assert.equal(found.ok, true); assert.equal(found.exe, CHROME);
  const missing = checkChromeFound({ env: { CHROME_PATH: '/finns/inte/chrome' } });
  assert.deepEqual([missing.ok, missing.blocking], [false, true]); assert.match(missing.hint, /https:\/\/www\.google\.com\/chrome\//); assert.match(missing.hint, /CHROME_PATH/);
  const before = fs.readdirSync(os.tmpdir()).filter(n => n.startsWith('grossistagent-')).length;
  const started = await checkChromeStarts({ exe: CHROME }); assert.equal(started.ok, true, started.label + ' ' + started.hint); assert.match(started.label, /Chrome startar och stängs utan rester \(version \d+/);
  assert.equal(fs.readdirSync(os.tmpdir()).filter(n => n.startsWith('grossistagent-')).length, before, 'den tillfälliga mappen raderades');
  const parent = tmp('grossistagent-fake-');
  const failed = await checkChromeStarts({ exe: CHROME, launch: async () => { throw new Error('Kunde inte starta Chrome: spawn EACCES\nmer text'); } });
  assert.deepEqual([failed.ok, failed.blocking], [false, true]); assert.match(failed.hint, /Stäng alla Chrome-fönster/); assert.match(failed.hint, /Kunde inte starta Chrome: spawn EACCES/); assert.ok(!/mer text/.test(failed.hint));
  const leftover = await checkChromeStarts({ exe: CHROME, launch: async () => ({ tmpParent: parent, page: { goto: async () => {} }, browser: { version: () => '1', close: async () => {} } }) });
  assert.equal(leftover.ok, true, 'rester raderas av kontrollen själv'); assert.ok(!fs.existsSync(parent));
  const keptDir = tmp('grossistagent-kept-');
  const notRemoved = await checkChromeStarts({ exe: CHROME, rm: () => {}, launch: async () => ({ tmpParent: keptDir, page: { goto: async () => {} }, browser: { version: () => '1', close: async () => {} } }) });
  assert.deepEqual([notRemoved.ok, notRemoved.blocking], [false, true]); assert.match(notRemoved.label, /den tillfälliga mappen gick inte att radera/); fs.rmSync(keptDir, { recursive: true, force: true });
  const stuck = await checkChromeStarts({ exe: CHROME, launch: async () => ({ tmpParent: parent, page: { goto: async () => {} }, browser: { version: () => '1', close: async () => { fs.mkdirSync(parent, { recursive: true }); } } }) });
  assert.equal(stuck.ok, true);
});

test('hela grundkontrollen här: allt grönt, skriver ✓-rader, och lämnar inga mappar, filer eller portar efter sig', async () => {
  const lines = []; const env = { ...process.env, CHROME_PATH: CHROME, GROSSISTAGENT_HOME: path.join(tmp('ga-chk-home-'), '.grossistagent') };
  const outDir = path.join(process.cwd(), 'out'); const outExisted = fs.existsSync(outDir);
  const before = fs.readdirSync(os.tmpdir()).filter(n => n.startsWith('grossistagent-')).length;
  const results = await runBasicChecks({ say: l => lines.push(l), env });
  assert.deepEqual(results.filter(r => !r.ok).map(r => r.label), []);
  assert.deepEqual(results.map(r => r.id), ['os', 'node', 'mapp', 'beroenden', 'skriv:den tillfälliga mappen', 'skriv:din användarmapp (där nyckeln sparas)', 'skriv:mappen för rapporter', 'port', 'chrome', 'chromestart']);
  assert.ok(lines.every(l => l.startsWith('✓ ')), lines.join('\n'));
  assert.equal(fs.readdirSync(os.tmpdir()).filter(n => n.startsWith('grossistagent-')).length, before);
  assert.equal(fs.existsSync(outDir), outExisted, 'mappen out skapades inte i onödan');
  assert.ok(projectDir.endsWith(path.join('poc', 'grossistagent')));
});

test('grundkontrollen stannar vid ett blockerande fel i grunderna (för gammal Node): resten går inte att prova, och Anna får veta vad som ska göras', async () => {
  const lines = [];
  const results = await runBasicChecks({ say: l => lines.push(l), env: { ...process.env, CHROME_PATH: CHROME }, nodeVersion: '18.19.0' });
  assert.deepEqual(results.map(r => r.id), ['os', 'node']); assert.equal(results[1].ok, false);
  assert.ok(lines.some(l => l.startsWith('✗ Node.js 18.19.0 är för gammal')) && lines.some(l => /nodejs\.org.*LTS/.test(l)), lines.join('\n'));
});
