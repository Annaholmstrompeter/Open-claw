# Ekonomiregler: vad som finns, vad som är verifierat och vad som är testdata

Det här är ett register över de ekonomiska reglerna i koden (`public/js/core/money.js`, `amounts.js`, `tax.js`, `pricing.js`). Det ska vara ärligt om vad som är kontrollerat. **Inget i koden är en verifierad svensk skatteregel.** Aktuella momssatser och fakturakrav ska kontrolleras av en människa mot Skatteverkets och lagens egna texter innan någon regel används i produktion (se `MASTER-PLAN.md`, avsnitt 8.4 och bilaga B).

## 1. Regler som är byggda och testade (ren aritmetik, inga skatteregler)

| Regel | Var | Testad av |
|-------|-----|-----------|
| Pengar är hela ören (`Money`). Mellanräkning sker med exakta bråk (`Frac`). Inga flyttal i ny ekonomikod | `money.js` | `money.test.mjs` (inklusive en kontroll som läser källkoden efter flyttalsanrop) |
| Fler än två decimaler i ett belopp avvisas, avrundas aldrig tyst. Flyttalsbrus som `0.1 + 0.2` avvisas | `money.js` | `money.test.mjs` |
| Avrundning bara på namngivna ställen och med uttalat läge: `FLOOR`, `CEIL`, `HALF_UP` (hälften bort från noll) | `money.js` | `money.test.mjs`, egenskapstest med 3 000 fall |
| Procentsatser är heltal i hundradels procent. Fler än två decimaler i procent avvisas | `money.js` | `money.test.mjs` |
| Exkl. moms → moms → inkl. moms, och inkl. → exkl. Summan `exVat + vat = incVat` stämmer alltid exakt | `amounts.js` | `amounts-tax.test.mjs`, egenskapstest med 4 000 fall |
| Okänd sats ger okänt moms- och inkl.-belopp (`null`), aldrig noll | `amounts.js` | `amounts-tax.test.mjs` |
| Inköpskostnad för kalkylen är exkl. *avdragsgill* moms. Ej avdragsgill moms är en kostnad | `amounts.js` (`costBasis`) | `amounts-tax.test.mjs` |
| **Påslag är markup på relevant inköpskostnad** (100 kr + 120 % = 220 kr). Marginal är en härledd uppgift (6/11 här). De blandas aldrig ihop. Marginalen måste vara under 100 % som indata | `pricing.js` | `pricing.test.mjs` |
| Arbete är en separat komponent utan påslag: fast avgift eller minuter × timpris ÷ 60 | `pricing.js` | `pricing.test.mjs` |
| Avgifter får aldrig påslag. Tillbehör kan ha påslag eller inte per rad | `pricing.js` | `pricing.test.mjs` |
| Moms per komponent och per sats (flera satser i samma pris). Avrundningen fördelas över satserna i hela ören med största-resten-metoden så att summan är exakt | `pricing.js` | `pricing.test.mjs` |
| **Kundpriset inkl. moms är sanningen.** Exkl. moms och moms härleds ur det avrundade kundpriset | `pricing.js` | `pricing.test.mjs`, differenstest |
| Baklänges: målpris → råvarubudget (`budgetForTarget`). Bevisat åt andra hållet | `pricing.js` | `pricing.test.mjs`, egenskapstest med 600 fall |
| Prisstatus: ≈ `ESTIMATED` eller ✓ `CONFIRMED` ur prisbasens art (`LIVE`, `RECENT`, `STALE`, `HISTORICAL_ESTIMATE`, `MANUAL`) | `pricing.js` | `pricing.test.mjs` |
| Saknat inköpspris eller okänd momssats ger `INCOMPLETE` och inget pris, aldrig 0 kr eller en gissad sats | `pricing.js` | `pricing.test.mjs` |
| Kundtyp (`PRIVATE`/`BUSINESS`) ändrar bara presentationen, aldrig beloppen | `pricing.js` | `pricing.test.mjs` |
| Jobb: antal multipliceras på redan avrundade belopp. Moms per sats är summan av raderna | `pricing.js` (`priceJob`) | `pricing.test.mjs`, differenstest |
| **Beräknat pris och presenterat kundpris behålls båda.** Beräknat är det exakta (667,75 kr, `calculated`), presenterat är det avrundade (670 kr, `presented`). Det beräknade ändras aldrig av avrundningsregeln. Vilket som är den överenskomna försäljningen avgör kundordern, inte motorn | `pricing.js` | `pricing-items.test.mjs` (egenskapstest med 1 000 fall) |
| **Egna tillägg:** källa `SUPPLIER`/`OWN_STOCK`/`HOME_GROWN`/`MANUAL`. Bara grossistrader kräver en `SupplierProduct` och bara de beställs. `requiresPurchase` avgör om en rad skapar ett inköpsbehov | `items.js`, `workspace.js` | `items.test.mjs`, `workspace.test.mjs` |
| **Noll inköpskostnad betyder inte noll värde.** Extern inköpskostnad, kalkylkostnad och fast kundpris är tre olika fält. Priset beror aldrig på den externa kostnaden. Ett eget material med standardpåslag kräver en kalkylkostnad större än noll. 0 kr som kundpris är ett uttryckligt val | `items.js`, `pricing.js` | `items.test.mjs`, `pricing-items.test.mjs` |
| Prissättningssätt per rad: `STANDARD_MARKUP` (kalkylkostnad × påslag) eller `FIXED_SALE_PRICE` (kundens pris direkt, med eller utan moms, utan inköpskostnad). Fast pris påverkas inte av inköpets färskhet | `pricing.js` | `pricing-items.test.mjs` |
| Momskategori per rad oberoende av källa. Saknas regeln för kategorin blir arrangemanget `INCOMPLETE`, ingen sats gissas | `pricing.js`, `items.js` | `pricing-items.test.mjs`, `workspace.test.mjs` |
| Exakt förpackningslogik: hela förpackningar uppåt, delning mellan arrangemang och antal, hemmalager (högst behovet), "hela förpackningar" eller "bara det som används" | `purchase.js` | `purchase.test.mjs` (1 500 slumpade planer), `purchase-differential.test.mjs` |
| Exakt fraktfördelning: fri frakt från ett belopp, ingen frakt utan inköp, fördelning efter hur mycket grossistblommor varje arrangemang bär. Summan är exakt | `purchase.js` | `purchase.test.mjs`, `workspace.test.mjs` |
| Lagring: ändringar är atomära, trasig lagring skrivs aldrig över, full lagring ger besked, två flikar ger en konflikt, egen nyckel | `store.js` | `store.test.mjs` |
| Regelstruktur: `TaxRuleSet` är fryst, versionerad och har giltighetstid. Bara källtypen `official` med länk, person och datum kan vara `verified`. `assertVerified` stoppar overifierade regler (för faktura). Satsen och regelversionen frysas på ett dokument (`freezeRate`) | `tax.js` | `amounts-tax.test.mjs`, `pricing.test.mjs` |

## 2. Regler som är testdata eller overifierade

| Sak | Status | Hur det är markerat |
|-----|--------|---------------------|
| **Alla momssatser** (25, 12, 6, 0 procent och andra) | **Overifierade.** Kod och tester använder dem bara som exempel | Produktionsmodulen `tax.js` innehåller inga satser (kontrolleras av ett test). Testsatserna ligger i `test/support/tax-fixtures.mjs` med källtypen `fixture` och status `unverified` |
| Regeluppsättningen `legacy-user-setting` | **Aldrig verifierad.** Den speglar bara floristens egen inställning "Moms (%)" så att den nya motorn kan räkna som den gamla appen. **Kan inte användas för en faktura** | Källtyp `user_setting`. `assertVerified` avvisar den |
| Vilken tidpunkt som styr momssatsen (leverans, faktura, betalning) | Ej undersökt. Motorn tar ett `taxDate` från den som anropar | Öppen fråga, bilaga B |
| Momsavrundning per rad eller per sats (`roundingLevel`) | Ej avgjort. Bara `line` är byggt. `rate_summary` avvisas uttryckligen | `priceJob` kastar `unsupported_rounding_level` |
| Fakturans obligatoriska innehåll, löpnummer, kreditfaktura, förskott | Ej verifierat och ej byggt (MVP 4) | `MASTER-PLAN.md` avsnitt 4.2, 8.3, 8.4 |
| Att MANUAL (floristens eget pris) räknas som bekräftat | **Produktregel**, inte skatteregel. Står i en konstant (`CONFIRMING` i `pricing.js`) och kan ändras | Dokumenterad i planen, avsnitt 6.7 |
| Gränsen mellan `RECENT` och `STALE` | Bestäms när vi vet hur den verkliga grossistens priser uppdateras. Motorn läser bara typen | Planen, avsnitt 6.7 |

**Så görs en regel verifierad.** En människa läser den officiella källan, skapar en `TaxRuleSet` med `source.kind: 'official'`, länk, `verifiedBy` och `verifiedAt`, och lägger till tester med fixturer för just den regeln. En faktura kan inte godkännas med något annat.

## 3. Avvikelser mellan den gamla räknemotorn `calc()` och den exakta `PricingEngine`

`calc()` är referensmotor och ändras inte. Den exakta motorn är inte bunden till calc():s fel. Differenstestet för priset (`pricing-differential.test.mjs`) jämför samma affärsregel i alla 145 tillstånd (197 rader och 96 jobbsummor, största avvikelse 3·10⁻¹³ kr, alltså flyttalsbrus). Differenstestet för hela kedjan (`purchase-differential.test.mjs`: rader → inköpsplan → pris) jämför dessutom förpackningar, överskott, frakt och priser i alla 145 tillstånd (373 inköpsrader, 289 arrangemangsrader och 101 jobbsummor, största avvikelse 5·10⁻¹³ kr). Följande är uttryckliga och testade avvikelser:

| # | `calc()` | `PricingEngine` | Följd |
|---|----------|-----------------|-------|
| 1 | Flyttal. `ceilTo` räknar `Math.ceil(x/steg − 1e-9)`, så ett pris som är en tusendels öre över en multipel avrundas *ner* | Exakt. Ett pris som är en tusendels öre över en multipel avrundas upp | Skiljer bara i gränsfall som en vanlig florist aldrig matar in. Testat som avvikelse 1 |
| 2 | Avrundningssteg 0 eller mindre betyder "närmaste hela krona" | Steget måste vara större än noll. För "närmaste hela krona" anges steg 1 kr och läget `HALF_UP` | Testat som avvikelse 2. Appens inställning "Avrunda uppåt till närmaste" översätts när motorn kopplas in |
| 3 | Marginal 0 när priset är 0 | Marginal okänd (`null`) | Testat som avvikelse 3 |
| 4 | En enda momssats för hela raden | Moms per komponent och kategori (samma resultat när alla kategorier har samma sats) | Differenstestet använder `legacy-user-setting` (en sats). Flera satser täcks av enhets- och egenskapstesterna |
| 5 | Pris exkl. moms räknas som `pris ÷ (1 + sats)` i flyttal och används för marginalen | Exkl. moms härleds exakt ur det avrundade kundpriset, avrundad till hela ören. Marginalen räknas på det exakta (oavrundade) värdet | Samma tal inom flyttalsbrus. Testat i differenstestet |
| 6 | Heltal och decimaler godtas i vilken form som helst: `Math.round(+paket||1)`, `Math.max(0, +pris||0)`, antal avrundas tyst | Den exakta planen **avvisar** ogiltiga antal och priser med fler än två decimaler i stället för att avrunda tyst. Städningen sker vid gränsen (testhjälparen som översätter de gamla tillstånden) | Skiljer bara för inmatning som aldrig förekommer i de 145 tillstånden. Testat i `purchase.test.mjs` (felaktiga indata avvisas) |
| 7 | En tom bukett kostar 0 kr. Arbetet läggs bara på buketter med innehåll | Samma: ett arrangemang utan rader är `EMPTY` och kostar 0 kr, utan att standardavgiften för arbete läggs på | Ingen avvikelse, men uttryckligen testat (`workspace.test.mjs`) |
| 8 | Ett pris som är 0 betyder "pris saknas" | Samma: `packPrice` som är `null` eller 0 ger en rad utan pris. Aldrig 0 kr | Ingen avvikelse. Testat |
| 9 | `minOrder` används bara för en varning i skärmen | Inte med i planen än (en varning hör till skärmen, inte till räkningen) | Ingen avvikelse i priset |

Inget gammalt beteende i appen är ändrat. Appen använder fortfarande bara `calc()`.

## 4. Vad som inte är byggt än

Kopplingen till skärmarna (arbetsytan laddas inte av appen än), en adapter från `model.js` till katalogen som `priceEvent` tar emot, flytt av den befintliga ordern till ett jobb "Min order", `QuoteSnapshot` och `CustomerOrder` (som fryser det överenskomna beloppet), "Mina material", `InvoiceDraft`, `AccountingConnector`, `SupplierPurchase` och `FinancialEvent`.
