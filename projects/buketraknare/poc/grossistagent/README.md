# Grossistagent: ett skrivskyddat försök med riktig AI (MVP 1B)

**DEMO MED RIKTIG AI: REDO.** Koden för riktig AI är redo, men det första verkliga modellanropet sker när du lägger in din nyckel. Den har ännu aldrig körts mot en riktig AI-modell, för jag har ingen nyckel (och ska inte ha någon). Första körningen hos dig är det verkliga provet. Därför finns ett **självtest** (steg 4) som kör fem uppgifter med den riktiga modellen och kontrollerar svaren automatiskt.

**RIKTIG GROSSIST: INTE REDO.** Först ska DEMO ha fungerat hos dig. Dessutom har jag inte kunnat läsa grossistens villkor (se längst ned), adressen till webbutiken är inte verifierad, och inget har körts mot en riktig butik.

**Vad som är bevisat, och vad inte** (vi håller isär fyra nivåer hela tiden):

| Nivå | Läge |
|---|---|
| Testad med **manus** (ett skript som låtsas vara modellen) | Ja. Bevisar maskineri, skydd och kontroller, inte modellens omdöme. |
| Testad mot en **lokal Anthropic-kompatibel testserver** (den riktiga SDK:n över riktig HTTP) | Ja. Bevisar rubriker, protokoll och felhantering, men svaren är fortfarande ett manus. |
| Testad med en **riktig modell** | **Nej.** Väntar på din nyckel. Självtestet är gjort för att visa det i klartext. |
| Testad mot en **riktig grossist** | **Nej.** |

Vad det är: floristen loggar **själv** in hos sin grossist i en riktig Chrome. Därefter kan en AI-agent söka i den inloggade webbutiken och ge tillbaka strukturerad artikeldata. Vår egen kod (inte AI:n) läser ut, tolkar och räknar. Allt är **skrivskyddat** och **ingen session sparas**. Det är helt separat från Buketträknaren: ingen del av appen importerar något härifrån.

Kedjan i DEMO: **din svenska instruktion → riktig AI-modell → agentverktyg → riktig Chrome → påhittad butik → strukturerad produktdata → Buketträknarens exakta beräkning.** AI:n söker, väljer och förstår. Vår kod läser ut och räknar.

---

## 1. Installera en gång hemma

1. **Hämta programmet.** Öppna länken medan du är inloggad på GitHub, så laddas en ZIP-fil ned:
   `https://github.com/Annaholmstrompeter/Open-claw/archive/refs/heads/ccr-3096e278-m1e6y7.zip`
   (Alternativt: öppna grenen `ccr-3096e278-m1e6y7` på GitHub, klicka *Code* och *Download ZIP*.) Packa upp den. Mappen du ska använda heter `projects/buketraknare/poc/grossistagent` inne i den uppackade mappen.
2. **Installera två vanliga program** (om du inte redan har dem): **Node.js** (version 20 eller senare, välj *LTS* på nodejs.org) och **Google Chrome**.
3. **Dubbelklicka på `1-SETUP`** (på Windows `1-SETUP.bat`, på Mac `1-SETUP.command`). Ett svart fönster öppnas och installerar det som behövs (kräver internet, tar några minuter). Därefter kontrollerar det automatiskt: operativsystem, Node-version, att programmappen är komplett, att biblioteken är installerade, att datorn tillåter skrivning och radering av tillfälliga filer, att en lokal port kan öppnas, att Chrome finns **och faktiskt går att starta och stängas utan rester**. Sist frågar det efter API-nyckeln (se nästa avsnitt) och provar AI-anslutningen. Saknas något står det på enkel svenska vad du ska göra, och setup säger *INTE KLART ÄNNU* tills allt är ✓.
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
3. **Första gången: klicka *Kör självtest*.** Det kostar ungefär 3 till 6 kr (uppskattning, inte mätt) och har ett hårt tak på ungefär 10 kr. Chrome öppnas på en påhittad butik, koden loggar in åt dig med de påhittade uppgifterna (aldrig agenten), och den **riktiga modellen** får fem uppgifter i rad:
   1. *Hitta vita rosor som skulle passa till en romantisk brudbukett. Jag behöver ungefär 25.*
   2. *Vilka vita eller krämvita rosor på minst 60 cm finns?*
   3. *Jag vill göra en mjuk romantisk bukett i vitt och kräm. Föreslå rosor och något grönt som finns i butiken.*
   4. *Finns det erbjudanden på rosor?*
   5. *Jag behöver 30 stjälkar eukalyptus. Vad behöver jag köpa?*

   Modellen får formulera sig hur den vill. Det som kontrolleras är sådant som går att kontrollera exakt, mot butikens egna data: att rätt verktyg användes och artiklar lästes ut ur butiken, att **inget är påhittat**, att artikelnummer, namn, **förpackning, pris, längd, färg och erbjudande är exakt butikens**, att **packberäkningen är gjord av vår kod** (och stämmer med en oberoende räkning i heltal) och att **inget muterande anrop nådde butiken**. Uttryckliga krav i frågan (minst 60 cm, 30 stjälkar) är fel om de bryts. Att modellen valde en annan vit ros än jag väntade är bara en anmärkning (!). Under varje uppgift visas också **hur många tokens och modellanrop den förbrukade**. Det är de första riktiga siffrorna, och med dem kan taken ställas rätt. Slutbeskedet är **GODKÄNT**, **GODKÄNT MED ANMÄRKNINGAR**, **EJ GODKÄNT** eller **STOPP – testets säkerhetsgräns är nådd.** Därefter finns sessionen kvar, så du kan ställa egna frågor eller trycka *Avsluta och radera sessionen*.
4. Vill du hoppa över självtestet: klicka **Starta DEMO (egna frågor)**. Logga in i Chrome-fönstret med **`testkund`** och **`hemligt-123`** (påhittade uppgifter, inget riktigt konto) och klicka *Jag är inloggad. Starta agenten* på kontrollsidan. Skriv sedan din egen fråga, till exempel *"Hitta vita rosor till en romantisk brudbukett. Jag behöver ungefär 25."*, eller klicka på ett av exemplen, och klicka *Skicka*.
5. Överst under rubriken ser du tre lampor: **AI ansluten ✓ · Demo-butik ansluten ✓ · Read-only-skydd aktivt ✓**. Under tiden ser du korta statusrader: *Söker efter «vit ros»…*, *Läser produktinformation…*, *Hittade 5 produkter…*, *Beräknar inköpsbehov…*, *Klart ✓*. Modellens egna resonemang visas aldrig.
6. Resultatet visas som ett kort per artikel, till exempel:

   > **AVALANCHE** · Vit · 60 cm · 20-pack · 5,90 kr/st · 118 SEK/förp · I lager
   > Behov: 25 · Köp: 2 pack · Totalt: 40 st · Över: 15 st · Inköpskostnad: 236 kr (exkl. moms)

   **AI:n väljer och förstår. Vår kod räknar** (förpackningar, överskott, kostnad). Under korten finns en tabell med alla fält.

Samma verktyg och samma skydd används i DEMO som mot en riktig grossist. Det som skiljer är bara butiken, och att DEMO inte kräver samtycke (inget konto används).

## 5. Starta RIKTIG GROSSIST (först när DEMO har fungerat)

Det här är ett **begränsat, skrivskyddat test med floristens eget konto**. Gör det så:

1. Dubbelklicka på `2-STARTA-GROSSISTAGENT` (samma dator och samma nyckel som i DEMO).
2. Kontrollera att *AI ansluten ✓* står där. Kontrollera adressen i rutan under *RIKTIG GROSSIST* mot den som floristen själv använder (förifylld med `https://shop.blomstergrossisten.net/`, **ej verifierad**). Klicka **Starta RIKTIG GROSSIST**.
3. **Floristen loggar in själv** i Chrome-fönstret: användarnamn, lösenord, och eventuell kod eller CAPTCHA. Lösenordet skrivs aldrig på kontrollsidan, aldrig till någon AI och passerar aldrig vår kod.
4. På kontrollsidan kryssar du i rutan:
   > Kontoinnehavaren samtycker till detta begränsade read-only-test med sitt eget konto. Testet får inte genomföra köp eller ändra konto/order.

   och klickar *Jag är inloggad. Starta agenten*. **Agenten är pausad tills du själv skickar den första uppgiften.** Kontrollsidan säger *Inloggning klar – agenten väntar*, och ingenting händer i butiken eller hos AI:n före din första uppgift.
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

Första experimentet har **små, konservativa tak**. När en gräns nås står det **"STOPP – testets säkerhetsgräns är nådd."** och vilken gräns det var. Det finns **ingen automatisk fortsättning**: nästa uppgift startas bara av dig. Det som hunnit läsas ut ligger kvar i listan.

| Gräns | DEMO | RIKTIG GROSSIST |
|---|---|---|
| Steg (modellanrop) per uppdrag | 12 | 12 |
| Verktygsanrop per uppdrag | 24 | 24 |
| Tokens per uppdrag | **60 000** (självtestet: 80 000) | **60 000** |
| Tokens per session | 180 000 (självtestet: 300 000) | 180 000 |
| En enskild förfrågan (skydd mot onödigt stora prompts) | 25 000 | 25 000 |
| Längsta svar från modellen per anrop | 3 000 | 3 000 |
| Längsta verktygsresultat som skickas till modellen | 4 000 tecken | 4 000 tecken |
| Tid per uppdrag | 3 min | 4 min |
| Tid per session | 20 min | 30 min |
| Sidhämtningar per session | 30 | 25 |
| Webbläsaranrop per session (alla, även sidans egna) | 800 | 1 200 |
| Artiklar som läses ut per uppdrag | 30 | **20** |
| Paus mellan sidhämtningar | 0,5 s | 2 s |

Tidigare var taken 150 000 tokens per uppdrag i DEMO och 120 000 i RIKTIG GROSSIST. Självtestet får 80 000 per uppdrag (och 300 000 för hela testet), eftersom en riktig modell kan ta fler steg än manuset jag mätte på, och eftersom det är just där de första riktiga siffrorna kommer ifrån. De är sänkta eftersom ett första experiment inte behöver mer. Mätning av en typisk uppgift i den scriptade kedjan (6 till 9 modellanrop, hela historiken skickas om vid varje steg) gav ungefär **14 000 till 37 000 tokens**, så 60 000 ger marginal utan att vara fritt fram. **Det är en uppskattning från förfrågningarnas storlek, inte en mätning med en riktig modell.** Visar det sig att ett vanligt uppdrag stoppas för tidigt står det exakt vilken gräns som nåddes, och taket kan höjas efter att vi sett riktiga siffror.

När taket för sessionens tokens, tid eller webbläsaranrop är nått kan varken AI:n eller webbläsaren göra något mer i den sessionen (skyddet nekar allt). Starta en ny session för att fortsätta.

**Kostnad (uppskattning, inte mätt mot en riktig körning).** Webbläsaren kostar ingenting. Med Sonnet 5.5 ($2 / $10 per miljon tokens) kostar ett uppdrag ungefär 0,05 till 0,15 USD (cirka 0,5 till 1,5 kr) och självtestet ungefär 3 till 6 kr. Det **högsta** som taken tillåter är ungefär **0,6 USD (6 kr) per session och 1 USD (10 kr) för självtestet**. Taket kan överskridas med ett enda modellanrop eftersom tokens räknas när svaret kommit (programmet stoppar före nästa anrop om nästa väntas spräcka taket, och en enskild förfrågan över 25 000 tokens stoppar uppdraget). Lägg därför alltid också ett tak hos Anthropic. Kontrollsidan visar tokens och uppskattad kostnad löpande.

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

**Minimalt, och aldrig inloggningsuppgifter.** Din instruktion, sidans struktur (länkar, knappar, fältnamn, nyckelnamn i JSON-svar), två exempelrader ur ett JSON-svar så att agenten förstår vilket fält som är vad (de kan innehålla **pris**), och artiklarnas namn, sort, färg, längd, förpackning, tillgänglighet och erbjudandets text. **Inte** priserna i listorna.

Agenten får **aldrig**: lösenord, lösenordsfält eller värden som skrivits i fält, cookies, inloggningstoken, anropens rubriker (där inloggningsuppgifter kan ligga) eller anropens innehåll (bara nyckelnamnen). Verktygen läser helt enkelt inte sådant. Ovanpå det finns ett **extra såll** på allt som kommer ur webbplatsens egna sidor och svar innan modellen ser det (`src/privacy.mjs`):
- adresser visas utan parametrarnas värden (`?session=…` i stället för sessions-id), och utan fragment,
- JSON-fält med känsliga namn (lösenord, token, session, cookie, e-post, telefon, adress, personnummer, kundnummer, namn på kund eller kontaktperson, och allt under `user`, `customer`, `account` och liknande) döljs helt, oavsett värde,
- text som liknar e-post, telefonnummer, personnummer, token, Bearer-rubriker, långa nycklar och "Inloggad som …", "Hej Anna", "Kundnr …" tas bort.

Artikelnummer, namn, priser och förpackningar i produktdata rörs aldrig (det är testat, även för artikelnummer som liknar telefonnummer). **Sållet är mönsterbaserat och bäst möjligt**: en webbplats som skriver ett kundnamn i klartext utan något av mönstren ovan (till exempel bara "Anna Svensson" i sidhuvudet) kan inte alltid kännas igen. Därför är det första skyddet att verktygen inte läser sådant, och därför ska floristen vid första riktiga testet titta på sidhuvudet och se om kontot visar personuppgifter där. Det ska stå i det samtycke floristen ger. Priserna i resultatet kommer från vår kod, aldrig från AI:ns text.

## Vad som är provat och inte provat

**Testad med manus och mot en lokal Anthropic-kompatibel testserver** (`npm test`: 103 tester i PoC:n, plus Buketträknarens 405 huvudtester som är oförändrade och gröna; påhittad butik, riktig Chrome, den riktiga Anthropic-SDK:n över riktig HTTP):
- Hela kedjan i DEMO: kontrollsida → *Starta DEMO* → Chrome → inloggning → instruktion → AI-kopplingen → verktygen → butiken → strukturerade produkter → packberäkning (236 kr i exemplet) → avslut och radering.
- **Självtestet**, både hela vägen via kontrollsidans API (fem uppgifter, automatisk inloggning, kontroller, slutbesked) och kontrollerna var för sig: en korrekt körning ger GODKÄNT; en dålig "modell" som hittar på en artikel, tar en för kort ros, ändrar förpackning eller pris, felräknar plan, saknar plan, använder fel verktyg eller låter ett muterande anrop nå butiken ger EJ GODKÄNT med rätt förklaring; ett för stort anrop ger STOPP och inga fler uppgifter körs. **Manuset är inte en AI**: testerna bevisar att kontrollerna fångar fel, inte att modellen gör rätt.
- Setup: operativsystem, Node, programmappens fullständighet, biblioteken, skrivrättigheter (och att inget lämnas kvar), lokal port, Chrome som hittas och verkligen startar och stängs utan rester, i en riktig terminal. Saknas Chrome får du förklaringen och *INTE KLART ÄNNU*.
- Nyckeln: sparas med rätt rättigheter utanför repot, skrivs i en riktig terminal utan att synas, går bara i rubriken `x-api-key` till en låst adress (miljövariabler kan inte styra om den), syns inte i något svar, någon rapport, något felmeddelande, någon fil i repot eller i webbläsarens mapp, och ärvs inte av Chrome. Tydliga svenska fel för saknad, felaktig, tom eller spärrad nyckel och för nätverksproblem. Sökning i alla spårade filer visar bara påhittade testnycklar.
- Det som skickas till AI:n: en fientlig påhittad butik skriver ut lösenord, token, sessions-id, e-post, telefon, namn och kundnummer i sidan, adressen och JSON-svaren. Inget av det når modellen, medan artikelnummer, namn och priser bevaras exakt. (Testet hittade ett verkligt fel under bygget: JSON som objekt visades som text och gick förbi nyckelreglerna. Det är rättat och testat.)
- Meddelandeprotokollet mot testservern: varje verktygsanrop besvaras, tänkande-block skickas tillbaka oförändrade, avkortade eller avvisade svar kör aldrig verktyg, *Stoppa* avbryter ett pågående anrop.
- Alla gränser (steg, tokens, enskild förfrågan, tid, verktyg, anrop, artiklar) och att sessionen är stängd efter en sessionsgräns.
- Skyddet mot allt en sida kan göra (fetch, XHR, beacon, formulär, bild, iframe, popup, worker, websocket): butikens server fick aldrig ett muterande anrop.
- RIKTIG GROSSIST: efter inloggningen väntar agenten. Inget modellanrop och ingen aktivitet i butiken före första uppgiften.
- Kontrollsidans knappar, låsningar, statusraden, samtyckesrutan, XSS, och att modellens text aldrig visas.
- **Mutationstest** (medvetna fel i säkerhetskritiska rader, med ett verktyg som ligger utanför repot): skyddet sedan tidigare (49 fel, alla fångade), den förra omgångens kod (53 fel, alla fångade) och den nya koden (självtestets kontroller, gränser, integritetssållet, setup-kontrollerna, startskärmen och servern): **113 medvetna fel, 110 fångade.** De tre som överlevde är ekvivalenta: sidtitel, elementtext och utdrag av sidtext sållas både i verktyget och i det yttre sållet (dubbla skyddslager), så att ta bort ett av lagren ändrar inget. Elva fel överlevde en tidigare omgång (till exempel ett saknat test för hex-nycklar, för artikelnummer som liknar telefonnummer, för att skyddslampan inte får visa "aktivt" före inloggningen, och för att katalogen töms mellan uppgifterna) och fick egna tester, så de fångas nu.

**Inte provat:**
- **Med en riktig AI-modell.** Testserverns svar är ett manus: det bevisar att maskineriet, rubrikerna och protokollet stämmer, **inte** modellens omdöme och **inte** att din nyckel fungerar. Första riktiga anropet kan avslöja något vi inte sett (till exempel en parameter som modellen avvisar, eller att modellen inte avslutar med en rapport). Därför kontrolleras nyckeln med ett riktigt anrop (med samma verktyg och parametrar) när du startar, och en avvisad `effort`-parameter hanteras automatiskt. Går något fel står det i klartext på startskärmen. **Vilka gränser som passar en riktig modell vet vi först efter självtestet.**
- **Mot den riktiga grossisten.** Jag når inte butiken härifrån och har inget konto. Adressen är en träff i en sökning, ej verifierad.
- **På Windows och Mac.** Alla tester är körda på Linux. Dubbelklicksfilerna (`.bat` och `.command`) är kontrollerade statiskt (bash-syntax, att varje `goto` har sin etikett, CRLF och ren ASCII, att båda biblioteken kontrolleras) men aldrig körda på de systemen. Hänger något: skicka det svarta fönstrets text (där syns aldrig nyckeln).
- **I floristens egen Chrome och nätverk.**
- **Windows-rättigheter på nyckelfilen.** Där litar vi på användarkontot.
- **Kostnaden.** 3 till 6 kr för självtestet är en uppskattning från förfrågningarnas storlek.

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

Kod i `src/`: `launcher.mjs` (setup/start/radera nyckel) · `checks.mjs` setup-kontrollerna · `selftest.mjs` självtestet och dess kontroller · `privacy.mjs` såll för det som går till modellen · `secrets.mjs` nyckeln (sparas, läses, raderas, döljs) · `ai.mjs` kopplingen till Anthropic (låst adress, felmeddelanden, AI-kontroll) · `limits.mjs` gränserna · `status.mjs` statusraderna · `guard.mjs` skrivskyddet · `capture.mjs` sidans egna JSON-svar · `extract.mjs` tolkning och normalisering · `plan.mjs` inköpsberäkning (använder `public/js/core/purchase.js`, läses bara) · `tools.mjs` agentens verktyg · `agent.mjs` AI-slingan · `session.mjs` sessionen (inloggning, agent, radering) · `server.mjs` och `page.mjs` kontrollsidan · `launch.mjs` Chrome · `demo-shop.mjs` den påhittade butiken (och dess automatiska inloggning för självtestet).

## För utvecklare

`npm install`, sedan `npm test` (kör hela testsviten, kräver en Chromium/Chrome via `CHROME_PATH` eller de vanliga sökvägarna, och `python3` för terminaltesterna). `npm run setup`, `npm start` och `npm run delete-key` gör samma sak som dubbelklicksfilerna. `--test-api http://127.0.0.1:PORT` (bara lokala adresser godtas) pekar AI-kopplingen mot en testserver. Testserverns svar är ett manus, se `test/support/fake-anthropic.mjs` och `test/support/scripted-model.mjs`.
