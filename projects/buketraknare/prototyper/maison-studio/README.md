# Maison Studio: designprototyp för Buketträknaren

> **Prototyp för granskning. Inte den riktiga appen.** Ingen applikationskod är ändrad, och grenen ska inte mergas. PR #9, #10, #11 och master är orörda. Inget implementeras i appen förrän riktning är godkänd.

En fungerande HTML/CSS/JS-prototyp med två vyer: **Hem** (med sparade arbeten) och **Bukettbyggaren** (med blom- och prisuppgifter), i mobil- och datorlayout. Dessutom en **inköpsöversikt**, eftersom inköpsenheten ska visas på samma sätt överallt. Skärmbilderna nedan är tagna i riktig Chromium 141.

## Vad som är på riktigt och vad som är mockat

| Del | Status |
| --- | --- |
| Priser, moms, förpackningar, avrundning, ≈ och ✓ | **Riktigt.** Prototypen använder appens egna prismotor (`js/engine/` är oförändrade kopior av `projects/buketraknare/public/js/core/`) och räknar inget själv. Siffrorna är identiska med appens (till exempel Brudbukett 1 615 kr, hela bröllopsjobbet ≈ 5 115 kr, inköp 1 611 kr). |
| Gränssnittet (layout, typografi, färger, interaktion) | Nytt designförslag i HTML/CSS/JS. |
| Testdata | Påhittade kunder, jobb, blommor och priser (samma som i granskningsbilderna). |
| Sparande | **Inget sparas.** Allt ligger i minnet och återställs vid omladdning. |
| Blommor, Snabbkalkyl, Inställningar, Uppdatera priser, formuläret för nytt jobb | Ingår inte i prototypen. Knapparna visar ett meddelande. |
| Fotografier | **Inga ingår.** Det finns en plats för ett fotografi på Hem (`?foto=1`), som visar en markerad ruta. Ingen bild ingår, och inga blomillustrationer är ritade. |

## Öppna prototypen

- **Enklast:** öppna [`maison-studio-enfil.html`](https://github.com/Annaholmstrompeter/Open-claw/blob/design-prototype/maison-studio-2026-10-08/projects/buketraknare/prototyper/maison-studio/maison-studio-enfil.html) på GitHub, tryck på nedladdningsknappen (Download raw file) och dubbelklicka på filen. Allt är inbyggt i en fil. Typsnitten (Bodoni Moda och Jost) hämtas från Google Fonts, så det behövs nätverk för rätt utseende. Utan nätverk används reservtypsnitt.
- **Från repot:** klona grenen och öppna `index.html` i en webbläsare. Ingen installation behövs.
- **Direkt på GitHub:** `index.html` kan **inte** visas direkt via GitHub (filer visas som text). En klickbar förhandsvisning kräver en separat publicering. Se avsnittet "Förhandsvisning" nedan.

Adressparametrar som underlättar granskning: `?bygg=1` öppnar bukettbyggaren, `?inkop=1` inköpsöversikten, `?foto=1` visar fotoplatsen på Hem. Fönstret kan göras smalare än 1000 px för mobillayouten.

## Skärmbilder (15 st, originalupplösning)

Mobil är 390 px bred med dubbel skärpa (bilderna är 780 px breda). Dator är 1440 px med enkel skärpa. "Hela sidan" betyder att fönstret gjorts lika högt som sidan, så det fasta prisfältet och menyn hamnar längst ned i bilden.

| Vad | Enhet | Storlek (px) | Länk |
| --- | --- | --- | --- |
| Hem med sparade arbeten | Dator 1440 px | 1440×900 | [Visa](skarmbilder/hem-desktop-1440.png) · [Rå fil](https://raw.githubusercontent.com/Annaholmstrompeter/Open-claw/design-prototype/maison-studio-2026-10-08/projects/buketraknare/prototyper/maison-studio/skarmbilder/hem-desktop-1440.png) |
| Hem med sparade arbeten | Mobil 390 px (hela sidan) | 780×2338 | [Visa](skarmbilder/hem-mobil-390.png) · [Rå fil](https://raw.githubusercontent.com/Annaholmstrompeter/Open-claw/design-prototype/maison-studio-2026-10-08/projects/buketraknare/prototyper/maison-studio/skarmbilder/hem-mobil-390.png) |
| Hem med plats för ett fotografi (ingen bild ingår) | Dator 1440 px | 1440×900 | [Visa](skarmbilder/hem-desktop-1440-med-fotoplats.png) · [Rå fil](https://raw.githubusercontent.com/Annaholmstrompeter/Open-claw/design-prototype/maison-studio-2026-10-08/projects/buketraknare/prototyper/maison-studio/skarmbilder/hem-desktop-1440-med-fotoplats.png) |
| Hem med plats för ett fotografi (ingen bild ingår) | Mobil 390 px (hela sidan) | 780×3008 | [Visa](skarmbilder/hem-mobil-390-med-fotoplats.png) · [Rå fil](https://raw.githubusercontent.com/Annaholmstrompeter/Open-claw/design-prototype/maison-studio-2026-10-08/projects/buketraknare/prototyper/maison-studio/skarmbilder/hem-mobil-390-med-fotoplats.png) |
| Bukettbyggaren: Brudbukett, tre paneler | Dator 1440 px | 1440×900 | [Visa](skarmbilder/bygg-desktop-1440.png) · [Rå fil](https://raw.githubusercontent.com/Annaholmstrompeter/Open-claw/design-prototype/maison-studio-2026-10-08/projects/buketraknare/prototyper/maison-studio/skarmbilder/bygg-desktop-1440.png) |
| Bukettbyggaren: första skärmen med fast prisfält | Mobil 390 px (som på telefonen) | 780×1688 | [Visa](skarmbilder/bygg-mobil-390.png) · [Rå fil](https://raw.githubusercontent.com/Annaholmstrompeter/Open-claw/design-prototype/maison-studio-2026-10-08/projects/buketraknare/prototyper/maison-studio/skarmbilder/bygg-mobil-390.png) |
| Bukettbyggaren: hela sidan | Mobil 390 px (hela sidan) | 780×2858 | [Visa](skarmbilder/bygg-mobil-390-hela-sidan.png) · [Rå fil](https://raw.githubusercontent.com/Annaholmstrompeter/Open-claw/design-prototype/maison-studio-2026-10-08/projects/buketraknare/prototyper/maison-studio/skarmbilder/bygg-mobil-390-hela-sidan.png) |
| Blomvalet som egen skärm | Mobil 390 px | 780×1688 | [Visa](skarmbilder/bygg-mobil-390-blomval.png) · [Rå fil](https://raw.githubusercontent.com/Annaholmstrompeter/Open-claw/design-prototype/maison-studio-2026-10-08/projects/buketraknare/prototyper/maison-studio/skarmbilder/bygg-mobil-390-blomval.png) |
| Så räknades priset (öppet) | Dator 1440 px | 1440×900 | [Visa](skarmbilder/bygg-desktop-1440-kvitto.png) · [Rå fil](https://raw.githubusercontent.com/Annaholmstrompeter/Open-claw/design-prototype/maison-studio-2026-10-08/projects/buketraknare/prototyper/maison-studio/skarmbilder/bygg-desktop-1440-kvitto.png) |
| Så räknades priset (öppet) | Mobil 390 px | 780×1688 | [Visa](skarmbilder/bygg-mobil-390-kvitto.png) · [Rå fil](https://raw.githubusercontent.com/Annaholmstrompeter/Open-claw/design-prototype/maison-studio-2026-10-08/projects/buketraknare/prototyper/maison-studio/skarmbilder/bygg-mobil-390-kvitto.png) |
| 11 rosor kräver två 10-pack | Dator 1440 px | 1440×900 | [Visa](skarmbilder/bygg-desktop-1440-11-rosor.png) · [Rå fil](https://raw.githubusercontent.com/Annaholmstrompeter/Open-claw/design-prototype/maison-studio-2026-10-08/projects/buketraknare/prototyper/maison-studio/skarmbilder/bygg-desktop-1440-11-rosor.png) |
| 11 rosor kräver två 10-pack | Mobil 390 px (hela sidan) | 780×2858 | [Visa](skarmbilder/bygg-mobil-390-11-rosor.png) · [Rå fil](https://raw.githubusercontent.com/Annaholmstrompeter/Open-claw/design-prototype/maison-studio-2026-10-08/projects/buketraknare/prototyper/maison-studio/skarmbilder/bygg-mobil-390-11-rosor.png) |
| Ny bukett, tomt läge | Mobil 390 px | 780×1688 | [Visa](skarmbilder/bygg-mobil-390-ny-bukett.png) · [Rå fil](https://raw.githubusercontent.com/Annaholmstrompeter/Open-claw/design-prototype/maison-studio-2026-10-08/projects/buketraknare/prototyper/maison-studio/skarmbilder/bygg-mobil-390-ny-bukett.png) |
| Inköp för jobbet | Dator 1440 px | 1440×900 | [Visa](skarmbilder/inkop-desktop-1440.png) · [Rå fil](https://raw.githubusercontent.com/Annaholmstrompeter/Open-claw/design-prototype/maison-studio-2026-10-08/projects/buketraknare/prototyper/maison-studio/skarmbilder/inkop-desktop-1440.png) |
| Inköp för jobbet | Mobil 390 px (hela sidan) | 780×3422 | [Visa](skarmbilder/inkop-mobil-390.png) · [Rå fil](https://raw.githubusercontent.com/Annaholmstrompeter/Open-claw/design-prototype/maison-studio-2026-10-08/projects/buketraknare/prototyper/maison-studio/skarmbilder/inkop-mobil-390.png) |

## Designprinciper och hur de är lösta

1. **Maison som grund.** Bodoni Moda bara i stora storlekar (rubriker och priser), Jost i tydliga vikter (400 till 600) för all annan text. Varm ljus färgskala. Minsta text är 12 px och Bodoni används aldrig under 20 px.
2. **Arbetsyta på dator.** Tre paneler: jobb och arrangemang (vänster), aktiv bukett med sammansättning och ingredienser (mitten), blomval (höger). Prisfältet sitter fast längst ned i mitten.
3. **Enkelt blomval.** Sök, filter och ett plus- och minus-steg per blomma. Inga färgade kort.
4. **Ingen administrationskänsla.** Hårfina linjer i stället för inramade kort, ett enda mörkt element på Hem och tydlig hierarki.
5. **Fotografier sparsamt.** En plats på Hem. Fotografier representerar aldrig specifika grossistartiklar.
6. **Inga ritade blommor.** Sammansättningen visas som ett färgband med tal. Färgen i bandet är artikelns färg i prislistan.
7. **Mobil.** Fast prisfält med "Klart" längst ned, blomvalet som egen skärm, arrangemang som flikar överst, alla tryckytor minst 44 px.
8. **Funktionalitet bevarad.** Pris, moms, förpackningsberäkning, prisstatus (≈ och ✓) och sparstatus finns kvar. Sparstatus är bara en markering här, eftersom inget sparas.

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

Alla kontroller körs mot den riktiga prismotorn i riktig Chromium 141 (`verktyg/behave.mjs`, `verktyg/qa.mjs`). Verktygen behöver `playwright-core` och en Chromium (sökväg i `CHROMIUM_PATH`).

- **Beteende: 118 kontroller, 0 fel** (mobil och dator). Priserna efter varje ändring jämförs mot motorn körd i Node: plus och minus, tillägg från blomvalet, sök och filter, arbete (giltigt och ogiltigt värde), eget material, antal likadana, ny bukett (skapas först vid första blomman), borttagning i två steg, inköpsregeln 6/10/11 rosor, inköpsöversikten, och att inga konsolfel uppstår.
- **Layout:** inget sidledes överflöd och prisfältet inom bild vid 320, 360, 390, 768, 999, 1000, 1280, 1440 och 1920 px, för Hem, Bukettbyggare och Inköp. Blomvalet följer med när fönstret ändrar storlek mellan mobil och dator.
- **Tryckytor:** alla knappar och fält minst 44×44 px på mobil.
- **Typografi:** ingen text under 12 px, ingen skrifttjocklek under 400, ingen Bodoni under 20 px.
- **Kontrast (WCAG 2.x):** brödtext 15,2:1, dämpad text 8,6:1, etiketter 5,7:1, bronstext 5,7:1, ≈ 5,6:1, ✓ 6,8:1, fältkanter 3,5:1 eller mer, text på svart knapp 15,2:1. Uppmätt ur CSS-variablerna.
- **Tangentbord:** Tab genom Hem, synlig fokusring (3 px), blomvalet på mobil låser resten av sidan och Escape stänger det.
- **Robusthet:** fungerar utan Google Fonts och visar ett tydligt meddelande utan JavaScript.
- **Vikt:** cirka 223 KB HTML, CSS och JS (varav prismotorn 145 KB, ej minifierad) och inga bilder. Typsnitten hämtas separat.

**Inte verifierat:** riktiga telefoner (iOS och Android), Safari och Firefox, skärmläsare, högkontrastläge, utskrift, mörkt läge (finns inte i prototypen), att en florist provat den, och prestanda med stora jobb.

## Förhandsvisning (klickbar)

`index.html` går inte att öppna direkt på GitHub. Alternativ för en klickbar länk, som alla kräver ett beslut innan något publiceras:

1. **Ladda ner `maison-studio-enfil.html`** och öppna lokalt. Ingen publicering.
2. **GitHub Pages** för repot (ändrar repots inställningar och gör prototypen offentligt tillgänglig på en adress).
3. **Privat delbar sida i Claude** (publiceras som privat artefakt, delas bara på begäran).
4. **Tredjepartsvisare** som renderar filen från GitHub. Inget i repot ändras, men en utomstående tjänst läser filen.

## Filer

```
projects/buketraknare/prototyper/maison-studio/
├── README.md
├── index.html                  (öppna denna)
├── maison-studio-enfil.html    (samma sak i en enda fil)
├── css/studio.css
├── js/
│   ├── studio.js               (gränssnittet)
│   ├── studio-engine.js        (översätter motorns svar till skärmen, ingen egen räkning)
│   ├── studio-data.js          (påhittad testdata)
│   └── engine/                 (appens egen prismotor, oförändrade kopior)
├── skarmbilder/                (15 bilder, originalupplösning)
└── verktyg/                    (behave.mjs, qa.mjs, capture.mjs)
```

Mapp på GitHub: https://github.com/Annaholmstrompeter/Open-claw/tree/design-prototype/maison-studio-2026-10-08/projects/buketraknare/prototyper/maison-studio
