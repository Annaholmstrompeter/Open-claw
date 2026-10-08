# Överlämning: Buketträknaren och MVP 1B (grossistagenten)

Senast uppdaterad 2026-10-08. Läs den här filen först i en ny chatt. Den är skriven för att en ny session ska kunna fortsätta utan att Anna behöver förklara något.

## Var allt ligger

| Sak | Värde |
|---|---|
| Repo | `annaholmstrompeter/Open-claw` |
| Arbetsgren | `ccr-3096e278-m1e6y7` (senaste commit `88ec1bc`) |
| PR | **#10, draft**, bas = PR #9:s gren `ccr-0086605f-hdj2is` (head `2104f19`, **orörd**) |
| master | `72b0482`, **orörd** |
| Mapp | `projects/buketraknare/` (appen), `projects/buketraknare/poc/grossistagent/` (MVP 1B) |
| Planer och beslut | `docs/MASTER-PLAN.md` (v2.5, avsnitt 7.7 och 7.7.1), `docs/BESLUT.md` (två poster 2026-10-08) |
| PoC-instruktioner | `poc/grossistagent/README.md` (på svenska, skriven för Anna) |

## Annas stående regler (gäller tills hon säger annat)

- PR #9 rörs inte. PR #10 förblir **draft** och mergas aldrig utan hennes uttryckliga godkännande. **master rörs inte.** (Repots `CLAUDE.md` föreslår annars att anteckningar pushas till master. Annas uttryckliga regel går före: lägg allt på grenen.)
- De 405 huvudtesterna ska vara gröna (`cd projects/buketraknare && npm test`). Vanliga Buketträknaren hålls stabil; PoC:n är isolerad.
- **API-nyckeln skickas aldrig till Claude och finns aldrig i repot, kod, loggar, kontrollsidan eller i någon prompt.** Anna lägger den lokalt själv. Be aldrig om den.
- Inga lösenord i chatt, formulär, repo, loggar eller prompts. Floristen skriver bara på grossistens egen inloggningssida i webbläsarfönstret.
- Aldrig kringgå CAPTCHA eller MFA. Inga köp, inga kontoändringar, ingen aggressiv genomsökning, ingen sparad session. Mejlet till grossisten är **inte skickat** och ska inte skickas utan hennes ok.
- Hittas en **uttrycklig publik regel som förbjuder testet mot grossisten: stoppa och säg det till Anna.**
- Anna är inte utvecklare och pratar svenska. Skriv enkelt och rakt, utan onödig arkitektur. Hon vill ha "REDO / INTE REDO"-besked. Hon vill inte ha mer arkitektur innan den riktiga AI-demon fungerar.
- Rapportera ärligt vad som inte är provat. Säg aldrig att något fungerar som inte har körts.

## Läget just nu

**MVP 1A** (exakt prismotor, arbetsyta, brygga till gamla appen, offert/kundorder, minimal Jobb-flik): klar, godkänd av Anna och pausad. 405 tester gröna. Offertknappar och favoriter är medvetet inte prioriterade än.

**MVP 1B** (grossistagenten, `poc/grossistagent/`): byggd och pushad.
- Riktig Anthropic-SDK (`claude-sonnet-5-5`) styr en agent i en riktig Chrome (Playwright). Skrivskydd som teknik på hela webbläsarkontexten. Kod läser ut, tolkar och räknar (`purchase.js`); AI:n räknar aldrig priser eller förpackningar.
- Dubbelklicksstart: `1-SETUP`, `2-STARTA-GROSSISTAGENT`, `3-RADERA-NYCKEL` (`.bat` och `.command`). Startskärmen väljer DEMO (påhittad butik, `testkund` / `hemligt-123`) eller RIKTIG GROSSIST.
- Hårda kostnadsgränser per läge (tabell i README), 20 artiklar per uppdrag i riktigt läge, en samtyckesruta med Annas exakta text (`CONSENT_TEXT` i `src/session.mjs`).
- Tester: 76 i PoC:n (`cd projects/buketraknare/poc/grossistagent && npm test`; kräver Chromium via `CHROME_PATH` eller vanliga sökvägar, och `python3` för terminaltesterna). Mutationstest av den nya koden: 53 av 53 fångade.

**Bedömning till Anna:** DEMO MED RIKTIG AI = REDO. RIKTIG GROSSIST = INTE REDO.

## Det som inte är bevisat (säg det alltid)

1. **Ingen riktig AI-modell har körts** av Claude (ingen nyckel). Testerna använder den riktiga SDK:n mot en lokal testserver (`test/support/fake-anthropic.mjs`) vars svar är ett manus. Första riktiga körningen kan avslöja något. Startkontrollen ("AI ansluten ✓") gör ett riktigt anrop med samma verktyg och parametrar för att visa det i klartext. En avvisad `effort`-parameter hanteras automatiskt.
2. **Inget är provat mot grossistens riktiga butik.** Nätverket i molnsessionen blockerar den och det finns inget konto. Adressen `https://shop.blomstergrossisten.net/` är ett sökresultat och är **inte verifierad**.
3. **Grossistens villkor är inte lästa** (kunde inte hämtas). Ingen uttrycklig förbudsregel hittades, men det betyder inte att ingen finns.
4. **Windows och Mac** är aldrig provade (allt kört på Linux). `.bat`- och `.command`-filerna är skrivna med omsorg men ej körda där.
5. Nyckelfilen är en vanlig textfil i användarmappen (inte krypterad). Mildring: litet tak hos Anthropic, egen nyckel, `3-RADERA-NYCKEL`.
6. Kostnadsuppskattningen (10–30 kr per 30 min) är inte mätt. Taken stoppar före nästa anrop men kan överskridas med ett anrop.

## Nästa steg, i ordning

1. **Anna kör DEMO hemma** (README steg 1–4) och rapporterar vad hon ser. Det första verkliga felet kommer troligen därifrån. Be om det svarta fönstrets text (innehåller aldrig nyckeln) och en skärmdump av kontrollsidan.
2. Rätta det som demon avslöjar. Kör sedan PoC-testerna och de 405 huvudtesterna igen innan varje push, och uppdatera PR #10:s text.
3. **Först när demon fungerat:** första riktiga grossisttestet (README steg 5). Floristen loggar in själv, agenten är pausad, Anna startar första uppgiften, högst 20 artiklar, bara läsning, sessionen raderas efteråt. Verifiera adressen i floristens webbläsare först.
4. Efter det: stickprov mot vad floristen ser i butiken, och vilka fält agenten valt. Sedan avgörs om B (sparad inloggning, synk, kommersiell användning) ska utredas. B kräver ett eget villkors- och tillståndssteg och är **inte** byggt.
5. Därefter kan MVP 1A-arbetet återupptas (offertknappar, favoriter, säkerhetskopia av jobben) när Anna prioriterar det.

## Praktiska fällor (lärdomar från bygget)

- Använd inte `pkill -f` med ett mönster som finns i det egna kommandot (dödar skalet).
- JSDOM-tester som sätter intervall måste stängas i `finally`, annars hänger testkörningen.
- `spawnSync` blockerar testprocessens egen server. Använd asynkron `spawn` när ett testat program ska prata med en server i testet.
- SDK:n läser `ANTHROPIC_BASE_URL`, `ANTHROPIC_AUTH_TOKEN`, `ANTHROPIC_CUSTOM_HEADERS`, `ANTHROPIC_LOG` och profiler ur miljön. `src/ai.mjs` låser adress, nyckel och loggning explicit. Ändra inte det utan att köra `test/ai.test.mjs`.
- Mutationsverktyget ligger inte i repot (det låg i sessionens scratchpad). Mutationstesta nya säkerhetskritiska rader på nytt vid större ändringar.

## Så börjar du en ny chatt

Klistra in något i den här stilen:

> Läs `projects/buketraknare/docs/OVERLAMNING.md` på grenen `ccr-3096e278-m1e6y7` i `annaholmstrompeter/Open-claw` och fortsätt därifrån. Följ de stående reglerna där. Jag har kört DEMO och det här hände: …
