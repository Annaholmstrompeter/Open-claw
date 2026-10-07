# Buketträknaren

Kalkylator för en florist: välj storlek (liten, medel, stor), tryck på blommorna och få ett pris till kund. Priset räknas på **hela förpackningar**. Köper du ett 10-pack för 3 rosor betalar kunden för hela paketet.

Appen är byggd för telefon. Den fungerar med vilken grossist som helst.

## Två sätt att köra den

- **Bara filen.** Öppna `public/index.html` i en webbläsare, eller använd den som sida på claude.ai. Allt fungerar utom att priserna kommer tillbaka automatiskt: svaret från AI:n klistras in för hand.
- **Som egen webbplats med brevlåda (rekommenderas).** Då lämnar AI:n in priserna själv, och de dyker upp i appen utan inklistring. Se "Driftsätta" nedan.

Data (prislista, recept, order, inställningar) sparas i telefonens webbläsare, så den följer inte med om man byter telefon eller rensar webbläsaren.

## Så används den

1. **Första gången finns de 20 vanligaste bukett- och utsmyckningsblommorna som knappar, men utan priser.** Ett klick på en knapp lägger till en blomma i buketten, fler klick ger fler blommor, och minus tar bort en. Saknas en blomma trycker man på "Ny blomma" (eller skriver namnet i sökrutan) och skriver in den, så skapas en ny knapp. Knappen "Prova med exempeldata" visar hur appen räknar, med påhittade priser.
2. **Välj blommor** i en eller flera buketter. Priser som ligger kvar från förra gången visas som "ca" och med ålder, så man får ungefärliga priser direkt.
3. **Tryck "Hämta pris" när du valt klart.** En ruta öppnas med två val. Grossistens namn och webbadress, och vilken AI man använder, sparas till nästa gång.
   - **Skärmdumpar** (förvalt, ingen prenumeration behövs). Man loggar in hos grossisten själv, söker fram blommorna som visas under "Sök fram" och tar skärmdumpar. Sedan öppnar man ChatGPT eller Claude med uppdraget (knappen "Öppna … med uppdraget", eller kopiera det), bifogar skärmdumparna i chatten och klistrar tillbaka svaret i appen.
   - **ChatGPT Work** (kräver ChatGPT-abonnemang). Knappen öppnar ChatGPT med uppdraget färdigskrivet. Man tar över molnwebbläsaren för att logga in hos grossisten själv (inloggningen sparas till nästa gång) och assistenten hämtar priserna.
4. **Priserna kommer tillbaka.** Med ChatGPT Work och brevlådan lämnar assistenten själv in tabellen i ett formulär, och appen visar den av sig själv när man kommer tillbaka till den. I övriga fall klistrar man in svaret.
5. Appen visar vad som lästes av: gammalt och nytt pris, procent per stjälk, **ändrad förpackning** och vad som inte hittades. Först när man trycker "Använd priserna" byts priserna, och de räknas då som aktuella idag.

I ChatGPT Work-läget säger uppdraget att AI:n bara ska läsa av, inte beställa eller ändra något. I skärmdumpsläget säger det att den aldrig ska gissa ett pris. Koden till grossistens konto skrivs bara på grossistens egen sida, aldrig i appen. AI:ns avläsning kan bli fel, så man ska alltid kontrollera förhandsgranskningen.

Svaret kan vara en tabell med semikolon, en markdown-tabell eller ett kodblock, även med en inledande mening före. Förväntade kolumner är `Namn; Antal per förp; Pris per förp; Enhet; Anmärkning`. Namnet matchas mot dina egna blommor, även när AI:n skrivit en variant ("Röd ros Freedom 60 cm" matchar "Röd ros"). Varianten visas i förhandsgranskningen.

## Driftsätta (engångssetup, ca 5 minuter)

Samma sätt som för Ledtråd (`ledtrad-app`), men utan att skapa någon lagring för hand.

1. Logga in på https://dash.cloudflare.com.
2. *Workers & Pages → Create → Import a repository*. Välj det här GitHub-repot och sätt **Root directory** till `projects/buketraknare`. Inget byggkommando behövs. Klicka Deploy.
3. Öppna adressen Cloudflare ger (till exempel `buketraknare.<ditt-konto>.workers.dev`) på telefonen. Chrome: meny → Lägg till på startskärmen. Safari: dela-ikonen → Lägg till på hemskärmen.

Brevlådan skapas automatiskt av `wrangler.toml` (en Durable Object med SQLite-lagring). Gratisplanen ska räcka. Kräver Cloudflare en betald plan för Durable Objects får du ett felmeddelande vid driftsättningen. Kodändringar som pushas till repot driftsätts automatiskt.

## Hur brevlådan funkar

- Appen skapar en slumpad engångskod (128 bitar) varje gång man trycker "Hämta pris" och lägger adressen `<din-adress>/leverera/KOD` i uppdraget.
- Assistenten öppnar adressen, klistrar in tabellen i den enda textrutan och trycker Skicka. Appen frågar var tredje sekund (och direkt när man kommer tillbaka till den) efter något på koden.
- Det som sparas är bara tabellen, högst 20 000 tecken. Den tas bort när appen hämtat den, och annars efter 30 minuter. Koden fungerar bara en gång.
- Appen visar alltid en förhandsgranskning. Inget byts utan att man trycker "Använd priserna", så en felaktig eller illasinnad inlämning kan inte ändra priser i det tysta.
- Vem som helst som känner till koden kan lämna in text under de 30 minuterna. Koden är slumpad och syns bara i uppdraget.

Filer: `public/index.html` (appen), `src/worker.js` (brevlåda och API), `wrangler.toml`.

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

Testat (headless Chromium och Cloudflares egen lokala runtime): de två valen (skärmdumpar och ChatGPT Work) och att uppdraget blir rätt i båda, räknemotorn, tom start, nya blommor, uppdraget, inläsning av AI-svar, matchning, import av hel lista, brevlådans API (engångskod, storleksgräns, felkoder, säkerhetshuvuden) och hela kedjan där en låtsasassistent lämnar in i formuläret och appen visar priserna av sig själv.

**Inte provat:**
- Att ChatGPT Work faktiskt öppnar inlämningsadressen, fyller i formuläret och trycker Skicka. Den kan neka eller fråga om lov först. Fungerar det inte kan man klistra in svaret för hand.
- Att ChatGPT eller Claude läser skärmdumpar bra nog för att priserna blir rätt. Förhandsgranskningen finns för att man ska kunna kontrollera.
- Att länkarna `chatgpt.com/?q=` och `claude.ai/new?q=` fyller i texten, och om telefonen öppnar appen eller webbläsaren.
- Någon riktig grossist. Avläsningen på grossistens sida beror på hur den ser ut.
- Driftsättningen på Cloudflare. Den har inte körts, bara samma kod lokalt.

## Inte byggt än

- Att appen själv läser av skärmdumparna, så att man slipper öppna en chatt och klistra in. Det kräver en API-nyckel hos en AI-leverantör, som kostar några tiotals öre per körning, och en spärr mot att andra använder den. Appen fungerar utan.
- Automatisk inloggning och avläsning på servern (utan assistent). Det vore en egen webbläsare i molnet och kräver att grossistens inloggning sparas. Det kan bli aktuellt om assistenten inte klarar inlämningen.
- Konton och delad data mellan användare. Varje telefon har sin egen kopia.
- Läsning av `.xlsx` och PDF direkt, foton på blommor, favoriter och matchning på artikelnummer.
- Momssatsen står på 25 % som exempel. Kontrollera med redovisningen vilken som gäller.
