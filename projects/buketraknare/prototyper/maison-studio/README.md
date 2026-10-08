# Maison Studio: designprototyp för Buketträknaren

> **Prototyp för granskning. Inte den riktiga appen.** Ingen applikationskod är ändrad, och grenen ska inte mergas. master, PR #9, #10 och #11 är orörda. Inget implementeras i appen förrän riktning är godkänd.
>
> **Den här versionen bygger vidare på PR #13** (Hem, Bukettbyggare och Inköp ligger kvar som de var) och ersätter blomväljaren.

En fungerande HTML/CSS/JS-prototyp med **Hem**, **Bukettbyggaren** med en ny **blomväljare**, och en **inköpsöversikt**, i mobil- och datorlayout. Skärmbilderna är tagna i riktig Chromium 141.

## Vad som ändrats i blomväljaren

Förra versionen visade blomvalet som en lång lista med tre rader per blomma (cirka 83 px per artikel) och ett plus- och minus-steg på varje rad. Det blev ett produktregister. Nu är det en översikt som leder till snabba val:

- **Översikt först.** Sök, **Mina favoriter** och kategorier ligger på samma skärm. Favoriterna är knappar som väljs med ett tryck.
- **Ett tryck per blomma.** Hela raden är en tryckyta som väljer blomman (1 stjälke). Antalet ändras sedan i bukettöversikten, där plus och minus, priser och inköp finns kvar.
- **Hjärtat är diskret och separat.** Det sparar bara en favorit och väljer ingenting.
- **Sök i hela sortimentet.** Sökningen filtrerar medan man skriver, oavsett vald kategori, hittar utan å, ä och ö och förstår synonymer ("brudslöja" hittar gipsört, "eucalyptus" eukalyptus). Träffarna visar vilken kategori de bor i.
- **Kategorier med ett hem per blomma** (sju kategorier och undergrupper, se nedan).
- **Tydlig väg tillbaka.** Knappen **Visa mina valda blommor** går till bukettöversikten. De nya blommorna markeras kort där. Blomvalet kan öppnas igen när som helst och inget val försvinner.
- **Datorlayout för sig.** Blomvalet ersätter bukettytan medan man väljer: kategorierna står alltid till vänster, listan går i två eller tre spalter, prisfält och knapp ligger längst ned. Bukettöversikten får hela bredden när man inte väljer.
- **Radhöjden är 40 % lägre** (83 till 50 px) och fler rader syns på samma skärm (tabell nedan).

## Flödet

### Mobil

1. I bukettbyggaren: **Lägg till blommor** (ligger direkt under blomraderna). Blomvalet öppnas som en egen skärm.
2. **Översikt:** sökfält, **Mina favoriter** som knappar (ett tryck markerar, ett tryck till avmarkerar) och sju kategorier samt Alla blommor. Allt ryms utan att rulla på 390 × 844 px.
3. **Kategori:** rubrik med antal, undergrupper som flikar (när kategorin är stor) och en kompakt lista. Pilen leder tillbaka till översikten. Telefonens tillbaka-svep gör samma sak.
4. **Sök:** skriv var som helst. Resultatet gäller hela sortimentet. Kryssknappen eller pilen tar tillbaka till där man var.
5. **Visa mina valda blommor** (alltid synlig längst ned, med pris och antal sorter) stänger blomvalet och visar bukettöversikten.
6. I bukettöversikten ändras antal **stjälkar** med plus och minus. Priset, inköp i hela förpackningar och ≈ och ✓ räknas av samma motor som förut.

Fem vanliga blommor i en ny bukett tar **sju tryck**: Lägg till blommor, fem favoriter och Visa mina valda blommor, utan att rulla (kontrolleras i `verktyg/blomval.mjs`).

### Dator

Samma flöde, men kategorierna är en spalt till vänster i stället för en översikt att klicka sig in i: **Mina favoriter**, sju kategorier och **Alla blommor** syns hela tiden. Blomvalet öppnas med favoriterna och sökfältet har fokus (tangenten / flyttar fokus till sök från var som helst). Esc rensar sökningen och stänger sedan blomvalet.

## Kategorier: en blomma, ett hem

En blomma som ligger i flera kategorier är svår att hitta, för man vet inte var man ska titta. Därför har **varje artikel exakt ett hem**: en kategori och en undergrupp. Färg och säsong är inga kategorier. De hittas med sök.

| Kategori | Undergrupper | Exempel |
| --- | --- | --- |
| Rosor | Storblommiga, Grenrosor, Trädgårdsrosor | Rosa ros 50 cm, Grenros vit |
| Huvudblommor | Runda och fylliga, Tallriksformade, Exotiska | Pion, Hortensia, Gerbera, Protea |
| Lökblommor | Vårblommor, Liljor och kalla, Sommarknölar | Tulpan, Ranunkel, Lilja, Dahlia |
| Utfyllnad | Spray och grenade, Luftiga, Spirer och struktur | Lisianthus, Gipsört, Delphinium |
| Grönt | Eukalyptus, Bladgrönt, Gräs och ormbunke | Eukalyptus, Ruscus, Ormbunke |
| Kvistar & bär | Blommande kvistar, Bär och frukt, Barr och julgrönt | Körsbärsblom, Hypericum, Gran |
| Torkat | Torkat, Konserverat | Pampasgräs, Konserverad eukalyptus |

**Gränsfall avgörs av första raden som stämmer:**

1. Torkad eller konserverad → **Torkat** (torkad gipsört ligger här, färsk gipsört i Utfyllnad)
2. En rosblomma → **Rosor** (rosenhips är ett bär och ligger i Kvistar & bär)
3. Gröna blad, gräs eller ormbunke som säljs för bladverket → **Grönt**
4. Gren, kvist, bär eller barr → **Kvistar & bär**
5. Växer från lök eller knöl → **Lökblommor** (gladiolus är en spirform men ligger här)
6. Liten, grenad, luftig eller en spirform som ger struktur → **Utfyllnad**
7. Övriga stora blommor → **Huvudblommor**

Hur strukturen håller för ett stort sortiment:

- Strukturen är **två nivåer** och aldrig djupare. Undergrupper visas som flikar bara när en kategori har minst åtta artiklar och mer än en undergrupp. Listan Alla har grupprubriker, så strukturen syns utan att man behöver komma ihåg den.
- Är man osäker på var något hör hemma **söker man** (alla artiklar hittas på sitt eget namn, utan versaler och diakriter, och många på synonymer). Varje träff visar sin kategori, så man lär sig var den bor.
- Sortimentet i prototypen är **påhittat** (82 artiklar, prislistan är inte en riktig grossists). `verktyg/data.mjs` kontrollerar att varje artikel har exakt ett hem, att antalen stämmer och att prioritetsordningen följs för gränsfallen.

## Favoriter per florist

- **I prototypen:** favoriterna sparas lokalt i webbläsaren (localStorage), en lista per florist. Två påhittade florister, Elsa och Mia, har varsin startlista. Under **Mina favoriter** finns **Så sparas favoriter** som visar förklaringen och låter dig byta florist, återställa eller tömma listan. Där lagring inte är tillåten (till exempel i en inbäddad förhandsvisning) finns favoriterna bara medan sidan är öppen, och förklaringen säger det.
- **I den riktiga appen:** listan hör till **floristens konto**, inte till butiken eller enheten, och synkas mellan telefon och dator. En favorit pekar på **artikeln** (grossist och artikelnummer) och aldrig på en kopia av priset, så pris, enhet och förpackning hämtas alltid ur prislistan. Gränssnittet är detsamma, bara lagringen byts. Det som inte byggs i prototypen: konton, synk och hur en favorit visas om artikeln försvunnit ur prislistan.

## Täthet: före och efter (mätt)

Samma mätmetod i båda versionerna i riktig Chromium. "Före" är förra versionens lista (13 artiklar), "efter" är listan i en kategori (Rosor, 13 artiklar) och i Alla blommor (82 artiklar).

| Skärm | Radhöjd före | Radhöjd efter | Rader som syns utan att rulla, före | Efter (en kategori / Alla) |
| --- | --- | --- | --- | --- |
| Mobil 390 × 844 | 83 px | 50 px | 7 | 10 / 11 |
| Mobil 360 × 740 | 85 px | 50 till 68 px (snitt 58) | 5 | 7 / 8 |
| Dator 1440 × 900 | 83 px | 50 px | 7 | 13 / 19 |
| Dator 1280 × 800 | 88 px | 50 till 68 px (snitt 58 till 64) | 5 | 10 / 13 |

Att radhöjden varierar på smalare skärmar beror på att prisraden bryts när inköpsenheten och beskrivningen inte ryms på en rad. Vinsten i flödet är större än siffrorna: favoriterna och sök gör att man oftast inte behöver någon lista alls.

## Vad som är på riktigt och vad som är mockat

| Del | Status |
| --- | --- |
| Priser, moms, förpackningar, avrundning, ≈ och ✓ | **Riktigt.** Prototypen använder appens egen prismotor (`js/engine/` är oförändrade kopior av `projects/buketraknare/public/js/core/`) och räknar inget själv. Jobbpriserna är desamma som förut (Emma & Johan 5 115 kr, Karin Lindgren 1 615 kr, Maria 705 kr, Restaurang Lilja 448 kr exkl. moms). |
| Gränssnittet (layout, typografi, färger, interaktion) | Nytt designförslag i HTML/CSS/JS. |
| Testdata | Påhittade kunder, jobb, florister, blommor och priser. De 13 första artiklarna är de samma som förut, de övriga 69 är nya och påhittade. |
| Favoriter | Sparas lokalt per florist (se ovan). |
| Övrigt sparande | **Inget sparas.** Bukettval och jobb ligger i minnet och återställs vid omladdning. |
| Blommor, Snabbkalkyl, Inställningar, Uppdatera priser, formuläret för nytt jobb | Ingår inte i prototypen. Knapparna visar ett meddelande. |
| Fotografier | **Inga ingår.** Färgrutorna vid blommorna är artikelns färg i prislistan, inga ritade blommor. |

## Öppna prototypen

- **Enklast:** öppna [`maison-studio-enfil.html`](maison-studio-enfil.html) på GitHub, tryck på nedladdningsknappen (Download raw file) och dubbelklicka på filen. Allt är inbyggt i en fil. Typsnitten (Bodoni Moda och Jost) hämtas från Google Fonts, så det behövs nätverk för rätt utseende. Utan nätverk används reservtypsnitt.
- **Från repot:** klona grenen och öppna `index.html` i en webbläsare. Ingen installation behövs.
- **Privat sida i Claude:** enfilen är också publicerad som en privat sida som bara kontots ägare kan öppna (länken står i pull requesten). Där fungerar allt utom adressparametrarna nedan, och favoriterna finns bara medan sidan är öppen.
- `index.html` kan **inte** visas direkt via GitHub (filer visas som text). Inget har publicerats offentligt, ingen GitHub Pages och ingen tredje part.

Adressparametrar för granskning (gäller filen och repot): `?bygg=1` öppnar bukettbyggaren, `?bygg=1&blommor=1` öppnar blomvalet direkt, `?inkop=1` inköpsöversikten, `?foto=1` visar fotoplatsen på Hem. Fönstret kan göras smalare än 1000 px för mobillayouten.

**Förslag på två minuters test:** öppna Hem, välj Emma & Johan, tryck Lägg till blommor. Prova (1) att markera tre favoriter, (2) att öppna en kategori och söka "gips" medan Rosor är valt, (3) att trycka på ett hjärta och se att blomman dyker upp bland favoriterna, (4) att trycka Visa mina valda blommor och ändra antal stjälkar med plus och minus. Starta sedan en ny bukett från Hem och välj fem favoriter.

## Skärmbilder (31 st, originalupplösning)

Mobil är 390 px bred med dubbel skärpa (bilderna är 780 px breda), dator med enkel skärpa. "Hela sidan" betyder att fönstret gjorts lika högt som sidan, så det fasta prisfältet och menyn hamnar längst ned i bilden. De två sista bilderna är förra versionens blomval, sparade för jämförelse.

| Vad | Enhet | Storlek (px) | Bild |
| --- | --- | --- | --- |
| Blomvalet: översikt med sök, favoriter och kategorier | Mobil 390 px | 780×1688 | [Visa](skarmbilder/blomval-mobil-390-1-oversikt.png) |
| Blomvalet: kategorin Lökblommor med undergrupper | Mobil 390 px | 780×1688 | [Visa](skarmbilder/blomval-mobil-390-2-kategori.png) |
| Blomvalet: sök i hela sortimentet (från kategorin Rosor) | Mobil 390 px | 780×1688 | [Visa](skarmbilder/blomval-mobil-390-3-sok.png) |
| Blomvalet: Mina favoriter | Mobil 390 px | 780×1688 | [Visa](skarmbilder/blomval-mobil-390-4-favoriter.png) |
| Blomvalet: förklaring av hur favoriter sparas per florist | Mobil 390 px | 780×1688 | [Visa](skarmbilder/blomval-mobil-390-5-hur-favoriter-sparas.png) |
| Ny bukett: fem favoriter valda med ett tryck var | Mobil 390 px | 780×1688 | [Visa](skarmbilder/blomval-mobil-390-6-ny-bukett-fem-valda.png) |
| Efter Visa mina valda blommor: bukettöversikten med de fem blommorna | Mobil 390 px | 780×1688 | [Visa](skarmbilder/blomval-mobil-390-7-tillbaka-i-buketten.png) |
| Blomvalet på surfplatta, kategorin Huvudblommor | Surfplatta 768 px | 768×1024 | [Visa](skarmbilder/blomval-surfplatta-768-kategori.png) |
| Blomvalet på dator: Mina favoriter | Dator 1440 px | 1440×900 | [Visa](skarmbilder/blomval-desktop-1440-1-favoriter.png) |
| Blomvalet på dator: Lökblommor med undergrupper | Dator 1440 px | 1440×900 | [Visa](skarmbilder/blomval-desktop-1440-2-kategori.png) |
| Blomvalet på dator: Alla blommor, grupperat per kategori | Dator 1440 px | 1440×900 | [Visa](skarmbilder/blomval-desktop-1440-3-alla-blommor.png) |
| Blomvalet på dator: sök över alla kategorier | Dator 1440 px | 1440×900 | [Visa](skarmbilder/blomval-desktop-1440-4-sok.png) |
| Blomvalet på dator: förklaring av hur favoriter sparas | Dator 1440 px | 1440×900 | [Visa](skarmbilder/blomval-desktop-1440-5-hur-favoriter-sparas.png) |
| Blomvalet på liten dator, kategorin Utfyllnad | Dator 1280 px | 1280×800 | [Visa](skarmbilder/blomval-desktop-1280-kategori.png) |
| Blomvalet på stor skärm (tre spalter), kategorin Utfyllnad | Dator 1920 px | 1920×1080 | [Visa](skarmbilder/blomval-desktop-1920-kategori.png) |
| Bukettbyggaren: Brudbukett, med Lägg till blommor under raderna | Dator 1440 px | 1440×900 | [Visa](skarmbilder/bygg-desktop-1440.png) |
| Bukettbyggaren: första skärmen med fast prisfält | Mobil 390 px (som på telefonen) | 780×1688 | [Visa](skarmbilder/bygg-mobil-390.png) |
| Bukettbyggaren: hela sidan | Mobil 390 px (hela sidan) | 780×2876 | [Visa](skarmbilder/bygg-mobil-390-hela-sidan.png) |
| Ny bukett, tomt läge | Mobil 390 px | 780×1688 | [Visa](skarmbilder/bygg-mobil-390-ny-bukett.png) |
| Så räknades priset (öppet) | Dator 1440 px | 1440×900 | [Visa](skarmbilder/bygg-desktop-1440-kvitto.png) |
| Så räknades priset (öppet) | Mobil 390 px | 780×1688 | [Visa](skarmbilder/bygg-mobil-390-kvitto.png) |
| 11 rosor kräver två 10-pack | Dator 1440 px | 1440×900 | [Visa](skarmbilder/bygg-desktop-1440-11-rosor.png) |
| 11 rosor kräver två 10-pack | Mobil 390 px (hela sidan) | 780×2876 | [Visa](skarmbilder/bygg-mobil-390-11-rosor.png) |
| Inköp för jobbet | Dator 1440 px | 1440×900 | [Visa](skarmbilder/inkop-desktop-1440.png) |
| Inköp för jobbet | Mobil 390 px (hela sidan) | 780×3422 | [Visa](skarmbilder/inkop-mobil-390.png) |
| Hem med sparade arbeten | Dator 1440 px | 1440×900 | [Visa](skarmbilder/hem-desktop-1440.png) |
| Hem med sparade arbeten | Mobil 390 px (hela sidan) | 780×2338 | [Visa](skarmbilder/hem-mobil-390.png) |
| Hem med plats för ett fotografi (ingen bild ingår) | Dator 1440 px | 1440×900 | [Visa](skarmbilder/hem-desktop-1440-med-fotoplats.png) |
| Hem med plats för ett fotografi (ingen bild ingår) | Mobil 390 px (hela sidan) | 780×3008 | [Visa](skarmbilder/hem-mobil-390-med-fotoplats.png) |
| FÖRE (förra versionen): blomvalet som en lång lista, en artikel per tre rader | Mobil 390 px | 780×1688 | [Visa](skarmbilder/fore-blomval-mobil-390.png) |
| FÖRE (förra versionen): blomlistan som tredje panel | Dator 1440 px | 1440×900 | [Visa](skarmbilder/fore-bygg-desktop-1440.png) |

## Designprinciper och hur de är lösta

1. **Maison som grund.** Bodoni Moda bara i stora storlekar (rubriker och priser), Jost i tydliga vikter (400 till 600) för all annan text. Varm ljus färgskala. Minsta text är 12 px och Bodoni används aldrig under 20 px.
2. **Arbetsyta på dator.** Jobb och arrangemang till vänster, bukettöversikt eller blomval till höger. Prisfältet sitter fast längst ned.
3. **Översikt före lista.** Favoriter och kategorier gör att man sällan behöver rulla genom ett register. Raderna är kompakta (50 px) men tryckytan är minst 44 px.
4. **Ingen administrationskänsla.** Hårfina linjer i stället för kort och ramar. Det enda som är fyllt är det du har valt (svart) och prisknappen.
5. **Inköpsenheten tydlig även i kompakta rader.** `165 kr/bunt` är fet, `Bunt om 5 st · (33 kr/st)` ligger efter. Styckpriset i parentes är räknat och visas aldrig som grossistens pris.
6. **Inga ritade blommor.** Färgrutor och ett färgband med tal, inga illustrationer eller produktbilder.
7. **Mobil utan överlapp.** Rubrik, sök, undergrupper och prisfält ligger utanför rullningsytan och staplas, så inget kan överlappa eller klippas (kontrolleras vid sex bredder från 320 px).
8. **Funktionalitet bevarad.** Pris, moms, förpackningsberäkning, prisstatus (≈ och ✓), beräknat, presenterat och överenskommet pris, antal stjälkar och inköp i hela förpackningar är oförändrade. Stjälkar i buketten och förpackningar att köpa är fortfarande två olika saker: blomvalet visar "10 stjälkar", bukettöversikten visar "Köper 2 buntar".

## Prispresentation: inköpsenheten först

Det floristen köper är en hel förpackning, så förpackningens pris är alltid tydligast. Styckpriset är ett **räknat värde i parentes** och visas aldrig som grossistens pris.

| Artikel | Visas som |
| --- | --- |
| Pion | **165 kr/bunt**, Bunt om 5 st · (33 kr/st) |
| Rosa ros 50 cm | **99 kr/10-pack**, (9,90 kr/st) |
| Hortensia | **39 kr/st**, Säljs styckvis |
| En artikel där styckpriset inte går jämnt upp (till exempel 100 kr för 3 st) | **100 kr/bunt**, Bunt om 3 st · (≈ 33,33 kr/st) |

- **Plus och minus gäller antal stjälkar** som används i arrangemanget, och det står "Antal stjälkar" ovanför listan.
- **Inköp räknas på hela förpackningar**, av appens egen inköpsplan. Under varje rad står till exempel "Köper 1 × 10-pack · 99 kr". Med 6 och 10 rosor köps ett 10-pack, med 11 rosor två ("Köper 2 × 10-pack · 198 kr"). Delas en förpackning mellan arrangemang står "Hela jobbet köper …".
- **Samma princip** gäller blomlistan, bukettbyggaren och inköpsöversikten. Inköpsöversikten visar behövs, köper, över och kostnad per vara samt summan (1 611 kr, 36 stjälkar över, värde 365 kr) rakt ur appens plan.

## Verifierat

Alla kontroller körs i riktig Chromium 141 mot den riktiga prismotorn. Verktygen behöver `playwright-core` och en Chromium (sökväg i `CHROMIUM_PATH`). `SIDA=maison-studio-enfil.html` kör samma kontroller mot enfilen.

- **`verktyg/data.mjs` (Node): 138 kontroller, 0 fel.** Varje artikel har exakt ett hem, antalen stämmer, gränsfallen följer prioritetsordningen, sök (diakriter, synonymer, flera ord, hela sortimentet), favoriter per florist (sparas, byte av florist, trasig och blockerad lagring), Ångra, och att priser och inköpsenhet är desamma som förut.
- **`verktyg/behave.mjs`: 128 kontroller, 0 fel.** Priserna efter varje ändring jämförs mot motorn körd i Node: plus och minus, blomval, arbete, eget material, antal likadana, ny bukett (skapas först vid första blomman), borttagning, inköpsregeln 6/10/11 rosor, inköpsöversikten.
- **`verktyg/blomval.mjs`: 235 kontroller, 0 fel** (mobil, dator vid 1000, 1280, 1440 och 1920 px, och enfilen). Översikten ryms utan att rulla, ett tryck väljer och avmarkerar, pris i blomvalet = motorns pris, Ångra ger tillbaka blomman med sina stjälkar, kategorier och undergrupper, sök medan man skriver över kategorigränser, hjärtan och ordning i favoriter, att en borttagen favorit ligger kvar tills man lämnar vyn, att favoriter överlever omladdning, florister, historik (tillbaka-svep stegar i blomvalet), fokus och Escape, att de nya blommorna markeras i bukettöversikten, fem favoriter på sju tryck, och att varken rubrik, sök, innehåll eller prisfält överlappar eller klipps vid 320, 360, 390, 430, 768 och 844 × 390 px.
- **`verktyg/qa.mjs`: allt ok.** Inget sidledes överflöd och prisfältet inom bild vid 320, 360, 390, 768, 999, 1000, 1024, 1100, 1280, 1440 och 1920 px för Hem, Bukettbyggare, Blomval och Inköp. Tryckytor minst 44×44 px i alla blomvalets vyer. Ingen text under 12 px, ingen skrifttjocklek under 400, ingen Bodoni under 20 px. Kontrast (WCAG 2.x) uppmätt ur CSS-variablerna, också för de nya kombinationerna. Tangentbord med synlig fokusring. Meny och logotyp har minst 16 px mellanrum.
- **Sandlåda:** enfilen testades också i en inbäddad ram utan lagring och utan fullständig historik (så som en förhandsvisning kan köra den). Allt fungerar, favoriterna finns då bara medan sidan är öppen.
- **Rättat på vägen:** toppfältet i förra versionen överlappade vid cirka 1000 till 1040 px (menyn kolliderade med logotypen) och var trångt upp till cirka 1070 px. Det är rättat och kontrolleras nu vid sju bredder mellan 1000 och 1920 px.
- **Vikt:** cirka 266 KB HTML, CSS och JS i `index.html`-varianten (varav prismotorn 145 KB, ej minifierad), och inga bilder.

**Inte verifierat:** riktiga telefoner (iOS och Android), särskilt hur tangentbordet och prisfältet samspelar på iOS, Safari och Firefox, skärmläsare, högkontrastläge, utskrift, mörkt läge (finns inte i prototypen), att en florist provat den, ett riktigt grossistsortiment, och den riktiga förhandsvisningens begränsningar (bara simulerad här).

## Filer

```
projects/buketraknare/prototyper/maison-studio/
├── README.md
├── index.html                  (öppna denna)
├── maison-studio-enfil.html    (samma sak i en enda fil, byggd med verktyg/bygg-enfil.mjs)
├── css/studio.css
├── js/
│   ├── studio.js               (gränssnittet)
│   ├── studio-engine.js        (översätter motorns svar till skärmen, sortiment, kategorier och sök. Ingen egen räkning)
│   ├── studio-favorites.js     (favoriter per florist, lokalt)
│   ├── studio-data.js          (påhittad testdata, kategorier och florister)
│   └── engine/                 (appens egen prismotor, oförändrade kopior)
├── skarmbilder/                (31 bilder, originalupplösning)
└── verktyg/                    (data.mjs, behave.mjs, blomval.mjs, qa.mjs, capture.mjs, bygg-enfil.mjs, bygg-artefakt.mjs)
```
