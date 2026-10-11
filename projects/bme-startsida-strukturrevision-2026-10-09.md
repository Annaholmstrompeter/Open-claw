# BME startsida — strukturrevision av inledningen (2026-10-09)

Status: **utkast, inget publicerat.** Tema: `Atelier – Rituals-stil (utveckling 2026-09-02)` (id `199116816758`, roll `UNPUBLISHED`).
Förhandsvisning: `https://9w0qpc-07.myshopify.com/?preview_theme_id=199116816758` — öppnad och verifierad (HTTP 200, ingen lösenordssida, visar utkastet).
ChatGPT är art director och granskar; inget mer byggs innan granskningen.

## Viktigast först

1. **Uppdatering (senare samma dag):** nätverksspärren lyftes av Anna. BONJIL är nu granskad på desktop (1440 px) och mobil (390 px) med riktiga skärmdumpar, och BME:s förhandsvisning är fotad på riktigt (inte bara lokala kontrollrenderingar). Se *BONJIL-granskning* och *Jämförelse* nedan.
2. Jag byggde strukturen **före** BONJIL-granskningen (den var spärrad), så proportionerna i bygget är mina egna val. Jämförelsen nedan visar var de avviker från BONJIL. **Inga proportionsändringar har gjorts efter granskningen** — de är förslag till art directorn.
3. **Befintliga header-fel i utkastet** (inte orsakade av detta arbete, se *Header-fynd*): kontoikonen ligger högre än sök/varukorg, och sökikonen syns inte på mobil (knappen finns och öppnar sökrutan).

## Ny ordning

Navigation → **Hero** → **The Experience** → **The Ritual** → **The Collection** → (BODY/MIND/EARTH dolda) → Science → Formula → World → Future → "Return to the ritual" (de sista fem oförändrade).

## Exakt vad som ändrats (endast utkastet)

| Fil / objekt | Ändring |
|---|---|
| `sections/bme-hero.liquid` | **Ny.** Hero med bildplats (desktop + valfri mobilbeskärning). |
| `sections/bme-experience.liquid` | **Ny.** The Experience, neutral bildplats märkt "Image pending". |
| `sections/bme-ritual-steps.liquid` | **Ny.** The Ritual med tre steg som block. |
| `snippets/bme-home-rituals.liquid` | Omarbetad: The Collection (ny rubrik, förenklade kort, ingrediensraden borttagen). Bilder, bildetiketter, länkar, färger oförändrade. |
| `templates/index.json` | Ny ordning; hero/ritual byter sektionstyp; ny sektion `scene_experience`; `scene3_portals` (BODY/MIND/EARTH) `disabled: true` (innehållet kvar). |
| `sections/header-group.json` | Enda ändringen: `menu` → `main-menu-bme-structure`. |
| Meny (butiksnivå) | **Ny** `main-menu-bme-structure` (id `gid://shopify/Menu/336723804534`). `main-menu` (live) och `main-menu-draft` är orörda. |
| `assets/backup-*-pre-structure-2026-10-09.txt` | Säkerhetskopior av index.json, bme-home-hero, bme-home-rituals, header-group. |

Orört: publicerat tema, produkter/produktdata, sidor, övriga sektioner, `snippets/bme-home-hero.liquid` (ligger kvar oanvänd), alla bilder/etiketter. Återställning: kopiera backupfilerna tillbaka med `themeFilesCopy` (index.json och header-group.json).

Verifiering: alla uppladdade filer jämförda med MD5 mot lokala versioner (identiska); Shopifys uppladdningsvalidering utan fel; Theme Check utan syntax-/schemafel (endast "saknad asset/orphan"-brus från minimal testtemakopia). **Efter att spärren lyftes, i den riktiga förhandsvisningen (Chromium):** sektionsordningen stämmer, menyn visar COLLECTION · THE RITUAL · OUR WORLD, ingen horisontell overflow vid 1440 och 390 px, hero-knapparna scrollar till rätt ankare (målet landar 16 px under headern), och produktkorten renderas med riktiga bilder. Konsolen visar bara Shopify-brus (502 från tredjepartstjänst, CSP-meddelande om `shop.app`, ett 403). I mina skärmdumpar är Shopifys förhandsfält och cookie-banner dolda (endast i bilderna).

## Knappdestinationer

| Element | Destination | Status |
|---|---|---|
| Hero: Discover the Ritual | `#the-ritual` (The Ritual-sektionen) | ok |
| Hero: Explore the Collection | `#collection` | ok |
| Nav: Collection | `/#collection` | ok |
| Nav: The Ritual | `/#the-ritual` | ok |
| Nav: Our World | `/pages/our-world` | finns, publicerad (sidkroppen säger "Content coming soon" men mallen har innehåll) |
| Nav: **Sanctuary** | — | **saknas, utelämnad** (se nedan) |
| Collection: Discover Presence/Luminance/Balance/Kindness/Serenity | `/products/body-lotion-raspberry`, `hand-cream-apricot`, `hand-wash-bergamot`, `body-wash-cherry`, `shampoo-macadamia` | alla ACTIVE |
| Nedre "SHOP THE RITUALS" (orörd) | `/#choose-your-ritual` | fungerar (ankaret finns kvar i Collection) |

## Funktionsluckor och öppna beslut

1. **Sanctuary saknar destination.** Ingen sida/samling heter Sanctuary. Kandidater: (a) de fem ritualsidorna "The Mindful Ritual – …" (nås idag via "Enter your sanctuary" på varje produktsida; ingen gemensam hubb), (b) Fristaden/QR-sidan (ej publicerad, utkast-PR #15), (c) ny sida. Jag skapade ingen tom sida och ingen död länk — posten är utelämnad ur menyn.
2. **Logotyp:** ingen logotypfil bland butikens filer (sökt på logo/BME/body; temats `logo`-inställning tom). Headern visar fortfarande namnet "BODY MIND EARTH" som text. Några småbilder (t.ex. 251×83 px) med generiska namn kan vara gamla logotyper men är inte verifierade — ingen använd. Originalfil behövs.
3. **Kundresa ≠ funktion (steg 02):** texten "select the short or extended version" stämmer inte med dagens ritualsida. Där finns ett guidat flöde per produkt (Scent → Touch → Feel → Affirmation, "Listen" per steg, valfria ljudreglage för vatten/musik/röst) men **inget val mellan kort och lång version**. **Ljudet är tillgängligt och fungerar:** jag öppnade alla fem ritualsidor i förhandsvisningen, tryckte *Listen* och rösten startade på alla fem (≈27 s per steg, HTTP 206, inga fel). Men det finns bara en inspelning per steg — inget kort/lång-val på någon sida, och ingen text om det. Sidans ljudremsa visar "PLAY MUSIC (SAMPLE)" (musiken är en ej godkänd sample). Texten i steg 02 är införd exakt som specificerad; ingen knapp till spelaren finns. Beslut: ändra texten, eller bygg kort/lång.
4. **"Open the accompanying ritual"** — från startsidan finns ingen direktlänk till ritualen; vägen är Collection → produktsida → "Enter your sanctuary".
5. **Sans-serif:** beskrivning/kontroller använder systemets sans-serif (ingen webbfont är laddad). Beslut: önskat varumärkes-sans?
6. **Hero-bildens alt-text** (oförändrad) säger "Generated mood image" — arbetsbild, ingen produkt; byt när riktig bild finns.
7. Ingrediens-/egenskapsraden ("Nourishing · Shea Butter & Jojoba") är borttagen från startsidans kort; samma rad finns redan på produktsidan (`bme-product`, kontrollerat i koden) — ingen produktdata ändrad.
8. Verifierat i riktig webbläsare: rubrikbrytningar med Cormorant (två rader i hero, Experience och Collection), headerns tre menyposter. Mobilmenyn (hamburger) öppnades inte.

## Bildbehov per sektion

| Sektion | Plats | Proportion / upplösning | Separat mobilbeskärning |
|---|---|---|---|
| Hero | Högerpanel, ~58 % av bredden, helhöjd (≈840×774 px vid 1440, ≈1050×800 vid 1920) | ca 6:5 (≈1,2:1); master **2400×2000 px**, JPG/WebP; motiv inom mittersta ~75 % (cover-beskärning, fokuspunkt kan sättas i temaredigeraren) | **Ja, 1:1, 1170×1170 px** (visas 390×390; på surfplatta tak 560 px höjd) |
| The Experience | Vänsterkolumn, ca 510 px bred vid 1440 | **4:5 stående, 1600×2000 px** | Valfri: 1:1 eller 4:5, 1170 px bred (visas ~342 px bred) |
| The Ritual | Ingen bild | — | — |
| The Collection | Befintliga 1122×1402 (4:5) | oförändrade | — |

Bildplatserna fylls i temaredigeraren (bildväljare) utan kodändring. Tills vidare: Hero visar den gamla arbetsbilden, Experience en neutral yta märkt "Image pending".

## BONJIL-granskning (desktop 1440 px och mobil 390 px, scrollad steg för steg)

Sidans längd: 10 862 px desktop, 11 576 px mobil. Cookie-banner avvisad (Reject) innan jag scrollade. Hero-bakgrunden är en film som min headless-webbläsare inte kan spela; jag hämtade filerna och tog stillbilder ur dem.

| Del | BONJIL (mätt) |
|---|---|
| Navigation | Desktop: tre textlänkar vänster (The Science, The Ritual, Shop), ordmärket centrerat, två konturknappar + Cart höger. Mobil: hamburger, ordmärke, väska. |
| Hero | **Helbredds-film**, ca 924 px hög (≈ hela skärmen) på desktop, 612 px på mobil. Separata filer: 16:9 (3840×2160) för desktop och 9:16 (1520×2704) för mobil. Mörk brun bas `#1C1100`. |
| Hero-text | Rubrik versaler, bred sans (Sweet Sans Pro), **54/65 px** desktop, **28/34 px** mobil, vänsterställd, ca 800 px bred. Två knappar 44 px höga, **0 radie** (en fylld grå, en kontur), sida vid sida på desktop, staplade på mobil (hugger sin egen bredd). Tunn linje + en rad beskrivning (15 px, ca 385 px bred) längst ned i heron. |
| Berättelsen | En sektion = en tanke. Mönster: liten versal etikett → rubrik (36/47 px desktop, 22/29 px mobil, versaler med en kursiv nyckelfras) → kort stödtext 15 px i en **smal kolumn** (164–420 px) som placeras asymmetriskt → bildrad → en avslutande rad → **en** konturknapp (44–50 px hög, 156–310 px bred; full bredd 360 px på mobil). |
| Rytm | Vertikal luft **90 px desktop / 60 px mobil**. Sektionerna växlar mörk (`#1C1100`) / vit / ljus, de flesta 830–1080 px höga på desktop. |
| Bildandel | Fyra stående bilder i rad (≈241×281, ca 6:7) med små etiketter; stort porträtt 600×666; produktbild 660×625; sinneskort 214×303 (karusell med prickar på mobil). |
| Övergången till ritualen | Sinneskorten (Sight, Scent, Touch, Taste, Sound, **The Ritual**) leder in i "BONJIL's Ritual in a Box": stor produktbild + tre numrerade rader med hårlinjer (etikett till vänster, beskrivning till höger) och en knapp "Experience The Ritual". |
| Upprepning | "Experience the Ritual" återkommer i nästan varje sektion. |

Det BONJIL gör tydligt: ett påstående per sektion, tre till fyra rader text, en handling, stora bilder. Det vi inte ska kopiera: deras påståenden om stress/kortisol, expertpåståenden, jämförelsetabellen och deras bilder/film.

## Jämförelse: mitt bygge mot BONJIL (förslag, ej genomförda)

| Mått | BME nu (verkligt render) | BONJIL | Förslag till art directorn |
|---|---|---|---|
| Hero | Delad layout, bild ≈ 58 % av bredden, 774 px (+102 px header ≈ första skärmen), ljus bas | Helbredds-bild/film med text ovanpå, ≈ 100 % av skärmen | Välj: behåll delad layout (läsbar text på ljus yta) eller helbredds-bild med textöverlägg. Delat är tryggare tills riktig produktbild finns. |
| Hero-rubrik | 70 px desktop / 43 px mobil, serif, meningsbokstäver, 2 rader | 54 px / 28 px versaler | Cormorant är smal och lätt; 70 px ser ungefär lika stor ut som 54 px i bred sans. Behåll, eller sänk till ~64 px. |
| Sektionsrubrik | 53 px desktop / 34 px mobil | 36 px / 22 px | Mina är ca 1,5× större. Kan sänkas till ~44 px / 28 px för lugnare skala. |
| Brödtext | 17–18 px, bredd 486–540 px (Ritual-stegen 374 px) | 15 px, smala kolumner 164–420 px | Mina är större och bredare (bättre läsbarhet). Kan smalnas till ~26em för mer luft. |
| Knappar | 54 px höga (247×54 hero), fylld plommon + textlänk | 44–50 px, konturknappar | Sänk till 48–50 px om du vill matcha. |
| Luft | 130–144 px desktop / 72–88 px mobil | 90 px / 60 px | Mina sektioner är ca 1,5× luftigare. Kan sänkas till ~100 px / 60 px. |
| Rytm | Alla ljusa toner (elfenben/sand), mörk först i Science | Växlar mörk/ljus hela vägen | Överväg ett mörkt band i inledningen (t.ex. The Ritual) för rytm. |
| Experience | En stor bildplats 4:5 + kort text | Bildrad med fyra stående bilder + etiketter | Alternativ: rad om tre till fyra mindre bilder i stället för en stor. |
| The Ritual | Tre steg i kolumner, ingen bild | Numrerade rader med hårlinjer + stor produktbild bredvid | Alternativ: lägg en bild bredvid stegen när bildmaterial finns. |
| Mobil hero | Bild 390×390 + text, hela heron 872 px | 612 px, text över film | Text över bild på mobil skulle korta ned heron. |
| CTA-upprepning | Endast hero + produktlänkar | CTA i varje sektion | Överväg en tydlig "Discover the Collection"-handling efter The Ritual. |

## Header-fynd (befintliga, ej orsakade av detta arbete)

Verifierat genom att tillfälligt lägga tillbaka den gamla header-konfigurationen (felen fanns kvar) och på orörda sidor (`/pages/our-world`). Min version återställdes direkt (exakt kopia). Publicerat tema och sandlådan visar **inte** felen.

1. **Kontoikonen** ligger ca 18 px högre än sök och varukorg (på mobil ovanför namnet): kontoknappen (44 px) ligger i ett 80 px högt block (`anchored-popover-component` / `dialog-component`) som inte centreras vertikalt.
2. **Sökikonen syns inte på mobil:** knappen finns och öppnar sökrutan, men `svg-wrapper` har bredd 0 (0×44 px). På desktop syns sök. Berör kravet "behåll fungerande sök": funktionen finns, men mobilanvändare ser ingen ikon.
3. `/cart` visar kontoikonen rätt, så felet följer sidmallen/headern på innehållssidor.
Åtgärd (ej utförd, utanför omgången): liten CSS-rättning i headern — be om klartecken.

## Bilagor

- BONJIL (riktiga skärmdumpar, desktop 1440 och mobil 390): kontaktblad över hela scrollen + hero, berättelse, sinneskort, "Ritual in a Box", samt stillbilder ur hero-filmerna. Endast intern referens.
- BME förhandsvisning (riktig, utkastet): desktop 1440 och mobil 390, helsida + hero, experience, ritual, collection; header-fynd.
- Tidigare lokala kontrollrenderingar finns kvar i samtalet men ersätts av de riktiga bilderna.
