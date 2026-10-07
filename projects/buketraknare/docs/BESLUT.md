# Beslut

## 2026-10-07: efter steg 0 och arkitekturgrunden

Steg 0 (regressionstester) och arkitekturgrunden är godkända. Inget mergas till master. PR #9 mergas inte. PR #10 bevakas inte löpande.

1. **Ingen mer generell grossistteknik nu.** Arkitekturen testas först mot en verklig grossist (pilotadaptern). Utvecklingen står still tills pilotgrossisten är vald.
2. **Fallbackvägarna ligger kvar synliga** (skärmdumpar, ChatGPT Work, brevlåda, AI-chatt) tills den första riktiga grossistkopplingen fungerar. Därefter flyttas de till *Importera prislista* som reservväg. De raderas inte.
3. **Lat matchning är rätt väg.** Ingen stor matchnings-setup.
4. **Prisdatakälla: se nedan.**
5. **Valuta och moms:** systemet vägrar hellre räkna än gör en osäker omräkning. Valuta- och momslogik byggs först när en verklig grossist kräver det. **(Ändrat för moms 2026-10-07, se längst ned. Euro och omräkning gäller fortfarande.)**
6. **Cloudflare:** avvakta. Inget ändras utan den riktiga felraden ur byggloggen (se `CLOUDFLARE-DEPLOYMENT.md`).
7. **Nästa steg** tas när pilotgrossisten är identifierad: först research, sedan en verklig adapter, innan mer byggs. Underlag: `CHECKLISTA-PILOTGROSSIST.md`.

### Vilken prisdatakälla som vinner

**Beslut:** ett färskt, verifierat grossistpris är normalt standard. Det är inte absolut överordnat för alltid. Floristen ska senare kunna göra en **manuell override för en enskild produkt**.

Fyra begrepp ska gå att skilja åt. Modellen kan redan det, så **ingenting ändras nu**:

| Begrepp | Hur det finns i modellen i dag |
|---------|--------------------------------|
| **Aktuellt grossistpris** | senaste prisnoteringen (`quotes[]`) på en anslutning som inte är `conn_manual`, om den är användbar (`unusableReason` = null: kronor, uttryckligen utan moms) |
| **Manuellt pris** | senaste prisnoteringen på `conn_manual` (det floristen skrivit in eller läst in) |
| **Aktivt pris** | det `viewOf` väljer, och det räknemotorn använder |
| **Manuell override** | finns inte än. Läggs till som ett nytt valfritt fält på produkten (till exempel `priceOverride`), vilket modellen redan tål |

Kontrollerat (engångskörning, ingen kod ändrad): ett extra fält på en produkt bevaras vid inläsning av sparad data, och vyn och rollbacken fungerar med det. Eftersom `viewOf` är den enda platsen där det aktiva priset väljs, och rollbacken (`downgradeV2toV1`) bygger på `viewOf`, följer en override automatiskt med till det gamla formatet när den väl respekteras av `viewOf`.

**Skillnad mellan beslutet och nuvarande beteende** (medvetet inte ändrat):

- Nu vinner den första anslutna grossistens användbara pris oavsett ålder. Beslutet säger *färskt* verifierat pris. Vad som räknas som färskt, och vad som gäller när grossistpriset är gammalt men ett manuellt pris är nyare, avgörs när vi vet hur den verkliga grossistens priser uppdateras.
- Nu ändrar en manuell inläsning inte det visade priset för en vara som har ett användbart grossistpris (den sparas och gäller om grossisten kopplas bort). Det är dokumenterat i ett test, och den manuella overriden är det som senare ger floristen kontroll över det.

**Öppna frågor till senare** (ingen bråttom):

1. Vad är "färskt"? En gräns i timmar eller dagar, och hur den beror på leveransdag och helger.
2. Hur länge gäller en override: tills grossistpriset ändras, för alltid, eller med slutdatum?
3. Hur visas det för floristen: *Grossistens pris* mot *Ditt eget pris*, utan teknikord.
4. Ska en manuell inläsning av en hel prislista gälla produkter som saknar grossistkoppling?

## 2026-10-07 (senare): produktvisionen justerad, matchningsfunktionen pausad

Grossistens verkliga artiklar ska vara sanningen, och floristens egna arbete bygger på favoriter, aktuella priser, erbjudanden, tillgänglighet, säsong och svenskodlat/närodlat/ekologiskt (bara när datan finns). Den tekniska grunden (stabila id:n, leverantörsprodukt, pris, matchning, `SupplierConnector`) bedöms vara rätt och ändras inte i onödan.

- **Den planerade matchningsfunktionen byggs inte.** Den ersätts av katalog, klassificering, sökning och favoriter.
- **Ingen kod och inga tester ändras** tills konsekvensanalysen är granskad: `KONSEKVENSANALYS-FLORISTVISION.md`.
- Listan över sådant som inte ska byggas ännu står i analysens avsnitt Q.

## 2026-10-07 (senare): masterplan skriven, väntar på godkännande

`MASTER-PLAN.md` samlar arkitektur, domänmodell, dataflöden, prismotor, grossistagent, policy för ekonomiska handlingar, kostnadsmodell (1/10/100/1000 floristar), MVP 1–5, risker och öppna beslut. Den ersätter inte `PLAN-grossistanslutning.md` utan bygger på den (jämförelsen står i avsnitt 2).

- **Ingen produktionskod ändrad.** Alla 191 tester är gröna mot oförändrad kod.
- **Inget byggs förrän planen är godkänd.** Nästa större implementation väntar på Annas svar på de öppna besluten i avsnitt 18.
- **Inga ekonomiskt bindande automatiska handlingar.** Agenten får förbereda, aldrig slutföra köp, godta ersättningsvara med kostnadskonsekvens, skicka faktura eller ändra bindande order utan floristens uttryckliga godkännande.
- **Uppgifter som är overifierade** (Blomstergrossistens villkor och inloggning, Cloudflares aktuella priser, cookie-överlämning i molnwebbläsare, krav på fakturor och GDPR) är markerade i bilaga B och ska kontrolleras innan de används.

## 2026-10-07 (senare): Annas tillägg till masterplanen (version 2)

Beslut av Anna, infört i `MASTER-PLAN.md` version 2. Ingen produktionskod ändrad.

1. **Grossistagenten är en kärnfunktion.** En liten proof-of-concept (**MVP 1B**) körs parallellt med floristens kärna (**MVP 1A**) så snart legitim pilotåtkomst finns och grossistens villkor är lästa. Ingen stor generell fjärrwebbläsarplattform byggs före beviset.
2. **Vi är inte beroende av att grossisten ger API.** Vi frågar om API, feed, prisfil, EDI och tillstånd, och använder det om det är bra. Grind A innehåller också en teknisk undersökning av hur webbutiken fungerar efter inloggning. Vi kringgår aldrig säkerhet eller åtkomstkontroller.
3. **Skärmdumpar och CSV är reservvägar**, inte arkitekturens grund. Slutupplevelsen är ANSLUT GROSSIST → LOGGA IN → KLART.
4. **Moms ändrar tidigare beslut 5.** Moms-redig pengamodell byggs nu (inköp ex/inkl. moms, försäljning ex/inkl. moms, moms per rad, versionerade regler). **Euro och omräkning väntar fortfarande** tills en verklig grossist kräver det.
5. **Pengar är exakta tal**, aldrig flyttal. AI räknar aldrig moms. Påslag och marginal är olika saker och har egna tester. `calc()` ligger kvar som referensmotor.
6. **Kundpriset är det floristen arbetar med.** Den exakta uppdelningen ligger bakom.
7. **Planerat är inte faktiskt:** estimate, quote, godkänd kundorder, planerat inköp, grossistens varukorg, faktiskt inköp, leverantörsfaktura/kvitto, kundfaktura och betalning är nio separata steg. Bara faktiska händelser blir bokföringsunderlag.
8. **Ingen egen bokföring.** En `AccountingConnector` planeras på samma princip som `SupplierConnector`. Ingen leverantör är vald.
9. **Revisionsspår och versionerade regler.** Ekonomiska värden skrivs aldrig över. Skatte- och fakturaregler är data med version, och en gammal faktura ändras aldrig av att en regel ändras.
10. **Ny ordning:** MVP 1A + 1B parallellt → 2 (riktig grossistkoppling) → 3 (inköp) → 4 (faktura) → 5 (grossistvarukorg) → 6 (intelligens).
11. **Prissättning:** MICRO ca 99–199, STUDIO ca 299–449, PRO ca 699–899+ kr per månad som arbetshypotes. Kalkylering obegränsad. Rättvisaste dimensionen enligt analysen: aktiva kundjobb per månad, grossistanslutningar och användare. Tekniska mått visas aldrig för floristen. Tak och larm skyddar mot en trasig connector.

**Öppen fråga till Anna:** briefens räkneexempel (186 kr, 120 %, 125 kr = "534 kr inkl. moms") stämmer med dagens motor bara som 534,20 kr *före* moms.

## 2026-10-07 (senare): förtydliganden från Anna och första kodsteget (MVP 1A)

Annas besked, infört i `MASTER-PLAN.md` (version 2.1) och byggt där det gäller koden.

1. **534 kr var ett pedagogiskt exempel och ingen regel.** Motorn anpassas inte efter det. Exemplet är rättat i planen och testerna: 186 kr + 120 % påslag + 125 kr arbete = 534,20 kr före moms, och med en testsats på 25 % ger det 670 kr kundpris (avrundat uppåt till 5 kr).
2. **Kundpriset inkl. moms är huvudtalet** och det som kunden faktiskt betalar. Kalkylen bakom: inköpskostnad exkl. avdragsgill moms + påslag + arbete + avgifter = försäljningspris exkl. moms, därefter utgående moms.
3. **Påslag är markup på relevant inköpskostnad** (100 kr + 120 % = 220 kr). Marginal är en härledd uppgift. De blandas aldrig ihop.
4. **Arbete är en separat komponent:** standardavgift per arrangemang med överstyrning i MVP, tidsbaserat (minuter × timpris) finns i modellen och motorn.
5. **Baklänges räkning stöds:** målpris inkl. moms → tillgänglig råvarubudget. Byggt och testat i motorn, ingen skärm än.
6. **B2C och B2B:** `customerKind` ändrar bara presentationen. Inga två UI-flöden nu.
7. **Prisstatus** (≈ uppskattat, ✓ bekräftat) och **prisbasens art** (`LIVE`, `RECENT`, `STALE`, `HISTORICAL_ESTIMATE`, `MANUAL`) följer med varje kalkyl.
8. **Första kodsteget godkänt och byggt:** `Money`, `Amounts`, `TaxRuleSet`-struktur, exakt `PricingEngine`, tester. Inga skärmändringar. **Inga overifierade svenska momssatser i produktionskoden.** Testsatser är markerade som testdata. `legacy-user-setting` speglar floristens egen inställning och kan inte användas för faktura.
9. **`calc()` är referens- och regressionsmotor.** Den nya motorn jämförs mot den där samma affärsregel jämförs. Avvikelser är dokumenterade i `docs/EKONOMIREGLER.md` och tvingar inte den nya motorn att upprepa ett fel.
10. **MVP 1B (grossistagent-PoC) ligger kvar parallellt** och glöms inte bort. Den väntar på pilotåtkomst, grossistens villkor och Annas ja till mejlet.
11. **Mejl till Blomstergrossisten:** utkast skrivet (`docs/MEJLUTKAST-BLOMSTERGROSSISTEN.md`), kort och icke-tekniskt. **Inget är skickat.** Anna granskar först.
12. **Kostnadstak och mätning per butik behålls** som krav (MASTER-PLAN avsnitt 10). Piloten med 1–3 florister ska ha mycket låg eller nästan ingen fast kostnad.

## 2026-10-07 (senare): egna tillägg, beräknat och presenterat pris, nästa kodsteg

Annas besked, infört i `MASTER-PLAN.md` (version 2.2) och byggt i kod där det gäller koden.

1. **Egna tillägg och material.** Allt som används i ett arrangemang kommer inte från grossistbeställningen: sidenband i butiken, vas, oasis, tråd, torkat material, egen trädgård, eget lager. En rad i ett arrangemang (`ArrangementItem`) kräver ingen `SupplierProduct`.
2. **Källmodell:** `SUPPLIER`, `OWN_STOCK`, `HOME_GROWN`, `MANUAL`. `LEFTOVER` är en reserverad plats som inte är aktiverad. Modellen är inte övermodellerad.
3. **`requiresPurchase`:** en rad avgör själv om den ska skapa ett inköpsbehov. Bara grossistrader hamnar i en grossistbeställning. Eget lager och egen trädgård beställs aldrig. Vad som *används* skiljs från vad som *måste beställas*.
4. **Noll inköpskostnad betyder inte noll värde.** Extern inköpskostnad, kalkylkostnad och fast kundpris är olika fält. Motorn antar aldrig att kostnad 0 ger kundpris 0. Ett eget material med standardpåslag måste ha en kalkylkostnad större än noll, annars väljer floristen ett fast kundpris. 0 kr som kundpris är ett uttryckligt val.
5. **Prissättningssätt per rad:** `STANDARD_MARKUP` och `FIXED_SALE_PRICE` (kundens pris direkt, med eller utan moms).
6. **"Mina material" byggs senare.** Reserverade platser finns (`materialRef`, `materials`), ingen lagerhantering.
7. **Moms gäller även egna tillägg.** Varje rad kan få en momskategori oavsett källa. Ingen sats gissas.
8. **Beräknat och presenterat kundpris behålls båda** (667,75 kr och 670 kr). Det beräknade ersätts aldrig av det avrundade. Vilket belopp som är den överenskomna försäljningen (och därmed en ekonomisk händelse) avgörs av kundordern: standard är det presenterade priset, och ett förhandlat belopp registreras som en prisjustering (avsnitt 8.6).
9. **Nästa kodsteg godkänt och byggt:** exakt förpackningslogik och fraktfördelning med differenstest mot de 145 tillstånden, därefter `Customer`, `Event`, `Arrangement`, `ArrangementItem` och ett lagringsgränssnitt. Ingen stor UI-ombyggnad. Appen laddar inte de nya modulerna än.
10. **Grossistmejlet:** meningen "Vi gör ingenting automatiskt innan vi hört av oss" är borttagen och ersatt med en mjukare mening om att förstå möjligheter och riktlinjer. Mejlet är **inte skickat**.
11. **MVP 1B (grossistagent-PoC) ligger kvar parallellt** och väntar på pilotflorist, åtkomst och grossistens villkor. Inga köp.
12. **Regressionsskydd:** de 266 testerna är oförändrade och gröna.

## 2026-10-07 (senast): preciseringar, bryggan och den minimala jobbskärmen

Annas besked om egna material, prisnivåer och prisgrund, och vilka val jag gjorde i genomförandet. Det som är mitt val kan ändras av Anna.

**Annas beslut (byggt):**
1. **Egna material:** standardpåslag kräver en kalkylkostnad större än noll. Floristen kan alltid välja "Ingår utan extra kostnad" (0 kr). **PRICE_MISSING** (ofullständig kalkyl) skiljs från **EXPLICITLY_INCLUDED** (giltigt 0 kr).
2. **Tre prisnivåer** hålls isär: beräknat (667,75 kr), presenterat (670 kr) och överenskommet (till exempel sålt för 650 kr, lägre eller högre än presenterat). Den ursprungliga kalkylen förstörs aldrig.
3. **Fasta priser** har en uttrycklig prisgrund (`inc`/`ex`). Förval: inkl. moms för privatkund, exkl. moms för företag.
4. **Kalkylkostnad finns även när inköpskostnaden idag är 0** (egen trädgård, eget lager).
5. **Underlag för lönsamhet** förbereds som data. Vinst och täckningsbidrag definieras inte.
6. **Ordning:** bryggan mellan den nuvarande prislistan och arbetsytan, därefter offert och kundorder, därefter en minimal jobbskärm.
7. **MVP 1B (grossistagent-PoC) ligger kvar parallellt.** Inga köp, inga automatiska beställningar. Mejlet till grossisten är inte skickat.

**Mina val (kan ändras):**
- **Spara är automatiskt.** Det finns ingen Spara-knapp att glömma. Skärmen visar "Sparat ✓" först när något faktiskt sparats, och "Inte sparat" om lagringen är full eller blockerad.
- **"Min order" flyttas över en enda gång.** Därefter är jobbet en egen sak: ändringar i fliken Bukett följer inte med, och ett borttaget jobb kommer inte tillbaka av sig själv. Skälet: två ställen som ändras åt båda hållen är den vanligaste källan till tyst dataförlust.
- **Inställningarna speglas åt ett håll** (från Inställningar till jobben). Bara ett ställe att ändra påslag och timpris tills vidare.
- **Priskälla i bryggan:** ett pris som skrevs eller verifierades idag är `MANUAL` (bekräftat ✓), annat är `STALE` (ungefärligt ≈). Ett riktigt `LIVE` kräver en riktig grossistanslutning.
- **Det överenskomna priset gäller per arrangemang** (per styck). Ett förhandlat totalpris för hela jobbet kommer senare.
- **Favoriter (♡) ingår inte** i den minimala skärmen. De finns inte i datamodellen än.
- **Ingen skärm för offert och kundorder än.** Domänkoden och testerna finns, men en knapp "Kunden sa ja" hör till nästa steg.
- **Arbete anges exkl. moms** per arrangemang (fast belopp). Tomt fält betyder att inget arbete angetts.
- **Vägen tillbaka:** arbetsytan har en egen lagringsnyckel. Tar man bort den (eller bara slutar använda fliken Jobb) är appen exakt som förut. Det finns också en funktion som gör ett jobb till en order i den gamla formen och säger vad som inte kan uttryckas där. Ingen knapp som skriver till den gamla ordern finns (det vore en risk för tyst överskrivning).

**Regressionsskydd:** alla 348 tidigare tester finns kvar och är gröna. Två av dem fick en medveten ändring av en enda förväntan (listan över tillåtna prissättningssätt har ett tredje värde), och ett statiskt test som sa att appen inte laddar de nya modulerna ersattes av ett som kontrollerar att de laddas i rätt ordning och att den gamla appens lagring är orörd.
