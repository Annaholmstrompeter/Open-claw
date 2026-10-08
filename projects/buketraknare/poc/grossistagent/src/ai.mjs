// Kopplingen till den riktiga AI-modellen (Anthropics API) via den officiella SDK:n.
// Nyckeln skickas bara i rubriken x-api-key till Anthropic. Adressen är låst här: den läses INTE från miljön (SDK:n skulle annars läsa
// ANTHROPIC_BASE_URL), och inget annat än Anthropic (eller en lokal testserver) accepteras. Loggning i SDK:n är avstängd.
import Anthropic from '@anthropic-ai/sdk';
import { loadKey, redact } from './secrets.mjs';
import { TOOL_DEFS } from './tools.mjs';
import { SYSTEM_PROMPT } from './agent.mjs';

export const API_BASE = 'https://api.anthropic.com';
const LOCAL_RE = /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?\/?$/;

/** Ett fel som alltid är säkert att visa: på svenska, utan nyckel, med en typ som koden kan agera på. */
export class AiError extends Error {
  constructor(kind, message, status) { super(message); this.name = 'AiError'; this.kind = kind; this.status = status; }
}

const NOKEY = 'AI ej ansluten: ingen API-nyckel hittades på den här datorn. Dubbelklicka på 1-SETUP och klistra in nyckeln där.';

export function mapError(e, key) {
  if (e instanceof AiError) return e;
  const msg = redact(String(e && e.message || e), key);
  const status = e && e.status;
  if (e instanceof Anthropic.APIUserAbortError || (e && e.name === 'AbortError')) return new AiError('avbruten', 'Avbrutet.');
  if (e instanceof Anthropic.APIConnectionError) return new AiError('natverk', 'Ingen kontakt med Anthropic. Kontrollera internetanslutningen och försök igen.');
  if (e instanceof Anthropic.AuthenticationError) return new AiError('auth', 'API-nyckeln godkändes inte (401). Kontrollera att hela nyckeln är inklistrad och inte är raderad i Anthropics konsol. Kör 1-SETUP igen.', 401);
  if (e instanceof Anthropic.PermissionDeniedError) return new AiError('behorighet', 'API-nyckeln saknar behörighet till modellen (403). Kontrollera nyckelns arbetsyta i Anthropics konsol.', 403);
  if (e instanceof Anthropic.NotFoundError) return new AiError('modell', 'Modellen finns inte för den här nyckeln (404). ' + msg.slice(0, 120), 404);
  if (e instanceof Anthropic.RateLimitError) return new AiError('tak', 'För många anrop just nu, eller så är utgiftstaket för nyckelns arbetsyta nått (429). Vänta en stund eller kontrollera gränserna i Anthropics konsol.', 429);
  if (e instanceof Anthropic.BadRequestError && /credit balance|billing|plans? & billing/i.test(msg)) return new AiError('saldo', 'Kontots tillgodohavande hos Anthropic är slut. Fyll på under Plans & Billing i Anthropics konsol.', 400);
  if (e instanceof Anthropic.BadRequestError) return new AiError('forfragan', 'Anthropic avvisade anropet (400): ' + msg.slice(0, 160), 400);
  if (e instanceof Anthropic.InternalServerError || (status >= 500)) return new AiError('tillfalligt', 'Anthropic har tillfälliga problem (' + (status || '5xx') + '). Försök igen om en stund.', status);
  return new AiError('okant', 'Oväntat AI-fel' + (status ? ' (' + status + ')' : '') + ': ' + msg.slice(0, 160), status);
}

const effortRejected = e => e instanceof Anthropic.BadRequestError && /output_config|effort/i.test(String(e.message));
const withoutEffort = body => { const { output_config, ...rest } = body; return rest; };

/**
 * En klient med samma form som SDK:ns (messages.create). apiKey kommer utifrån (aldrig från en fil i repot) och baseURL bara från kod.
 * Avvisar modellen parametern effort provas anropet en gång utan den och sedan hela sessionen utan (så att en nyare eller äldre modell inte stoppar demon).
 */
export function createAiClient({ apiKey, baseURL = API_BASE, timeoutMs = 90000, maxRetries = 2 } = {}) {
  if (!apiKey) throw new AiError('nokey', NOKEY);
  if (baseURL !== API_BASE && !LOCAL_RE.test(baseURL)) throw new AiError('adress', 'Nyckeln får bara skickas till Anthropic (' + API_BASE + ').');
  const sdk = new Anthropic({ apiKey, authToken: null, baseURL, timeout: timeoutMs, maxRetries, logLevel: 'off', logger: { error() {}, warn() {}, info() {}, debug() {} } });
  let useEffort = true;
  return {
    baseURL,
    messages: {
      async create(body, opts) {
        try { return await sdk.messages.create(useEffort ? body : withoutEffort(body), opts); }
        catch (e) {
          if (useEffort && effortRejected(e)) {
            useEffort = false;
            try { return await sdk.messages.create(withoutEffort(body), opts); } catch (e2) { throw mapError(e2, apiKey); }
          }
          throw mapError(e, apiKey);
        }
      }
    }
  };
}

/** Provar att nyckeln fungerar med samma modell, verktyg och parametrar som uppdragen använder (kostar ungefär 0,04 kr). Ger { ok, kind, message }. */
export async function checkAi({ client, model = 'claude-sonnet-5-5' }) {
  try {
    const res = await client.messages.create({ model, max_tokens: 16, system: SYSTEM_PROMPT, tools: TOOL_DEFS, messages: [{ role: 'user', content: 'Svara bara med ordet OK.' }], output_config: { effort: 'low' } });
    if (!res || !Array.isArray(res.content)) return { ok: false, kind: 'okant', message: 'AI:n svarade i ett oväntat format.' };
    return { ok: true, kind: 'ok', message: 'AI ansluten ✓' };
  } catch (e) { const m = e instanceof AiError ? e : mapError(e); return { ok: false, kind: m.kind, message: 'AI ej ansluten: ' + m.message }; }
}

/** Håller koll på AI-anslutningen för kontrollsidan: läser nyckeln färskt vid varje kontroll, och visar aldrig nyckeln. */
export function createAiService({ env = process.env, model = 'claude-sonnet-5-5', baseURL = API_BASE } = {}) {
  let status = { ok: false, kind: 'ej_kontrollerad', message: 'AI-anslutningen är inte kontrollerad än.', source: null, model };
  return {
    model,
    status: () => ({ ...status }),
    async check() {
      const { key, source } = loadKey(env);
      if (!key) { status = { ok: false, kind: 'nokey', message: NOKEY, source: null, model }; return { ...status }; }
      const r = await checkAi({ client: createAiClient({ apiKey: key, baseURL }), model });
      status = { ok: r.ok, kind: r.kind, message: r.message, source, model };
      return { ...status };
    },
    /** En ny klient för ett uppdrag. Nyckeln läses färskt och lämnar aldrig det här anropet annat än i klienten. */
    makeClient() {
      const { key } = loadKey(env);
      if (!key) throw new AiError('nokey', NOKEY);
      return createAiClient({ apiKey: key, baseURL });
    }
  };
}
