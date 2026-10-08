# Grossistadaptrar

Resten av Buketträknaren känner bara till gränssnittet i `contract.js` och det gemensamma formatet i
`public/js/core/model.js` (leverantörsprodukt, pris, matchning). Ingen annan kod vet hur en enskild grossist fungerar.

## Lägga till en ny grossist

1. Undersök grossisten i den här ordningen och skriv beslutet i `src/suppliers/<id>/README.md`:
   officiellt API/feed, prisfil/EDI, webbutikens egna strukturerade anrop (bara om villkoren tillåter det),
   och först därefter inloggad webbläsare. Se `docs/PLAN-grossistanslutning.md`, bilaga C.
2. Skapa `src/suppliers/<id>/connector.js` som exporterar en fabrik `create<Namn>({ http })` och returnerar ett objekt enligt
   `contract.js`. Översätt grossistens fält till `SupplierProduct` och `PriceQuote`. Använd bara `http.getJson/getText`.
3. Lägg sanerade svar från grossisten i `src/suppliers/<id>/fixtures/` (se bilaga B i planen: aldrig råa HAR-filer).
4. Skapa ett test som kör `defineContractTests` (`test/support/contract-suite.mjs`) mot adaptern. Samma svit gäller alla grossister.
5. Lägg en rad i `registry.js`.

Klart. Räknemotorn, huvudskärmen, matchningen och prisuppdateringen ändras inte.

## Regler som sviten kontrollerar

- Bara läsande anrop och bara mot grossistens egna domäner. Inga beställningar, ingen kod som ändrar kontot.
- Felen är en liten uppsättning (`ConnectorError`): `AUTH_EXPIRED`, `MFA_REQUIRED`, `CAPTCHA`, `RATE_LIMITED`, `SITE_CHANGED`,
  `NOT_FOUND`, `UNAVAILABLE`, `UNSUPPORTED`. MFA och CAPTCHA kringgås aldrig: floristen gör det själv.
- Priser anges per förpackning. Moms (`priceIncludesVat`) och valuta anges alltid uttryckligt. Okänt är `null`, aldrig en gissning.
  Pris i annan valuta eller med moms används inte av appen förrän det finns en uttrycklig omräkning.
- Hemligheter (`credentials`) lagras aldrig i appens data. De hör hemma i ett krypterat valv, som byggs först när en grossist kräver det.
