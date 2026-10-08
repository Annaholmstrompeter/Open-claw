// Minimerar vad som skickas till AI-modellen. Modellen behöver bara det som krävs för att navigera bland produkter efter inloggningen.
// Den ska aldrig få lösenord, cookies, inloggningstoken, personuppgifter från formulär eller konton, eller rubriker med inloggningsuppgifter.
// Det här är en andra försvarslinje ovanpå att verktygen aldrig läser fältvärden, cookies eller rubriker i första hand (se tools.mjs och capture.mjs).
// Sållet är "bäst möjligt" och bygger på mönster: det kan inte garantera att allt personligt som en webbplats skriver ut i klartext tas bort.
// Det rör aldrig artikelnummer, namn, priser eller förpackningar i produktdata.

const DOLT = '[dolt]';

/** Nyckelnamn i JSON som aldrig ska visas för modellen, oavsett värde. Medvetet utan det vanliga ordet "namn" (artikelnamn) och utan "pris". */
export const SENSITIVE_KEY_RE = /(^|[_\-.])(pass(word|wd|ord)?|l[oö]senord|losen|pwd|secret|token|jwt|bearer|cookie|set-?cookie|authorization|auth|session(id)?|sid|csrf|xsrf|api[_-]?key|apikey|credential|e-?mail|e-?post|mail|phone|telefon|tel|mobil|mobile|fax|address|adress|street|gatuadress|postnr|postnummer|postal|zip|postort|city|stad|personnummer|pnr|ssn|orgnr|org[_-]?nr|vat[_-]?no|momsnr|iban|bic|bankgiro|plusgiro|kontonummer|account[_-]?(no|number|id)|card|kort(nummer)?|cvv|cvc|firstname|first[_-]?name|lastname|last[_-]?name|fornamn|f[oö]rnamn|efternamn|fullname|full[_-]?name|kundnamn|customer[_-]?name|contact(person)?|kontaktperson|username|user[_-]?name|anvandare|anv[äa]ndare|kundnr|kundnummer|customer[_-]?(no|number|id))($|[_\-.])|(token|secret|password|losenord|lösenord|apikey)/i;

/** Behållare vars innehåll handlar om en person eller ett konto: allt under dem döljs, även ett vanligt "name". */
export const CONTAINER_KEY_RE = /^(user|users|customer|customers|kund|kunder|account|konto|profile|profil|me|contact|contacts|kontakt|billing|shipping|delivery|invoice|faktura|leverans|leveransadress|member|medlem|person|buyer|kopare|köpare|owner|agare|ägare)([_\-.](info|data|details|detail|profile|obj|object|account))?$/i;

/** Gör camelCase till snake_case (phoneNumber → phone_Number) så att nyckelmönstren träffar sammansatta namn. */
const splitCamel = k => String(k).replace(/([a-z0-9åäö])([A-ZÅÄÖ])/g, '$1_$2');
export const isSensitiveKey = key => { const k = splitCamel(key); return SENSITIVE_KEY_RE.test(k) || CONTAINER_KEY_RE.test(k); };

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+/g;
const JWT_RE = /\beyJ[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]{4,}\b/g;
const BEARER_RE = /\b(Bearer|Basic)\s+[A-Za-z0-9._~+\/=-]{12,}/gi;
const LONG_SECRET_RE = /\b(?=[A-Za-z0-9_]*[A-Za-z])(?=[A-Za-z0-9_]*\d)[A-Za-z0-9_]{28,}\b/g;      // lång blandning av bokstäver och siffror, utan bindestreck (så att en artikelsida som ros-avalanche-60-cm inte tas): token, sessions-id, hash
const HEX_RE = /\b[0-9a-f]{32,}\b/gi;
const PNR_RE = /\b(\d{6}|\d{8})[-+]\d{4}\b/g;                                                          // personnummer med bindestreck
const PHONE_RE = /(\+\d{1,3}[\s-]?)?\(?\b0\d{1,3}\)?[\s-]\d{2,3}[\s-]?\d{2,3}[\s-]?\d{2,3}\b|\+\d{1,3}(?:[\s-]?\d{2,4}){2,5}\b/g;     // 08-123 45 67, 070-123 45 67, +46 70 123 45 67
const PERSONAL_LINE_RE = /(?:[Ii]nloggad som|[Ll]ogged in as|[Ss]igned in as|[Hh]ej,?\s+[A-ZÅÄÖ][\p{L}'-]+|[Vv]älkommen,?\s+[A-ZÅÄÖ][\p{L}'-]+|[Ww]elcome,?\s+[A-Z][\p{L}'-]+|[Kk]undnr\.?|[Kk]undnummer|[Cc]ustomer (?:no|number|id)|[Oo]rg\.?\s?nr|[Oo]rganisationsnummer|[Ll]everansadress|[Ff]akturaadress|[Dd]elivery address|[Bb]illing address)[^\n.|]{0,80}/gu;

/** Tar bort sådant som liknar e-post, inloggningstoken, nycklar, telefon, personnummer och "inloggad som …" ur en text. */
export function scrubText(text) {
  let t = String(text == null ? '' : text);
  t = t.replace(JWT_RE, DOLT).replace(BEARER_RE, '$1 ' + DOLT).replace(EMAIL_RE, DOLT).replace(PNR_RE, DOLT).replace(PERSONAL_LINE_RE, DOLT);
  t = t.replace(HEX_RE, DOLT).replace(LONG_SECRET_RE, DOLT).replace(PHONE_RE, DOLT);
  return t;
}

/** Bara token-liknande delar (JWT, Bearer, långa blandade nycklar, hex). Används på adresser och id:n där telefon- och personmönster skulle riskera att förstöra ett artikelnummer. */
export function scrubTokens(text) {
  return String(text == null ? '' : text).replace(JWT_RE, DOLT).replace(BEARER_RE, '$1 ' + DOLT).replace(HEX_RE, DOLT).replace(LONG_SECRET_RE, DOLT);
}

/** Nycklar vars textvärden är artikelnummer eller liknande och därför bara sållas för tokens, aldrig för telefon eller personmönster. */
export const ID_KEY_RE = /^(id|ids|artikelnr|artnr|art_?nr|artikelnummer|sku|ean|gtin|nr|number|code|kod|response_id|ref|href|url|path|host|endpoint|selector)$/i;

/** En adress utan frågetecken och fragment: bara ursprung och sökväg, plus namnen på parametrarna (aldrig värdena, som kan vara sessions-id eller token). */
export function scrubUrl(url) {
  try {
    const u = new URL(url);
    const names = [...new Set([...u.searchParams.keys()])].slice(0, 8);
    const base = u.origin + (u.pathname.length > 160 ? u.pathname.slice(0, 160) + '…' : u.pathname);
    return scrubText(base) + (names.length ? '?' + names.map(n => n + '=…').join('&') : '');
  } catch (e) { return scrubText(String(url).replace(/[?#].*$/, '')); }
}

/**
 * Går igenom ett värde (som ska visas för modellen) och ersätter känsliga nycklar och värden. Strängar sållas med scrubText.
 * Siffror, booleaner och null rörs aldrig, så priser och förpackningar bevaras exakt. Artikelnummer som strängar rörs bara om de liknar en lång token.
 */
export function scrubValue(v, key = '', depth = 0) {
  if (typeof v === 'string' && key && ID_KEY_RE.test(key)) return scrubTokens(v);
  if (v === null || v === undefined) return v;
  if (key && isSensitiveKey(key)) return DOLT;
  if (typeof v === 'string') return scrubText(v);
  if (typeof v !== 'object') return v;
  if (depth > 12) return '…';
  if (Array.isArray(v)) return v.map(x => scrubValue(x, '', depth + 1));
  const out = {};
  for (const [k, x] of Object.entries(v)) out[scrubText(k) === k ? k : DOLT] = scrubValue(x, k, depth + 1);
  return out;
}
