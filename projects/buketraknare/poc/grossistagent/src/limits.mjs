// Kostnadsskydd och försiktighetsgränser. Hårda tak: när en gräns nås stoppas agenten, och kontrollsidan visar vilken gräns det var.
// Två profiler: demo (påhittad butik) och real (riktig grossist: smalare och långsammare).

export const PROFILES = {
  demo: {
    label: 'DEMO',
    maxTurns: 16,                 // modellanrop per uppdrag
    maxToolCalls: 40,             // verktygsanrop per uppdrag
    maxTaskTokens: 150000,        // tokens (in + ut) per uppdrag
    maxSessionTokens: 600000,     // tokens (in + ut) per session
    maxTaskSeconds: 300,
    maxSessionMinutes: 30,
    maxPageLoads: 60,             // sidhämtningar som agenten själv gör, per session
    maxRequests: 2500,            // tillåtna webbläsaranrop i agentfasen, per session
    maxProductsPerTask: 60,       // artiklar som läses ut per uppdrag
    minGapMs: 500
  },
  real: {
    label: 'RIKTIG GROSSIST',
    maxTurns: 14,
    maxToolCalls: 30,
    maxTaskTokens: 120000,
    maxSessionTokens: 450000,
    maxTaskSeconds: 240,
    maxSessionMinutes: 30,
    maxPageLoads: 30,
    maxRequests: 1500,
    maxProductsPerTask: 20,       // första testet: högst 20 artiklar
    minGapMs: 2000
  }
};

export function profileFor(mode, over = {}) {
  const p = PROFILES[mode];
  if (!p) throw new Error('Okänt läge: ' + mode);
  return { ...p, ...over };
}

/** Övre tak för AI-kostnaden i en session enligt profilen och modellens pris (uppskattning, USD). Antar 85 % indata och 15 % utdata. Kan överskridas med ett enda modellanrop (se check). */
export function worstCaseUsd(profile, pricePerMTokIn = 2, pricePerMTokOut = 10) {
  return Math.round(((profile.maxSessionTokens * 0.85 * pricePerMTokIn + profile.maxSessionTokens * 0.15 * pricePerMTokOut) / 1e6) * 100) / 100;
}

/**
 * Räknar upp det som förbrukas och säger om en gräns är nådd. check() ger null eller { kind, message }.
 * Tid kontrolleras mot now() (millisekunder). Gränserna gäller för agenten, inte för människans inloggning.
 */
export function createBudget(limits, { now = () => Date.now(), external = null } = {}) {
  const L = { ...PROFILES.demo, ...limits };
  const s = { tokens: 0, startedAt: null, lastCallTokens: 0 };
  const t = { tokens: 0, turns: 0, toolCalls: 0, products: 0, startedAt: null };
  let tripped = null;
  const trip = (kind, message) => { if (!tripped) tripped = { kind, message }; return tripped; };
  return {
    limits: L,
    startSession() { if (s.startedAt === null) s.startedAt = now(); },
    beginTask() { t.tokens = 0; t.turns = 0; t.toolCalls = 0; t.products = 0; t.startedAt = now(); this.startSession(); tripped = null; return this.check(); },
    addUsage(u) { const n = (u.input_tokens || 0) + (u.output_tokens || 0) + (u.cache_read_input_tokens || 0) + (u.cache_creation_input_tokens || 0); s.tokens += n; t.tokens += n; s.lastCallTokens = n; t.turns++; },
    /** Räknar ett verktygsanrop. Ger null, eller gränsen som nåtts (då ska verktyget inte köras). */
    addToolCall() { t.toolCalls++; return t.toolCalls > L.maxToolCalls ? trip('verktyg', 'Gränsen för antal verktygsanrop (' + L.maxToolCalls + ' per uppdrag) är nådd.') : null; },
    /** Hur många artiklar som får läsas ut till innan taket per uppdrag är nått. */
    productRoom() { return Math.max(0, L.maxProductsPerTask - t.products); },
    addProducts(n) { t.products += n; },
    /** Före ett nytt modellanrop (predictive = true): räkna med att nästa anrop blir ungefär lika stort som det förra. */
    check({ predictive = false } = {}) {
      if (tripped) return tripped;
      const ex = external && external();                                    // till exempel skyddets tak för webbläsaranrop
      if (ex) return trip(ex.kind, ex.message);
      const nextCall = predictive ? Math.max(s.lastCallTokens, 3000) : 0;
      if (t.startedAt !== null && now() - t.startedAt > L.maxTaskSeconds * 1000) return trip('tid', 'Tidsgränsen för uppdraget (' + L.maxTaskSeconds + ' s) är nådd.');
      if (s.startedAt !== null && now() - s.startedAt > L.maxSessionMinutes * 60000) return trip('sessionstid', 'Tidsgränsen för sessionen (' + L.maxSessionMinutes + ' min) är nådd.');
      if (t.turns >= L.maxTurns && predictive) return trip('steg', 'Gränsen för antal steg (' + L.maxTurns + ' modellanrop per uppdrag) är nådd.');
      if (t.tokens + nextCall > L.maxTaskTokens) return trip('tokens', 'Gränsen för tokens per uppdrag (' + L.maxTaskTokens.toLocaleString('sv-SE') + ') är nådd.');
      if (s.tokens + nextCall > L.maxSessionTokens) return trip('sessionstokens', 'Gränsen för tokens per session (' + L.maxSessionTokens.toLocaleString('sv-SE') + ') är nådd.');
      return null;
    },
    /** Sätts utifrån, till exempel när skyddet har släppt igenom så många webbläsaranrop som tillåtet. */
    tripExternal(kind, message) { return trip(kind, message); },
    tripped: () => tripped,
    snapshot: () => ({ session: { tokens: s.tokens, minutes: s.startedAt === null ? 0 : Math.round((now() - s.startedAt) / 600) / 100 }, task: { ...t }, limits: L, tripped })
  };
}
