# Grossistagent: ett skrivskyddat försök med riktig AI (MVP 1B)

**DEMO MED RIKTIG AI: REDO.** Koden är klar och testad. Men den har ännu aldrig körts mot en riktig AI-modell, för jag har ingen nyckel (och ska inte ha någon). Första körningen hos dig är det verkliga provet. Se *Vad som är provat och inte provat*.

**RIKTIG GROSSIST: INTE REDO.** Först ska DEMO ha fungerat hos dig. Dessutom har jag inte kunnat läsa grossistens villkor (se längst ned), adressen till webbutiken är inte verifierad, och inget har körts mot en riktig butik.

Vad det är: floristen loggar **själv** in hos sin grossist i en riktig Chrome. Därefter kan en AI-agent söka i den inloggade webbutiken och ge tillbaka strukturerad artikeldata. Vår egen kod (inte AI:n) läser ut, tolkar och räknar. Allt är **skrivskyddat** och **ingen session sparas**. Det är helt separat från Buketträknaren: ingen del av appen importerar något härifrån.

---

## 1. Installera en gång hemma

1. **Hämta programmet.** Öppna länken medan du är inloggad på GitHub, så laddas en ZIP-fil ned:
   `https://github.com/Annaholmstrompeter/Open-claw/archive/refs/heads/ccr-3096e278-m1e6y7.zip`
   (Alternativt: öppna grenen `ccr-3096e278-m1e6y7` på GitHub, klicka *Code* och *Download ZIP*.) Packa upp den. Mappen du ska använda heter `projects/buketraknare/poc/grossistagent` inne i den uppackade mappen.
2. **Installera två vanliga program** (om du inte redan har dem): **Node.js** (version 20 eller senare, välj *LTS* på nodejs.org) och **Google Chrome**.
3. **Dubbelklicka på `1-SETUP`** (på Windows `1-SETUP.bat`, på Mac `1-SETUP.command`). Ett svart fönster öppnas, installerar det som behövs (kräver internet, tar några minuter) och frågar efter API-nyckeln (se nästa avsnitt).
   - *Windows:* om en blå varning ("Windows skyddade din dator") visas: klicka *Mer information* och *Kör ändå*.
   - *Mac:* första gången: högerklicka filen, välj *Öppna* och sedan *Öppna* igen. Om filen inte går att köra: öppna *Terminal* och skriv `chmod +x ` (med mellanslag efteråt), dra in filen i fönstret och tryck Enter.

Du behöver aldrig skriva något i terminalen. Du dubbelklickar bara.

## 2. Var du får API-nyckeln

AI:n kostar pengar per användning, och du betalar Anthropic direkt med din egen nyckel.

1. Gå till **https://platform.claude.com** och logga in (eller skapa ett konto).
2. Lägg in en **liten summa** under *Plans & Billing*, till exempel 10 dollar. Då kan det aldrig kosta mer än så.
3. Gå till *Settings → API Keys → Create Key*. Ge den ett namn, till exempel "grossistagent". Kopiera nyckeln (den börjar med `sk-ant-`). Den visas bara en gång.
4. Tips: under *Limits* för arbetsytan kan du sätta ett månatligt utgiftstak och ett e-postlarm. (Menynamnen kan se lite annorlunda ut än jag beskriver. Jag har läst det på Anthropics sidor men inte klickat mig igenom konsolen.)

Använd gärna en nyckel som bara används till det här, så kan du radera den när testet är klart.

## 3. Så lägger du in nyckeln säkert

Det gör `1-SETUP` åt dig: du klistrar in nyckeln i det svarta fönstret (högerklick eller Ctrl+V) och trycker Enter. **Den syns inte på skärmen när du skriver.** Programmet provar den hos Anthropic (kostar ungefär 0,04 kr) och sparar den bara om den godkänns.

- Nyckeln sparas i en fil i **din egen användarmapp** (`.grossistagent/anthropic-key.txt` under din hemmapp), **utanför** programmappen och utanför Git. På Mac och Linux får bara ditt konto läsa filen. På Windows skyddas den av ditt användarkonto.
- Det är en vanlig textfil, **inte krypterad**. Den som kan logga in på din dator som dig kan läsa den. Därför: sätt ett litet tak hos Anthropic, och radera nyckeln när du är klar.
- Nyckeln **visas aldrig** på kontrollsidan, **skrivs aldrig** i loggar eller rapporter, **sparas aldrig** i repot, **skickas aldrig** till grossisten och **ges aldrig** till Chrome (Chrome startas utan nycklar i sin miljö). Den enda som får den är Anthropics API.
- **Skicka den aldrig till någon, inte heller till mig.** Klistra aldrig in den i en chatt.
- Radera nyckeln: dubbelklicka på **`3-RADERA-NYCKEL`**. Vill du också göra den obrukbar: radera den i Anthropics konsol (*Settings → API Keys*).
- Föredrar du en miljövariabel går det också (`ANTHROPIC_API_KEY`). Den går före filen.

## 4. Starta DEMO (riktig AI, påhittad butik)

1. Dubbelklicka på **`2-STARTA-GROSSISTAGENT`**. Ett svart fönster öppnas (låt det vara öppet) och en **kontrollsida** öppnas i din vanliga webbläsare.
2. Överst på sidan står **"AI ansluten ✓"**. Om något är fel står det ett tydligt felmeddelande i stället (till exempel att nyckeln saknas, inte godkänns eller att saldot är slut), och knapparna är låsta.
3. Klicka **Starta DEMO**. En Chrome öppnas på en **påhittad butik** på din egen dator.
4. Logga in i Chrome-fönstret med **`testkund`** och **`hemligt-123`** (påhittade uppgifter, inget riktigt konto). Klicka sedan *Jag är inloggad. Starta agenten* på kontrollsidan.
5. Skriv din egen fråga, till exempel *"Hitta vita rosor till en romantisk brudbukett. Jag behöver ungefär 25."*, och klicka *Skicka*.
6. Du ser korta statusrader, till exempel *Söker efter «vit ros»…*, *Läser produktinformation…*, *Hittade 5 produkter…*, *Klart ✓*. Modellens egna resonemang visas aldrig. Resultatet är en tabell med artikelnummer, namn, sort, färg, längd, förpackning, floristens pris, moms, lager och erbjudande. **Antal förpackningar, överskott och kostnad räknas av vår kod, inte av AI:n.** Exempel: 25 behövs i 20-pack ger 2 förpackningar, 40 st, 15 över och 236 kr.

Samma verktyg och samma skydd används i DEMO som mot en riktig grossist. Det som skiljer är bara butiken, och att DEMO inte kräver samtycke (inget konto används).

## 5. Starta RIKTIG GROSSIST (först när DEMO har fungerat)

Det här är ett **begränsat, skrivskyddat test med floristens eget konto**. Gör det så:

1. Dubbelklicka på `2-STARTA-GROSSISTAGENT` (samma dator och samma nyckel som i DEMO).
2. Kontrollera att *AI ansluten ✓* står där. Kontrollera adressen i rutan under *RIKTIG GROSSIST* mot den som floristen själv använder (förifylld med `https://shop.blomstergrossisten.net/`, **ej verifierad**). Klicka **Starta RIKTIG GROSSIST**.
3. **Floristen loggar in själv** i Chrome-fönstret: användarnamn, lösenord, och eventuell kod eller CAPTCHA. Lösenordet skrivs aldrig på kontrollsidan, aldrig till någon AI och passerar aldrig vår kod.
4. På kontrollsidan kryssar du i rutan:
   > Kontoinnehavaren samtycker till detta begränsade read-only-test med sitt eget konto. Testet får inte genomföra köp eller ändra konto/order.

   och klickar *Jag är inloggad. Starta agenten*. **Agenten är pausad tills du själv skickar den första uppgiften.**
5. Skriv första uppgiften. Gränserna för det här läget: **högst 20 artiklar per uppdrag**, ingen varukorg, ingen kassa, ingen beställning, inga kontoändringar, ingen sparad inloggning, en lugn takt (minst 2 sekunder mellan sidhämtningar), högst 30 minuter. Stöter agenten på CAPTCHA, en spärr eller en ny inloggning ska den sluta och säga det.
6. Avbryt när du vill med *Stoppa*, eller med *Avsluta och radera sessionen*.

Ser du eller floristen en **uttrycklig publik regel som förbjuder det här**: avbryt testet och hör av dig till mig.

## 6. Avsluta och radera

- **Avsluta och radera sessionen** (kontrollsidan): Chrome stängs, cookies och inloggning töms, den tillfälliga mappen raderas och minnet töms. Kontrollsidan visar *Klart ✓* och går tillbaka till startskärmen. Nästa gång måste floristen logga in igen.
- **Stäng programmet**: avslutar allt, även det svarta fönstret. (Det går också att bara stänga det svarta fönstret.)
- **Spara rapport** är valfritt. Den sanerade rapporten innehåller bara struktur (adressmönster och fältnamn), inga artikeldata, om du inte väljer det. Den hamnar i mappen `out`, som Git ignorerar. Spara aldrig artikeldata i repot: grossistens kundpriser är konfidentiella.
- Radera nyckeln med `3-RADERA-NYCKEL` när du är klar med testerna.

---

## Kostnadsskydd (hårda gränser)

När en gräns nås stoppar agenten, och kontrollsidan visar vilken gräns det var ("Agenten stoppades: …"). Det som hunnit läsas ut ligger kvar i listan.

| Gräns | DEMO | RIKTIG GROSSIST |
|---|---|---|
| Steg (modellanrop) per uppdrag | 16 | 14 |
| Verktygsanrop per uppdrag | 40 | 30 |
| Tokens per uppdrag | 150 000 | 120 000 |
| Tokens per session | 600 000 | 450 000 |
| Tid per uppdrag | 5 min | 4 min |
| Tid per session | 30 min | 30 min |
| Sidhämtningar per session | 60 | 30 |
| Webbläsaranrop per session (alla, även sidans egna) | 2 500 | 1 500 |
| Artiklar som läses ut per uppdrag | 60 | **20** |
| Paus mellan sidhämtningar | 0,5 s | 2 s |

När taket för sessionens tokens, tid eller webbläsaranrop är nått kan varken AI:n eller webbläsaren göra något mer i den sessionen (skyddet nekar allt). Starta en ny session för att fortsätta.

**Kostnad (uppskattning, inte mätt mot en riktig körning).** Webbläsaren kostar ingenting. Med Sonnet 5.5 ($2 / $10 per miljon tokens) blir ett uppdrag ungefär 0,1 till 0,3 USD, och en 30-minuterssession ungefär 10 till 30 kr. Det **högsta** som taken tillåter är ungefär **1,4 USD i RIKTIG GROSSIST och 1,9 USD i DEMO** per session. Taket kan överskridas med ett enda modellanrop eftersom tokens räknas när svaret kommit (programmet stoppar före nästa anrop om nästa väntas spräcka taket). Lägg därför alltid också ett tak hos Anthropic. Kontrollsidan visar tokens och uppskattad kostnad löpande.

## Vad som skyddar mot att något köps eller ändras

Skyddet är **teknik, inte en uppmaning**. Allt agenten gör går genom det, och det sitter på hela webbläsarkontexten från första anropet (flikar, popup-fönster och workers):

1. **Sökvägar och åtgärder nekas för alla metoder, även GET:** varukorg, kassa, beställning, betalning, utloggning, borttagning, `?add=`, `?action=buy` och liknande (även med omskrivna tecken).
2. **Bara läsande metoder släpps igenom** (GET, HEAD, OPTIONS). POST, PUT, PATCH och DELETE nekas som standard.
3. **Undantag:** en läsande GraphQL-fråga (aldrig `mutation`), och en POST som du själv godkänner efter att ha sett exakt vad som nekades (för butiker som söker med POST). Ett godkännande kan aldrig gälla något som liknar varukorg eller beställning.
4. **Sidan lämnas aldrig:** navigering och dataanrop till andra värdar nekas. WebSockets nekas. Service workers är avstängda. Bilder, media och typsnitt hämtas inte.
5. **Verktygen är en andra försvarslinje:** agenten kan inte köra egen kod, inte klicka på något som liknar köp, varukorg, kassa, beställning, spara eller utloggning, och inte skriva i lösenordsfält. Den ser aldrig lösenordsfält eller värden som skrivits i fält.
6. **Gränser** (se ovan) som stoppar agenten.
7. **Självkontroll:** innan agenten startar provas att ett popup-fönsters första anrop fångas av skyddet. Om inte, startar agenten inte.

Allt som nekades syns på kontrollsidan. Webbplatsens data är för agenten bara data: text på sidan som säger "gör si eller så" ignoreras, och skyddet gäller ändå.

## Vad som skickas till AI:n (Anthropics API)

Din instruktion, sidans struktur (länkar, knappar, fältnamn, nyckelnamn i JSON-svar), två exempelrader ur ett JSON-svar så att agenten förstår vilket fält som är vad (de innehåller **pris**), och artiklarnas namn, sort, färg, längd, förpackning, tillgänglighet och erbjudandets text. **Inte** priserna i listorna, inte lösenord, cookies, rubriker eller fältvärden. Det ska stå i det samtycke floristen ger. Priserna i resultatet kommer från vår kod, aldrig från AI:ns text.

## Vad som är provat och inte provat

**Provat (`npm test`, påhittad butik, riktig Chrome, den riktiga Anthropic-SDK:n över riktig HTTP):**
- Hela kedjan i DEMO: kontrollsida → *Starta DEMO* → Chrome → inloggning → instruktion → AI-kopplingen → verktygen → butiken → strukturerade produkter → packberäkning (236 kr i exemplet) → avslut och radering.
- Nyckeln: sparas med rätt rättigheter utanför repot, skrivs i en riktig terminal utan att synas, går bara i rubriken `x-api-key` till en låst adress (miljövariabler kan inte styra om den), syns inte i något svar, någon rapport, något felmeddelande, någon fil i repot eller i webbläsarens mapp, och ärvs inte av Chrome. Tydliga svenska fel för saknad, felaktig, tom eller spärrad nyckel och för nätverksproblem.
- Meddelandeprotokollet mot en Anthropic-kompatibel testserver: varje verktygsanrop besvaras, tänkande-block skickas tillbaka oförändrade, avkortade eller avvisade svar kör aldrig verktyg, *Stoppa* avbryter ett pågående anrop.
- Alla gränser (steg, tokens, tid, verktyg, anrop, artiklar) och att sessionen är stängd efter en sessionsgräns.
- Skyddet mot allt en sida kan göra (fetch, XHR, beacon, formulär, bild, iframe, popup, worker, websocket): butikens server fick aldrig ett muterande anrop.
- Kontrollsidans knappar, låsningar, samtyckesrutan, XSS, och att modellens text aldrig visas.
- Skyddet är mutationstestat sedan tidigare (49 medvetna fel). Den nya koden (nyckel, AI-koppling, gränser, samtycke, start och kontrollsida) mutationstestades med 53 medvetna fel: 52 fångades direkt, ett överlevde (en extra https-kontroll) och fick ett eget test, så alla 53 fångas nu.

**Inte provat:**
- **Med en riktig AI-modell.** Testserverns svar är ett manus: det bevisar att maskineriet, rubrikerna och protokollet stämmer, **inte** modellens omdöme och **inte** att din nyckel fungerar. Första riktiga anropet kan avslöja något vi inte sett (till exempel en parameter som modellen avvisar). Därför kontrolleras nyckeln med ett riktigt anrop (med samma verktyg och parametrar) när du startar, och en avvisad `effort`-parameter hanteras automatiskt. Går något fel står det i klartext på startskärmen.
- **Mot den riktiga grossisten.** Jag når inte butiken härifrån och har inget konto. Adressen är en träff i en sökning, ej verifierad.
- **På Windows och Mac.** Alla tester är körda på Linux. Dubbelklicksfilerna (`.bat` och `.command`) är skrivna med omsorg men aldrig körda på de systemen. Hänger något: skicka det svarta fönstrets text (där syns aldrig nyckeln).
- **I floristens egen Chrome och nätverk.**
- **Windows-rättigheter på nyckelfilen.** Där litar vi på användarkontot.

## Kända begränsningar

- **Webbläsaren styrs av automatik** och Chrome visar det. Vi döljer det inte. En butik med robotskydd kan visa CAPTCHA eller spärra. Då avbryter ni.
- Butikens egna skript körs som vanligt. Skyddet bygger på att varje skrivande anrop går via nätverket, vilket gäller allt utom WebSockets (nekas helt).
- AI-modellens val av fält kan vara fel. Gör stickprov mot det floristen ser i butiken. Kontrollsidan visar varifrån varje värde kommer.
- Nyckelfilen är oskyddad text (se ovan).
- **Villkor och samtycke.** Rutan ovan är floristens samtycke till ett begränsat, skrivskyddat test med eget konto. Den är **inte** ett juridiskt påstående om grossistens villkor. Grossistens egna villkor har jag inte kunnat läsa: sökningar visade ingen uttrycklig regel som förbjuder det här, men det betyder inte att inga finns. Tittar ni på dem före testet (länk i butikens sidfot) är det bra. **Kommersiell eller bestående användning** (sparad inloggning, morgonsynk, hela sortimentet, flera kunder) är något annat och kräver ett eget villkors- och tillståndssteg som den här försöksversionen inte har och inte ska användas till.
- **Rapport:** *Spara rapport* ger en sanerad bild som hjälper oss att förbättra läsningen utan att se butiken.

## Varför en lokal webbläsare och inte Cloudflare Browser Run

Cloudflare har Live View, överlämning till människa och Puppeteer-styrning (enligt paketets typer, dokumentationen går inte att nå härifrån). Men jag kan inte bevisa att det räcker utan ett konto och åtkomst till butiken, 30 minuter kräver betalplan, webbläsaren körs från ett datacenter med signaturrubriker som inte går att ta bort (risk för spärr), och Cloudflare-bygget för repot är sedan tidigare trasigt. Den lokala vägen går att bevisa, kostar inget och använder floristens egen dator och adress. Kärnan (skydd, agent, extraktion, beräkning) är oberoende av var webbläsaren körs.

## Filer

Dubbelklicksfiler: `1-SETUP` · `2-STARTA-GROSSISTAGENT` · `3-RADERA-NYCKEL` (`.bat` för Windows, `.command` för Mac).

Kod i `src/`: `launcher.mjs` (setup/start/radera nyckel) · `secrets.mjs` nyckeln (sparas, läses, raderas, döljs) · `ai.mjs` kopplingen till Anthropic (låst adress, felmeddelanden, AI-kontroll) · `limits.mjs` gränserna · `status.mjs` statusraderna · `guard.mjs` skrivskyddet · `capture.mjs` sidans egna JSON-svar · `extract.mjs` tolkning och normalisering · `plan.mjs` inköpsberäkning (använder `public/js/core/purchase.js`, läses bara) · `tools.mjs` agentens verktyg · `agent.mjs` AI-slingan · `session.mjs` sessionen (inloggning, agent, radering) · `server.mjs` och `page.mjs` kontrollsidan · `launch.mjs` Chrome · `demo-shop.mjs` den påhittade butiken.

## För utvecklare

`npm install`, sedan `npm test` (kör hela testsviten, kräver en Chromium/Chrome via `CHROME_PATH` eller de vanliga sökvägarna, och `python3` för terminaltesterna). `npm run setup`, `npm start` och `npm run delete-key` gör samma sak som dubbelklicksfilerna. `--test-api http://127.0.0.1:PORT` (bara lokala adresser godtas) pekar AI-kopplingen mot en testserver. Testserverns svar är ett manus, se `test/support/fake-anthropic.mjs`.
