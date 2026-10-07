# Buketträknaren

Kalkylator för en florist: välj storlek (liten, medel, stor), tryck på blommorna och få ett pris till kund. Priset räknas på **hela förpackningar**. Köper du ett 10-pack för 3 rosor betalar kunden för hela paketet.

Alla priser, recept och inställningar i appen är **påhittade exempel** tills en riktig prislista läses in.

## Köra

Öppna `index.html` i en webbläsare. Ingen installation behövs. Data sparas i webbläsaren (localStorage), så den följer inte med om man byter telefon eller rensar webbläsaren.

## Så räknas priset

1. Alla stjälkar av samma vara i hela ordern summeras. Det går alltså att dela ett 10-pack mellan flera buketter.
2. Antalet avrundas uppåt till hela förpackningar. Kostnaden för förpackningarna fördelas på buketterna efter hur många stjälkar de använder, så summan blir exakt inköpet.
3. Per bukett: blommor och grönt + emballage (fast per storlek) + påslag (%) + arbete (minuter × timpris) + moms, avrundat uppåt till närmaste 5 kr (inställbart).
4. Överskottet visas i inköpslistan (antal och värde). Det ingår i priset eftersom hela förpackningen debiteras.

Under Inställningar kan man i stället välja att bara debitera använda stjälkar (packpris ÷ antal × använda). Där ställer man också in påslag, timpris, moms, storlekar, minsta order, frakt och fri frakt.

## Prislista

Under Prislista klistrar man in en tabell från Excel eller väljer en CSV-fil. Se `exempel-prislista.csv` för formatet.

- Första raden är rubriker. Namn och Pris krävs. Antal per förp, Enhet, Kategori och Färg är valfria.
- Semikolon, komma och tabb funkar, liksom decimalkomma och UTF-8 eller Windows-1252.
- Gäller priskolumnen en stjälk i stället för hela förpackningen (rubrik som "Pris/st") räknar appen om det. Det går att ändra i förhandsgranskningen.
- Saknas kolumnen för antal per förpackning försöker appen tolka det ur texten ("10-pack", "bunt à 20", "5 st/bunt"). Tolkade värden markeras så att man kan kontrollera dem.
- Vid en ny import jämförs listan med den förra: ändrade priser (och procent per stjälk), **ändrad förpackning**, nya och försvunna varor. Varor som används i ordern eller recepten flaggas. Inget byts förrän man trycker "Använd den nya listan".
- Varor matchas på namn. Byter grossisten namn på en vara hamnar den som ny och den gamla som försvunnen.

## Inte byggt än

- Automatisk hämtning av senaste prislistan från Drive, mejl eller grossistens sida. Förslag: ett litet Google Apps Script som körs i florist-kollegans eget Google-konto och hämtar nyaste filen, eller en koppling via Claude om hon har Claude. Detta avgörs när vi sett en riktig prislista.
- Läsning av `.xlsx` direkt (idag kopierar man in tabellen eller sparar som CSV) och av PDF.
- Matchning på artikelnummer.
- Momssatsen står på 25 % som exempel. Kontrollera med redovisningen vilken som gäller.
