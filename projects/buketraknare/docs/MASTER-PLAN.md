# MASTER-PLAN: Buketträknaren

**Status:** plan. Ingen produktionskod och inga tester är ändrade. PR #9 är orörd. PR #10 mergas inte utan godkännande.
**Ersätter delvis:** `PLAN-grossistanslutning.md` (se avsnitt 2). `KONSEKVENSANALYS-FLORISTVISION.md`, `BESLUT.md`, `CHECKLISTA-PILOTGROSSIST.md` och `CLOUDFLARE-DEPLOYMENT.md` gäller fortfarande där de inte säger emot den här planen.

Markeringen **(ej verifierat)** betyder att jag inte har kunnat kontrollera uppgiften mot själva källan. Det gäller särskilt allt om Blomstergrossistens webbplats (nätverket i min miljö blockerar den), aktuella molnpriser (hämtade ur sökträffar, kan ha ändrats) och juridik (jag är ingen jurist).

---

## 0. Kort version

1. **Det som är byggt håller.** Räknemotor, packlogik, stabila id:n, migrering, grossistkontrakt, tester och differenstest bevaras. Det som ändras är *ovanpå* dem: kunder, jobb, arrangemang, inköp och faktura, samt konton och flera butiker (multi-tenant).
2. **Grossistens exakta artikel är sanningen.** Floristens "arbetsartikel" (`products`) och matchningslagret (`matches`) är i målet bara en övergångslösning. Nya arrangemang pekar direkt på en artikel (`ArticleRef = connectionId + supplierProductId`). Den egna prislistan är en vanlig anslutning, så den fungerar likadant.
3. **Allt som är pengar räknas av vanlig kod.** AI organiserar, förklarar och föreslår. AI räknar aldrig, väljer aldrig tyst en ersättare och beställer eller fakturerar aldrig.
4. **Agenten får läsa, söka, synka, räkna, skapa listor, fylla varukorgen och skapa fakturautkast. Den får aldrig slutföra köp, godta en ersättare med ekonomisk följd, skicka faktura eller ändra en bindande order.** Det upprätthålls i kod (en policymotor utanför AI:n) och i tester, inte med en uppmaning till modellen.
5. **Pilotgrossisten är vald, men ingen metod är vald.** Vi vet ännu inte om Blomstergrossisten har prisfil, API eller strukturerade webbanrop. Därför kommer *research och en tillståndsfråga till grossisten före all webbläsarteknik* (Grind A).
6. **Pilotkostnaden kan hållas nära noll** (gratisnivåer, betala efter användning). Det som kan bryta det är inte webbläsartid (ca 0,09 USD per timme) utan om AI körs vid varje synk. En AI-tung design kostar ca 18 USD per florist och månad, en AI-sparande ca 1–2 USD. Därför är "AI är aldrig på den heta vägen" ett arkitekturkrav.
7. **Bygg i fem steg, men i en annan ordning än du föreslog på ett ställe:** MVP 1 (floristens kärna, lokalt först) → MVP 2 (grossistpilot) → MVP 3a (deterministiskt inköp) → **MVP 4 (faktura) före MVP 3b (agentens varukorg)**, eftersom faktura inte beror på grossisten och är lågrisk, medan varukorgen är den farligaste delen. Se avsnitt 13.
8. **Det riskablaste är inte tekniken utan grossistens tillåtelse** att automatisera inloggad åtkomst och varukorg, samt lagring av kunders personuppgifter (GDPR). Båda behöver en person, inte kod.

---

## 1. Principer (det som aldrig får brytas)

| # | Princip | Hur den upprätthålls |
|---|---------|----------------------|
| 1 | Buketträknaren lär sig hur floristen arbetar, inte tvärtom | UX-test med verkliga florister före varje större skärm. Max två tryck till huvudfunktioner |
| 2 | Matematik, moms, procent, packar, datum, artikel-id och totalsummor är deterministiska | En ren, testad kalkylmotor. AI har ingen väg in i summorna |
| 3 | Okänt är ett giltigt tillstånd. Gissa aldrig fakta | `null` i datan, aldrig ett standardvärde som ser ut som fakta. Hållbarhet bara ur `facts` |
| 4 | Ekonomiskt bindande handlingar kräver floristens uttryckliga godkännande | Policymotor, tillståndsmaskiner och tester (avsnitt 8) |
| 5 | Visa aldrig ett gammalt pris som live | `priceBasis` med tidsstämpel på varje pris. Färskhetstext räknas av kod |
| 6 | Hellre "kan inte verifiera priset nu" än ett fel pris | Invarianter och karantän vid inläsning, fel stoppar åtgärder (avsnitt 7.6) |
| 7 | Data separeras mellan butiker | Butiks-id på varje rad, ett enda dataåtkomstlager och isoleringstester (avsnitt 9) |
| 8 | Kostnad mäts per butik och skalar med användning | `UsageEvent` kring varje dyr operation (avsnitt 10) |
| 9 | AI-leverantören ska gå att byta | `AIProvider`-gränssnitt, uppgifter med JSON-schema, test mot facit (avsnitt 3.4) |
| 10 | Använd den billigaste, stabilaste och säkraste metoden som fungerar | Strategiordning API → prisfil → strukturerad webbdata → DOM → AI-agent → visuell AI |

---

## 2. Masterbriefen jämförd med `PLAN-grossistanslutning.md`

| Område | Tidigare plan | Briefen | Dom |
|--------|---------------|---------|-----|
| Omfång | Kalkylator + grossistanslutning | Hela flödet kund → jobb → inköp → varukorg → faktura | **Utökas kraftigt.** Planen byggdes för ett steg, nu behövs en produktplan |
| Grossistens artikel | Floristens "Vit ros" matchas mot artikel | Grossistens artikel är sanningen | **Redan beslutat i konsekvensanalysen.** Gäller nu hela vägen, inklusive arrangemang |
| Matchning (L0–L2) | Regler + AI-omrankning | Ingen generell matchning, exakta artiklar och favoriter | **Ersatt.** Matchning finns bara kvar för ersättare och migrering |
| Cloud browser | "Bygg inte generisk fjärrwebbläsare före pilot" | Ingår i arkitekturen | **Förenligt.** Pilotgrossisten är vald, men metod väljs först efter research. Webbläsare bara om enklare väg saknas |
| AI-agent | Inte före pilot | Ingår, men får aldrig köpa | **Förenligt.** Läsrättigheter först. Skrivande (varukorg) är en egen förmåga med egen grind |
| Skrivskyddat kontrakt | Adaptrar får bara göra läsande anrop (GET) | Agenten ska fylla varukorg | **Spänning.** Kräver en ny, uttryckligen godkänd förmåga `cart` med policymotor, utan att luckra upp läsvägen |
| Konton | "Inget stort kontosystem" | Multi-tenant SaaS | **Ändras.** Konton och butiksisolering krävs från MVP 2 |
| Kund/Event/Arrangemang | Fanns som "order, offert" i datamodellen, ej byggt | Tydliga entiteter | **Nytt, avsnitt 4** |
| Inköp, varukorg, faktura | Inte med | Centralt | **Nytt, avsnitt 5–8** |
| Erbjudanden, eventdatum, hållbarhet | Beskrivet i konsekvensanalysen | Samma | **Bekräftat.** `offers`, `usage`, `facts/derived` gäller som beskrivet |
| Kostnadsmätning, prissättning | Inte med | Krav | **Nytt, avsnitt 10–11** |
| Självläkande connectors | Inte med | Önskas | **Nytt, avsnitt 7.5.** Först upptäckt och säker nedtrappning, förslag till reparation senare |
| Fallbackvägar (skärmdump, ChatGPT Work, brevlåda) | Kvar synliga tills riktig koppling fungerar | "Bygg inte runt ChatGPT Work" | **Förenligt.** De är reservvägar för floristen utan koppling, aldrig huvudväg, och ska aldrig kräva eget AI-abonnemang. De döljs när en riktig koppling fungerar |

**Det som gäller kvar från den tidigare planen:** A (behåll), C (målupplevelse, utvidgas), E (inloggning utan lösenordshantering), F (prisuppdatering), H (modell v2), I (Cloudflare-diagnos) och bilagorna A–C. **Ersatt:** D:s arkitektur (utökad i avsnitt 3), G (matchning), J (stegen, ersatta av avsnitt 13).

---

## 3. Arkitektur

### 3.1 Översikt

```
                       ┌──────────────────────────── Floristens telefon / dator (PWA) ───────────────────────────┐
                       │  Hem · Kunder · Jobb · Arrangemang · Inköp · Faktura · Grossist                         │
                       │  deterministisk kalkylmotor (samma kod som servern) · lokal cache (IndexedDB)            │
                       └──────────────────────────────────────────┬───────────────────────────────────────────────┘
                                                                  │ HTTPS (inloggad, butiks-id i varje anrop)
 ┌────────────────────────────────────────────── API (Cloudflare Worker) ───────────────────────────────────────────┐
 │  Auth · Butikskontext · Dataåtkomstlager (alltid butiksfilter) · Policymotor · Användningsmätning                │
 │                                                                                                                  │
 │  Tjänster:  Jobb/Kalkyl · Inköp · Faktura · Katalog/Favoriter · Synk · Observability · Admin                     │
 └───────┬───────────────────┬──────────────────────────┬────────────────────────┬───────────────────────────────────┘
         │                   │                          │                        │
   ┌─────▼─────┐      ┌──────▼──────┐          ┌────────▼────────┐      ┌────────▼─────────┐
   │ Databas   │      │ Valv (DO)   │          │ Kö + schemaläggare│     │ AI-gateway       │
   │ (D1/SQL)  │      │ krypterade  │          │ synk, priskontroll │     │ AIProvider       │
   │ butiksdata│      │ sessioner   │          │ varukorg           │     │ (byt leverantör) │
   └───────────┘      └──────┬──────┘          └────────┬──────────┘     └────────┬─────────┘
                             │                          │                         │ (endast när det behövs)
                             │            ┌─────────────▼─────────────┐           │
                             └───────────►│ Grossistanslutningar      │◄──────────┘
                                          │ SupplierConnector (en per │
                                          │ grossist)                 │
                                          └──────┬──────────┬─────────┘
                                                 │          │
                          ┌──────────────────────▼─┐   ┌────▼─────────────────────┐
                          │ HTTP-läge (API, feed,   │   │ Molnwebbläsare           │
                          │ webbutikens JSON med    │   │ (Cloudflare Browser Run   │
                          │ cookies ur valvet)      │   │ eller liknande): inloggning│
                          │ billigast och snabbast  │   │ (Live View), DOM, varukorg│
                          └─────────────────────────┘   └──────────────────────────┘
```

### 3.2 Beslut i arkitekturen (med rekommendation)

| Fråga | Rekommendation | Skäl | Alternativ |
|-------|----------------|------|------------|
| Var körs servern | Cloudflare Workers (det vi redan har) | Betala efter användning, gratisnivåer, en leverantör | Annan serverlös tjänst |
| Databas | **D1 med ett obligatoriskt dataåtkomstlager som alltid filtrerar på butiks-id** | Enklast, SQL, backup, billigt. Isolering via kod och tester | En Durable Object per butik (isolering "av konstruktion" men svårare att fråga över butiker) |
| Sessioner/hemligheter | **Durable Object-valv** (krypterad session per anslutning, lås, takt) | Ett skrivande ställe per anslutning, inga lopp | Krypterade rader i D1 |
| Webbläsare | **Cloudflare Browser Run** (tidigare Browser Rendering) om research visar att det behövs | Live View och *Human in the Loop* finns dokumenterat, betala per timme **(ej verifierat mot aktuell prissida)** | Browserbase eller liknande (Developer 20 USD/mån för 100 timmar, enligt tredjepartskälla) |
| Kö och schemaläggning | Cloudflare Queues + Cron Triggers | Billigt, ingår i samma plattform | |
| AI | **`AIProvider`-gränssnitt**, första adaptern Claude | Byta leverantör utan att bygga om | Direktanrop (vi har det i dag i `worker.js`, och det ska flyttas bakom gränssnittet) |
| Klient | PWA med lokal cache | Fungerar i butik utan täckning | Native app (inte nu) |
| Var ligger MVP 1:s data | **Lokalt (IndexedDB) med server-redo id:n**, ingen server förrän MVP 2 | Inga konton och ingen kostnad för att pröva kärnan | Server från början (dyrare och långsammare att komma igång) |

### 3.3 Det som är gemensamt för klient och server

Kalkylmotorn måste vara **samma kod** i telefonen (omedelbart pris) och på servern (inköpsplan, varukorgsvalidering, faktura). Därför flyttas `calc()` ur `index.html` till en delad modul (avsnitt 12). Differenstestet mot den gamla appen gäller även efter flytten.

### 3.4 AI-gateway

```
AIProvider.run({ task, input, schema, budget, tenantId }) → { output, usage }

Uppgifter (var och en har JSON-schema, ett eget facit och en modellnivå):
  classifyArticles        klassificera grossistens namn (efter att regler gjort sitt)
  proposeSubstitutes      föreslå alternativ när en artikel saknas
  diagnoseConnectorChange förklara vad som ändrats på en grossistsida (på sanerad data)
  draftInvoiceText        formulera fakturarader (belopp kommer alltid från kalkylmotorn)
  (senare) suggestBouquet
```
- **Alla utdata valideras av vanlig kod** (schema, intervall, kända artikel-id). AI-svar som inte klarar valideringen kastas.
- **Datasparsamhet:** klassificering får bara artikelnamn och fält, aldrig kunduppgifter. Fakturatext får bara det som behövs.
- **Modellnivåer** konfigureras per uppgift (billig/mellan/stark), så att kostnad och kvalitet kan ställas utan kodändring.
- **Leverantörsbyte** testas genom att köra samma facit mot en ny adapter. `worker.js` anropar i dag Anthropics SDK direkt (`/api/read`), vilket flyttas bakom gränssnittet och får mätning.

---

## 4. Domänmodell

### 4.1 Namnbeslut

| Brief | Beslut | Skäl |
|-------|--------|------|
| Tenant / Shop | **`Shop`** (butik) i domänen, `shopId` som isoleringsnyckel överallt | Det floristen känner igen. "Tenant" är teknik |
| Arrangement / FloralItem / Design | **`Arrangement`** (kod) och UI-etikett = typnamnet floristen valt ("Brudbukett"). Rader heter **`ArrangementLine`** | Är det ord florister själva använder. "Design" är för vagt |
| Event / Jobb / Order | **`Event`** (UI: "Jobb"). Ett Event är **ett inköpstillfälle** (en leveransdag) | Förpackningar delas bara inom ett inköpstillfälle |
| Varukorg | **`CartPreparation`** | Den förbereds, den "beställs" aldrig av oss |

### 4.2 Entiteter

Alla rader har `shopId`, `id` (ULID), `createdAt`, `updatedAt`, `rev` och `deletedAt` (för senare synk). Utom där annat anges.

**Identitet och butik**

| Entitet | Viktiga fält | Anmärkning |
|---------|--------------|------------|
| `Shop` | name, location (`shopLocation`: label, lat?, lon?, region, country), plan, createdAt | `PricingSettings` hör hit |
| `User` | email, auth-uppgifter | Global, kopplas till butik via `Membership` |
| `Membership` | userId, shopId, role (`owner` / `staff`) | Personal kan sakna rätt att se inköpspriser och marginal (se luckor) |
| `PricingSettings` (per butik) | defaultMarkupPercent, defaultLaborFee, hourlyLaborRate?, minimumLaborFee?, roundingRule, vat (satser per radtyp), deliveryFee, setupFee, sizePresets | Standardvärden. Varje arrangemang och jobb kan överstyra |

**Kunder och jobb**

| Entitet | Viktiga fält |
|---------|--------------|
| `Customer` | name, email, phone, notes |
| `Event` | customerId, name, type (`wedding`/`funeral`/`bouquet`/`other`), `usage` (`horizon`: today/week/later/event, `date`), eventDate, deliveryDate, status, notes, pricingOverrides?, frozenQuoteId? |
| `Arrangement` | eventId, name, kind, **quantity**, sizePresetId?, markupOverridePercent?, laborOverride? (flat avgift eller minuter), notes, imageRef? |
| `ArrangementLine` | arrangementId, `articleRef` (`connectionId` + `supplierProductId`) eller `kind: 'custom'` (fri kostnad), **qtyPerArrangement**, unit, note |
| `EventFee` | eventId, kind (`delivery`/`setup`/`other`), label, amount, vatRate |
| `QuoteSnapshot` | eventId, version, createdAt, lines (pris per arrangemang med `priceBasis`), totals, validUntil, status (`draft`/`sent`/`accepted`) |

**Grossist**

| Entitet | Viktiga fält |
|---------|--------------|
| `SupplierConnection` | supplierId, status, authKind, vaultRef, capabilities (inkl. `cart`, `offers`, `catalogEnumeration`, `attributes`), `lastCatalogSyncAt`, `lastPricesSyncAt`, `lastOffersSyncAt`, `connectorVersion`, `health` |
| `SupplierProduct` | connectionId, supplierProductId (SKU), name, `facts`, `derived`, `rawAttributes`, packQuantity, packUnit, orderMultiple, discontinued, firstSeenAt, lastSeenAt |
| `PriceQuote` | connectionId, supplierProductId, packPrice, currency, priceIncludesVat, availability, forDeliveryDate, fetchedAt, strategy, verification (`supplier`/`ai_read`/`manual`) |
| `Offer` | connectionId, supplierProductId, promotionId, promotionPrice, normalPrice, validFrom, validTo (okänt = bara samma dag), appliesTo, minPacks, fetchedAt |
| `Favorite` | articleRef, favorite, favoriteAt, useCount, lastUsedAt |
| `PriceOverride` | articleRef, price, setAt, reason (manuell override, vinner över allt) |

`SupplierProduct.facts` innehåller bara det grossisten uppgett (land, odlare, odlingsplats, certifieringar, säsong). `derived` är vår egen klassificering och visas aldrig som fakta. Detaljer i konsekvensanalysen, avsnitt I.

**Inköp**

| Entitet | Viktiga fält |
|---------|--------------|
| `PurchasePlan` | connectionId, deliveryDate, eventIds[], status (`draft`/`confirmed`), createdAt |
| `PurchaseRequirement` | planId, articleRef, neededStems (summa över arrangemang × antal), onHand, toBuy, packs, packQuantity, leftover, unitCost, priceBasis |
| `CartPreparation` | planId, connectionId, status, lines[] (articleRef, packs, observedPrice, availability), observedTotal, substitutions[], preparedAt, expiresAt, runId |
| `SubstitutionProposal` | cartPreparationId, originalArticleRef, candidates[], status (`pending`/`accepted`/`rejected`), decidedBy, decidedAt |

**Faktura**

| Entitet | Viktiga fält |
|---------|--------------|
| `InvoiceDraft` | eventId, customerId, status (`draft`/`ready_for_review`/`approved`/`sent`/`voided`), lines[], totals (exkl. moms, moms per sats, totalt), currency, issueDate, dueDate, approvedBy, approvedAt, sentVia, externalRef, version |
| `InvoiceLine` | description, quantity, unitPrice, vatRate, amountExVat, vatAmount, source (arrangement/fee) |

**Senare, men förberett**

| Entitet | Not |
|---------|-----|
| `StockLot` | articleRef, stems, unitCost, acquiredAt, source, eventId? | Överskott och lager. Byggs inte i MVP 1–4 |

**Drift**

| Entitet | Not |
|---------|-----|
| `UsageEvent` | shopId, kind, quantity, unit, connectionId?, correlationId, at. Se avsnitt 10 |
| `SyncRun` | connectionId, kind, startedAt, finishedAt, status, scope, counts (oförändrade, ändrade, nya, borttagna, karantän) |
| `ConnectorHealth` | connectionId, connectorVersion, state, lastError, lastCheckAt, invariantResults |
| `AuditLog` | shopId, actor, action, target, at. Alla ekonomiska handlingar och godkännanden |

### 4.3 Tillståndsmaskiner

```
Event:            planning → quoted → approved → ordering → ordered → completed → invoiced
                  (quoted → planning vid ändring: ny QuoteSnapshot-version.  cancelled från valfritt läge före ordered)

CartPreparation:  queued → preparing → ready_for_review | needs_decision | failed
                  ready_for_review → reviewed (floristen öppnade grossistens varukorg) → expired
                  needs_decision → (florist väljer ersättare) → preparing
                  Det finns INGET läge "placed" som sätts av oss.

InvoiceDraft:     draft → ready_for_review → approved → sent        (sent bara via användarens handling)
                  approved → draft (vid ändring: ny version, godkännandet gäller inte längre)
                  draft/ready_for_review → voided
```

### 4.4 Invarianter (varje punkt ska ha ett test)

1. Ingen rad utan `shopId`. Ingen fråga utan butiksfilter.
2. `ArrangementLine.articleRef` pekar på en artikel i samma butiks anslutning, eller på `custom`.
3. Avalanche 50 cm och Avalanche 60 cm är olika `SupplierProduct` med olika pris.
4. Priset i en kalkyl kommer alltid från `PriceQuote` / `Offer` / `PriceOverride` via en enda regel, och bär `priceBasis`.
5. En `QuoteSnapshot` är oföränderlig när den är skickad.
6. En `InvoiceDraft` kan inte bli `sent` utan att ha varit `approved` av en användare, och kan inte ändras efter `approved` utan att bli en ny version.
7. `CartPreparation` kan aldrig innehålla ett läge som betyder att köpet genomförts.
8. Ett erbjudande används aldrig för ett datum utanför sin giltighet, och aldrig för ett framtida event.

---

## 5. Dataflöden

### 5.1 Supplier → SupplierConnection → SupplierProduct → Price

```
Supplier (Blomstergrossisten, senare A, B, C)
   │  strategiordning: API/feed → prisfil → webbutikens strukturerade data → DOM → AI-agent → visuell AI
   ▼
SupplierConnection  (en per butik och grossist)
   │  ├─ session i valv (krypterad). Lösenord sparas aldrig.
   │  ├─ capabilities: catalogEnumeration, bulkPrices, offers, availabilityByDate, attributes, cart
   │  └─ hälsa: inloggad / behöver ny inloggning / degraderad / frånkopplad
   │
   │  synkar (se avsnitt 7.3):  katalog (sällan)  ·  favoriter (dagligen)  ·  bukettens rader (vid kontroll)  ·  erbjudanden
   ▼
Inläsning (deterministisk)
   ├─ validera form och typer
   ├─ invarianter: unika artikel-id, valuta, momsstatus, prisband mot historik, katalogstorlek mot förra
   ├─ dåliga rader → karantän (räknas, visas för oss, aldrig för floristen som fakta)
   └─ för stor andel dåliga → hela inläsningen avvisas, anslutningen blir "degraderad"
   ▼
SupplierProduct  (exakt artikel: SKU, namn, längd, klass, pack, facts, derived, rawAttributes)
   ├──► PriceQuote   (historik, fetchedAt, strategy, verification)  ──► veckosammanfattningar (rollup) för framtida kalkylpris
   └──► Offer        (promotionId, pris, giltighet)  ·  separat från ordinarie pris
```

### 5.2 Shop → Customer → Event → Arrangement → ArrangementLine

```
Shop ── PricingSettings (påslag, arbetsavgift, moms, avrundning, avgifter)
  └─ Customer  (namn, e-post, telefon, anteckningar)
        └─ Event  (Emma & Johan, bröllop, 12 juni; usage.date; status)
              ├─ Arrangement  × quantity   (Brudbukett ×1, Tärnbukett ×3, Bordsdekoration ×8 …)
              │     └─ ArrangementLine ──► articleRef (SupplierProduct)  eller  custom (fri kostnad)
              │                              └─► aktivt pris  (PriceOverride > erbjudande som gäller > färskt grossistpris > gammalt (märkt) > manuellt)
              ├─ EventFee (leverans, uppsättning, övrigt)
              └─ prismotorn (ren funktion):  inköp blommor + inköp tillbehör
                        → påslag → arbete → övriga avgifter → moms → avrundning → KUNDPRIS per arrangemang och för jobbet
                        └─ QuoteSnapshot  (när jobbet blir "quoted": fast kopia av priserna)
```

### 5.3 Events → PurchaseRequirements → SupplierCart

```
Events  (status approved/ordering, samma leveransdag och grossist)
   ▼
PurchasePlan
   ├─ PurchaseRequirement per artikel:
   │     behov = Σ (qtyPerArrangement × quantity) över alla arrangemang i valda jobb
   │     − lager (senare)  →  att köpa = ⌈behov ÷ förpackning⌉ (hänsyn till orderMultiple)
   │     överskott = köpt − behov
   ├─ LIVEPRISKONTROLL  (bara dessa artiklar)  →  ändrade priser, slutsålda
   │     └─ saknas något → SubstitutionProposal  →  FLORISTEN väljer  →  räknas om
   ▼
CartPreparation  (agent, endast läsa + lägga i korg, via policymotorn)
   ├─ läser tillbaka grossistens varukorg och jämför med planen (artikel, antal, pris). Avvikelse → misslyckad körning
   └─ "Beställningen är klar för kontroll"
        ▼
   [GRANSKA HOS GROSSISTEN]  →  floristen kontrollerar och beställer själv.  Vi trycker aldrig på köp.
```

### 5.4 Event → InvoiceDraft

```
Event (approved/completed)  +  Customer (e-post)  +  Arrangements  +  EventFees  +  QuoteSnapshot (godkänd)
   ▼  (vanlig kod bygger rader, moms per sats, summor.  AI får bara formulera beskrivande text)
InvoiceDraft  (draft → ready_for_review)
   ▼  floristen granskar och ändrar
approved   (godkännande loggas: vem, när, vilken version)
   ▼  [SKICKA]  (kräver ett uttryckligt tryck, aldrig automatik)
InvoiceProvider  (gränssnitt: createDraft? send(draft) → externalRef.  Första varianten: PDF/e-postutkast utan integration)
```

---

## 6. Prismotorn

Det befintliga tillvägagångssättet är rätt och utvidgas, det skrivs inte om:

```
inköp blommor       Σ artiklar (hela förpackningar, delade inom jobbet)         ← finns: calc()
+ inköp tillbehör   Σ tillbehörsartiklar (samma packlogik) eller egen kostnad    ← utvidgas: ersätter konstanten "emballage"
= underlag
+ påslag            underlag × markup%                                            ← finns
+ arbete            fast avgift ELLER minuter × timpris                           ← finns (minuter × timpris), fast avgift läggs till
+ övriga avgifter   leverans, uppsättning, övrigt (ej med påslag)                 ← nytt, på jobbnivå
= pris före moms    → moms per radtyp → avrundning → KUNDPRIS                      ← finns (moms, avrundning)
```

Briefens exempel (186 kr inköp, 120 % påslag = 223 kr, arbete 125 kr = 534 kr) följer exakt samma struktur som dagens motor.

**Bevarat och bevisat:** hela förpackningar, delning mellan arrangemang, "pris saknas aldrig 0 kr", ca/ålder, frakt, "har hemma". De 145 tillstånden i differenstestet ska ge identiska priser när motorn flyttas.

**Tillägg som motorn behöver:**
1. **Tillbehör som artiklar** (Oasis, band, vaser) med samma packlogik, och fria kostnadsrader.
2. **Fast arbetsavgift** som alternativ till minuter × timpris, och överstyrning per arrangemang.
3. **Arrangemangets antal** (×8) och summering på jobbnivå med avgifter och moms per sats.
4. **`orderMultiple`** (finns i modellen men används inte av motorn i dag).
5. **Inköpssummering över jobb** som en egen ren funktion ovanpå packlogiken, med samma jobbdatum och grossist.
6. **Aktivt pris** väljs av en enda regel, med prisordning:

| Horisont | Ordning |
|----------|---------|
| Idag / den här veckan | override → gällande erbjudande → färskt grossistpris → gammalt grossistpris (märkt) → manuellt pris |
| Senare / event | override → kalkylpris → senaste ordinarie grossistpris märkt "dagens pris, ej garanterat" → manuellt pris. **Erbjudanden är aldrig med** |

7. **`priceBasis`** (`kind`, `asOf`, `source`) följer varje pris, så att gränssnittet kan säga "uppdaterade idag 08:14" eller "från 3 dagar sedan". Räknemotorn ser bara talet.

**Pooling och marginal.** När flera jobb samordnas blir den verkliga inköpskostnaden lägre än kalkylerad. Offerten bygger på jobbets egna kostnad (konservativt). Skillnaden är floristens vinst, och synlig som "faktisk marginal" först när faktiska inköp finns.

---

## 7. Grossistagenten och connectorerna

### 7.1 Strategiordning

1. Officiellt API/feed.
2. Prisfil, produktfeed, EDI eller annan tillåten strukturerad data.
3. Strukturerade anrop som den inloggade webbutiken själv gör, med sessionen ur valvet (vanlig HTTP, ingen webbläsare).
4. DOM/webbläsarautomation.
5. AI-agent som navigerar eller förstår sidan.
6. Visuell AI bara när strukturerad information saknas.

**Regel:** ett pris som går att läsa strukturerat läses aldrig av AI. AI används för det som kräver förståelse: ny sida, klassificering, alternativ, förklaring av ändringar.

### 7.2 Anslut grossist (inloggning utan lösenordshantering)

```
1. Floristen trycker ANSLUT.
2. Vi startar en molnwebbläsare på grossistens riktiga inloggningssida.
3. Floristen loggar in via Live View (tvåstegsverifiering och CAPTCHA gör hon själv). Lösenordet sparas aldrig av oss.
4. Vi känner igen inloggat läge deterministiskt (inloggningsmarkör på sidan) och sparar sessionens cookies krypterat i valvet. Webbläsaren stängs.
5. Senare körs sync via HTTP-läge (cookies ur valvet), eller via en ny webbläsare med cookies injicerade om HTTP-läge inte räcker.
6. Går sessionen ut: "Blomstergrossisten behöver din inloggning igen."  [LOGGA IN]
```

- **Cloudflare Browser Run har dokumenterad *Live View* och *Human in the Loop* med strukturerad överlämning** (sökträffar mot Cloudflares dokumentation och changelog). Att cookies går att exportera och återinjicera efter överlämningen är **inte verifierat** och måste provas i en teknisk förstudie.
- Lösenordet passerar fortfarande molnwebbläsaren som tangenttryck medan floristen skriver. Vi sparar och loggar det aldrig, men vi ska säga det rakt ut i integritetsvillkoren.
- **En session är en nyckel till floristens grossistkonto**, inklusive möjligheten att beställa. Den ska därför skyddas som ett lösenord (avsnitt 9), och agentens verktyg saknar helt ett köpkommando (avsnitt 8).

### 7.3 Synk (kostnadssnål)

| Synk | När | Omfång | Mål |
|------|-----|--------|-----|
| Katalogsynk | Första anslutningen och sedan sällan | Hela sortimentet, **om grossisten tillåter det** | Fylla `SupplierProduct` |
| Favoritsynk | Dagligen, eller när appen öppnas och priserna är gamla | Favoriter, ofta använda, artiklar i kommande jobb | Hålla snapshot färsk |
| Priskontroll | När en bukett eller ett jobb är klart | **Bara de artiklar som används** | "Priser verifierade just nu ✓" |
| Erbjudandesynk | Med favoritsynken, om grossisten exponerar dem | Det som grossisten visar | Veckans erbjudanden |

Resultatet visas som: "53 priser oförändrade · 5 prisändringar · 2 ej tillgängliga · 4 nya erbjudanden". Aldrig en blockerande dialog. Synk är aldrig en grind: appen fungerar på senast kända priser.

### 7.4 Pilotgrossisten: vad vi vet och inte vet

Allt nedan kommer från sökträffar och är **ej verifierat mot sidorna**.

| Vet (ur sökträffar) | Vet inte |
|---------------------|----------|
| Egen webbutik på `shop.blomstergrossisten.net` (Sortiment, Bli kund, Om oss), äldre inloggningsadress på `blomstergrossisten.e-line.nu` (plattformen kan vara e-line) | Om det finns API, prisfil eller integration |
| Bara registrerade återförsäljare, kundnummer och inloggning till webbutiken | Om inloggningen kräver kod eller BankID och hur länge den håller |
| Minsta årsförbrukning 50 000 kr | Om hela sortimentet går att lista |
| Snittblommor kan beställas till kl. 19 dagen före leverans, tillbehör till kl. 06 på avresedagen | Om erbjudanden syns med slutdatum |
| Möjlighet att förbeställa från odlare | Om odlingsland, odlare eller certifiering uppges |
| Kontakt: order@blomstergrossisten.net, 018-65 65 00 | Om automatiserad åtkomst eller varukorgsförberedelse är tillåten enligt villkor |

**Grind A (före varje annan teknik):** (1) floristens svar på `CHECKLISTA-PILOTGROSSIST.md` och 2–3 skärmdumpar, (2) ett mejl till grossisten om prisfil, API och tillstånd (bilaga A i den tidigare planen), (3) beslut om vilken strategi som är rätt. Webbläsarteknik byggs först om (1)–(3) visar att enklare vägar saknas.

Beställningstiderna är användbara direkt: de ger en **beställ-senast-tid** per leveransdag och grunden för påminnelsen "Dags att beställa Emma & Johans blommor".

### 7.5 Självläkande connectorer, säkert

Princip: *upptäck och nedtrappa automatiskt, föreslå reparationer med AI, godkänn med människa, och låt aldrig en reparation få röra ekonomiska handlingar.*

```
Övervakning ─► Upptäcka ─► Begränsa ─► Diagnostisera ─► Föreslå ─► Verifiera ─► Riskklassa ─► Släppa ─► Följa upp
```

1. **Upptäcka.** Varje synk kontrolleras mot invarianter (avsnitt 7.6). Dagliga kanariekörningar läser några kända artiklar. Fel klassas: inloggning, session, sida ändrad, prisformat, valuta, moms, saknat SKU, tom katalog, dubbla id.
2. **Begränsa (sker direkt, utan AI).** Anslutningen blir `degraded`. Varukorgsförmågan stängs av. Appen visar "Kan inte verifiera priset just nu" och använder snapshot med sin ålder. Inga skrivande handlingar kan startas.
3. **Diagnostisera.** AI läser en *sanerad* ögonblicksbild (utan cookies, personuppgifter eller lösenord) och jämför med senast kända bra fixturer. Resultat: en strukturerad beskrivning av vad som ändrats.
4. **Föreslå.** AI föreslår en ändring av connectorns *deklarativa beskrivning* (selektorer, adresser, fältkarta). Ändringen är data, inte fri kod. API- och feedadaptrar är vanlig kod och patchas av en människa.
5. **Verifiera i en sandlåda.** Kör kontraktssviten, regressionstesterna och fixturerna, samt en läsande kontroll mot grossisten. Jämför gammal och ny utdata på överlappande artiklar och mot invarianter.
6. **Riskklassa.**

| Klass | Exempel | Åtgärd |
|-------|---------|--------|
| A | Rent kosmetisk ändring (selektor bytt namn), samma fältbetydelse, utdata identisk på ≥ 99,5 % av överlappet | Får släppas automatiskt **för läsfunktioner**, stegvis (kanariebutiker först, 24 h) |
| B | Prisformat, valuta, moms, nytt SKU-schema | Kräver mänsklig granskning |
| C | Allt som rör inloggning, varukorg eller kassa | **Aldrig automatiskt.** Manuell granskning och manuellt test |

7. **Släppa med versioner.** Varje connectorversion är numrerad, den förra sparas, och återgång är ett tryck. **Varukorgsförmågan aktiveras per version av en människa**, aldrig av en reparation.
8. **Skyddsräcken.** AI har aldrig tillgång till en butiks session och saknar verktyg som köper. Ingen reparation kan utlösa en ekonomisk handling. Alla förslag, tester och godkännanden loggas.

**Byggordning:** (1) upptäckt och säker nedtrappning ingår redan i pilotadaptern (MVP 2). (2) AI-diagnos och föreslagna reparationer *efter* att den första adaptern fungerat ett tag. (3) automatisk släppning av klass A först när vi har flera adaptrar och ett bra facit. **Regeln om tre:** vi bygger inte en deklarativ connectorbeskrivning och en generell exekutor förrän den tredje DOM-baserade grossisten visar mönstret. Första adaptern är vanlig kod med fixturer.

### 7.6 Observability: vad vi övervakar

| Händelse | Upptäcks av | Åtgärd |
|----------|-------------|--------|
| Inloggningsfel / session utgången | HTTP-status, inloggningsmarkör | `needsReauth`, be floristen logga in |
| Sida/API ändrad | Formkontroll, `SITE_CHANGED` | Anslutningen `degraded`, larm |
| Oväntat prisformat | Normalisering | Karantän av raden |
| Valutan ändrad | `currency` ≠ förra | Rad avvisas, larm |
| Momsstatus oklar | `priceIncludesVat` saknas eller ändrad | Priset används inte |
| Saknat SKU / dubbla artikel-id | Invariant | Karantän |
| Ovanligt pris | Band mot historik (t.ex. ±50 %) | Karantän, visas i "Kontrollera prisändringar" |
| Tom eller starkt förändrad katalog | Katalogstorlek mot förra | Hela inläsningen avvisas |

Varje anslutning har ett `ConnectorHealth`-värde som en intern vy visar. Floristen ser aldrig tekniska termer, bara "Kan inte verifiera priset just nu" eller "Blomstergrossisten behöver din inloggning igen."

---

## 8. Ekonomiska handlingar: gränsen

| Agenten får | Agenten får inte utan uttryckligt godkännande |
|-------------|-----------------------------------------------|
| läsa, söka, analysera, synka | genomföra grossistköp |
| skapa kalkyl och inköpslista | godta en ersättare med ekonomisk följd |
| fylla grossistens varukorg | skicka faktura |
| skapa fakturautkast | ändra en bindande order |

**Så upprätthålls det (inte med en uppmaning till modellen):**

1. **Verktygsytan.** Agenten får verktygen `search_product`, `open_product`, `set_quantity`, `add_to_cart`, `read_cart`. Det finns **inget** verktyg för kassa, bekräfta, betala eller beställ.
2. **Policymotor utanför AI:n** som granskar varje webbläsarhandling: tillåtna adressmönster, tillåtna element och handlingar, och *förbjudna mönster* (kassa, "slutför", "bekräfta", "betala"). Allt annat nekas som standard. Ett försök loggas och avbryter körningen.
3. **Återläsning av varukorgen** efter varje körning och jämförelse mot planen. Avvikelse (extra rad, fel antal, ändrat pris) gör körningen misslyckad.
4. **Ingen tyst ersättning.** Saknas en artikel skapas ett `SubstitutionProposal` som kräver ett aktivt val. Om valet ändrar priset räknas kundpriset om och visas.
5. **Faktura:** tillståndsmaskinen tillåter inte `sent` utan `approved`. Godkännandet är knutet till en version. Ändring efter godkännande kräver ny granskning.
6. **Varukorgsförmågan är avstängd som standard** per anslutning och aktiveras per connectorversion av en människa (avsnitt 7.5).
7. **Revisionslogg** över varje godkännande och varje agentkörning.

**Tester (se avsnitt 14):** "AI kan inte checka ut" körs mot en simulerad sida med en kassaknapp. Policymotorn måste neka klicket och verktygsytan får inte kunna uttrycka det. Dessutom ett kontrakttest som kräver att ingen connector exponerar ett köpkommando.

---

## 9. Multi-tenant, säkerhet och integritet

**Isolering.**
- `shopId` på varje rad. All dataåtkomst går genom *ett* lager som kräver butikskontext och lägger till filtret. Rå SQL utanför lagret är förbjuden (kontrolleras i test).
- **Isoleringstester:** butik A kan inte läsa, ändra, lista eller gissa id:n till butik B:s kunder, jobb, priser, sessioner, ordrar, fakturor och anteckningar. Testas för varje entitet och varje väg (API, synk, agent, export).
- Valvet adresseras per anslutning och kontrollerar butik vid varje läsning.

**Sessioner (valvet).** Kryptering per anslutning med nyckel ur en hemlighet (inte i koden), nyckelrotation, kort livslängd, radering vid frånkoppling och efter inaktivitet, ingen loggning av cookies. Inga lösenord. Valvet byggs och granskas **innan** någon session sparas (redan beslutat).

**Roller.** `owner` och `staff`. Personal ska kunna dölja inköpspris och marginal (se luckor). Revisorsroll senare.

**Personuppgifter (GDPR) (ej juridiskt verifierat).**
- Kundregistret innehåller privatpersoners uppgifter. Floristen är personuppgiftsansvarig, Buketträknaren är biträde. Det kräver biträdesavtal, integritetstext, rutiner för export och radering, och lagring inom EU (D1 och Durable Objects har jurisdiktionsval).
- AI får inte se kunduppgifter om det inte behövs. Biträdesavtal med AI-leverantören.
- Kundnamn och e-post ska aldrig finnas i loggar eller felrapporter.

**Villkor mot grossister.** Automatiserad inloggad åtkomst och varukorgsförberedelse kan strida mot villkor. Skriftligt tillstånd eller tydligt tillåtande villkor krävs per grossist innan vi bygger `xhr`-, `browser`- eller `cart`-vägen för den.

---

## 10. Användningsmätning och kostnad

### 10.1 Mätning från dag ett

```
meter({ shopId, kind, quantity, unit, connectionId?, correlationId })   ← ett enda anrop kring varje dyr operation
kind: browser_seconds · ai_input_tokens · ai_output_tokens · ai_call · supplier_sync · catalog_refresh ·
      live_price_check · cart_preparation · invoice_draft · storage_bytes
```
- Vi sparar **enheter** (sekunder, tokens), inte kronor. Prislistan läggs på i rapporten.
- Dagliga summor per butik. **Mjuka och hårda tak per butik och månad** (en butik kan inte köra upp kostnaden). Brytare per butik och globalt.
- Mätningen är det som gör prissättningen i avsnitt 11 möjlig att kalibrera, och som skyddar piloten.

### 10.2 Kostnadsmodell

**Antaganden** (alla ska kalibreras mot mätning i piloten, se bilaga A). 1 USD ≈ 10 kr. Priser enligt sökträffar och Claude-prislistan i september 2026 **(ej verifierat mot aktuella prissidor)**.

*Användning per florist och månad:*

| | Lätt (MICRO) | Normal (STUDIO) | Tung (PRO) |
|---|---|---|---|
| Aktiva jobb | 8 | 20 | 60 |
| Favoritsynk | 4 | 22 | 44 |
| Priskontroller | 6 | 20 | 60 |
| Varukorgsförberedelser | 2 | 6 | 20 |
| Inloggningsöverlämningar | 1 | 2 | 4 |
| Webbläsartid, **HTTP-läge** (väg A) | 0,05 h | 0,1 h | 0,2 h |
| Webbläsartid, **DOM-läge** (väg B) | 0,9 h | 2,6 h | 6 h |

*Enhetspriser:* Cloudflare Browser Run 0,09 USD per extra timme efter 10 timmar per månad i betalplanen (gratis: 10 minuter per dag, 3 samtidiga), Workers betalplan 5 USD per månad (10 miljoner anrop ingår), gratisnivåer för D1 (5 GB) och SQLite-Durable Objects (5 GB), R2 0,015 USD per GB och månad. Claude Haiku 4.5: 1/5 USD per miljon tokens in/ut, Sonnet 5.5: 2/10, Opus 5.5: 4/20. (Prompt-cache och batch sänker mer.)

*AI-kostnad per florist och månad:*
- **AI-sparande design** (deterministisk väg, AI bara vid undantag, klassificering, ersättarförslag och fakturatext): ca **0,5–2 USD** (5–20 kr). Klassificering av en katalog (ca 700 namn efter regler) kostar en gång ca 0,1–0,5 USD.
- **AI-tung design** (agenten navigerar med AI vid varje körning, ca 150 000 tokens in och 8 000 ut per körning): ca 0,19 USD (Haiku), 0,38 USD (Sonnet) eller 0,76 USD (Opus) per körning. Vid 48 körningar per månad blir det ca **9–36 USD**. Det är lika mycket som hela intäkten för Micro.

### 10.3 Tabell: 1 / 10 / 100 / 1 000 florister (normal användning, per månad)

Kostnaderna är **tekniska** (infrastruktur och AI). De inkluderar inte betalavgifter (några procent av intäkt), support, utveckling eller juridik.

**Väg A (HTTP-läge: API, feed eller webbutikens JSON) och AI-sparande design:**

| | 1 | 10 | 100 | 1 000 |
|---|---|---|---|---|
| Fasta kostnader (plattform, domän) | 0–1 USD | ~1–6 USD | ~6 USD | ~6 USD |
| Webbläsare | 0 | 0 | ~0 (10 h ingår) | ~8 USD (100 h) |
| AI | ~1,2 USD | ~12 USD | ~120 USD | ~1 200 USD |
| Lagring och databas | 0 | 0 | 0 | 0–5 USD |
| Övrigt (e-post, övervakning) | 0 | 0 | 0–5 USD | 20–60 USD |
| **Totalt** | **~2 USD (20 kr)** | **~15 USD (150 kr)** | **~135 USD (1 350 kr)** | **~1 260 USD (12 600 kr)** |

**Väg B (DOM-läge i webbläsare) och AI-sparande design:**

| | 1 | 10 | 100 | 1 000 |
|---|---|---|---|---|
| Fasta kostnader | 0–1 USD | ~6 USD | ~6 USD | ~6 USD |
| Webbläsare | 0 (ryms i gratisnivån) | ~1,4 USD | ~23 USD | ~233 USD |
| AI | ~1,2 USD | ~12 USD | ~120 USD | ~1 200 USD |
| Lagring och databas | 0 | 0 | 0 | 0–5 USD |
| Övrigt | 0 | 0 | 0–5 USD | 20–60 USD |
| **Totalt** | **~2 USD (20 kr)** | **~20 USD (200 kr)** | **~158 USD (1 580 kr)** | **~1 490 USD (14 900 kr)** |

**Väg B med AI-tung design (varning):**

| | 1 | 10 | 100 | 1 000 |
|---|---|---|---|---|
| **Totalt** | ~19 USD | ~190 USD | ~1 830 USD | ~18 300 USD (183 000 kr/mån) |

Intäktsjämförelse vid 1 000 florister på STUDIO (ca 370 kr/mån): intäkt ≈ 370 000 kr. Teknisk kostnad ≈ 4 % (AI-sparande) mot ≈ 50 % (AI-tung).

### 10.4 Slutsatser av beräkningen

1. **Webbläsartid är billig** (ca 0,09 USD per timme). Det som begränsar är samtidighet och köhantering vid morgonsynk, inte priset.
2. **AI på den heta vägen är det som kostar.** Därför: deterministisk väg först, AI bara vid undantag, billig modellnivå som standard, cache, batch, och månadstak per butik.
3. **Lagring är litet så länge kataloger delas.** En katalog på 3 000 artiklar är ca 5 MB. Per butik blir det 6 GB vid 1 000 butiker, vilket går över gratisnivån. Dela därför de offentliga artikelattributen per grossist (om villkoren tillåter) och spara per butik bara priser för det som används.
4. **Pilotkostnaden är nära noll** (avsnitt 10.5).

### 10.5 Så hålls pilotkostnaden nära noll

- Cloudflare **gratisnivåer** (Workers 100 000 anrop per dag, D1 5 GB, SQLite-Durable Objects 5 GB, Browser Run 10 minuter per dag och 3 samtidiga) räcker för 1–3 florister.
- **Betala efter användning** hos AI-leverantören (ett konto med litet tillgodo). Pilot ca 1–5 USD per månad.
- **Inget fast** tills det behövs: ingen reserverad webbläsarkapacitet, ingen betald övervakning, ingen betaltjänst.
- **Hårda månadstak per butik** i mätningen (till exempel 3 USD i piloten).
- **AI av som standard på den heta vägen.** Webbläsare bara om research visar att det behövs.
- Betalplan på Workers (5 USD per månad) tas först när gratisnivån inte räcker, till exempel för webbläsartid över 5 timmar per månad eller över 100 000 anrop per dag.

---

## 11. Prissättning av vår tjänst (analys, inget byggs)

**Princip:** floristen ska aldrig vara rädd för att skapa en extra bukett. Därför är **kalkylering obegränsad** (den är deterministisk och gratis för oss). Det som kostar är grossistsynk, priskontroller, varukorgsförberedelser och AI, och det är där gränserna ska ligga.

**Naturliga gränser:** antal grossistanslutningar, antal aktiva jobb per månad (jobb som är mer än "planering"), frekvens på synk, antal automatiska varukorgsförberedelser, antal användare.

| Nivå (arbetshypotes) | Pris | Anslutningar | Aktiva jobb/mån | Synk | Varukorgar/mån | Användare | Teknisk kostnad (uppskattning) |
|----------------------|------|--------------|-----------------|------|----------------|-----------|--------------------------------|
| MICRO | 99–199 kr | 1 | ~10 | dagligen för favoriter | ~3 | 1 | ~0,6 USD (6 kr) |
| STUDIO | 299–449 kr | 2 | ~40 | flera per dag | ~25 | 3 | ~1,5 USD (15 kr) |
| PRO | 699–899+ kr | 5 | rimlig användning | tätare, per jobb | ~100 | 10 | ~3,7 USD (37 kr) |

- Marginalen på infrastruktur är hög om AI hålls sparande, men **support, betalavgifter, utveckling och juridik ingår inte**.
- Gränserna ska vara *mjuka* (en vänlig uppmaning, inte en spärr mitt i ett kundsamtal) och mätas först i piloten innan de sätts.
- **Betalsystem byggs inte nu.** När det blir aktuellt väljs en betaltjänst med stöd för svenska kunder och månadsabonnemang. Tjänsten ska inte säljas som "AI-tokens".
- **Prova med verkliga florister** vilka dimensioner de förstår. "Antal jobb per månad" är troligen begripligast.

---

## 12. Vad av det befintliga som kan återanvändas, och vad som ska ändras

### 12.1 Återanvänds utan förändring (flyttas eller importeras bara)

| Del | Plats i dag | Not |
|-----|-------------|-----|
| **Kalkylmotorn** `calc()` och `indexList()` | `public/index.html` ~rad 452–540 | Flyttas **ordagrant** till en delad modul. Skyddas av 22 + 4 tester och differenstestet |
| Tolkning av tabeller (`readTable`, `normalizeRows`, `parseNum`, `detectPack`, `classifyHeader`, `diffLists`) | `index.html` | Importväg och reservväg |
| Normalisering och regler (`normalizeSupplierProduct`, `normalizeQuote`, `unusableReason`, `ModelValidationError`) | `public/js/core/model.js` | Utökas additivt med fält |
| Prishistorik (`appendQuote`: ersätt samma dag, kapa) | `model.js` | Kapningen kompletteras med veckosammanfattning (rollup) innan rader tas bort |
| `ingestSupplierData` | `model.js` | Behålls. Lägger till karantänläge för stora kataloger |
| Matchningsfunktioner (`confirmMatch`, `rejectMatch`, `needsMatching`) | `model.js` | Behålls för ersättare och migrering |
| Migrering v1 → v2, rollback, `loadV2` | `model.js` | Behålls för befintliga användare |
| **Grossistkontrakt**: `ConnectorError`, felkoder, `assertConnector`, `createReadOnlyHttp`, `requireShape`, registret | `src/suppliers/` | Behålls. Läsvägen förblir skrivskyddad |
| **Kontraktssviten** och de falska grossisterna | `test/support/` | Behålls och utökas |
| Testverktyg: jsdom-hjälpare, fixturer, facit, differenstest, mutationsmetod | `test/` | Behålls |
| Serverns skyddsmönster (`Limiter`, `sameSecret`, säkerhetshuvuden, CSP, validering före kostnad) | `src/worker.js` | Mönstren återanvänds i det nya API:t |
| Designgrund (färger, typsnitt, mörkt läge, 44 px-ytor) | `index.html` | Behålls |
| Reservvägarna (skärmdump, ChatGPT Work, brevlåda, AI-chatt) och deras tester | `index.html`, `worker.js` | Behålls synliga tills en riktig koppling fungerar |

### 12.2 Behöver refaktoreras

| Del | Vad | Varför |
|-----|-----|--------|
| `index.html` (1 509 rader) | Delas i moduler: lager för tillstånd, skärmar (Hem, Kunder, Jobb, Arrangemang, Inköp, Faktura, Grossist, Inställningar). Klassiska skript så att filläge fungerar | Går inte att bygga fem MVP i en fil |
| `viewOf` och tillståndet | Byggs på `ArticleRef` i stället för arbetsartiklar. Lagring via ett gränssnitt (lokalt i MVP 1, server från MVP 2) | Arrangemang pekar direkt på artiklar |
| `order` och `recipes` | Blir `Event` och `Arrangement` (befintlig order migreras till ett jobb "Min order" utan kund). Recept blir mallar | Nya domänobjekt |
| `settings` | Delas i butikens `PricingSettings` + överstyrningar per arrangemang + frakt per grossist | Briefens punkt 24, och frakt gäller per grossist |
| `products` + `matches` | Utfasas efter migrering. Nya rader använder `ArticleRef` | Sanningen är grossistens artikel |
| `ingestSupplierData` | Karantänläge per rad | Katalog på tusentals artiklar |
| `quotes`-kapning | Rollup till veckosammanfattning | Framtida kalkylpris |
| `verification: 'live'` | Döps om till `'supplier'` | Ordet vilseleder om färskhet |
| `worker.js` (en fil) | Modulär router, autentisering, butikskontext, mätningslager, AI-gateway | Multi-tenant och mätning |
| `/api/read` (direkt Anthropic-anrop) | Flyttas bakom `AIProvider` med mätning och tak | Byta leverantör |
| Katalog i samma lagring som arbetstillstånd | Eget lager | Mätt: ~2 MB och 29 ms per sparning vid 3 000 artiklar (se konsekvensanalysen) |

### 12.3 Nytt

Konton och butikskontext · dataåtkomstlager med butiksfilter · `Customer`, `Event`, `Arrangement`, `ArrangementLine`, `EventFee`, `QuoteSnapshot` · `PurchasePlan`, `PurchaseRequirement`, `CartPreparation`, `SubstitutionProposal` · `InvoiceDraft` och `InvoiceProvider`-gränssnitt · policymotor · valv · webbläsarorkestrering · AI-gateway · mätning · observability och hälsa · schemaläggare och påminnelser · `userArticles`/favoriter · `offers` · `facts`/`derived` · klassificering och sökning.

---

## 13. MVP 1–5

Storlek: **S** (dagar), **M** (en till två veckor), **L** (flera veckor) för en utvecklare, grovt. Jag lovar inga datum.

### MVP 1: Floristens kärna (lokalt först, ingen server)

**Mål:** en florist kan ta emot ett samtal, skapa kund och jobb, bygga arrangemang, få kundpriset direkt och spara och öppna jobbet.
**Ingår:** `Shop` (en, lokal), `Customer`, `Event`, `Arrangement`, `ArrangementLine`, `EventFee`, favoriter, prisinställningar (påslag, arbetsavgift, moms, avrundning), packlogik, tillbehör som artiklar och fria rader, spara/öppna jobb, export/säkerhetskopia, hem-, kund-, jobb- och arrangemangsskärmar. **Artiklarna kommer från den egna prislistan (`conn_manual`) och import**, eftersom ingen grossist är kopplad än.
**Förutsättning (refaktor):** kalkylmotorn flyttas till delad modul, tillstånd får ett lagringsgränssnitt, befintlig order migreras till ett jobb.
**Ingår inte:** konton, server, grossistkoppling, inköp, faktura, erbjudanden, hållbarhet.
**Tester:** befintliga 191 oförändrade, plus kund→jobb→arrangemang, flera arrangemang, spara/öppna ger samma kalkyl, tillbehör, arbetsavgift, påslag, packlogik, override på arrangemang.
**Klart när:** en florist kan göra briefens "Emma & Johan"-flöde med påhittade artiklar, och räkningen är identisk med den gamla motorn för de gamla fallen.
**Storlek:** L.

### MVP 2: Grossistpilot (Blomstergrossisten i Uppsala)

**Grind A först:** floristens svar på checklistan, mejl till grossisten, beslut om metod.
**Ingår:** konton och butiksisolering (minsta möjliga), servern (D1, valv), den första adaptern (vanlig kod med fixturer, **billigaste metod som fungerar**), inloggningsöverlämning (webbläsare bara om enklare väg saknas), katalogläsning, favoriter, prisuppdatering och snapshot med färskhetstext, erbjudanden och tillgänglighet *där datan finns*, mätning, upptäckt och säker nedtrappning, AI-gateway med klassificering (regler först).
**Ingår inte:** varukorg, faktura, självläkning, hållbarhetsfilter.
**Tester:** leverantörsidentitet (Avalanche 50 ≠ 60), favoriter, gammalt kontra verifierat pris, erbjudandets giltighet, framtida event ignorerar kortvarigt erbjudande, manuell override, saknad leverantörsprodukt, **isolering mellan butiker**, connectorfel fallerar säkert, kontraktssvit för pilotadaptern.
**Klart när:** en riktig florist ansluter, ser sitt sortiment och sina favoriter med färska priser, och räknar en bukett på dem.
**Storlek:** L.

### MVP 3: Inköp

**3a (deterministiskt, lågrisk):** summering över jobb, packoptimering, inköpslista, livepriskontroll av de använda artiklarna, påminnelse om beställ-senast-tid. *Ingen agent.*
**3b (agent, högrisk):** förbered grossistvarukorg, ersättarförslag som florist väljer, återläsning, "Granska hos grossisten". Kräver **tillstånd från grossisten**, policymotor, att `cart` är aktiverat per connectorversion, och revisionslogg.
**Ingår inte:** automatiskt köp (finns inte), lager (utom enkel "har hemma"), optimering mellan grossister.
**Tester:** aggregerat inköp, `cart`-kvantitet, **AI kan inte checka ut**, ersättning kräver godkännande, fail-safe vid connectorfel.
**Storlek:** 3a M, 3b L.

### MVP 4: Administration (faktura)

**Ingår:** `InvoiceDraft` ur ett godkänt jobb, kundens e-post ur `Customer`, granskning, godkännande, skicka via vald integration (första varianten: PDF och e-postutkast utan extern tjänst). `InvoiceProvider`-gränssnitt så att vi inte låser oss.
**Ingår inte:** egen bokföring, betalning, påminnelser, kreditfakturor.
**Tester:** fakturatotal, faktura kräver godkännande, ändring efter godkännande kräver ny version.
**Öppet:** juridiska krav på fakturan (säljare, moms, löpnummer). Planen är att fakturatjänsten äger numrering och formella krav, och vi skapar bara utkastet **(ej juridiskt verifierat)**.
**Storlek:** M. **Kan byggas parallellt med eller före MVP 3b**, eftersom den inte beror på grossisten.

### MVP 5: Intelligens

Säsong, svenskodlat, närodlat, ekologiskt och certifieringar (bara där datan finns), smarta ersättare, historiska prisintervall, AI-bukettförslag, optimering över jobb, lager och överskott. **Vart och ett byggs först när dess data finns och dess gräns är bestämd.** Ingen byggs på förhand.

### Rekommenderad ordning

```
MVP 1  ──────────────►  MVP 2 (efter Grind A)  ──►  MVP 3a  ──►  MVP 4  ──►  MVP 3b  ──►  MVP 5 (delar)
   └── Grind A (research och tillstånd) pågår parallellt med MVP 1
```
Skäl: Grind A har lång ledtid och kan vara det som avgör allt, så den startar direkt. MVP 4 före 3b ger floristen värde utan att vi tar den största risken.

---

## 14. Tester

Alla befintliga regressionstester behålls och körs i varje MVP. Differenstestet mot den gamla appen gäller så länge den gamla räkningen finns kvar.

| Test | MVP | Nivå |
|------|-----|------|
| Avalanche 50 och 60 hålls åtskilda | 2 | enhet, kontrakt |
| Favoriter (lägg till, ta bort, sök hela, tillfällig artikel) | 2 | enhet, UI |
| Leverantörsidentitet (SKU bevaras genom hela kedjan) | 2 | enhet |
| Gammalt kontra verifierat pris, aldrig "live" för gammalt | 2 | enhet, UI |
| Erbjudandets giltighet (start, slut, okänt slut = samma dag) | 2 | enhet |
| Framtida event ignorerar kortvarigt erbjudande | 2 | enhet |
| Manuell override vinner | 2 | enhet |
| Påslag, arbetsavgift, tillbehör | 1 | enhet |
| Packkvantitet (83 behövs, 20-pack → 5 × 20 = 100, 17 över) | 1 | enhet |
| Kundpris (briefens 186 → 534 kr) | 1 | enhet |
| Kund → jobb, flera arrangemang | 1 | enhet, integration |
| Sparat och öppnat jobb ger samma kalkyl | 1 | integration |
| Aggregerat inköp över jobb | 3a | enhet |
| Saknad leverantörsprodukt | 2 | enhet |
| Ersättning kräver godkännande | 3b | enhet, integration |
| Varukorgens kvantiteter stämmer med planen | 3b | integration |
| **AI kan inte checka ut** (policymotor + verktygsyta + kontrakt) | 3b | enhet, kontrakt |
| Fakturatotal (rader, moms per sats) | 4 | enhet |
| Faktura kräver godkännande, ändring ger ny version | 4 | enhet |
| Svenskodlat ≠ ekologiskt | 5 | enhet |
| Närodlat ≠ ekologiskt | 5 | enhet |
| Okänd hållbarhet förblir okänd | 5 | enhet |
| **Isolering mellan butiker** (varje entitet, varje väg) | 2 | integration |
| Connectorfel fallerar säkert (ingen skrivande handling, snapshot med ålder) | 2 | integration |
| Kostnadstak per butik stoppar dyr operation | 2 | enhet |
| Mätning registrerar varje dyr operation | 2 | enhet |

---

## 15. Vad vi absolut inte bygger än

1. En generell molnwebbläsare, och automatisk inloggning, **innan Grind A**.
2. Varukorgsförberedelse **innan** grossistens tillstånd, policymotor och revisionslogg finns.
3. **Allt som slutför ett köp.** Det ska inte finnas.
4. Självläkande reparationer som släpps automatiskt (bara upptäckt och nedtrappning i början).
5. En deklarativ connectorbeskrivning och generell exekutor (regeln om tre).
6. AI-bukettförslag, hållbar optimering, cross-event-optimering och prognos.
7. Lager (utom "har hemma").
8. Betalsystem och abonnemangshantering.
9. Faktureringsintegrationer utöver gränssnittet och ett enkelt utkast.
10. Geokodning och avståndsberäkning.
11. Hållbarhetsprocent och sammanfattningar som kräver täckningsdata.
12. Kundportal, offert som kunden godkänner online, flera användare med avancerade roller.
13. Marknadsplats, flera länder, flera valutor och omräkning (beslut 5).
14. Egen app i app-butik.
15. Egna fakturanummer och bokföring.

---

## 16. Luckor i produktmodellen sett med en floristens ögon

| Lucka | Förslag | Prio |
|-------|---------|------|
| **Offert med giltighetstid, anbetalning och ändringshistorik** när kunden ändrar sig. "Kan vi lägga till fem rosor?" ska ge en ny version, och vi ska se skillnaden mot den förra | `QuoteSnapshot` med versioner, giltighet | MVP 1–4 |
| **Personal ska inte alltid se inköpspris och marginal** | Roll `staff` med dold kostnadsvy | MVP 2 |
| **Svinn och bearbetning** (putsa, skadade stjälkar, ofta 5–10 %) | Svinnpåslag på stjälkar, en inställning | MVP 1 |
| **Övriga kostnader** (vaser, skum, hyra av båge, resor, personal på plats) | Fria kostnadsrader och `EventFee`, moms per radtyp | MVP 1 |
| **Recept som mönster.** "2 vita rosor 50–60 cm" fungerar när en artikel är slut. Exakta artiklar gör det inte | Receptplatser (färg, släkte, längdspann) som löses mot en artikel vid räkning, med val av florist | MVP 5 |
| **Beställningstid och leveransdagar** per grossist | `SupplierConnection.orderCutoff` och leveransschema. Påminnelse "Dags att beställa" | MVP 3a |
| **Förbeställning av odlare för stora event** och toppdagar (Alla hjärtans dag, Mors dag) | Flagga för toppdagar, prisvarning. Förbeställning är en separat grossistväg | senare |
| **`orderMultiple` och frakt per grossist** | Motorn läser dem. Frakt flyttas till anslutningen | MVP 3a |
| **Faktiskt inköp mot plan** (grossistens bekräftelse, kreditnotor, skadad vara) | Läs orderhistorik (läsande) och spara faktisk kostnad, visa faktisk marginal | senare |
| **Pooling ändrar marginal, inte offert** | Visa som "faktisk marginal" när faktiskt inköp finns | senare |
| **Arbetstid på plats** (montering, resa) | `EventFee` och arbetsrader. Tidsregistrering senare | MVP 1/senare |
| **Andra inköpskällor** (lokal odlare, egen odling, torg) | `conn_manual` med egna fakta märkta "enligt dig" | MVP 1 |
| **Foton och inspiration** | `imageRef` på arrangemang, miniatyrer på artiklar | MVP 2+ |
| **Offline i butik och på plats** | Lokal cache och köad synk. **Konflikter** när två enheter ändrar samma jobb: sista skrivning per fält med tydlig varning | MVP 2 |
| **Företag eller privatperson som kund** (moms, fakturavillkor) | Kundtyp | MVP 4 |
| **Flera jobb samma dag med olika leveransdag** | Ett `Event` = ett inköpstillfälle. Flera jobb samordnas i `PurchasePlan` | MVP 3a |
| **Påminnelser** ("Dags att beställa Emma & Johans blommor") | Schemaläggare och notis (webbpush eller e-post) | MVP 3a |

---

## 17. Tekniska risker

| Risk | Allvar | Åtgärd |
|------|--------|--------|
| **Grossistens tillstånd** till automatiserad åtkomst och varukorg saknas, eller villkoren förbjuder det | Mycket hög | Grind A. Bygg inte `xhr`/`browser`/`cart` utan skriftligt tillstånd. Faller tillbaka på prisfil och manuell import |
| **Sessioner är nycklar till grossistkonton** | Hög | Valv, kryptering, ingen köpförmåga i verktygen, policymotor |
| **Hela sortimentet går inte att lista** eller priser syns bara per produktsida | Hög (beror på grossist) | `catalogEnumeration` och `bulkPrices` som förmågor, sökbaserad onboarding, priser bara för använda artiklar |
| **Webbläsare i molnet: cookie-överlämning inte bevisad** | Hög | Teknisk förstudie innan arkitekturen låses |
| **AI på den heta vägen** | Hög (kostnad) | AI av som standard, tak per butik, mätning |
| **Personuppgifter** (kundregister) | Hög | GDPR-rutiner, biträdesavtal, EU-lagring, inga kunduppgifter till AI i onödan |
| **Isoleringsfel mellan butiker** | Mycket hög om det händer | Ett dataåtkomstlager, isoleringstester på varje entitet och väg |
| **Fel pris syns som rätt** | Hög | Invarianter, karantän, `priceBasis`, "kan inte verifiera" i stället för fel pris |
| **Adaptrar går sönder** | Medel | Upptäckt, nedtrappning, fixturer, kanariekörning |
| **Katalog i samma lagring som arbetstillstånd** | Medel | Eget lager (mätt problem) |
| **Synkkonflikter mellan enheter** | Medel | Sista skrivning per fält, versionsnummer, tydlig varning |
| **Morgonsynk för alla samtidigt** | Medel | Köer, utspridda starttider, samtidighetstak |
| **Komplexitet som bryter "extremt enkel"** | Hög för produkten | UX-test per skärm. Avancerat bakom tryck. Bara relevanta tips |
| **Greenwashing** | Hög vid fel | Bara `facts`, alltid "enligt grossisten", inga poäng, juridisk granskning före lansering |
| **Räkna fel på grossistens regler** (multiplar, frakt) | Medel | Motorn läser reglerna när en verklig grossist har dem |
| **Beroende av en molnleverantör** | Låg–medel | Gränssnitt för webbläsare, AI och faktura |
| **Priser och gratisnivåer ändras** | Medel | Mätning i enheter, omräkning i rapport, tak per butik |

---

## 18. Öppna beslut och vad jag behöver från dig

### 18.1 Beslut (med min rekommendation)

1. **Godkänn riktningen** i den här planen, särskilt: arrangemang pekar direkt på artiklar, ordning MVP 1 → 2 → 3a → 4 → 3b → 5, och att varukorgsförmågan är en egen grind.
2. **Namn:** `Shop`, `Event` (UI "Jobb"), `Arrangement`. Rekommenderas.
3. **MVP 1 lokalt först** (ingen server och inga konton förrän MVP 2). Rekommenderas.
4. **Databas:** D1 med dataåtkomstlager och isoleringstester. Rekommenderas framför en Durable Object per butik.
5. **Webbläsare:** bara efter Grind A, och då Cloudflare Browser Run om förstudien visar att inloggningsöverlämning och cookieåteranvändning fungerar.
6. **AI-leverantör:** Claude som första adapter bakom `AIProvider`, billig modellnivå som standard.
7. **Första fakturavägen:** PDF och e-postutkast utan extern tjänst, tills du valt integration.
8. **Förbeställning av odlare** (grossisten erbjuder det) är en separat väg och byggs inte nu.

### 18.2 Det jag behöver från dig innan jag börjar implementera

1. **Ditt godkännande** av planen och MVP-ordningen (eller ändringar).
2. **Grossistkontakt:** vem hos Blomstergrossisten vi frågar, och att jag får skicka (eller du skickar) mejlet om prisfil, API och tillstånd. Utan svar bygger vi inget som loggar in åt floristen.
3. **Floristens svar på checklistan** och 2–3 skärmdumpar från webbutiken när hon är inloggad. Inga lösenord eller tekniska filer.
4. **Pilotflorist(er):** vem, hur många, och att de samtycker till att prova en tidig version.
5. **Byggloggen** för Cloudflare-felet (avsnitt I i `CLOUDFLARE-DEPLOYMENT.md`). Behövs för att kunna driftsätta något alls.
6. **Konton och budget:** ett Anthropic-konto med litet tillgodo (pilot 1–5 USD per månad), åtkomst till Cloudflare-kontot, och ett tak du är trygg med.
7. **Juridik och redovisning:** en person som kan bedöma biträdesavtal för kundregister, villkor för vår tjänst och kraven på en faktura (och momssatser per radtyp). Jag är ingen jurist.
8. **Beslut om hur mycket av MVP 1 du vill se före Grind A:s svar**, så att vi inte väntar på grossisten i onödan.

---

## Bilaga A: antaganden och källor för kostnadsberäkningen

**Antaganden:** användning per florist enligt tabellen i avsnitt 10.2. Webbläsartid väg B: favoritsynk 2 min, priskontroll 1 min, varukorg 4 min, inloggningsöverlämning 3 min, katalogkörning 60 min per månad (normal), 30 min per annan månad (lätt), 120 min (tung). AI per körning vid tung design: 150 000 tokens in och 8 000 ut. AI-sparande: 5 undantagsfall per månad à ca 0,2 USD, ca 20 småuppgifter à 4 000 tokens in och 500 ut. Klassificering: 700 namn efter regler i omgångar om 100, ca 21 000 tokens in och 21 000 ut. Lagring: katalog ca 1,5–3 KB per artikel, 3 000 artiklar ≈ 5 MB. 1 USD ≈ 10 kr.

**Källor (sökträffar och Claude-prislistan, alla ej verifierade mot aktuella prissidor):**
- Cloudflare Browser Run (tidigare Browser Rendering): gratisnivå 10 minuter per dag och 3 samtidiga, betalplan 10 timmar per månad och 10 samtidiga, 0,09 USD per extra timme (REST) och 2 USD per extra samtidig webbläsare (bindningar). Live View, Human in the Loop och strukturerad överlämning enligt Cloudflares changelog (april och juli 2026). Prissättningen kan ha ändrats vid namnbytet.
- Cloudflare Workers gratis 100 000 anrop per dag, betalplan 5 USD per månad med 10 miljoner anrop. D1 gratis 5 GB. SQLite-Durable Objects gratis med 5 GB. R2 0,015 USD per GB och månad och 10 GB gratis. Queues 0,40 USD per miljon operationer efter 1 miljon.
- Browserbase (tredjepartskälla, juni 2026): Free 1 timme, Developer 20 USD per månad med 100 timmar och 0,12 USD per timme därefter, Startup 99 USD med 500 timmar och 0,10 USD därefter.
- Claude-priser per miljon tokens (in/ut): Haiku 4.5 1/5 USD, Sonnet 5.5 2/10 USD, Opus 5.5 4/20 USD, cache-läsning ca en tiondel, batch hälften.

## Bilaga B: det som är ej verifierat och måste kontrolleras

1. Allt om Blomstergrossistens webbplats, villkor och kapacitet (avsnitt 7.4).
2. Om Browser Runs inloggningsöverlämning gör att cookies går att exportera och återinjicera, hur länge en grossists session håller, och aktuella priser efter namnbytet.
3. Juridiska krav på faktura, moms per radtyp, GDPR-roller och villkor för automatiserad åtkomst.
4. Att D1:s gratisnivå och betalda gränser stämmer med aktuell prissida.
5. Användningsantagandena i avsnitt 10.2, som ska ersättas av uppmätta värden i piloten.
