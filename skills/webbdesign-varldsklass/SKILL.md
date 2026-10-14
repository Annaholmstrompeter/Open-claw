---
name: webbdesign-varldsklass
description: "Playbook för allt arbete på Annas hemsidor: Body Mind Earth (Shopify) och andra sajter, webbshoppar och landningssidor (Shopify, WordPress, Wix, Squarespace, egen kod). Använd ALLTID när Anna jobbar med en hemsida, webbplats, webbshop, Shopify, tema, sektion, Liquid/HTML/CSS/JS för webben, sidlayout, karusell, animation eller video på en sida, typografi, gradering, 'hetare', 'mer nyskapande', eller jämför mot en förebild (t.ex. BONJIL). Innehåller arbetssätt (creative director, bygg i utkast, mät i riktiga förhandsvisningen), Annas smak, designregler, rörlig bild och karusell, tillgänglighet, testbänk och fällor i Shopify-verktygen. English: use for any website, webshop, landing page, theme or section design/build work for Anna."
---

# Webbdesign i världsklass: så jobbar vi

Gäller **alla hemsidor Anna arbetar med**: Body Mind Earth (Shopify) och andra sajter och webbshoppar. Skapad 2026-10-13 efter att Anna underkände v43 av The Experience ("flera typsnitt, inga arty coola take, bilden för snäll"), uppdaterad 2026-10-14 (v47, filmkarusellen, och gjord allmän). Exempelprojektet som lärdes av: `projects/bme-experience-window/`.

## Start här (ny chatt, vilken sajt som helst)

1. **Vilken sajt är det?**
   - **Body Mind Earth**: läs `references/bme.md` (palett, typsnitt, låst copy, Shopify-ID:n, version och Annas omdömen) och, om du har repot `Annaholmstrompeter/Open-claw`, **`HEMSIDAN.md`** i dess rot (läget just nu, återställningspunkter, öppna punkter).
   - **Annan sajt**: läs sajtens egen kod, tema och eventuell stilguide först och **härled varumärkets verktyg (palett, typsnitt, ton) ur sajten själv** i stället för att fråga. Fråga bara det som inte går att läsa ut (var man får bygga utan att röra live, vad som är låst copy). Skapa en överlämningsfil för sajten (som BME:s `HEMSIDAN.md`: läge, ID:n, återställningspunkter, öppna punkter, Annas omdömen) så nästa chatt kan fortsätta.
2. **Rollen.** Anna 13 okt: *"du måste i varje beslut bära din roll som världsledande"*. Du är creative director, inte utförare. Beslut, inte menyer. Hon ska aldrig behöva leda eller rätta samma sak två gånger. Svara på svenska, kort, enkla ord, med bilder från den riktiga förhandsvisningen.
3. **Bygg bara i utkast/staging/förhandsvisning. Publicera aldrig** och rör aldrig live utan Annas uttryckliga ord.
4. Säger Anna att "det fanns lite fel" utan att peka ut vad: granska själv (copy mot det låsta dokumentet, mät layout i flera skärmstorlekar, kör testerna), rätta, berätta vad du hittade.
5. **Film och Flow**: skillen `reklamfilm-regissor` (i Annas konto; reservkopia i repot: `skills/reklamfilm-regissor/`).

## Annas smak (gäller oftast alla hennes sajter)

Hennes egna ord i citat. Det här har hon sagt om mina förslag, och det är facit:

- **Hett, nyskapande, "arty".** Inte snällt eller mallaktigt ("våran är för snäll … det ska vara riktigt 'hett' nyskapande intressant"). En stor idé som kommer ur varumärkets mening, inte ur en layoutmall.
- **Återhållen lyx.** Få typsnitt (helst ett per sektion: "flera olika typsnitt" räknas som fel), luft, hårlinjer, stor skalkontrast mot små tysta etiketter. Text som inte är för stor ("lite för stor text").
- **Ljust och varmt, färg och rörlig bild som lyfter.** En helt mörk version fick "för mörkt". Sensuella material (tyg som böljar, bark, mossa, vatten som rör sig lite), inte glitter.
- **Vanlig scroll, alltid.** "Det går inte att scrolla" om en fastnålad berättelse. Inget som fångar eller blockerar.
- **Formen ska passa varumärket.** Fem smala valv i rad: "det här ser konstigt ut, det passar inte". Färdiga former i klunga, stockiga färgprov och flera rörliga rutor bredvid varandra: undvik.
- **Rörelse med mening**, aldrig dekor.
- **Ord i bilder** ska vara konstnärliga, inte övertydliga.
- **Hon bedömer med ögat.** Visa bilder från den riktiga förhandsvisningen. Säg svagaste punkten och vad som inte är testat. När hon säger "spara detta": backa upp i utkastet och i repot.

## Arbetssätt (i den här ordningen)

1. **Ta en riktig baslinje.** Skärmdump av nuläget (desktop + mobil) från den riktiga förhandsvisningen, inte från minnet. Läs koden bakom: oftast förklarar den kritiken ("flera typsnitt" = ett `font-family: system-ui` som någon lagt till).
2. **Säg problemet med vanliga ord, utan försvar.** Annas ögon har rätt. Bedöm mot förebilden på riktigt: vad gör den bättre?
3. **Koncept före pixlar.** En stor idé som kommer ur varumärkets mening, inte ur en layoutmall. (BME: Hebb, "det som tänds tillsammans kopplas ihop", + "the window".) Frågan är alltid: *vad är sektionens enda mening, och hur kan formen bära den?*
4. **Bilden behöver inte vara ett foto.** Generativ/kod-konst (canvas, SVG), typografi som bild, eller en tydligt art-directad AI-bild (ge Anna färdiga prompter till ChatGPT/Gemini, med äkta svart bakgrund, 3:4, utan ansikten/text). Stockiga porträtt av någon som blundar är "snällt".
5. **Bygg i en lokal testbänk** (Shopify: riktig Liquid-motor, liquidjs; annars sajtens egen build), sajtens typsnitt och en fejkad sticky header. Ta skärmdumpar på flera lägen i berättelsen. Kontaktblad (PIL) gör att du ser sekvensen i ett svep. Mallen finns i repot: `projects/bme-experience-window/lab/` (kopiera och anpassa för en annan sajt).
6. **Kolla alltid**: desktop 1440, mobil 390, reducerad rörelse, utan JavaScript, snabb scroll (hopp), resize.
7. **Ladda bara upp till utkastet** (Shopify: det opublicerade utvecklingstemat; annan plattform: staging/kopia), aldrig live. Säkerhetskopiera först (`themeFilesCopy` till `assets/backup-….txt`). Verifiera med MD5 (Shopify: `checksumMd5`). Granska sedan i den *riktiga* förhandsvisningen (temats CSS och header kan bryta det som funkade lokalt).
8. **Rapportera ärligt** med svagaste punkten och vad som inte är testat (riktiga telefoner, Safari, Firefox). Låt Anna bedöma.


## Designregler (allmänna; palett och typsnitt är per sajt)

- **Typografi**: utgå från sajtens egen. Ett typsnitt per sektion som standard; hierarki med skala, kursiv, versaler med bred spärr, färg. "Flera typsnitt" är oftast en glömd `system-ui`/fallback i CSS:en: kolla koden.
- **Palett**: härled ur sajten/temat. Inga nya färger utan skäl. **Mät kontrast** (WCAG AA, 4,5:1 för liten text); en guldton på 4,09:1 underkändes.
- **Rytm**: växla ljust och mörkt med måtta; håll sidan ljus om inte varumärket är mörkt, och låt bilder/filmer bära det mörka. 
- **Skalkontrast**: ett mycket stort element per vy mot små, tysta etiketter. Hårlinjer, siffror (01–05), en tråd som visar framsteg.
- **Rörelse bär betydelse**, inte dekor. Respektera `prefers-reduced-motion`; ge en fullgod statisk layout och en som funkar utan JavaScript.
- **Ingen scroll-kapning.** Vanlig lodrät scroll ska alltid fungera. Sidled får vara en karusell med eget spår. `position: sticky` + framsteg från `getBoundingClientRect()` om något ska följa med.
- **Copy som är låst ändras inte**: formatera den, ändra aldrig orden. Betoning görs via en inställning (fraser i guldkursiv), inte genom att skriva om texten.
- **Tillgänglighet och prestanda är en del av formen**: tangentbord, `aria`, 44 px träffytor, kontrast, lazy-laddning, spela bara det som syns.

## Rörlig bild (video) på sidan: lärdomar från v45 → v47 (13 okt, Annas "det här ser konstigt ut")

Anna: *"du måste i varje beslut bära din roll som världsledande … du måste hitta ett annat sätt att presentera bildvideo."* Ett underkänt förslag (fem smala valv med stockvideo i rad) lärde mer än tre godkända.

- **Karusell när Anna ber om det (13 okt: "sätt bilderna som en karusell istället för under varandra")**: horisontellt spår med `scroll-snap-type:x mandatory` + `scroll-snap-stop:always` (svepet fungerar utan JS och en film per svep), film i mitten, grannar tittar fram (spårets första/sista avstånd görs med `::before/::after`-distanser, inte `padding`, som vissa webbläsare ignorerar i slutet), styrning i en EGEN rad under bilderna (aldrig ovanpå), aktiv film beräknas från avstånd till spårets mitt. Fönster-metaforen följer svepet (`--o` per film från avståndet). `overscroll-behavior-x:contain`, lodrät scroll ska aldrig fångas: testa med riktiga touch-händelser (CDP `Input.dispatchTouchEvent` i små steg, inte `synthesizeScrollGesture`). Ingen autoväxling. ARIA: `region` + `aria-roledescription="carousel"`, varje bild `group` + "2 of 5", dold `aria-live`.
- **Visa en film i taget, stor.** Flera små rörliga rutor bredvid varandra läser som färgprov och tar ifrån varje bild dess verkan. Ett kapitel per film, helbredd eller stor, i vanlig scroll (aldrig fastnålat).
- **Låt formen göra ett jobb.** Här: filmen öppnas som ett fönster (= "the window", varumärkets metafor), först med lodrät scroll (v46), i karusellen med svepet (v47: aktiv film helt öppen, grannar lägre och dämpade, mitt i svepet två halvöppna). Inte dekor, utan mening. Valv i klunga och andra "färdiga" former: undvik.
- **En enda gradering över alla klipp är viktigare än vilka klipp.** Olika färgvärldar (senap, orange, blågrönt) ser billiga ut tillsammans. Lyft svärtor (`curves 0/0.04`), kapa högdagrar (`1/0.955`), dämpa mättnad, varm pärlton. Sedan bedömer du alla fem på ett kontaktblad bredvid varandra på sidans bakgrundsfärg innan något byggs.
- **Välj klipp som redan bär varumärkets material**, inte "snygga klipp": skira gardiner som andas i ett fönster (= window + breath) slår skarpt men mycket suddig satin. Vatten ska vara stilla skymning, inte glitter. Undvik klipp med konstant kamerarörelse (testa med frame-differens).
- **Orden i bilden**: små, spärrade versaler för sinnet och kursiv för effekten, olika läge per kapitel, bokstäverna tonar fram ur oskärpa, textfärg per film (mörk på ljus, ljus på mörk) + en mjuk lokal slöja bakom. Aldrig stora ord över hela bilden (Anna: "lite för stor text").
- **Sömlös loop**: `xfade` (1,2 s) av slutet över början, `format=yuv420p` efter xfade (annars 4:4:4 som inte går att spela), H.264 high, `-an`, faststart, `crf 28`, `maxrate 2600k` (desktop 1600×1000) / `1800k` (mobil 900×1200). Två format: 16:10 (desktop) och 3:4 (mobil), JS väljer efter bredd.
- **Spela bara det som syns**: `IntersectionObserver`, max två samtidigt (närmast skärmens mitt), ladda först när nära, `preload=none` i markup, affisch (JPEG) + liten base64-bakgrund som reserv, **pausknapp** (WCAG 2.2.2), respektera `prefers-reduced-motion` och `saveData`, `play()` kan avvisas (iOS lågenergi): fånga det och visa "Play".
- **Kontrollera ALLTID hela vägen i den riktiga förhandsvisningen med riktiga filer**, inte bara i testbänken. Headless Chromium har ingen H.264: bygg VP9-kopior av samma klipp och mata in dem som `Blob` via `addInitScript` (en `src`-setter som byter CDN-URL mot blob). Localhost från en https-sida går inte (proxy/PNA, 405). Säg ärligt att riktig H.264-uppspelning inte setts.
- **Stockfilm är platshållare.** Säg det. Den riktiga lösningen är egna klipp (Flow, skillen `reklamfilm-regissor`) via sektionens videoväljare. Lägg alltid in den vägen (`video_N` ersätter standardfilmen).
- **`play()` avvisas ofta, och det är oftast inte ett fel**: `AbortError` när du själv pausar/laddar om innan filmen hunnit starta (snabb scroll, långsamt nät). Pausa bara allt vid `NotAllowedError`, ignorera övriga. Testa alla tre (`NotAllowedError`, `AbortError`, `NotSupportedError`) med en överskriven `play()`.
- **Lägg kontroller i en EGEN rad, inte flytande över bilden.** En klibbig pausknapp vid sidan korsade orden i v46 (mätt i 11 skärmstorlekar) och fick lösas med tona-bort-logik; i karusellen (v47) ligger räknare, streck, pilar och paus under filmerna och problemet finns inte. Ikonknappar 44 px, `aria-label` som byter (inte `aria-pressed` + textbyte), synliga vid fokus så att Tab når dem. Mät rektanglar i en bildruta: alla läsningar före alla skrivningar.
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
- **`index.json` (29 kB) går inte att skriva som vanlig text i ett anrop**, men går via URL-metoden längre ned. Rör den helst inte: behåll sektionens filnamn, inställnings-id och blocktyper, och lägg ny funktionalitet som *nya inställningar med standardvärde* (de gäller när nyckeln saknas i JSON-mallen). Ändra den bara när något måste rättas (t.ex. ett copyfel som "Anchor. Associate." → "Direct.").
- **Schemat valideras vid uppladdning:** etiketter max 70 tecken (blockinställningar).
- **`themeFilesDelete` blockeras** av säkerhetspolicyn (och ska inte kringgås). Ersätt med tom stub utan presets och be Anna radera i admin.
- Temafiler kan bara skrivas till **opublicerade** teman. `themeFilesCopy` duger för backup/återställning.
- Temat har `--header-height` på `body`; header är sticky. Rita inte under den: låt scenen börja på `top: var(--header-height)`.
- Shopifys förhandsgranskningsrad (en fast iframe, ca 68 px längst ner) täcker nederkanten i skärmdumpar av utkast och knappar på låga skärmar. Den finns inte på riktiga sajten. Ta bort den i mätskript (iframe i en `position:fixed`-förälder), annars scrollar Playwright sidan när den klickar.
- I liquidjs (testbänken) finns inte `blank`: byt till `nil` i testbänken, aldrig i den riktiga filen.
- `justify-self` från ett grid-läge gäller även `position:absolute` och kan krympa bredden till 0. Nollställ (`justify-self:stretch`) i det läge som inte är grid.
- **En sektion som ska bytas ut**: byt innehåll i den befintliga filen i stället för att peka om mallen.
- **Lämna aldrig utkastet i ett mellanläge.** Sektion, CSS och JS hänger ihop: ladda upp i en ordning där varje steg är konsistent (nytt CSS+JS först, sektionen sist) och kontrollera direkt. Efter ett avbrutet arbete: kolla `checksumMd5` på alla delar innan du säger något om läget.
- **Filer i Shopify (video, bilder)**: `stagedUploadsCreate` (resource `FILE` för mp4, `IMAGE` för jpg, `httpMethod: POST`, max 20 MB per fil) → `curl --form-string` med *alla* parametrar i tur och ordning och `file` sist (signatur och policy kopieras exakt) → `fileCreate` (contentType `FILE`/`IMAGE`) → fråga `files(query:"filename:…")` tills `READY` → hämta från `cdn.shopify.com/s/files/…/files/<namn>` (utan `?v=`) och jämför MD5 (videor blir byte-identiska; JPEG får några byte metadata). Använd unika filnamn.
- **Filer över 16 kB (t.ex. `templates/index.json`, 29 kB)** går att skriva trots dokumentgränsen: ladda upp filen med `stagedUploadsCreate` (resource `FILE`, `text/plain`, valfritt namn `.txt`) och skriv sedan `themeFilesUpsert` med `body: {type: URL, value: <stagedTargets.resourceUrl>}` (inte cdn-adressen: den avvisas tyst). Svaret är tomt och jobbet asynkront: begär `job { id done }` och fråga `files(...) { checksumMd5 }` efteråt. **Bara utkast-temat. Ta backup först (`themeFilesCopy` till `assets/backup-….txt`) och kontrollera att `checksumMd5` var oförändrad sedan din egen kopia, annars har Anna ändrat i redigeraren.** Shopify **minifierar JSON-mallar** och tar bort inställningar som sektionens schema inte känner, så kontrollsumman blir en annan: jämför strukturen i stället (`json.load` båda, rekursiv diff). Radera sedan din tillfälliga fil (`fileDelete` fungerar för egna Files-poster) och ersätt testfiler i `assets/` med en tom stub.
- **Läs vilken temafil som helst direkt i bash**: `themeFilesCopy` till `assets/x.txt`, öppna förhandsvisnings-URL:en med `curl -L -c jar.txt` (sätter kakan), hämta sedan `https://<shop>.myshopify.com/cdn/shop/t/<n>/assets/x.txt` med `-b jar.txt` (`<n>` syns i förhandsvisningens HTML). Då slipper du dra stora filer genom GraphQL-svaret.
- **Ett prefix i en textinställning** (`film_files_url` + nummer + `-wide.mp4`) ger en hel filuppsättning med en enda inställning, i stället för 20 fält i temaredigeraren.


## Andra plattformar än Shopify

Samma metod: baslinje i den riktiga förhandsvisningen/staging, koncept, bygg lokalt, mät, visa. WordPress/Wix/Squarespace/egen kod: hitta först var man kan bygga utan att röra live (staging, kopia av sidan, utkast, egen gren), ta backup innan du ändrar, och kontrollera plattformens gränser på samma sätt som Shopifys ovan (storlek på filer och anrop, vad som sparas i tema/databas). Är du osäker på om något går att ångra: gör det inte, fråga Anna.

## Innan du säger "klart"

Har du sett det i den riktiga förhandsvisningen på både desktop och mobil? Fungerar det utan JS? Står kontrollsummorna? Har du sagt vad som *inte* är testat? Har du sparat källan i repot och synkat till `master` (BME-repot: se `CLAUDE.md`), och uppdaterat sajtens överlämningsfil?

## Testbänken i korthet

`projects/bme-experience-window/lab/` (se README där): `build.mjs` (riktig Liquid), `carousel.mjs` (pilar, tangentbord, snap, paus, mitt i svep, reducerad rörelse, utan JS), `errtest.mjs` (play()-fel), `audit2.mjs` (riktiga förhandsvisningen i 11 skärmstorlekar), `touch2.mjs` (riktiga touch-svep: sidled byter film, lodrätt scrollar sidan), `live.mjs` (skärmdumpar med filmer inmatade som blobbar). Filmerna byggs med `films/make-films.sh`.
