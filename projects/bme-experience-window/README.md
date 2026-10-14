# BME: The Experience, block B, "Five Films" (v47 karusell, 2026-10-13)

Status: **byggd i utvecklingstemat, inget publicerat.** Tema: `Atelier – Rituals-stil (utveckling 2026-09-02)` (id `199116816758`, roll `UNPUBLISHED`).
Förhandsvisning: `https://9w0qpc-07.myshopify.com/?preview_theme_id=199116816758`, sektionen `#the-experience`.

Copyn är **låst och oförändrad** (block B). Det som gjorts är formatering.

## Vägen hit (Annas omdömen i ordning)

| Version | Vad | Annas omdöme |
|---|---|---|
| v43 | Foto vänster, text höger | "flera typsnitt, inga arty coola take, bilden för snäll" |
| v44 | Mörk fastnålad scroll-berättelse med ljusfält (canvas) | "wow, bra" men "för mörkt, lite för stor text, går inte att scrolla (texten ska flyttas med först), jag vill ha färg och rörlig bild som lyfter, sensuella material, orden i bilderna" |
| v45 | Fem smala valv i rad med stockvideo | "det här ser konstigt ut, det passar inte … du måste hitta ett annat sätt att presentera bildvideo" |
| v46 | Fem filmkapitel under varandra i vanlig scroll | "Det där kan du vara nöjd med … spara detta" men "det fanns lite fel" (rättat i v46b, se nedan) |
| **v47** | **Samma filmer som en karusell** | Anna: "Sätt bilderna som en karusell istället för under varandra" (väntar på omdöme) |

Varför v45 föll (mina egna ord, utan försvar): fem smala valv bredvid varandra läses som **färgprov**, inte som film. Klippen hade olika färgvärldar (senapsgul rök, orange stockring, blågrön vatten, olivgrön mossa), så raden såg billig ut. Fem saker att visa samtidigt tar ifrån varje bild dess verkan. Valvformen i klunga lånade dessutom kyrkfönster.

## v47: karusell i stället för under varandra (Annas önskemål)

> "Sätt bilderna som en karusell istället för under varandra"

Samma fem filmer, samma ord och samma gradering, men i ett **horisontellt spår, en film i taget i mitten, grannfilmerna tittar fram vid kanterna**. Sidan scrollar fortfarande helt vanligt uppåt och nedåt (inget fångas, testat med riktiga touch-svep).

- **Fönstret** (varumärkets metafor) följer svepet: filmen i mitten är helt öppen, grannarna är lite lägre och dämpade, och mitt i ett svep är två fönster halvöppna. Orden tonar fram bokstav för bokstav när en film blir aktiv.
- **Styrning i en egen rad under filmerna** (ingenting ligger över bilden): räknare `01 / 05`, ett streck i fem delar som fylls, pil bakåt, pil framåt och paus. Raden är lika bred som filmen i mitten. Därmed är krocken mellan pausknapp och ord borta.
- **Sätt att styra**: svep (snäpper alltid till en film, aldrig fler än en per svep), pilknappar, tangentbord (pilar, Home, End när spåret har fokus), klick på grannfilmen, klick på strecket. Ingen automatisk växling (lugnare, och inget som tar kontrollen).
- **Uppspelning**: bara aktiv film och en granne spelar (max två); aktiv + grannar förladdas, övriga släpps ur minnet efter 8 s. Pausknappen och `prefers-reduced-motion`/data saver som förut.
- **Tillgänglighet**: spåret är en `region` med `aria-roledescription="carousel"`, varje film en `slide` ("2 of 5"), en dold `aria-live`-rad säger "Moment 2 of 5: Scent. Evoke." när man byter. Knappar 44 px med `aria-label`.
- **Utan JS**: karusellen går ändå att svepa (CSS scroll-snap), affischer och alla ord syns, kontrollraden döljs. **Reducerad rörelse**: alla filmer helt öppna, ingen autoplay, play-knapp.
- **Mobil**: film 82 % av bredden (4:5, 3:4-filmerna), nästa tittar fram, strecket ovanför räknare och knappar.
- Filmernas ordning och lägen: samma som förut (nere vänster, uppe vänster, nere höger, uppe höger, nere mitt). Alla filmer är nu 16:10 på desktop (inte bara de tre första).
- Version v46b (under varandra) är sparad: `assets/backup-bme-experience-v46b-2026-10-13.txt` (+ css, js-1) och i git (commit `7910b6a`). v47: `assets/backup-…-v47-carousel-2026-10-13.txt`.

**Mätt i riktiga förhandsvisningen (11 skärmar 320–2560, `lab/audit2.mjs`)**: aktiv film alltid centrerad (±3 px), text inom filmen, grannen syns (≥24 px) på desktop, pilarna ≥44 px och överlappar inte, aldrig fler än två spelande, aktiv film spelar, ingen sidledsscroll på sidan, inga sidfel. Touch (dispatchade touchhändelser): svep byter film, lodrätt svep över filmerna scrollar sidan.

**Vet inte / inte testat**: riktiga telefoner (fingerfart/tröghet), Safari/Firefox, riktig H.264 (headless använder VP9-kopior). Muspekare kan inte dra filmerna (pilar, tangentbord, klick och styrplatta/shift+hjul fungerar).

## Rättningar samma kväll (v46b): Annas "det fanns lite fel"

Anna sa att det fanns lite fel (utan att peka ut vilka). Granskat och rättat av mig, utan att hon behövde leda:

| Fel | Rättat |
|---|---|
| **Copyn på sidan sa "Anchor. Associate."** men det låsta dokumentet (Annas rättelse) säger **"Anchor. Direct."** | `templates/index.json` i utkastet ändrat (en rad). Skrevs via `themeFilesUpsert` med `body.type: URL` (se skillen). Shopify minifierade filen och tog bort två föräldralösa v43-inställningar (`autoplay`, `seconds`); i övrigt identisk, verifierad strukturellt. Backuper: `assets/backup-index-before-direct-…` (före) och `…-after-direct-…`/`…-v46b-direct-…` (efter) |
| Pausknappen låg ovanpå orden ("Amplify.") på alla bredder | Rund ikonknapp (44 px) vid mitten av högerkanten som tonar bort när den skulle ligga över text, nåbar med tangentbord (Tab, Enter/mellanslag) |
| `play()` som avbröts (snabb scroll, långsamt nät) pausade ALLA filmer och visade "Play films" | Bara `NotAllowedError` (autoplay blockerad) pausar nu. Testat med alla tre feltyper |
| Guldtexten hade kontrast 4,09:1 (under 4,5 för liten text) | Guld `#7d6338` = 4,89:1 |
| Tomma rader i paret-blocket gav tomma kapitel; rad 6+ gav en tom ruta | Tomma rader hoppas över (numreringen fortsätter 01, 02 …), rad 6+ utan egen film visas som ren text |
| Tredje inledande textblocket bröts ord för ord | Egen bredd |
| Ord kunde brytas mitt i på smala skärmar | Ord hålls ihop (bokstäverna delas inom ord) |
| Reducerad rörelse efterlevdes delvis (orden drev, spärren rörde sig) | Helt stilla |
| Filmer släpptes aldrig ur minnet; gamla lyssnare hopade sig i temaredigeraren | Filmer släpps efter 8 s utom räckhåll; rensning vid `shopify:section:unload` och omrendering |
| Scroll läste och skrev layout om vartannat | Alla mätningar först, sedan alla skrivningar |
| Attribut skrevs utan `escape`; vald egen film visade standardfilmens platshållare | Åtgärdat |

**Mätt (riktiga förhandsvisningen, 11 skärmar 320–2560 px, `lab/audit.mjs`)**: inga överlapp mellan pausknapp och text, ingen text utanför filmen, ingen sidledsscroll, inga sidfel, max två filmer samtidigt. H.264 High yuv420p faststart på alla 10 videor, loopsömmar högst 1,4× ett normalt bildruteskifte.

## Konceptet (v46, orden/graderingen/materialen gäller fortfarande; layouten är sedan v47 en karusell)

**En film i taget, stor, i vanlig scroll (inget fastnålat).** Varje ögonblick är ett kapitel:

- Filmen **kommer in som en smal springa och öppnas till full bredd när den rör sig upp i bild**. Det är "the window" (varumärkets egen metafor) som görs med scrollen, inte en dekor. Anchor (femte) öppnas i höjdled i stället.
- **Orden ligger inne i filmen**, små och vida: `01 ——` / `BREATHE.` (versaler, spärrade) / *Regulate.* (kursiv, ca 45 px). Bokstäverna tonar fram ur oskärpa, en och en. Spärren på sense-ordet vidgas långsamt medan man scrollar genom filmen (ordet "andas"). Läget växlar per kapitel (nere vänster, uppe vänster, nere höger, uppe höger, nere mitt) så att sidan inte blir en mall.
- **En guldtråd** (1 px) binder ihop kapitlen och ritas med scrollen: det som tänds tillsammans kopplas ihop (Hebb), som i v44 men i tystare form.
- **Rytm**: full bredd, höger-inskjuten, vänster-inskjuten, full bredd, smal och rak (Anchor). Mobil: alla fullbredd, 4:5.
- **Ett enda typsnitt** (temats Cormorant, en vikt), hierarki med skala, kursiv, versaler, guld. Ljus ivory-sida (`#f3eee3`), grön-svart text (`#1c2320`), guld (`#8a6f43`). Inget mörkt band.
- **En gradering över alla fem filmer** (viktigast): lyfta svärtor, mjuka högdagrar (max ~95 %), dämpad mättnad, varm pärlton. Satin/gardin = salvia + elfenben, rök = taupe, mossa = dämpad grön, vatten = rosa pärlskymning, trä = grågrått ljus.

| # | Ord (copy) | Film (Pexels, licens: fri kommersiell, ingen attribuering) | Layout | Textfärg |
|---|---|---|---|---|
| 1 | Breathe. Regulate. | 38675645, vindrörda lingardiner i fönster (4K) | full bredd, nere vänster | mörk |
| 2 | Scent. Evoke. | 7302972, rök | höger-inskjuten, uppe vänster | mörk |
| 3 | Touch. Embody. | 3224617, mossa i närbild | vänster-inskjuten, nere höger | ljus |
| 4 | Feel. Amplify. | 856327, stilla vatten i skymning | full bredd, uppe höger | mörk |
| 5 | Anchor. Associate. (se öppna punkter) | 8553230, träskiva med spricka | smal 4:5, nere mitt | ljus |

**Allt detta är stockfilm = platshållare.** Den riktiga lösningen är egna klipp (Flow, skillen `reklamfilm-regissor`, med prompter) som Anna lägger in via videoväljaren per ögonblick. Stocken är vald för att visa riktningen och för att vara en hederlig reserv.

## Filer (kopior i `theme/`, originalen ligger i Shopify)

| Fil i temat | Innehåll |
|---|---|
| `sections/bme-experience.liquid` | Markup + schema (v47). Samma filnamn, samma inställnings-id och blocktyp `panel` som v43/v44 → `templates/index.json` är orörd (kontrollsumma identisk) |
| `snippets/bme-window-css.liquid` | All CSS |
| `snippets/bme-window-js-1.liquid` | All JS (ett `<script>`) |
| `snippets/bme-window-em.liquid` | Hjälpare: guldkursiv på fraserna i inställningen "Words in italic gold" |
| `snippets/bme-window-js-2.liquid` | **Oanvänd stub** sedan v46 (kan raderas i Edit code; verktyget får inte radera) |
| `sections/bme-window.liquid` | Oanvänd stub sedan v44 (radera i admin) |
| `assets/backup-bme-experience-v43-2026-10-13.txt` | v43 före bytet. v44 finns i git: `git show 2fe1618:projects/bme-experience-window/theme/…` |
| `assets/backup-bme-experience-v46-2026-10-13.txt` (+ `…-window-css-…`, `…-window-js-1-…`, `…-window-em-…`) | **Sparad version v46 (Annas "det där kan du vara nöjd med", 13 okt).** Återställ med `themeFilesCopy` tillbaka till `sections/bme-experience.liquid` och `snippets/bme-window-*.liquid`. I git: commit `79b1723` (`git show 79b1723:projects/bme-experience-window/theme/sections/bme-experience.liquid`) |

**Filmerna ligger i Shopify → Innehåll → Filer** (CDN), 10 videor + 10 affischer (`bme-film-N-wide|tall.mp4|jpg`, N = 1–5). Videorna är H.264 faststart utan ljud, 16:10 1600×1000 (desktop) och 3:4 900×1200 (mobil, och Anchor på desktop): 0,3–3,0 MB styck, totalt ca 14 MB men bara de som är nära bild laddas. De är sömlösa loopar (1,2 s tvärtoning inbakad). Affischerna (JPEG, 16–155 kB) visas före filmen, utan JavaScript och vid reducerad rörelse.

`films/make-films.sh` återskapar alla 20 filer från Pexels-originalen (8 av 10 videor blir byte-identiska; Anchor skiljer några kB).

## Redigera i temaredigeraren (utan kod)

- Texter: eyebrow, rubrik, introrad, slutrad. **Words in italic gold** (en fras per rad, exakt träff).
- Panelernas text: blocket med flera rader = de fem paren ("Ord. Verb." per rad).
- **Per ögonblick (1–5)**: *Film (replaces the default)* = Shopifys videoväljare (egen film ersätter stocken, används då för både desktop och mobil), och *Words* = mörk/ljus textfärg (mörk på ljus film, ljus på mörk film).
- *Default films: file name prefix*: ändra inte.
- Fler än fem rader i paret-blocket: ögonblick 6+ får ingen film om ingen video läggs in.

## Tillgänglighet och prestanda

- Filmerna är `muted loop playsinline`, aria-hidden. Spelas **bara när de syns**, max två samtidigt (de som ligger närmast skärmens mitt). Laddas först när de är nära (60 % av skärmen).
- **Pausknapp** (rund ikon i kontrollraden under karusellen, "Pause films"/"Play films" som aria-label). Vid reducerad rörelse och vid "data saver" startar ingen film av sig själv.
- Ord delas i bokstäver med JS; skärmläsare får vanlig text (dold kopia). Utan JS: statiska affischer, alla ord synliga.
- Ingen scroll-kapning, inget fastnålat, inga bibliotek.

## Verifierat (2026-10-13)

- **Testbänk** (liquidjs + Chromium, desktop 1440, 1920, 1024, mobil 390, reducerad rörelse, utan JS): layout, öppning, bokstavsreveal, tråd, pausknapp, max två filmer spelar.
- **Riktig förhandsvisning** (utkast-temat, desktop 1440 och mobil 390): sektionen laddas, `Cormorant` överallt, rubrik 68 px / 34 px, inga horisontella scrollbalkar, 72 bokstäver, 5 videor kopplade, inga sidfel (i konsolen bara Shopifys eget brus: `shop.app` 403/ram och en 404 som fanns innan).
- **Kontrollsummor (MD5)**: CSS, JS och sektion stämmer mot lokala kopior. Alla 10 videor på CDN är byte-identiska med de lokala. `index.json` orörd.
- **OBS filmerna i skärmdumparna**: headless Chromium saknar H.264. I testet (`lab/live.mjs`) byts CDN-filerna mot VP9-kopior av samma klipp. **Att just H.264-filerna spelar i Chrome/Safari/Firefox med riktig dekoder är därför inte sett med egna ögon här.** H.264 + faststart + `playsinline` är standard och bör fungera, men Anna bör titta på en riktig enhet.

## Inte testat

Riktiga telefoner (iOS lågenergiläge stoppar autoplay: då syns affischen och knappen står på "Play films"), Safari, Firefox, långsamt nät. Prestanda på äldre mobiler.

## Öppna punkter / vet inte

1. **Stockfilm är en stand-in.** Världsklass = egna klipp (Flow). Annas nästa beslut: vill hon ha Flow-prompter per ögonblick (i skillens format) eller godkänner hon riktningen med stocken först?
2. ~~Copyrättelse ej införd~~ **Införd i utkastet 13 okt kväll** ("Anchor. Direct."). Gäller bara utkast-temat; när temat publiceras följer den med.
3. **De fem boxarna** (01 BREATHE … 06 THE RITUAL, version 3 i copy-dokumentet) ingår inte.
4. Ingen film har egen ton i ljud (tyst, med flit).
5. Shopifys förhandsgranskningsrad täcker ca 65 px längst ned i skärmdumpar av utkastet, inte på riktiga sajten.
6. Befintligt headerfel (kontoikonen högre än sök/varukorg), se `projects/bme-startsida-strukturrevision-2026-10-09.md`.

## Testbänk (lokalt)

```
cd projects/bme-experience-window/lab
npm i liquidjs playwright            # första gången
bash make-test-media.sh              # hämtar filmerna från CDN och gör VP9-kopior (bara för testet; headless saknar H.264)
node build.mjs                       # renderar sektionen med riktig Liquid + temats Cormorant -> page.html (STRESS=1 -> page-stress.html: tomma rader, rad 6-7, tredje inledande block)
python3 -m http.server 8765 --bind 127.0.0.1 &
node carousel.mjs 1440 900 c full http://127.0.0.1:8765/page.html   # pilar, tangentbord, snap, klick på granne, paus, mitt-i-svep; även 390 844 m full. Lägen: rm (reducerad rörelse), nojs
node errtest.mjs                     # hur spelaren reagerar på AbortError / NotAllowedError / NotSupportedError
node audit2.mjs                      # RIKTIGA förhandsvisningen i 11 skärmstorlekar (kräver HTTPS_PROXY i molnet; ONLY=390x844 för en)
node touch2.mjs                      # riktiga touch-händelser: sidledssvep byter film, lodrätt svep scrollar sidan
node live.mjs 1440 900 live-d tour   # skärmdumpar från den riktiga förhandsvisningen med filmer inmatade som blobbar
```

Shopifys fasta utkastrad (en iframe längst ner, ca 68 px) täcker knappar på låga skärmar i förhandsvisningen; den finns inte på riktiga sajten. Ta bort den i mätskript (`iframe` i en `position:fixed`-förälder), annars scrollar Playwright sidan när den klickar.
