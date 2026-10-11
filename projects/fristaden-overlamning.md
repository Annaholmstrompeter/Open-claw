# Fristaden (Body Mind Earth Sanctuary) — överlämning

*Skriven 2026-10-11 av sessionen "Parallell sida för spakunder". Läs den här filen först, sedan `sanctuary/README.md`. Detaljerad historik: `projects/fristaden-logg.md` (på grenen, se nedan).*

## 0. Så fortsätter du direkt

1. `git pull` på `master` (AGENTS.md → Session Startup), läs den här filen.
2. **All kod ligger på grenen `claude/parallel-page-spakunder-9t2qcg`** (inte mergad till `master`). **Utkast-PR #16**, med bas `ccr-b32990fc-q1bykk` (= fristaden, utkast-PR #15), alltså inte `master`. Arbeta där: `git fetch origin claude/parallel-page-spakunder-9t2qcg && git checkout claude/parallel-page-spakunder-9t2qcg`.
3. Läs `sanctuary/README.md` (hur allt hänger ihop) och kör testerna (avsnitt 5).
4. Plocka nästa punkt i avsnitt 8. När något är klart: **publicera testsidan och ge Anna en ny, verifierad länk** (avsnitt 5).
5. Vill Anna starta en ny session: be henne skriva *"Läs projects/fristaden-overlamning.md och fortsätt med nästa punkt."* Sessionen kan köra i molnet (datorstyrning behövs inte för fristaden).

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
- Together: Supabase-projekt `body-mind-earth-together` (ref `betawmekhlpwplefbzvj`, Stockholm, gratis; kan pausas). Adress + **publik anon-nyckel** i `sanctuary/public/assets/together/config.js`. **Aldrig `service_role` eller hemlig nyckel i repot.** Testsidans Heart to Heart spelar Balance kort som stand-in (läggs bara i testbygget).
- Arkivet `Annaholmstrompeter/Open-claw` är **publikt** och innehåller annat privat (anteckningar). Anna har inte bestämt om det ska bli privat (då slutar GitHub Pages fungera på gratisplanen → Cloudflare).

**Spa-sidor**
- `?s=<slug>` → spats bild + namn över första sidan, spats tack + knapp efter ritualen, bokning i ny flik med `utm_source=bodymindearth&utm_medium=ritual&utm_campaign=<slug>`. Verktyg: `sanctuary/tools/make-spa.py`. Demo: **Horizon Hill Spa** (påhittat; fri CC0-bild som stand-in).
- **Riktiga spa hålls utanför det publika arkivet** (`.gitignore`); bygg dem privat. Deras bilder/logotyper är deras: visa bara spat själv via privat länk, be om lov när de säger ja.

## 4. Gjort (kort)

- Sanctuary-sajten (fem ritualer, 11 inspelningar på plats sedan 2026-10-10), service worker (offline, utom ljud), CSP-säkra `_headers`.
- **Together** (parlyssning): session-/klockmodul, spelare, QR/länk, Ready/Begin/paus, återanslutning, ett-tryck-reserv, en-enhets-läge, vattenljus. 22 enhetstester + e2e mot lokal attrapp av Supabase. **Inte provat mot riktiga Supabase eller riktiga telefoner.**
- Ny första sida, karusell, ritualsida, spelsida, slutsida, Back, bort med gamla färger, alla inspelningar (verifierade: filstorlek, mp3, längd; alla tio spelar i webbläsare och slutar på slutsidan).
- Testsida på GitHub Pages med cache-bust (`?v=`), spa-demo och publiceringsskript som skriver ut länken.
- Tester: `sanctuary/tests` — 22 enhet, 16 e2e, regressionsjämförelse mot sanctuaryt före Together (`e2e/regression.mjs`): ändringar som är avsiktliga är listade i filens huvud.

## 5. Så arbetar du (kommandon)

```
cd sanctuary/tests && npm ci                      # första gången (node_modules ligger inte i git)
node --test --test-force-exit session.test.js     # enhetstester (22)
node e2e/run.mjs                                  # e2e (16, ca 2 min; Chromium finns i /opt/pw-browsers)
node e2e/regression.mjs                           # jämför alla gamla adresser med äldre version
python3 sanctuary/tools/build-content.py          # bygger content.js + sw.js (checka in sw.js efter!)
sanctuary/tools/publish-test-site.sh sanctuary/public/assets/audio/04_Balance_Bergamot-Hand-Wash_KORT.mp3
```

- Skriptet skriver ut en länk `https://…/Open-claw/?v=<tid>#/…`. **Vänta tills sidan är uppe** innan du ger den till Anna: upprepa `curl -s "https://annaholmstrompeter.github.io/Open-claw/?p=$RANDOM" | grep -o 'assets/app.js?v=[0-9]*'` tills numret är det nya (30–90 s). Kolla gärna också att en ny fil finns i `assets/style.css?v=<tid>`.
- Länkar till spa-demon: `…/Open-claw/?s=horizon-hill&v=<tid>#/`. Direktlänkar: `#/r/<id>/s`, `#/r/<id>/e`, `#/r/<id>`, `#/together`.
- Commit-meddelanden på svenska, med de två raderna (Co-Authored-By och Claude-Session) som sessionen anger. Pusha grenen; skapa **utkast**-PR om ingen finns.
- `git push` skriver "push negotiation failed; proceeding anyway": ofarligt.
- `gh` är ogiltig: använd GitHub-verktygen (MCP). Stop-hooken klagar om `sanctuary/public/sw.js` är ändrad men ej incheckad.

## 6. Miljön (fällor)

- Molnbehållaren når **github.io**, Google Drive-filer via `curl -L "https://drive.google.com/uc?export=download&id=<id>"` (Annas filer är delade med länk), men **inte `*.supabase.co`** (Anna kan tillåta det under miljöns *Network access → Allowed domains*), **inte Unsplash/Pexels** (botskydd; kringgå inte), Wikimedia-API:t är strypt. Openverse fungerar (rawpixel CC0 finns bara i 1024 px).
- Driveanslutningens `download_file_content` är oanvändbar för stora filer (base64 genom chatten).
- Datorstyrning fungerar bara i **lokala** sessioner (CLAUDE.md). Fristaden behöver det inte.
- En annan session, **"Blomsterapp design och layout"**, kör lokalt på Annas dator och ska inte störas. Andra sessioner skriver till `master`/andra grenar i samma arkiv; slå ihop med `master` innan du pushar långlivade ändringar.

## 7. Öppet / ej verifierat

- **Parkoppling på två riktiga telefoner mot riktiga Supabase** (checklista `sanctuary/TOGETHER-TEST.md`). Kräver att Anna provar på testsidan; eller tillåt `*.supabase.co` så testar jag härifrån.
- **Riktig iPhone-Safari/Android-Chrome**: ljudstart, skärmlås, Bluetooth, `:has()` (Back dold under parsession; Safari ≥ 15.4).
- **Heart to Heart-inspelning** finns inte (manus: `sanctuary/content/together-heart-to-heart-manus.md`).
- Produktfotona är stand-ins ("Ritual Oil 30 ml"); texten om produkten (250 ml m.m.) är de riktiga uppgifterna. Riktiga foton saknas.
- Demo-spaets foto är en lågupplöst stand-in; byt mot riktigt (Anna skickar en fil; sandlådan hämtar inga stockfoton själv).
- Repot publikt eller privat? Domän? Cloudflare-konto? (Anna beslutar.)
- Integritetstexten ("no cookies, no accounts, no tracking") måste ändras **innan** någon räkning/statistik byggs.

## 8. Planerat (i ordning)

1. Anna provar **Together** på två telefoner (testsidan). Rätta det som visar sig.
2. **Byt demo-spaets foto** mot ett riktigt (`make-spa.py --photo … --focus x,y`).
3. **Produktion:** köp egen domän, lägg upp på Cloudflare Pages (steg i README), peka framtida QR-koder dit. Besluta repo privat/publikt.
4. **Spa-utskick** (Annas plan): kontakt via LinkedIn, **personligt och för hand** (LinkedIn förbjuder automatisering); skapa företagssida (jag skriver texter + banner). **Pilot på 10–20 spa** innan 100–300. Bygg riktiga spa-sidor **privat**; en "kontaktyta" med förhandsbilder (rutnät) för godkännande; privata, ej indexerade länkar; EU:s regler för kall e-post skiljer per land (Tyskland/Österrike strängt) — använd LinkedIn/kontaktformulär.
5. **Mätning per spa** (framtida): räknare för sidöppningar, lyssningar (start/hela vägen) och klick på bokningsknappen, utan cookies/personuppgifter (t.ex. Supabase eller Cloudflare); faktiska bokningar via `utm_*` i spats egen statistik + egen kampanjkod per spa + månadssiffra från spat. Månadsrapport per spa. Sälj aldrig med siffror som inte är verkliga (pilot först). **Uppdatera integritetstexten.**
6. **Röst-tack per spa** efter ritualen (samma röst som meditationerna: filerna är märkta *Tellsonic*; fråga Anna vilket verktyg). Idag finns bara en textrad. Autoplay efter ritualens slut på iPhone måste provas, annars en tryckbar knapp.
7. **Slutsidan** i samma avskalade stil som spelsidan (fråga Anna).
8. Heart to Heart-inspelning (Annas röst/produktion) → `assets/audio/together/heart-to-heart.mp3`.
9. När Anna säger till: sanctuaryt ligger i två lager, **#15** (fristaden före Together, gren `ccr-b32990fc-q1bykk`) och **#16** (den här grenen ovanpå). Slå ihop #15 först, sedan #16 (eller ändra #16:s bas till `master` när #15 är inne). `master` är redan inmergad i grenen. Flytta gärna till Cloudflare Pages före eller samtidigt.

**Förfrågan från en bekant till Anna** (ej beslutad, ej påbörjad): en liknande, lika snygg gratis sida för att sälja en kurs då och då (engångsköp, ingen prenumeration). Rekommenderat upplägg: egen mall utan Annas varumärke i **ett separat projekt**; hosting Cloudflare Pages; betalning via **Stripe Payment Link** (hosted, ingen månadsavgift, avgift bara per genomfört köp) eller inbyggd betalning med en liten serverfunktion; kursinnehåll får inte ligga öppet i publikt arkiv; bekanten skapar och verifierar själv sina Cloudflare- och Stripe-konton. Kostnader att presentera: bygge 0 kr, hosting 0 kr, Stripe-avgift per köp, valfri egen domän ≈ 100–200 kr/år, egen mejladress gratis (vidarebefordran) eller ≈ 60–80 kr/mån för riktig brevlåda.

## 9. Nycklar och hemligheter

Inga hemligheter i repot. Supabase-anon-nyckeln är publik av design. Stripe/Cloudflare-nycklar ska aldrig in i ett publikt arkiv (miljövariabler/Secrets hos tjänsten).
