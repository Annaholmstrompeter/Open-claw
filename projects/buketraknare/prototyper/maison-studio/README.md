# Maison Studio: designprototyp för Buketträknaren

> **Prototyp för granskning. Inte den riktiga appen.** Ingen applikationskod är ändrad. Grenen ska inte mergas. master, PR #9, #10 och #11 är orörda och PR #13 är inte mergad. Inget implementeras i appen förrän designen uttryckligen godkänts.
>
> Den här versionen är **ett omtag**, inte en ny CSS-justering. Skälet och orsakerna står i [GRANSKNING.md](GRANSKNING.md).

## Tre vyer, ett arbetsflöde

| Vy | Vad floristen gör där |
| --- | --- |
| **Hem** | Ser senaste arbeten med kundpris, och trycker **Ny bukett** (knappen syns utan rullning). |
| **Bukett** | Arbetsflödets centrum. Väljer blommor, ändrar antal stjälkar och ser kundpriset hela tiden. |
| **Inköp** | Ser vad som ska köpas hem för jobbet, i hela förpackningar, med summa och överskott. |

Huvudmenyn har bara de tre och ingen av dem är en återvändsgränd. Prisfältet i Bukett och Inköp ligger alltid längst ned.

### Så skapar floristen en ny bukett

1. **Ny bukett** på Hem öppnar blomvalet direkt, på **Mina favoriter** (ingen tom bukettvy att ta sig förbi). Sökfältet ligger överst och söker i hela sortimentet.
2. **Byt kategori** med ett tryck på listväljaren *Visa* (sju kategorier + Alla blommor; på bred skärm ligger de som knappar hela tiden).
3. **Markera flera sorter**: ett tryck per blomma lägger 1 stjälke, ett tryck till tar bort (med *Ångra*). Hjärtat sparar en favorit och väljer ingenting.
4. **Tillbaka till buketten** med det stora kommandot i prisfältet, **Visa min bukett (5)**. Kommandot ligger på samma plats som **Lägg till blommor** i den andra vyn.
5. **Ändra antal** stjälkar med plus och minus. Kundpriset i prisfältet och inköpet (*Köper 1 × 10-pack · 99 kr*) räknas om direkt.
6. **Fortsätt lägga till** med **Lägg till blommor**. Det som är valt är fortfarande markerat och inget går förlorat.

På bred skärm (≥ 900 px) ligger bukett och blomval **sida vid sida**, så steg 4 och 6 behövs inte. På riktigt bred skärm (≥ 1180 px) tillkommer en jobbpanel med arrangemang och jobbets kundpris.

## Hur layouten är byggd (varför den inte kan överlappa)

- **Appskal.** Sidan rullar aldrig. Rubrikrad, innehåll, prisfält och meddelanden är vanliga delar i en kolumn och bara listorna rullar. Det finns **ingen `position:fixed` eller `sticky`**, så inget lager kan hamna ovanpå något annat, och prisfältet får aldrig bero på gissade höjder.
- **All text radbryts.** Inga fasta höjder på text, inga rader som rullar i sidled, rubriker är rubriker (inte fält).
- **Ökad teckenstorlek** och låg skärmhöjd (tangentbord uppe, liggande telefon) har egna regler och är med i testmatrisen.

## Vad som är på riktigt och vad som är mockat

| Del | Status |
| --- | --- |
| Priser, moms, förpackningar, avrundning, ≈ och ✓, inköpsplan | **Riktigt.** Buketträknarens prismotor (`js/engine/`, oförändrad mot förra versionen och mot PR #13; `git diff` visar inga ändringar). Jobbpriserna är desamma som förut: 5 115 / 1 615 / 705 kr inkl. moms och 448 kr exkl. moms. Inköp för Emma & Johan: 1 611 kr, 36 stjälkar över, värde 365 kr. |
| Gränssnitt | Nytt designförslag i HTML/CSS/JS. |
| Testdata | Påhittade kunder, jobb, florister, 82 blommor och priser. |
| Favoriter | Sparas lokalt per florist (nedan). |
| Övrigt sparande | **Inget sparas.** Bukettval och jobb ligger i minnet och återställs vid omladdning. |
| Fotografier | Inga ingår. Färgrutorna är artikelns färg i prislistan. |

### Kategorier: en blomma, ett hem

Varje artikel har exakt en kategori och en undergrupp, så man vet var man ska titta. Färg och säsong är inga kategorier (de hittas med sök). Gränsfall avgörs av första raden som stämmer: 1 Torkad eller konserverad → **Torkat**. 2 En rosblomma → **Rosor**. 3 Gröna blad, gräs eller ormbunke → **Grönt**. 4 Gren, kvist, bär eller barr → **Kvistar & bär**. 5 Växer från lök eller knöl → **Lökblommor**. 6 Liten, grenad, luftig eller en spirform → **Utfyllnad**. 7 Övriga stora blommor → **Huvudblommor**. Sök hittar alla på namn (utan versaler och utan å, ä, ö) och många på synonymer; träffen visar sin kategori.

### Favoriter per florist

I prototypen sparas favoriter lokalt i webbläsaren, en lista per florist (påhittade Elsa och Mia har varsin). Under **Mina favoriter → Så sparas favoriter** finns förklaringen och en växlare för att prova florister. I den riktiga appen hör listan till **floristens konto**, följer med mellan telefon och dator, och pekar på artikeln (aldrig på en kopia av priset). Konton och synk byggs inte i prototypen. Där lagring inte är tillåten (till exempel i artefaktvisaren) finns favoriterna bara medan sidan är öppen, och förklaringen säger det.

## Öppna prototypen

- **Länk:** se pull requesten (en enda länk, till den senaste testade versionen).
- **Från repot:** öppna `index.html` i en webbläsare. Ingen installation. Typsnitten (Bodoni Moda, Jost) hämtas från Google Fonts, utan nätverk används reservtypsnitt.
- **En fil:** [`maison-studio-enfil.html`](maison-studio-enfil.html) är samma kod med allt inbyggt.
- Adressparametrar för granskning (gäller filen och repot): `?ny=1` Ny bukett, `?bukett=1` Bukett, `?blommor=1` blomvalet, `?inkop=1` Inköp.

**Två minuters test:** tryck *Ny bukett*, markera fem favoriter, tryck *Visa min bukett*, ändra antal på två sorter, tryck *Lägg till blommor*, öppna *Visa → Grönt* och lägg till en sort, tryck *Inköp för jobbet*.

## Skärmbilder

I mappen [`skarmbilder/`](skarmbilder/): de tre huvudvyerna på mobil (390×664, den höjd en telefon har med webbläsarens fält) och dator (1440×900) som `1-hem-…`, `2-bukett-…` och `3-inkop-…`, flödet för en ny bukett (`4-` till `9-`), andra storlekar (`10-`) och 150 % teckenstorlek (`11-`).

## Verifierat

Alla kontroller körs i riktig Chromium mot den riktiga prismotorn (`playwright-core`, sökväg i `CHROMIUM_PATH`). `SIDA=fil.html` kör flödestesterna mot en annan fil, till exempel enfilen. Granskningen mäter också kontrast (WCAG 2.x, text mot verklig bakgrund).

| Kontroll | Resultat |
| --- | --- |
| `verktyg/data.mjs` (Node): sortiment, kategorier, sök, favoriter, Ångra, priser | **138 ok, 0 fel** |
| `verktyg/floede.mjs`: flöden på mobil och dator, varje belopp jämfört med motorn i Node (Hem-priser, kvitto, antal, arbete, eget material, 6/10/11 rosor, ny bukett, borttagning, inköp, fem favoriter → ändra antal → lägg till fler → inköp, sök, hjärtan, Ångra, tillbaka-knapp, tangentbord) | **264 ok, 0 fel** (mobil 390×664 och dator 1440×900; samma körning mot enfilen: 264 ok, 0 fel) |
| `verktyg/granska.mjs`: kapad text, överlappande text och kontroller, täckta kontroller, tryckytor under 44 px, text under 12 px, sidledsrullning. Alla vyer och lägen (kvitto, byt namn, ta bort, menyer, sök, tomma lägen, meddelanden) på många storlekar och teckenstorlekar | **1 308 lägen, 0 fynd** |
| Samma matris mot den **byggda artefaktsidan** (exakt filen som publiceras) i en sandlåde-iframe som artefaktvisaren: ingen lagring, inga formulärinskick, ingen frågesträng. Dessutom flöden i sandlådan (`verktyg/sandlada.mjs`) | **1 308 lägen, 0 fynd**; flöden **42 ok, 0 fel** |
| `js/engine/` (prismotorn) oförändrad | `git diff` mot förra versionen och PR #13: inga ändringar |

Storlekar i matrisen: telefon 320×568, 360×740, 375×667, 390×664, 390×844, 412×839, 430×739, liggande 667×375 och 844×390, med tangentbord uppe 390×330 och 320×300, surfplatta 768×1024 och 1024×768, dator 900×600, 1180×700, 1280×720, 1440×900 och 1920×1080. Teckenstorlek 100 %, 130 % och 150 % på alla, 200 % på ett urval. Teckenstorlek emuleras genom att alla teckenstorlekar i CSS och JS skalas medan layoutens övriga mått är kvar, som Androids teckenstorlek.

### Hittat och rättat med de nya testerna
- Prisfältets knapp la sig över beloppet vid 150 % teckenstorlek och högre. Jobbpanelen klippte pris och knapp vid 200 %. Eget material och namnbyte överlappade vid stor text. Med tangentbord uppe i en liten skärm tog toppraden och prisfältet nästan hela höjden.
- Ett tomt jobb blev kvar på Hem när man tog bort sista arrangemanget. Nu tas jobbet bort med det (och frågan säger det).
- "1 stjälkar" är nu "1 stjälke". Skärmläsare fick "krinkl. moms" utan mellanslag på Hem.
- **Bara synligt i sandlådan:** artefaktvisaren kan blockera formulärinskick, så *Spara* och *Lägg till* (namnbyte, eget material) gjorde ingenting. De är nu vanliga knappar och Enter hanteras direkt. Det hade inte hittats utan sandlådetestet.
- Granskningsmotorn själv missade först text som klipps av sin egen ruta (en rubrik med `overflow:hidden`). Den hittas nu, kontrollerad mot en planterad defekt.

### Inte verifierat (viktigt)

- **Riktig telefon.** Miljön har ingen. Allt är testat i Chromium med telefonprofil (touch, skärmstorlek, pixeltäthet, sandlåda), inte på en iPhone eller Android-telefon.
- **Safari/WebKit och Firefox** finns inte här. Särskilt hur **tangentbordet** och adressfältet ändrar skärmhöjden på iOS är bara emulerat med kortare fönster.
- Skärmläsare, högkontrastläge och utskrift. Att en florist provat den. Ett riktigt grossistsortiment.

## Filer

```
projects/buketraknare/prototyper/maison-studio/
├── README.md, GRANSKNING.md
├── index.html                  (öppna denna)
├── maison-studio-enfil.html    (samma sak i en fil, byggd med verktyg/bygg-enfil.mjs)
├── css/studio.css
├── js/studio.js                (gränssnittet: tre vyer, appskal, blomval)
├── js/studio-engine.js         (översätter motorns svar till skärmen, sortiment, kategorier, sök. Ingen egen räkning)
├── js/studio-favorites.js      (favoriter per florist, lokalt)
├── js/studio-data.js           (påhittad testdata)
├── js/engine/                  (appens prismotor, oförändrade kopior)
├── skarmbilder/                (verktyg/capture.mjs)
└── verktyg/                    (data.mjs, floede.mjs, granska.mjs, sandlada.mjs, capture.mjs, bygg-enfil.mjs, bygg-artefakt.mjs, lib/)
```
