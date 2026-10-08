# Konsekvensanalys: grossistens artiklar som sanning, favoriter, erbjudanden och hållbarhet

**Status:** analys. Ingen produktionskod och inga tester är ändrade. Den planerade matchningsfunktionen är pausad tills analysen är granskad.
**Underlag:** koden i PR #10 (modell v2, `SupplierConnector`, 191 tester), planen i `PLAN-grossistanslutning.md` och beslutsloggen. Mått i avsnitt P kommer från en engångskörning mot modellen (scratchpad, inget committat).

Markeringen **(ej verifierat)** betyder att det beror på vad den verkliga pilotgrossisten tillhandahåller, vilket jag inte kan se härifrån.

---

## Slutsats i korthet

1. **Grunden håller.** Ingenting i räknemotor, `viewOf`, orderrader, recept, migrering eller grossistkontrakt behöver ändras. Alla ändringar nedan är *tillägg* av fält och tabeller, utom två justeringar av hur data läses in och sparas (punkt 2 och 3) och ett namnbyte på ett enda strängvärde (`verification: 'live'`, B punkt 6).
2. **Katalogen får inte ligga i samma sparade post som floristens arbetstillstånd.** Beräkningarna klarar tusentals artiklar utan problem, men att skriva hela tillståndet vid varje tryck gör det inte (3 000 artiklar ≈ 2 MB och ca 30 ms per sparning på en server, mer på en telefon). Katalogen behöver ett eget lager. Det är den viktigaste tekniska ändringen.
3. **Inläsningen av ett stort sortiment måste tåla enstaka dåliga rader.** Dagens "allt eller inget" är rätt för en prisuppdatering av några varor men fel för en katalog på tusentals artiklar.
4. **Grossistens artikel är sanningen, och den modellen finns redan** (`supplierProducts`). Floristens "Vit ros" slutar vara en prisbärande produkt. Det den blir är en *arbetsartikel*: en tunn rad som skapas automatiskt när floristen väljer en exakt artikel, så att order, recept och räkning fortsätter fungera oförändrade.
5. **`Match` ändras inte, men får en annan roll.** Den binder en arbetsartikel till en exakt artikel och används sedan vid ersättare och migrering, inte för att gissa "vit ros".
6. **Fyra nya delar behövs** (alla additiva): favoriter/användning (`userArticles`), erbjudanden (`offers`), användningsdatum på ordern (`usage`) och strukturerade fakta om odling och certifiering (`facts`, skilda från vår egen klassificering `derived`).
7. **Det som är riskabelt är inte tekniken utan datan:** om pilotgrossisten inte går att lista i sin helhet, inte visar erbjudanden eller inte uppger odlingsland, då går den delen av visionen inte att bygga för den grossisten. Därför bygger vi bara det som datan stödjer, och checklistan till floristen har kompletterats.
8. **Daglig synk får aldrig vara en grind.** Appen måste fungera fullt ut på senast kända priser. Synk och inloggning erbjuds, de krävs inte.

Beslut jag behöver från dig finns sist i dokumentet.

---

## A. Vad i nuvarande datamodell kan behållas exakt som den är?

| Del | Beslut | Skäl |
|-----|--------|------|
| `connections[]` (inkl. `conn_manual`) | Behåll, tillägg av synkfält (B) | Rätt nivå: en anslutning per grossist, den egna listan är en av dem |
| `supplierProducts[]`, nyckel `connectionId + supplierProductId` | **Behåll exakt** | Det är redan "grossistens verkliga artikel". Fälten `name, variant, category, genus, cultivar, colour, grade, origin, imageUrl, stemLengthCm, stemsPerPack, packUnit, orderMultiple, discontinued, firstSeenAt, lastSeenAt` täcker mer än hälften av det du beskriver |
| `quotes[]` (`packPrice` null = saknas, `currency`, `priceIncludesVat` tri-state, `priceTiers`, `availability`, `forDeliveryDate`, `fetchedAt`, `verifiedOn`, `strategy`, `verification`) | **Behåll exakt** | Pris med tid, källa och leveransdag finns redan. Det är precis "pris + tidsstämpel + källa" |
| `matches[]` och `confirmMatch`, `rejectMatch`, `needsMatching`, `rejectedFor` | Behåll (rollen ändras, se C) | Fungerar för ersättare och migrering |
| `products[]` | Behåll, men som *arbetsartiklar* (se B, punkt 1) | Orderrader, recept, "hemma" och rollback hänger på produkt-id |
| `viewOf` (det enda stället som väljer aktivt pris) | **Behåll** | Insulerar räknemotorn. Lägg till regler här, inte i kalkylen |
| `calc()` och alla skärmar | **Behåll** | 191 tester och differenstestet bevakar dem |
| Normalisering (`normalizeSupplierProduct`, `normalizeQuote`), `unusableReason`, `ModelValidationError` | Behåll | Principen "okänt är okänt, aldrig gissning" ligger redan där |
| Migrering v1 → v2, rollback, `loadV2` | Behåll | Additiva fält bevaras av `loadV2` (kontrollerat) |
| `SupplierConnector`-kontrakt, register, skrivskyddad HTTP, kontraktssvit, falska grossister | **Behåll** | Gäller oförändrat. Kontraktet utökas med valfria metoder/flaggor (B, J) |
| Reservvägarna (skärmdump, ChatGPT Work, brevlåda, AI-chatt) och `conn_manual` | Behåll synliga tills första riktiga kopplingen fungerar | Beslut 2 i beslutsloggen |

**Slutsats A:** noll brytande ändringar i det som är byggt.

---

## B. Vad behöver justeras för att grossistens artiklar ska vara den centrala katalogen?

Prioritet: **M** = måste före pilotadaptern, **B** = bör före första användartest, **V** = kan vänta tills datan kräver det.

| # | Justering | Prio | Typ |
|---|-----------|------|-----|
| 1 | **Arbetsartikel skapas automatiskt 1:1 från vald artikel** (`ensureWorkingItem(connectionId, supplierProductId)`): en `product`-rad + en bekräftad `match` (`method: 'picked'`). Id härleds av `connectionId + supplierProductId`, så samma artikel får samma id på alla enheter. Namnet kommer från artikeln. | M | ny funktion, inga schemaändringar |
| 2 | **Katalogen i eget lager.** Små tillstånd (inställningar, order, recept, favoriter, arbetsartiklar, de artiklar och priser som används) stannar där de är. Hela katalogen och prishistoriken ligger i IndexedDB eller på servern (se P). | M | lagring |
| 3 | **Inläsning med karantän per rad** för kataloger: dåliga rader hoppas över och räknas, och hela inläsningen avvisas bara om för stor andel är fel (tyder på ändrad sida). "Allt eller inget" behålls för små prisuppdateringar. | M | `ingestSupplierData` får ett läge |
| 4 | **Synkmetadata på anslutningen:** `lastCatalogSyncAt`, `lastPricesSyncAt`, `lastOffersSyncAt`, `lastError`, `catalogComplete` (hela sortimentet hämtades eller bara delar), `attributeCoverage` (andel artiklar med land, odlare, certifiering …). | M | fält |
| 5 | **Utökning av `supplierProducts`:** `facts`, `derived`, `rawAttributes`, `externalCodes` (se I). | B | fält |
| 6 | **Byt namn på `verification: 'live'` till `'supplier'`.** "Live" låter som aktuellt, men betyder bara "kommer strukturerat från grossisten". Färskhet avgörs av `fetchedAt`, aldrig av det ordet. | B | liten namnändring, en migrering av ett strängvärde |
| 7 | `orderMultiple` finns i modellen men **räknemotorn använder den inte** (verifierat: 0 träffar i `index.html`). Köper man i multiplar av 2 buntar räknar appen fel. Frakt, minsta order och fri frakt är **globala** inställningar men gäller per grossist. | V | åtgärdas när en verklig grossist har regeln |
| 8 | `products.name` ska följa artikelns namn när artikeln döps om hos grossisten (flagga `nameFromSupplier`). | V | fält |
| 9 | `quotes` kapas i dag till 10 per artikel. För historik (H) måste de **rullas upp innan de tas bort**. | V (när servern sparar) | logik |

**Alternativ jag övervägt för punkt 1:** låta orderrader peka direkt på artikeln och ta bort `products`. Det är renare på pränt men tvingar om `viewOf`, nycklarna i `calc`, recept, "hemma", rollback och alla 191 tester, utan att ge floristen något. Rekommendation: **behåll `products` som tunt lager nu**. Det behövs senare i alla fall som receptplats (R, punkt 4) och för alternativ mellan grossister.

---

## C. Behöver Match-modellen ändras?

**Nej, inte schemat.** Det som ändras är vad den används till.

| Tidigare tanke | Ny roll |
|----------------|---------|
| AI matchar "Vit ros" mot "Avalanche White 50 cm" med säkerhetsnivåer | Försvinner som huvudväg. Floristen väljer en exakt artikel själv, och en `match` skapas direkt (`method: 'picked'`, säkerhet 1) |
| Gissa vid osäkerhet | Ingen gissning. Vi visar exakta alternativ med längd och pris |
| Matcha de 20 vanligaste blommorna i en setup | Ingen setup. Bocka favoriter ur grossistens sortiment (M) |

Kvar som riktiga användningar:
1. **Ersättare:** när en favorit tagit slut eller utgått (`needsMatching` är redan sann) föreslås närmaste artiklar. Floristen väljer, `confirmMatch` uppdaterar arbetsartikeln.
2. **Migrering av gammal egen lista:** den som redan har "Vit ros" i sin egen lista ser vid första användning efter anslutning "Vilken vit ros menar du?" med exakta artiklar. Inte en säkerhetsnivå, bara ett val.
3. **Senare:** alternativ mellan grossister.

`method` är redan en fri sträng. Nya värden: `picked`, `substitute`, `migrated`. `confidence` används bara för förslag, inte för valda artiklar.

---

## D. Hur bör en favorit modelleras?

En favorit är **användarens preferens**, inte en egenskap hos katalogen. Katalogen byts ut vid synk, favoriten får aldrig försvinna med den. Därför en egen tabell:

```
userArticles[]   en rad per (connectionId, supplierProductId) som floristen har rört
  connectionId, supplierProductId
  favorite        true/false
  favoriteAt      tidpunkt
  sortKey         valfri egen ordning
  useCount        antal gånger den lagts i en bukett
  lastUsedAt
  productId       arbetsartikeln (när den skapats)
```

- **Lägg till/ta bort favorit:** sätt `favorite`.
- **Tillfällig artikel:** en rad med `favorite: false`. Den kan användas utan att bli favorit och syns bland senast använda.
- **"Dina vanligaste":** en vy över `useCount` och `lastUsedAt`. Inget behöver byggas, men datan samlas från dag ett till noll kostnad.
- **Utgången favorit:** raden finns kvar. Appen visar "Finns inte längre i sortimentet" och erbjuder ersättare (C).
- **Prioritering av uppdatering:** favoriter först (F i prisavsnittet).
- Gäller över anslutningar: favoritlistan slår ihop flera grossister.

Egen tabell är bättre än en flagga på `supplierProducts` eftersom katalogen ersätts och eftersom favoriter ska synkas mellan enheter som egna rader.

---

## E. Hur bör snapshot och senast verifierat pris modelleras?

Det mesta finns redan. Tillägg:

1. **Pris per artikel:** senaste raden i `quotes`. `fetchedAt` är när grossisten gav oss värdet, och är det enda som avgör färskhet.
2. **Per anslutning:** `lastCatalogSyncAt`, `lastPricesSyncAt`, `lastOffersSyncAt` (B, punkt 4). Det driver raden "Priser uppdaterade idag 08:14".
3. **Oförändrat pris:** i stället för att lägga till en ny rad varje dag sätts `lastCheckedAt` på den senaste raden när värdet är detsamma. Det gör "oförändrat" sanningsenligt och sparar plats. Prisändringar blir nya rader.
4. **Prisgrund (`priceBasis`) som metadata bredvid priset i `viewOf`:** `{ kind: 'supplier' | 'offer' | 'manual' | 'override' | 'estimate', asOf, source }`. Räknemotorn läser bara `pris`. Skärmen läser `priceBasis` för att skriva "uppdaterade idag 08:14", "från 3 dagar sedan" eller "kalkylpris". Så kan appen aldrig låtsas att ett gammalt pris är live.
5. **Färskhetsklasser** (rent deterministiska, tid från `fetchedAt`): *just nu* (kontrollerat i dag, nyss), *idag*, *nyligen* (1–3 dagar), *gammalt* (längre). Gränserna är en inställning, inte text i skärmarna.
6. **Priskontroll av en färdig bukett** sparas som en körning: `priceCheck = { startedAt, status, lines: [{ ref, before, after, changed, availability }] }`. "Priser kontrollerade just nu ✓" visas bara när varje rad i buketten har en notering hämtad strukturerat (inte AI-läst) under de senaste minuterna. Misslyckas en rad står den kvar med sin ålder och en tydlig rad om att den inte kunde kontrolleras.
7. **Offert:** buketten kan spara en fast kopia av priserna den räknades med (`order_quote` i datamodellen i planen), så att ett kundpris inte ändras i efterhand.

---

## F. Hur bör erbjudanden modelleras, så att dagens erbjudande inte används för ett framtida bröllop?

Erbjudanden är **inte** priser. De ligger i en egen tabell, så att det vanliga priset (och dess historik) förblir rent.

```
offers[]
  id, connectionId, supplierProductId
  kind              'percent' | 'price'
  discountPct       om grossisten anger det
  offerPackPrice    pris per förpackning, om angivet (samma regler för valuta och moms som quotes)
  currency, priceIncludesVat
  validFrom, validTo       datum eller tidpunkter. validTo kan vara okänt (null)
  appliesTo         'order' | 'delivery' | null (okänt)
  minPacks          villkor om det finns
  title             grossistens egen text
  fetchedAt, strategy
```

**Regel för när ett erbjudande får användas i en kalkyl** (en ren funktion, fullständigt testbar):

1. Priset måste kunna användas (`unusableReason` = null: kronor, uttryckligen utan moms).
2. Erbjudandet måste vara inhämtat nyligen (färskhetsgräns).
3. Om `validTo` är **okänt** gäller det bara samma lokala dag som det hämtades. Aldrig längre.
4. Kalkylens användningsperiod måste **ligga helt inom** erbjudandets giltighet. Täcker det inte hela perioden (till exempel "den här veckan" men erbjudandet slutar torsdag) används det inte i priset. Det visas bara som tips.
5. Är användningen ett **event i framtiden** (G) används erbjudanden aldrig, oavsett giltighet.
6. Har floristen satt en manuell override för artikeln vinner den (beslut 4).

**Prisordning för aktivt pris** (en regel i `viewOf`, inte spridd):

| Horisont | Ordning |
|----------|---------|
| Idag / den här veckan | override → gällande erbjudande → färskt grossistpris → gammalt grossistpris (markerat) → manuellt pris |
| Senare / event | override → kalkylpris (H) → senaste ordinarie grossistpris markerat "dagens pris, inte garanterat" → manuellt pris. **Erbjudanden är aldrig med.** |

Erbjudanden sparas med sitt slutdatum och rensas när de gått ut. De kommer in i historiken (H) aldrig som ordinarie pris.

---

## G. Hur bör eventDate / usageDate modelleras?

**På ordern, inte på buketten.** Skälet är förpackningslogiken: räknemotorn delar förpackningar mellan buketter i samma order, och det är bara rätt för buketter som köps vid samma tillfälle. En bukett för idag och ett bröllop i juni delar aldrig paket. Därför är **en order ett inköpstillfälle**, och då behöver räknemotorn inte ändras.

```
order.usage = { horizon: 'today' | 'week' | 'later' | 'event',
                date: 'ÅÅÅÅ-MM-DD' | null,        // krävs för 'event', annars valfritt
                leadDays: <heltal> }               // dagar mellan leverans och användning (grossistens standard)
```

- Saknas värdet (alla befintliga användare) tolkas det som `today`. Det är ett additivt fält och påverkar ingen migrering.
- **Prispolicy** härleds, aldrig skrivs för hand: `current` om användningsdatum ligger inom `estimateAfterDays` (förslag 14 dagar, en inställning), annars `estimate`.
- **Leveransdag** = användningsdag minus `leadDays`. Det är den dagen priser och tillgänglighet ska hämtas för, om grossisten kan det (`availabilityByDate`). `forDeliveryDate` finns redan på `quotes`.
- UX stannar vid fyra val (idag, den här veckan, senare, event). Datum krävs bara för event.
- **Följdändring som behöver ett beslut:** ett bröllop är ofta flera buketter, en hel kalkyl som pågår veckor. Det kräver att appen kan ha **flera sparade ordrar** (jobb). I dag finns en aktiv order. Modellen stödjer det (`state.order` kan bli `orders[]` med en aktiv), men det är en egen funktion och byggs inte nu.

---

## H. Hur kan prishistoriken senare stödja kalkylpris utan att vi bygger prognos?

Tre saker måste vara på plats redan nu, resten är senare:

1. **Ordinarie pris hålls rent från erbjudanden** (F). Annars blir historiken full av kampanjer.
2. **Varje notering vet vilken leveransdag den gäller** (`forDeliveryDate` finns) och sin valuta och momsstatus (finns).
3. **Historiken kapas inte i det som blir en ny skiktad historik.** I dag sparas högst 10 noteringar per artikel, och resten raderas. Det räcker för visning men förstör underlaget för säsongsmönster. Lösning: innan noteringar kapas rullas de upp till **veckosammanfattningar** `{ connectionId, supplierProductId, isoWeek, min, median, max, n, valuta, momsflagga }`. Dessa är små (några hundra byte per artikel och vecka) och ska ligga hos servern, inte i telefonen.

Ska kalkylpriset kunna följa en artikel över säsonger behövs också en **härledd artikelnyckel** (`articleKey` = släkte | sort | längd | klass) som överlever att grossistens artikelnummer byts mellan säsonger. Den är härledd, inte sanning.

Ingenting i detta är prognos. Det är bara att inte kasta data som inte går att få tillbaka. Data samlad från dag ett är värd mer än en färdig prognosmodell senare. Tillägget kostar lite, men kräver att servern sparar (se P).

Ett kalkylpris (`estimate`) visas alltid som intervall och som uppskattning ("ca 18–24 kr/st, kontrolleras närmare leverans"), aldrig som exakt pris.

---

## I. Vilka fält behövs för odling, närodlat, certifiering och säsong?

Principen *verifierad data → visa, okänd data → okänt, aldrig gissning* görs **strukturell** genom att dela artikeln i två behållare:

- **`facts`**: uppgifter grossisten faktiskt har lämnat, i typade fält, alla nullbara. *Bara härifrån* hämtas hållbarhetspåståenden som visas för floristen.
- **`derived`**: vår egen klassificering för att kunna organisera och söka (släkte, färggrupp, längdklass, grupp). Skrivs av regler eller AI. **Visas aldrig som fakta**, och skriver aldrig till `facts`.
- **`rawAttributes`**: grossistens egna nyckel/värde-par oförändrade, så att inget går förlorat och vi kan förstå fler fält senare.

```
supplierProducts[].facts   (alla valfria, null = okänt)
  countryOfOrigin      'SE', 'EC', 'NL' …  (ISO 3166-1 alpha-2)
  growingRegion        text från grossisten
  grower               { name, id }
  growingLocation      { name, postalCode, lat, lon }   koordinater bara om grossisten eller en deterministisk uppslagning ger dem
  certifications[]     { scheme, status: 'certified' | 'claimed', certificateNo, validUntil }
  organic              'certified' | 'unknown'          härleds bara av en certifiering vars system uttryckligen är ekologiskt. Aldrig av odlingsland
  seasonality          { months: [1..12], source }      bara om grossisten uppger det
  transport            { mode, distanceKm }             bara om grossisten uppger det
  availabilityWindow   { from, until }
supplierProducts[].derived
  genus, colourGroup, lengthClass, productGroup, groupPath[], classifierVersion, classifiedAt
supplierProducts[].externalCodes
  sku, gtin, vbn          (VBN är branschens produktkod i holländsk blomsterhandel (ej verifierat om pilotgrossisten har den))
```

**Svenskodlat, närodlat och ekologiskt är tre olika saker** och härleds oberoende:

| Märke | Villkor |
|-------|---------|
| **Svenskodlat** | `facts.countryOfOrigin === 'SE'` |
| **Närodlat** | kräver att floristens verksamhetsplats är satt **och** att odlingsplatsen är känd (region eller koordinat). Avstånd eller region jämförs mot en regel som floristen ställer in (`radiusKm` eller "samma region"). Är något okänt är svaret *okänt*, aldrig nej |
| **Ekologiskt** | `facts.organic === 'certified'` och bara då |
| **Säsong** | grossistens uppgift, eller en kuraterad säsongskalender för svenskodlat. För importerade blommor har "säsong i Sverige" ingen självklar betydelse, så märket visas inte där |

Floristens verksamhetsplats ligger i inställningarna: `shop.location = { label, lat, lon, region, country }`, med `nearbyRule = { kind: 'radiusKm', km }`. Geokodning av odlingsplatser byggs inte nu. Modellen har bara plats för resultatet.

**Källa vid visning:** påståenden skrivs "enligt grossisten". Egna uppgifter floristen lagt in (till exempel en lokal odlare utan grossistkoppling) får källan "enligt dig". Det är en tredje, tydligt märkt källa.

---

## J. Hur gör vi detta utan att anta att alla grossister har all metadata?

1. **Allt i `facts` är valfritt och nullbart.** Ingen kod får kräva ett fält.
2. **Adaptern deklarerar vad den kan leverera** i `capabilities`: `attributes` (vilka `facts`), `offers` (ja/nej), `catalogEnumeration` (kan hela sortimentet listas?), `availabilityByDate`. Det finns redan tre flaggor av den typen.
3. **Täckning mäts per synk** (`attributeCoverage`): till exempel "land känt för 82 % av artiklarna". Ett filter visas bara om det finns något att filtrera på. Annars en ärlig rad: "Grossisten uppger inte odlingsplats".
4. **Okänt är en egen grupp** i varje filter ("Okänt: 312 artiklar"), inte dolt och inte räknat som nej.
5. **Inget i AI-vägen får fylla luckor** i `facts` (K).
6. Procentsatser och sammanfattningar ("82 % svenskodlat") visas bara när täckningen är hög nog att vara meningsfull, och alltid med nämnaren: "av de 40 artiklar där grossisten uppger land".
7. Vilka fält pilotgrossisten har avgör hur mycket av vyn som blir verklig. Checklistan har därför fått två frågor om det (se `CHECKLISTA-PILOTGROSSIST.md`).

---

## K. Hur organiserar vi tusentals artiklar utan att köra AI varje gång?

Klassificering i lager, billigast först, **cachad på innehåll**:

| Lager | Vad | AI? |
|-------|-----|-----|
| 1. Regler och ordlistor | släkte (svenska, engelska, holländska och latinska namn), färg, längd (`50 cm`), klass (`A1`), förpackning, grossistens egen kategori | Nej |
| 2. Grossistens egen taxonomi | om den finns används den som `productGroup` | Nej |
| 3. AI för *resten* | namn som reglerna inte förstår, tveksamma färgord, sortnamn som släkte inte går att utläsa ur. Skickas i omgångar om ~200 namn, med strikt JSON | Ja, men bara här |

- **Cache:** resultatet sparas i `derived` med en nyckel av `hash(normaliserat namn + grossistens fält)` och `classifierVersion`. En artikel klassificeras om **bara** om dess innehåll ändrats eller om vi medvetet byter version. Aldrig vid användning.
- **Gruppvägen** (`Rosor → Vitt → Avalanche → 50 cm`) byggs av `derived` + exakta fält. Den är en *vy*. Den slår aldrig ihop artiklar, och två längder är två artiklar med två priser.
- **Delad cache mellan florister hos samma grossist** vore billigast (namn → klassificering är inte personuppgifter), men kan strida mot grossistens villkor om vi lagrar deras sortiment. **Beslutas efter att vi sett villkoren.**
- **Kvalitetskontroll:** ett facit på minst 100 verkliga artiklar per grossist. Reglerna ändras inte utan att facit körs.
- **Felsäkerhet:** felklassificering påverkar bara var en artikel hittas, aldrig priset. Alltid går det att söka på grossistens råa namn eller välja "Visa alla".
- **Kostnad:** hela AI-delen är en engångskostnad per katalog och per ändring. Storleksordning uppskattas i pilotfasen (ej verifierat).

---

## L. Hur visas erbjudanden utan att göra appen plottrig?

Princip: **sällan, kort och i rätt läge.**

- **En ingång, inte en strippe.** På startsidan efter synk: en enda rad, "Veckans erbjudanden (7)". Öppnas som ett blad med högst tre rader överst (favoriter först) och "Visa alla".
- **I byggläget:** bara en liten märkning på själva artikelraden (till exempel `−18 %`) när erbjudandet verkligen gäller för bukettens användningsdag (F). Inga bannrar, inga dialoger.
- **Ett tips per artikel och session, aldrig fler:** "Avalanche 60 cm är på erbjudande idag." Avfärdat tips kommer inte tillbaka.
- **Alternativ som byte, inte som reklam:** om en billigare, svenskodlad eller erbjuden artikel i samma grupp och längd finns visas ett litet *byt till*-förslag på raden, bara när det är relevant (till exempel när floristen redan valt artikeln).
- **Event i framtiden:** inga erbjudanden alls (F, punkt 5).
- **Kontroll:** "Visa erbjudanden" går att stänga av.
- Giltighet visas alltid: "gäller t.o.m. fredag".

---

## M. Hur förändras onboarding?

Tidigare: Anslut → prissättning → första bukett (med lat matchning av 20 vanliga blommor).

Nu:

1. **Välkommen** och **Anslut grossist** (oförändrat).
2. **Logga in** hos grossisten (oförändrat, den väg som pilotgrossisten tillåter).
3. **"Hämtar ditt sortiment …"** med framsteg. Körs i bakgrunden. Floristen kan gå vidare utan att vänta på att allt är klart.
4. **"Vilka arbetar du oftast med?"** Sortimentet organiserat i grupper (Rosor → Vitt …), sökfält överst, kryssrutor. **Inget är förkryssat.** Minst en räcker, och "välj senare" går alltid.
5. **Prissättning** (påslag och timpris, förifyllt).
6. **Första buketten** på favoriterna.

Verksamhetsplats (för närodlat) frågas **inte** här. Den frågas första gången någon trycker på filtret Närodlat. Det håller onboarding kort.

**Reservvägar:**
- Går inte hela sortimentet att lista hos grossisten (`catalogEnumeration` falskt) ersätts steg 4 av *sök din första favorit*. Sortimentet byggs upp av det floristen söker upp.
- Grossist som inte går att ansluta: dagens flöde (egen lista, import, de 20 vanliga blommorna) som fallback.

---

## N. Hur förändras huvudskärmen?

```
 God morgon                                   [ Synka ]
 Grossist ansluten ✓   Priser uppdaterade idag 08:14

 När ska blommorna användas?    [Idag] Den här veckan  Senare  Event
 [Liten] [Medel] [Stor] [Egen]

 [ Sök i hela sortimentet … ]     Favoriter · Erbjudanden · Svenskodlat …
 Favoriter
   Avalanche 60 cm      − 5 +      15,10 kr/st
   Lisianthus White     − 3 +
   Eucalyptus Cinerea   − 2 +

 ──────────────────────────────────
  Beräknat kundpris   ≈ 595 kr
  Priser uppdaterade idag 08:14
  Inköp 238 kr · marginal 60 %
  [ Kontrollera aktuellt pris ]
```

- **Användningsvalet är en liten rad**, inte ett formulär. Det minns sitt senaste val (oftast *Idag*) och byter prispolicy (G). Vid *Event* står det "Kalkylpris, kontrolleras närmare leverans".
- **Favoriter först.** Allt annat (sökning, filter) är en tryckning bort. Filterchips visas bara när det finns data (J).
- **Pris direkt från senaste snapshot.** Aldrig väntan på grossisten vid tryck.
- **"Kontrollera aktuellt pris"** hämtar bara bukettens artiklar och visar ändringarna ("Avalanche 60 cm 14,40 → 15,10 kr/st"), räknar om och skriver "Priser kontrollerade just nu ✓". Misslyckas det står buketten kvar med sin ålder, och kundpriset går alltid att få.
- **Synk är inte en grind.** Appen fungerar fullt ut utan inloggning på senast kända priser. Knappen Synka och en vänlig påminnelse efter en viss ålder räcker. Det är avgörande för kopplingar som kräver en ny inloggning (P).
- Detaljer, hållbarhetsfakta och erbjudandevillkor visas på artikelraden när man trycker på den, inte i listan.
- Reservvägen "Hämta pris" ligger kvar synlig tills första riktiga kopplingen fungerar (beslut 2).

---

## O. Hur förändras planen för lat matchning?

| Tidigare plan | Nu |
|---------------|----|
| Tryck "Vit ros" → förslag "Vi tror att …" med säkerhetsnivåer och AI vid osäkerhet | Ersätts av att floristen **väljer en exakt artikel** (favorit eller sökning). Ingen gissning och ingen jämförelsesäkerhet behövs |
| Matchningsmotor L0–L2 (minne, regler, AI-omrankning) | L0 (minne) finns redan som `match`. L1 blir **sök och rangordning över artikelfälten**. L2 (AI) behövs bara för svåra sökfrågor och ersättare |
| 100 par facit (ord → produkt) | Ersätts av facit för *klassificering* (K) och för *sökträffar* |
| Steg B4 i implementationsplanen | Ersätts av *katalog, klassificering, sökning och favoriter* (se "Reviderad ordning") |

Lat matchning finns kvar i en mindre form: **vid första användning av en gammal egen produkt** (C, punkt 2) och **vid ersättare**. Båda visar exakta alternativ, aldrig påståendet att två artiklar är "samma".

---

## P. Vad riskerar göra appen långsam, dyr eller skör?

**Uppmätt** (engångskörning mot modellen, den här servern, ca 10 dagars prisuppdatering för 50 favoriter):

| Artiklar | Inläsning | `viewOf` per anrop | Sparad JSON | Sparning |
|----------|-----------|--------------------|-------------|----------|
| 500 | 31 ms | 0,5 ms | 0,44 MB | 6 ms |
| 3 000 | 200 ms | 0,9 ms | 1,99 MB | 29 ms |
| 6 000 | 492 ms | 3,1 ms | 3,85 MB | 64 ms |

Beräkningarna är alltså **inte** problemet. Problemet är att `save()` skriver hela tillståndet vid varje tryck och att webbläsarens lagring har en gräns (vanligen 5 MB). Vid 6 000 artiklar är vi nära taket och en telefon är flera gånger långsammare än mätningen (uppskattning, inte mätt). `save()` sväljer dessutom fel, så en full lagring skulle inte synas.

| Risk | Allvar | Åtgärd |
|------|--------|--------|
| **Hela katalogen i samma lagrade post** | Hög | Eget lager för katalog och historik (B, punkt 2). Arbetstillståndet förblir litet |
| **Hela sortimentet går kanske inte att lista** hos grossisten (rate limits, villkor, inget API-anrop för "alla") | Hög, beror på grossist | `catalogEnumeration`-flagga, sökbaserad onboarding som reserv |
| **Priser för tusentals artiklar kan vara omöjliga att hämta** om de bara syns på varje produktsida | Hög, beror på grossist | `bulkPrices`-flagga. Priser hämtas bara för favoriter, använda artiklar och bukettens rader |
| **Inloggning varje dag** för kopplingar som kräver en ny session | Hög för användarupplevelsen | Synk är aldrig en grind (N). Appen fungerar på senast kända priser |
| **Priskontroll av en bukett misslyckas** (utgången session, spärr, driftstopp) | Medel | Aldrig blockerande. Raden visar sin ålder. Felkoderna finns redan |
| **Erbjudanden är ofta bara synliga på sidor**, inte i strukturerade anrop | Medel | `offers` är en valfri förmåga. Byggs bara om pilotgrossisten visar dem strukturerat |
| **Felklassificering** av artiklar | Låg (påverkar var man hittar, inte pris) | Sök på råa namn, "Visa alla", facit |
| **Hållbarhetspåståenden** som är fel eller överdrivna (greenwashing, marknadsföringsregler) | Hög vid fel | Bara `facts`, alltid "enligt grossisten", ingen poäng, inga procent utan nämnare. Granskas före lansering |
| **Lagring av grossistens sortiment och prishistorik** på vår server kan strida mot villkor | Medel | Fråga grossisten (bilaga A i planen) innan vi sparar mer än det florist själv använder |
| **Server och identitet:** katalog, historik och sessionsvalv kräver att servern känner en användare | Medel | Minsta möjliga: ett anonymt, enhetsbundet konto (slumpad nyckel) som senare går att göra om till ett riktigt. Inte ett kontosystem |
| **Komplexitet** (användningsdatum, erbjudanden, hållbarhet) som bryter "extremt enkel" | Hög för produkten | Allt visas bara när datan stödjer det och bara i rätt läge (L, N) |
| **Tidszon och veckogränser** för "i dag" och erbjudanden | Låg | All lagring i UTC, visning i Europe/Stockholm, datum för giltighet som lokala datum |
| **Räknefel** vid orderkrav som appen inte känner (`orderMultiple`, frakt per grossist) | Medel | Åtgärdas när en riktig grossist har regeln (B, punkt 7) |

**Kostnad:** den heta vägen (tryck på en blomma, räkna) är deterministisk och gratis. AI används bara i klassificering (en gång per katalog och ändring) och i svåra sökfrågor. Priskontroller är ett anrop per bukett med ett litet antal artiklar.

---

## Q. Vilka delar bör vi absolut INTE bygga ännu?

Bygg inte innan pilotgrossisten är vald och undersökt:

1. **Generell fjärrwebbläsare** och automatisk grossistinloggning (oförändrat beslut).
2. **AI-agent för grossistsidor.**
3. **AI-klassificering av hela sortiment** (bygg reglerna först när vi vet hur artiklarna ser ut).
4. **Erbjudandeflöde** (förrän pilotgrossisten visar sig exponera dem).
5. **Kalkylpris, prognos och säsongsmodell** (bara se till att historiken sparas).
6. **Geokodning, avståndsberäkning och närodlatsregel** (bara plats för koordinater i modellen).
7. **Procentsammanfattningar av hållbarhet** (kräver täckningsdata).
8. **"Dina vanligaste"** och annan inlärning (bara samla `useCount`).
9. **Alternativ och ersättare mellan grossister.**
10. **Flera sparade ordrar/jobb, offert-PDF och lager.**
11. **Hållbar bukett-optimering** och AI-buketter.
12. **Konto- och synksystem.**
13. **Valuta- och momsomräkning** (beslut 5).

Det som *kan* göras direkt efter att pilotgrossisten är vald: de additiva fälten (B), lagerdelningen, favoriter, regelbaserad klassificering och sökning, och pilotadaptern.

---

## R. Vad i en verklig florists arbetsflöde missar modellen fortfarande?

| Område | Saknas | Förslag |
|--------|--------|---------|
| **Svinn och bearbetning** | Putsa, taggar, skadade stjälkar, 5–10 % bortfall. Dagens beräkning ser bara överskott av förpackningar | Ett svinnpåslag i procent på stjälkar (en inställning) |
| **Övriga kostnader** | Vas, band, skum, hyra av material, leverans till kund, extra arbetstid. I dag finns bara emballage per storlek | En allmän "övrig kostnad"-rad (fritt namn, belopp) i order |
| **Recept som mönster** | Ett recept med exakta artiklar går sönder när en artikel är slut. Florister tänker "2 vita rosor 50–60 cm" | **Det generella "Vit ros" har kvar en roll som receptplats** (färg, släkte, längdspann), som löses mot en exakt artikel vid räkning. Skild från prisbärande produkt. Senare |
| **Leveransvillkor** | Beställningstid (t.ex. före 14), leveransdagar, minsta order och frakt per grossist (nu globala inställningar) | Per anslutning. Avgör också om användningsdagen går att hålla |
| **Förpackningsmultiplar** | `orderMultiple` används inte av kalkylen | Ta med när en verklig grossist har regeln |
| **Foton** | Florister väljer med ögat. Sortnamn säger lite | `imageUrl` finns. Visa miniatyr på artikelraden (upphovsrätt att kontrollera) |
| **Bröllop och event** | Offert med giltighetstid, anbetalning, antal i hundratal, flera datum, ompris vid bekräftelse | Flera ordrar/jobb, offert med fast prisfångst, påminnelse om omkontroll. Senare |
| **Andra inköpskällor** | Lokal odlare utan grossistkoppling, egen odling, torg. Där finns ofta de bästa hållbarhetsfakta | `conn_manual` med egna fakta märkta "enligt dig" |
| **Kvalitet och dagsform** | Samma artikel varierar mellan leveranser (knoppstorlek, hållbarhet) | Inte modellerat. Notera men bygg inte |
| **Prispunkter** | Många florister prissätter i jämna steg (495/595/795) snarare än kostnad plus påslag | Avrundning finns. Fler regler kan komma |
| **Budget först** | "En bukett för 500 kr" | Räkna baklänges till antal stjälkar. Lätt att lägga till senare utan AI |
| **Moms och bokföring** | Priser exklusive moms mot momsad försäljning | Bygg först när en grossist kräver det (beslut 5) |

---

## Reviderad ordning efter att pilotgrossisten är vald

(ersätter B4 och justerar övriga steg i `PLAN-grossistanslutning.md`, avsnitt J)

| Steg | Innehåll | Test efter steget |
|------|----------|-------------------|
| **P1** | Research på pilotgrossisten enligt checklistan: går sortimentet att lista, finns erbjudanden, vilka `facts`, hur loggar man in | Skriftligt beslut i adapterns README |
| **P2** | Additiva modelländringar: `userArticles`, `facts/derived/rawAttributes/externalCodes`, anslutningens synkfält, `order.usage`, `verification` omdöpt. Ingen UI | Migrering och rollback med nya fält, differenstestet oförändrat grönt |
| **P3** | Lagerdelning: katalog och historik utanför arbetstillståndet. Inläsning med radkarantän | Skalprov (tusentals artiklar), `save()`-tid, kvarstående differenstest |
| **P4** | Pilotadaptern, grön mot kontraktssviten, med sanerade svar | Kontraktssvit + fixturer |
| **P5** | Regelbaserad klassificering, grupper och sökning, mot facit | Facit på riktiga artiklar |
| **P6** | Onboarding och huvudskärm med favoriter, snapshotpris och färskhetstext. Reservvägarna kvar | UI-tester, riktig telefon |
| **P7** | "Kontrollera aktuellt pris" för bukettens rader | Falska grossister med fel (utgången session, spärr, ändrad sida) |
| **P8** | Erbjudanden och användningsdatum, om grossisten visar dem. Prisordningen i `viewOf` | Tester för alla fall i F, särskilt att erbjudanden aldrig används för event |
| **P9** | Hållbarhetsfakta och filter, om täckningen finns | Tester av regeln "okänt visas aldrig som fakta" |
| Senare | AI-klassificering, kalkylpris, närodlat med avstånd, säsong, receptplatser, flera ordrar | Egna planer |

Reservvägarna flyttas till *Importera prislista* först när P4 och P6 fungerar mot en verklig grossist.

---

## Beslut jag behöver från dig

1. **Arbetsartikel (B, punkt 1):** behåll `products` som tunt lager, skapat automatiskt 1:1 från vald artikel. Det betyder att ingenting i räkning och order ändras. Alternativet (orderrader direkt på artikeln) tar bort ett lager men kräver omskrivning. *Rekommendation: behåll.*
2. **Var katalogen ligger (B, punkt 2):** i telefonen (IndexedDB) eller på servern bakom ett anonymt enhetskonto. Beror på pilotgrossistens inloggning. *Rekommendation: avgör efter research, och i båda fallen separat från arbetstillståndet.*
3. **Användningsdatum per order, inte per bukett (G).** Det följer av hur förpackningar delas. Bröllop kräver senare flera ordrar. *Rekommendation: ja.*
4. **Erbjudanden bara som en ingång plus små märken (L).** *Rekommendation: ja.*
5. **`estimateAfterDays` (G):** förslag 14 dagar. Är det rimligt för en florist, eller ska det vara kortare?
6. **Namnbyte `verification: 'live'` → `'supplier'` (B, punkt 6).** Litet, men det är det enda i det byggda som redan nu vilseleder om färskhet.
7. **Är en daglig inloggning rimlig** om pilotgrossisten kräver en ny session varje dag, eller är det ett skäl att välja bort den kopplingen? Det avgör hur hårt vi driver "börja varje dag med grossisten".

---

## Bilaga: hur måtten togs fram

En engångskörning i en tillfällig mapp: `migrateV1toV2` av ett litet tillstånd, `ingestSupplierData` med N artiklar och en prisrad var, därefter nio dagliga uppdateringar av 50 favoriter, 20 anrop av `viewOf` och en `JSON.stringify` av hela tillståndet. Körd på arbetsmiljöns server (inte en telefon). Telefontider är en uppskattning. Ingen kod i repot är ändrad.
