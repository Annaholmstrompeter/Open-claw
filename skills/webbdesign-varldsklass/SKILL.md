---
name: webbdesign-varldsklass
description: "Playbook för att bygga hemsidesektioner i världsklass (Body Mind Earth, Shopify/Liquid). Använd när Anna ber om att göra en sida eller sektion bättre, 'hetare', mer nyskapande, eller när något jämförs mot en förebild som BONJIL. Innehåller arbetssätt, designregler, och fällor i Shopify-verktygen."
---

# Webbdesign i världsklass: så jobbar vi

Skapad 2026-10-13 efter att Anna underkände v43 av The Experience ("flera typsnitt, inga arty coola take, bilden för snäll"). Exemplet som lärdes av: `projects/bme-experience-window/`.

## Arbetssätt (i den här ordningen)

1. **Ta en riktig baslinje.** Skärmdump av nuläget (desktop + mobil) från den riktiga förhandsvisningen, inte från minnet. Läs koden bakom: oftast förklarar den kritiken ("flera typsnitt" = ett `font-family: system-ui` som någon lagt till).
2. **Säg problemet med vanliga ord, utan försvar.** Annas ögon har rätt. Bedöm mot förebilden på riktigt: vad gör den bättre?
3. **Koncept före pixlar.** En stor idé som kommer ur varumärkets mening, inte ur en layoutmall. Här: Hebb ("det som tänds tillsammans kopplas ihop") + "the window". Frågan är alltid: *vad är sektionens enda mening, och hur kan formen bära den?*
4. **Bilden behöver inte vara ett foto.** Generativ/kod-konst (canvas, SVG), typografi som bild, eller en tydligt art-directad AI-bild (ge Anna färdiga prompter till ChatGPT/Gemini, med äkta svart bakgrund, 3:4, utan ansikten/text). Stockiga porträtt av någon som blundar är "snällt".
5. **Bygg i en lokal testbänk** med riktig Liquid-motor (liquidjs), temats typsnitt och en fejkad sticky header. Ta skärmdumpar på flera lägen i berättelsen. Kontaktblad (PIL) gör att du ser sekvensen i ett svep. `projects/bme-experience-window/lab/` fungerar som den är.
6. **Kolla alltid**: desktop 1440, mobil 390, reducerad rörelse, utan JavaScript, snabb scroll (hopp), resize.
7. **Ladda bara upp till utkastet** (utvecklingstemat), aldrig live. Säkerhetskopiera först (`themeFilesCopy` till `assets/backup-….txt`). Verifiera med MD5 (`checksumMd5`). Granska sedan i den *riktiga* förhandsvisningen (temats CSS och header kan bryta det som funkade lokalt).
8. **Rapportera ärligt** med svagaste punkten och vad som inte är testat (riktiga telefoner, Safari, Firefox). Låt Anna bedöma.

## Designregler som gäller för BME

- **Ett enda typsnitt per sektion** (temats Cormorant, en vikt). Hierarki med skala, kursiv, versaler med bred spärr, guld. Inget `system-ui`. Det som ser ut som "flera typsnitt" är det oftast.
- **Palett = temats egen**: grön-svart `#0a0e0c`/`#1c2320`, elfenben `#f3eee3`, guld `#c4a268`/`#ecd29a`. Inga nya färger. Ett varmt koppar-/bärnstensskimmer är ok som ögonblickets accent.
- **Rytm**: växla mörkt och ljust, men Anna sa om v44 (helt mörk): "för mörkt". Håll sidan ljus (elfenben) och låt filmerna/bilderna bära det mörka. Ett mörkt band i sig är inte längre standardsvaret.
- **Skalkontrast**: ett mycket stort element per vy (80–110 px rubrik, 60–80 px ord) mot små, tysta etiketter. Hårlinjer, siffror (01–05), en guldtråd som visar framsteg.
- **Rörelse bär betydelse**, inte dekor. Varje rörelse ska betyda något (andning 10 s, fingeravtryck, tråd som kopplar). Respektera `prefers-reduced-motion`, ge fullgod statisk layout.
- **Ingen scroll-kapning.** `position: sticky` + beräkna framsteg från `getBoundingClientRect()`.
- Copy som är låst ändras inte: formatera den, men ändra aldrig orden. Betoning görs via en inställning (fraser i guldkursiv), inte genom att skriva om texten.

## Rörlig bild (video) på sidan: lärdomar från v45 → v46 (13 okt, Annas "det här ser konstigt ut")

Anna: *"du måste i varje beslut bära din roll som världsledande … du måste hitta ett annat sätt att presentera bildvideo."* Ett underkänt förslag (fem smala valv med stockvideo i rad) lärde mer än tre godkända.

- **Visa en film i taget, stor.** Flera små rörliga rutor bredvid varandra läser som färgprov och tar ifrån varje bild dess verkan. Ett kapitel per film, helbredd eller stor, i vanlig scroll (aldrig fastnålat).
- **Låt formen göra ett jobb.** Här: filmen öppnas från en smal springa till full bredd med scrollen (= "the window", varumärkets metafor). Inte dekor, utan mening. Valv i klunga och andra "färdiga" former: undvik.
- **En enda gradering över alla klipp är viktigare än vilka klipp.** Olika färgvärldar (senap, orange, blågrönt) ser billiga ut tillsammans. Lyft svärtor (`curves 0/0.04`), kapa högdagrar (`1/0.955`), dämpa mättnad, varm pärlton. Sedan bedömer du alla fem på ett kontaktblad bredvid varandra på sidans bakgrundsfärg innan något byggs.
- **Välj klipp som redan bär varumärkets material**, inte "snygga klipp": skira gardiner som andas i ett fönster (= window + breath) slår skarpt men mycket suddig satin. Vatten ska vara stilla skymning, inte glitter. Undvik klipp med konstant kamerarörelse (testa med frame-differens).
- **Orden i bilden**: små, spärrade versaler för sinnet och kursiv för effekten, olika läge per kapitel, bokstäverna tonar fram ur oskärpa, textfärg per film (mörk på ljus, ljus på mörk) + en mjuk lokal slöja bakom. Aldrig stora ord över hela bilden (Anna: "lite för stor text").
- **Sömlös loop**: `xfade` (1,2 s) av slutet över början, `format=yuv420p` efter xfade (annars 4:4:4 som inte går att spela), H.264 high, `-an`, faststart, `crf 28`, `maxrate 2600k` (desktop 1600×1000) / `1800k` (mobil 900×1200). Två format: 16:10 och 3:4 (JS väljer; en smal centrerad film använder alltid 3:4).
- **Spela bara det som syns**: `IntersectionObserver`, max två samtidigt (närmast skärmens mitt), ladda först när nära, `preload=none` i markup, affisch (JPEG) + liten base64-bakgrund som reserv, **pausknapp** (WCAG 2.2.2), respektera `prefers-reduced-motion` och `saveData`, `play()` kan avvisas (iOS lågenergi): fånga det och visa "Play".
- **Kontrollera ALLTID hela vägen i den riktiga förhandsvisningen med riktiga filer**, inte bara i testbänken. Headless Chromium har ingen H.264: bygg VP9-kopior av samma klipp och mata in dem som `Blob` via `addInitScript` (en `src`-setter som byter CDN-URL mot blob). Localhost från en https-sida går inte (proxy/PNA, 405). Säg ärligt att riktig H.264-uppspelning inte setts.
- **Stockfilm är platshållare.** Säg det. Den riktiga lösningen är egna klipp (Flow, skillen `reklamfilm-regissor`) via sektionens videoväljare. Lägg alltid in den vägen (`video_N` ersätter standardfilmen).
- **`play()` avvisas ofta, och det är oftast inte ett fel**: `AbortError` när du själv pausar/laddar om innan filmen hunnit starta (snabb scroll, långsamt nät). Pausa bara allt vid `NotAllowedError`, ignorera övriga. Testa alla tre (`NotAllowedError`, `AbortError`, `NotSupportedError`) med en överskriven `play()`.
- **Hjälpmedel som ligger i kanten korsar text någon gång**. En klibbig knapp vid sidan korsar text som scrollar förbi: låt den tona bort medan den skulle ligga över text (mät rektanglar, en gång per bildruta, alla läsningar före alla skrivningar). Ikonknapp 44 px, `aria-label` som byter, inte `aria-pressed` + byte av text, och synlig vid fokus (`:focus-within`) så att Tab når den.
- **Mät, titta inte bara**: skript som scrollar den riktiga förhandsvisningen i 11 skärmstorlekar (320–2560) och mäter rektanglar (text utanför filmen, knapp över text, sidledsscroll, antal spelande filmer) hittade det jag inte såg i skärmdumpar. Ett *granskarblick utan min tolkning* (en agent som bara får koden) hittade dessutom fel jag själv var blind för.
- **Källor**: Pexels (fri kommersiell, ingen attribuering). `WebFetch` på `pexels.com/search/videos/<fråga>/?orientation=landscape` ger id-listan; `curl -A <webbläsar-UA> https://www.pexels.com/download/video/<ID>/` ger 302 till originalfilen. Pinterest-material är bara referens, aldrig på sajten.

## Canvas-konst: lärdomar

- **Fada inte en canvas** (`destination-out`) för spår: det lämnar kvar grå "spöken" (8-bitars avrundning). Spara i stället per partikel en historik (avståndsbaserad: en punkt var ~3.5 px) och rita om allt varje bildruta, svans svag och huvud skarpt (tre åldersnivåer × fem ljusklasser, en `stroke()` per grupp).
- `globalCompositeOperation='lighter'` + långsamma partiklar = vita prickar. Ge en **minsta hastighet** och **gräns**. Klampa alltid dragkrafter (`clamp`), annars blir det raka strålar.
- **Dissolva vid ögonblicksbyte**: markera ~70 % som `dying` så strängarna dras tillbaka. Annars ser snabb scroll rörig ut.
- Partikeltak (1000 desktop, 560 mobil) och automatisk nedtrappning om bildrutorna blir långsamma. Pausa när sektionen inte syns (`IntersectionObserver`) och när fliken är dold.
- Ignorera `resize` som bara beror på mobilens adressfält (ändra bara om bredden ändrats eller höjden > 160 px).
- Layout som beror på en `<script>`: lägg `is-live` och spårhöjd **synkront** när skriptet körs, inte efter att typsnitt laddats, annars hoppar sidan.

## Shopify-verktyg: fällor (lärda den hårda vägen)

- **GraphQL-dokumentet får vara högst 16 384 tecken.** En stor temafil går inte i ett anrop. Dela upp i `snippets/` (CSS, JS i delar som `{% render %}`-as efter varandra i samma `<script>`), och använd blocksträngar `"""…"""` i mutationen (inga escape-problem). Kontrollera att delningen ger identisk rendering lokalt innan uppladdning.
- Blocksträngar tar bort gemensamt indrag och avslutande tomrader: kontrollsumman matchar bara om du normaliserar likadant lokalt.
- **`index.json` (29 kB) går inte att skriva om via dokumentet.** Ändra inte mallen: behåll sektionens filnamn, inställnings-id och blocktyper, och lägg ny funktionalitet som *nya inställningar med standardvärde* (de gäller när nyckeln saknas i JSON-mallen).
- **Schemat valideras vid uppladdning:** etiketter max 70 tecken (blockinställningar).
- **`themeFilesDelete` blockeras** av säkerhetspolicyn (och ska inte kringgås). Ersätt med tom stub utan presets och be Anna radera i admin.
- Temafiler kan bara skrivas till **opublicerade** teman. `themeFilesCopy` duger för backup/återställning.
- Temat har `--header-height` på `body`; header är sticky. Rita inte under den: låt scenen börja på `top: var(--header-height)`.
- Shopifys förhandsgranskningsrad (~65 px) täcker nederkanten i skärmdumpar av utkast.
- I liquidjs (testbänken) finns inte `blank`: byt till `nil` i testbänken, aldrig i den riktiga filen.
- `justify-self` från ett grid-läge gäller även `position:absolute` och kan krympa bredden till 0. Nollställ (`justify-self:stretch`) i det läge som inte är grid.
- **En sektion som ska bytas ut**: byt innehåll i den befintliga filen i stället för att peka om mallen.
- **Lämna aldrig utkastet i ett mellanläge.** Sektion, CSS och JS hänger ihop: ladda upp i en ordning där varje steg är konsistent (nytt CSS+JS först, sektionen sist) och kontrollera direkt. Efter ett avbrutet arbete: kolla `checksumMd5` på alla delar innan du säger något om läget.
- **Filer i Shopify (video, bilder)**: `stagedUploadsCreate` (resource `FILE` för mp4, `IMAGE` för jpg, `httpMethod: POST`, max 20 MB per fil) → `curl --form-string` med *alla* parametrar i tur och ordning och `file` sist (signatur och policy kopieras exakt) → `fileCreate` (contentType `FILE`/`IMAGE`) → fråga `files(query:"filename:…")` tills `READY` → hämta från `cdn.shopify.com/s/files/…/files/<namn>` (utan `?v=`) och jämför MD5 (videor blir byte-identiska; JPEG får några byte metadata). Använd unika filnamn.
- **Filer över 16 kB (t.ex. `templates/index.json`, 29 kB)** går att skriva trots dokumentgränsen: ladda upp filen med `stagedUploadsCreate` (resource `FILE`, `text/plain`, valfritt namn `.txt`) och skriv sedan `themeFilesUpsert` med `body: {type: URL, value: <stagedTargets.resourceUrl>}` (inte cdn-adressen: den avvisas tyst). Svaret är tomt och jobbet asynkront: begär `job { id done }` och fråga `files(...) { checksumMd5 }` efteråt. **Bara utkast-temat. Ta backup först (`themeFilesCopy` till `assets/backup-….txt`) och kontrollera att `checksumMd5` var oförändrad sedan din egen kopia, annars har Anna ändrat i redigeraren.** Shopify **minifierar JSON-mallar** och tar bort inställningar som sektionens schema inte känner, så kontrollsumman blir en annan: jämför strukturen i stället (`json.load` båda, rekursiv diff). Radera sedan din tillfälliga fil (`fileDelete` fungerar för egna Files-poster) och ersätt testfiler i `assets/` med en tom stub.
- **Läs vilken temafil som helst direkt i bash**: `themeFilesCopy` till `assets/x.txt`, öppna förhandsvisnings-URL:en med `curl -L -c jar.txt` (sätter kakan), hämta sedan `https://<shop>.myshopify.com/cdn/shop/t/<n>/assets/x.txt` med `-b jar.txt` (`<n>` syns i förhandsvisningens HTML). Då slipper du dra stora filer genom GraphQL-svaret.
- **Ett prefix i en textinställning** (`film_files_url` + nummer + `-wide.mp4`) ger en hel filuppsättning med en enda inställning, i stället för 20 fält i temaredigeraren.

## Innan du säger "klart"

Har du sett det i den riktiga förhandsvisningen på både desktop och mobil? Fungerar det utan JS? Står kontrollsummorna? Har du sagt vad som *inte* är testat? Har du sparat källan i repot och synkat till `master`?
