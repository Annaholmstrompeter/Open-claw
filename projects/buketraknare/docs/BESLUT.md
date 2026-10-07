# Beslut

## 2026-10-07: efter steg 0 och arkitekturgrunden

Steg 0 (regressionstester) och arkitekturgrunden är godkända. Inget mergas till master. PR #9 mergas inte. PR #10 bevakas inte löpande.

1. **Ingen mer generell grossistteknik nu.** Arkitekturen testas först mot en verklig grossist (pilotadaptern). Utvecklingen står still tills pilotgrossisten är vald.
2. **Fallbackvägarna ligger kvar synliga** (skärmdumpar, ChatGPT Work, brevlåda, AI-chatt) tills den första riktiga grossistkopplingen fungerar. Därefter flyttas de till *Importera prislista* som reservväg. De raderas inte.
3. **Lat matchning är rätt väg.** Ingen stor matchnings-setup.
4. **Prisdatakälla: se nedan.**
5. **Valuta och moms:** systemet vägrar hellre räkna än gör en osäker omräkning. Valuta- och momslogik byggs först när en verklig grossist kräver det.
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
