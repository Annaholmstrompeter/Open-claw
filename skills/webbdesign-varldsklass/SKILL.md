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
- **Rytm**: växla mörkt och ljust. Ett mörkt band gör mer för "dyrt" än mer innehåll.
- **Skalkontrast**: ett mycket stort element per vy (80–110 px rubrik, 60–80 px ord) mot små, tysta etiketter. Hårlinjer, siffror (01–05), en guldtråd som visar framsteg.
- **Rörelse bär betydelse**, inte dekor. Varje rörelse ska betyda något (andning 10 s, fingeravtryck, tråd som kopplar). Respektera `prefers-reduced-motion`, ge fullgod statisk layout.
- **Ingen scroll-kapning.** `position: sticky` + beräkna framsteg från `getBoundingClientRect()`.
- Copy som är låst ändras inte: formatera den, men ändra aldrig orden. Betoning görs via en inställning (fraser i guldkursiv), inte genom att skriva om texten.

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

## Innan du säger "klart"

Har du sett det i den riktiga förhandsvisningen på både desktop och mobil? Fungerar det utan JS? Står kontrollsummorna? Har du sagt vad som *inte* är testat? Har du sparat källan i repot och synkat till `master`?
