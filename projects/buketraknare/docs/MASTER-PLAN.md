# MASTER-PLAN: Buketträknaren

**Status:** plan, **version 2.3** (justerad efter Annas preciseringar 2026-10-07: uttryckligt "ingår / 0 kr", tre prisnivåer, prisgrund inkl./exkl. moms, bryggan till den nuvarande appen och den minimala jobbskärmen). Ekonomikoden, bryggan, offert/kundorder och en minimal Jobb-flik är byggda och testade (se avsnitt 13). Den gamla räknemotorn `calc()` är orörd. PR #9 är orörd. PR #10 mergas inte utan godkännande.
**Ersätter delvis:** `PLAN-grossistanslutning.md` (se avsnitt 2). `KONSEKVENSANALYS-FLORISTVISION.md`, `BESLUT.md`, `CHECKLISTA-PILOTGROSSIST.md` och `CLOUDFLARE-DEPLOYMENT.md` gäller fortfarande där de inte säger emot den här planen. Där de säger emot (moms, webbläsaragentens plats) gäller den här planen, och de två berörda raderna är rättade.

Markeringen **(ej verifierat)** betyder att jag inte har kunnat kontrollera uppgiften mot själva källan. Det gäller särskilt allt om Blomstergrossistens webbplats (nätverket i min miljö blockerar den), aktuella molnpriser (hämtade ur sökträffar, kan ha ändrats) och juridik, moms och fakturakrav (Skatteverkets sidor är också blockerade härifrån, så jag har bara sökträffar, och jag är ingen jurist).

### Ändringar i version 2 till 2.2 (kort)

| # | Ändring | Var |
|---|---------|-----|
| 1 | **Grossistagenten är en kärnfunktion.** En liten teknisk proof-of-concept (**MVP 1B**) körs parallellt med floristens kärna (**MVP 1A**) så snart legitim pilotåtkomst finns | 0, 7.7, 13 |
| 2 | Grind A innehåller nu också en **teknisk undersökning** av hur webbutiken fungerar efter inloggning. Vi är inte beroende av att grossisten ger oss API | 7.4 |
| 3 | Skärmdumpar och CSV är **reservväg**, aldrig arkitekturens grund. Målet är ANSLUT → LOGGA IN → KLART | 7.4, 15 |
| 4 | **Moms in i modellen nu** (beslut 5 är ändrat för moms. Euro och omräkning väntar fortfarande) | 3.5, 4, 6 |
| 5 | **Pengar som exakta tal**, aldrig flyttal. AI räknar aldrig moms. Påslag och marginal är olika saker och testas | 6.1–6.3 |
| 6 | **Kundpriset** är det floristen arbetar med. Bakom det ligger en exakt uppdelning (ex moms, moms per sats, inkl. moms) | 6.4 |
| 7 | **Moms per rad**, ingen enda global sats i arkitekturen. **Versionerat regellager** (`TaxRuleSet`) | 3.5, 4.2, 8.4 |
| 8 | **Planerat är inte faktiskt.** Nio separata affärssteg, bara faktiska händelser blir bokföringsunderlag | 4.2, 8.2 |
| 9 | `InvoiceDraft` utökad, **`AccountingConnector`** planerad, **revisionsspår** och oföränderliga ekonomiska värden | 4.2, 8.3, 8.5 |
| 10 | Kostnadstak och larm så att en trasig connector inte kan skapa en stor räkning. Prisanalysen visar rättvisaste skalningsdimension | 10, 11 |
| 11 | **Ny MVP-ordning:** 1A, 1B, 2, 3 (inköp), 4 (faktura), 5 (varukorg), 6 (intelligens) | 13 |
| 12 | Ekonomitester inlagda | 14 |
| 13 | **Exemplet 534 kr är rättat.** Det var ett pedagogiskt exempel och ingen regel. Motorn anpassas inte efter det. Rätt räkning: 534,20 kr *före* moms, 670 kr kundpris med en testsats på 25 % | 6, 14.2 |
| 14 | **Annas förtydliganden (version 2.1):** kundpriset inkl. moms som huvudtal, påslag på relevant inköpskostnad, arbete som egen komponent, **baklänges räkning** (målpris → råvarubudget), kundtyp, prisstatus ≈/✓ och prisbasens art, första kodsteget byggt | 6.4–6.9, 13 |
| 15 | **Egna tillägg och material (version 2.2):** en rad i ett arrangemang (`ArrangementItem`) är `SUPPLIER`, `OWN_STOCK`, `HOME_GROWN` eller `MANUAL`, avgör själv om den ska beställas (`requiresPurchase`), prissätts med `STANDARD_MARKUP` eller `FIXED_SALE_PRICE`, och **noll inköpskostnad betyder aldrig noll värde** | 4.5, 6.11 |
| 16 | **Beräknat, presenterat och överenskommet pris hålls isär.** Motorn behåller det exakta beräknade priset (667,75 kr) och det avrundade presenterade kundpriset (670 kr). Vilket belopp som blir den överenskomna försäljningen avgörs av kundordern | 6.12, 8.6 |
| 17 | **Uttryckligt "ingår / 0 kr" (version 2.3).** Ett pris som saknas (`PRICE_MISSING`) ger en ofullständig kalkyl. Ett eget tillägg kan väljas som `INCLUDED` ("ingår utan extra kostnad"), ett giltigt kundpris på 0 kr (`EXPLICITLY_INCLUDED`). Kalkylkostnaden finns kvar även när inköpskostnaden idag är 0 (egen trädgård) | 4.5, 6.11 |
| 18 | **Prisgrund för fasta priser:** `inc` eller `ex`, uttryckligt på varje rad. Förval inkl. moms för privatkund, exkl. moms för företag. Modellen är inte låst till inkl. moms | 6.11 |
| 19 | **Offert (`QuoteSnapshot`) och kundorder (`CustomerOrder`) byggda.** Tre prisnivåer sparas exakt (667,75 / 670 / sålt för 650 kr), båda är oföränderliga, och lagringen avvisar ändringar. Underlag för lönsamhet förbereds som data, utan att vinst definieras | 6.12, 8.6 |
| 20 | **Bryggan till den nuvarande appen och en minimal Jobb-flik.** Prislistan blir katalog, den gamla ordern flyttas en gång till jobbet "Min order", vägen tillbaka finns, och fliken Jobb låter floristen göra hela flödet (kund → jobb → arrangemang → blommor och eget material → arbete → kundpris → öppna igen) | 13 |

---

## 0. Kort version

1. **Det som är byggt håller.** Räknemotor, packlogik, stabila id:n, migrering, grossistkontrakt, tester och differenstest bevaras. Det som ändras är *ovanpå* dem: kunder, jobb, arrangemang, inköp och faktura, samt konton och flera butiker (multi-tenant).
2. **Grossistens exakta artikel är sanningen.** Floristens "arbetsartikel" (`products`) och matchningslagret (`matches`) är i målet bara en övergångslösning. Nya arrangemang pekar direkt på en artikel (`ArticleRef = connectionId + supplierProductId`). Den egna prislistan är en vanlig anslutning, så den fungerar likadant.
3. **Allt som är pengar räknas av vanlig kod.** AI organiserar, förklarar och föreslår. AI räknar aldrig, väljer aldrig tyst en ersättare och beställer eller fakturerar aldrig.
4. **Agenten får läsa, söka, synka, räkna, skapa listor, fylla varukorgen och skapa fakturautkast. Den får aldrig slutföra köp, godta en ersättare med ekonomisk följd, skicka faktura eller ändra en bindande order.** Det upprätthålls i kod (en policymotor utanför AI:n) och i tester, inte med en uppmaning till modellen.
5. **Grossistagenten är en kärnfunktion, och dess viktigaste hypotes provas tidigt.** Floristen loggar in hos sin grossist, agenten arbetar i den inloggade sessionen, läser verkliga artiklar och priser och kan senare förbereda varukorgen. Det måste bevisas för att veta om produkten är kommersiellt intressant. Därför körs en liten, avgränsad **proof-of-concept (MVP 1B)** parallellt med MVP 1A, så snart vi har legitim åtkomst och grossistens villkor är kontrollerade. Vi bygger *inte* en stor generell fjärrwebbläsarplattform före det beviset, och vi är *inte* beroende av att grossisten ger oss API (men vi frågar om det först och använder det om det är bra).
6. **Pilotkostnaden kan hållas nära noll** (gratisnivåer, betala efter användning). Det som kan bryta det är inte webbläsartid (ca 0,09 USD per timme) utan om AI körs vid varje synk. En AI-tung design kostar ca 18 USD per florist och månad, en AI-sparande ca 1–2 USD. Därför är "AI är aldrig på den heta vägen" ett arkitekturkrav.
7. **Sju steg i den ordning Anna bestämt:** MVP 1A (floristens kärna, lokalt, moms-redo pengamodell) och MVP 1B (grossistagent-PoC) parallellt → MVP 2 (riktig grossistkoppling) → MVP 3 (inköp) → MVP 4 (faktura) → MVP 5 (grossistvarukorg) → MVP 6 (intelligens). Faktura kommer före varukorg, vilket också är den lågriskordning jag förordade. Se avsnitt 13.
8. **Det riskablaste är inte tekniken utan grossistens tillåtelse** att automatisera inloggad åtkomst och varukorg, samt lagring av kunders personuppgifter (GDPR). Båda behöver en person, inte kod.
9. **Ekonomin följer affärshändelsen från inköp till kund.** Pengar är exakta tal (inga flyttal), moms räknas av testad kod med versionerade regler, per rad. Kalkyl, offert, plan och varukorg är *planering*. Bara faktiska händelser (verkligt inköp, kundfaktura, betalning) är bokföringsunderlag. Ett eget bokföringsprogram byggs inte. En `AccountingConnector` planeras (på samma sätt som `SupplierConnector`) så att vi kan koppla ett ekonomisystem utan att bygga om (avsnitt 3.5 och 8).
10. **Det som inte kan avgöras härifrån är markerat.** Aktuella svenska momssatser, fakturakrav och bokföringskrav ska kontrolleras mot Skatteverkets och lagens egna texter *när reglerna implementeras*, av en människa. Planen bygger så att reglerna är data som kan bytas, inte kod som måste skrivas om.

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
| 11 | **Pengar är exakta tal.** Aldrig flyttal. AI räknar aldrig moms eller summor | `Money`-modul med heltal och exakta bråk, avrundning på namngivna ställen, tester (avsnitt 6.1) |
| 12 | **Planerat är inte faktiskt.** Ett sett pris, en kalkyl eller en fylld varukorg är inte en kostnad | Nio separata affärssteg. Bara faktiska händelser matar bokföringsunderlag (avsnitt 8.2) |
| 13 | **Ekonomiska värden skrivs aldrig över.** Ändring ger en ny version, rättelse görs med ny händelse | Oföränderliga versioner, `supersedes`, revisionsspår med källa och regelversion (avsnitt 8.3) |
| 14 | **Skatte- och fakturaregler är data, inte spridd kod.** En gammal faktura ändras aldrig för att en regel ändras | `TaxRuleSet` med version och giltighetstid. Regelversionen frysas på varje godkänd rad (avsnitt 8.4) |
| 15 | **Kundpriset är det floristen arbetar med.** Ekonomimotorn är noggrann bakom ett enkelt gränssnitt | Ett tal inkl. moms överst, uppdelning bakom ett tryck (avsnitt 6.4) |

---

## 2. Masterbriefen jämförd med `PLAN-grossistanslutning.md`

| Område | Tidigare plan | Briefen | Dom |
|--------|---------------|---------|-----|
| Omfång | Kalkylator + grossistanslutning | Hela flödet kund → jobb → inköp → varukorg → faktura | **Utökas kraftigt.** Planen byggdes för ett steg, nu behövs en produktplan |
| Grossistens artikel | Floristens "Vit ros" matchas mot artikel | Grossistens artikel är sanningen | **Redan beslutat i konsekvensanalysen.** Gäller nu hela vägen, inklusive arrangemang |
| Matchning (L0–L2) | Regler + AI-omrankning | Ingen generell matchning, exakta artiklar och favoriter | **Ersatt.** Matchning finns bara kvar för ersättare och migrering |
| Cloud browser | "Bygg inte generisk fjärrwebbläsare före pilot" | Ingår i arkitekturen | **Ändrat i version 2.** Ingen generell plattform ännu, men en liten PoC (MVP 1B) körs parallellt med MVP 1A så snart legitim åtkomst finns. Webbläsaragenten är en kärnfunktion vars hypotes ska bevisas tidigt. Enklare vägar (API, prisfil) används om grossisten erbjuder dem, men vi väntar inte på dem |
| Moms och valuta | "Euro- och momslogik byggs först när en riktig grossist kräver det" (BESLUT.md, beslut 5) | Moms och ekonomi är grunden för inköpskostnad, påslag, kundpris, faktura och bokföringsunderlag | **Ändrat för moms.** Moms-redig pengamodell, per rad, med versionerade regler byggs i MVP 1A. **Euro och omräkning väntar fortfarande** (`currency` finns i modellen men bara SEK används) |
| Ekonomisk spårbarhet | Inte med | Pris, regelversion, godkännande och faktiskt inköp ska gå att följa | **Nytt, avsnitt 8.2–8.5** |
| MVP-ordning | MVP 1 → 2 → 3a → 4 → 3b → 5 | MVP 1A + 1B parallellt → 2 → 3 → 4 → 5 (varukorg) → 6 | **Ändrat i version 2.** Faktura före varukorg behålls |
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
| Webbläsare | **Cloudflare Browser Run** (tidigare Browser Rendering) som första kandidat i PoC:n (MVP 1B). **Behåll ett smalt `BrowserSession`-gränssnitt** så att leverantören går att byta | Live View och *Human in the Loop* finns dokumenterat, betala per timme **(ej verifierat mot aktuell prissida)**. PoC:n avgör om cookie-överlämningen fungerar | Browserbase eller liknande (Developer 20 USD/mån för 100 timmar, enligt tredjepartskälla) |
| Pengar | **Heltal och exakta bråk** i en egen `Money`-modul. Aldrig flyttal | Moms och avrundning måste kunna förklaras och testas exakt | Decimalbibliotek (ännu ett beroende, och vi behöver bara en liten del) |
| Moms och regler | **`TaxRuleSet` (versionerade data) bakom ett enda gränssnitt**, `taxRules.resolve(kategori, datum)` | Reglerna ändras. Gamla fakturor får inte ändras. Inget annat ställe får känna till en momssats | Hårdkodade satser i inställningar (så är det i dag, `vatPct`) |
| Bokföring | **`AccountingConnector`**, ingen egen bokföring. Första varianten är en exportfil | Låser oss inte till ett ekonomisystem | Bygga eget (ska inte göras) |
| Kö och schemaläggning | Cloudflare Queues + Cron Triggers | Billigt, ingår i samma plattform | |
| AI | **`AIProvider`-gränssnitt**, första adaptern Claude | Byta leverantör utan att bygga om | Direktanrop (vi har det i dag i `worker.js`, och det ska flyttas bakom gränssnittet) |
| Klient | PWA med lokal cache | Fungerar i butik utan täckning | Native app (inte nu) |
| Var ligger MVP 1A:s data | **Lokalt (IndexedDB) med server-redo id:n**, ingen server förrän MVP 2 | Inga konton och ingen kostnad för att pröva kärnan | Server från början (dyrare och långsammare att komma igång) |

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

### 3.5 Ekonomilagret (nytt i version 2)

```
 Planering (får ändras fritt)                         Faktiskt (oföränderligt, med revisionsspår)
 ───────────────────────────                          ─────────────────────────────────────────
 Estimate · Quote · CustomerOrder · PurchasePlan      SupplierPurchase · SupplierDocument ·
 · SupplierCart                                       CustomerInvoice (+ kredit) · Payment
        │                                                          │
        ▼  alla belopp via en enda modul                            ▼  matar bara faktiska händelser
 ┌──────────────────────────────────────────────┐          ┌───────────────────────────────┐
 │ Money   exakta heltal/bråk, avrundning på    │          │ FinancialEvent (append-only)  │
 │         namngivna ställen                    │          └───────────────┬───────────────┘
 │ TaxRules  taxRules.resolve(kategori, datum)  │                          ▼
 │           → { sats, regelversion }           │          ┌───────────────────────────────┐
 │ PricingEngine  ren funktion, ingen AI        │          │ AccountingConnector           │
 └──────────────────────────────────────────────┘          │ (gränssnitt, bara efter       │
                                                            │ floristens godkännande)       │
                                                            └───────────────────────────────┘
```

- **`Money`** hanterar alla belopp. Beslut om representation i avsnitt 6.1.
- **`TaxRules`** är det enda stället som känner till momssatser. Reglerna är *data* med giltighetstid, källa och version (avsnitt 8.4). UI, kalkylmotor och faktura frågar, de bär inga egna satser.
- **`PricingEngine`** är en ren funktion: indata och regelversion in, belopp med uppdelning ut. Samma kod körs i telefonen och på servern.
- **`AccountingConnector`** är ett gränssnitt på samma princip som `SupplierConnector`: ett kontrakt, flera möjliga ekonomisystem, ingen låsning (avsnitt 8.5). Inget annat i appen får veta vilket ekonomisystem som används.
- **AI** får klassificera och förklara (till exempel föreslå en `taxCategory` för en fri rad som floristen sedan bekräftar). Den får aldrig räkna och aldrig välja en momssats som gäller utan bekräftelse.

---

## 4. Domänmodell

### 4.1 Namnbeslut

| Brief | Beslut | Skäl |
|-------|--------|------|
| Tenant / Shop | **`Shop`** (butik) i domänen, `shopId` som isoleringsnyckel överallt | Det floristen känner igen. "Tenant" är teknik |
| Arrangement / FloralItem / Design | **`Arrangement`** (kod) och UI-etikett = typnamnet floristen valt ("Brudbukett"). Rader heter **`ArrangementItem`** (tidigare `ArrangementLine`) | Är det ord florister själva använder. "Design" är för vagt |
| Event / Jobb / Order | **`Event`** (UI: "Jobb"). Ett Event är **ett inköpstillfälle** (en leveransdag) | Förpackningar delas bara inom ett inköpstillfälle |
| Varukorg | **`CartPreparation`** | Den förbereds, den "beställs" aldrig av oss |
| Estimate, Quote, ... Payment | Nio **separata** typer (avsnitt 8.2): `Estimate`, `QuoteSnapshot`, `CustomerOrder`, `PurchasePlan`, `CartPreparation`, `SupplierPurchase`, `SupplierDocument`, `CustomerInvoice`, `Payment` | Planerat och faktiskt får aldrig blandas ihop |
| Pengar, skatt | `Money`, `TaxCategory`, `TaxRuleSet` | Exakt aritmetik och regler som data |

### 4.2 Entiteter

Alla rader har `shopId`, `id` (ULID), `createdAt`, `updatedAt`, `rev` och `deletedAt` (för senare synk). Utom där annat anges.

**Identitet och butik**

| Entitet | Viktiga fält | Anmärkning |
|---------|--------------|------------|
| `Shop` | name, location (`shopLocation`: label, lat?, lon?, region, country), plan, createdAt | `PricingSettings` hör hit |
| `User` | email, auth-uppgifter | Global, kopplas till butik via `Membership` |
| `Membership` | userId, shopId, role (`owner` / `staff`) | Personal kan sakna rätt att se inköpspriser och marginal (se luckor) |
| `PricingSettings` (per butik) | `markup` (**påslag på kostnad**, i hundradels procent), defaultLaborFee, hourlyLaborRate?, minimumLaborFee?, roundingRule (steg och riktning), `taxCategoryDefaults` (vilken `TaxCategory` varje radtyp har), deliveryFee, setupFee, sizePresets | Standardvärden. Varje arrangemang och jobb kan överstyra. **Ingen enskild momssats här.** Satsen kommer ur `TaxRules` för radens kategori och datum. Dagens `vatPct` är en egen global inställning som lever kvar för den gamla räkningen och migreras till kategoriernas standard |

**Kunder och jobb**

| Entitet | Viktiga fält |
|---------|--------------|
| `Customer` | name, email, phone, notes, **customerKind** (`PRIVATE` / `BUSINESS`, standard `PRIVATE`) |
| `Event` | customerId, name, type (`wedding`/`funeral`/`bouquet`/`other`), `usage` (`horizon`: today/week/later/event, `date`), eventDate, deliveryDate, status, notes, pricingOverrides?, frozenQuoteId? |
| `Arrangement` | eventId, name, kind, **quantity**, sizePresetId?, markupOverride? (påslag i hundradels procent), laborOverride? (fast avgift eller tid), estimatedMinutes?, notes, imageRef? |
| `ArrangementItem` | arrangementId, **`source`** (`SUPPLIER` / `OWN_STOCK` / `HOME_GROWN` / `MANUAL`, plats reserverad för `LEFTOVER`), `kind`, name, `articleRef` (`connectionId` + `supplierProductId`, **bara för `SUPPLIER`**), `materialRef` (reserverad för "Mina material"), **quantity** per arrangemang, unit, **`requiresPurchase`**, **`pricing`** (`mode`: `STANDARD_MARKUP` / `FIXED_SALE_PRICE`, `unitCostBasis` kalkylkostnad, `unitExternalCost` vad det kostar att skaffa utifrån, `unitSalePrice` fast kundpris med `basis` inc/ex, `markup`), `taxCategory`, note. Se avsnitt 4.5 |
| `EventFee` | eventId, kind (`delivery`/`setup`/`other`), label, amount (`Money`), `taxCategory` (inte en sats) |
| `QuoteSnapshot` | eventId, version, createdAt, lines (pris per arrangemang med `priceBasis` och `PriceBreakdown`), totals, `ruleSetVersion`, validUntil, status (`draft`/`sent`/`accepted`). Oföränderlig när den är skickad |
| `CustomerOrder` | eventId, quoteSnapshotId (den version kunden godkände), approvedAt, approvedBy (vem hos floristen registrerade kundens ja), terms. **Fryser kundpriset.** Ändring ger ny version och ny `QuoteSnapshot` |

**Grossist**

| Entitet | Viktiga fält |
|---------|--------------|
| `SupplierConnection` | supplierId, status, authKind, vaultRef, capabilities (inkl. `cart`, `offers`, `catalogEnumeration`, `attributes`), `lastCatalogSyncAt`, `lastPricesSyncAt`, `lastOffersSyncAt`, `connectorVersion`, `health` |
| `SupplierProduct` | connectionId, supplierProductId (SKU), name, `facts`, `derived`, `rawAttributes`, packQuantity, packUnit, orderMultiple, discontinued, firstSeenAt, lastSeenAt |
| `PriceQuote` | connectionId, supplierProductId, packPrice, currency, priceIncludesVat (true/false/okänt, som i dag), **`purchaseAmount`** (`Amounts`, se nedan), availability, forDeliveryDate, fetchedAt, strategy, verification (`supplier`/`ai_read`/`manual`) |
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

**Pengar och skatt (nytt i version 2)**

| Entitet | Viktiga fält |
|---------|--------------|
| `Money` | `amount` (heltal i minsta enhet, öre) och `currency`. Aldrig flyttal. Beräkning sker med exakta bråk och avrundas på namngivna ställen (avsnitt 6.1) |
| `Amounts` | Det som efterfrågats som `…ExVat / …VatRate / …VatAmount / …IncVat`: `exVat`, `vatRate`, `vat`, `incVat` (alla `Money`/sats eller `null` = okänt), `basis` (`ex` / `inc`: vilket tal som var det *observerade*, de andra härleds av kod), `currency`, `source`, `verifiedAt`, `ruleSetVersion?`. **Invariant: `exVat + vat = incVat` exakt**, annars avvisas posten |
| `TaxCategory` | Stabil kod för vad en rad *är*: `flowers`, `plants`, `accessories`, `arrangement_goods`, `labor`, `delivery`, `setup`, `other`. Kategorin är inte en sats. Satsen slås upp i `TaxRuleSet` |
| `TaxRuleSet` | `id`, `version`, `validFrom`, `validTo?`, `rates[taxCategory] → sats`, `roundingLevel` (`line` eller `rate_summary`, avgörs när reglerna verifierats), `source` (länk till Skatteverket/lag), `verifiedBy`, `verifiedAt`. Oföränderlig när den publicerats. Ny ändring = ny version |
| `PriceBreakdown` | Uppdelningen bakom ett kundpris: `purchaseCost`, `markup`, `labor`, `fees`, `basisExVat`, `saleExVat`, `vatByRate[]`, `saleIncVat`, `rounding`, `ruleSetVersion`, `inputs` (vilka priser och vilken `priceBasis` som användes) |

**Faktiska affärshändelser (nytt i version 2, byggs från MVP 3–4)**

| Entitet | Viktiga fält |
|---------|--------------|
| `SupplierPurchase` | connectionId, orderRef (grossistens), purchasedAt, lines[] (articleRef, packs, `Amounts` *enligt grossistens bekräftelse*), `source` (`supplier_confirmation` / `manual_entry`), documentRef?. **Skapas bara av en verklig bekräftelse eller av floristen**, aldrig av vår varukorg |
| `CostAllocation` | supplierPurchaseLineId, eventId, stems, `Money`. Fördelar ett gemensamt inköp på de jobb det hör till (deterministisk regel, till exempel efter behov). Svarar på "vilket faktiskt inköp hör kostnaden till?" |
| `SupplierDocument` | kind (`invoice`/`receipt`/`credit`), supplierRef, documentNumber, date, `Amounts` (moms enligt dokumentet), fileRef?. Underlag för ingående moms |
| `Payment` | direction (`in`/`out`), `Money`, date, method, matchedTo (faktura eller leverantörsdokument), source (manuell, import) |
| `FinancialEvent` | Append-only. kind, refType/refId, `Money`, `Amounts`, occurredAt, `ruleSetVersion`, `supersedes?`. **Det enda som ekonomisystemet får** (avsnitt 8.5) |

**Faktura**

| Entitet | Viktiga fält |
|---------|--------------|
| `InvoiceDraft` | eventId, customerId, **customerName, customerEmail** (kopieras från `Customer` när utkastet skapas), customerType (privatperson/företag), status (`draft`/`ready_for_review`/`approved`/`sent`/`voided`), version, **seller** (snapshot av butikens uppgifter), lines[], `subtotalExVat`, `vatSummaryByRate[]` (underlag, sats, moms), `totalVat`, `totalIncVat`, currency, **paymentTerms**, **paymentInformation**, `ruleSetVersion`, `invoiceDate?`, `dueDate?`, `invoiceNumber?` (tilldelas först vid `approved` eller `sent`, avsnitt 8.3), approvedBy, approvedAt, sentVia, externalRef |
| `InvoiceLine` | description, quantity, unit, unitPriceExVat, discount, `taxCategory`, **vatRate** (frusen från regeluppslaget), vatAmount, lineTotalExVat, lineTotalIncVat, source (arrangement/fee/custom), sourceRef |
| `CustomerInvoice` | En *skickad* `InvoiceDraft`: oföränderlig kopia med `invoiceNumber`, belopp, regelversion och sändningsbevis. Rättelse sker med kreditfaktura, aldrig ändring |

Fakturans obligatoriska innehåll (säljare, momsregistreringsnummer, löpnummer, datum, köpare, mängd och art, beskattningsunderlag per sats, momsbelopp med mera) **verifieras mot Skatteverkets och momslagens texter när fakturan implementeras**. Listan ovan är en arbetslista, inte en kontrollerad kravlista **(ej verifierat)**.

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
| `AuditLog` | shopId, actor (användare, agent, system), action, target, **before/after-referenser** (versioner, inte överskrivna värden), `ruleSetVersion?`, at. Append-only. Alla ekonomiska handlingar och godkännanden (avsnitt 8.3) |

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
                  sent → CustomerInvoice (oföränderlig).  Rättelse = kreditfaktura + ny faktura, aldrig ändring

Affärskedja:      Estimate → QuoteSnapshot (skickad) → CustomerOrder (kunden sa ja)
                  PurchasePlan → CartPreparation                      ← planering, inga bokföringsunderlag
                  SupplierPurchase (verklig bekräftelse) → SupplierDocument → Payment(out)    ← faktiskt
                  InvoiceDraft → CustomerInvoice → Payment(in)                               ← faktiskt
```

### 4.4 Invarianter (varje punkt ska ha ett test)

1. Ingen rad utan `shopId`. Ingen fråga utan butiksfilter.
2. `ArrangementItem.articleRef` finns bara för `SUPPLIER` och pekar på en artikel i samma butiks anslutning. Egna material (`OWN_STOCK`, `HOME_GROWN`, `MANUAL`) kräver ingen `SupplierProduct` och skapar aldrig en.
3. Avalanche 50 cm och Avalanche 60 cm är olika `SupplierProduct` med olika pris.
4. Priset i en kalkyl kommer alltid från `PriceQuote` / `Offer` / `PriceOverride` via en enda regel, och bär `priceBasis`.
5. En `QuoteSnapshot` är oföränderlig när den är skickad.
6. En `InvoiceDraft` kan inte bli `sent` utan att ha varit `approved` av en användare, och kan inte ändras efter `approved` utan att bli en ny version.
7. `CartPreparation` kan aldrig innehålla ett läge som betyder att köpet genomförts.
8. Ett erbjudande används aldrig för ett datum utanför sin giltighet, och aldrig för ett framtida event.
9. **Inga flyttal för pengar** i den nya ekonomikoden. Alla belopp är `Money` eller exakta bråk.
10. `Amounts`: `exVat + vat = incVat` exakt. Ett okänt värde förblir `null`, aldrig noll.
11. **Moms bärs per rad.** Ingen kod utanför `TaxRules` innehåller en momssats. En rad med okänd `taxCategory` får inget pris.
12. **Ett godkänt eller skickat ekonomiskt dokument har en frusen regelversion** och ändras aldrig av att en regel ändras.
13. **Endast faktiska händelser** (`SupplierPurchase`, `SupplierDocument`, `CustomerInvoice`, `Payment`) skapar `FinancialEvent`. En `PurchasePlan`, en `CartPreparation`, en `QuoteSnapshot` och ett sett pris skapar aldrig en.
14. `FinancialEvent` och `AuditLog` är append-only. En rättelse är en ny rad som pekar på den gamla (`supersedes`).
15. `invoiceNumber` är unikt per butik, löpande och utan återanvändning. Ett utkast har inget nummer **(krav ej verifierat)**.
16. **Påslag och marginal är olika fält** och blandas aldrig. Lagrat värde är påslag. Marginal är bara en härledd siffra.
17. **En rad avgör själv om den ska beställas** (`requiresPurchase`). Bara grossistrader (`SUPPLIER`) kan någonsin bli ett `PurchaseRequirement` i en grossistbeställning. Eget lager och egen trädgård beställs aldrig.
18. **Noll inköpskostnad betyder inte noll värde.** Kundpriset kommer av kalkylkostnad plus påslag, eller av ett fast kundpris. Den externa inköpskostnaden ändrar aldrig priset. Ett eget material med standardpåslag måste ha en kalkylkostnad större än noll.
19. **Moms per rad oberoende av källa.** Eget lager eller egen trädgård gör inte försäljningen momsfri. Varje rad kan få en `taxCategory`, och ingen sats gissas.
20. **Beräknat och presenterat pris behålls båda.** Det beräknade (exakta) priset ändras aldrig av avrundningsregeln och ersätts aldrig av det presenterade.

### 4.5 Egna tillägg och material (version 2.2)

Allt som används i ett arrangemang kommer inte från den aktuella grossistbeställningen. Floristen använder också sidenband som redan finns i butiken, en vas eller kruka, oasis, tråd, pynt, torkat material, blommor och grönt från egen trädgård eller odling, material från eget lager och överblivet material från tidigare inköp. Det ska gå att lägga till mycket enkelt (i ett framtida gränssnitt ungefär `[+ EGET TILLÄGG]`), och kundpriset ska uppdateras direkt. Därför kräver en rad **ingen** `SupplierProduct`, och två saker hålls isär:

```
VAD SOM ANVÄNDS I ARRANGEMANGET   alla rader, de påverkar kundpriset
VAD SOM MÅSTE BESTÄLLAS           bara rader med requiresPurchase (grossistartiklar), de blir PurchaseRequirement
```

**Källa (`source`).** Enkel modell, inte övermodellerad:

| `source` | Betyder | `articleRef` | `requiresPurchase` |
|----------|---------|--------------|--------------------|
| `SUPPLIER` | Artikel hos en grossist | krävs | alltid sant |
| `OWN_STOCK` | Finns redan i butiken (sidenband, vas, oasis, tråd) | nej | alltid falskt |
| `HOME_GROWN` | Egen trädgård eller odling | nej | alltid falskt |
| `MANUAL` | Något annat floristen skriver in | nej | falskt som standard, kan vara sant ("köps någon annanstans", hamnar aldrig i grossistens beställning) |
| `LEFTOVER` | Överblivet material från tidigare inköp | | **Reserverad plats**, inte aktiverad. Lager byggs inte nu |

**Prissättning (`pricing.mode`).**

| Läge | Så räknas raden | Typiskt för |
|------|-----------------|-------------|
| `STANDARD_MARKUP` | kalkylkostnaden (`unitCostBasis`, eller grossistens pris för `SUPPLIER`) × antal får butikens vanliga påslag | grossistmaterial, och egna material som ska följa vanligt påslag |
| `FIXED_SALE_PRICE` | floristen anger kundens pris direkt (`unitSalePrice`, med eller utan moms) × antal. Kräver ingen inköpskostnad | egna tillägg: "antik vas +250 kr" |

**Noll inköpskostnad betyder inte noll värde.** En blomma från egen trädgård kan ha extern inköpskostnad 0 och ändå ett värde och ett försäljningspris. Därför är tre saker olika fält: `unitExternalCost` (vad det kostar att skaffa utifrån, 0 för egen trädgård, ändrar inte priset), `unitCostBasis` (kalkylkostnaden som påslaget räknas på) och `unitSalePrice` (ett fast kundpris). Motorn antar aldrig att kostnad 0 ger kundpris 0. Ett eget material med standardpåslag måste därför ha en kalkylkostnad större än noll, annars väljer floristen ett fast kundpris. **0 kr som kundpris är ett uttryckligt val** ("ingår"), aldrig ett resultat av en saknad kostnad.

**Exempel (alla belopp är illustrationer, satsen 25 % är testdata):**

| Rad | Inställning | Kundpris | Beställs? |
|-----|-------------|----------|-----------|
| Avalanche 60 cm × 12 | `SUPPLIER`, standardpåslag på grossistens pris | räknas | **ja** |
| Sidenband (finns i butiken), kostnad 20 kr | `OWN_STOCK`, fast kundpris 75 kr inkl. moms | 75 kr | nej |
| Dahlia × 5 från egen trädgård, extern kostnad 0 kr | `HOME_GROWN`, fast kundpris 25 kr per stjälk inkl. moms | 125 kr | nej |
| Antik vas | `MANUAL`, fast kundpris 250 kr inkl. moms, ingen påhittad kostnad | 250 kr | nej |

**Moms.** Att något kommer från eget lager eller egen trädgård gör inte kundförsäljningen momsfri. Varje rad kan få en `taxCategory` (till exempel `plants` eller `accessories`) oavsett källa. Utan egen kategori gäller butikens standard för varor. Ingen sats gissas: saknas regeln för kategorin får arrangemanget inget pris (`INCOMPLETE`).

**Mina material (senare, byggs inte nu).** Floristen använder ofta samma egna saker (sidenband, oasis, vas, cellofan, tråd, egen eucalyptus). På sikt sparas ett eget tillägg och återanvänds. Modellen blockerar det inte: raden har ett reserverat fält `materialRef`, arbetsytan har en tom lista `materials`, och inget annat behöver ändras. Lagerhantering byggs inte.

**Byggt (MVP 1A, steg 2):** `public/js/core/items.js` (källmodellen, `requiresPurchase`, prissättningslägena, valideringen) och motorns stöd för fast kundpris och momskategori per rad (`pricing.js`).

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

### 5.2 Shop → Customer → Event → Arrangement → ArrangementItem

```
Shop ── PricingSettings (påslag, arbetsavgift, moms, avrundning, avgifter)
  └─ Customer  (namn, e-post, telefon, anteckningar)
        └─ Event  (Emma & Johan, bröllop, 12 juni; usage.date; status)
              ├─ Arrangement  × quantity   (Brudbukett ×1, Tärnbukett ×3, Bordsdekoration ×8 …)
              │     └─ ArrangementItem ──► SUPPLIER:   articleRef (SupplierProduct), requiresPurchase = sant
              │                              └─► aktivt pris  (PriceOverride > erbjudande som gäller > färskt grossistpris > gammalt (märkt) > manuellt)
              │                        OWN_STOCK / HOME_GROWN / MANUAL:  inget articleRef, requiresPurchase = falskt
              │                              └─► kalkylkostnad × påslag, eller ett fast kundpris
              ├─ EventFee (leverans, uppsättning, övrigt)
              └─ prismotorn (ren funktion):  inköp blommor + inköp tillbehör
                        → påslag (eller fast kundpris) → arbete → övriga avgifter → moms → avrundning → KUNDPRIS per arrangemang och för jobbet
                        └─ QuoteSnapshot  (när jobbet blir "quoted": fast kopia av priserna)
```

### 5.3 Events → PurchaseRequirements → SupplierCart

```
Events  (status approved/ordering, samma leveransdag och grossist)
   ▼
PurchasePlan
   ├─ PurchaseRequirement per artikel (bara rader med requiresPurchase, alltså grossistartiklar. Egna tillägg kommer aldrig hit):
   │     behov = Σ (antal per arrangemang × antal arrangemang) över alla arrangemang i valda jobb
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
approved   (godkännande loggas: vem, när, vilken version, vilken regelversion)
   ▼  [SKICKA]  (kräver ett uttryckligt tryck, aldrig automatik)
CustomerInvoice  (oföränderlig, löpnummer tilldelas, FinancialEvent skapas)
   ▼  efter floristens godkännande, via vald integration
AccountingConnector  (gränssnitt, avsnitt 8.5.  Första varianten: exportfil/PDF och e-postutkast utan extern tjänst)
```

### 5.5 Från plan till faktisk affärshändelse (nytt)

```
Kalkyl (Estimate) ─► Offert (Quote) ─► Godkänd kundorder (CustomerOrder) ─────────────────────────┐
   inget bokfört        inget bokfört     kundpriset fryst, fortfarande ingen bokföring              │
                                                                                                     │
Planerat inköp (PurchasePlan) ─► Grossistens varukorg (SupplierCart/CartPreparation)                  │
   "vi behöver 3 × 20 rosor"          "agenten la 3 st i korgen". Ingen kostnad ännu                  │
                │ floristen beställer själv hos grossisten                                           │
                ▼                                                                                    ▼
Faktiskt inköp (SupplierPurchase) ──► Leverantörsfaktura/kvitto (SupplierDocument) ──► Betalning ut   Kundfaktura (CustomerInvoice) ──► Betalning in
   enligt grossistens bekräftelse        ingående moms enligt dokumentet                                utgående moms enligt faktura
                └──────────────────────► FinancialEvent (append-only) ◄────────────────────────────────┘
                                                    │  efter floristens godkännande
                                                    ▼
                                           AccountingConnector → ekonomisystemet (formell bokföring och momsunderlag)
```

Informationen skapas **en gång** och följer händelsen. Ett bröllop skrivs in som `Event`. Priset ur kalkylen följer med till offert, kundorder och faktura. Inköpet följer med till `SupplierPurchase`, och `CostAllocation` kopplar kostnaden tillbaka till jobbet. Floristen skriver aldrig samma sak två gånger.

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

**Räkneexemplet.** Siffran 534 kr i briefen och i tillägget var ett *pedagogiskt exempel* och ingen ekonomisk regel. Motorn anpassas inte efter den. Med påslag på inköp och arbete utan påslag är räkningen `186 × 2,2 = 409,20`, plus `125` = **534,20 kr före moms**, och med en *testsats* på 25 % blir det 667,75 kr inkl. moms före avrundning, **670 kr kundpris** när man avrundar uppåt till jämna 5 kr. Satserna i exemplen är testdata, inte verifierade regler (avsnitt 8.4). Exemplet är rättat här och i testerna.

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

### 6.1 Pengar: exakt aritmetik (beslut)

- **Lagrade belopp** är `Money`: heltal i öre och en valutakod. Procentsatser lagras som heltal i hundradels procent (25 % = 2 500, 120 % påslag = 12 000).
- **Beräkning** sker med **exakta bråk** (heltal över heltal, `BigInt`) så att `186 ÷ 20` eller `100 ÷ 3` aldrig tappar precision. En modul på ca 150 rader, inget externt beroende.
- **Avrundning sker bara på namngivna ställen** och med en uttalad regel: (1) kundpriset till floristens steg (som i dag, uppåt), (2) härledd moms per rad eller per sats, enligt `TaxRuleSet.roundingLevel`, (3) faktureringsbelopp till hela öre. Allt däremellan är exakt.
- **Tvärtom-räkning är bestämd:** när kundpriset är rundat inkl. moms (det floristen och kunden ser), är *det* sanningen. Pris exkl. moms och moms härleds ur det (`exVat = avrunda(incVat ÷ (1 + sats))`, `vat = incVat − exVat`), så att `exVat + vat = incVat` alltid stämmer exakt.
- **Flyttalsmotorn `calc()` rörs inte.** Den blir en *referensmotor* som den nya `PricingEngine` jämförs mot i ett differenstest på de 145 tillstånden. Skillnader utreds en och en. Där flyttal och exakta tal skiljer är det flyttalet som avviker. `calc()` har redan ett skydd mot flyttalsbrus (`ceilTo` med `1e-9`), så skillnader väntas bara i enstaka gränsfall.
- **AI räknar aldrig.** AI får föreslå `taxCategory` för en fri rad, men bara en människa bekräftar den, och koden räknar.

### 6.2 Påslag är inte marginal

| | Påslag (markup) | Marginal (margin) |
|---|---|---|
| Definition | `(pris − kostnad) ÷ kostnad` | `(pris − kostnad) ÷ pris` |
| Exempel, kostnad 186 kr, 120 % påslag | pris 409,20 kr | marginal 54,5 % |
| 54,5 % tas av misstag som *påslag* på 186 kr | pris 287,37 kr | marginal 35,3 % |
| Går att vara över 100 %? | Ja (120 % är normalt) | **Nej**, alltid under 100 % |

- **Det lagrade och inmatade värdet är alltid påslag** (på kostnaden, som i dag). Det heter *Påslag* i gränssnittet.
- **Marginal är bara en härledd siffra** (visas som "marginal" i detaljvyn), med uttalad bas: `(pris exkl. moms − inköpskostnad) ÷ pris exkl. moms`. Arbetet räknas inte in i kostnaden i den siffran, och det står med.
- Vill floristen ange målmarginal hjälper vi med en räknehjälp: `påslag = m ÷ (1 − m)`, med `m < 100 %` som villkor. Det blir ett *förslag på påslag*, inte ett andra lagrat fält.
- **Tester:** 120 % påslag ger 54,5 % marginal. 50 % marginal ger 100 % påslag. 100 % marginal avvisas. Påslag och marginal används aldrig i stället för varandra (en mutationstest byter dem och måste fångas).

### 6.3 Kostnadsstegen (försäljningsunderlag)

```
inköpskostnad exkl. AVDRAGSGILL moms (faktisk eller senaste kända) ← från PriceQuote.purchaseAmount, via Amounts.costBasis
+ påslag = markup på relevant inköpskostnad (100 kr + 120 % = 220 kr)  ← som i dag. Marginalen är härledd, aldrig samma sak som påslaget
+ arbete (fast avgift eller minuter × timpris, ej med påslag)   ← som i dag, fast avgift läggs till
+ avgifter (leverans, uppsättning, övrigt, ej med påslag)       ← per radtyp, egen TaxCategory
= försäljningsunderlag exkl. moms (per rad och kategori)
→ moms per rad (sats ur TaxRules för kategori och datum)
→ avrundning (kundpriset till floristens steg)
= KUNDPRIS inkl. moms  ← det floristen arbetar med
```

**Inköpsmoms i planeringsfasen.** För kalkylen behövs bara inköpspriset *exkl. moms* (ingående moms är avdragsgill för en momsregistrerad florist, så den är ingen kostnad). Ett pris som grossisten visar *inkl. moms* räknas om till exkl. moms först när satsen är känd och bekräftad. Är den okänd är priset oanvändbart som i dag (`vat_unknown`), och det stannar så. **Inköpsmoms enligt dokument** (`SupplierDocument`) behövs först för faktiska inköp och hämtas ur dokumentet, inte ur regelverket.

### 6.4 Kundpriset först, uppdelningen bakom

```
┌───────────────────────────────┐        ┌────────────────────────────────────────────┐
│ Brudbukett                    │  tryck │ Inköp (ex moms)               186,00 kr    │
│ KUNDPRIS      670 kr          │ ─────► │ Påslag 120 %                  223,20 kr    │
│ inkl. moms                    │        │ Arbete                        125,00 kr    │
└───────────────────────────────┘        │ Före moms                     534,20 kr    │
                                          │ Moms 25 % (illustration)      133,55 kr    │
                                          │ Summa                         667,75 kr    │
                                          │ Avrundat upp till 5 kr        670,00 kr    │
                                          │ På fakturan:  536,00 ex moms + 134,00 moms │
                                          └────────────────────────────────────────────┘
```

(Siffrorna är en *illustration* av hur uppdelningen visas, med 25 % som testsats. Raden "På fakturan" följer regeln i 6.1: det avrundade kundpriset är sanningen, och exkl. moms och moms härleds ur det så att de summerar exakt. Differensen mot 534,20 är avrundningen.)

- **Överst alltid KUNDPRIS inkl. moms** (privatkund): den summa kunden faktiskt ska betala. Säger floristen "bordsdekorationen blir cirka 650 kr" är 650 kr kundens slutpris inkl. moms. Med ett tecken för prisstatus (avsnitt 6.7): `≈ 650 kr` när priset bygger på senast synkade grossistpriser, `✓ 662 kr` när valda artiklar livekontrollerats. För företagskund kan exkl. moms, moms och totalt visas tydligare (avsnitt 6.8). Det är en visningsfråga, inte en ny beräkning.
- Allt bakom visas bara på begäran och är samma tal som går vidare till offert, kundorder och faktura. **Ingen omräkning på vägen.**
- Alla delar bär `PriceBreakdown.inputs`, så att "var kom priset från?" går att besvara.

### 6.5 Moms per rad

Ett jobb kan innehålla blommor, arrangemang, arbete, leverans, uppsättning, tillbehör och andra varor eller tjänster. Därför:

- varje rad har en `taxCategory`, och satsen slås upp per rad, per datum, i `TaxRules`
- `InvoiceDraft.vatSummaryByRate` summerar underlaget per sats
- en faktura kan ha flera satser, och motorn hanterar det från dag ett även om alla rader i dag får samma
- **Okänd kategori ger inget pris**, inte en gissad sats
- vad som gäller för förskott, rabatter, omvänd skattskyldighet och momsfria kunder är **inte bestämt** och byggs inte, men modellen har plats för `taxTreatment` per kund och rad (`standard` är enda värdet som implementeras)

### 6.6 Baklänges: målpris → råvarubudget

Ibland börjar floristen inte med kostnaden. Kunden säger "ungefär 800 kr", och 800 kr inkl. moms är då **målpriset**. PricingEngine har därför två riktningar med samma ekvationer, så motorn är inte byggd så att bara kostnad → pris går:

```
COST → CUSTOMER PRICE            priceArrangement       inköp + påslag + arbete + avgifter + moms → avrundat KUNDPRIS
TARGET CUSTOMER PRICE → BUDGET   budgetForTarget        målpris − moms − arbete − avgifter − påslag → råvarubudget kvar
```

Exempel (testsats 25 %, påslag 120 %, arbete 125 kr, steg 5 kr): `(800 − 125 × 1,25) ÷ 1,25 = 515 kr` före moms för varor inklusive påslag, och `515 ÷ 2,2 = 234,09 kr` råvarubudget. Bevis åt andra hållet (testat): en råvara på 234,09 kr ger kundpris 800 kr, och 234,10 kr ger 805 kr.

- Redan bestämda inköp (till exempel en vas) minskar budgeten. Råvarubudgeten kan räknas med eller utan påslag.
- Målpriset avrundas *nedåt* till ett pris som går att nå (802 kr med steg 5 kr betyder 800 kr).
- Är arbete och avgifter redan större än målet ger motorn `NEGATIVE` och hur mycket som saknas. Okänd moms eller okänt inköpspris ger `INCOMPLETE`, aldrig en gissad budget.
- Bara avrundning uppåt stöds bakåt (det är floristens vanliga regel).
- Skärmen för detta byggs inte nu. Motorn och testerna finns.

### 6.7 Prisstatus och prisbas: ≈ och ✓

Skilj mellan **uppskattat kundpris** och **bekräftat kundpris**. Prisstatus räknas ur vilken typ av underliggande pris som användes per inköpsrad. `PriceBreakdown` bär det så att man senare kan förklara varför kalkylen blev som den blev.

| Prisbas (`source.kind`) | Betyder | Prisstatus |
|-------------------------|---------|------------|
| `LIVE` | Livekontrollerat hos grossisten nu | bekräftad |
| `MANUAL` | Floristens eget pris eller override (hennes beslut) | bekräftad |
| `RECENT` | Senast synkat, ännu inte livekontrollerat | uppskattad |
| `STALE` | Gammalt pris, markerat som gammalt | uppskattad |
| `HISTORICAL_ESTIMATE` | Kalkylpris ur historik, till exempel för ett framtida event (aldrig dagens kampanj) | uppskattad |

- **Bekräftat (✓) kräver att varje inköpsrad är LIVE eller MANUAL.** Allt annat, inklusive en okänd eller saknad prisbas, gör priset uppskattat (≈). Saknas ett pris helt är status `INCOMPLETE` och inget pris visas.
- Bestämmelsen att MANUAL räknas som bekräftat är en produktregel som står på ett enda ställe i koden och kan ändras. **Gränsen mellan RECENT och STALE** (hur gammalt är "gammalt") bestäms först när vi vet hur den verkliga grossistens priser uppdateras. Motorn läser bara vilken typ raden har.
- Jobb: bekräftat bara om alla rader är bekräftade, annars uppskattat.

### 6.8 Kundtyp: privat och företag

`customerKind` är `PRIVATE` eller `BUSINESS`. Den ändrar **bara presentationen** (`headline`): privatkund får kundpriset inkl. moms som huvudtal, företagskund kan senare få exkl. moms, moms och totalt. Beräkningen och beloppen är identiska (testat). Inga två UI-flöden byggs nu. `Customer` får fältet `customerKind` så att modellen inte blockerar det. Omvänd skattskyldighet och momsfria kunder är inte byggda (`taxTreatment` finns bara som plats).

### 6.9 Arbete som egen komponent

Arbete är en separat komponent och får inget påslag. Modellen:

| Fält | Betydelse | MVP |
|------|-----------|-----|
| `defaultLaborFee` | Standardavgift per arrangemang | **Ja** |
| `laborOverride` | Överstyrning per arrangemang (fast avgift eller tid) | **Ja** |
| `hourlyLaborRate` + `estimatedMinutes` | Tidsbaserat: minuter × timpris ÷ 60, exakt (30 min × 300 kr = 150 kr) | Finns i motorn och är testat, tas i bruk senare |

Företräde: överstyrning, sedan tid (om både minuter och timpris finns), sedan standardavgift, sedan inget arbete. Minuter utan timpris räcker inte. Arbetet har egen `taxCategory` (`labor`), så moms per rad fungerar även om satsen skiljer sig från varorna.

### 6.10 Pooling och marginal

När flera jobb samordnas blir den verkliga inköpskostnaden lägre än kalkylerad. Offerten bygger på jobbets egna kostnad (konservativt). Skillnaden är floristens vinst, och synlig som "faktisk marginal" först när faktiska inköp finns.

### 6.11 Prissättning per rad: standardpåslag eller fast kundpris

Varje rad (`ArrangementItem`) prissätts på ett av två sätt, och motorn är byggd för båda (avsnitt 4.5):

```
STANDARD_MARKUP     kalkylkostnad × påslag, per momskategori        grossistmaterial och egna material som följer vanligt påslag
FIXED_SALE_PRICE    ett belopp som är kundens pris direkt           egna tillägg ("antik vas +250 kr")
```

- Ett fast pris anges **med eller utan moms** (`inc` eller `ex`). Anges det inkl. moms är det exakt det beloppet inkl. moms, och beloppet exkl. moms härleds ur det utan avrundning. I ett framtida gränssnitt är det naturligt att privatkunders priser anges inkl. moms (beslut 14, avsnitt 18).
- Ett fast pris kräver ingen kalkylkostnad. Finns en, används den bara för marginalen. Saknas den är marginalen markerad som ofullständig (`marginComplete = false`) i stället för att antas.
- Priset beror **aldrig** på den externa inköpskostnaden (`unitExternalCost`). Noll inköpskostnad ger aldrig noll kundpris.
- Prisstatus: ett fast kundpris är floristens eget beslut och påverkas inte av hur gammalt grossistpriset är. Det gör ett vanligt påslagspris.
- Varje rad kan ha en egen momskategori. Standardpåslagsrader grupperas per kategori. Alla satser slås upp i regelversionen för datumet.
- Baklänges (avsnitt 6.6) tar hänsyn till fasta tillägg: de minskar råvarubudgeten med sitt pris inkl. moms.

**Tillägg i version 2.3 (Annas preciseringar):**

```
STANDARD_MARKUP     kalkylkostnad × påslag. Kräver en kalkylkostnad större än noll.
FIXED_SALE_PRICE    ett belopp med uttrycklig prisgrund (inc eller ex).
INCLUDED            "ingår utan extra kostnad": ett giltigt kundpris på 0 kr, valt av floristen.
```

- **`PRICE_MISSING` är något annat än `EXPLICITLY_INCLUDED`.** Saknas en kalkylkostnad eller ett belopp är kalkylen ofullständig och inget pris visas. 0 kr är bara ett pris när floristen valt "Ingår". Noll *inköpskostnad* betyder aldrig noll *värde*: `HOME_GROWN` och `OWN_STOCK` behåller en kalkylkostnad (till exempel 25 kr för en dahlia) trots att inköpskostnaden idag är 0.
- **Prisgrund.** Ett fast pris lagras med `inc` eller `ex` (`INC_VAT` och `EX_VAT` godtas som synonymer). Förval: inkl. moms för privatkund, exkl. moms för företag. Valet sparas alltid uttryckligt på raden så att ett senare byte av kundtyp inte ändrar ett redan givet pris.
- **Underlag för lönsamhet** (`profitabilityInputs`, status `DATA_ONLY`): kundpris, material/kalkylkostnad, extern kostnad, arbete och övrigt. Bara data. Vinst och täckningsbidrag är inte definierade, och inget fält har ett sådant namn.

### 6.12 Beräknat pris och presenterat kundpris (version 2.2)

Internt skiljer vi mellan två belopp, och **båda behålls**:

| | Beräknat pris (`calculated`) | Presenterat kundpris (`presented`) |
|---|---|---|
| Vad | det exakta ekonomiska resultatet av kalkylen | det avrundade pris floristen säger till kunden |
| Exempel | 667,75 kr inkl. moms | 670 kr inkl. moms |
| Typ | exakta bråk i ören (`Frac`), exkl. moms, moms och inkl. moms, även per sats | `Money` (hela ören), med exkl. moms och moms härledda ur det avrundade priset |
| Ändras av avrundningsregeln? | **Nej, aldrig** | Ja, det är resultatet av regeln |
| Skillnaden | `presented.rounding` = presenterat minus beräknat (2,25 kr i exemplet) | |

- **Det exakta beräknade priset ersätts aldrig av det avrundade presentationspriset.** Båda ligger kvar i resultatet, och en senare faktura kan därför visa exakt hur priset uppstod.
- `customerPrice`, `saleExVat`, `vat` och `vatByRate` är det presenterade priset (de gamla namnen finns kvar).
- För ett jobb summeras beräknat och presenterat var för sig (`job.calculated`, `job.presented`). Jobbavgifter är exakta belopp och avrundas inte.
- Avrundningsregeln (steg och riktning) sparas med resultatet (`presented.roundingRule`).
- **Vilket av dem som blir den överenskomna försäljningen** (och därmed en ekonomisk affärshändelse) avgörs inte av motorn utan av kundordern, se avsnitt 8.6.

---

## 7. Grossistagenten och connectorerna

### 7.1 Strategiordning

1. Officiellt API/feed.
2. Prisfil, produktfeed, EDI eller annan tillåten strukturerad data.
3. Strukturerade anrop som den inloggade webbutiken själv gör, med sessionen ur valvet (vanlig HTTP, ingen webbläsare).
4. DOM/webbläsarautomation.
5. AI-agent som navigerar eller förstår sidan.
6. Visuell AI bara när strukturerad information saknas.

**Ordningen betyder billigast och säkrast först, inte minst viktigt.** Den autentiserade webbläsaragenten är en kärnfunktion (avsnitt 7.7), eftersom visionen är att fungera även mot grossister utan API. Men om en grossist erbjuder en bra prisfil eller ett API och det är tillåtet använder vi det.

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

**Grind A (ändrad i version 2).** Den frågar inte bara "kan grossisten integrera med oss?" utan också "hur fungerar webbutiken efter att en legitim kund loggat in?". Den har tre delar som går parallellt:

| Del | Innehåll | Beror på |
|-----|----------|----------|
| **A1: floristens svar** | `CHECKLISTA-PILOTGROSSIST.md`. Skärmdumpar (2–3) är *hjälp* för oss att förstå butiken, inte något arkitekturen eller slutprodukten beror på | Pilotflorist |
| **A2: fråga grossisten** | Mejl till grossisten om prisfil, feed, API, EDI, annan integration **och tillstånd** att läsa artiklar och priser automatiskt med kundens eget konto (avsnitt 18.3). Finns något bra används det | Annas (eller floristens) ja |
| **A3: teknisk undersökning (PoC, avsnitt 7.7)** | Hur fungerar inloggningen, sessionen och produktlistorna *i praktiken* med en legitim kund, inklusive vilka strukturerade anrop sidan själv gör | Legitim pilotåtkomst och att grossistens villkor är lästa |

**Vi är inte beroende av att grossisten ger oss API.** Visionen är att fungera även mot grossister som saknar det, genom en autentiserad webbläsaragent, *där kunden har legitim åtkomst och automatiseringen är tillåten*. Tillåtelsen är ett villkor, inte en formalitet (avsnitt 7.7 och 9).

**Skärmdump, CSV och prisfil är reservvägar** (de finns kvar och förblir synliga tills en riktig koppling fungerar). Slutupplevelsen är **ANSLUT GROSSIST → LOGGA IN → KLART**.

**Vi kringgår aldrig säkerhet eller åtkomstkontroller:** ingen CAPTCHA- eller MFA-kringgång, inga lösenord hos oss, ingen dold identitet (ingen förfalskad webbläsaridentitet, inga roterande adresser), ingen belastning utöver vad en vanlig kund skulle skapa, och avbryt direkt om grossisten säger nej.

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

### 7.7 Proof-of-concept: grossistagenten (MVP 1B)

**Syfte.** Prova den viktigaste tekniska hypotesen tidigt, utan att vänta på att kund-, jobb- och fakturasystemet är klart: *en florist loggar själv in hos sin riktiga grossist i en säker molnwebbläsare, och Buketträknarens agent kan sedan läsa verkliga artiklar och priser i den inloggade sessionen.* Det är ett **experiment, inte en produktionsfunktion.** Det byggs inte som en plattform.

**Startvillkor (alla ska vara uppfyllda).**
1. En pilotflorist med ett riktigt kundkonto har sagt ja till att prova, och vet att inloggningen sker i ett molnfönster (avsnitt 9 och 18.3).
2. Grossistens villkor är lästa. Om de förbjuder automatiserad åtkomst **stannar vi** (eller får ett skriftligt tillstånd). Min rekommendation är att *alltid* fråga grossisten före PoC:n (avsnitt 18.3), eftersom det är floristens affärsrelation och konto som står på spel.
3. Ett Cloudflare-konto där ett separat test-Worker får köra en webbläsare (gratisnivå räcker, avsnitt 10).

**De nio frågor PoC:n ska besvara.**

| # | Fråga | Godkänd när |
|---|-------|-------------|
| 1 | Kan floristen öppna grossistens *riktiga* inloggning i en säker molnwebbläsare? | Inloggningssidan visas och går att använda på telefon och dator |
| 2 | Kan floristen logga in själv (inklusive eventuell kod, sms eller BankID, som människan hanterar)? | Inloggat läge kan kännas igen deterministiskt (en markör på sidan) |
| 3 | Kan sessionen användas av vår agent efter inloggningen? | Agenten kan läsa en inloggad sida utan att be om ny inloggning |
| 4 | Kan agenten navigera till en produktlista eller produktsida? | Rätt sida nås utan gissande |
| 5 | Kan den läsa 10–20 verkliga produkter? | 10–20 produkter lästa, stickprov mot floristens syn |
| 6 | Kan den extrahera artikel-ID, namn, variant (längd/klass), pack och pris? | Fälten stämmer i stickprov. Valuta, momsstatus och tillgänglighet noteras om de visas. **Okänt förblir okänt** |
| 7 | Kan sessionen återanvändas säkert, om grossisten tillåter det? | Vi vet hur länge den lever (1 timme, nästa dag), och om återanvändning utan ny inloggning fungerar |
| 8 | Kan vi uppdatera ett urval produkter utan att skanna hela sajten? | N valda artikel-ID:n uppdateras direkt (sök- eller produktadress, eller sidans egna anrop) |
| 9 | Genomförs inga köp? | **Bevisas av konstruktionen:** koden saknar helt varukorgs- och köpfunktion, och en spärr nekar varje sidväxling, klick eller anrop som liknar varukorg, kassa eller beställning |

**Spelregler (hårda gränser, inte önskemål).**
- Bara ett legitimt, samtyckande kundkonto. Bara **läsning**. Inga skrivande anrop. Ingen varukorg.
- **Låg volym:** högst ca 100 sidhämtningar per körning, minst ca 2 sekunder mellan dem, inga parallella anrop, ingen genomsökning av hela sortimentet.
- **Ingen kringgång och ingen döljning:** inga CAPTCHA- eller MFA-försök, ingen förfalskad webbläsaridentitet, inga roterande adresser. Möts vi av CAPTCHA, spärr eller varning **avbryter vi** och rapporterar.
- **Inga lösenord hos oss.** Floristen skriver sina uppgifter i molnfönstret. Vi läser, sparar och loggar dem aldrig. Ärligt: tangenttrycken passerar webbläsartjänstens infrastruktur medan floristen skriver. Det ska stå i det samtycke hon ger, och hon kan byta lösenord efteråt om hon vill.
- **Cookies/session** hålls bara krypterat och tillfälligt (högst ett dygn i testet), raderas när testet är slut, och hamnar aldrig i git, loggar eller chatt.
- **Grossistens data är konfidentiell** (särskilt kundspecifika priser). PoC-resultat **sparas inte i repot.** Vi delar bara struktur (fältnamn, adressmönster) och ett fåtal stickprov som floristen godkänt.
- **Kostnadstak:** högst 1 timmes webbläsartid totalt (inom gratisnivån), **ingen AI** i PoC:n (extraktionen görs med fasta regler som vi tar fram i undersökningen). Valfritt: engångs AI-stöd för att förstå sidstrukturen, med mätning och tak på 2 USD, och bara på sanerad data.
- **Isolering:** egen katalog `poc/grossistagent/` och ett *separat* test-Worker. Rör inte `calc()`, `model.js`, `index.html`, `worker.js`, testerna eller PR #9. Driftsätts inte på produktionsadressen.

**Så går inloggningstestet till, utan att något lösenord når mig.**
1. Jag skriver och Anna (eller någon hon litar på) driftsätter test-Workern. Jag får aldrig floristens uppgifter, bara en länk till Workern när den är klar.
2. Anna eller floristen startar testet och får en **länk**. Länken öppnar grossistens *riktiga* inloggningssida i ett fönster som visar molnwebbläsaren (Live View).
3. **Floristen skriver sitt eget användarnamn, lösenord och eventuell kod i det fönstret.** Det skrivs aldrig i chatten, i en fil eller i repot, och det går inte via mig.
4. När inloggad markör syns tar vår kod över. Floristen kan följa med och avbryta när som helst.
5. Läsningen körs. Vi får tillbaka *rensad* JSON och en strukturbild. Sessionen stängs och raderas när testet är slut, och floristen kan logga ut och byta lösenord om hon vill.
6. Är floristen obekväm med att uppgifterna passerar en molntjänst finns reservvägen att *hon* kör ett litet program på sin egen dator, där inloggningen aldrig lämnar den. Det besvarar fråga 4–8 men inte 1–3, så det är en sämre test men en trygg start.

**Minsta möjliga konstruktion.** Ett engångs-Worker med fyra anrop, skyddade av en lång slumpad nyckel (ingen användarhantering): `start` (öppnar Live View mot grossistens inloggning och returnerar länk till floristen), `status` (inloggad eller inte), `read` (kör det fasta läsprogrammet och returnerar rensad JSON till oss), `end` (stänger och raderar sessionen). Ett smalt `BrowserSession`-gränssnitt (`open`, `waitForHuman`, `read`, `close`) så att leverantören kan bytas.

**Inspektionsläge (viktigt eftersom jag inte når grossistens sida härifrån).** Jag kan inte se sidstrukturen själv. PoC:n sparar därför en **sanerad strukturbild**: sidans uppbyggnad (taggar, klassnamn, rubriker), vilka JSON-anrop sidan gör (adressmönster, status, *fältnamn* men inte värden) och hur inloggningsmarkören ser ut. Inga cookies, inga rubriker med hemligheter, inga personuppgifter. Det räcker för att jag ska kunna skriva läsprogrammet utan att se sidan.

**Utfall och beslut.**

| Utfall | Betyder | Nästa steg |
|--------|---------|------------|
| 1–9 uppfyllda | Hypotesen håller | MVP 2 med webbläsarstrategin. Finns sidans egna JSON-anrop och sessionen kan återanvändas utanför webbläsaren väljs HTTP-läge (billigare), annars DOM-läge |
| 1–3 misslyckas (överlämning eller cookies) | Molnwebbläsare fungerar inte som tänkt | Prova en annan webbläsartjänst. Annars *assisterat läge* (en liten hjälpare på floristens egen dator). Annars prisfil eller import |
| 4–6 misslyckas | Går inte att läsa pålitligt | Undersök sidans egna anrop. Annars be grossisten om fil |
| 7 misslyckas | Sessionen kan inte återanvändas | Synk blir "florist loggar in och trycker". Anna avgör om det duger |
| CAPTCHA/spärr under läsning | Grossisten vill inte ha automatik | **Stopp.** Ingen kringgång. Fråga grossisten, annars fil |
| Villkor förbjuder | Inte tillåtet | **Stopp.** Skriftligt tillstånd eller bara fil |

**Resultatet** är en kort PoC-rapport (nio ja/nej/delvis med sanerade belägg) och ett beslut. **Storlek: S–M** efter att åtkomst finns. Jag lovar inga datum, eftersom den beror på floristen, grossisten och Cloudflare.

**Ingår inte:** katalogkörning, favoriter, erbjudanden, varukorg, flera butiker, valv i produktionskvalitet, självläkning, AI, konton. De hör till MVP 2 och senare.

---

## 8. Ekonomiska handlingar, affärshändelser och revision

### 8.1 Gränsen för agenten

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
7. **Revisionslogg** över varje godkännande och varje agentkörning (avsnitt 8.3).
8. **Överföring till ett ekonomisystem** (`AccountingConnector.submitInvoice`) kräver en godkänd version, och är en egen ekonomisk handling som agenten aldrig kan utlösa (avsnitt 8.5).

**Tester (se avsnitt 14):** "AI kan inte checka ut" körs mot en simulerad sida med en kassaknapp. Policymotorn måste neka klicket och verktygsytan får inte kunna uttrycka det. Dessutom ett kontrakttest som kräver att ingen connector exponerar ett köpkommando.

### 8.2 Planerat är inte faktiskt: nio separata steg

| # | Steg | Entitet | Ekonomisk händelse? | Skapas av | Ändras? |
|---|------|---------|---------------------|-----------|---------|
| 1 | **ESTIMATE**, kalkyl | `Event` + `Arrangement`, levande `PriceBreakdown` | Nej | floristen, kod | Fritt |
| 2 | **QUOTE**, offert | `QuoteSnapshot` (skickad) | Nej | floristen | Nej, ny version |
| 3 | **APPROVED CUSTOMER ORDER** | `CustomerOrder` | Nej (avtal, inte bokföring) | floristen registrerar kundens ja | Nej, ny version |
| 4 | **PLANNED PURCHASE** | `PurchasePlan` | Nej | kod | Fritt |
| 5 | **SUPPLIER CART** | `CartPreparation` | Nej | agenten | Ersätts |
| 6 | **ACTUAL PURCHASE** | `SupplierPurchase` | **Ja** | grossistens bekräftelse eller floristen | Append-only |
| 7 | **SUPPLIER INVOICE/RECEIPT** | `SupplierDocument` | **Ja** (ingående moms) | dokumentet | Append-only |
| 8 | **CUSTOMER INVOICE** | `CustomerInvoice` | **Ja** (utgående moms) | efter godkännande och sändning | Kredit, aldrig ändring |
| 9 | **PAYMENT** | `Payment` | **Ja** | floristen eller import | Append-only |

**Regler.**
- *Att Buketträknaren har sett att en ros kostar 14 kr hos grossisten är inte en bokförd kostnad.* En `PriceQuote` är en observation med ursprung, aldrig en `FinancialEvent`.
- *Att agenten lagt något i grossistens varukorg är inget inköp.* `CartPreparation` har inget läge som betyder "köpt" (invariant 7).
- **Hur uppstår ett `SupplierPurchase`?** Floristen beställer själv hos grossisten. Därefter antingen (a) läser agenten orderbekräftelsen eller orderhistoriken (en *läsande* förmåga, `orderHistory`), eller (b) floristen lägger in eller bifogar bekräftelsen manuellt (foto, PDF, vidarebefordrat mejl). Båda ger ett `SupplierPurchase` med `source`.
- **Plan mot faktiskt visas som skillnad**, inte som fel: "Planerat 3 × 20 Avalanche 60. Köpt 3 × 20, pris 14,50 i stället för 14,00."
- **Faktisk marginal** räknas bara av faktiska händelser (`CostAllocation`). Innan dess står det "beräknad".
- Ett gemensamt inköp för flera jobb fördelas av en deterministisk regel (till exempel efter behov), och fördelningen sparas.

### 8.3 Revisionsspår (audit trail)

Ekonomisk information måste gå att följa. Inget historiskt ekonomiskt värde skrivs över: ändring ger ny version, rättelse ger en ny rad som pekar på den gamla (`supersedes`), och dataåtkomstlagret saknar helt `UPDATE` och `DELETE` för ekonomiska tabeller (kontrolleras i test).

| Fråga som ska kunna besvaras | Svaret finns i |
|------------------------------|----------------|
| Var kom priset från? | `PriceBreakdown.inputs` → `PriceQuote`/`Offer`/`PriceOverride` (id, strategi, källa) |
| När hämtades det? | `fetchedAt`, `priceBasis.asOf` |
| Var det kampanj? | `Offer.promotionId`, `priceBasis.kind = offer` |
| Var det manuellt ändrat? | `PriceOverride` (vem, när, varför) |
| Vilken momssats och regelversion? | `InvoiceLine.vatRate`, `ruleSetVersion` |
| Vem godkände kundpriset? | `CustomerOrder.approvedBy/At` + offertens version |
| Vem godkände beställningen? | Vi ser att floristen granskade varukorgen (`reviewed`), men själva köpet sker hos grossisten. Beviset är `SupplierPurchase` (grossistens bekräftelse). Vi hävdar inte mer än så |
| Vilket faktiskt grossistinköp hör kostnaden till? | `CostAllocation` |
| När skapades och skickades fakturan? | `InvoiceDraft.createdAt/approvedAt`, `CustomerInvoice.sentAt` |

**Fakturanummer** tilldelas när fakturan *skickas* (blir en `CustomerInvoice`), ur butikens löpande serie utan luckor och utan återanvändning, om inte ekonomisystemet äger numreringen (`AccountingConnector.capabilities.ownsInvoiceNumbering`). Ett utkast som kastas förbrukar alltså inget nummer. **Kravet på löpnummer är inte verifierat** (avsnitt 18).

### 8.4 Versionerade ekonomiska regler

- **Ett enda ställe** känner till skatteregler: `TaxRules.resolve(taxCategory, taxPointDate) → { rate, ruleSetVersion } | unknown`. Okänt ger inget pris (invariant 11).
- Ett `TaxRuleSet` har version, giltighetstid, källa och `verifiedBy`/`verifiedAt`, och är oföränderligt när det publicerats. En ny regel är en ny version.
- **Frysning.** När en offert skickas, en kundorder godkänns eller en faktura godkänns kopieras *satsen och regelversionen* in på raden. En senare regeländring kan därför aldrig ändra ett gammalt dokument. Test: ändra regeln, räkna om, jämför, och kontrollera att de lagrade värdena är oförändrade.
- **Två slags regeluppsättningar i början.** `legacy-user-setting` (floristens egen momsinställning, som i dag, med hintet "Kontrollera med din redovisning") används av kalkylen i MVP 1A så att inget beteende ändras. Den är *inte verifierad* och **kan inte användas för en faktura.** Invariant: en faktura kan inte godkännas med en regelversion som saknar `verifiedAt`. En verifierad uppsättning tas fram av en människa mot Skatteverkets och lagens egna texter innan MVP 4.
- **Det som verifieras då** (arbetslista): momssats per slag av vara och tjänst, vilken tidpunkt som styr satsen, avrundningsnivå (per rad eller per sats), fakturans obligatoriska uppgifter, löpnummerkrav, förenklad faktura, kreditfaktura, förskott, arkivering och språk/valuta på fakturan. Skatteverkets sidor når jag inte härifrån (blockerade). Sökträffar pekar mot `skatteverket.se` för momssatser, "Momslagens regler om fakturering" och bokföring, och antyder 25 % för blommor **(ej verifierat)**.
- **Byggt (struktur):** `TaxRuleSet` (validering, frysning, versionsval, `assertVerified`) finns i `tax.js`. **Koden innehåller inga officiella svenska satser.** De satser som används i tester är markerade `fixture` (testdata), och `legacy-user-setting` speglar floristens egen inställning och kan aldrig vara verifierad. Se `docs/EKONOMIREGLER.md`.
- **AI verifierar inte regler.** AI kan på sin höjd föreslå vilken kategori en fri rad hör till. Floristen bekräftar.

### 8.5 AccountingConnector

**Mål:** kunna ansluta ett svenskt bokförings- eller fakturasystem utan att resten av Buketträknaren byggs om, och utan att vi bygger ett eget bokföringsprogram.

```
Faktiska händelser (FinancialEvent) ──► policymotor (kräver godkänd version) ──► AccountingConnector ──► ekonomisystem
                                                                                          ▲
                                                           två falska ekonomisystem i kontraktssviten bevisar utbytbarheten
```

| Förmåga | Anmärkning |
|---------|------------|
| `capabilities()`, `status()`, `connect()`/`disconnect()` | Behörighet via leverantörens egen inloggning (OAuth eller liknande). Aldrig lösenord hos oss |
| `prepareInvoice(invoice) → utkastRef` | Skapar ett *utkast* hos ekonomisystemet (om det stöds) |
| `submitInvoice(invoice, godkännandeId, idempotensnyckel) → externRef` | Kräver ett godkännande knutet till exakt version och totalsumma. Ändring ogiltigförklarar det. Samma idempotensnyckel ger aldrig dubbel registrering |
| `exportEvents(från, till) → paket` | Generell exportväg (filer). Första varianten |
| `readStatus(externRef)` | Läsande: betald, krediterad |
| Det som saknas med avsikt | Radera eller ändra bokförda poster. Rättelse sker med ny händelse |

- **Efter varje överföring läser vi tillbaka** det som registrerades och jämför summor och antal. Avvikelse är ett misslyckande och ett larm, aldrig tyst (samma princip som varukorgens återläsning).
- **Fel faller säkert:** fakturan förblir `approved` och *inte överförd*. Inget skickas om i tysthet.
- **Första varianten är en exportfil** (PDF, JSON/CSV) och ett e-postutkast. En svensk standard för överföring av bokföringsdata (SIE-filformatet) är en kandidat men **inte undersökt**. Vilket ekonomisystem som ska kopplas först avgörs utifrån pilotfloristens (och hennes redovisningskonsults) val. Kriterier: öppet API med OAuth, stöd för utkast, kunder och fakturor, moms per rad, testmiljö.
- **Ansvarsfördelning:** vi skapar *underlaget* (strukturerade händelser och momsunderlag). Ekonomisystemet gör den formella bokföringen och deklarationsunderlaget.

### 8.6 Beräknat, presenterat och överenskommet belopp (version 2.2)

Tre belopp är olika saker, och planen skriver ner vilket som blir en ekonomisk händelse:

```
BERÄKNAT      667,75 kr   exakta kalkylen (PricingEngine.calculated). Ändras aldrig av avrundning. Ingen affärshändelse.
PRESENTERAT   670,00 kr   det avrundade kundpriset (PricingEngine.presented). Det floristen säger till kunden. Ingen affärshändelse än.
ÖVERENSKOMMET 670,00 kr   det belopp kunden och floristen faktiskt kommit överens om. DET är försäljningen.
```

- `QuoteSnapshot` sparar **både** det beräknade och det presenterade priset, tillsammans med avrundningsregeln och regelversionen. En skickad offert ändras aldrig.
- `CustomerOrder` (kundens ja) fryser det **överenskomna beloppet** (`agreedIncVat`). Standardvärdet är det presenterade priset. Förhandlar floristen ett annat pris (till exempel 650 kr) är det *det* som är överenskommet, och skillnaden mot det presenterade registreras som en prisjustering (`priceAdjustment`) i stället för att skrivas över.
- **Fakturan och `FinancialEvent` bygger på det överenskomna beloppet**, med exkl. moms och moms härledda ur det (avsnitt 6.1). Avrundningsdifferensen (2,25 kr i exemplet) är en del av försäljningen och inte en egen affärshändelse.
- Det beräknade priset behålls som underlag för att förklara hur priset uppstod, och för att räkna fram faktisk marginal. Det blir aldrig en bokförd siffra.
- Att det överenskomna beloppet kan vara något annat än det presenterade är anledningen till att motorn inte själv avgör vad som är försäljningen.

**Byggt i version 2.3** (`workspace.js`: `createQuote`, `sendQuote`, `acceptQuote`, `cancelOrder`, `priceLevels`, `checkImmutability`):
- `createQuote` kräver ett fullständigt pris och fryser beräknat (exakt bråk) och presenterat (avrundat) pris per arrangemang, avrundningsregeln, regelversionen och om regeln är verifierad. En ny offertversion ersätter obekräftade tidigare.
- `acceptQuote` kräver vem som godkände. Det överenskomna priset gäller per styck och arrangemang, kan vara lägre eller högre än det presenterade, och delas på moms i samma proportion som det presenterade priset. Skillnaden mot presenterat och mot beräknat sparas med tecken.
- Offert och order är oföränderliga: bara status går framåt (`QUOTE_NEXT`, `ORDER_NEXT`), inget raderas, och `store.js` avvisar allt annat med `immutable`.
- Det överenskomna priset är *per arrangemang*. Ett förhandlat totalpris för hela jobbet är inte byggt.

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

**Villkor mot grossister.** Automatiserad inloggad åtkomst och varukorgsförberedelse kan strida mot villkor. **Skriftligt tillstånd eller tydligt tillåtande villkor krävs per grossist innan vi bygger `xhr`-, `browser`- eller `cart`-vägen för den i produktion.** PoC:n (avsnitt 7.7) är ett avgränsat, läsande, lågvolymigt test med floristens eget konto och hennes samtycke. Min rekommendation är ändå att fråga grossisten *före* PoC:n, eftersom det är floristens konto och affärsrelation som riskeras, inte vår.

**Ekonomiska uppgifter som personuppgifter och bokföringsmaterial (ej juridiskt verifierat).** Fakturor och kundregister innehåller personuppgifter, och bokföringsmaterial har lagstadgade krav på hur länge det ska sparas. Det krockar med rätten att radera uppgifter. Hur det löses (anonymisera kunden men behålla fakturan) avgörs med juridisk hjälp innan MVP 4, och raderingsrutinen ska inte byggas på gissning.

---

## 10. Användningsmätning och kostnad

### 10.1 Mätning från dag ett

```
meter({ shopId, kind, quantity, unit, connectionId?, correlationId })   ← ett enda anrop kring varje dyr operation
kind: browser_seconds · ai_input_tokens · ai_output_tokens · ai_call · supplier_sync · catalog_refresh ·
      live_price_check · cart_preparation · invoice_draft · storage_bytes · accounting_transfer
```
- Vi sparar **enheter** (sekunder, tokens), inte kronor. Prislistan läggs på i rapporten.
- **Mäts per butik, internt, aldrig visat för floristen** (inga tokens eller webbläsarminuter i gränssnittet): AI-kostnad, webbläsarminuter, synkkostnad, lagring, varukorgsförberedelser, antal grossistanslutningar (och senare ekonomiöverföringar).
- Dagliga summor per butik. **Mjuka och hårda tak per butik och månad** (en butik kan inte köra upp kostnaden). Brytare per butik och globalt.
- Mätningen är det som gör prissättningen i avsnitt 11 möjlig att kalibrera, och som skyddar piloten.

**Skydd mot en trasig connector eller agent (nytt i version 2).**

| Skydd | Vad det gör |
|-------|-------------|
| **Tak per körning** | Varje körning har högsta antal sidhämtningar, sekunder och AI-tokens. Överskrids det avbryts körningen och räknas som misslyckad |
| **Tak per butik och dygn/månad** | Hård gräns för webbläsartid och AI. Mjukt tak ger en vänlig notis till oss, hårt tak stoppar dyra operationer (inte kalkylen) |
| **Strömbrytare per connector** | Tre misslyckade körningar i rad eller en onormal kostnad stänger connectorn (`degraded`) och larmar. Inga automatiska omförsök i oändlighet, och backoff vid fel |
| **Global brytare** | Ett tryck stänger all webbläsar- och AI-användning |
| **Larm** | Notis (e-post) när en butik når 50 % och 80 % av sitt tak, och vid en kostnadsökning mot sitt eget snitt (till exempel 3 ×). Larmen går till oss, inte till floristen |
| **Leverantörens egna gränser** | Månadstak och larm hos AI-leverantören och i Cloudflare-kontot satta lägre än vad vi tål att förlora, som sista skydd utanför vår kod |
| **Test** | En falsk connector som loopar måste stoppas av taket innan kostnaden passerat en bestämd gräns (avsnitt 14) |

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
- **PoC:n (MVP 1B) kostar nästan ingenting:** högst 1 timmes webbläsartid (gratisnivån ger 10 minuter per dag, så den sprids över några dagar), ingen AI, ett separat test-Worker **(ej verifierat mot aktuell prissida)**.
- **Serverlöst och betala efter användning har företräde.** Vi köper ingen kapacitet innan kunderna finns. 1–3 florister ska gå att testa med mycket liten fast kostnad.
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

### 11.1 Vilken skalningsdimension är rättvisast? (version 2)

Annas utgångspunkt: floristen ska **inte straffas för att hon provar en extra bukettkalkyl**, en liten florist ska betala lite och en större mer, och en mycket liten florist ska vara lönsam även på en låg avgift. Arbetshypotesen för nivåerna står kvar: MICRO ca 99–199 kr, STUDIO ca 299–449 kr, PRO ca 699–899+ kr per månad.

| Dimension | Rättvis? | Hänger ihop med vår kostnad? | Begriplig för en florist? | Bedömning |
|-----------|----------|------------------------------|---------------------------|-----------|
| Antal kalkyler/buketter | Nej, den straffar att prova | Nästan inte alls (deterministisk, gratis) | Ja | **Avvisas.** Kalkylering är obegränsad |
| **Aktiva kundjobb per månad** | **Ja**, växer med floristens egen verksamhet | **Ja** (synk, priskontroller, varukorgar och fakturor hör till jobb) | **Ja** | **Primär dimension.** Ett jobb räknas som aktivt först när det blivit en *godkänd kundorder*, inte medan det bara planeras |
| Grossistanslutningar | Ja | **Ja**, starkaste enskilda kostnadsdrivaren (sessioner, synk, connectorunderhåll) | Ja | **Andra dimensionen** |
| Antal användare | Ja | Lite | Ja | **Tredje dimensionen** (följer verksamhetens storlek) |
| Synkfrekvens | Ja | Ja | **Nej, teknisk** | **Säljs inte.** Ingår som skälig användning per nivå (till exempel dagligen i Micro, flera per dag i Studio, per jobb i Pro) |
| Automatiska inköpsförberedelser (varukorgar) | Ja | Ja | Ja | **Ingår per nivå som skälig användning**, mjukt tak, kopplad till antalet jobb |
| Omsättning | Mest rättvis i princip | Svagt | Ja | **Inte nu.** Kräver att vi känner floristens omsättning och ger oförutsägbart pris. Kan bli en signal senare |
| Hög volym | Ja | Ja | Ja | **Klausul om skälig användning** i stället för en egen nivå |

**Rekommendation.** Nivåerna definieras av *aktiva kundjobb per månad*, *antal grossistanslutningar* och *antal användare*. Synkfrekvens och varukorgsförberedelser är inbyggda gränser för skälig användning som floristen sällan märker. **Toppar** (Alla hjärtans dag, Mors dag, bröllopssäsong) hanteras med en generös tolerans och ett snitt över några månader, så att en bra vecka aldrig ger en spärr mitt i ett kundsamtal. Gränserna är *mjuka*: en vänlig uppmaning att byta nivå, aldrig ett stopp för kalkyl eller för ett jobb som pågår.

**Lönsamhet för en mycket liten florist.** Uppskattad teknisk kostnad för MICRO är ca 0,6 USD (ca 6 kr) per månad med AI-sparande design, mot ett pris på 99–199 kr. Det som äter marginalen är därför inte tekniken utan **betalavgifter, support och juridik**, som jag inte har underlag för **(ej undersökt)**. Två saker avgör om MICRO går ihop: (1) att **AI aldrig ligger på den heta vägen** (i en AI-tung design kostar samma florist ca 9–36 USD per månad, mer än hela intäkten, avsnitt 10.2), och (2) att MICRO är *självbetjäning* utan personlig support. Fakturautkast och ekonomiöverföring (nya i version 2) är deterministiska och bedöms som små kostnadsposter, men **är inte mätta**.

**Mät internt, visa aldrig.** Samma mätning som i avsnitt 10.1 per butik avgör senare var gränserna ska ligga. Priset sätts först efter piloten, med verkliga siffror.

---

## 12. Vad av det befintliga som kan återanvändas, och vad som ska ändras

### 12.1 Återanvänds utan förändring (flyttas eller importeras bara)

| Del | Plats i dag | Not |
|-----|-------------|-----|
| **Kalkylmotorn** `calc()` och `indexList()` | `public/index.html` ~rad 452–540 | Flyttas **ordagrant** till en delad modul och förblir **referensmotor** (flyttal, som i dag). Den nya exakta `PricingEngine` jämförs mot den på de 145 tillstånden. Skyddas av 22 + 4 tester och differenstestet |
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
| `index.html` (1 509 rader) | Delas i moduler: lager för tillstånd, skärmar (Hem, Kunder, Jobb, Arrangemang, Inköp, Faktura, Grossist, Inställningar). Klassiska skript så att filläge fungerar | Går inte att bygga sju MVP-steg i en fil |
| `viewOf` och tillståndet | Byggs på `ArticleRef` i stället för arbetsartiklar. Lagring via ett gränssnitt (lokalt i MVP 1A, server från MVP 2) | Arrangemang pekar direkt på artiklar |
| `order` och `recipes` | Blir `Event` och `Arrangement` (befintlig order migreras till ett jobb "Min order" utan kund). Recept blir mallar | Nya domänobjekt |
| `settings` | Delas i butikens `PricingSettings` + överstyrningar per arrangemang + frakt per grossist | Briefens punkt 24, och frakt gäller per grossist |
| `products` + `matches` | Utfasas efter migrering. Nya rader använder `ArticleRef` | Sanningen är grossistens artikel |
| `ingestSupplierData` | Karantänläge per rad | Katalog på tusentals artiklar |
| `quotes`-kapning | Rollup till veckosammanfattning | Framtida kalkylpris |
| `verification: 'live'` | Döps om till `'supplier'` | Ordet vilseleder om färskhet |
| `settings.vatPct` (en global momssats) | Blir standardvärde för kategorierna i regeluppsättningen `legacy-user-setting`. Den gamla räkningen använder den som i dag | Ingen enskild momssats i arkitekturen. Inget beteende ändras i MVP 1A |
| `quotes`: `priceIncludesVat` och `unusableReason` | **Behålls oförändrade.** `purchaseAmount` (`Amounts`) läggs till som valfritt fält. Priser *inkl.* moms med bekräftad sats kan senare räknas till exkl. moms av `PricingEngine`. `viewOf` och den gamla vyn fortsätter vägra dem | Additivt. De befintliga testen om `vat_included` och `vat_unknown` fortsätter gälla |
| Prisen som tal (`pris`, `packPrice`) | Behålls i den gamla modellen och vyn. Den nya ekonomikoden använder `Money` och konverterar vid gränsen (`öre = avrunda(pris × 100)`, med kontroll att priset har högst två decimaler, annars avvisas det) | Flyttal bara kvar i det som redan bevisats |
| `worker.js` (en fil) | Modulär router, autentisering, butikskontext, mätningslager, AI-gateway | Multi-tenant och mätning |
| `/api/read` (direkt Anthropic-anrop) | Flyttas bakom `AIProvider` med mätning och tak | Byta leverantör |
| Katalog i samma lagring som arbetstillstånd | Eget lager | Mätt: ~2 MB och 29 ms per sparning vid 3 000 artiklar (se konsekvensanalysen) |

### 12.3 Nytt

Konton och butikskontext · dataåtkomstlager med butiksfilter · `Customer`, `Event`, `Arrangement`, `ArrangementItem`, `EventFee`, `QuoteSnapshot`, `CustomerOrder` · `PurchasePlan`, `PurchaseRequirement`, `CartPreparation`, `SubstitutionProposal` · `InvoiceDraft`, `CustomerInvoice` och **`AccountingConnector`** · **`Money`, `Amounts`, `TaxCategory`, `TaxRuleSet`/`TaxRules`, exakt `PricingEngine`, `PriceBreakdown`** · **`SupplierPurchase`, `CostAllocation`, `SupplierDocument`, `Payment`, `FinancialEvent`** · policymotor · valv · webbläsarorkestrering (PoC först) · AI-gateway · mätning med tak och strömbrytare · observability och hälsa · schemaläggare och påminnelser · `userArticles`/favoriter · `offers` · `facts`/`derived` · klassificering och sökning.

---

## 13. MVP 1A–6

Storlek: **S** (dagar), **M** (en till två veckor), **L** (flera veckor) för en utvecklare, grovt. Jag lovar inga datum.

### Ordning (Annas, version 2)

```
MVP 1A  Floristens kärna  ─────────────┐   parallellt. 1B startar när legitim åtkomst finns
MVP 1B  Grossistagent-PoC ─────────────┘   och grossistens villkor är lästa
                                         ▼
MVP 2   Riktig grossistkoppling   (strategin avgörs av 1B och Grind A)
   ▼
MVP 3   Inköp
   ▼
MVP 4   Faktura och ekonomiunderlag
   ▼
MVP 5   Grossistvarukorg   (agenten förbereder, floristen godkänner, ingen automatisk kassa)
   ▼
MVP 6   Intelligens
```

**Beroenden.** 1A beror inte på 1B. MVP 2 beror på 1B:s utfall och Grind A. MVP 3 beror på artiklar och priser från MVP 2 (och kan under tiden köras på manuell import). **MVP 4 beror inte på grossisten** och kan flyttas före MVP 3 om Anna vill ha fakturan tidigare. MVP 5 kräver grossistens tillstånd, policymotor och revisionslogg. Det jag skrev i version 1 om att dela inköp i 3a och 3b är borta: deterministiskt inköp är MVP 3 och agentens varukorg är MVP 5.

### MVP 1A: Floristens kärna (lokalt, ingen server)

**Mål:** en florist kan ta emot ett samtal, skapa kund och jobb, bygga arrangemang, få kundpriset direkt (med en korrekt uppdelning bakom) och spara och öppna jobbet.
**Ingår:** `Shop` (en, lokal), `Customer`, `Event`, `Arrangement`, `ArrangementItem`, `EventFee`, favoriter, `SupplierProduct` (egen prislista `conn_manual` och import), prisinställningar (påslag, arbete, avgifter, avrundning), packlogik, tillbehör som artiklar och fria rader, spara/öppna jobb, export/säkerhetskopia, skärmar för hem, kund, jobb och arrangemang. **Ekonomigrunden:** `Money`, `Amounts`, `TaxCategory`, `TaxRules` (regeluppsättningen `legacy-user-setting`), den exakta `PricingEngine` *bredvid* `calc()`, `PriceBreakdown`, kundpris inkl. moms med uppdelning på begäran, moms per rad.
**Förutsättning (refaktor):** `calc()` flyttas ordagrant till en delad modul, tillståndet får ett lagringsgränssnitt, befintlig order migreras till ett jobb.
**Ingår inte:** server, konton, grossistkoppling, inköp, faktura, **verifierad** momsregeluppsättning (kommer före MVP 4), euro och omräkning, erbjudanden, hållbarhet.
**Tester:** de befintliga 191 oförändrade, plus de ekonomitester som hör till 1A i avsnitt 14, plus ett differenstest mellan den nya motorn och `calc()`.
**Klart när:** en florist kan göra "Emma & Johan"-flödet med påhittade artiklar, den exakta uppdelningen summerar exakt, den nya motorn ger samma kundpris som `calc()` för de 145 tillstånden (varje avvikelse är utredd och förklarad), och inget gammalt beteende är ändrat.
**Storlek:** L.

**Status 2026-10-07: de två första tekniska stegen är byggda (inga skärmändringar).** Steg 1: `money.js` (`Money`, exakta bråk, avrundning, procentsatser), `amounts.js` (`Amounts`, `costBasis`), `tax.js` (`TaxRuleSet`-struktur, `resolveRate`, `freezeRate`, `assertVerified`, regeluppsättningen `legacy-user-setting`) och `pricing.js` (exakt `PricingEngine`: framåt, baklänges, jobb, prisstatus, kundtyp). **Steg 2:** `purchase.js` (hela förpackningar, delning mellan arrangemang, hemmalager och fraktfördelning i exakt aritmetik), `items.js` (`ArrangementItem` med källmodellen `SUPPLIER`/`OWN_STOCK`/`HOME_GROWN`/`MANUAL`, `requiresPurchase`, `STANDARD_MARKUP`/`FIXED_SALE_PRICE`), `workspace.js` (`Customer`, `Event`, `Arrangement`, `ArrangementItem`, `priceEvent`, `purchaseNeeds`) och `store.js` (lagringsgränssnitt med minnes- och localStorage-adapter, atomära ändringar, konfliktupptäckt). Motorn har fått fast kundpris, momskategori per rad och uppdelningen beräknat/presenterat pris. `index.html` laddar inget av detta än, och `calc()` är orörd som referensmotor. Reglerna och vad som är testdata står i `docs/EKONOMIREGLER.md`. **Kvar i 1A:** koppla arbetsytan till skärmarna (en liten adapter från `model.js` till katalogen i `priceEvent`), flytta befintlig order till ett jobb "Min order", `QuoteSnapshot` och `CustomerOrder`, skärmar för hem, kund, jobb och arrangemang med `[+ EGET TILLÄGG]`, spara/öppna jobb med lagringsgränssnittet.

**Status 2026-10-07 (steg 3, version 2.3): bryggan, offert/kundorder och en minimal jobbskärm är byggda.**
- `bridge.js`: den nuvarande prislistan blir katalog (pris som saknas är `null`, ett pris som skrevs idag är `MANUAL` = ✓, annat `STALE` = ≈), de gamla inställningarna speglas åt ett håll, och den nuvarande ordern flyttas **en enda gång** till jobbet "Min order" (idempotent, allt eller inget, den gamla vyn rörs aldrig). Vägen tillbaka (`legacyOrderFromWorkspace`) ger tillbaka ordern i den gamla formen och redovisar det som inte kan uttryckas där. Differenstest mot `calc()` i 144 av 145 tillstånd och rundtur i alla 144.
- `workspace.js`/`store.js`: `QuoteSnapshot` och `CustomerOrder` (avsnitt 8.6), `updatePricing`.
- `jobs-ui.js` + en flik **Jobb** i `index.html`: skapa kund och jobb, skapa arrangemang, lägga till blomma ur prislistan, lägga till eget tillägg (standardpåslag, fast pris med/utan moms eller "ingår"), ange arbete, se kundpriset (≈/✓, exkl. moms + moms för företag), och öppna igen. Sparar automatiskt ("Sparat ✓"). Ingen skärm för offert eller kundorder än, inga favoriter, ingen knapp som skriver till den gamla ordern. Går något fel i fliken påverkas inte de andra flikarna.
- **Kvar i 1A:** knappar för offert och "kunden sa ja", favoriter (♡), export/säkerhetskopia av jobben, ett förhandlat totalpris, fler jobbsättningar (leveransavgifter m.m. i skärmen), och en verifierad momsregeluppsättning före MVP 4.

**Låser 1A oss inför molnwebbläsaragenten? Nej.** 1A rör grossistvärlden bara via `conn_manual` och `SupplierProduct`/`PriceQuote`, som redan har fälten som en riktig koppling behöver (`rawAttributes`, `facts`, valfritt `purchaseAmount`, `currency`, momsstatus, pack). Allt PoC:n hittar läggs till *additivt* (samma mönster som migreringen, som är bevisad), så att resultatet kan ändra en connector men inte arrangemang, kalkyl eller faktura. En artikel identifieras av ett ogenomskinligt `supplierProductId` plus attribut, aldrig av antagandet att en längd är ett eget artikelnummer.

### MVP 1B: Grossistagent-PoC (parallellt)

Se avsnitt 7.7 för nio frågor, spelregler, konstruktion och utfall. **Mål:** bevisa eller motbevisa att en florist kan logga in själv i en säker molnwebbläsare, och att vår agent sedan kan läsa verkliga artiklar och priser i den inloggade sessionen, utan att något köp sker.
**Start:** legitim pilotåtkomst, floristens samtycke, grossistens villkor lästa (helst grossistens ja).
**Ingår inte:** något produktionskod, katalogkörning, favoriter, varukorg, konton, AI, valv i produktionskvalitet.
**Klart när:** de nio frågorna är besvarade i en kort rapport och ett beslut är taget om MVP 2:s strategi.
**Storlek:** S–M.

### MVP 2: Riktig grossistkoppling (Blomstergrossisten i Uppsala)

**Ingår:** Grind A avslutad, konton och butiksisolering (minsta möjliga), servern (D1, valv), den första adaptern (vanlig kod med fixturer, billigaste metod som fungerar enligt PoC:n), katalog, favoriter, priser, tillgänglighet och erbjudanden *där datan finns*, **riktad synk** (bara artiklar som används), snapshot med färskhetstext, mätning med tak och strömbrytare, upptäckt och säker nedtrappning, AI-gateway med klassificering (regler först).
**Ingår inte:** varukorg, faktura, självläkning, hållbarhetsfilter.
**Tester:** leverantörsidentitet (Avalanche 50 ≠ 60), favoriter, gammalt kontra verifierat pris, erbjudandets giltighet, framtida event ignorerar kortvarigt erbjudande, manuell override, saknad leverantörsprodukt, isolering mellan butiker, connectorfel fallerar säkert, kontraktssvit för adaptern, kostnadstak.
**Klart när:** en riktig florist ansluter (ANSLUT → LOGGA IN → KLART), ser sitt sortiment och sina favoriter med färska priser och räknar en bukett på dem.
**Storlek:** L.

### MVP 3: Inköp

**Ingår:** `PurchaseRequirement` per exakt artikel, **summering över alla arrangemang** i ett jobb (och därefter flera jobb med samma leveransdag och grossist), packoptimering, inköpslista, **aktuell pris- och tillgänglighetskontroll** av de använda artiklarna (läsande), påminnelse om beställ-senast-tid. *Ingen agent skriver något.*
**Ingår inte:** varukorg, automatiskt köp, lager (utom "har hemma"), optimering mellan grossister.
**Tester:** aggregerat inköp över flera arrangemang och jobb, packoptimering, ändrat pris och slutsåld artikel vid kontroll, planerat inköp är inget faktiskt inköp.
**Storlek:** M.

### MVP 4: Faktura och ekonomiunderlag

**Före start (människa, inte kod):** en verifierad `TaxRuleSet` och en genomgång av fakturakraven mot Skatteverkets och lagens texter, helst med en redovisningskonsult (avsnitt 8.4 och 18).
**Ingår:** `InvoiceDraft` med full ekonomisk information (avsnitt 4.2), kundens namn och e-post ur `Customer`, moms per rad och sammanfattning per sats, granskning, godkännande, fakturanummer vid skickande, `CustomerInvoice`, PDF och e-postutkast, **`AccountingConnector`-gränssnittet** med exportfil som första variant och två falska ekonomisystem i kontraktssviten, `SupplierPurchase` (manuell inmatning eller läst bekräftelse), `CostAllocation`, `SupplierDocument`, `FinancialEvent`, revisionsspår.
**Ingår inte:** eget bokföringsprogram, momsdeklaration, betalintegration, påminnelser, e-faktura. **Kreditfaktura** byggs sist i MVP 4 om utrymme finns. Annars rättas fel utanför appen och det står tydligt.
**Tester:** alla ekonomitester i avsnitt 14, inklusive att en historisk faktura inte ändras när regler eller inställningar ändras.
**Storlek:** M–L.

### MVP 5: Grossistvarukorg

**Ingår:** agenten öppnar floristens autentiserade session, hittar exakt artikel, kontrollerar pris och tillgänglighet, räknar rätt antal grossistförpackningar, lägger dem i varukorgen, **läser tillbaka korgen och jämför mot planen**, och **stannar**. Visar "BESTÄLLNING KLAR FÖR GRANSKNING" (artiklar, antal, pack, pris, totalsumma, problem och ersättare). Floristen granskar och gör det bindande godkännandet hos grossisten. **Ingen automatisk kassa, aldrig.**
**Krav före start:** grossistens tillstånd, policymotor, att `cart` är aktiverad för connectorversionen av en människa, revisionslogg.
**Tester:** varukorgens kvantiteter stämmer med planen, **AI kan inte checka ut**, ersättning kräver godkännande, varukorg är inget faktiskt inköp, fail-safe vid connectorfel.
**Storlek:** L.

### MVP 6: Intelligens

Hållbarhet (svenskodlat, närodlat, ekologiskt, säsong, certifieringar, **bara där datan finns**), ersättare, historiska prisintervall och estimat, AI-bukettförslag, optimering över jobb och lager och överskott där det är meningsfullt. **Vart och ett byggs först när dess data finns och dess gräns är bestämd.** Ingen byggs på förhand.

---

## 14. Tester

Alla befintliga regressionstester (191) behålls oförändrade och körs i varje MVP. Differenstestet mot den gamla appen gäller så länge den gamla räkningen finns kvar. **Ingen produktionskod ändras för att få ett gammalt test att passera.**

### 14.1 Funktion och produktregler

| Test | MVP | Nivå |
|------|-----|------|
| Påslag, arbetsavgift, tillbehör, avgifter | 1A | enhet |
| Packkvantitet (83 behövs, 20-pack → 5 × 20 = 100, 17 över) | 1A | enhet |
| Kundpris (exemplet 186 + 120 % + 125 = 534,20 före moms och 670 kr inkl. moms med testsats 25 % och steg 5 kr) | 1A | enhet |
| Kund → jobb, flera arrangemang | 1A | enhet, integration |
| Sparat och öppnat jobb ger samma kalkyl | 1A | integration |
| Avalanche 50 och 60 hålls åtskilda | 2 | enhet, kontrakt |
| Favoriter (lägg till, ta bort, sök hela, tillfällig artikel) | 2 | enhet, UI |
| Leverantörsidentitet (SKU bevaras genom hela kedjan) | 2 | enhet |
| Gammalt kontra verifierat pris, aldrig "live" för gammalt | 2 | enhet, UI |
| Erbjudandets giltighet (start, slut, okänt slut = samma dag) | 2 | enhet |
| Framtida event ignorerar kortvarigt erbjudande | 2 | enhet |
| Manuell override vinner | 1A, 2 | enhet |
| Saknad leverantörsprodukt | 2 | enhet |
| **Egna tillägg** (sidenband, dahlia från egen trädgård, antik vas) ändrar kundpriset direkt men skapar inget inköpsbehov | 1A | enhet, integration |
| Rad avgör själv om den ska beställas (`requiresPurchase`). Bara grossistrader hamnar i inköpsplanen | 1A | enhet |
| Rad utan `SupplierProduct` fungerar (`OWN_STOCK`, `HOME_GROWN`, `MANUAL`) | 1A | enhet |
| **Noll inköpskostnad ≠ noll värde**: fast kundpris och kalkylkostnad, noll kalkylkostnad godtas inte tyst | 1A | enhet |
| Fast kundpris med och utan moms, och 0 kr som uttryckligt val | 1A | enhet |
| Moms per rad oberoende av källa, och okänd kategori ger inget pris | 1A | enhet |
| **Beräknat och presenterat pris behålls båda**, och det beräknade ändras inte av avrundningsregeln | 1A | enhet, egenskapstest |
| Exakt förpackningslogik och fraktfördelning mot `calc()` på de 145 tillstånden | 1A | differenstest |
| Lagringsgränssnitt: atomär ändring, trasig och full lagring, konflikt mellan flikar, egen nyckel | 1A | enhet |
| **Isolering mellan butiker** (varje entitet, varje väg) | 2 | integration |
| Connectorfel fallerar säkert (ingen skrivande handling, snapshot med ålder) | 2 | integration |
| Aggregerat inköp över arrangemang och jobb | 3 | enhet |
| Ersättning kräver godkännande | 5 | enhet, integration |
| Varukorgens kvantiteter stämmer med planen | 5 | integration |
| **AI kan inte checka ut** (policymotor + verktygsyta + kontrakt) | 5 (spärren även i PoC) | enhet, kontrakt |
| Svenskodlat ≠ ekologiskt, närodlat ≠ ekologiskt, okänd hållbarhet förblir okänd | 6 | enhet |

### 14.2 Ekonomi (nytt i version 2)

| Test | MVP | Anmärkning |
|------|-----|------------|
| exkl. moms → moms → inkl. moms | 1A | exakt, flera satser |
| inkl. moms → exkl. moms | 1A | `exVat + vat = incVat` alltid |
| Avrundning | 1A | namngivna ställen, gränsfall (exakt halv, ett öre under/över, `186 ÷ 12`, `100 ÷ 3`) |
| **Påslag ≠ marginal** | 1A | 120 % påslag = 54,5 % marginal. 50 % marginal = 100 % påslag. 100 % marginal avvisas. Mutationstest som byter dem måste fångas |
| Arbete (fast avgift och minuter × timpris, utan påslag) | 1A | |
| Tillbehör | 1A | samma packlogik |
| Leverans- och övriga avgifter | 1A | egen `taxCategory`, utan påslag |
| Manuell override | 1A, 2 | vinner, loggas med vem och när |
| Försäljningsmoms (utgående) | 1A, 4 | |
| Inköpsmoms (ingående) enligt dokument | 4 | ur `SupplierDocument`, inte ur regelverket |
| **Flera momssatser på samma faktura** | 4 (motorn testas med falska satser i 1A) | |
| Fakturaradernas totaler | 4 | |
| Momssammanfattning per sats | 4 | summan stämmer med raderna |
| **Planerat inköp är inte faktiskt inköp** | 3, 4 | `PurchasePlan` skapar noll `FinancialEvent` |
| **Leverantörens varukorg är inte faktiskt inköp** | 5 | `CartPreparation` skapar noll `FinancialEvent` |
| **Fakturautkast är inte skickad faktura** | 4 | utkast har inget nummer, skapar ingen händelse |
| **Historisk faktura ändras inte när regler eller inställningar ändras** | 4 | ändra regeluppsättning och påslag, räkna om, lagrade värden oförändrade |
| Regelns ursprung och version följer med | 4 | varje rad har `ruleSetVersion`. Saknad regel ger inget pris |
| En faktura kan inte godkännas med en overifierad regeluppsättning (`legacy-user-setting`) | 4 | |
| **Inga flyttal i `Money`** | 1A | statisk kontroll plus 1 000 slumpade fall mot ett bråkfacit |
| **Differenstest ny motor mot `calc()`** | 1A | 145 tillstånd. Varje avvikelse utreds och förklaras |
| Egenskapstest: summa av rader per sats = momssammanfattning, överallt | 1A, 4 | slumpade rader |
| Ekonomitabeller är append-only | 4 | försök att uppdatera eller radera avvisas av lagret |
| Fakturanummer löpande, utan luckor eller återanvändning | 4 | om kravet bekräftas |
| `AccountingConnector`-kontraktssvit med två falska system | 4 | |
| Överföring kräver godkänd version och totalsumma. Ändring ogiltigförklarar | 4 | |
| Samma idempotensnyckel ger ingen dubbel registrering | 4 | |
| Återläsning med avvikande summa räknas som misslyckande | 4 | |
| Fel i ekonomisystem ger *inte överförd*, aldrig tyst | 4 | |

### 14.3 Drift, säkerhet och PoC

| Test | MVP | Nivå |
|------|-----|------|
| Kostnadstak per körning, per butik och per connector stoppar en dyr operation | 1B (tak), 2 | enhet |
| En falsk connector som loopar stoppas av strömbrytaren före gränsen | 2 | integration |
| Mätning registrerar varje dyr operation | 2 | enhet |
| PoC-spärr nekar adress, klick och anrop som liknar varukorg, kassa och beställning, och icke-läsande anrop | 1B | enhet mot simulerad sida |
| Lösenord och cookies hamnar aldrig i loggar eller utdata (kontrolleras med en kanarie-sträng) | 1B | enhet |
| Okänd eller saknad data förblir okänd (pris, moms, valuta, tillgänglighet) | 1B, 2 | enhet |

---

## 15. Vad vi absolut inte bygger än

1. **En generell fjärrwebbläsarplattform.** PoC:n (avsnitt 7.7) är ett avgränsat experiment i en egen katalog, inte en plattform. Ingen automatisk inloggning i produktion före MVP 2 och Grind A.
2. Varukorgsförberedelse **innan** MVP 5 och innan grossistens tillstånd, policymotor och revisionslogg finns.
3. **Allt som slutför ett köp.** Det ska inte finnas, varken i PoC:n eller senare.
4. Självläkande reparationer som släpps automatiskt (bara upptäckt och nedtrappning i början).
5. En deklarativ connectorbeskrivning och generell exekutor (regeln om tre).
6. AI-bukettförslag, hållbar optimering, cross-event-optimering och prognos (MVP 6).
7. Lager (utom "har hemma").
8. Betalsystem och abonnemangshantering.
9. **Ett eget bokföringsprogram, momsdeklaration, bankkoppling och betalningsavstämning.** `AccountingConnector` är ett gränssnitt och en exportfil, inte ett bokföringssystem. Ingen faktureringsintegration byggs före MVP 4, och ingen förrän ett ekonomisystem är valt.
10. Geokodning och avståndsberäkning.
11. Hållbarhetsprocent och sammanfattningar som kräver täckningsdata.
12. Kundportal, offert som kunden godkänner online, flera användare med avancerade roller.
13. Marknadsplats, flera länder, **flera valutor och omräkning** (beslut 5 gäller fortfarande för valuta. För moms är det ändrat, avsnitt 2).
14. Egen app i app-butik.
15. **E-faktura (till exempel Peppol), förskottsfakturor, omvänd skattskyldighet och momsfria kundtyper.** Modellen har plats för dem (`taxTreatment`), men bara `standard` implementeras.
16. **Automatisk överföring till ekonomisystem utan floristens godkännande.** Aldrig.
17. Att visa floristen tekniska mått (tokens, webbläsarminuter). De mäts, men visas aldrig.

---

## 16. Luckor i produktmodellen sett med en floristens ögon

| Lucka | Förslag | Prio |
|-------|---------|------|
| **Offert med giltighetstid, anbetalning och ändringshistorik** när kunden ändrar sig. "Kan vi lägga till fem rosor?" ska ge en ny version, och vi ska se skillnaden mot den förra | `QuoteSnapshot` med versioner, giltighet | MVP 1A–4 |
| **Personal ska inte alltid se inköpspris och marginal** | Roll `staff` med dold kostnadsvy | MVP 2 |
| **Svinn och bearbetning** (putsa, skadade stjälkar, ofta 5–10 %) | Svinnpåslag på stjälkar, en inställning | MVP 1A |
| **Övriga kostnader** (vaser, skum, hyra av båge, resor, personal på plats) | Fria kostnadsrader och `EventFee`, moms per radtyp | MVP 1A |
| **Recept som mönster.** "2 vita rosor 50–60 cm" fungerar när en artikel är slut. Exakta artiklar gör det inte | Receptplatser (färg, släkte, längdspann) som löses mot en artikel vid räkning, med val av florist | MVP 6 |
| **Beställningstid och leveransdagar** per grossist | `SupplierConnection.orderCutoff` och leveransschema. Påminnelse "Dags att beställa" | MVP 3 |
| **Förbeställning av odlare för stora event** och toppdagar (Alla hjärtans dag, Mors dag) | Flagga för toppdagar, prisvarning. Förbeställning är en separat grossistväg | senare |
| **`orderMultiple` och frakt per grossist** | Motorn läser dem. Frakt flyttas till anslutningen | MVP 3 |
| **Faktiskt inköp mot plan** (grossistens bekräftelse, kreditnotor, skadad vara) | `SupplierPurchase` (manuell inmatning eller läst bekräftelse), `CostAllocation`, visa faktisk marginal. Avvikelse mot plan visas som skillnad | MVP 4 (manuellt), senare (läst automatiskt) |
| **Pooling ändrar marginal, inte offert** | Visa som "faktisk marginal" när faktiskt inköp finns | senare |
| **Arbetstid på plats** (montering, resa) | `EventFee` och arbetsrader. Tidsregistrering senare | MVP 1A/senare |
| **Andra inköpskällor** (lokal odlare, egen odling, torg) | `conn_manual` med egna fakta märkta "enligt dig" | MVP 1A |
| **Foton och inspiration** | `imageRef` på arrangemang, miniatyrer på artiklar | MVP 2+ |
| **Offline i butik och på plats** | Lokal cache och köad synk. **Konflikter** när två enheter ändrar samma jobb: sista skrivning per fält med tydlig varning | MVP 2 |
| **Företag eller privatperson som kund** (moms, fakturavillkor) | Kundtyp på `Customer` (fältet finns från 1A), momsbehandling `standard` först | MVP 1A (fält), MVP 4 |
| **Flera jobb samma dag med olika leveransdag** | Ett `Event` = ett inköpstillfälle. Flera jobb samordnas i `PurchasePlan` | MVP 3 |
| **Påminnelser** ("Dags att beställa Emma & Johans blommor") | Schemaläggare och notis (webbpush eller e-post) | MVP 3 |
| **Rättelse av en skickad faktura** (fel pris, kunden ändrar sig efter fakturering) | Kreditfaktura och ny faktura, aldrig ändring. Utan det rättar floristen utanför appen | MVP 4 (sist) |
| **Anbetalning och förskott** (bröllop betalas ofta i delar) | `Payment` kan registreras mot en kundorder. Momsbehandling av förskott **ej undersökt** och byggs inte | senare, kräver verifierade regler |
| **Obetald faktura och kundförlust** | Betalstatus finns via `Payment`. Påminnelser och kundförlust byggs inte | senare |
| **Retur, skadad vara och kredit från grossisten** | `SupplierDocument` av typ `credit` minskar faktisk kostnad. Kreditering hos grossisten är floristens handling, inte vår | MVP 4 |
| **Bokföringsmaterial ska sparas, personuppgifter ska kunna raderas** | Anonymisera kunden men behåll fakturan. Avgörs juridiskt före MVP 4 **(ej verifierat)** | före MVP 4 |
| **Redovisningskonsulten** behöver ofta se underlaget | Roll `accountant` med läsrätt till faktiska händelser och export, aldrig till inköpspris för annat | MVP 4 |
| **Fakturaspråk och valuta** | SEK och svenska först. Annat byggs inte | senare |
| **Mina material**: samma egna saker används ofta (sidenband, oasis, vas, cellofan, tråd, egen eucalyptus) | Spara ett eget tillägg och återanvänd det. `materialRef` och `materials` finns som reserverade platser (avsnitt 4.5). Ingen lagerhantering | senare i MVP 1A eller 2 |
| **Överblivet material från tidigare inköp** blir egna material nästa gång | Källan `LEFTOVER` är reserverad men inte aktiverad. Lager byggs inte | MVP 6 |

---

## 17. Tekniska risker

| Risk | Allvar | Åtgärd |
|------|--------|--------|
| **Grossistens tillstånd** till automatiserad åtkomst och varukorg saknas, eller villkoren förbjuder det | Mycket hög | Grind A. Bygg inte `xhr`/`browser`/`cart` utan skriftligt tillstånd. Faller tillbaka på prisfil och manuell import |
| **Sessioner är nycklar till grossistkonton** | Hög | Valv, kryptering, ingen köpförmåga i verktygen, policymotor |
| **Hela sortimentet går inte att lista** eller priser syns bara per produktsida | Hög (beror på grossist) | `catalogEnumeration` och `bulkPrices` som förmågor, sökbaserad onboarding, priser bara för använda artiklar |
| **Webbläsare i molnet: cookie-överlämning och sessionsåteranvändning inte bevisade** | Hög | **PoC (MVP 1B, avsnitt 7.7)** innan MVP 2:s arkitektur låses. Smalt `BrowserSession`-gränssnitt, reservvägar (annan tjänst, assisterat läge, prisfil) |
| **PoC:n skadar floristens relation eller konto hos grossisten** (spärr, varning, kontostängning) | Hög | Fråga grossisten före, läsande och låg volym, ingen kringgång, avbryt vid första varning, floristens skriftliga samtycke |
| **Fel moms eller felaktig avrundning på en faktura** | Hög | Exakt aritmetik, `TaxRules` som verifierad data, regelversion frusen på dokumentet, ekonomitester och differenstest, ingen AI i beräkningen |
| **Regler ändras** (momssatser, fakturakrav) | Medel | Regler som versionerade data, mänsklig verifiering mot Skatteverket vid varje ändring, gamla dokument oförändrade |
| **Planerat och faktiskt blandas ihop** (en sedd kostnad blir "bokförd") | Hög | Nio separata steg, bara faktiska händelser skapar `FinancialEvent`, test per gräns |
| **Låsning mot ett ekonomisystem** | Medel | `AccountingConnector` med två falska system i kontraktssviten, exportfil först |
| **Bokföringskrav och radering av personuppgifter krockar** | Medel | Juridisk bedömning före MVP 4, anonymisera kund men behåll faktura |
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

1. **Godkänn riktningen**, särskilt: arrangemang pekar direkt på artiklar, Annas MVP-ordning (1A + 1B parallellt → 2 → 3 → 4 → 5 → 6), att varukorgsförmågan är en egen grind, och att PoC:n är ett avgränsat experiment.
2. **Namn:** `Shop`, `Event` (UI "Jobb"), `Arrangement`. Rekommenderas.
3. **MVP 1A lokalt först** (ingen server och inga konton förrän MVP 2). Rekommenderas.
4. **Databas:** D1 med dataåtkomstlager och isoleringstester. Rekommenderas framför en Durable Object per butik.
5. **Webbläsare:** PoC först (MVP 1B) med Cloudflare Browser Run som första kandidat och ett smalt `BrowserSession`-gränssnitt. Arkitekturen för MVP 2 låses först efter PoC:n.
6. **AI-leverantör:** Claude som första adapter bakom `AIProvider`, billig modellnivå som standard.
7. **Pengar:** heltal i öre och exakta bråk i beräkning, ingen flyttalsaritmetik i ny ekonomikod. `calc()` blir referensmotor. Rekommenderas.
8. **Riktning vid avrundning:** det avrundade kundpriset inkl. moms är sanningen, och exkl. moms och moms härleds ur det så att de summerar exakt (avsnitt 6.1). Rekommenderas.
9. **Momsavrundning per rad eller per sats:** avgörs först när reglerna verifierats (modellen stöder båda). Väntar.
10. **Fakturanummer:** tilldelas vid skickande ur butikens löpande serie, om inte ekonomisystemet äger numreringen. Rekommenderas, kravet är ej verifierat.
11. **Första ekonomiöverföringen:** exportfil och e-postutkast. Ekonomisystem väljs tillsammans med pilotfloristens redovisningskonsult.
12. **Förbeställning av odlare** (grossisten erbjuder det) är en separat väg och byggs inte nu.
13. ~~Räkneexemplet~~ **Avgjort av Anna:** 534 kr var ett pedagogiskt exempel, inte en regel. Exemplet är rättat i planen och motorn är inte anpassad efter det.
14. **Fast kundpris för egna tillägg:** i ett framtida gränssnitt anges priset **inkl. moms** för privatkund och exkl. moms för företagskund. Modellen kräver att det anges uttryckligen (`inc` eller `ex`), så inget gissas. Rekommenderas.
15. **Vilket belopp som är den överenskomna försäljningen:** standard är det presenterade (avrundade) priset, och floristen kan förhandla ett annat belopp som då registreras som en prisjustering (avsnitt 8.6). Rekommenderas.
16. **Mina material** byggs efter att egna tillägg fungerar i skärmarna, och utan lagerhantering. Rekommenderas.

### 18.2 Innan MVP 1A (kan börja direkt vid godkännande)

1. **Ditt godkännande** av planen och ordningen, eller ändringar.
2. ~~Besked på räkneexemplet~~ Avgjort (punkt 13 ovan).
3. **Ja till att `calc()` ligger kvar som referensmotor** och att den nya exakta motorn byggs *bredvid* den och bevisas mot den på de 145 tillstånden.

Inget annat behövs från dig för 1A.

### 18.3 Innan MVP 1B (PoC:n mot Blomstergrossisten i Uppsala)

1. **En pilotflorist med ett riktigt kundkonto hos grossisten** och hennes uttryckliga ja till ett begränsat läsande test. Jag skriver gärna en kort samtyckestext på vanlig svenska.
2. **Grossistens villkor lästa** (länk eller kopia). Förbjuder de automatiserad åtkomst stannar vi.
3. **Mejl till Blomstergrossisten före PoC:n (rekommenderas starkt).** Jag skriver utkastet, du eller floristen skickar det. Frågor:
   1. Finns prisfil, feed, API, EDI eller annan integration för kunder? I så fall format, kostnad och hur man ansöker.
   2. Får en kund läsa artiklar, priser, tillgänglighet och erbjudanden **automatiskt** med sitt eget konto, för eget bruk? Under vilka villkor (hur ofta, vilka tider, hur snabbt)?
   3. Vill ni att sådan trafik identifieras eller sker på särskilt sätt?
   4. Hur länge lever en inloggning? Finns tvåstegsverifiering, och kan en inloggad session återanvändas?
   5. Går hela sortimentet att lista (artikelnummer, längd, kvalitet, förpackning, ursprung, pris med eller utan moms)?
   6. *(Senare, för MVP 5)* Får ett program lägga varor i kundens varukorg utan att slutföra köpet? Köpet görs alltid av kunden.
   7. En teknisk kontaktperson.
4. **Ett Cloudflare-konto** där ett separat test-Worker får köra en webbläsare. Jag kan inte driftsätta själv härifrån (inga uppgifter och blockerad åtkomst), så jag skriver koden och en steg-för-steg-instruktion, och du (eller någon du litar på) driftsätter.
5. **En tid med floristen** (telefon eller dator) då hon loggar in via länken.
6. **Var resultaten sparas:** utanför repot. Vi delar bara struktur och godkända stickprov.

### 18.4 Före MVP 4 (människor, inte kod)

1. **En redovisningskonsult eller jurist** som kontrollerar fakturakrav, momssatser per radtyp, löpnummer, kreditfaktura, arkivering och GDPR-roller mot Skatteverkets och lagens texter. Jag är ingen jurist och når inte Skatteverkets sidor härifrån.
2. **Pilotfloristens ekonomisystem** (om hon har ett), för att välja den första `AccountingConnector`.
3. **Beslut om kreditfaktura:** i MVP 4 eller utanför appen till att börja med.

### 18.5 Övrigt som fortfarande gäller

1. **Byggloggen** för Cloudflare-felet (avsnitt I i `CLOUDFLARE-DEPLOYMENT.md`). Behövs för att driftsätta den befintliga appen. Jag ändrar ingenting på chans.
2. **Konton och budget:** ett Anthropic-konto med litet tillgodo (pilot 1–5 USD per månad) och ett tak du är trygg med. Behövs först i MVP 2.

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
6. **Moms och fakturakrav (version 2).** Skatteverkets sidor är blockerade från min miljö, så jag har bara sökträffar. Följande ska kontrolleras av en människa mot sidorna själva: momssatser (sökträffen pekar på 25 % för blommor, men det var ett exempel på en annan sida) på [Momssatser och undantag från moms](https://www.skatteverket.se/foretag/moms/saljavarorochtjanster/momssatspavarorochtjanster.4.58d555751259e4d66168000409.html), fakturans obligatoriska innehåll på [Momslagens regler om fakturering](https://www.skatteverket.se/foretag/moms/saljavarorochtjanster/momslagensregleromfakturering.4.58d555751259e4d66168000403.html) (sökträffen nämner bland annat utfärdandedatum, unikt löpnummer, säljarens momsregistreringsnummer, parternas namn och adress, mängd och art, beskattningsunderlag per sats, momssats och momsbelopp, samt förenklad faktura), och bokföringskraven på [Bokföring: vad kräver lagen](https://www.skatteverket.se/foretag/drivaforetag/bokforingochbokslut/bokforingvadkraverlagen.4.18e1b10334ebe8bc80005195.html). Öppna frågor: vilken tidpunkt som styr momssatsen, om momsen får räknas per rad eller bara per sats, kreditfaktura, förskott, språk och valuta, och hur länge underlag ska sparas.
7. Att `SIE` är en lämplig standardväg för överföring av bokföringsdata, och vilka svenska ekonomisystem som erbjuder öppet API med utkast, kunder och fakturor (inte undersökt).
8. Betalavgifter och supportkostnad per kund för prisanalysen i avsnitt 11.1 (inte undersökt).
9. Att Cloudflares webbläsartjänst klarar en PoC inom gratisnivån (10 minuter per dag enligt sökträff, ej verifierat mot aktuell sida).
