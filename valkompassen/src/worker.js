import issues from "../public/data/issues.json";
import parties from "../public/data/parties.json";

const JSON_HEADERS = { "content-type": "application/json; charset=utf-8" };
const MAX_MESSAGES = 20;
const MAX_MESSAGE_LEN = 2000;
const DEFAULT_MODEL = "claude-sonnet-5";

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: JSON_HEADERS });
}

function buildGroundingText() {
  const partyLines = parties
    .map((p) => `- ${p.id} (${p.name}): ${p.short_description}`)
    .join("\n");

  const issueLines = issues
    .map((issue) => {
      const positions = Object.entries(issue.positions)
        .map(([partyId, pos]) => {
          const sourceLabel = pos.source && pos.source.label ? pos.source.label : "okänd källa";
          return `  * ${partyId} (poäng ${pos.score} på skalan ${issue.axis_label_low} [-2] till ${issue.axis_label_high} [+2]): ${pos.stance} (Källa: ${sourceLabel})`;
        })
        .join("\n");
      return `### ${issue.title}\nFaktabrief: ${issue.factbrief}\nPartipositioner:\n${positions}`;
    })
    .join("\n\n");

  return `PARTIER:\n${partyLines}\n\nSAKFRÅGOR OCH PARTIPOSITIONER:\n\n${issueLines}`;
}

const GROUNDING_TEXT = buildGroundingText();

const SYSTEM_PROMPT = `Du är Valkompassens faktaassistent. Du hjälper användare att förstå svensk partipolitik EFTER att de gjort valkompassen.

Strikta regler:
1. Du får BARA använda fakta som finns i data nedan (partipositioner, poäng, källor, faktabriefer). Om något inte finns där, säg tydligt att du inte har underlag för det i den här datan, istället för att gissa eller använda annan kunskap.
2. Du ska ALDRIG säga åt användaren vilket parti de "borde" rösta på, eller vilket parti som är "bäst". Det är användarens eget värderingsval - din uppgift är fakta och förklaring, inte rådgivning eller övertalning.
3. Du ska ALDRIG vara till lags genom att böja fakta mot vad du tror att användaren vill höra. Var lika rak och kritiskt granskande oavsett vilket parti eller vilken åsikt frågan handlar om.
4. Ange alltid källa (partiet/dokumentet) när du refererar till en partiposition, t.ex. "(källa: [namn])".
5. Om en fråga är genuint komplex eller kontroversiell, visa flera partiers perspektiv sida vid sida istället för att förenkla bort oenigheten.
6. Var kortfattad - några meningar eller en kort punktlista, inte långa essäer.
7. Skriv på svenska.

DATA DU FÅR ANVÄNDA:
${GROUNDING_TEXT}`;

function sanitizeMessages(rawMessages) {
  if (!Array.isArray(rawMessages)) return null;
  if (rawMessages.length === 0 || rawMessages.length > MAX_MESSAGES) return null;
  const cleaned = [];
  for (const m of rawMessages) {
    if (!m || (m.role !== "user" && m.role !== "assistant")) return null;
    if (typeof m.content !== "string" || m.content.length === 0 || m.content.length > MAX_MESSAGE_LEN) {
      return null;
    }
    cleaned.push({ role: m.role, content: m.content });
  }
  return cleaned;
}

async function handleChat(request, env) {
  if (!env.ANTHROPIC_API_KEY) {
    return jsonResponse(
      { error: "Chatten är inte påkopplad än (saknar API-nyckel på servern)." },
      503
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Ogiltig förfrågan." }, 400);
  }

  const messages = sanitizeMessages(body.messages);
  if (!messages) {
    return jsonResponse({ error: "Ogiltiga meddelanden." }, 400);
  }

  const model = env.CHAT_MODEL || DEFAULT_MODEL;

  const upstream = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 600,
      system: SYSTEM_PROMPT,
      messages,
    }),
  });

  if (!upstream.ok) {
    const errText = await upstream.text();
    return jsonResponse({ error: "Kunde inte nå AI-tjänsten just nu.", detail: errText }, 502);
  }

  const data = await upstream.json();
  const text = (data.content || [])
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("\n");

  return jsonResponse({ reply: text });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "POST" && url.pathname === "/api/chat") {
      return handleChat(request, env);
    }

    return env.ASSETS.fetch(request);
  },
};
