# Buketträknaren: plan för grossistanslutning

**Status:** plan, ingen implementation. Skriven ovanpå PR #9 (som inte är mergad och inte ska mergas än).
**Princip:** Floristen ska uppleva *Anslut. Välj blommor. Se priset.* Resten är vårt problem.

Markeringen **(ej verifierat)** betyder att jag inte har kunnat kontrollera påståendet här. Nätverket i min miljö blockerar bland annat floriday.io, lambes.se och stjarnblom.se, och jag har inte sett någon grossists riktiga webbutik, API-dokumentation eller villkor. Allt som rör en enskild grossist måste därför bekräftas med riktig åtkomst innan vi bygger på det.

---

## 0. Kort version

1. **Behåll** räknemotorn, förpackningslogiken, "pris saknas aldrig 0 kr", ca/ålder-visningen och förhandsgranskningen före byte av priser. Allt det har bevisat värde.
2. **Göm** hela "Hämta pris"-panelen (skärmdumpar, ChatGPT Work, brevlåda, AI-chatt, inklistring). Den flyttas till en reservväg under "Importera prislista".
3. **Bygg** ett gemensamt grossistgränssnitt (`SupplierConnector`). Appen känner bara till det, aldrig till en enskild grossist.
4. **Inloggning:** tre vägar som alla slutar i samma "Grossist ansluten ✓": officiell inloggning/API, personlig prisfil-länk, eller en fjärrwebbläsare där floristen loggar in på grossistens riktiga sida. Vi sparar aldrig lösenord. Vilken väg som gäller bestäms per grossist, och det avgörs bara med riktig åtkomst (se E och bilaga A).
5. **Matchning sker när den behövs, inte i en setup.** När floristen första gången trycker på "Vit ros" visar vi förslaget med ett tryck för att bekräfta. Bekräftade matchningar sparas och AI körs aldrig om för dem.
6. **Huvudskärmen:** ett stort kundpris, en diskret rad med inköp och marginal, resten bakom ett tryck.
7. **Största risken är inte UX utan åtkomst:** om en grossist varken har API, prisfil eller tillåter automatiserad inloggning faller "anslut en gång" tillbaka på import. Därför görs åtkomstspåret (spår B) parallellt med UX-spåret (spår A), och vi stämmer av efter spår B:s första riktiga grossist.

### Beslut jag behöver från dig

| # | Fråga | Min rekommendation |
|---|-------|--------------------|
| 1 | Vilken grossist använder floristen som ska testa först? | Den som har lättast kontakt. Bilaga A är ett färdigt mejl. |
| 2 | Får jag gömma ChatGPT Work, brevlådan och AI-chatten nu? | Ja, gömma. Radera först när en riktig koppling fungerar. |
| 3 | Lat matchning (vid första tryck) i stället för en setupskärm? | Ja. Se G och K. |
| 4 | Är en månadskostnad för en fjärrwebbläsare acceptabel om ingen grossist har API? | Avgörs efter spår B. Inget köps före dess. |
| 5 | Ska jag göra om `index.html` till flera filer (utan byggsteg)? | Ja, stegvis, och först efter att testerna finns (steg 0–1 i J). |

---

## A. CURRENT STATE: det som ska behållas

Jag har läst `README.md`, `public/index.html` (1 479 rader), `src/worker.js`, `wrangler.toml` och PR #9. Det här är bra och ska inte skrivas om:

| Del | Var | Varför den ska stanna |
|-----|-----|-----------------------|
| **Räknemotorn** `calc()` | `index.html` ~rad 422 | Summerar stjälkar över hela ordern, avrundar uppåt till hela paket, delar paket mellan buketter, fördelar paketkostnaden, räknar överskott, "har hemma", minsta order, frakt, påslag, arbete, moms och avrundning. Det är exakt det du kallar "förpackningslogiken". Den är en ren funktion och kan flyttas oförändrad. |
| **"Pris saknas", aldrig 0 kr** | `calc`, `renderTiles` | Rätt princip och ska gälla i hela nya modellen (`null`, inte `0`). |
| **ca + ålder** | `ageText`, `money` | Rätt idé, utvecklas med tidsstämpel i stället för datum (F). |
| **Förhandsgranskning före byte** | `runUpdate` → `recomputeUpd` → `renderUpdPreview` → `applyUpdate`, `diffLists` | Bygger förtroende. Behålls för alla källor som inte är strukturerade (manuell import, AI-läst). För strukturerade källor blir det en lättare "Prisändringar"-översikt. |
| **Tolkning av tabeller** | `readTable`, `normalizeRows`, `parseNum`, `detectPack`, `classifyHeader` | Blir reservvägen "Importera prislista" och en bas för matchningsmotorn. |
| **Namnmatchning** | `matchKey` | Seed för nivå 1 i matchningsmotorn (G). |
| **Tomt-start med 20 vanliga blommor** | `COMMON_FLOWERS` | Bra som förslag, men ska filtreras mot det grossisten faktiskt säljer (C). |
| **Serverns skydd** | `worker.js`: `sameSecret`, `Limiter`, validering före kostnad, säkerhetshuvuden, `/api/ping` | Samma mönster används för de nya API:erna. |
| **Designgrund** | Färger, Young Serif + Figtree, mörkt läge, 44 px-ytor, `prefers-reduced-motion`, fokusringar | Varm bas som redan går åt rätt håll. Förfinas, skrivs inte om. |
| **Skyddsvanor** | `esc()`, `safeUrl()`, `twoStep()` för destruktiva knappar, försiktig `load()` | Behålls. |

### Strukturella problem jag hittade i koden (påverkar planen)

1. **Identitet = namn.** Allt (order, recept, "hemma", etiketter) nycklas på `keyOf(namn)`. Byter man namn flyttas nycklar via `renameKey`. Det blockerar flera grossister, matchningar och synk mellan enheter. Ny modell använder stabila id:n (H).
2. **Priset sitter på floristens vara.** `priceList.items[]` har `pris` och `paket` direkt. Det finns ingen plats för "vilken grossist, vilken produkt, när verifierades det". Pris och produkt måste skiljas åt (H).
3. **Datum utan klockslag.** `uppd === today()` räcker inte för "uppdaterat för 2 timmar sedan" eller för att jämföra leveransdag.
4. **Fem kombinationer i uppdateringspanelen.** Läge (skärmdump/agent) × läsare (server/Claude i sidan/ingen) × AI-val. Det är den komplexitet du vill bort från huvudflödet.
5. **Testerna ligger inte i repot** (PR #9 säger det själv). Jag kan alltså inte bevisa att något är oförändrat efter en ändring. **Steg 0 i planen är därför att lägga tester i repot.**
6. **Allt i en 1 479 raders fil** med inline CSS och JS. Fungerar, men går inte att enhetstesta i Node och är svårt att bygga vidare på.
7. **Ingen offline.** En florist i butik kan sakna täckning. Räkningen bör fungera utan nät med sparade priser (service worker i K).
8. **Google Fonts hämtas från CDN.** Fungerar, men kräver nät och skickar besök till Google. Egen hosting av typsnitten senare.

---

## B. REMOVE / HIDE / FALLBACK

| Nuvarande | Beslut | Hur |
|-----------|--------|-----|
| Panelen **"Hämta pris från grossisten"** med 4–5 numrerade steg | **Gömmer** | Ersätts på huvudskärmen av en enda färskhetsrad + "Uppdatera priser". Hela panelen flyttas till *Mina grossister → Importera prislista*. |
| Val **Skärmdumpar / ChatGPT Work** (radio) | **Gömmer** | Visas aldrig i normalflödet. Under *Importera prislista → Fler sätt (avancerat)*. |
| **Skärmdumpsavläsning** (Claude i sidan, serverläsning, AI-chatt) | **Reservväg** | Blir en strategi (`vision`) i samma gränssnitt som alla andra källor. Resultatet är alltid "AI-läst, kontrollera". |
| **ChatGPT Work + brevlåda** (`/leverera/KOD`, `Inbox`) | **Gömmer, radera senare** | Sista utväg. Tas bort först när minst en riktig koppling fungerar (annars raderar vi fungerande kod mot en teori). |
| **Prompt-kopiering**, `updPrompt`, `aiBody`, `pasteBody` | **Reservväg** | Bara bakom "Avancerat". |
| **Åtkomstkod (`READ_CODE`)** i appen | **Ta bort ur användarflödet** | Är en driftsinställning, inte något floristen ska skriva. Hör hemma i miljövariabler tills riktiga konton finns. |
| **Grossistens namn + webbadress** inmatade för hand | **Ta bort** | Man väljer grossist ur en lista. Ingen skriver in en URL. |
| Val **"De valda blommorna / Hela min lista"** | **Ta bort** | Appen uppdaterar det som behövs (F). |
| Flikar **Bukett / Prislista / Inställningar** | **Förenkla** | En huvudvy (Ny bukett). Övrigt bakom en meny: Mina grossister, Prissättning, Recept, Order. |
| Tabellen **"Varor i prislistan"** (redigera namn, kategori, antal, pris) | **Göm** | Blir *Mina grossister → Mina produkter*, för avancerad rättning. |
| **Färskhetskortet**, **bannern "Exempeldata"**, **recept-kortet**, **inköpslistan**, **"Har du något hemma?"**, **kopiera inköpslista** på huvudsidan | **Flyttas bakom ett tryck** | Se C. Exempeldata blir ett val i onboardingen, inte en banderoll. |
| **Flera buketter som chips + antal likadana** | **Behåll i motorn, göm i huvudflödet** | Efter "Klart" väljer man *Lägg i order* eller *Ny bukett*. Delning av paket mellan buketter finns då kvar (A, punkt 1). |
| Inställningsfält som **moms, avrundning, minsta order, frakt** | **Standardvärden + "Anpassa"** | Onboardingens steg 2 frågar bara det som är viktigt (påslag, timpris). |

**Det som inte får gå förlorat när vi döljer:** reservvägarna ska fortfarande fungera och testas. De ska bara aldrig vara det första man ser.

---

## C. TARGET UX

Alla skärmar är mobil först. På ≥900 px behålls tvåkolumnslayouten (bygge till vänster, pris till höger).

### Steg för steg

**1. Första öppningen**
```
        Välkommen till Buketträknaren
   Räkna rätt pris på en bukett på några sekunder.

   1  Anslut din grossist
   2  Ställ in din prissättning
   3  Skapa din första bukett

          [ Kom igång ]
          Prova med exempel
```

**2. Anslut din grossist**
```
   Vilken grossist handlar du av?
   [ Sök grossist...            ]

   ( Lambes )   ( Floriday )   ( Stjärnblom )  ...
   
   Min grossist finns inte här →  Importera prislista
```
Tryck på en grossist visar en mening: *"Du loggar in hos Lambes som vanligt. Vi sparar aldrig ditt lösenord."* (bara sant för de vägar där det stämmer, se E). Sedan öppnas grossistens riktiga inloggning. Efter inloggning:
```
   ✓ Lambes ansluten
   Hämtar dina priser...   (412 produkter)
```
Stannar inloggningen mitt i (MFA, felaktigt lösenord) hanteras det på grossistens egen sida. Vi kringgår aldrig CAPTCHA eller MFA.

**3. Din prissättning** (lugn, förifylld, går att hoppa över)
```
   Hur räknar du?
   Påslag på varor        50 %      [ − ]  [ + ]
   Ditt timpris           250 kr
   
   Så här blir en medelbukett:  595 kr
   [ Fortsätt ]        Hoppa över, ändra senare
```
Moms, avrundning, storlekar m.m. har standardvärden och ligger under *Prissättning → Anpassa*. Momssatsen står på 25 % som exempel och ska bekräftas med redovisningen (som i dag).

**4. Huvudskärmen: Ny bukett**
```
   NY BUKETT
   [Liten]  [Medel]  [Stor]  [Egen]

   [ Sök blomma...            ]

   Ros               +
   Tulpan            +
   Lisianthus        +
   Eukalyptus        +

  ─────────────────────────────
   KUNDPRIS
   595 kr                      ⌃
   Inköp 238 kr · marginal 60 %
  ─────────────────────────────
```
Blommorna är bara sådana grossisten faktiskt säljer, sorterade efter hur ofta man använder dem. Tryck på **Ros**:
```
   Ros      −  3  +             12,90 kr/st · uppdaterat idag
```
Priset räknas om direkt (siffran "rullar" kort, ca 200 ms, avstängt vid `prefers-reduced-motion`).

**Första gången en blomma trycks** (lat matchning, se G):
```
   Vi tror att "Vit ros" motsvarar:
   Avalanche White 50 cm
   10-pack · 129 kr

   [ Ja, använd denna ]   [ Välj annan ]
```
Efter ett "Ja" är det klart för alltid. Ingen setup, inget tekniskt.

**5. Kundpris-panelen (tryck på ⌃)** öppnar ett blad med detaljer:
```
   Ros          Behövs 7 · Köps 10 · Över 3
   Tulpan       Behövs 5 · Köps 10 · Över 5
   ...
   Över totalt: 8 st, värde 74 kr   (ingår i priset)
   [ Så räknas priset ]   [ Inköpslista ]   [ Har hemma ]
```

**Smart tips (enkelt men värdefullt):** när paketet inte är fullt visar appen en rad, t.ex. *"3 rosor till ingår redan i priset. Lägg till?"* (gäller läget "hela förpackningar", där kunden redan betalar för hela paketet).

**6. Avsluta buketten**
```
   [ Klart ]
   → Spara som recept
   → Lägg i order (dela paket med andra buketter)
   → Ny bukett
```

**7. Färskhet, alltid lågmält**
`Priser uppdaterade idag` eller `ca · priser 8 dagar gamla · [Uppdatera]`. Om något inte gick att uppdatera: *"Kunde inte uppdatera från Lambes. Räknar med priser från 8 dagar sedan."* Aldrig en blockerande dialog.

**8. Om en grossist inte kan anslutas automatiskt**
`Importera prislista` (CSV/inklistring, som i dag). Därefter, som sista val under "Fler sätt", skärmdumpar. Reservvägen får aldrig dominera.

### Designriktning (utan att skriva om)

- Behåll paletten (rosa accent, bladgrönt, varm ljus bakgrund) och Young Serif för siffror och rubriker. Kundpriset är den enda stora siffran på skärmen.
- Mjuka former: 16–20 px radie, blad (bottom sheets) i stället för dialoger, mycket luft, högst 4–5 element synliga samtidigt.
- Progressive disclosure: **Inköp/marginal** är en rad, **Så räknas priset** ett tryck bort.
- Touch: alla mål ≥ 48 px, "+" i hela radens högra del. Haptik där webbläsaren stöder det.
- Rörelse: kort, mjuk och aldrig nödvändig (`prefers-reduced-motion`).
- Definition att fastställa: **marginal** = (kundpris utan moms − inköp) / kundpris utan moms, där *inköp* = blommor (hela förpackningar) + andel frakt + emballage. Så räknar motorn redan i dag (`margin`), men arbetskostnaden ingår då i marginalen. Vi bör besluta om vi hellre visar "marginal efter arbete".

---

## D. SUPPLIER ARCHITECTURE

### Översikt

```
 Webbapp (PWA)                          Buketträknaren-API (Cloudflare Worker)
 ┌──────────────────────┐              ┌───────────────────────────────────────┐
 │ UI                   │   HTTPS      │ ConnectionService  (anslut / koppla)  │
 │ calc() (ren funktion)│ ───────────► │ RefreshService     (hämta priser)     │
 │ lokal databas (v2)   │              │ MatchingService    (regler → AI)      │
 │ synk (senare)        │ ◄─────────── │ D1: konton, produkter, priser, matcher│
 └──────────────────────┘              │ ConnectionVault (Durable Object)      │
                                       │   krypterad session, lås, takt        │
                                       └───────────────┬───────────────────────┘
                                                       │ SupplierConnector
              ┌───────────────┬───────────────┬────────┴──────┬──────────────┬────────────┐
              ▼               ▼               ▼               ▼              ▼            ▼
            api            feed            xhr           browser          vision       manual
        (officiellt)  (prisfil/EDI)  (webbutikens egna  (inloggad       (AI läser     (CSV /
                                       strukturerade     webbläsare)     bilder)       inklistring)
                                       anrop)                │
                                                             ▼
                                                  BrowserSession (utbytbart)
                                                  Cloudflare Browser Rendering │ extern tjänst
```

Principen: **resten av appen känner bara till `SupplierConnector` och det gemensamma formatet.** Ingen kod utanför `adapters/<grossist>/` vet hur Lambes eller Floriday fungerar.

### Gränssnittet (förbättrat jämfört med ditt utkast)

Skillnader mot exemplet: `connect()` är två steg (`startConnect`/`completeConnect`) eftersom inloggning är ett flöde, `refreshPrices()` ligger i en tjänst (inte i varje adapter) så att låsning, backoff och cache blir enhetliga, och varje svar bär med sig *hur* uppgiften hämtades.

```ts
type Strategy = 'api' | 'feed' | 'xhr' | 'browser' | 'vision' | 'manual';

interface SupplierConnector {
  id: string;                         // 'lambes'
  displayName: string;                // 'Lambes'
  capabilities: {
    authKinds: ('oauth'|'feedUrl'|'remoteBrowser'|'manual')[];
    searchCatalog: boolean;           // går det att söka i hela sortimentet?
    bulkPrices: boolean;              // många priser per anrop (annars ett per produkt)
    availabilityByDate: boolean;      // lager/pris beror på leveransdag
    strategies: Strategy[];           // i prioritetsordning, första som fungerar används
  };

  // anslutning
  startConnect(ctx): Promise<ConnectStart>;          // { kind: 'redirect'|'liveView'|'feedUrlForm', url|session }
  completeConnect(ctx, payload): Promise<Connection>;
  status(conn): Promise<ConnectionStatus>;           // connected | needsReauth | degraded | disconnected
  disconnect(conn): Promise<void>;                   // rensar all sparad session

  // data (alltid i Buketträknarens gemensamma format)
  searchProducts(conn, query, opts): Promise<Page<SupplierProduct>>;
  getProducts(conn, ids): Promise<SupplierProduct[]>;
  getPrices(conn, ids, opts?): Promise<PriceQuote[]>; // opts: { deliveryDate }
}
```

Fel är en enda liten uppsättning, så att resten av appen kan reagera likadant oavsett grossist:
`AUTH_EXPIRED`, `MFA_REQUIRED`, `CAPTCHA`, `RATE_LIMITED`, `SITE_CHANGED`, `NOT_FOUND`, `UNAVAILABLE`, `UNSUPPORTED`.
`MFA_REQUIRED` och `CAPTCHA` betyder alltid "be floristen göra det själv". Vi försöker aldrig komma runt dem.

### Gemensamt dataformat (utökat)

Ditt exempel är en bra start. Jag föreslår att dela i **produkt** (vad det är) och **prisnotering** (vad det kostar just nu), eftersom pris ändras ofta och produkten sällan:

```
SupplierProduct                       PriceQuote
  supplier                              supplier
  supplierProductId                     supplierProductId
  name            "Avalanche White"     packPrice          129.00     (per förpackning)
  genus           "Rosa"                currency           "SEK"      (EUR för holländska)
  cultivar        "Avalanche"           priceIncludesVat   false
  variant         "Sweet"               stemsPerPack       10
  category        "Blommor"             packUnit           "pack"     (bunt/pack/kartong/styck)
  colour          "vit"                 orderMultiple      1          (säljs bara i multiplar)
  stemLengthCm    50                    availability       "in_stock" | "low" | "sold_out" | "unknown"
  grade           "A1"                  forDeliveryDate    2026-10-08 (om grossisten anger det)
  origin          "Ecuador"             fetchedAt          (tidsstämpel)
  stemsPerPack    10                    verifiedAt         (senast bekräftad som aktuell)
  packUnit        "pack"                strategy           'xhr' …    (hur vi fick det)
  imageUrl        …                     verification       'live' | 'ai_read' | 'manual'
  lastSeenAt / discontinued             priceTiers[]       (volympriser, om de finns)
```

Tillagt jämfört med utkastet och varför: `genus/cultivar` (matchning), `grade` (A1), `orderMultiple` (vissa varor säljs bara 2 buntar åt gången), `priceIncludesVat` (B2B-priser är oftast utan moms men det får inte gissas), `forDeliveryDate` (blommor har dagspris och dagslager), `strategy` + `verification` (förtroende och felsökning), `priceTiers` (volympriser).

### Strategikedja per grossist

Enligt din prioritetsordning. Adaptern deklarerar vilka steg som finns, och en `StrategyChain` provar dem i ordning och noterar vad som användes:

1. `api` – officiellt API/feed/integration
2. `feed` – prisfil, produktfeed, EDI eller personlig länk som grossisten erbjuder kunden
3. `xhr` – de strukturerade anrop som den inloggade webbutiken själv gör, **bara** där villkoren tillåter det
4. `browser` – inloggad webbläsarautomation där användaren själv har loggat in
5. `vision` – AI läser sidan/bilder när strukturerad data saknas
6. `manual` – CSV/inklistring/skärmdump (nuvarande kod som fallback)

**Regel:** AI används där det behövs förståelse, aldrig för att läsa av ett pris som går att hämta strukturerat. `vision` och `manual` ger alltid `verification: 'ai_read' | 'manual'` och går via förhandsgranskning.

**Skyddsräcke i alla adaptrar:** endast läsande anrop (`GET` mot en tillåtlista av adresser). Ingen adapter får innehålla kod som lägger i varukorg, beställer eller ändrar kontot. Det kontrolleras i kontraktstesterna.

### Filstruktur (växer fram, ingen stor omskrivning)

```
projects/buketraknare/
  public/
    index.html                  (UI, lastas som vanliga <script src>, fungerar via file://)
    js/core/calc.js             (flyttad oförändrad, + Node-export)
    js/core/parse.js            (readTable, normalizeRows, matchKey …)
    js/core/state.js            (modell v2, migration v1→v2)
  src/
    worker.js                   (routing)
    suppliers/
      contract.js               (typer, felkoder, kontraktstest som ALLA adaptrar ska klara)
      registry.js
      manual/                   (CSV + skärmdump + AI-chatt, som en vanlig adapter)
      fake/                     (testgrossist med fixturer, används i hela UI-utvecklingen)
      <grossist>/
        manifest.json           (id, domäner, auth-sätt, villkorsanteckningar, status)
        connector.js
        fixtures/               (sanerade svar)
        README.md               (beslutslogg: vad officiellt finns, vad som valdes och varför)
    vault.js                    (ConnectionVault, krypterad session)
    refresh.js, matching.js
  test/                         (node:test, inga beroenden)
  tools/sanitize-har.mjs        (se bilaga B)
```

`index.html` laddar skript med klassiska `<script src>`, inte ES-moduler, eftersom README lovar att filen fungerar öppnad direkt från disk (moduler blockeras på `file://`).

### Plattformsval (kort)

- **D1** (SQLite hos Cloudflare) för konton, produkter, matchningar, priser. Samma SQL kan flyttas till Postgres senare.
- **Durable Object** bara där vi behöver ett lås eller en hemlighet per anslutning (`ConnectionVault`). `Inbox` och `Limiter` finns redan.
- **Cron/Queues** för schemalagd uppdatering (F).
- **Browser Rendering** eller extern tjänst bakom gränssnittet `BrowserSession`, så att leverantören går att byta. **(ej verifierat: funktioner och priser, se E.)**

---

## E. AUTHENTICATION: "Logga in hos grossisten en gång"

### Det jag lovar och inte lovar

- Buketträknaren **lagrar aldrig lösenord**, varken i klartext, krypterat eller i loggar.
- Inget **kringgående av CAPTCHA, MFA** eller liknande. Kräver grossisten det gör floristen det själv, och när sessionen går ut ber vi om en ny inloggning.
- Sessionen får bara användas för **läsning** av produkter och priser.
- **Ärligt förbehåll:** i fjärrwebbläsarvägen skriver floristen lösenordet på grossistens riktiga sida, men sidan visas i en webbläsare som vi driver. Tangenttrycken passerar därför vår infrastruktur under inloggningen, även om vi aldrig sparar eller loggar dem. Vägarna 1, 2 och 4 nedan har inte den egenskapen. Din formulering "skriver inte lösenord direkt i Buketträknaren" uppfylls i alla fall i den meningen att det aldrig finns ett lösenordsfält i vår app.

### Vägar att få en inloggad anslutning

| # | Väg | Så upplever floristen det | Lösenord passerar oss? | Mobil | Kostnad | Robusthet | Täcker |
|---|-----|---------------------------|------------------------|-------|---------|-----------|--------|
| 1 | **Officiell inloggning** (OAuth/API-nyckel hos grossisten) | Tryck Anslut → grossistens egen inloggning → tillbaka med ✓ | Nej | Ja | Låg. Floriday: ca 90 €/månad per API-länk enligt sökträffar **(ej verifierat)** | Hög | Bara grossister med API |
| 2 | **Personlig prisfil-länk** (grossisten ger en länk/fil eller skickar den regelbundet) | "Klistra in länken du fick" en gång, eller automatiskt via mejl | Nej | Ja | ≈ 0 | Hög | Grossister som erbjuder det (vet inte vilka) |
| 3 | **Fjärrwebbläsare med live-vy** | Tryck Anslut → grossistens riktiga inloggningssida visas i appen → logga in → ✓ | Under inloggningen (se ovan) | Ja | Per webbläsartimme + lagring **(ej verifierat)** | Medel: sidändringar, sessionens livslängd | Nästan alla webbutiker |
| 4 | **Tillägg i floristens egen webbläsare** (dator) | Installera ett tillägg, logga in som vanligt | Nej, sessionen lämnar aldrig enheten | Nej (bara dator) | Låg | Medel | Alla, men bara dator |
| 5 | **Egen app med inbyggd webbvy** (framtida) | Som vägen 3 men inbyggd i en app | Nej | Ja | Hög (apputgivning, granskning) | Medel | Alla |
| 6 | **Manuell import** | "Importera prislista" | – | Ja | 0 | Hög men manuell | Alla |

### Rekommendation

- **Gränssnittet är detsamma för alla vägar:** `startConnect` returnerar `redirect`, `liveView` eller `feedUrlForm`; `completeConnect` ger en `Connection`. UI:t visar alltid samma tre bilder: *Anslut → (grossistens sida) → Ansluten ✓.*
- **Bygg vägarna i den ordning grossisterna tillåter**, aldrig före: först 1 och 2 (billigast, säkrast), 3 bara om ingen grossist erbjuder något bättre. Därför görs ett **beslutsmöte efter spår B** innan vi köper något.
- **Undvik tekniskt eleganta lösningar som blir krångliga för floristen.** Väg 3 är den enda som fungerar generellt på mobil, men den kräver att floristen loggar in på nytt när grossistens session går ut. Det motverkas med en "Håll mig inloggad"-ruta på grossistens sida, en lätt periodisk kontakt för att hålla sessionen vid liv (bara om villkoren tillåter) och en vänlig notis: *"Lambes behöver att du loggar in igen. Det tar 20 sekunder."*

### Säker lagring av session (krävs innan något sparas)

Gäller väg 3 (och väg 2, där länken är en hemlighet):

1. **Ingen sparad session** tills detta är granskat och byggt (steg 8 i J). Före dess finns bara `fake`-grossisten.
2. **Kryptering:** varje anslutning får en egen datanyckel (AES-256-GCM). Datanyckeln krypteras med en huvudnyckel som ligger som Cloudflare-hemlighet (`SESSION_MASTER_KEY`), aldrig i koden. Krypterad session ligger i `ConnectionVault` (Durable Object med SQLite). Nyckelrotation är inbyggd (nyckelversion lagras med datat).
3. **Minimera:** spara bara det som behövs (cookienamn/värde för grossistens domän). Inga lösenord, inga formulärfält, inga svar med personuppgifter.
4. **Isolering:** en webbläsarprofil per florist och grossist, aldrig delad. Webbläsaren får bara nå grossistens egna domäner (tillåtlista), vilket också stoppar att en sida läcker sessionen någon annanstans.
5. **Läs-bara:** adaptern har en tillåtlista över URL-mönster och tillåtna metoder. Allt annat avvisas, så ingen kod kan lägga en order.
6. **Loggar:** aldrig cookies, rubriker eller svarskroppar. Bara metadata (grossist, tidpunkt, status, antal produkter).
7. **Livslängd:** sessionen raderas vid *Koppla bort*, vid kontoborttagning och efter 30 dagars inaktivitet. Knappen *Koppla bort* tar bort allt direkt och går att bevisa i test.
8. **Största risken, uttalad:** en stulen session ger åtkomst till floristens grossistkonto (inklusive att beställa). Därför (a) ingen beställningskod alls, (b) kryptering och kort livslängd som ovan, (c) rekommendera grossistens egen funktion för en **användare med enbart prisläsning** där den finns.
9. **GDPR:** sessioner för enskilda firmor är personuppgifter. Behöver integritetstext, EU-lagring (Durable Objects/D1 med jurisdiktion EU), export och radering.

### Villkor och tillstånd

Automatiserad inloggad åtkomst kan strida mot en grossists villkor, och floristen kan i värsta fall få kontot stängt. Per grossist ska vi därför (1) läsa villkoren, (2) **fråga grossisten** om API/prisfil/tillstånd (bilaga A), (3) dokumentera svaret i adapterns `README.md`. Utan tillstånd eller tydligt tillåtande villkor bygger vi inte `xhr`/`browser`-vägarna för den grossisten. Grossister har dessutom ett eget intresse: fler florister som enkelt lägger ordrar.

### Om HAR-filer

HAR används **bara av oss som utvecklingsverktyg** för att se vilka anrop en webbutik gör, aldrig som användarflöde. Se bilaga B för hur de hanteras (de innehåller cookies och lösenord).

---

## F. PRICE REFRESH

**Mål:** floristen tänker aldrig på prisimport. Priserna är bara "färska nog", och appen säger ärligt hur färska.

### När uppdateras något

| Utlösare | Vad | Beteende |
|----------|-----|----------|
| **Floristen öppnar appen / bygger en bukett** | Bara de produkter som finns i ordern | *Stale-while-revalidate:* visa sparat pris direkt, hämta nytt i bakgrunden, byt siffran mjukt. Max en hämtning per anslutning och timme. |
| **Dagligen på morgonen** (t.ex. ca 05:30) | "Mina produkter" = bekräftade matchningar som använts de senaste 60 dagarna | Fungerar utan att appen är öppen. Billigt med API/prisfil. Med fjärrwebbläsare begränsas till de vanligaste. |
| **Knappen Uppdatera priser** | Alla mina produkter hos den grossisten | Alltid tillåten, med framsteg ("42 av 60"). |
| **Efter återanslutning** | Allt som är äldre än 24 h | Automatiskt. |

### Färskhetsstatus (tidsstämplar, inte datum)

| Ålder | Visas som | Räknas som |
|-------|-----------|------------|
| ≤ 24 h | `uppdaterat idag` | aktuellt |
| 1–7 dagar | `ca · 3 dagar gammalt` | ungefärligt |
| > 7 dagar | `ca · 8 dagar gammalt · Uppdatera` | gammalt |

Blommor är färskvara med dagspris och säsongstoppar (Alla hjärtans dag, Mors dag, midsommar, Alla helgons dag). Kring sådana dagar kortas tröskeln till 12 h och en rad varnar: *"Priserna kan ändras snabbt just nu."* `deliveryDate` används när grossisten anger leveransdag. Pris och tillgång är då per dag.

### Robusthet (utan att störa floristen)

- **Ett lås per anslutning** (`ConnectionVault`) så att två flikar inte hämtar samtidigt.
- **Backoff och brytare:** vid upprepade fel (3 i rad) markeras anslutningen `degraded`, vi slutar försöka en stund och visar en lugn rad. Aldrig en blockerande dialog.
- **Rimlighetskontroll** före alla sparade priser: pris ≤ 0, kraftig ändring (t.ex. > 50 %), ändrad förpackningsstorlek eller en vara som försvunnit **sparas inte tyst**. De hamnar i en kort "Kontrollera prisändringar" (samma idé som dagens förhandsgranskning). Det fångar också att en grossists sida ändrats så att en adapter läser fel.
- **Prisändringar är en tjänst:** *"Röd ros +12 % sedan sist"* syns vid blomman. Det är nyttigt i sig.
- **Kostnadskontroll:** hämta bara det som behövs, cacha per (anslutning, produkt, leveransdag), kör aldrig AI i uppdateringsvägen när strukturerad data finns.
- **Historik:** varje notering sparas (`price_quotes` är append-only) så att vi kan visa trender och "ca"-ålder korrekt.

---

## G. AI MATCHING

**Mål:** "Vit ros" ↔ "Avalanche White 50 cm A1". Rätt blomma, gissa aldrig tyst, fråga så lite som möjligt, och betala för AI bara när regler inte räcker.

### Lager

| Nivå | Vad | AI? | Kostnad |
|------|-----|-----|---------|
| **L0 Minne** | Redan bekräftad matchning (florist → grossist → produkt-id) används direkt vid varje uppdatering. | Nej | ≈ 0 |
| **L1 Regler** | Normalisera namn (svenska tecken, plural, synonymer), plocka ut släkte (ros = *Rosa*, slöjflor = gipsört = *Gypsophila*), färg (vit = white = "Snow"), längd (50 cm), förpackning, klass (A1) och ge poäng. | Nej | ≈ 0 |
| **L2 AI-omrankning** | Bara när L1 ger flera nästan lika kandidater eller ingen. Skickar högst ~10 kandidatrader (text, inga bilder) och floristens ord, och får tillbaka ett val eller "inget passar" som strikt JSON. Cachas per (ord, grossist, katalogversion). | Ja, litet anrop | Låg |
| **L3 Bild** | Aldrig för matchning. Bara reservvägen `vision` när inget strukturerat finns. | Ja | Högre |

### Poäng och säkerhetsnivåer

Poängen (0–1) kombinerar: släkte (måste stämma, annars avfärdas kandidaten), färg, längd nära floristens vanliga val, förpackning, pris rimligt mot tidigare pris, tillgänglighet och namnlikhet.

| Nivå | Villkor | Vad appen gör |
|------|---------|---------------|
| **Redan bekräftad** | Finns i `product_matches` med `status = confirmed` | Använd direkt. Inget visas. |
| **Säker** | Entydigt släkte + färg + en tydlig standardvariant, eller floristens ord = grossistens namn | Visa **ett** förslag med *[Ja, använd denna]*. Kräver alltid första bekräftelsen. |
| **Troligt** | Poäng 0,6–0,9 | Visa förslaget och *[Välj annan]* med 2–4 alternativ. |
| **Osäkert** | Poäng < 0,6 eller två kandidater nära varandra | Ingen förvald. Visa alternativen som en lista att välja ur. |
| **Inget** | Inga kandidater | *"Hittade inget som liknar. Sök i Lambes sortiment"*, eller lägg till utan pris. |

**Regeln "gissa aldrig tyst":** första matchningen för varje par (floristens produkt, grossist) kräver alltid ett tryck. Efter det är den en bekräftad matchning. Det enda undantaget är att floristen själv valt produkten i grossistens sortiment (då är valet i sig bekräftelsen).

### Lat matchning (min viktigaste förenkling)

Matcha **när floristen trycker på en blomma första gången**, inte i ett batchflöde. Det betyder: ingen setupskärm, bara de blommor floristen faktiskt använder matchas, och förslaget visas där floristen redan tittar (se C). Ett valfritt "Bekräfta alla säkra (14)" kan erbjudas i onboardingen som ett *synligt* val, aldrig som något som händer av sig själv.

### Fallgropar jag redan ser

- **"Rosa ros"**: *rosa* är en färg, *ros* är släktet. Ordlistan måste hantera det. **"Ros" ensamt** är för vagt (färg saknas), så fråga om färg i stället för att gissa.
- **Fastnålad produkt kontra regel.** Vi sparar valet som en *fast* produkt-id. En regel som "billigaste vita rosen 50 cm" kan ge ett byte av sort mellan två uppdateringar och därmed ett oförklarligt prishopp. Regelbaserade matchningar kan komma senare, och då med synliga byten.
- **Slutsåld/utgången vara** är vanligt i blomhandel. Då föreslår vi en ersättare med samma specifikation och ber om bekräftelse (*"Avalanche White 50 är slut. Mondial White 50, 125 kr?"*).
- **Flera grossister:** matchningen är per anslutning. Samma "Vit ros" kan peka på olika produkter hos olika grossister (K).
- **Inlärning:** ett avvisat förslag sparas som negativ signal. Floristens val av längd/förpackning blir en preferens. Anonymiserade, delade matchningar mellan florister hos samma grossist vore en stor genväg senare, men kräver ett integritetsbeslut och görs inte nu.
- **Utvärdering:** ett facit (golden test set) med minst 100 par ord → produkt per grossist, mått: träffsäkerhet på förstaförslaget och andelen som behöver AI. Ingen ändring av matchningsreglerna släpps utan att facit körs.

---

## H. DATA MODEL

Mål: modellen ska kunna sparas lokalt nu (localStorage → IndexedDB) och flyttas till databas utan omdesign. Därför: **stabila id:n** (ULID/UUIDv7) i stället för namn som nycklar, `updated_at`, `rev` (stigande version) och `deleted_at` (borttagningsmarkering) på varje rad, så att synk mellan enheter går att lägga på senare.

```
account(id, created_at, locale, currency)                       -- finns som ett konto "lokal" i prototypen
supplier_connection(id, account_id, supplier_id, status,        -- connected | needs_reauth | degraded | disconnected
                    auth_kind, connected_at, last_verified_at, last_error,
                    vault_ref)                                  -- pekar på krypterad session; själva sessionen ligger aldrig här

supplier_product(id, supplier_id, connection_id, supplier_product_id,
                 name, genus, cultivar, variant, category, colour, stem_length_cm, grade,
                 stems_per_pack, pack_unit, order_multiple, origin, image_url,
                 first_seen_at, last_seen_at, discontinued)
   -- katalog sparas per anslutning. Är sortimentet bara synligt inloggad delar vi det inte mellan konton.

price_quote(id, connection_id, supplier_product_id,             -- append-only historik
            pack_price, currency, price_includes_vat, price_tiers,
            availability, for_delivery_date,
            fetched_at, verified_at, strategy, verification)    -- verification: live | ai_read | manual

florist_product(id, account_id, name, category, colour, sort)   -- floristens ord: "Vit ros"
product_match(id, account_id, florist_product_id, connection_id, supplier_product_id,
              status,                                           -- suggested | confirmed | rejected
              pinned, confidence, method,                       -- method: exact | rules | ai | user_picked
              confirmed_at)

pricing_settings(account_id, mode, markup_pct, hourly, vat_pct, round_step,
                 sizes, min_order, ship_fee, free_from)         -- som dagens `settings`

recipe(id, account_id, name, size_id, lines)                    -- lines: [{florist_product_id, qty}]
order(id, account_id, status, created_at, ...)
order_bouquet(id, order_id, size_id, qty, lines)
order_quote(id, order_id, snapshot)                             -- fast kopia av priser vid offert (kan inte ändras i efterhand)

inventory_lot(id, account_id, florist_product_id, supplier_product_id?,
              stems, unit_cost, acquired_at, expires_at?, source)  -- source: leftover | manual | purchase   [FRAMTID, se nedan]
```

### Flytt från dagens modell (v1 → v2)

| v1 (nu) | v2 |
|---------|----|
| `priceList.items[]` med namn, paket, pris, `uppd` | `florist_product` + (efter anslutning) `product_match` + `price_quote`. Manuella priser blir `price_quote` med `verification: manual`, så **ingen data går förlorad**. |
| `order.buketter[].items {namnnyckel: antal}` | `lines [{florist_product_id, qty}]` |
| `order.hemma {namnnyckel: antal}` | `inventory_lot` (ett lot per "har hemma") |
| `labels`, `recipes` | motsvarande rader med stabila id:n |
| `wholesaler {namn,url,ai,mode,readCode}` | `supplier_connection` (reservvägarna behåller sina inställningar under "Avancerat") |

`calc()` ändras inte. Den matas av en liten funktion `resolvePrices(state)` som skapar samma `indexList`-form (`{namn, paket, pris}`) från senaste verifierade `price_quote`. Då bevisar vi att räkningen är oförändrad med exakt samma indata (tester i J).

### Förberett för överskottslager (punkt 9)

- `inventory_lot` finns i modellen, men inget UI byggs nu.
- `calc` har redan ett "har hemma"-led (`have`). Det generaliseras till summan av lager för produkten (äldsta först, för att minska svinn) innan ett nytt paket köps.
- **Exempel:** buketten behöver 5 vita rosor, floristen har 3 i lager → köp 2 → 1 pack (10) → över 8. Räkningen finns redan i dag via "Har du något hemma?", men då måste floristen skriva in antalet för hand. Med lager kommer det från tidigare ordrar automatiskt.
- Efter en bekräftad order skapas nya lot av överskottet (`source: leftover`), så svinnet följs automatiskt.

### Förberett för AI-bukettförslag (punkt 10)

Ingen del av detta byggs nu, men fyra beslut tas redan nu så att det inte blir svårt:

1. **`calc` är en ren, anropbar funktion** (`quote(order, prices, settings, inventory) → pris`). En framtida lösare kan alltså prova tusentals kombinationer med exakt samma räkning.
2. **Produkter bär attribut** som släkte, färg, längd, klass och (senare) stiltaggar. Det kräver `supplier_product` ovan.
3. **Pris och tillgång är per leveransdag** i modellen.
4. **Arbetsfördelning när det byggs:** AI tolkar önskemålet ("romantisk bukett i rosa och vitt för cirka 600 kr") till begränsningar som strikt JSON (budget, palett, stil, storlek, måste/undvik). En vanlig lösare väljer antal och förpackningar och minimerar svinn. **AI räknar aldrig priset.** Förslaget visas som en vanlig bukett som floristen kan ändra.

---

## I. CLOUDFLARE: diagnos av misslyckat bygge

### Vad jag kan visa (fakta)

1. Det finns **en enda** Cloudflare-koppling mot repot: bygget **"Workers Builds: open-claw"**. Workern heter `open-claw`, och det är **Ledtråds** namn (`ledtrad-app/wrangler.toml`: `name = "open-claw"`). Buketträknarens egen Worker heter `buketraknare` och **har aldrig skapats** (PR #9:s README kräver att man skapar den via *Import a repository* med Root directory `projects/buketraknare`).
2. Resultat per PR:

| PR | Datum | Innehåll | Bygge |
|----|-------|----------|-------|
| #5 | 16 aug | Ledtråd + Durable Object | ❌ misslyckades |
| #6 | 16 aug | Ledtråd (ovanpå #5) | ✅ lyckades |
| #7 | 18 aug | Valkompassen | ❌ |
| #8 | 23 aug | Världens underverk | ❌ |
| #9 | 7 okt | Buketträknaren | ❌ |

3. Efter att #5 och #6 mergats återställdes båda från `master` samma dag (`28886e0`, `72b0482`). Då togs Durable Object-konfigurationen bort ur `ledtrad-app/wrangler.toml` igen. Sedan dess har **varje** PR-bygge misslyckats, oavsett om det handlar om Valkompassen, en statisk app eller Buketträknaren.
4. Buketträknarens kod är inte orsaken: `npx wrangler deploy --dry-run` mot en ren kopia av `projects/buketraknare` (wrangler 4.148.0) paketerar felfritt, med båda Durable Objects (`INBOX`, `LIMITER`), assets (730 KiB) och variabeln `READ_DAILY_LIMIT`.

### Slutsats (hög säkerhet)

Felet gäller **hela repot** och har inget med PR #9:s innehåll att göra. Det är ingenting i Buketträknaren som måste ändras för att "rätta" det.

### Trolig orsak (medel säkerhet, kräver loggen för att bekräftas)

Mönstret passar att Ledtråd-Workern har ett **Durable Object-tillstånd som inte längre stämmer med koden på `master`**:

- #5 introducerade en Durable Object. Icke-produktionsbyggen kör (enligt min förståelse av Cloudflare) `wrangler versions upload`, som inte kan skapa nya Durable Object-klasser. Därför föll **just det första PR-bygget med en ny klass** (#5) men inte #6, när klassen redan fanns i produktion.
- När `master` sedan återställdes saknar koden en klass som produktionsworkern fortfarande har. Då kan alla efterföljande bygge-/uppladdningsförsök avvisas tills klassen tas bort med en uttrycklig migrering.

**Detta är ett resonemang utifrån historiken, inte en bekräftad felrad.** Den exakta felraden finns bara i Cloudflares byggloggar, som jag inte kan öppna (kräver inloggning, och domänen är blockerad i min miljö). Det finns också minst två andra förklaringar som historiken inte utesluter:

- bygge-token eller behörighet i Workers Builds har ändrats eller gått ut efter 16 aug,
- bygginställningarna (root directory, byggkommando) ändrades i dashboarden efter #6.

### Vad som behöver kontrolleras (2 minuter, bara läsa)

Öppna byggloggen för PR #9 (länken finns i PR-kommentaren från Cloudflare) och kopiera de röda raderna till mig. Så här tolkar jag dem:

| Det loggen säger (ungefär) | Betyder | Åtgärd |
|----------------------------|---------|--------|
| *Durable Object class … migration / deleted_classes / not exported* | Min trolig orsak stämmer | Lägg en migrering som tar bort `ReminderScheduler` i `ledtrad-app/wrangler.toml` och deploya **en gång** från `master`. Rör inte Buketträknaren. |
| *Missing entry-point / no wrangler config / could not find …* | Root directory pekar fel | Rätta root directory för `open-claw` (ska vara `ledtrad-app`). |
| *Authentication / token / permission / unauthorized* | Bygge-token ogiltig | Återskapa token under *Settings → Builds*. |
| Något annat | Okänt | Skicka raderna så tar jag det därifrån. |

### Det som oavsett behövs för Buketträknaren

1. **Skapa en egen Worker `buketraknare`** via *Import a repository* med Root directory `projects/buketraknare`. Rör inte den befintliga `open-claw`-kopplingen.
2. **Sätt "build watch paths"** för båda Workers (`ledtrad-app/*` respektive `projects/buketraknare/*`), så att en PR som rör Valkompassen inte bygger Ledtråd.
3. **Första driftsättningen måste vara ett produktionsbygge** (eller en körning av `wrangler deploy`), eftersom `wrangler.toml` har Durable Object-migreringar (`Inbox`, `Limiter`) som en versionsuppladdning (PR-bygge) inte kan skapa **(enligt min förståelse, ej verifierat)**. Praktiskt: tillfälligt sätta produktionsgrenen till arbetsgrenen, eller köra `wrangler deploy` en gång lokalt.
4. **Ändra ingenting i Cloudflare förrän loggen är läst.**

---

## J. IMPLEMENTATION PLAN

Två spår som går parallellt. **Varje steg avslutas med tester som körs innan nästa påbörjas**, och varje steg är en liten, granskningsbar ändring ovanpå PR #9.

### Spår A: produkt och modell (inget beroende av någon grossist)

| Steg | Innehåll | Test efter steget | Du kan se/prova |
|------|----------|-------------------|-----------------|
| **0** | **Säkerhetsnät.** Flytta `calc`, `readTable`, `normalizeRows`, `matchKey`, `parseNum`, `detectPack` oförändrade till `public/js/core/*.js` (klassiska skript) med `module.exports` för Node. Lägg `test/` (node:test, inga beroenden). | **Karakteriseringstester:** facit av dagens beteende (t.ex. 7 rosor + 10-pack → köper 10, över 3; delning av paket mellan två buketter; "pris saknas" ger `null`; CSV-varianter). Appen i headless Chromium ger **samma siffror som före** på exempeldatan. | Appen ser exakt likadan ut. |
| **1** | **Modell v2 + migrering.** Stabila id:n, `florist_product`/`product_match`/`price_quote`, `resolvePrices()` som matar `calc`. Migrering v1→v2 vid laddning, med säkerhetskopia av v1 i localStorage. | v1→v2 på ett antal sparade tillstånd (tomt, exempel, egen lista). **Samma totalpriser före och efter.** Rundtur: ingen data försvinner. Trasig/gammal lagring faller tillbaka rent. | Inget ändras för användaren. |
| **2** | **Ny huvudskärm** (kundpris, rad med inköp/marginal, blad med detaljer, "Klart"-meny, tips om fulla paket). Gamla paneler göms bakom *Mer*. | UI-test (Playwright + installerad Chromium) vid 390 px: räkna en bukett, ändra antal, öppna detaljer, "Klart". Ögonkontroll med skärmbilder. Tillgänglighet: fokusordning, kontrast, målstorlekar. | **Stort kvalitetslyft du kan bedöma.** *Beslutspunkt 1.* |
| **3** | **Onboarding** (3 steg) mot `fake`-grossisten + importvägen. | Hela första-gången-flödet i test, med och utan "Hoppa över". | Visa för en riktig florist. |
| **4** | **Offline.** Service worker + manifest, egna typsnitt. | Appen räknar utan nät med sparade priser. | Installera på hemskärmen. |

### Spår B: grossiståtkomst (avgör om visionen går)

| Steg | Innehåll | Test efter steget | Resultat |
|------|----------|-------------------|----------|
| **B1** | **Kontakt och undersökning** av floristens grossist (bilaga A): API? prisfil? EDI? villkor? | – | Ett skriftligt beslutsunderlag per grossist i adapterns `README.md`. |
| **B2** | **`SupplierConnector`-kärnan:** gränssnitt, typer, felkoder, registry, `fake`- och `manual`-adapter (dagens CSV/skärmdump/AI-chatt som en vanlig adapter). **Kontraktstest** som alla adaptrar måste klara (bl.a. "inga skrivande anrop"). | Kontraktstestet körs mot `fake` och `manual`. `manual` ger samma resultat som dagens inläsning. | Appen använder bara gränssnittet. |
| **B3** | **RefreshService:** färskhet, lås, backoff, rimlighetskontroll, "Prisändringar". | Tidsstyrda tester (utan riktig klocka): gammal/ny status, backoff, felinjektion, att orimliga priser sparas **inte**. | Priser känns automatiska med `fake`. |
| **B4** | **Matchning L0 + L1** (regler, ordlista, facit) och förslagsbladet i UI (lat matchning). | Facit ≥ 100 par. Mål (bestäms efter första facit): hög träffsäkerhet på förstaförslaget. Att **ingenting sparas utan bekräftelse**. | "Vi tror att Vit ros motsvarar …" |
| **B5** | **Första riktiga adaptern** enligt B1:s beslut: `api`/`feed` först. Sanerade fixturer. | Kontraktstest + fixturtest. Riktig körning mot floristens konto, **tillsammans med henne**. | *Beslutspunkt 2:* håller vägen? |
| **B6** | **Anslutningsvalv** (`ConnectionVault`), bara om en väg som kräver session valts: kryptering, koppla bort, radering, inget i loggar. | Test att hemligheter aldrig syns i loggar eller svar. *Koppla bort* tar bort allt. Nyckelrotation. | – |
| **B7** | **Fjärrwebbläsare-spike** (bara om ingen väg 1/2 finns): leverantörsjämförelse, kostnad, live-vy på mobil, MFA hos användaren. | Mät kostnad per uppdatering och inloggningens upplevelse på riktig telefon. | *Beslutspunkt 3:* köpa tjänst eller inte. |
| **B8** | **Matchning L2** (AI-omrankning, cache, kostnadstak). | Anropsräknare: **noll AI-anrop** för redan bekräftade matchningar. | – |
| **B9** | **Konton och synk** (D1, inloggning med e-postlänk/passkey), flytt av lokal data. | Migrering lokalt → konto → andra enheten ger samma buketter, priser och matchningar. | Samma data på två enheter. |
| **B10** | **Lager och AI-bukettförslag** (förberett i modellen). | Egna planer och tester när det är dags. | – |

**Parallellt med allt:** Cloudflare (I) åtgärdas så fort loggen är läst, eftersom grossistkopplingarna inte går att prova på riktigt utan en fungerande driftsättning.

**Beslutspunkter:** (1) efter A2: stämmer UX-riktningen? (2) efter B5: går det att hämta riktiga priser för floristens grossist? (3) efter B7: är en fjärrwebbläsare värd sin kostnad, om den behövs?

**Arbetssätt:** varje steg blir en liten commit-serie på arbetsgrenen ovanpå PR #9. PR #9 mergas inte förrän du sagt till. Skärmdumpar och testutskrifter bifogas när ett steg är klart.

---

## K. PRODUCT REVIEW

Jag har tittat på planen som produktdesigner, som florist (en kund står framför mig, en hand upptagen) och som arkitekt, och frågat "kan det göras enklare?"

### Förenklingar vi redan gjort (och en till)

1. Lat matchning i stället för en setupskärm.
2. Ingen inmatning av grossistens namn eller webbadress, bara ett val ur en lista.
3. Inget val mellan skärmdump/agent/AI i normalflödet.
4. En enda stor siffra, resten ett tryck bort.
5. Sedan: **starta i grossistens sortiment, inte i floristens lista.** Sökrutan söker i både floristens egna blommor och grossistens katalog. Väljer hon en grossistprodukt skapas floristens blomma och en bekräftad matchning i samma tryck, så att matchning bara behövs för de 20 förinställda blommorna och för äldre data.

### Saker vi har missat

| Område | Det saknade | Förslag |
|--------|-------------|---------|
| **Färskvara** | Priser och lager beror på leveransdag. Varor tar slut. | `forDeliveryDate`, "Slut idag" + ersättarförslag (G), och kortare färskhetströskel kring helger (F). |
| **Moms/valuta** | Priser ex/inkl moms och EUR hos holländska aktörer. | `priceIncludesVat` får aldrig gissas. `currency` + kurs, visa alltid SEK. |
| **Flera grossister** | Många florister handlar av 2–3. Samma blomma kan vara billigast på olika ställen. | Matchning per anslutning (H). Standardgrossist per blomma, och en diskret "billigare hos X idag". |
| **Budget först** | Kunden säger oftast "en bukett för 500 kr", inte "9 stjälkar". | Läge "Räkna baklänges": ange pris → appen visar hur många stjälkar som ryms. Enkel räkning, ingen AI, och grunden för AI-förslagen. |
| **Offert** | Priset ska ligga fast för kunden även om grossistpriset ändras. | `order_quote` som fast kopia av priserna vid offerten. |
| **Grossistens villkor** | Minsta order, frakt, leveransdagar, sista beställningstid. | Visas redan delvis (minsta order, frakt). Sista beställningstid och leveransdagar läggs till per grossist när adaptern kan läsa dem. |
| **Volympriser** | Pris per paketantal kan variera. | `priceTiers`. |
| **Beställning** | Det naturliga nästa steget är att skicka inköpslistan till grossistens varukorg. | **Inte nu.** Skrivande åtgärder höjer risken kraftigt. Om det görs senare ska det vara en uttrycklig bekräftelse, aldrig automatiskt. |
| **Variantval** | "Ros" har färger och längder. | Grupp­era som släkte: tryck på **Ros** → välj färg en gång (färgprickar), appen minns. Prova med riktiga florister. |
| **Snabbåtkomst** | Man tar samma 5 blommor hela tiden. | Rad "Mest använda" överst, automatiskt. |
| **Ångra** | Fel tryck med en hand. | "Ångra" som snabb notis efter borttagning. |
| **Förtroende** | Varifrån kommer priset? | "Visa källa": grossist, tidpunkt, hur det hämtades. AI-läst pris är alltid märkt. |
| **Adaptrar går sönder** | Webbutiker ändras. | Rimlighetskontroll + dagliga **kanariekörningar** mot ett testkonto + larm till oss, aldrig till floristen (F). |
| **Juridik** | Villkor, tillstånd, GDPR. | E: fråga först, dokumentera, bygg inte `xhr`/`browser` utan tillåtelse. |
| **Språk/valuta** | Norge/Danmark kan bli aktuellt. | Svenska nu, men texter via nycklar och `sv-SE`-formatering från början. |
| **Offline** | Dålig täckning i butik. | Service worker, steg A4. |
| **Gamla data** | Namnnycklar bryts vid omdöpning. | Stabila id:n i v2 (A, punkt 1). |

### Största osäkerheten (säger det rakt)

Hela "Anslut en gång" står och faller med vad **en riktig grossist** tillåter. Det kan jag inte bedöma härifrån. Därför är planens första riktiga steg att ta reda på det med floristens grossist (B1), innan vi bygger tunga delar som sessionsvalv och fjärrwebbläsare. Om ingen grossist ger oss en officiell väg är fallet att *importen blir lite bättre* ett giltigt resultat, och det är bättre att veta det tidigt.

### En mening

Floristen ska uppleva **Anslut. Välj blommor. Se priset.** Allt annat ska vara osynligt tills det behövs.

---

## Bilaga A: mejl till grossisten

> **Ämne:** Fråga om prisfil eller API för kunder
>
> Hej!
>
> Jag är kund hos er och använder en liten app (Buketträknaren) för att räkna ut priset på buketter. Vi vill gärna kunna hämta *mina* aktuella kundpriser direkt från er i stället för att skriva av dem för hand.
>
> Har ni något av följande för kunder?
> 1. Ett API eller en feed med produkter och priser
> 2. En personlig prislista som fil eller länk (CSV/Excel/EDI), gärna uppdaterad dagligen
> 3. Möjlighet att skapa en användare med bara läsrättigheter för priser
>
> Om ni inte har det: går det bra att jag, som kund, hämtar mina egna priser automatiskt från den inloggade webbutiken, och finns det villkor jag bör känna till?
>
> Appen lägger inga beställningar, den läser bara priser. Jag hör gärna vad som är möjligt.
>
> Vänliga hälsningar
> [namn, företag, kundnummer]

## Bilaga B: så hanteras HAR-filer och riktiga svar

En HAR-fil (nätverksexport) innehåller **cookies, lösenord och sessionsnycklar**. Därför:

1. Den delas **aldrig** i chatt eller commit i råform.
2. `tools/sanitize-har.mjs` (byggs vid B5) tar bort cookies, `Authorization`-rubriker, formulärfält med lösenord/token och personuppgifter, och behåller bara URL-mönster, metoder, statuskoder och formen på JSON-svar.
3. Sanerade svar sparas som **fixturer** i adapterns mapp och används av kontraktstesten.
4. Den som exporterat filen ska kunna se vad som togs bort innan något delas.
5. Floristen byter lösenord om en rå HAR av misstag har delats.
6. HAR är ett utvecklingsverktyg, **aldrig** ett användarflöde.

## Bilaga C: checklista per ny grossist

1. Finns officiellt API/feed/integration? Dokumentation, villkor, kostnad.
2. Finns prisfil, produktfeed, EDI eller personlig länk?
3. Vad säger villkoren om automatiserad åtkomst? Skriftligt tillstånd?
4. Vilka strukturerade anrop gör webbutiken (via sanerad HAR), och är det rimligt att använda dem?
5. Hur länge lever en session? Finns "kom ihåg mig"? MFA/CAPTCHA?
6. Vad säger priserna: ex/inkl moms, valuta, per paket/stjälke, leveransdag, volympriser?
7. Beslut + skäl + datum i `adapters/<grossist>/README.md`.
8. Kontraktstest + fixturer + kanariekörning.
