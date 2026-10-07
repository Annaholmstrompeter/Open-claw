# Buketträknaren

Kalkylator för en florist: välj storlek (liten, medel, stor), tryck på blommorna och få ett pris till kund. Priset räknas på **hela förpackningar**. Köper du ett 10-pack för 3 rosor betalar kunden för hela paketet.

Appen är byggd för telefon. Den fungerar med vilken grossist som helst.

## Köra

Öppna `index.html` i en webbläsare. Ingen installation behövs. Data sparas i webbläsaren (localStorage), så den följer inte med om man byter telefon eller rensar webbläsaren.

## Så används den

1. **Första gången finns de 20 vanligaste bukett- och utsmyckningsblommorna som knappar, men utan priser.** Ett klick på en knapp lägger till en blomma i buketten, fler klick ger fler blommor, och minus tar bort en. Saknas en blomma trycker man på "Ny blomma" (eller skriver namnet i sökrutan) och skriver in den, så skapas en ny knapp. Knappen "Prova med exempeldata" visar hur appen räknar, med påhittade priser.
2. **Välj blommor** i en eller flera buketter. Priser som ligger kvar från förra gången visas som "ca" och med ålder, så man får ungefärliga priser direkt.
3. **Tryck "Hämta pris" när du valt klart.** En ruta öppnas. Man skriver in sin grossist (namn och webbadress) och väljer sin AI-assistent (ChatGPT Work eller Claude). Det sparas till nästa gång. Knappen "Öppna ChatGPT med uppdraget" öppnar assistenten med uppdraget färdigskrivet för de valda blommorna. Det går också att kopiera uppdraget och klistra in det själv. Man loggar in på grossistens sida själv när assistenten ber om det (ChatGPT Work sparar inloggningen till nästa gång), och klistrar sedan tillbaka svaret i appen.
4. Appen visar vad som lästes av: gammalt och nytt pris, procent per stjälk, **ändrad förpackning** och vad som inte hittades. Först när man trycker "Använd priserna" byts priserna, och de räknas då som aktuella idag.

Uppdraget säger att AI:n bara ska läsa av, inte beställa eller ändra något. Koden till grossistens konto skrivs bara på grossistens egen sida, aldrig i appen. AI:ns avläsning kan bli fel, så man ska alltid kontrollera förhandsgranskningen.

Svaret kan vara en tabell med semikolon, en markdown-tabell eller ett kodblock, även med en inledande mening före. Förväntade kolumner är `Namn; Antal per förp; Pris per förp; Enhet; Anmärkning`. Namnet matchas mot dina egna blommor, även när AI:n skrivit en variant ("Röd ros Freedom 60 cm" matchar "Röd ros"). Varianten visas i förhandsgranskningen.

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

## Inte byggt än

- Automatisk koppling till AI eller grossist. Länken öppnar assistenten med uppdraget, men svaret måste klistras tillbaka för hand. Att länkarna (`chatgpt.com/?q=` och `claude.ai/new?q=`) fyller i texten, och om telefonen öppnar appen eller webbläsaren, är inte provat. En riktig inbyggd koppling skulle kräva en egen serverdel med en webbläsare i molnet, och är en annan storlek.
- Konton och delad data mellan flera användare. Varje telefon har sin egen kopia.
- Läsning av `.xlsx` och PDF direkt, foton på blommor, favoriter och senast använda.
- Matchning på artikelnummer.
- Momssatsen står på 25 % som exempel. Kontrollera med redovisningen vilken som gäller.
- Inget är provat mot en riktig grossist eller en riktig AI-assistent. Appen och inläsningen av svaret är testade, men själva avläsningen på grossistens sida måste någon prova.
