# Granskning av Maison Studio (före omtaget)

Granskat: koden på grenen vid commit `1724059` (PR #14), README, designgranskningen och de tidigare besluten. Kort och faktabaserat.

## Det du såg på mobilen stämde
Jag öppnade den gamla prototypen i Chromium med telefonstorlekar (320×568, 360×740, 390×664, 412×839) och med 100 % och 150 % teckenstorlek, i nio lägen (Hem, Bukett i tre lägen, Ny bukett, tre lägen i blomvalet, Inköp) och mätte kapad text, text som överlappar, kontroller som något täcker och rullning i sidled.

**72 lägen granskades. 52 hade fel: 601 fynd** (206 kapade texter, 228 överlappningar, 129 täckta kontroller, 38 sidledsrullningar). Bara Hem var rent.

## Orsakerna (i koden, inte i en enskild CSS-rad)
1. **Rubriken var ett `<input>`** (`Brudbukett` i ett smalt fält) med fast bredd. Text i fält radbryts aldrig, så den kapades så snart namnet var längre än fältet. 201 mot 138 px på 320 px.
2. **Arrangemangen låg i en rad som rullade i sidled** (`overflow-x:auto`, `white-space:nowrap`). Det som inte fick plats låg utanför bild: "Corsage ×4", "Nytt arrangemang", priserna.
3. **Fyra fastlimmade lager** (`position:fixed/sticky`: topprad, flikrad, prisfält, blomval) som var och en räknade med en gissad höjd hos de andra (`padding-bottom:140px`). På en telefon med adressrad och tangentbord är höjden ~664 px, inte 844, och lagren hamnade ovanpå innehållet. Prisfältets etikett och beloppet täckte varandra.
4. **Text med fasta höjder och `nowrap`.** Ökad teckenstorlek (Android/iOS-inställning) bröt rader och rutnät.
5. **Blomväljaren var ett separat helskärmslager ovanpå buketten**, med egen topprad och eget prisfält. Floristens arbete (blommor, antal, pris) var uppdelat på två ytor som inte visste om varandra.

## Varför de godkända testerna inte såg det
- De mätte bara **sidans** bredd (`scrollWidth`), inte om enskilda rubriker, rader eller knappar var kapade eller låg på varandra.
- De kördes på **844 px höjd** och **100 % text**. Verklig telefon i webbläsare: ~664 px, och många har större text.
- Fasta lager mättes aldrig mot det de täckte.
- De kontrollerade att ett värde fanns i DOM:en, inte att man **kunde se och trycka** på det.
- Två tester från förra omgången var självuppfyllande (`.slice(0, 0)`). De är rättade, men visar att testerna inte skyddade mot just det här.

## Artefakten mot koden
Den publicerade artefakten och koden på GitHub var **samma bygge** (samma CSS, JS och motor). Det du testade på mobilen var alltså det som låg på grenen. Det var inget publiceringsfel.

## Onödiga steg och navigeringsproblem
- Huvudmenyn hade fyra flikar, men **två var återvändsgränder** ("Blommor" och "Snabbkalkyl" svarade bara "ingår inte i prototypen"). **Inköp**, som floristen behöver, fanns inte i menyn.
- En **"Sparat"-bock** i toppraden och ett "Klart"-kommando som visade "Sparat", fast inget sparas i prototypen (utom favoriter).
- Ny bukett öppnade en **tom bukettvy** med stor rubrik, och först ett till tryck ("Lägg till blommor") öppnade blomvalet, som var ett helskärmslager ovanpå.
- Tre olika kommandon för att gå tillbaka ("Klart", "Visa mina valda blommor", bakåtpil) i stället för ett.

## Vad som gjorts om (struktur)
- **Appskal**: sidan rullar aldrig. Rubrikrad, innehåll, prisfält och meddelanden är vanliga delar i en kolumn. Bara listorna rullar. Inget `fixed`/`sticky`, så inget kan hamna ovanpå något annat.
- **Tre vyer**: Hem, Bukett, Inköp. Bukett är arbetsflödet: välj blommor (sök, favoriter, kategorier), se och ändra stjälkar och pris. Prisfältet visar kundpriset hela tiden och har ett tydligt kommando som växlar mellan "Visa min bukett" och "Lägg till blommor".
- **Alla texter radbryts.** Inga fasta höjder på text, inga sidledsrullande rader, rubrik är en rubrik.
- **Breda skärmar**: bukett och blomval sida vid sida, och med jobbpanel på riktigt breda skärmar.
- **Granskningsmatrisen** (`verktyg/granska.mjs`) mäter nu just det som var trasigt, på många storlekar och teckenstorlekar, och måste ge noll fynd.
