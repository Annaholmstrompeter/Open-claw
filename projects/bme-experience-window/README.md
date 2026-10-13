# BME — The Experience, block B: "The Window" (2026-10-13)

Status: **byggt i utvecklingstemat, inget publicerat.** Tema: `Atelier – Rituals-stil (utveckling 2026-09-02)` (id `199116816758`, roll `UNPUBLISHED`).
Förhandsvisning: `https://9w0qpc-07.myshopify.com/?preview_theme_id=199116816758`, sektionen `#the-experience`.

## Varför det gjordes om

Anna jämförde v43 mot BONJIL ("Ritual in a Box") och bedömde att vår inte höll måttet. Hennes kritik, och vad som låg bakom den i koden:

| Annas kritik | Orsak i v43 |
|---|---|
| "Flera olika typsnitt" | Cormorant (rubriker) + kursiv Cormorant + systemets sans-serif (`system-ui`) för brödtext, etikett och bildtext |
| "Inga arty coola take" | Foto vänster, text höger i två kolumner: standardlayout |
| "Bilden är för snäll" | Stockig stillbild av kvinna med AirPod som luktar på handen |

## Vad det är nu

Copyn är **oförändrad** (låst block B). Bilden är inte ett foto utan ett **valv** ("fönstret") med ett levande ljusfält. Scrollen går genom de fem ögonblicken; varje ögonblick ändrar fältet och tänder en nod, och en tråd ritas mellan noderna: *det som tänds tillsammans kopplas ihop* (Hebb). Fönstret vidgas för varje ögonblick och öppnas till full bredd på slutraden *"We call it the window, and the ritual is how we open it."*

| Scroll | Text | Ljusfältet |
|---|---|---|
| Intro | Eyebrow, rubrik (andra raden i guldkursiv), "The brain can change its own biology…" | (rullar förbi normalt, ingen fästning) |
| 1 | Not every moment matters *equally.* | Likvärdigt, dämpat flöde: inget ögonblick väger mer |
| 2 | Under the right conditions… | Uppmärksamheten samlas vid första noden |
| 3 | Breathe. Regulate. | Ringar som andas (10 s, ca sex andetag per minut) |
| 4 | Scent. Evoke. | Gyllene strängar som stiger |
| 5 | Touch. Embody. | Virvel som ett fingeravtryck (långsam, jämn rörelse) |
| 6 | Feel. Amplify. | Koppar-glöd som dras in mot en punkt |
| 7 | Anchor. Associate. | Alla fem noder kopplas ihop till en enda tråd uppåt |
| 8 | Five moments. *One direction.* A mind… | Tråden pulserar uppåt |
| 9 | It may look like magic… | Fönstret öppnas helt, texten ligger över |

Designregler som gäller (se även `skills/webbdesign-varldsklass/SKILL.md`): **ett enda typsnitt** (temats Cormorant, en vikt; hierarki med skala, kursiv, versaler och guld), **mörkt band** för rytm (temats egen grön-svart `#0a0e0c` + guld `#c4a268`), inga extra färger, inget scroll-kapande (vanlig sticky), fullt fungerande reservläge.

## Filer (kopior i `theme/`, originalen ligger i Shopify)

| Fil i temat | Innehåll |
|---|---|
| `sections/bme-experience.liquid` | Markup + schema. **Ersatte v43 på plats**: samma filnamn, samma inställnings-id, samma blocktyp `panel` → `templates/index.json` är orörd |
| `snippets/bme-window-css.liquid` | All CSS |
| `snippets/bme-window-em.liquid` | Liten hjälpare: lägger guldkursiv på fraserna i inställningen "Words in italic gold" |
| `snippets/bme-window-js-1.liquid` + `-js-2.liquid` | Ett enda `<script>`, delat i två för att varje fil ska rymmas under Shopifys gräns på 16 384 tecken per GraphQL-dokument |
| `sections/bme-window.liquid` | **Tom stub** ("UNUSED - delete me"). Radering av temafiler blockeras av verktyget. Ta bort i Shopify admin → Edit code |
| `assets/backup-bme-experience-v43-2026-10-13.txt` | v43 före bytet |
| `assets/backup-index-pre-window-2026-10-13.txt` | index.json före bytet (index.json ändrades ändå inte, kontrollsumman är identisk) |

## Backa till v43

`themeFilesCopy`: `assets/backup-bme-experience-v43-2026-10-13.txt` → `sections/bme-experience.liquid` (eller kopiera in texten i Edit code).

## Redigera i temaredigeraren (utan kod)

- **Words in italic gold** (en fras per rad, exakt träff): standard `THE FEELING DEEPENS`, `equally.`, `One direction.`. Gäller rubrik, paneler och slutrad. Texten i `index.json` ändrades inte.
- **Scroll length per step** (30–90 vh, standard 48): hur lång berättelsen blir. Standard ≈ 5 skärmhöjder totalt.
- **Image inside the window**: valfri bild i valvet (se nästa avsnitt).
- Panelernas text: blocket med flera rader = de fem paren (ett par per rad, "Ord. Verb.").

## Vill du ha en bild i valvet? Prompter till ChatGPT eller Gemini

Bilden läggs **under** ljuslinjerna med blandningsläget *screen*, så den ska ha **äkta svart bakgrund** (svart blir genomskinligt, ljus blir ljus). Stående 3:4, minst 1200 × 1600 px, **inga ansikten, ingen text, ingen logotyp, inget vattenmärke**. Ladda upp i Shopify: Anpassa → The Experience → "Image inside the window". Prova gärna 3–4 varianter och välj efter ögat. Behåll gärna ingen bild alls: ljusfältet står på egna ben.

Gemensamt tillägg till varje prompt: *"Photorealistic, ultra-detailed, shot on a macro lens, true black background (#000000), no text, no logo, no watermark, no face, 3:4 portrait."*

1. **Fingertoppen blir nervbana (Touch).** "Extreme macro of a single fingertip pressing lightly into a bead of white cream on black. The fingerprint ridges turn into glowing rose-gold filaments that branch and fork like neurons and dendrites, fading into darkness. Warm rim light, shallow depth of field, tiny floating sparks of light."
2. **Fem punkter som tänds ihop (Hebb).** "Hundreds of ultra-fine golden threads in total darkness, converging into five glowing nodes that are joined by one luminous line rising upward, like neurons firing together. Looks like ink dispersing in water, long exposure, soft bokeh sparks, warm champagne-gold light."
3. **Doften som arkitektur (Scent).** "A slow plume of golden vapour rising from a single point in total darkness and curling into the shape of a tall arched doorway, lit from within, like long-exposure smoke photography, high-end perfumery campaign, champagne and amber tones."
4. **Händer som håller ljus (om du vill ha något mänskligt).** "Two bare hands cupped together as if holding water, shot from the side in total darkness. From the palms rise thousands of fine golden filaments like a fibre-optic fountain, thin rim light on the knuckles, no jewellery, no face."

## Verifierat

- **Riktig förhandsvisning (Chromium, desktop 1440×900 och mobil 390×844):** sticky fungerar (inga överflödande förfäder), temats header (102 px / 80 px), Cormorant överallt i sektionen, hela berättelsen, inga sidfel. I konsolen finns bara Shopifys eget brus (shop.app-ram, en 403 och en 404 som fanns innan).
- **Reservlägen (testbänken):** reducerad rörelse och utan JavaScript ger vanlig staplad layout, all copy synlig, valvet med en stilla bild.
- **Kontrollsummor (MD5)** för alla uppladdade filer stämmer mot lokala kopior (index.json identisk med backupen).
- **Prestanda:** ca 1 ms per bildruta för partiklar och ritning i headless-Chromium (1000 partiklar desktop, 560 mobil). Sänker partikelantalet automatiskt om bildrutorna blir långsamma. **Inte testat** på riktiga telefoner, Safari eller Firefox.
- Interaktion: musen virvlar i fältet på desktop (inte på touch).

## Öppna punkter / vet inte

1. Bedöms på riktiga enheter: långsam mobil och Safari.
2. **De fem boxarna** (01 BREATHE … 05 ANCHOR, utkast i copy-dokumentet) ingår inte. Scenen har plats för dem som nästa steg, t.ex. att varje rad fälls ut när dess ögonblick är aktivt. Beslut behövs.
3. Längden på scroll: ca 5 skärmhöjder. Kortare = sänk "Scroll length per step".
4. Shopifys egen förhandsgranskningsrad täcker ca 65 px längst ned i skärmdumpar av utkastet, inte på den riktiga sajten.
5. Befintligt headerfel (kontoikonen högre än sök/varukorg) är oförändrat, se `projects/bme-startsida-strukturrevision-2026-10-09.md`.

## Testbänk (lokalt)

```
cd projects/bme-experience-window/lab
npm i liquidjs playwright     # första gången
node build.mjs                # renderar sektionen med riktig Liquid + temats Cormorant
node shoot.mjs 1440 900 d 0,0.3,0.6,1        # skärmdumpar i lab/shots/ (CHROMIUM=/sökväg om webbläsaren inte hittas)
node shoot.mjs 390 844 m 0,0.3,0.6,1         # mobil
node shoot.mjs 1440 900 r 0.6 1              # reducerad rörelse
```
