# Body Mind Earth — Sensory Ritual (fristaden)

En liten, helt fristående webbplats som gästerna når med QR-koden i Sensory Enrichment-asken.
Fem ritualer (Balance, Luminance, Kindness, Serenity, Presence) som **lyssnas på**: när man trycker
på *Short ritual* eller *Extended ritual* visas en vacker bild och en rad ur meditationen, och
inspelningen startar av sig själv. Man kan pausa, börja om, backa 15 sekunder och söka. Själva
meditationen visas aldrig som text. Ingen butik, inga priser, inga länkar ut, inga cookies och
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

Tre av dem (01, 02 och 04) ligger redan i repot. De övriga åtta är för stora för att hämtas
automatiskt ur Drive; ladda ner dem och lägg dem i mappen (t.ex. via GitHub: öppna
`sanctuary/public/assets/audio`, *Add file → Upload files*, dra in filerna). Saknas en fil säger
spelaren "This recording is not available yet." i stället för att låta tyst.

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
| `tools/make-together-art.py` | Räknar fram ljusreflexerna på vatten (egna bilder, inga foton, inga rättighetsproblem). |
| `tests/` | Automatiska tester (se "Tester"). `TOGETHER-TEST.md` är provlistan för riktiga telefoner. |

## Lägga ut sidan (ca 10 minuter, en gång)

1. Skapa ett gratis konto på <https://dash.cloudflare.com>.
2. **Workers & Pages → Create → Pages → Upload assets.** Döp projektet (t.ex. `body-mind-earth`),
   dra in innehållet i mappen `public/` (med alla elva ljudfiler i `assets/audio/`) och tryck
   *Deploy*. Du får en adress som `body-mind-earth.pages.dev`. En enskild fil får vara högst 25 MB;
   dina är högst 10 MB.
   - Alternativ: *Connect to Git* mot det här repot med *Root directory* `sanctuary`,
     *Build output directory* `public` och inget byggkommando. Då uppdateras sidan automatiskt
     när `master` ändras.
3. Egen adress (rekommenderas innan något trycks): i projektet, *Custom domains → Set up a
   domain*, t.ex. `ritual.bodymindearth.se`. Cloudflare säger vilken DNS-rad som ska läggas
   in hos den som sköter bodymindearth.se.
4. Gör QR-koden med den slutliga adressen och skanna den med en telefon innan tryck:
   `pip install segno` och sedan `python3 sanctuary/tools/make-qr.py https://din-adress`.

## När något ändras

Texter eller citat: ändra i `content/…` (eller be mig synka från Google-dokumentet) och kör

```
python3 sanctuary/tools/build-content.py
```

Det räcker. Skriptet kontrollerar citaten och håller offline-cachen i takt med sidan, så att gäster
som redan öppnat sidan får den nya versionen. Har etiketterna ändrats: kör `extract-label-art.py`
med de nya PDF-filerna först.

## Together — *A Ritual for Two*

En ny avdelning med egen flik (**Rituals | Together**, och en länk i menyn) på `#/together`. Två personer lyssnar på samma ritual, var och en på sin egen telefon med sina egna hörlurar, och inspelningen startar samtidigt. Första ritualen är **Heart to Heart** (ca 10 minuter, fem delar: Arrival, Heart Connection, Shared Breathing, Deepening Connection, Integration). De fem produktritualerna är oförändrade; Together är separata moduler som sanctuaryt klarar sig utan.

### Så ser det ut för gästen

1. **Together → Begin Your Ritual → Heart to Heart → Invite Your Partner.**
2. Person A får en QR-kod och en länk (Share link / Copy link). Person B skannar eller öppnar länken.
3. När båda är där går två ringar ihop på skärmen (ett diskret kvitto), med texten *Your shared moment is almost here.*
4. Båda kopplar sina hörlurar till sin egen telefon och trycker **I'm Ready**. Det trycket är det som tänder ljudet på just den telefonen.
5. När båda är redo kan A trycka **Begin Together**: ett andetag, 3, 2, 1, och inspelningen startar på båda. Skärmen går över till en stilla vy med ljus som rör sig långsamt över vatten.
6. Pausa och fortsätta fungerar från båda telefonerna och gäller båda. Tappar en telefon nätet fortsätter inspelningen ändå. Lämnar en partner står det en stilla rad, och den andra kan lyssna klart.
7. **Listen Together on One Device** är den vanliga spelaren på en telefon, med en rad om att två Bluetooth-hörlurar kräver att telefonen och hörlurarna själva stödjer ljuddelning (sidan kan inte slå på det).

### Så här kopplar du på delade sessioner (en gång, ca 15 minuter, gratis)

Delade sessioner behöver en tjänst som låter de två telefonerna hitta varandra och skicka korta kommandon (ingen ljudström: ljudet spelas från varje telefon för sig). Det är byggt för **Supabase Realtime** (gratis plan räcker).

1. Skapa ett konto och ett projekt på <https://supabase.com> (välj en EU-region). Databasen används inte.
2. **Project Settings → API:** kopiera *Project URL* och den **publika** nyckeln. Den heter *anon public* (börjar `eyJ…`) eller *Publishable key* (börjar `sb_publishable_…`), beroende på hur panelen ser ut just nu.
3. Klistra in dem i `public/assets/together/config.js` (`supabaseUrl` och `supabaseAnonKey`) och kör `python3 sanctuary/tools/build-content.py`.
4. I projektet: **Realtime → Settings**: kontrollera att publika kanaler är tillåtna (så är det som standard). Rummen är publika kanaler vars namn är hemligt.
5. Lägg ut sidan som vanligt (se ovan). Delade sessioner kräver `https://` (Cloudflare Pages ger det).

**Aldrig** den hemliga nyckeln (*service_role* eller *secret*) i `public/`: allt där skickas till alla besökare. Den publika nyckeln är gjord för det, men räcker bara till att öppna ett rum.
**Tänk på:** Supabase kan pausa gratisprojekt som varit inaktiva en tid (kontrollera aktuella villkor). Då fungerar inte delade sessioner förrän du väcker projektet i panelen. Prova delade sessioner någon gång då och då, och särskilt dagen innan något ska visas.
Utan `config.js`-värden säger sidan att delade sessioner inte är påslagna; ensamläget fungerar ändå. På `localhost` (utan värden) kan du prova skärmarna med två flikar i samma webbläsare.

### Inspelningen till Heart to Heart

Den finns inte än, och ingen är påhittad. Lägg den som `public/assets/audio/together/heart-to-heart.mp3`. Krav (utförligt i `content/together-heart-to-heart-manus.md`): mp3 med konstant bitrate (128 till 192 kbps), minst 1,5 sekunds tystnad först, jämn volym. Manusutkastet i samma mapp är ett förslag att skriva om.
Så länge filen saknas är *Invite Your Partner* avstängd och sidan säger att inspelningen förbereds.
När inspelningen är klar kan du fylla i `cues` i `content/together.json` (sekunder där varje del börjar) så visar skärmen delens namn medan den spelas.

### Hur synkroniseringen fungerar (och vad den inte kan lova)

- Båda telefonerna följer **en tidslinje** ("vid tid T är inspelningen på sekund P och spelar"). Begin, Pause och Resume är bara en ny tidslinje; den som trycker styr båda.
- **Gemensam tid** är värdens klocka. Gästens telefon mäter skillnaden mot den (ett par snabba frågor och svar, den snabbaste litar den på) och lägger på den. I testet var gästens klocka 4,3 sekunder fel och startade ändå i takt.
- Inspelningen hämtas **hela först** (så inget kan hacka när den väl börjat), startas **på utsatt tid**, med hänsyn till hur lång tid telefonen behöver för att få ljud, och **kontrolleras varje sekund**: små avvikelser rättas genom att spela ett hår snabbare eller långsammare (3 %), stora genom ett hopp.
- Ljudet spelas av telefonen själv, så det fortsätter med låst skärm och störs inte av ett tappat nät.
- **Gränser, ärligt:** webbläsare ger inte sampelexakt tid. Räkna med att ni ligger i takt inom ett tiotal till ett hundratal millisekunder, i testerna 0 till ca 100. Bluetooth-hörlurar har egen fördröjning (ofta 100 till 300 ms, olika för olika modeller) som webbplatsen inte kan mäta. Det räcker för en guidad ritual med en röst, men det är inte perfekt synk, och sidan lovar det inte.
- **iPhone/Safari** tillåter bara ljud som en människa har bett om. Därför är *I'm Ready* ett eget tryck på varje telefon. Släpper telefonen ändå inte igenom den nätverksstyrda starten visar sidan *Tap to join your partner*; ett tryck, och telefonen hamnar på rätt ställe. Hur just din iPhone beter sig kan bara provas på en riktig iPhone (`TOGETHER-TEST.md`).

### Integritet

Inga namn, ingen inloggning, inga profiler. Sidan ber aldrig om mikrofon, kamera, plats eller Bluetooth (och säkerhetshuvudet stänger de tre första). Rummet heter något långt och slumpmässigt (130 bitar) som bara finns i länken, efter `#`: webbhotellet (Cloudflare) ser därför aldrig rumsnamnet. Länken har ett slutdatum inbyggt (3 timmar). Supabase får rumsnamnet (som kanalnamn), ett slumpat id per telefon, "redo"-flaggor och tidsiffror, och **inget sparas**: rummet finns bara medan telefonerna är med. Precis som alla som tar emot en uppkoppling ser Supabase de anslutande telefonernas IP-adresser. Ingen analyserar eller spelar in andning.
Meningen på Sensory Enrichment-sidan ("This sanctuary keeps nothing about you") stämmer fortfarande: ingenting sparas. Vill du vara extra noggrann kan du lägga till "Shared rituals connect through a private room that is deleted when you leave." där.

### Tester

```
cd sanctuary/tests && npm install
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

- **Åtta inspelningar saknas i repot** (se ovan). Utan dem säger spelaren att inspelningen inte finns än.
- **Texterna är inte klara.** "Meditations mall" ändras fortfarande; citaten och introtexten bygger på kopian från 2026-10-08.
- **Shopify stämmer inte med etiketterna.** Etiketterna har använts som källa. Shopify-sidorna har
  bland annat andra ritualrader och ton-ord (t.ex. "Smoothing" mot etikettens "Hydrating") och en
  garblad ingredienslista för handtvålen ("Coco-Communis Oil"). Uppdatera Shopify efter etiketterna.
- **Bakgrundsfoto.** Välkomstvyn och avslutet använder en mjukfokuserad bit av olivkvisten i kit-fotot
  (`public/assets/img/hero.webp`). Byt mot ett riktigt foto när det finns (varmt, ljust, högt format).
- **Ingen "Visit Body Mind Earth"-knapp,** som skissen hade. Fristaden är stängd.
- **Meningen om webbplatsen** i introt ("You can discover more … on our website.") är utelämnad i texten.
  Den kan fortfarande finnas i den inspelade introt: lyssna igenom `01_Intro_Sensory-Enrichment.mp3`.
- **Språk.** Allt är på engelska, som lådorna och inspelningarna.
- **Kontakt.** Ingen e-postadress är inlagd. Ett färdigt ställe finns i kommentaren i `about()` i `public/assets/app.js`.
- **Integritetsraden** ("keeps nothing about you") stämmer så länge ingen statistik slås på i Cloudflare. Together lägger till att delade sessioner går via Supabase (ingenting sparas där); se "Together → Integritet".

## Typsnitt

Cormorant Garamond och Jost (SIL Open Font License, licenserna ligger i `public/assets/fonts/`).
De ligger på sidan, så gästernas telefoner anropar inga externa tjänster.
