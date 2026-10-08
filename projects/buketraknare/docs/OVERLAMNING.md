# Överlämning: Buketträknaren och MVP 1B (grossistagenten)

Senast uppdaterad 2026-10-08 (efter tredje beslutet: självtest, lägre tak, minimerad data till modellen). Läs den här filen först i en ny chatt. Den är skriven för att en ny session ska kunna fortsätta utan att Anna behöver förklara något.

## Var allt ligger

| Sak | Värde |
|---|---|
| Repo | `annaholmstrompeter/Open-claw` |
| Arbetsgren | `ccr-3096e278-m1e6y7` (grenens spets är det som PR #10 visar) |
| PR | **#10, draft**, bas = PR #9:s gren `ccr-0086605f-hdj2is` (head `2104f19`, **orörd**) |
| master | `72b0482`, **orörd** |
| Mapp | `projects/buketraknare/` (appen), `projects/buketraknare/poc/grossistagent/` (MVP 1B) |
| Planer och beslut | `docs/MASTER-PLAN.md` (v2.6, avsnitt 7.7, 7.7.1 och 7.7.2), `docs/BESLUT.md` (tre poster 2026-10-08) |
| PoC-instruktioner | `poc/grossistagent/README.md` (på svenska, skriven för Anna) |

## Designomarbetningen (egen gren, ovanpå PR #10)

Anna bad 2026-10-08 om en ny design av Buketträknarens gränssnitt ("floriststudio"). Det ligger på grenen `ccr-b409dede-q2ilay` som en **egen draft-PR med PR #10:s gren som bas**. PR #9, PR #10 och master är orörda. Det **pausade** UI-arbetet (offertknappar, favoriter) gäller fortfarande: designuppdraget gällde utseende, flöde och tillgänglighet, inte nya affärsfunktioner. Allt står i `docs/DESIGN-OMARBETNING.md` (inventering, plan, mätningar, vad som testats visuellt och vad som bara är kodtestat) och i `docs/BESLUT.md` (fjärde beslutet 2026-10-08). Räknemotorer, bryggan, lagringen och grossistagenten är oförändrade. Alla befintliga tester är kvar (en rad copy i `jobs-ui.test.mjs` ändrades: fliken Bukett heter nu Snabbkalkyl), och nya tester finns i `studio-ui.test.mjs` och `design-contrast.test.mjs`.

## Annas stående regler (gäller tills hon säger annat)

- PR #9 rörs inte. PR #10 förblir **draft** och mergas aldrig utan hennes uttryckliga godkännande. **master rörs inte.** (Repots `CLAUDE.md` föreslår annars att anteckningar pushas till master. Annas uttryckliga regel går före: lägg allt på grenen.)
- De 405 huvudtesterna ska vara gröna (`cd projects/buketraknare && npm test`). Vanliga Buketträknaren hålls stabil; PoC:n är isolerad.
- **API-nyckeln skickas aldrig till Claude och finns aldrig i repot, kod, loggar, kontrollsidan eller i någon prompt.** Anna lägger den lokalt själv. Be aldrig om den.
- Inga lösenord i chatt, formulär, repo, loggar eller prompts. Floristen skriver bara på grossistens egen inloggningssida i webbläsarfönstret. **Agenten får aldrig lösenord, cookies, token, personuppgifter från formulär eller fullständiga rubriker** (`src/privacy.mjs` är ett extra såll ovanpå att verktygen inte läser sådant).
- Aldrig kringgå CAPTCHA eller MFA. Inga köp, inga kontoändringar, ingen aggressiv genomsökning, ingen sparad session. Mejlet till grossisten är **inte skickat** och ska inte skickas utan hennes ok.
- Hittas en **uttrycklig publik regel som förbjuder testet mot grossisten: stoppa och säg det till Anna.**
- **Pausat tills AI-agenten är bevisad:** offertknappar, favoriter, fler UI-funktioner, fakturering, full grossistconnector, sparad inloggning. Bygg ingen mer arkitektur före en fungerande riktig AI-demo.
- Anna är inte utvecklare och pratar svenska. Skriv enkelt och rakt, utan onödig arkitektur. Hon vill ha "REDO / INTE REDO"-besked, helst högst 3 till 4 steg för henne och inga terminalkommandon om det går att bygga bort.
- **Skilj alltid på fyra nivåer** och säg exakt vilken som är bevisad: testad med manus (mock) · testad mot lokal Anthropic-kompatibel testserver · testad med riktig modell · testad mot riktig grossist. Säg aldrig "riktig AI testad" förrän ett anrop faktiskt gått till Anthropic. Säg i stället: *"Koden för riktig AI är redo, men första verkliga modellanropet sker när Anna lägger in sin nyckel."*
- Rapportera ärligt vad som inte är provat. Säg aldrig att något fungerar som inte har körts.

## Läget just nu

**MVP 1A** (exakt prismotor, arbetsyta, brygga till gamla appen, offert/kundorder, minimal Jobb-flik): klar, godkänd av Anna och pausad. 405 tester gröna. Offertknappar och favoriter är medvetet inte prioriterade än.

**MVP 1B** (grossistagenten, `poc/grossistagent/`): byggd och pushad.
- Riktig Anthropic-SDK (`claude-sonnet-5-5`) styr en agent i en riktig Chrome (Playwright). Skrivskydd som teknik på hela webbläsarkontexten. Kod läser ut, tolkar och räknar (`purchase.js`); AI:n räknar aldrig priser eller förpackningar.
- Dubbelklicksstart: `1-SETUP`, `2-STARTA-GROSSISTAGENT`, `3-RADERA-NYCKEL` (`.bat` och `.command`). **Setup** kontrollerar operativsystem, Node, programmappen, bibliotek, skrivrättigheter, lokal port, att Chrome hittas och startar, nyckel och AI-anslutning (`src/checks.mjs`). Startskärmen väljer **Kör självtest**, DEMO (egna frågor) eller RIKTIG GROSSIST.
- **Självtest** (`src/selftest.mjs`): fem uppgifter med den riktiga modellen mot den påhittade butiken, inloggning gjord av koden, deterministiska kontroller mot butikens data (inget påhittat, artikelnummer, namn, förpackning, pris, längd, färg och erbjudande bevarade, packberäkning lika med en oberoende heltalsräkning, inga muterande anrop). Relevans är anmärkningar; uttryckliga krav och dataintegritet är fel. Slutbesked GODKÄNT / GODKÄNT MED ANMÄRKNINGAR / EJ GODKÄNT / STOPP.
- **Tak** (tabell i README): 60 000 tokens per uppdrag och 180 000 per session (självtestet 80 000 per uppdrag och 300 000 totalt, och det visar tokens och modellanrop per uppgift: be Anna skicka siffrorna), 12 steg, 24 verktygsanrop, 25 000 per enskild förfrågan, 3 000 per svar, 4 000 tecken per verktygsresultat. RIKTIG GROSSIST dessutom 20 artiklar, 2 s paus, 30 min. Vid gräns: *"STOPP – testets säkerhetsgräns är nådd."*, ingen automatisk fortsättning. **Siffrorna är valda efter förfrågningarnas storlek i den scriptade kedjan (14 000 till 37 000 tokens per uppgift), inte efter en riktig modell.**
- Samtyckesruta med Annas exakta text (`CONSENT_TEXT` i `src/session.mjs`). Efter floristens inloggning: *"Inloggning klar – agenten väntar"*, ingen aktivitet före första uppgiften.
- Tester: se README (PoC: `cd projects/buketraknare/poc/grossistagent && npm test`; kräver Chromium via `CHROME_PATH` eller vanliga sökvägar, och `python3` för terminaltesterna).

**Bedömning till Anna:** DEMO MED RIKTIG AI = REDO (koden; första verkliga anropet sker med hennes nyckel). RIKTIG GROSSIST = INTE REDO.

## Det som inte är bevisat (säg det alltid)

1. **Ingen riktig AI-modell har körts** av Claude (ingen nyckel). Testerna använder den riktiga SDK:n mot en lokal testserver (`test/support/fake-anthropic.mjs`) vars svar är ett manus (`test/support/scripted-model.mjs` för självtestet). Första riktiga körningen kan avslöja något: att modellen inte avslutar med `report_candidates`, att en parameter avvisas, att 60 000 tokens per uppdrag är för snävt. Startkontrollen ("AI ansluten ✓") gör ett riktigt anrop med samma verktyg och parametrar. En avvisad `effort`-parameter hanteras automatiskt.
2. **Inget är provat mot grossistens riktiga butik.** Nätverket i molnsessionen blockerar den och det finns inget konto. Adressen `https://shop.blomstergrossisten.net/` är ett sökresultat och är **inte verifierad**.
3. **Grossistens villkor är inte lästa** (kunde inte hämtas). Ingen uttrycklig förbudsregel hittades, men det betyder inte att ingen finns.
4. **Windows och Mac** är aldrig provade (allt kört på Linux). `.bat`- och `.command`-filerna är kontrollerade statiskt (bash-syntax, etiketter, CRLF, ASCII, båda biblioteken) men inte körda där.
5. Nyckelfilen är en vanlig textfil i användarmappen (inte krypterad). Mildring: litet tak hos Anthropic, egen nyckel, `3-RADERA-NYCKEL`.
6. Kostnaden (3 till 6 kr för självtestet, taket ungefär 10 kr) är en uppskattning, inte mätt. Taken stoppar före nästa anrop men kan överskridas med ett anrop.
7. **Integritetssållet är mönsterbaserat** (e-post, telefon, personnummer, token, "Inloggad som …", känsliga JSON-nycklar). Ett kundnamn i klartext utan igenkännbart mönster (till exempel bara "Anna Svensson" i sidhuvudet) kan inte alltid tas bort. Vid första riktiga testet: titta på sidhuvudet i grossistens butik.

## Nästa steg, i ordning

1. **Anna kör `2-STARTA-GROSSISTAGENT`, klickar *Kör självtest* och rapporterar vad hon ser** (README steg 4): slutbeskedet, skärmdump av självtestets resultat (✓ ✗ !), och det svarta fönstrets text (innehåller aldrig nyckeln). Det första verkliga felet kommer troligen därifrån. Tolka så här: *EJ GODKÄNT* = läs ✗-raderna; *GODKÄNT MED ANMÄRKNINGAR* = modellen valde annorlunda än väntat, inte ett fel; *STOPP* = ett tak nåddes, och raden säger vilket (höj taket först när vi sett riktiga siffror och Anna sagt ja).
2. Rätta det som självtestet avslöjar. Kör sedan PoC-testerna och de 405 huvudtesterna igen innan varje push, och uppdatera PR #10:s text.
3. **Först när självtestet och DEMO fungerat:** första riktiga grossisttestet (README steg 5). Floristen loggar in själv, agenten är pausad, Anna startar första uppgiften, högst 20 artiklar, bara läsning, sessionen raderas efteråt. Verifiera adressen i floristens webbläsare först.
4. Efter det: stickprov mot vad floristen ser i butiken, och vilka fält agenten valt. Sedan avgörs om B (sparad inloggning, synk, kommersiell användning) ska utredas. B kräver ett eget villkors- och tillståndssteg och är **inte** byggt.
5. Därefter kan MVP 1A-arbetet återupptas (offertknappar, favoriter, säkerhetskopia av jobben) när Anna prioriterar det.

## Praktiska fällor (lärdomar från bygget)

- Använd inte `pkill -f` med ett mönster som finns i det egna kommandot (dödar skalet).
- JSDOM-tester som sätter intervall måste stängas i `finally`, annars hänger testkörningen.
- `spawnSync` blockerar testprocessens egen server. Använd asynkron `spawn` när ett testat program ska prata med en server i testet.
- SDK:n läser `ANTHROPIC_BASE_URL`, `ANTHROPIC_AUTH_TOKEN`, `ANTHROPIC_CUSTOM_HEADERS`, `ANTHROPIC_LOG` och profiler ur miljön. `src/ai.mjs` låser adress, nyckel och loggning explicit. Ändra inte det utan att köra `test/ai.test.mjs`.
- **Nyckelbaserad rensning går förbi JSON som text.** Ett verktyg som returnerar `JSON.stringify(objekt)` i stället för objektet slipper `scrubValue`. Returnera objekt och låt sållet gå igenom dem (det felet hittades av testet `en fientlig butik …` i `test/privacy.test.mjs`). Camel-case-nycklar (`phoneNumber`) delas upp före matchning.
- När du testar vad modellen **ser**, titta bara på användarmeddelandena (verktygsresultat) och inte på modellens egna anrop i testmanuset, annars hittar testet sina egna hemligheter.
- Mallsträngen i `src/page.mjs` tål inte backtick, dollar-klammer eller omvänt snedstreck i koden.
- Mutationsverktyget ligger inte i repot (det låg i sessionens scratchpad). Det är litet: byt ut en exakt textsträng i en källfil, kör bara de test som ska fånga det, återställ filen, räkna fångade och överlevande. Mutationstesta nya säkerhetskritiska rader på nytt vid större ändringar. Ett dubbelt skyddslager (inre och yttre såll) ger "överlevande" mutanter som är ekvivalenta; dokumentera dem i stället för att lägga till meningslösa tester.

## Så börjar du en ny chatt

Klistra in något i den här stilen:

> Läs `projects/buketraknare/docs/OVERLAMNING.md` på grenen `ccr-3096e278-m1e6y7` i `annaholmstrompeter/Open-claw` och fortsätt därifrån. Följ de stående reglerna där. Jag har kört självtestet och det här hände: …
