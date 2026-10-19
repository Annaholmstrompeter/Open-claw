# Paralellsida för spakunder (fristaden, Body Mind Earth Sanctuary) — överlämning

*Annas namn på projektet: **paralellsida för spakunder**. Mappen hette tidigare `sanctuary/` och projektet kallades "fristaden" (båda namnen finns kvar i texter och gamla loggar). Omdöpt och inmergat i `master` 2026-10-14, så att alla sessioner hittar det.*

*Skriven 2026-10-11 av sessionen "Parallell sida för spakunder". Läs den här filen först, sedan `paralellsida-for-spakunder/README.md`. Detaljerad historik: `projects/paralellsida-for-spakunder-logg.md` (på grenen, se nedan).*

*Drive (Annas översikt, 2026-10-19): dokumentet **02 – BME Digital spa-box (QR till egen app) – plan, kostnad & status** i mappen 04 Hotell, spa & B2B-kunder: https://docs.google.com/document/d/1tEq0a79KvnkkPJgQraPuzTMOx9sVtAADYaGDP8vkSCA/edit . Uppdatera den filen, skapa ingen dubblett. Drive-dokumenten 06 (status) och 00 (projektkarta) säger fortfarande att köpknappen inte ska aktiveras utan spats egen checkout; det är ersatt av Annas besked 2026-10-19 men kunde inte ändras från molnsessionen (Google Docs-redigeraren är inte kopplad, bara Drive).*

## 0. Så fortsätter du direkt

1. `git pull` på `master` (AGENTS.md → Session Startup), läs den här filen.
2. **All kod ligger på `master`, i mappen `paralellsida-for-spakunder/`** (utkast-PR #15 och #16 inmergade 2026-10-14). Arbeta på en egen gren eller direkt mot `master` enligt `CLAUDE.md` → Sync convention. Äldre grenar (`ccr-b32990fc-q1bykk`, `claude/parallel-page-spakunder-9t2qcg`) behövs inte längre, men `ccr-b32990fc-q1bykk` är jämförelsebasen för regressionstestet (`e2e/regression.mjs`) och får inte tas bort.
3. Läs `paralellsida-for-spakunder/README.md` (hur allt hänger ihop) och kör testerna (avsnitt 5).
4. Plocka nästa punkt i avsnitt 8. När något är klart: **publicera testsidan och ge Anna en ny, verifierad länk** (avsnitt 5).
5. Vill Anna starta en ny session: be henne skriva *"Läs projects/paralellsida-for-spakunder.md och fortsätt med nästa punkt."* Sessionen kan köra i molnet (datorstyrning behövs inte för fristaden).

## 1. Anna och hur hon vill att jag jobbar

- Svenska i chatten. Hon är **mycket oteknisk** och vill att jag **gör sakerna åt henne**; guida steg för steg med skärmdumpar när hon måste göra något själv (inloggning, bankuppgifter och betalningar gör hon alltid själv).
- **Ge alltid en ny, uppdaterad länk när något är klart** (hennes uttryckliga önskan). Verifiera först att sidan är uppe (avsnitt 5).
- Hon kollar på **iPhone i Brave**; synlig yta ≈ **390 × 737 px**. Kolla layout i 390×737, 390×780, 360×640 (och 390×844).
- Hon ogillar dekor och färg: *"Fy. Nej."* gäller allt som inte liknar förebilden. Hon vill ha **avskalat, platt, dyrt, världsklass**. Förebild: ffern.co (hon kallar det "bonjil"). När hon säger att något är fel: ta reda på *vad* i hennes referensbilder som skiljer, kopiera inte bara stilen på ytan.
- Var ärlig om vad som inte är provat (riktig Supabase, riktig iPhone-Safari, riktiga telefoner). Inga påhittade siffror (forskning/statistik).
- Fråga innan utåtriktade eller kostnadsdrivande saker (molntjänster, publicering). Hon sa ja till Supabase och GitHub Pages för test.

## 2. Vad fristaden är

Stängd, statisk QR-sida för spa-kunder (askens QR-kod → `#/`). **Fem ritualer** (Balance, Luminance, Kindness, Serenity, Presence), var och en kort + lång, bara att **lyssna på**. Plus **Together – A Ritual for Two** (två telefoner, synkad lyssning via Supabase Realtime) och **spa-sidor** (`?s=<spa>`). Ingen shop, inga priser, inga cookies, ingen spårning (idag).

## 3. Överenskommet (beslut)

**Innehåll**
- Meditationer visas **aldrig som text**. På spelsidan visas bara en rad ur inspelningen (finns i `content/`).
- **Ingen shop / inga priser / inga externa länkar** på huvudsidan (ett test vaktar det). Undantag av design: spa-sidor länkar till spats egen bokning.
- Språk på sidan och i inspelningarna: engelska.
- Gamla etikettens färger (rosa/grönt/plommon/brunt/koppar) är **borta**; nya etiketten är sand/kräm/guld (produktfotot). Inga ritualfärger någonstans.

**Utseende**
- Första sidan: Annas skiss (bild av flaskorna, *The Art of Conscious Care*, knappen *Discover the Rituals*, tyst länk *About Sensory Enrichment*).
- Rituals (`#/rituals`): karusell med fem stora bilder (4:5, tunn ram, namnet i vitt över), små prickar, platt guldknapp längst ner.
- Ritualens sida (`#/r/<id>`): bild, produkt · doft, ledordet, **båda längderna alltid synliga** (inspelning saknas → stilla *Soon*), fällbara delar (om produkten / ritualen / formel & ingredienser).
- Spelsidan (`#/r/<id>/s|e`): **nattbotten `#1b140e`**, produktfotot stiger ur mörkret, namnet i spärrade versaler, en rad ur inspelningen, hårfin tidslinje (stor träffyta, dras med fingret) och **en** knapp (play/pause, tunn guldring). Inget annat.
- Slutsidan (`/done`): ledordet, artkortet, platt guldknapp. Ej gjord lika avskalad som spelsidan (Anna har inte bett om det).
- **Back-pil** på alla sidor utom första sidan: fast, **längst ner mitt på skärmen**, går till sidan före. Dold under levande parsession. Home: loggan, menyn och tysta *Home*-länkar.
- Allt i en kodbas, **ES5-stil utan ramverk**, hash-routing i `app.js`, innehåll i `content.js` (genereras av `tools/build-content.py` ur `content/`).

**Teknik/hosting**
- Test: **GitHub Pages** från grenen `gh-pages` (byggprodukt, force-pushas av `publish-test-site.sh`, redigeras aldrig för hand). Adress: `https://annaholmstrompeter.github.io/Open-claw/`. Publik, `noindex`.
- Produktion: **Cloudflare Pages** (gratis, tillåter försäljning; GitHub Pages villkor tillåter inte e-handel). **Egen domän innan någon QR trycks** (annars slutar de fungera när sidan flyttar). Steg i README.
- Together: Supabase-projekt `body-mind-earth-together` (ref `betawmekhlpwplefbzvj`, Stockholm, gratis; kan pausas). Adress + **publik anon-nyckel** i `paralellsida-for-spakunder/public/assets/together/config.js`. **Aldrig `service_role` eller hemlig nyckel i repot.** Testsidans Heart to Heart spelar Balance kort som stand-in (läggs bara i testbygget).
- Arkivet `Annaholmstrompeter/Open-claw` är **publikt** och innehåller annat privat (anteckningar). Anna har inte bestämt om det ska bli privat (då slutar GitHub Pages fungera på gratisplanen → Cloudflare).

**Spa-sidor**
- **Spats sida: `<sajten>/spas/<slug>/`** (egen mapp = egen app med eget scope; `build-content.py` gör `spas/<slug>/index.html`; äldre `?s=<slug>` fungerar). QR-koden ska peka på den adressen. Skälet: med sajtens rot som scope kapar ett spas installerade app alla andra spas länkar (Android). → spats bild + namn över första sidan, spats tack + knapp efter ritualen, bokning i ny flik med `utm_source=bodymindearth&utm_medium=ritual&utm_campaign=<slug>`. Verktyg: `paralellsida-for-spakunder/tools/make-spa.py`. Demo: **Horizon Hill Spa** (påhittat; fri CC0-bild som stand-in).
- **Knapparna efter ritualen (Annas beslut 2026-10-19):** *Experience the ritual at <spa>* → spats egen bokning; *Refill your products* → **spats egen shop, och har spat ingen → Annas egen shop** (`window.BME_HOUSE_SHOP` i `public/assets/spa-loader.js`, **tom tills Annas shop kan ta emot beställningar**; tom = ingen knapp). Ingen provision till spa: spats vinst är att boxen finns kvar hos kunden och visar spat vid varje användning. Notera: Drive-dokument 06 och projektkartan (2026-10-19) säger fortfarande att köpknappen *inte* ska aktiveras utan egen checkout; Annas senare besked ersätter det.
- **Installera som app, en app per spa:** `spas/<slug>/manifest.webmanifest` + ikoner, `#/install` (Android: webbläsarens ruta, iPhone: tre steg, LinkedIn-webbläsare: öppna i Safari/Chrome). Se README → Spa-sidor.
- **Skala:** Anna kontaktar många (t.ex. 3 000), räknar med att många säger nej: deras mappar under `public/spas/` raderas och nya byggs. Håll under 20 000 filer (ca 7 per spa ⇒ ca 2 800 spa) så länge allt ligger gratis på Cloudflare. Mer: `projects/paralellsida-lansering-forberedelser.md`.
- **Riktiga spa hålls utanför det publika arkivet** (`.gitignore`); bygg dem privat. Deras bilder/logotyper är deras: visa bara spat själv via privat länk, be om lov när de säger ja.

## 4. Gjort (kort)

- Sanctuary-sajten (fem ritualer, 11 inspelningar på plats sedan 2026-10-10), service worker (offline, utom ljud), CSP-säkra `_headers`.
- **Together** (parlyssning): session-/klockmodul, spelare, QR/länk, Ready/Begin/paus, återanslutning, ett-tryck-reserv, en-enhets-läge, vattenljus. 22 enhetstester + e2e mot lokal attrapp av Supabase. **Inte provat mot riktiga Supabase eller riktiga telefoner.**
- Ny första sida, karusell, ritualsida, spelsida, slutsida, Back, bort med gamla färger, alla inspelningar (verifierade: filstorlek, mp3, längd; alla tio spelar i webbläsare och slutar på slutsidan).
- Testsida på GitHub Pages med cache-bust (`?v=`), spa-demo och publiceringsskript som skriver ut länken.
- Tester: `paralellsida-for-spakunder/tests` — 22 enhet, 16 e2e, regressionsjämförelse mot sanctuaryt före Together (`e2e/regression.mjs`): ändringar som är avsiktliga är listade i filens huvud.

## 5. Så arbetar du (kommandon)

```
cd paralellsida-for-spakunder/tests && npm ci                      # första gången (node_modules ligger inte i git)
node --test --test-force-exit session.test.js     # enhetstester (22)
node e2e/run.mjs                                  # e2e (16, ca 2 min; Chromium finns i /opt/pw-browsers)
node e2e/regression.mjs                           # jämför alla gamla adresser med äldre version
python3 paralellsida-for-spakunder/tools/build-content.py          # bygger content.js + sw.js (checka in sw.js efter!)
paralellsida-for-spakunder/tools/publish-test-site.sh paralellsida-for-spakunder/public/assets/audio/04_Balance_Bergamot-Hand-Wash_KORT.mp3
```

- Skriptet skriver ut en länk `https://…/Open-claw/?v=<tid>#/…`. **Vänta tills sidan är uppe** innan du ger den till Anna: upprepa `curl -s "https://annaholmstrompeter.github.io/Open-claw/?p=$RANDOM" | grep -o 'assets/app.js?v=[0-9]*'` tills numret är det nya (30–90 s). Kolla gärna också att en ny fil finns i `assets/style.css?v=<tid>`.
- Länkar till spa-demon: `…/Open-claw/spas/horizon-hill/` (också `calm-cove`, `fern-hill`; äldre form `…/?s=horizon-hill&v=<tid>#/`). Direktlänkar: `#/r/<id>/s`, `#/r/<id>/e`, `#/r/<id>`, `#/together`.
- Commit-meddelanden på svenska, med de två raderna (Co-Authored-By och Claude-Session) som sessionen anger. Pusha grenen; skapa **utkast**-PR om ingen finns.
- `git push` skriver "push negotiation failed; proceeding anyway": ofarligt.
- `build-content.py` behöver Python-paketet `mutagen` (`pip install mutagen`) för att räkna ut inspelningarnas längder; utan det skriver den "no recording yet" för alla ritualer och sätter `min` till `null` i `content.js` (sidan visar då inga minuter). Kolla `git diff content.js` efter bygget: har du inte ändrat innehållet ska den vara oförändrad.
- Regressionstestet behöver grenen `origin/ccr-b32990fc-q1bykk` hämtad (`git fetch origin ccr-b32990fc-q1bykk`).
- `e2e/run.mjs`: testet med två telefoner mäter millisekunder och föll en gång i en full körning (tre av tre gröna ensamt); kör om innan du letar fel.
- `gh` är ogiltig: använd GitHub-verktygen (MCP). Stop-hooken klagar om `paralellsida-for-spakunder/public/sw.js` är ändrad men ej incheckad.

## 6. Miljön (fällor)

- Molnbehållaren når **github.io**, Google Drive-filer via `curl -L "https://drive.google.com/uc?export=download&id=<id>"` (Annas filer är delade med länk), men **inte `*.supabase.co`** (Anna kan tillåta det under miljöns *Network access → Allowed domains*), **inte Unsplash/Pexels** (botskydd; kringgå inte), Wikimedia-API:t är strypt. Openverse fungerar (rawpixel CC0 finns bara i 1024 px).
- Driveanslutningens `download_file_content` är oanvändbar för stora filer (base64 genom chatten).
- Datorstyrning fungerar bara i **lokala** sessioner (CLAUDE.md). Fristaden behöver det inte.
- En annan session, **"Blomsterapp design och layout"**, kör lokalt på Annas dator och ska inte störas. Andra sessioner skriver till `master`/andra grenar i samma arkiv; slå ihop med `master` innan du pushar långlivade ändringar.

## 7. Öppet / ej verifierat

- **Parkoppling på två riktiga telefoner mot riktiga Supabase** (checklista `paralellsida-for-spakunder/TOGETHER-TEST.md`). Kräver att Anna provar på testsidan; eller tillåt `*.supabase.co` så testar jag härifrån.
- **Riktig iPhone-Safari/Android-Chrome**: ljudstart, skärmlås, Bluetooth, `:has()` (Back dold under parsession; Safari ≥ 15.4).
- **Heart to Heart-inspelning** finns inte (manus: `paralellsida-for-spakunder/content/together-heart-to-heart-manus.md`).
- Produktfotona är stand-ins ("Ritual Oil 30 ml"); texten om produkten (250 ml m.m.) är de riktiga uppgifterna. Riktiga foton saknas.
- Demo-spaets foto är en lågupplöst stand-in; byt mot riktigt (Anna skickar en fil; sandlådan hämtar inga stockfoton själv).
- Repot publikt eller privat? Domän? Cloudflare-konto? (Anna beslutar.) Annas Shopify (`9w0qpc-07.myshopify.com`) står på planen **"Pause and Build"** (2026-10-19), avsedd för att bygga utan att sälja: kontrollera att kunder kan köpa innan husets shop-knapp slås på.
- **Fälla vid prov på Android:** tar man bara bort *ikonen* är appen kvar (Chrome gör en riktig app, WebAPK); en skannad QR eller länk öppnar då den installerade appen, där ingen installationsruta visas. **Avinstallera appen** (håll in ikonen → App-info → Avinstallera, eller Inställningar → Appar) före varje prov av första besöket, eller visa på en telefon utan appen. `&diag=1` på adressen visar hur sidan öppnats. Enklast: prova med ett av de andra påhittade demospaen (`calm-cove`, `fern-hill`), som är separata appar.
- **Android-prov (Anna, Brave, 2026-10-19):** Brave gör bara en genväg (Bravess lejon på ikonen och en extra Android-ruta); en riktig app utan märke kräver Chrome (eller Samsung Internet på Samsung). Överlämning till Chrome togs bort (den gav Androids val *Välj aktivitet* Brave/Chrome) men **lades tillbaka på Annas begäran** (hon vill hellre ha Chrome): knappen lämnar över till Chrome via `intent://`; valet i Android kan inte förväljas eller döljas av en sida. Det som gör upplevelsen automatisk och permanent på hennes telefon är att sätta Chrome som standardwebbläsare. **Antal tryck (2026-10-19, andra varvet):** i Chrome (de flesta gäster): knappen i rutan + Androids egen *Installera* = 2 och inte färre (Chrome kräver ett tryck på sidan och en bekräftelse). Från Brave: knappen + (ev. *Välj aktivitet*) + knappen i Chrome (rutan säger *Almost there. One last tap.*) + *Installera*. Rutan väntar nu in webbläsarens erbjudande efter första trycket så att trycket inte "går förlorat" till en stegtext. Möjligt men **oprovat** nästa steg om valet *Välj aktivitet* kvarstår: `googlechrome://navigate?url=...` i stället för `intent://`.
- **Installera som app är provat i Chromium och en riktig Android med Brave** (manifest, ikoner, installerbarhet, knappar). Ej provat: Android-Chrome, iPhone Safari och Brave, två spa-appar på samma telefon, **ljud med låst skärm i en hemskärmsapp på iPhone** (rapporter om att uppspelning kan stanna).
- **Supabase `body-mind-earth-together` är pausat** (mejl 2026-10-18). Det påverkar bara Together (parlyssning); spa-sidorna och app-installationen använder inte Supabase.
- Integritetstexten ("no cookies, no accounts, no tracking") måste ändras **innan** någon räkning/statistik byggs.

## 8. Planerat (i ordning)

1. Anna provar **Together** på två telefoner (testsidan). Rätta det som visar sig.
2. **Byt demo-spaets foto** mot ett riktigt (`make-spa.py --photo … --focus x,y`). **Ett provspa** med riktiga bokning- och shoplänkar byggs privat (Anna väljer vilket) och provas på riktig Android och iPhone (installera, spela, lås skärmen).
3. **Produktion:** köp egen domän, lägg upp på Cloudflare Pages (steg i README), peka framtida QR-koder dit. Besluta repo privat/publikt.
4. **Spa-utskick** (Annas plan): kontakt via LinkedIn, **personligt och för hand** (LinkedIn förbjuder automatisering); skapa företagssida (jag skriver texter + banner). **Pilot på 10–20 spa** innan 100–300. Bygg riktiga spa-sidor **privat**; en "kontaktyta" med förhandsbilder (rutnät) för godkännande; privata, ej indexerade länkar; EU:s regler för kall e-post skiljer per land (Tyskland/Österrike strängt) — använd LinkedIn/kontaktformulär.
5. **Mätning per spa** (framtida; research och billigaste upplägg 2026-10-19 i `projects/paralellsida-lansering-forberedelser.md`): räknare för sidöppningar, lyssningar (start/hela vägen) och klick på bokningsknappen, utan cookies/personuppgifter (t.ex. Supabase eller Cloudflare); faktiska bokningar via `utm_*` i spats egen statistik + egen kampanjkod per spa + månadssiffra från spat. Månadsrapport per spa. Sälj aldrig med siffror som inte är verkliga (pilot först). **Uppdatera integritetstexten.**
6. **Röst-tack per spa** efter ritualen (samma röst som meditationerna: filerna är märkta *Tellsonic*; fråga Anna vilket verktyg). Idag finns bara en textrad. Autoplay efter ritualens slut på iPhone måste provas, annars en tryckbar knapp.
7. **Slutsidan** i samma avskalade stil som spelsidan (fråga Anna).
8. Heart to Heart-inspelning (Annas röst/produktion) → `assets/audio/together/heart-to-heart.mp3`.
9. ~~Slå ihop #15 och #16~~ **Klart 2026-10-14** (Anna bad om att arbetet ska gå att hitta från vilken chatt som helst). Mappen döptes om från `sanctuary/` till `paralellsida-for-spakunder/`. Flytta gärna till Cloudflare Pages före tryck.

**Förfrågan från en bekant till Anna** (ej beslutad, ej påbörjad): en liknande, lika snygg gratis sida för att sälja en kurs då och då (engångsköp, ingen prenumeration). Rekommenderat upplägg: egen mall utan Annas varumärke i **ett separat projekt**; hosting Cloudflare Pages; betalning via **Stripe Payment Link** (hosted, ingen månadsavgift, avgift bara per genomfört köp) eller inbyggd betalning med en liten serverfunktion; kursinnehåll får inte ligga öppet i publikt arkiv; bekanten skapar och verifierar själv sina Cloudflare- och Stripe-konton. Kostnader att presentera: bygge 0 kr, hosting 0 kr, Stripe-avgift per köp, valfri egen domän ≈ 100–200 kr/år, egen mejladress gratis (vidarebefordran) eller ≈ 60–80 kr/mån för riktig brevlåda.

## 9. Nycklar och hemligheter

Inga hemligheter i repot. Supabase-anon-nyckeln är publik av design. Stripe/Cloudflare-nycklar ska aldrig in i ett publikt arkiv (miljövariabler/Secrets hos tjänsten).
