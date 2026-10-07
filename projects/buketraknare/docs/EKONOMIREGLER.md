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

`calc()` är referensmotor och ändras inte. Den exakta motorn är inte bunden till calc():s fel. Differenstestet (`pricing-differential.test.mjs`) jämför samma affärsregel i alla 145 tillstånd (197 rader och 96 jobbsummor, största avvikelse 3·10⁻¹³ kr, alltså flyttalsbrus). Följande är uttryckliga och testade avvikelser:

| # | `calc()` | `PricingEngine` | Följd |
|---|----------|-----------------|-------|
| 1 | Flyttal. `ceilTo` räknar `Math.ceil(x/steg − 1e-9)`, så ett pris som är en tusendels öre över en multipel avrundas *ner* | Exakt. Ett pris som är en tusendels öre över en multipel avrundas upp | Skiljer bara i gränsfall som en vanlig florist aldrig matar in. Testat som avvikelse 1 |
| 2 | Avrundningssteg 0 eller mindre betyder "närmaste hela krona" | Steget måste vara större än noll. För "närmaste hela krona" anges steg 1 kr och läget `HALF_UP` | Testat som avvikelse 2. Appens inställning "Avrunda uppåt till närmaste" översätts när motorn kopplas in |
| 3 | Marginal 0 när priset är 0 | Marginal okänd (`null`) | Testat som avvikelse 3 |
| 4 | En enda momssats för hela raden | Moms per komponent och kategori (samma resultat när alla kategorier har samma sats) | Differenstestet använder `legacy-user-setting` (en sats). Flera satser täcks av enhets- och egenskapstesterna |
| 5 | Pris exkl. moms räknas som `pris ÷ (1 + sats)` i flyttal och används för marginalen | Exkl. moms härleds exakt ur det avrundade kundpriset, avrundad till hela ören. Marginalen räknas på det exakta (oavrundade) värdet | Samma tal inom flyttalsbrus. Testat i differenstestet |

Inget gammalt beteende i appen är ändrat. Appen använder fortfarande bara `calc()`.

## 4. Vad som inte är byggt än

Förpackningslogik och fraktfördelning i exakt aritmetik (de ligger kvar i `calc()` och ska flyttas med eget differenstest), `Customer`/`Event`/`Arrangement`, kopplingen till skärmarna, `InvoiceDraft`, `AccountingConnector`, `SupplierPurchase` och `FinancialEvent`.
