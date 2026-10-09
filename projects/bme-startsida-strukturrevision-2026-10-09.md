# BME startsida — strukturrevision av inledningen (2026-10-09)

Status: **utkast, inget publicerat.** Tema: `Atelier – Rituals-stil (utveckling 2026-09-02)` (id `199116816758`, roll `UNPUBLISHED`).
Förhandsvisning: `https://9w0qpc-07.myshopify.com/?preview_theme_id=199116816758` (ej öppnad av mig — butiken är spärrad i molnmiljön; kräver ev. butikslösenord).
ChatGPT är art director och granskar; inget mer byggs innan granskningen.

## Viktigast först

1. **BONJIL-granskningen är inte gjord.** `bonjil.com` blockeras av miljöns nätverksproxy (WebFetch: `EGRESS_BLOCKED`, curl: 403). Inga BONJIL-skärmdumpar finns, och jag har inte hittat på några. Alla proportioner (bildandel, rubrikstorlek, textbredd, luft, knappplacering) är mina egna redaktionella val utifrån briefen och BME:s befintliga uttryck, **inte** härledda från BONJIL — behandla dem som preliminära.
2. **Riktiga förhandsskärmdumpar av BME saknas** av samma orsak (`*.myshopify.com`, `cdn.shopify.com` spärrade). Bifogade bilder är *lokala kontrollrenderingar* av exakt den uppladdade koden med de riktiga temabilderna, men utan Shopifys header/tema-CSS och med systemets sans-serif.
3. För att låsa upp: tillåt `bonjil.com`, `9w0qpc-07.myshopify.com`, `cdn.shopify.com` och `fonts.shopifycdn.com` under miljöns *Network access → Allowed domains*. Då kan BONJIL granskas och riktiga skärmdumpar tas, och proportionerna justeras.

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

Verifiering: alla fem uppladdade filer jämförda med MD5 mot lokala versioner (identiska); Shopifys uppladdningsvalidering utan fel; Theme Check utan syntax-/schemafel (endast "saknad asset/orphan"-brus från minimal testtemakopia); lokal rendering utan horisontell overflow vid 320/390/768/1024/1200/1440/1920 px.

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
3. **Kundresa ≠ funktion (steg 02):** texten "select the short or extended version" stämmer inte med dagens ritualsida. Där finns ett guidat flöde per produkt (Scent → Touch → Feel → Affirmation, "Listen" per steg, valfria ljudreglage för vatten/musik/röst) men **inget val mellan kort och lång version**. Ljudfilerna (v32, fyra steg × fem produkter + välkomstljud) finns i temat och spelaren är kopplad för alla fem produkter — jag har inte kunnat provspela (butiken spärrad). Musikspåret är i koden märkt som ej godkänd *sample*. Texten är införd exakt som specificerad; ingen knapp till spelaren finns. Beslut: ändra texten, eller bygg kort/lång.
4. **"Open the accompanying ritual"** — från startsidan finns ingen direktlänk till ritualen; vägen är Collection → produktsida → "Enter your sanctuary".
5. **Sans-serif:** beskrivning/kontroller använder systemets sans-serif (ingen webbfont är laddad). Beslut: önskat varumärkes-sans?
6. **Hero-bildens alt-text** (oförändrad) säger "Generated mood image" — arbetsbild, ingen produkt; byt när riktig bild finns.
7. Ingrediens-/egenskapsraden ("Nourishing · Shea Butter & Jojoba") är borttagen från startsidans kort; samma rad finns redan på produktsidan (`bme-product`, kontrollerat i koden) — ingen produktdata ändrad.
8. Ej verifierat i riktig webbläsare: rubrikbrytningar med Cormorant, headerns tre menyposter, mobilmeny.

## Bildbehov per sektion

| Sektion | Plats | Proportion / upplösning | Separat mobilbeskärning |
|---|---|---|---|
| Hero | Högerpanel, ~58 % av bredden, helhöjd (≈840×774 px vid 1440, ≈1050×800 vid 1920) | ca 6:5 (≈1,2:1); master **2400×2000 px**, JPG/WebP; motiv inom mittersta ~75 % (cover-beskärning, fokuspunkt kan sättas i temaredigeraren) | **Ja, 1:1, 1170×1170 px** (visas 390×390; på surfplatta tak 560 px höjd) |
| The Experience | Vänsterkolumn, ca 510 px bred vid 1440 | **4:5 stående, 1600×2000 px** | Valfri: 1:1 eller 4:5, 1170 px bred (visas ~342 px bred) |
| The Ritual | Ingen bild | — | — |
| The Collection | Befintliga 1122×1402 (4:5) | oförändrade | — |

Bildplatserna fylls i temaredigeraren (bildväljare) utan kodändring. Tills vidare: Hero visar den gamla arbetsbilden, Experience en neutral yta märkt "Image pending".

## Bilagor

Lokala kontrollrenderingar (inte Shopify-förhandsvisning): desktop 1440 och mobil 390, helsida och per sektion (hero, experience, ritual, collection).
