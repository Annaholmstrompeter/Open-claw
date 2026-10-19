# Paralellsidan: förberedelser inför lanseringen (research 2026-10-19)

*Annas fråga: skicka en unik digital box (QR → spats egen sida) till alla spa hon kontaktar, helst utan kostnad; samma box ska sedan kunna öppnas av varje kund som köper paketet och installeras som app; anonym statistik per spa (öppningar, lyssningar, klick till bokning/shop, ev. ny bokning/köp) utan att följa enskilda kunder. Hitta billigaste sättet.*

Överlämning och beslut: `projects/paralellsida-for-spakunder.md`. Byggbeskrivning: `paralellsida-for-spakunder/README.md`.

## 1. Kort svar

Det går att göra för **0 kr i drift**, oavsett om det är 10 eller 300 spa. En enda gemensam webbplats, en liten mapp per spa (bild, logga, länkar), allt på Cloudflare (gratis). Det enda som kan kosta något är en egen webbadress (underadress till `bodymindearth.se` = 0 kr extra, annars ca 150–300 kr/år) och din/min tid per spa. Statistiken byggs som en egen liten räknare på samma Cloudflare-konto (också 0 kr) och räknar bara **summor** (spa × dag × händelse), aldrig personer.

## 2. Vad som redan finns, och vad som saknas

| Del av Annas önskemål | Status |
|---|---|
| Framsida med spats bild + logga | Finns (`make-spa.py`, `?s=<spa>`, `--logo`) |
| Meditationerna | Finns (fem ritualer, kort/lång, Together) |
| Knapp "upplev ritualen på plats" → spats bokning | Finns (bokning i ny flik med `utm_*`) |
| Knapp "fylla på produkter" → spats shop | **Saknas** (liten ändring: `--shop-url`) |
| Installera som app | **Halvt:** Android-knapp och iPhone-tips finns, men *en* gemensam `manifest.webmanifest` med `start_url "./"`. Installeras sidan från `?s=horizon-hill` öppnar ikonen **den generiska sidan, inte spats**. Kräver egen adress per spa (`/s/<spa>/`) med eget manifest, namn och ikon |
| Anonym statistik | **Saknas** (och integritetstexten "keeps nothing about you" måste ändras samtidigt) |
| Sida för spa-ägaren före köp (förhandsvisning) | Delvis (privat länk); bör räknas separat så Anna ser om spa-ägaren öppnat |
| Massproduktion av spa-sidor | Verktyg för ett spa i taget; behöver kalkylblad → många sidor + QR + PDF |
| Offline-ljud | Ljudet (76 MB) cachas inte; valfri "Save for offline" per meditation |

## 3. Billigaste upplägget (rekommendation)

- **Hosting:** Cloudflare (Pages, eller Workers med statiska filer, samma gratisnivå; Cloudflare pekar nya projekt mot Workers men Pages är inte avvecklat). Gratis: 20 000 filer/sida, 25 MiB/fil (våra mp3 är högst ca 10 MB), 100 egna adresser/projekt. Statiska filer är gratis att leverera.
- **En sida, en mapp per spa**, adress `…/s/<spa>-<4 slumptecken>/` (slumpen hindrar att andra gissar spa-adresser). QR-koden är **statisk** och pekar på *egen adress* (aldrig en "dynamisk QR-tjänst" med månadsavgift som slutar fungera om man slutar betala, och aldrig github.io/pages.dev).
- **Statistik:** egen liten räknare = en Worker + en D1-tabell (`spa, dag, händelse, ritual, antal`). Gratis nivå: 100 000 Worker-anrop/dag och 100 000 D1-skrivningar/dag (index räknas dubbelt) ⇒ räcker till ca **10 000 besök/dag totalt** (≈ 4 händelser/besök). Över det: Workers Paid, ca 5 USD/mån.
- **Statistiksida för Anna:** skyddad med Cloudflare Access (gratis, upp till 50 personer, engångskod till e-post). Månadsrapport per spa genereras som en enkel sida/PDF.

### Varför inte de färdiga alternativen

| Alternativ | Pris | Varför inte (först) |
|---|---|---|
| Cloudflare Web Analytics | gratis | Bara sidvisningar, **inga egna händelser** (kan inte räkna lyssningar/klick) |
| Cloudflare Analytics Engine | gratis (100k/dag) | Sparar bara 90 dagar (D1 sparar för alltid) |
| Umami Cloud Hobby | gratis | 100k händelser/mån, 1 sajt, 6 mån historik: bra som snabb pilot, tar slut |
| Plausible | från ca 9 USD/mån | Kostar från dag ett, stiger med trafik |
| GoatCounter (hostad) | gratis för **icke-kommersiellt** | Annas användning är kommersiell |
| Supabase (finns redan för Together) | gratis | Gratisprojekt **pausas efter 7 dagars inaktivitet** ⇒ statistiken slutar tyst. (Samma risk gäller Together.) |

## 4. Mätning utan att följa kunder

**Händelser (en rad = en summa, ingen person):**
`open` (sidan öppnad) · `play` (lyssning startad, ritual + kort/lång) · `finish` (lyssnat ≥ 90 %) · `book` (klick bokning) · `shop` (klick shop) · `app` (öppnad från hemskärmsikonen) · `install` (Android `appinstalled`) · `preview` (spa-ägarens egen förhandsvisning).

**Utformning:**
- Ingen cookie, inget i telefonens lagring, inget id, ingen IP sparad. Servern accepterar bara en fast lista av händelsenamn och spa-adresser.
- Konsekvens, ärligt: man får **"av 100 öppningar lyssnade 61, 22 hela vägen, 9 klickade bokning"** och **hur ofta ikonen öppnas**, men inte "kund A lyssnade 5 gånger". Det är priset för att inte följa någon.
- iPhone kan inte säga *att* någon la till appen; `app` (öppnad från ikonen) är det ärliga måttet.
- Räknaren är öppen (vem som helst kan skicka en räkning) ⇒ siffrorna kan i teorin pumpas. Bra nog för en månadsrapport, inte för revision. Cloudflares gratis hastighetsgräns kan läggas på.

**Faktiska bokningar/köp** syns inte på vår sida. Billigaste vägarna, bästa först:
1. Går "fylla på" via **Annas Shopify**: rabattkod/länk per spa ⇒ Shopify visar köp per spa exakt, utan att vi spårar kunden.
2. `utm_*` i länkarna (finns): spat ser själva i sin statistik hur många som kom från ritualen.
3. Egen kod/formulering per spa vid bokning ("BME-<spa>"); månadssiffra från spat.
Sälj aldrig med siffror som inte är verkliga (pilot först).

**Juridik (jag är inte jurist):** EU:s ePrivacy-regel gäller även att läsa/skriva på en enhet, inte bara cookies (EDPB:s riktlinjer 2/2023). Vår design lagrar och läser ingenting för att identifiera någon, men låt en jurist (se `juridiska_kontakter.md`) läsa texten innan den stora lanseringen. Integritetstexten måste uppdateras till t.ex. "We count visits anonymously. We never follow you."

## 5. Installera som app

- **Android (Chrome):** knappen finns redan (`beforeinstallprompt`).
- **iPhone:** ingen automatisk installationsruta; tipset *Share → Add to Home Screen* finns. Add to Home Screen i tredjepartswebbläsare (Brave) finns sedan iOS 16.4 enligt källor, men **Brave är inte bekräftat**: testa Safari *och* Brave.
- **Per spa:** eget manifest (namn, ikon = spats logga på sandfärg, `start_url` = spats adress). Utan det öppnar ikonen fel sida.
- **Största tekniska risken: ljudet på iPhone med låst skärm i en hemskärmsapp.** Utvecklarforum/Apple-forum (även iOS 26) rapporterar att uppspelning kan stanna när skärmen låses eller efter ca 30 s paus, och att nästa spår inte startar. Det finns Wake Lock (håller skärmen tänd), som enligt källa fungerar i hemskärmsappar från iOS 18.4. **Inget av detta är testat av mig; det måste provas på en riktig iPhone innan något utlovas.** Reserv: lyssna i webbläsaren (där låst skärm fungerar enligt rapporter) eller Wake Lock under spelning.
- En riktig App Store-app (99 USD/år hos Apple) är inte billigast och behövs inte om testet går bra.

## 6. Rättigheter

Spats logga och bilder är deras. För en **privat förhandsvisning** som bara skickas till spat själv: använd bilder från deras egen sajt utan igenkännbara personer, ingen indexering, ta bort på begäran, och be uttryckligen om lov när de säger ja (som redan är bestämt i överlämningen). Riktiga spa byggs privat (utanför det publika arkivet).

## 7. Förberedelser, i ordning

**Beslut av Anna**
1. Adress: underadress till `bodymindearth.se` (`ritual.bodymindearth.se`)? MEMORY.md nämner att den domänen kopplas; en underadress via CNAME kostar 0 kr och kräver **inte** att hela domänen flyttas (butiken ligger där). Kontrollera hos domänleverantören att CNAME på underadress går att lägga.
2. "Fylla på produkter": spats egen shop (vi länkar bara) eller Annas Shopify (då mäts köp exakt per spa)?
3. Arkivet publikt/privat; riktiga spa i ett separat **privat** arkiv.

**Jag bygger (0 kr)**
1. Egen adress + manifest + ikon per spa (installerbar som spats app).
2. Shopknapp, tydliga knappar ("Experience it at the spa", "Refill your products").
3. Anonym räknare (Worker + D1) + händelser i appen + uppdaterad integritetstext.
4. Statistiksida (Cloudflare Access) + månadsrapport per spa.
5. Spa-fabrik: kalkylark/Google-formulär → många spa-sidor + statisk QR + tryckfärdig PDF.
6. "Save for offline" per meditation (valfritt).

**Anna gör**
1. Cloudflare-konto (gratis), ev. domän/CNAME, betalningar och inloggningar själv.
2. Prov på riktig iPhone (Safari + Brave): installera som app, spela, lås skärmen.
3. Material för 3 pilotspa (logga, bild, bokningslänk, shoplänk, tackrad).

## 7b. Skala: tusentals spa-kit, förtryckta koder, shop-reserv (Annas följdfråga 2026-10-19)

**Samma adress för alla:** ja. En underadress (`ritual.bodymindearth.se`) räcker för 3000 spa; det som skiljer är vägen efter, `…/s/<kod>`. Domänen ställs in en gång.

**Filgränsen (kontrollerad):** gratisnivån tillåter 20 000 filer per sida/Worker (betald 100 000; filstorlek 25 MiB; förfrågningar på statiska filer är gratis). Dagens modell, en mapp per spa med ca 8 filer (foto, logga, `spa.js`, `index.html`, manifest, tre ikoner), blir 3000 × 8 = 24 000 filer ⇒ går **inte** på gratisnivån. Därför för tusentals spa:
- ett spa = **en rad** (kod, namn, bokningslänk, shoplänk, tack, bildnamn) i D1 + **foto och ikon/logga i R2** (Cloudflare R2: 10 GB lagring, 1 M skrivningar och 10 M läsningar/mån gratis, utleverans gratis);
- sidan blir **en enda mall** som fylls i från raden; manifest (namn, ikon, `id`, `start_url`, `scope`) skapas av servern per spa.
- Storlek: demospats foto 67 KB + logga ca 33 KB + ikon ca 80 KB ≈ 180 KB/spa ⇒ ca 0,5 GB för 3000 (långt under 10 GB).

**Förtryckta koder:** en tryckt QR går inte att ändra. Skapa därför alla 3000 koder i förväg (slumpade, 6–8 tecken, `…/s/<kod>`); ett spa utan uppgifter ännu visar en fin standardbox (med Annas shop), och spats bild/logga/länkar läggs på raden senare utan att koden ändras. Spa-listan (kod ↔ spa) är då sanningen och måste säkerhetskopieras. Skriv ut en CSV → tryckfil (SVG/PDF) med en QR per kod.

**En app per spa på samma adress:** källor säger att flera installerbara appar på samma adress går om varje har eget manifest-id, `start_url` och `scope` (icke-överlappande sökvägar), men Chromium rekommenderar egen adress per app och appar på samma adress delar lagring/inställningar (vi sparar inget). **Ska provas på riktiga telefoner (Android och iPhone):** att två olika spas boxar blir två separata ikoner. Service workern får inte förhandscacha alla spa, bara det besökta.

**Statistik vid 3000 spa:** gratisgränsen (ca 10 000 besök/dag totalt) tar slut om spa-kunderna blir många; räkna med Workers Paid ca 5 USD/mån då. Månadsrapporter per spa måste genereras automatiskt.

**Det som inte skalar är handarbetet, inte tekniken:** att samla logga/foto/länkar från varje spa. Förslag: nivå 1 "grundbox" skapas automatiskt ur listan (namn + länkar + standardbild), nivå 2 "full box" när spat skickar eget material (formulär) eller säger ja till att vi använder deras bild/logga.

**Fylla på:** har spat en `shopUrl` ⇒ knappen går dit. Saknas den ⇒ knappen går till **Annas shop** med `utm_source=bodymindearth&utm_medium=box&utm_campaign=<kod>` (och en rabattkod per spa om Anna vill) så att Shopify visar köp per spa utan att kunden spåras. Beslut kvar: ska ett spa få provision på köp via Annas shop?

## 8. Källor

- Cloudflare Pages limits: <https://developers.cloudflare.com/pages/platform/limits>
- Pages → Workers (statiska filer): <https://developers.cloudflare.com/workers/static-assets/migrate-from-pages/>
- Analytics Engine priser: <https://developers.cloudflare.com/analytics/analytics-engine/pricing>
- Workers priser: <https://developers.cloudflare.com/workers/platform/pricing/>
- D1 priser: <https://developers.cloudflare.com/d1/platform/pricing/>
- Cloudflare Access (gratis, 50 användare): <https://www.cloudflare.com/en-gb/products/zero-trust/access>
- Umami Cloud: <https://docs.umami.is/docs/cloud/faq>
- Plausible (tredjepartsuppgifter, oense): <https://seline.com/blog/plausible-analytics-pricing>
- GoatCounter: <https://github.com/anarcat/goatcounter>, <https://goatcounter.com/>
- Supabase gratisgränser (tredjepartsuppgifter): <https://automationatlas.io/answers/supabase-free-tier-limits-2026/>
- iOS Add to Home Screen/webbappar: <https://heise.de/-10749652>
- iOS PWA-ljud, låst skärm: <https://developer.apple.com/forums/thread/762582>, <https://developer.apple.com/forums/thread/805900>, <https://bugs.webkit.org/show_bug.cgi?id=261858>
- Workers statiska filer, gränser: <https://developers.cloudflare.com/changelog/post/2025-09-02-increased-static-asset-limits/>
- R2 priser: <https://developers.cloudflare.com/r2/pricing>
- Flera appar på en adress (manifest-id, scope): <https://web.dev/learn/pwa/web-app-manifest>, <https://lists.w3.org/Archives/Public/public-webapps-github/2021Nov/0219.html>
- Wake Lock: <https://bugs.webkit.org/show_bug.cgi?id=254545>, <https://progressier.com/pwa-capabilities/screen-wake-lock>
- EDPB 2/2023 (ePrivacy art. 5(3)): <https://www.mccannfitzgerald.com/knowledge/data-privacy-and-cyber-risk/keeping-track-of-article-53-edpb-publishes-proposed-guidelines>

**Ej verifierat:** officiella .se-priser (jag hittade bara återförsäljarlistor, ca 17–30 USD/år), om Cloudflare Registrar säljer .se, exakta Plausible-priser, Brave-stöd för Add to Home Screen, iPhone-ljud med låst skärm i dag.
