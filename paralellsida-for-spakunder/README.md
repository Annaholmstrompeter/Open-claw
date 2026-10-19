# Body Mind Earth — Sensory Ritual (fristaden)

En liten, helt fristående webbplats som gästerna når med QR-koden i Sensory Enrichment-asken.
Fem ritualer (Balance, Luminance, Kindness, Serenity, Presence) som **lyssnas på**: när man trycker
på *Short ritual* eller *Extended ritual* (båda längderna finns alltid; en vars inspelning inte är inlagd än visas stilla med *Soon* och går inte att trycka på) visas
produktens bild, ritualens namn och en rad ur meditationen, och inspelningen startar av sig själv.
Spelsidan är avskalad: en knapp (spela/pausa) och en linje man drar med fingret för att söka; vägen
hem finns i menyn. Själva meditationen visas aldrig som text. Ingen butik, inga priser, inga länkar ut, inga cookies och
ingen spårning.

Formspråket kommer från etiketterna: etikettens exakta färger, gravyrerna, vågmönstret, den
riktiga logotypen och "A reminder of the world we share". Ljudet är dina inspelningar ur Drive-mappen
"FÄRDIGA - hemsida (8 okt)".

Kostar 0 kr: statiska filer på Cloudflare Pages (gratis), ingen databas, inget byggsteg i molnet.

## Inspelningarna (viktigt)

Lägg de elva mp3-filerna ur Drive-mappen **"FÄRDIGA - hemsida (8 okt)"**, med oförändrade namn, i
`public/assets/audio/`:

```
01_Intro_Sensory-Enrichment.mp3
02_Presence_Raspberry-Body-Lotion_KORT.mp3     03_Presence_Raspberry-Body-Lotion_LANG.mp3
04_Balance_Bergamot-Hand-Wash_KORT.mp3         05_Balance_Bergamot-Hand-Wash_LANG.mp3
06_Luminance_Apricot-Hand-Cream_KORT.mp3       07_Luminance_Apricot-Hand-Cream_LANG.mp3
08_Kindness_Cherry-Body-Wash_KORT.mp3          09_Kindness_Cherry-Body-Wash_LANG.mp3
10_Serenity_Macadamia-Shampoo_KORT.mp3         11_Serenity_Macadamia-Shampoo_LANG.mp3
```

Alla elva ligger i repot (de åtta sista lades in 2026-10-10, hämtade ur Drive-mappen och kontrollerade
mot Drives filstorlekar). Saknas en fil visar ritualens sida den längden stilla med *Soon*, och spelaren
säger "This recording is not available yet." i stället för att låta tyst.

Ändras en inspelning: byt filen med samma namn. Ljudet cachas inte offline (filerna är stora och
spelas som ström), så gästerna behöver täckning när de lyssnar.

## Vad som är vad

| Mapp / fil | Innehåll |
|---|---|
| `public/` | Själva sidan. Det här är det som läggs ut. |
| `public/assets/audio/` | Inspelningarna (se ovan). |
| `public/assets/img/` | Bilderna, uttagna ur etikett-PDF:erna (gravyrer, vågmönster, arter, logotyp) samt `hero.webp`. |
| `content/products.json` | Produktfakta ordagrant från de fem etiketterna. |
| `content/quotes.json` | En rad ur varje meditation, som visas medan den spelas. Ändra fritt. |
| `content/audio.json` | Vilka filer som hör till vilken ritual. |
| `content/meditations-mall.txt` | Textkopia av Google-dokumentet "Meditations mall". Används bara för introtexten och för att kontrollera att varje citat står ordagrant i manuset. Skickas aldrig till gästens telefon. |
| `tools/build-content.py` | Gör `public/assets/content.js` och uppdaterar offline-cachen i `public/sw.js`. Skriver ut vilka inspelningar som saknas. |
| `tools/extract-label-art.py` | Tar ut bilderna ur etikett-PDF:erna (kräver `pdftoppm`, `numpy`, `scipy`, `pillow`). |
| `tools/make-hero.py` | Gör bakgrundsfotot till välkomstvyn och avslutet. |
| `tools/make-qr.py` | Gör QR-koden när den riktiga adressen är bestämd. |
| `tools/make-preview.py` | Packar sidan i en enda fil för förhandsvisning (utan ljud). |
| `public/assets/together/` | **Together (A Ritual for Two)**: egna små moduler, se längre ner. |
| `content/together.json` | Texterna om ritualerna för två. Byggs in i `content.js` av `build-content.py`. |
| `content/together-heart-to-heart-manus.md` | Manusutkast och produktionskrav för *Heart to Heart*. Skickas aldrig till telefonerna. |
| `content/source/ritual-photo.jpg` | Annas bild (Presence-flaskan i sin ask). Utgångspunkt för de fem ritualbilderna. |
| `tools/make-ritual-photos.py` | Gör `public/assets/img/ritual-<id>.webp`: byter namn och ledord på flaskans etikett för varje ritual (resten av bilden orörd). Kör om efter ändrad text. |
| `tools/make-together-art.py` | Räknar fram ljusreflexerna på vatten (egna bilder, inga foton, inga rättighetsproblem). |
| `tests/` | Automatiska tester (se "Tester"). `TOGETHER-TEST.md` är provlistan för riktiga telefoner. |

## Lägga ut sidan (ca 10 minuter, en gång)

1. Skapa ett gratis konto på <https://dash.cloudflare.com>.
2. **Workers & Pages → Create → Pages → Upload assets.** Döp projektet (t.ex. `body-mind-earth`),
   dra in innehållet i mappen `public/` (med alla elva ljudfiler i `assets/audio/`) och tryck
   *Deploy*. Du får en adress som `body-mind-earth.pages.dev`. En enskild fil får vara högst 25 MB;
   dina är högst 10 MB.
   - Alternativ: *Connect to Git* mot det här repot med *Root directory* `paralellsida-for-spakunder`,
     *Build output directory* `public` och inget byggkommando. Då uppdateras sidan automatiskt
     när `master` ändras.
3. Egen adress (rekommenderas innan något trycks): i projektet, *Custom domains → Set up a
   domain*, t.ex. `ritual.bodymindearth.se`. Cloudflare säger vilken DNS-rad som ska läggas
   in hos den som sköter bodymindearth.se.
4. Gör QR-koden med den slutliga adressen och skanna den med en telefon innan tryck:
   `pip install segno` och sedan `python3 paralellsida-for-spakunder/tools/make-qr.py https://din-adress`.

### Provsida på GitHub Pages (för att prova Together på riktiga telefoner)

Innan sidan ligger på sin riktiga adress kan den läggas ut som en provsida, utan nya konton:

```
paralellsida-for-spakunder/tools/publish-test-site.sh sökväg/till/testljud.mp3
```

Skriptet bygger sidan (bara `public/`, inga manus eller anteckningar), lägger testljudet som Together-inspelning (bara på provsidan) och pushar den som grenen `gh-pages`. En gång i GitHub: *Settings → Pages → Deploy from a branch → `gh-pages`, `/ (root)` → Save*. Adressen blir `https://<användare>.github.io/<arkiv>/`. Kör skriptet igen efter varje ändring: det skriver ut en ny länk (med `?v=<tid>` så att telefonen hämtar den nya versionen i stället för den gamla), och den länken ska Anna ha varje gång något är klart. Grenen är en byggprodukt: redigera den aldrig för hand. Provsidan är publik men inte länkad och har `noindex`; stäng av den under *Settings → Pages*. GitHub Pages läser inte `_headers`, så säkerhetshuvudena (CSP m.m.) gäller först på Cloudflare.

## När något ändras

Texter eller citat: ändra i `content/…` (eller be mig synka från Google-dokumentet) och kör

```
python3 paralellsida-for-spakunder/tools/build-content.py
```

Det räcker. Skriptet kontrollerar citaten och håller offline-cachen i takt med sidan, så att gäster
som redan öppnat sidan får den nya versionen. Har etiketterna ändrats: kör `extract-label-art.py`
med de nya PDF-filerna först.

## Together — *A Ritual for Two*

En ny avdelning med egen flik (**Rituals | Together**, och en länk i menyn) på `#/together`. Två personer lyssnar på samma ritual, var och en på sin egen telefon med sina egna hörlurar, och inspelningen startar samtidigt. Första ritualen är **Heart to Heart** (ca 10 minuter). De fem produktritualerna är oförändrade; Together är separata moduler som sanctuaryt klarar sig utan.

### Så ser det ut för gästen

1. **Together → Begin Your Ritual → Heart to Heart → Invite Your Partner.**
2. Person A får en QR-kod och en länk (Share link / Copy link). Person B skannar eller öppnar länken.
3. När båda är där går två ringar ihop på skärmen (ett diskret kvitto), med texten *Your shared moment is almost here.*
4. Båda kopplar sina hörlurar till sin egen telefon och trycker **I'm Ready**. Det trycket är det som tänder ljudet på just den telefonen.
5. När båda är redo kan A trycka **Begin Together**: ett andetag, 3, 2, 1, och inspelningen startar på båda. Skärmen går över till en stilla vy med ljus som rör sig långsamt över vatten.
6. Pausa och fortsätta fungerar från båda telefonerna och gäller båda. Tappar en telefon nätet fortsätter inspelningen ändå. Lämnar en partner står det en stilla rad, och den andra kan lyssna klart.
7. **Listen Together on One Device** är den vanliga spelaren på en telefon, med en rad om att två Bluetooth-hörlurar kräver att telefonen och hörlurarna själva stödjer ljuddelning (sidan kan inte slå på det).

### Så här kopplar du på delade sessioner (en gång, ca 15 minuter, gratis)

**Status:** projektet är redan skapat (`body-mind-earth-together`, organisationen *body mind earth*, Free-planen, region Stockholm) och adressen och den publika nyckeln står i `public/assets/together/config.js`. Stegen nedan gäller om det ska göras om eller flyttas.

Delade sessioner behöver en tjänst som låter de två telefonerna hitta varandra och skicka korta kommandon (ingen ljudström: ljudet spelas från varje telefon för sig). Det är byggt för **Supabase Realtime** (gratis plan räcker).

1. Skapa ett konto och ett projekt på <https://supabase.com> (välj en EU-region). Databasen används inte.
2. **Project Settings → API:** kopiera *Project URL* och den **publika** nyckeln. Den heter *anon public* (börjar `eyJ…`) eller *Publishable key* (börjar `sb_publishable_…`), beroende på hur panelen ser ut just nu.
3. Klistra in dem i `public/assets/together/config.js` (`supabaseUrl` och `supabaseAnonKey`) och kör `python3 paralellsida-for-spakunder/tools/build-content.py`.
4. I projektet: **Realtime → Settings**: kontrollera att publika kanaler är tillåtna (så är det som standard). Rummen är publika kanaler vars namn är hemligt.
5. Lägg ut sidan som vanligt (se ovan). Delade sessioner kräver `https://` (Cloudflare Pages ger det).

**Aldrig** den hemliga nyckeln (*service_role* eller *secret*) i `public/`: allt där skickas till alla besökare. Den publika nyckeln är gjord för det, men räcker bara till att öppna ett rum.
**Tänk på:** Supabase kan pausa gratisprojekt som varit inaktiva en tid (kontrollera aktuella villkor). Då fungerar inte delade sessioner förrän du väcker projektet i panelen. Prova delade sessioner någon gång då och då, och särskilt dagen innan något ska visas.
Utan `config.js`-värden säger sidan att delade sessioner inte är påslagna; ensamläget fungerar ändå. På `localhost` (utan värden) kan du prova skärmarna med två flikar i samma webbläsare.

### Inspelningen till Heart to Heart

Den finns inte än, och ingen är påhittad. Lägg den som `public/assets/audio/together/heart-to-heart.mp3`. Krav (utförligt i `content/together-heart-to-heart-manus.md`): mp3 med konstant bitrate (128 till 192 kbps), minst 1,5 sekunds tystnad först, jämn volym. Manusutkastet i samma mapp är ett förslag att skriva om.
Så länge filen saknas är *Invite Your Partner* avstängd och sidan säger att inspelningen förbereds.
Som i resten av sanctuaryt **lyssnas ritualen bara på**: ingen del av meditationen eller dess manus skrivs ut på sidan eller skickas till telefonen.

### Hur synkroniseringen fungerar (och vad den inte kan lova)

- Båda telefonerna följer **en tidslinje** ("vid tid T är inspelningen på sekund P och spelar"). Begin, Pause och Resume är bara en ny tidslinje; den som trycker styr båda.
- **Gemensam tid** är värdens klocka. Gästens telefon mäter skillnaden mot den (ett par snabba frågor och svar, den snabbaste litar den på) och lägger på den. I testet var gästens klocka 4,3 sekunder fel och startade ändå i takt.
- Inspelningen hämtas **hela först** (så inget kan hacka när den väl börjat), startas **på utsatt tid**, med hänsyn till hur lång tid telefonen behöver för att få ljud, och **kontrolleras varje sekund**: små avvikelser rättas genom att spela ett hår snabbare eller långsammare (3 %), stora genom ett hopp.
- Ljudet spelas av telefonen själv, så det fortsätter med låst skärm och störs inte av ett tappat nät.
- **Gränser, ärligt:** webbläsare ger inte sampelexakt tid. Räkna med att ni ligger i takt inom ett tiotal till ett hundratal millisekunder, i testerna 0 till ca 100. Bluetooth-hörlurar har egen fördröjning (ofta 100 till 300 ms, olika för olika modeller) som webbplatsen inte kan mäta. Det räcker för en guidad ritual med en röst, men det är inte perfekt synk, och sidan lovar det inte.
- **iPhone/Safari** tillåter bara ljud som en människa har bett om. Därför är *I'm Ready* ett eget tryck på varje telefon. Släpper telefonen ändå inte igenom den nätverksstyrda starten visar sidan *Tap to join your partner*; ett tryck, och telefonen hamnar på rätt ställe. Hur just din iPhone beter sig kan bara provas på en riktig iPhone (`TOGETHER-TEST.md`).

### Två personer, och ingen annan

Rummet tar emot en värd och en gäst. Länken är nyckeln, så den som har den kan ansluta, men:
- Varje telefon får ett slumpat **säte** som står sist i sin egen adress (inte i inbjudningslänken, inget lagras). En omladdning behåller sätet och tar tillbaka platsen; ett nytt fönster med samma adress ersätter det gamla (som säger det och tystnar).
- Kommer någon **annan** med inbjudningslänken när platsen redan är tagen visas *This ritual already has two people* och personen störs inte in i pågående ritual: telefonerna lyssnar bara på sin partner.
- Öppnar du inbjudningslänken på en ny telefon medan den gamla ännu syns som ansluten (upp till en minut efter att den stängts av) får du samma besked: vänta en stund och tryck *Try again*.

### Integritet

Inga namn, ingen inloggning, inga profiler. Sidan ber aldrig om mikrofon, kamera, plats eller Bluetooth (och säkerhetshuvudet stänger de tre första). Rummet heter något långt och slumpmässigt (130 bitar) som bara finns i länken, efter `#`: webbhotellet (Cloudflare) ser därför aldrig rumsnamnet. Länken har ett slutdatum inbyggt (3 timmar). Supabase får rumsnamnet (som kanalnamn), ett slumpat id per telefon, "redo"-flaggor och tidsiffror, och **inget sparas**: rummet finns bara medan telefonerna är med. Precis som alla som tar emot en uppkoppling ser Supabase de anslutande telefonernas IP-adresser. Ingen analyserar eller spelar in andning.
Meningen på Sensory Enrichment-sidan ("This sanctuary keeps nothing about you") stämmer fortfarande: ingenting sparas. Vill du vara extra noggrann kan du lägga till "Shared rituals connect through a private room that is deleted when you leave." där.

### Tester

```
cd paralellsida-for-spakunder/tests && npm install
node --test --test-force-exit session.test.js     # sessionslogiken (enhetstester)
node e2e/run.mjs                                 # två telefoner i webbläsare (kräver Chromium och ffmpeg)
node e2e/regression.mjs                          # är de fem ritualerna oförändrade jämfört med före Together?
```

`e2e/run.mjs` kör två separata webbläsare med egna klockor (gästens går 4,3 s fel), den riktiga Supabase-klienten och riktig mp3-uppspelning mot en lokal stand-in för Supabase Realtime (`e2e/mock-realtime.mjs`), och sidans egna säkerhetshuvud (CSP). Det täcker inbjudan, QR-koden (avläst igen med en separat avkodare), Ready, start i takt, paus, återupptagning, tappat nät, blockerad start, omladdning mitt i, att en partner lämnar, felmeddelanden, ensamläget och rörelseavstängning. Det är **inte** den riktiga Supabase-tjänsten, och det är **Chromium, inte iPhone-Safari**: se `TOGETHER-TEST.md`.

### Klart och testat / kräver dig

| | Status |
|---|---|
| Together-flik, landningssida, val av ritual, presentationssida för Heart to Heart | Klart, testat i webbläsare (390 och 360 px breda skärmar) |
| De fem ritualerna | Oförändrade (regressionstestet visar bara flikraden och menylänken som skillnad) |
| Inbjudan: unikt rum, QR-kod, länk, Share/Copy | Klart, testat (QR-koden avläses och stämmer med länken) |
| Närvaro, Ready-kvitto, vänteskärm, Begin Together, nedräkning | Klart, testat med två webbläsare |
| Start i takt, paus/återupptagning, drift-rättning, tappat nät, partner lämnar, omladdning | Klart, testat (0 till ca 100 ms i testmiljön) |
| Reservläge när telefonen blockerar start (*Tap to join your partner*) | Klart, testat genom att simulera en blockerande telefon |
| Listen Together on One Device | Klart, testat |
| Vattenljuset (egna bilder, ingen video, pausas när skärmen inte syns, stilla vid "reduce motion") | Klart |
| **Supabase-projekt och `config.js`** | **Kräver dig** (ca 15 minuter, ovan) |
| **Inspelningen `heart-to-heart.mp3`** | **Kräver dig** (manusutkast och krav finns) |
| **Publicering på `https://`-adress** | **Kräver dig** (Cloudflare Pages, som resten av sidan) |
| **Prov på riktig iPhone-Safari och Android-Chrome**, skärmlås, Bluetooth | **Kräver riktiga telefoner:** `TOGETHER-TEST.md` |
| Riktiga foton (vatten, hud, händer, stenar) | Kräver dig: jag har inga bilder jag får använda. Nu används egna, uträknade ljusreflexer. Foton läggs in i `assets/together/img/` |

## Öppna punkter

- **Inspelningarna är inlagda** (alla elva, 2026-10-10). Repot är publikt: filerna kan hämtas av var och en som har adressen.
- **Texterna är inte klara.** "Meditations mall" ändras fortfarande; citaten och introtexten bygger på kopian från 2026-10-08.
- **Shopify stämmer inte med etiketterna.** Etiketterna har använts som källa. Shopify-sidorna har
  bland annat andra ritualrader och ton-ord (t.ex. "Smoothing" mot etikettens "Hydrating") och en
  garblad ingredienslista för handtvålen ("Coco-Communis Oil"). Uppdatera Shopify efter etiketterna.
- **Ritualsidan** (2026-10-09) är en karusell med fem stora bilder, en i taget, som på Annas förebild (ffern.co): bilden i en tunn ljus ram, ritualens namn över bilden, prickar som visar var man är, och en knapp längst ner (*Enter the ritual*) som följer den bild som syns. Bilderna är Annas Presence-bild där etiketten fått respektive ritualnamn och ledord (*A calmer tomorrow.* m.fl., från hennes första sidas bild). **De visar "Ritual Oil 30 ml", som inte är de riktiga produkterna** (handtvål, handkräm, duschtvål, schampo, kroppslotion, 250 ml), och baksidan med ingredienser är densamma på alla fem. Byt mot riktiga foton genom att lägga en bild per ritual som `public/assets/img/ritual-<id>.webp` (4:5, ca 900 × 1125 px).
- **Första sidan** (2026-10-09) följer Annas skiss: meny till vänster, logotyp i mitten, fotot, rubriken *The Art of Conscious Care*, en rad text och en knapp (*Discover the Rituals*). **Ingen butik** (inget kundvagnsmärke, inga priser, inga länkar ut). Fotot (`public/assets/img/welcome-hero.webp`) är utskuret ur skissen. Det visar 30 ml-flaskor med egna ledord (*A calmer tomorrow.* …) som inte finns på de riktiga etiketterna (250 ml): byt mot ett riktigt produktfoto om de ska stämma. Avslutssidan använder fortfarande den mjukfokuserade olivkvisten (`hero.webp`).
- **Ingen "Visit Body Mind Earth"-knapp,** som skissen hade. Fristaden är stängd.
- **Meningen om webbplatsen** i introt ("You can discover more … on our website.") är utelämnad i texten.
  Den kan fortfarande finnas i den inspelade introt: lyssna igenom `01_Intro_Sensory-Enrichment.mp3`.
- **Språk.** Allt är på engelska, som lådorna och inspelningarna.
- **Kontakt.** Ingen e-postadress är inlagd. Ett färdigt ställe finns i kommentaren i `about()` i `public/assets/app.js`.
- **Integritetsraden** ("keeps nothing about you") stämmer så länge ingen statistik slås på i Cloudflare. Together lägger till att delade sessioner går via Supabase (ingenting sparas där); se "Together → Integritet".

## Typsnitt

Cormorant Garamond och Jost (SIL Open Font License, licenserna ligger i `public/assets/fonts/`).
De ligger på sidan, så gästernas telefoner anropar inga externa tjänster.

## Spa-sidor (en egen sida per spa)

Samma sida, men med ett spas egen bild, namn, tack och väg till bokning. Adressen är **`<sidan>/spas/<spa>/`**: varje spa har en egen mapp med en egen sida (`spas/<spa>/index.html`, gjord av `tools/build-content.py` ur `public/index.html`, med en `<base>` som pekar tillbaka till sajtens rot, så att alla adresser i sidan är oförändrade; därför tillåter `_headers` `base-uri 'self'`). **Varför egen mapp:** appen som en gäst installerar får `scope` = den mappen. Med hela sajten som scope (som det var först) tar ett spas installerade app över *alla* andra spas länkar på Android, och de öppnas i fel app utan installationsmöjlighet (upptäckt i Annas prov 2026-10-19). Den äldre formen `<sidan>/?s=<spa>#/` fungerar fortfarande. Efter `make-spa.py`: kör `python3 paralellsida-for-spakunder/tools/build-content.py`. Utan `?s=` (eller med ett spa som inte finns) är sidan precis som för alla andra.

**Så görs ett spa** (en minut, ingen programmering):

```
python3 paralellsida-for-spakunder/tools/make-spa.py --slug horizon-hill --name "Horizon Hill Spa" --photo foto.jpg \
    --book-url https://spats-bokning.se/boka --shop-url https://spats-shop.se --thanks "Tack för att ni tog er tid med oss."
```

Verktyget beskär bilden, ger den husets färgton (lite lugnare färg, varma ljus, mjuka skuggor) så att alla spa ser lika hemma ut bredvid produkterna, och skriver `public/spas/<slug>/{hero.webp, spa.js, manifest.webmanifest, icon-180/192/512.png}` (sju filer med logga). Valfritt: `--logo`, `--short-name` (namnet under ikonen på telefonen; mobilerna kapar vid ca 9 tecken, så "Horizon" och inte "Horizon Hill"), `--focus x,y` (var i bilden det viktiga är), `--no-grade`. Räkna filer: gratisnivån på Cloudflare tillåter 20 000 filer per sida, alltså ca 2 800 spa med den här mappen; ett spa som tackar nej raderas genom att mappen tas bort (och koden/QR:n slutar fungera).

- **Första sidan:** spats bild med "Welcome to <namn>" över, sedan sidans vanliga text och knapp. Under finns en tyst länk "Experience it at the spa".
- **Efter ritualen:** spats namn och tack, och två knappar: "Experience the ritual at <spa>" till spats egen bokning och **"Refill your products"** till spats egen shop (`--shop-url`). Saknar spat shop går knappen till **husets shop** (`window.BME_HOUSE_SHOP` överst i `public/assets/spa-loader.js`, tom tills Annas shop kan ta emot beställningar; tom = ingen knapp) med spats kod i adressen. Menyn får "Book a visit", "Refill products" och "Add to your phone". Ingen provision till spa (Annas beslut 2026-10-19).
- **Installera som app (en app per spa):** varje spa har eget manifest (`spas/<slug>/manifest.webmanifest`, eget `id`, namn och ikon, `start_url` = spats sida) som `spa-loader.js` pekar på i sidans huvud; ikonen är spats logga på sand, eller (utan logga) spats initialer i husets stil: sandfärgad botten, en fin guldring och initialerna i Cormorant Garamond, som läser bra i en liten rund mask (`--icon photo` ger en kvadrat ur fotot, `--monogram CC` väljer bokstäverna; kräver `pip install fonttools brotli`). **Installera först:** på ett spas första sida stiger en mörk ruta upp efter en stund (efter att välkomstbilden setts), *Keep this sanctuary on your phone* med en guldknapp *Add to home screen* (**visas alltid på Android och iPhone, även innan webbläsaren erbjudit installation**: Chrome erbjuder den först när besökaren tryckt på sidan och varit på den i minst 30 sekunder, så vid ett första besök väntar rutan efter ett tryck (knappen blir svagare, `aria-busy`) upp till 3,5 s på erbjudandet och öppnar telefonens installationsruta av sig själv i samma tryck (Chrome tillåter `prompt()` ett par sekunder efter ett tryck); kommer erbjudandet aldrig säger rutan var man trycker (⋮, *Install app* / *Add to Home screen*); när den erbjuds: ett tryck; **ingen *Not now***, Annas beslut 2026-10-19: rutan ligger kvar tills gästen svarat, och sidan går att scrolla fri från den) eller en rad om delningsikonen (iPhone, som inte går att fråga). Bara på första sidan, inte i en annan apps webbläsare, inte när appen redan är installerad, inte efter att gästen svarat: säger nej i telefonens egen ruta, eller *Got it* på iPhone (inget sparas på telefonen). Tyst länk "Add to your phone" på första sidan, efter ritualen och i menyn: **ett tryck** på Android, där webbläsaren erbjuder installation, öppnar webbläsarens egen installationsruta direkt (ingen sida emellan; Androids egen bekräftelse efter det går inte att ta bort). Lyckas det (telefonen svarar *accepted* eller skickar `appinstalled`) hamnar gästen på startsidan, länken blir raden *Added to your home screen* och en kort bekräftelse (`notify()`) visas några sekunder; säger gästen nej händer ingenting. På iPhone får sidan ingen signal alls. Annars (iPhone, eller Android innan webbläsaren erbjudit det) leder länken till `#/install`: **Android** får en knapp (annars en rad om menyn), **iPhone** får tre steg (dela-ikonen, "Add to Home Screen", "Add"), en sida öppnad i LinkedIn/Instagram m.fl:s egen webbläsare får veta att den ska öppnas i Safari/Chrome, och en redan installerad app visar inga installationslänkar. **Ikonen och webbläsaren:** på Android blir installationen en riktig app utan märke bara i Chrome (och Samsung Internet på Samsung-telefoner). Brave, Firefox, Opera och Edge på Android gör bara en genväg, och en genväg får webbläsarens märke (Bravess lejon) på ikonen; det går inte att ta bort från webbplatsen. **Överlämning till Chrome (Annas beslut 2026-10-19, hon vill hellre ha en riktig app utan Bravess märke):** i Brave, Firefox, Opera och Edge på Android lämnar samma installationstryck över till Chrome (en `intent://`-adress till `com.android.chrome` med samma sida, och en reserv `nochrome=1` om Chrome saknas). **Androids eget val *Välj aktivitet* (Brave eller Chrome) kan komma upp: rutan är telefonens, en sida kan varken förvälja eller dölja den** (Annas prov 2026-10-19). Tar telefonen över (sidan tappar fokus) startas inte webbläsarens egen installation ovanpå; händer inget på 2,5 s används webbläsarens egen. Chrome öppnar sidan (adressen får `h=1`, som sidan själv tar bort ur adressfältet) med rutan som då stiger snabbt (0,35 s) och säger *Almost there. One last tap.*; det trycket kan ingen sida ta bort, eftersom Chrome kräver ett tryck på sidan innan installationsrutan får öppnas. Överlämningen väntar inte på webbläsarens eget erbjudande (rutan är *Add to home screen* direkt i Brave); händer inget på 2,5 s och inget erbjudande finns visas stegen. `googlechrome://navigate?url=` som alternativ till `intent://` är **inte provat** (Chromes stöd i Android ej bekräftat i dokumentation); det skulle möjligen undvika *Välj aktivitet*, eftersom Brave inte hanterar den adressen. Ej använt. Ingen text på sidan nämner webbläsare. På Annas egen telefon: sätt Chrome som standardwebbläsare (Inställningar → Appar → Standardappar → Webbläsarapp). **Provad i Anna Android/Brave: valet kom upp.** Gästens egen standardwebbläsare avgör var en skannad QR öppnas; för de allra flesta är det Chrome. På iPhone finns inget märke. **Diagnos:** lägg `&diag=1` på adressen så visar sidan hur den öppnats (webbläsarsida eller *den installerade appen*), om webbläsaren erbjuder installation och vilket läge rutan har; bra när något inte syns och man inte kan se telefonens skärm. I den installerade appen visas **ingen** installationsruta eller länk (den är ju redan installerad); en skannad QR öppnar den installerade appen på Android. Testat i Chromium (manifest, ikoner och installerbarhet) och på en riktig Android med Brave (Anna 2026-10-19), **inte i Android-Chrome eller på iPhone**: ljud med låst skärm i en hemskärmsapp på iPhone måste provas (se `projects/paralellsida-lansering-forberedelser.md`).
- **Bokningslänken** får `utm_source=bodymindearth&utm_medium=ritual&utm_campaign=<spa>` och öppnas i ny flik utan att skicka något annat (sidan sätter `Referrer-Policy: no-referrer`). Spat ser i sin egen statistik hur många som kommer från ritualen; själva sidan lagrar och spårar inget.
- **Tre påhittade demospa** (`horizon-hill`, `calm-cove`, `fern-hill`) är tre olika appar (eget `id`, namn, ikon): en telefon som har ett av dem installerat kan ändå prova första besöket med de andra. Använd det i stället för att avinstallera. Alla tre får ligga i det publika arkivet (`.gitignore`-undantag).
- **Demon** `spas/horizon-hill/` är ett **påhittat** spa med en fri bild (CC0) som stand-in och en exempel-bokningssida (`spas/horizon-hill/book.html`) som visar vad ett spa skulle se. Den är den enda spa-sidan som får ligga i det publika arkivet.

**Riktiga spa:** deras namn och bilder är deras. `public/spas/` hålls utanför git (`.gitignore`, utom demon). Bygg riktiga spa i en **privat** kopia (eller bara lokalt och ladda upp mappen till Cloudflare), och visa dem för spat via en privat länk. Be om lov för bilden när de säger ja. QR-koden som trycks på produkten ska peka på en **egen domän** (inte github.io eller pages.dev), så att den fungerar även om sidan flyttar.

