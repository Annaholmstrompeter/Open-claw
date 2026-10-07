# Checklista: din grossist

För att hitta det enklaste sättet att hämta dina egna priser behöver vi veta några saker om din grossist. Svara med egna ord, ingen teknik behövs. Vi ber aldrig om ditt lösenord.

## Det vi behöver veta

1. **Vilken grossist handlar du mest av?** Namnet och adressen till webbutiken där du loggar in.
2. **Hur beställer du?** Webbutik, app, mejl, telefon eller en blandning? Ser du dina egna priser först när du har loggat in?
3. **Hur loggar du in?** Kundnummer eller e-post och lösenord? Eller BankID, en sms-kod eller en kod som mejlas? Måste du logga in igen ofta?
4. **Finns något av det här?** Något som heter *prislista*, *Excel*, *PDF*, *ladda ned*, *app*, *integration* eller *API*, antingen på webbutiken eller i ett mejl du fått. Och en kontaktperson hos grossisten (säljare eller kundservice): namn, mejl och telefon.
5. **Hur står priserna?** Per stjälk, bunt eller kartong? Med eller utan moms? Är de samma hela veckan eller ändras de dag för dag?
6. **Kan du bläddra i hela sortimentet i en lista, eller måste du söka efter varje blomma?** Och står varje artikel med sort, längd och kvalitet (till exempel *Avalanche 60 cm*)?
7. **Står det var blommorna är odlade** (land, odlare) **eller om de är certifierade eller ekologiska?** Visas **erbjudanden** när du loggat in, och står det hur länge de gäller?

## Hjälper, men är frivilligt

- De **5–10 blommor du köper oftast**, så att vi testar på det som spelar roll.
- **2–3 skärmdumpar** från webbutiken när du är inloggad och ser priserna. Inte inloggningssidan, så att inget lösenord syns.
- **Ett ja** till att vi, eller du med vårt färdiga mejl, frågar grossisten om en prisfil eller en koppling. Vi frågar ingenting i ditt namn utan att du sagt ja.

## Det vi inte ber om

Lösenord, koder, tekniska filer eller att du ändrar några inställningar.

---

## För utvecklaren: vad svaren avgör

Den bästa vägen väljs i den här ordningen (se `MASTER-PLAN.md`): officiellt API eller feed, prisfil eller EDI, webbutikens egna strukturerade data (bara om villkoren tillåter), och därefter inloggad webbläsare. **Webbläsaragenten är en kärnfunktion och undersöks parallellt** (MVP 1B, en liten proof-of-concept när legitim åtkomst finns och grossistens villkor är lästa). Vi är inte beroende av att grossisten ger API.

| Svaret säger | Då börjar vi med |
|--------------|------------------|
| Fråga 4: prisfil, Excel, feed, API eller integration finns | Den vägen, och kontaktpersonen får frågan först |
| Bara inloggad webbutik, enkel inloggning (inga koder, förblir inloggad) | Undersöka webbutikens egna data, med grossistens tillåtelse |
| BankID, sms-kod eller ofta utloggning | Inloggningen gör floristen själv varje gång. Vi undersöker i PoC:n hur ofta det behövs. Prisfil eller import som reserv |
| Bara PDF, mejl eller telefon | Importera prislista (finns redan) och be grossisten om en maskinläsbar fil |
| Moms eller euro enligt fråga 5 | **Moms** finns redan i modellen (ändrat, se planen): vi noterar om priset är med eller utan moms och vilken sats. **Euro och omräkning** byggs först när en verklig grossist kräver det |
| Fråga 6: går inte att lista, bara söka | Onboarding blir *sök din första favorit* i stället för att hämta hela sortimentet |
| Fråga 7: land, odlare, certifiering syns | Fälten fylls och hållbarhetsfilter byggs. Syns de inte byggs inga filter för den grossisten |
| Fråga 7: erbjudanden syns med slutdatum | Erbjudandeflödet kan byggas. Utan slutdatum gäller de bara samma dag |

Jag kan inte öppna grossistens sidor från min arbetsmiljö, så allt jag vet kommer från svaren här och från offentliga sidor jag kan nå. Länk till grossistens villkor är bra att få med om floristen råkar se den, men det krävs inte.
