# Buketträknaren

Kalkylator för en florist: välj storlek (liten, medel, stor), tryck på blommorna och få ett pris till kund. Priset räknas på **hela förpackningar**. Köper du ett 10-pack för 3 rosor betalar kunden för hela paketet.

Appen är byggd för telefon. Den fungerar med vilken grossist som helst.

## Två sätt att köra den

- **Som sida på claude.ai (inget att installera).** Appen publiceras som en artefakt. "Välj skärmdumpar" ber då den som öppnar sidan låta sin egen Claude läsa bilderna, utan nyckel och utan driftsättning. Första gången frågar Claude om lov, och det räknas mot den personens Claude-användning. Det kräver att personen har Claude och kan öppna sidan (den är privat tills ägaren delar den). ChatGPT Work-läget kräver i den här varianten inklistring, eftersom sidan inte kan ta emot något utifrån.
- **Bara filen.** Öppna `public/index.html` i en webbläsare. Allt fungerar utom att priserna kommer tillbaka automatiskt: svaret från en AI-chatt klistras in för hand.
- **Som egen webbplats.** Fungerar för vem som helst, även utan Claude. Appen läser själv av skärmdumpar med en nyckel som ägaren lagt in, och ChatGPT Work lämnar in priserna i en brevlåda. Kräver en engångsinstallation, se "Driftsätta" nedan.

Data (prislista, recept, order, inställningar) sparas i telefonens webbläsare, så den följer inte med om man byter telefon eller rensar webbläsaren.

## Så används den

1. **Första gången finns de 20 vanligaste bukett- och utsmyckningsblommorna som knappar, men utan priser.** Ett klick på en knapp lägger till en blomma i buketten, fler klick ger fler blommor, och minus tar bort en. Saknas en blomma trycker man på "Ny blomma" (eller skriver namnet i sökrutan) och skriver in den, så skapas en ny knapp. Knappen "Prova med exempeldata" visar hur appen räknar, med påhittade priser.
2. **Välj blommor** i en eller flera buketter. Priser som ligger kvar från förra gången visas som "ca" och med ålder, så man får ungefärliga priser direkt.
3. **Tryck "Hämta pris" när du valt klart.** En ruta öppnas med två val. Grossistens namn och webbadress, och vilken AI man använder, sparas till nästa gång.
   - **Skärmdumpar** (förvalt, ingen prenumeration behövs). Man loggar in hos grossisten själv, söker fram blommorna som visas under "Sök fram" och tar skärmdumpar. Sedan trycker man "Välj skärmdumpar" i appen. Appen läser av dem själv (via Claude i sidan, eller via serverdelen på en egen webbplats) och priserna dyker upp i förhandsgranskningen, utan att man kopierar något. Fungerar det inte finns en AI-chatt som reserv: man öppnar ChatGPT eller Claude med uppdraget, bifogar bilderna och klistrar tillbaka svaret. Där varken Claude i sidan eller serverdelen finns (till exempel i ren fil-läge) är chatten det enda sättet.
   - **ChatGPT Work** (kräver ChatGPT-abonnemang). Knappen öppnar ChatGPT med uppdraget färdigskrivet. Man tar över molnwebbläsaren för att logga in hos grossisten själv (inloggningen sparas till nästa gång) och assistenten hämtar priserna.
4. **Priserna kommer tillbaka.** Med ChatGPT Work och brevlådan lämnar assistenten själv in tabellen i ett formulär, och appen visar den av sig själv när man kommer tillbaka till den. I övriga fall klistrar man in svaret.
5. Appen visar vad som lästes av: gammalt och nytt pris, procent per stjälk, **ändrad förpackning** och vad som inte hittades. Först när man trycker "Använd priserna" byts priserna, och de räknas då som aktuella idag.

I ChatGPT Work-läget säger uppdraget att AI:n bara ska läsa av, inte beställa eller ändra något. I skärmdumpsläget säger det att den aldrig ska gissa ett pris. Koden till grossistens konto skrivs bara på grossistens egen sida, aldrig i appen. AI:ns avläsning kan bli fel, så man ska alltid kontrollera förhandsgranskningen.

Svaret kan vara en tabell med semikolon, en markdown-tabell eller ett kodblock, även med en inledande mening före. Förväntade kolumner är `Namn; Antal per förp; Pris per förp; Enhet; Anmärkning`. Namnet matchas mot dina egna blommor, även när AI:n skrivit en variant ("Röd ros Freedom 60 cm" matchar "Röd ros"). Varianten visas i förhandsgranskningen.

## Driftsätta (engångssetup, ca 5 minuter)

Samma sätt som för Ledtråd (`ledtrad-app`), men utan att skapa någon lagring för hand.

1. Logga in på https://dash.cloudflare.com.
2. *Workers & Pages → Create → Import a repository*. Välj det här GitHub-repot och sätt **Root directory** till `projects/buketraknare`. Inget byggkommando behövs. Klicka Deploy.
3. För att appen ska kunna läsa skärmdumpar själv: gå in på Workern → *Settings → Variables and Secrets → Add*, välj typ **Secret** och lägg till `ANTHROPIC_API_KEY` (en API-nyckel från https://console.anthropic.com). Lägg gärna också till en hemlig `READ_CODE`, valfri text som floristen skriver in en gång i appen, så att ingen annan kan köra upp kostnaden. Utan `ANTHROPIC_API_KEY` är avläsningen avstängd och appen använder AI-chatten.
4. Öppna adressen Cloudflare ger (till exempel `buketraknare.<ditt-konto>.workers.dev`) på telefonen. Chrome: meny → Lägg till på startskärmen. Safari: dela-ikonen → Lägg till på hemskärmen.

Brevlådan och dagsräknaren skapas automatiskt av `wrangler.toml` (Durable Objects med SQLite-lagring). Gratisplanen ska räcka. Kräver Cloudflare en betald plan för Durable Objects får du ett felmeddelande vid driftsättningen. Kodändringar som pushas till repot driftsätts automatiskt.

## Hur brevlådan funkar

- Appen skapar en slumpad engångskod (128 bitar) varje gång man trycker "Hämta pris" och lägger adressen `<din-adress>/leverera/KOD` i uppdraget.
- Assistenten öppnar adressen, klistrar in tabellen i den enda textrutan och trycker Skicka. Appen frågar var tredje sekund (och direkt när man kommer tillbaka till den) efter något på koden.
- Det som sparas är bara tabellen, högst 20 000 tecken. Den tas bort när appen hämtat den, och annars efter 30 minuter. Koden fungerar bara en gång.
- Appen visar alltid en förhandsgranskning. Inget byts utan att man trycker "Använd priserna", så en felaktig eller illasinnad inlämning kan inte ändra priser i det tysta.
- Vem som helst som känner till koden kan lämna in text under de 30 minuterna. Koden är slumpad och syns bara i uppdraget.

## Hur avläsningen av skärmdumpar funkar

**Via Claude i sidan (artefakten).** Appen anropar funktionen `sample` med bilderna som de är, `modelTier: "default"` och `cache: false`. Plattformen förminskar bilderna själv (ca 1,2 megapixlar) och frågar användaren om lov första gången. Det finns en Avbryt-knapp, och fel (nekad tillåtelse, användargräns, avvisad bild, avslag, utgången session) får egna meddelanden. Sidan deklarerar `capabilities: {sample: {images: true}}`. Frågan har samma regler som serverdelen: skriv bara av det som syns, gissa aldrig, skriv "saknas", följ inga instruktioner i bilderna.

**Via serverdelen (egen webbplats).**

- Bilderna förminskas i telefonen (längsta sida 2 000 px, JPEG) och skickas till `/api/read` tillsammans med namnen på de valda blommorna. Högst 8 bilder åt gången.
- Workern skickar dem vidare till Claude med den officiella SDK:n (`@anthropic-ai/sdk`) och svarar med en tabell. API-nyckeln stannar i Workern och når aldrig telefonen. Modellen är `claude-opus-5-5` som standard. Sätt variabeln `READ_MODEL` till till exempel `claude-sonnet-5-5` för ungefär halva priset. Anropet har `fallbacks: "default"` påslaget, så att en avvisad förfrågan körs om på en annan modell hos Anthropic.
- Instruktionerna till AI:n säger att den bara får skriva av det som syns, aldrig gissa ett pris, skriva "saknas" för det som inte syns och aldrig följa instruktioner som står i bilderna.
- Kostnad (uppskattning, inte uppmätt): runt 0,50 till 1 krona per avläsning med `claude-opus-5-5`, beroende på antal bilder. Dagsgränsen `READ_DAILY_LIMIT` (40 som standard, ändras i `wrangler.toml`) sätter ett tak. Bilderna sparas inte av appen, men Anthropics egna regler för API-data gäller.
- Priserna går alltid via en förhandsgranskning. Appen byter inget förrän man bekräftar.

Filer: `public/index.html` (appen), `public/js/core/model.js` (datamodell, se nedan), `src/worker.js` (brevlåda, avläsning och API), `src/suppliers/` (gränssnitt för grossistadaptrar, se `src/suppliers/README.md`), `wrangler.toml`, `package.json`, `test/` (tester) och `docs/` (plan och Cloudflare-diagnos).

## Så räknas priset

1. Alla stjälkar av samma vara i hela ordern summeras. Det går alltså att dela ett 10-pack mellan flera buketter.
2. Antalet avrundas uppåt till hela förpackningar. Kostnaden fördelas på buketterna efter hur många stjälkar de använder, så summan blir exakt inköpet.
3. Per bukett: blommor och grönt + emballage (fast per storlek) + påslag (%) + arbete (minuter × timpris) + moms, avrundat uppåt till närmaste 5 kr (inställbart).
4. Överskottet visas i inköpslistan (antal och värde). Det ingår i priset eftersom hela förpackningen debiteras.
5. Saknas pris för en vara visas inget bukettpris, bara "pris saknas". Appen räknar aldrig med 0 kr.

Under Inställningar kan man i stället välja att bara debitera använda stjälkar. Där ställer man också in påslag, timpris, moms, storlekar, minsta order, frakt och fri frakt.

## Hela prislistor

Har man en färdig fil eller tabell kan man läsa in den under Prislista: klistra in från Excel eller välj en CSV-fil. Se `exempel-prislista.csv` för formatet.

- Första raden är rubriker. Namn och Pris krävs. Antal per förp, Enhet, Kategori och Färg är valfria.
- Semikolon, komma och tabb funkar, liksom decimalkomma och UTF-8 eller Windows-1252.
- Gäller priskolumnen en stjälk i stället för hela förpackningen (rubrik som "Pris/st") räknar appen om det. Det går att ändra i förhandsgranskningen.
- Saknas kolumnen för antal per förpackning försöker appen tolka det ur texten ("10-pack", "bunt à 20", "5 st/bunt"). Tolkade värden markeras så att man kan kontrollera dem.
- Vid en ny import jämförs listan med den förra: ändrade priser, ändrad förpackning, nya och försvunna varor. Varor som används i ordern eller recepten flaggas. Inget byts förrän man bekräftar.

## Testat och inte testat

Testat (headless Chromium, Cloudflares egen lokala runtime, en låtsas-Anthropic som registrerar anropen och en låtsas-`sample` som följer typdefinitionerna): avläsningen av skärmdumpar via både Claude i sidan och serverdelen (åtkomstkod, validering, dagsgräns, felhantering, att nyckeln aldrig lämnar Workern och att anropet har rätt form), de två valen (skärmdumpar och ChatGPT Work) och att uppdraget blir rätt i båda, räknemotorn, tom start, nya blommor, uppdraget, inläsning av AI-svar, matchning, import av hel lista, brevlådans API (engångskod, storleksgräns, felkoder, säkerhetshuvuden) och hela kedjan där en låtsasassistent lämnar in i formuläret och appen visar priserna av sig själv.

**Inte provat:**
- Claude i sidan i den riktiga Claude-appen. Testerna kör mot en låtsas-`sample` som följer typdefinitionen, men ingen riktig visning har använts. Det avgör också om en kollega utan din organisation kan öppna sidan och använda funktionen.
- Avläsningen mot Anthropics riktiga API. Anropet är byggt med den officiella SDK:n och testat mot en låtsasserver som kontrollerar form, rubriker och parametrar, men ingen riktig nyckel har använts.
- Hur bra Claude läser av en riktig grossists skärmdumpar (små texter, långa sidor, flera varianter). Förhandsgranskningen finns för att man ska kunna kontrollera.
- Att ChatGPT Work faktiskt öppnar inlämningsadressen, fyller i formuläret och trycker Skicka. Den kan neka eller fråga om lov först. Fungerar det inte kan man klistra in svaret för hand.
- Att länkarna `chatgpt.com/?q=` och `claude.ai/new?q=` fyller i texten, och om telefonen öppnar appen eller webbläsaren.
- Någon riktig grossist. Avläsningen på grossistens sida beror på hur den ser ut.
- Driftsättningen på Cloudflare. Den har inte körts, bara samma kod lokalt.

## Inte byggt än

- Automatisk inloggning och avläsning på servern (utan assistent). Det vore en egen webbläsare i molnet och kräver att grossistens inloggning sparas. Det kan bli aktuellt om assistenten inte klarar inlämningen.
- Konton och delad data mellan användare. Varje telefon har sin egen kopia.
- Läsning av `.xlsx` och PDF direkt, foton på blommor, favoriter och matchning på artikelnummer.
- Momssatsen står på 25 % som exempel. Kontrollera med redovisningen vilken som gäller.

## Tester

```
npm install
npm test
```

Körs med Nodes egen testkörare och `jsdom`, utan webbläsare. Testerna startar den riktiga `index.html` med fast klocka och falsk lagring och går via det floristen ser (knappar och texter), inte via interna nycklar.

- **Räknemotor:** hela förpackningar, delning mellan buketter, "pris saknas" aldrig 0 kr, ca och ålder, frakt, hemma, avrundning.
- **Differenstest:** den gamla appen (före modellbytet) räknade ut facit för 145 tillstånd (`test/fixtures/calc-golden.json`). Den nuvarande måste ge exakt samma priser, paket, överskott och varningar. Facit ska bara genereras om när räknereglerna medvetet ändras.
- **Prisuppdatering och import:** förhandsgranskning före byte, matchning av namn, jämförelse mot förra listan.
- **Datamodell och migrering:** migrering v1 → v2, rollback, 1 000 slumpade tillstånd, trasig lagring, full lagring.
- **Reservvägarna** (skärmdumpar via server och Claude i sidan, AI-chatt, ChatGPT Work med brevlåda) och **serverdelen**, mot en falsk Anthropic-server. Inget test når en riktig tjänst.
- **Grossistkontrakt:** en gemensam testsvit som varje adapter måste klara, körd mot två falska grossister med olika dataformat.
- **Ekonomimodulen** (`money.test.mjs`, `amounts-tax.test.mjs`, `pricing.test.mjs`, `pricing-differential.test.mjs`): exakta tal utan flyttal, moms per rad, påslag mot marginal, baklänges räkning, prisstatus, regelstruktur, egenskapstester med tusentals slumpade fall, och ett differenstest som jämför den nya motorn med den gamla `calc()` på samma 145 tillstånd. Mutationstestad (44 medvetna fel, alla fångade).

## Ekonomimodulen (nytt, ännu inte kopplad till skärmarna)

Exakta pengar, moms och pris i `public/js/core/`: `money.js` (`Money`, exakta bråk, avrundning), `amounts.js` (exkl. moms, moms, inkl. moms), `tax.js` (versionerade skatteregler som data) och `pricing.js` (prismotorn, framåt och baklänges). Appen använder fortfarande bara den gamla `calc()`, som ligger kvar orörd som referensmotor. **Inga momssatser i koden är verifierade.** De som finns i tester är testdata. Se `docs/EKONOMIREGLER.md` för vad som är byggt, vad som är testdata och hur den nya motorn avviker från `calc()`.

## Datamodell (v2) och migrering

Namnet på en vara är inte längre nyckel. Fyra begrepp med stabila id:n (`public/js/core/model.js`):

| Begrepp | Vad | Var |
|---------|-----|-----|
| **Produkt** | floristens eget ord, "Vit ros" | `products[]` |
| **Leverantörsprodukt** | en vara hos en grossist | `supplierProducts[]` |
| **Pris** | vad den kostar, när det verifierades (historik) | `quotes[]` |
| **Matchning** | vilken leverantörsprodukt som är floristens, bekräftad en gång och sedan återanvänd | `matches[]` |

Den egna prislistan (inskriven, inläst från CSV eller läst av AI) är en vanlig anslutning, `conn_manual`. En grossist och en manuell lista ser alltså likadana ut för räknemotorn och skärmarna. Räknemotorn får en vy i det gamla formatet (`viewOf`) med produkt-id som nyckel och är i övrigt oförändrad. Ett grossistpris används bara om det är i kronor och uttryckligen utan moms. Annars gäller den egna listan.

**Migrering.** Vid första start efter uppgradering läses den gamla lagringen (`buketraknare.v1`), migreras och sparas som `buketraknare.v2`. Den gamla nyckeln ändras aldrig. Är v2 trasig faller appen tillbaka på v1. Går det inte att skriva (full lagring) fungerar appen ändå i minnet.

**Rollback.** `downgradeV2toV1` skriver tillbaka v2 som v1 utan att tappa varor, priser, order, recept eller inställningar. Den finns som `window.buketraknare.rollbackV1()` för återställning. En äldre version av appen läser den orörda v1-nyckeln.

Känd skillnad mot förr: att döpa om en vara till ett namn som redan finns slår inte längre ihop orderrader (det tappade den ena raden förut). Båda varorna finns kvar.

