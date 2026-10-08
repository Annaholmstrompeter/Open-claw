// Kostnadsskydd och försiktighetsgränser. Hårda tak: när en gräns nås stoppas agenten, och kontrollsidan visar vilken gräns det var.
// Två profiler: demo (påhittad butik) och real (riktig grossist: smalare och långsammare).

export const PROFILES = {
  // Första experimentet: små, konservativa tak. En typisk uppgift (6-9 modellanrop) använder ungefär 15 000-40 000 tokens, eftersom hela historiken skickas om vid varje steg.
  // Taken är därför ungefär 1,5 gånger det, inte 5 gånger. Stoppar något felaktigt står det exakt vilken gräns som nåddes, och Anna kan välja att höja den efter att ha sett riktiga siffror.
  demo: {
    label: 'DEMO',
    maxTurns: 12,                 // modellanrop per uppdrag
    maxToolCalls: 24,             // verktygsanrop per uppdrag
    maxTaskTokens: 60000,         // tokens (in + ut) per uppdrag
    maxSessionTokens: 180000,     // tokens (in + ut) per session (självtestet får ett eget, högre tak: SELFTEST_LIMITS)
    maxCallTokens: 25000,         // en enskild förfrågan (in + ut) får inte vara större än så: skydd mot oväntat stora prompts
    maxOutputTokens: 3000,        // längsta svar per modellanrop (max_tokens)
    maxResultChars: 4000,         // längsta verktygsresultat som skickas till modellen (resten kortas av)
    maxTaskSeconds: 180,
    maxSessionMinutes: 20,
    maxPageLoads: 30,             // sidhämtningar som agenten själv gör, per session
    maxRequests: 800,             // tillåtna webbläsaranrop i agentfasen, per session
    maxProductsPerTask: 30,       // artiklar som läses ut per uppdrag
    minGapMs: 500
  },
  real: {
    label: 'RIKTIG GROSSIST',
    maxTurns: 12,
    maxToolCalls: 24,
    maxTaskTokens: 60000,
    maxSessionTokens: 180000,
    maxCallTokens: 25000,
    maxOutputTokens: 3000,
    maxResultChars: 4000,
    maxTaskSeconds: 240,
    maxSessionMinutes: 30,
    maxPageLoads: 25,
    maxRequests: 1200,
    maxProductsPerTask: 20,       // första testet: högst 20 artiklar
    minGapMs: 2000
  }
};

/**
 * Självtestet kör fem uppgifter i rad i DEMO och mäter hur mycket en riktig modell faktiskt förbrukar. En riktig modell kan ta fler steg än manuset (uppgift 3 söker två gånger),
 * så varje uppdrag får lite mer luft än i vanlig DEMO (80 000 i stället för 60 000, fortfarande långt under tidigare 120 000), och sessionen får rymma fem uppdrag.
 * Taket för hela självtestet är 300 000 tokens (ungefär 1 USD som högst). Förbrukningen per uppdrag visas, så att de vanliga taken kan ställas efter riktiga siffror.
 */
export const SELFTEST_LIMITS = { maxTaskTokens: 80000, maxSessionTokens: 300000, maxSessionMinutes: 25 };

/** Rubriken som visas när en säkerhetsgräns har stoppat agenten. Ingen automatisk fortsättning: nästa uppdrag startas bara av en människa. */
export const STOP_HEADLINE = 'STOPP – testets säkerhetsgräns är nådd.';

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
    addUsage(u) {
      const n = (u.input_tokens || 0) + (u.output_tokens || 0) + (u.cache_read_input_tokens || 0) + (u.cache_creation_input_tokens || 0);
      s.tokens += n; t.tokens += n; s.lastCallTokens = n; t.turns++;
      if (n > L.maxCallTokens) trip('forfragan', 'En enskild förfrågan blev för stor (' + n.toLocaleString('sv-SE') + ' tokens, gränsen är ' + L.maxCallTokens.toLocaleString('sv-SE') + ').');
    },
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
