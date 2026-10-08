// API-nyckeln. Den finns bara här på datorn: i miljön (ANTHROPIC_API_KEY) eller i en fil i användarens egen mapp, aldrig i repot.
// Nyckeln visas aldrig på kontrollsidan, skrivs aldrig i loggar eller rapporter, skickas aldrig till grossisten och ges inte till webbläsaren.
// Den enda platsen den lämnar datorn är Anthropics API (se ai.mjs, som låser adressen).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const KEY_RE = /^sk-ant-[A-Za-z0-9_-]{20,}$/;
const ANY_KEY_RE = /sk-ant-[A-Za-z0-9_-]{8,}/g;          // för ersättning (global)
const HAS_KEY_RE = /sk-ant-[A-Za-z0-9_-]{8,}/;            // för test (utan tillstånd)

export const looksLikeKey = s => typeof s === 'string' && KEY_RE.test(s.trim());

/** Mappen där nyckeln sparas: <hemmapp>/.grossistagent. GROSSISTAGENT_HOME kan peka någon annanstans (används av testerna). */
export function keyPaths(env = process.env) {
  const dir = path.resolve(env.GROSSISTAGENT_HOME || path.join(os.homedir(), '.grossistagent'));
  return { dir, file: path.join(dir, 'anthropic-key.txt') };
}

/** Repots rot (närmaste .git ovanför den här filen), eller null. Nyckeln får aldrig sparas under den. */
function repoRoot() {
  let d = path.dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 12; i++) { if (fs.existsSync(path.join(d, '.git'))) return d; const up = path.dirname(d); if (up === d) break; d = up; }
  return null;
}
const isInside = (child, parent) => { const r = path.relative(parent, child); return r === '' || (!r.startsWith('..') && !path.isAbsolute(r)); };

/** Ger { key, source } eller { key: null, source: null }. Miljön först, sedan filen. Ogiltiga värden räknas som saknade. */
export function loadKey(env = process.env) {
  const fromEnv = (env.ANTHROPIC_API_KEY || '').trim();
  if (looksLikeKey(fromEnv)) return { key: fromEnv, source: 'miljövariabeln ANTHROPIC_API_KEY' };
  const { file } = keyPaths(env);
  try { const t = fs.readFileSync(file, 'utf8').trim(); if (looksLikeKey(t)) return { key: t, source: 'den sparade filen i din användarmapp' }; } catch (e) { /* ingen fil */ }
  return { key: null, source: null };
}

export function saveKey(key, env = process.env) {
  const k = String(key || '').trim();
  if (!looksLikeKey(k)) throw new Error('Det där ser inte ut som en Anthropic-nyckel. Den börjar med sk-ant- och är lång. Kopiera hela nyckeln.');
  const { dir, file } = keyPaths(env);
  const root = repoRoot();
  if (root && isInside(dir, root)) throw new Error('Nyckeln får inte sparas inne i repot. Välj en mapp utanför det.');
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  try { fs.chmodSync(dir, 0o700); } catch (e) { /* Windows: mappen skyddas av användarkontot */ }
  fs.writeFileSync(file, k + '\n', { mode: 0o600 });
  try { fs.chmodSync(file, 0o600); } catch (e) { /* Windows */ }
  return file;
}

/** Raderar den sparade filen. Nyckeln i miljön berörs inte. Ger true om en fil fanns. */
export function deleteKey(env = process.env) {
  const { dir, file } = keyPaths(env);
  const had = fs.existsSync(file);
  try { fs.rmSync(file, { force: true }); } catch (e) { /* kunde inte raderas: kontrolleras nedan */ }
  try { fs.rmdirSync(dir); } catch (e) { /* mappen har annat innehåll eller finns inte */ }
  return had && !fs.existsSync(file);
}

/** Tar bort allt som liknar en nyckel ur en text (felmeddelanden, loggrader), plus den exakta nyckeln om den anges. */
export function redact(text, key) {
  let t = String(text == null ? '' : text);
  if (key && key.length >= 8) t = t.split(key).join('sk-ant-…[dold]');
  return t.replace(ANY_KEY_RE, 'sk-ant-…[dold]');
}

const SECRET_NAME_RE = /(ANTHROPIC|API[_-]?KEY|TOKEN|SECRET|PASSWORD|PASSWD|CREDENTIAL|AUTH|OPENAI|AWS_|AZURE_|GOOGLE_APPLICATION|GH_|GITHUB_)/i;
/** Miljön som webbläsaren får: allt utom det som ser ut som nycklar eller hemligheter. Chrome behöver dem inte. */
export function envWithoutSecrets(env = process.env) {
  const out = {};
  for (const [k, v] of Object.entries(env)) if (v !== undefined && !SECRET_NAME_RE.test(k) && !HAS_KEY_RE.test(String(v))) out[k] = v;
  return out;
}

/**
 * Läser en rad utan att visa den (nyckeln syns inte på skärmen). I en riktig terminal slås ekot av; annars läses en rad.
 * Ctrl+C avbryter. Ger den inskrivna texten (trimmad).
 */
export function readHidden(promptText, { input = process.stdin, output = process.stdout } = {}) {
  return new Promise((resolve, reject) => {
    output.write(promptText);
    if (!input.isTTY) {
      let buf = '';
      const onData = d => { buf += d; const i = buf.indexOf('\n'); if (i >= 0) { input.off('data', onData); input.pause(); output.write('\n'); resolve(buf.slice(0, i).replace(/\r$/, '').trim()); } };
      input.setEncoding('utf8'); input.on('data', onData); input.resume();
      input.once('end', () => resolve(buf.trim()));
      return;
    }
    let buf = '';
    const onData = chunk => {
      for (const ch of String(chunk)) {
        if (ch === '\r' || ch === '\n') { done(); return resolve(buf.trim()); }
        if (ch === '\u0003') { done(); return reject(new Error('Avbrutet.')); }
        if (ch === '\u007f' || ch === '\b') buf = buf.slice(0, -1);
        else if (ch >= ' ') buf += ch;
      }
    };
    const done = () => { input.off('data', onData); try { input.setRawMode(false); } catch (e) { /* redan av */ } input.pause(); output.write('\n'); };
    input.setEncoding('utf8'); input.setRawMode(true); input.on('data', onData); input.resume();
  });
}
