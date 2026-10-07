# Checklista: din grossist

För att hitta det enklaste sättet att hämta dina egna priser behöver vi veta några saker om din grossist. Svara med egna ord, ingen teknik behövs. Vi ber aldrig om ditt lösenord.

## Det vi behöver veta

1. **Vilken grossist handlar du mest av?** Namnet och adressen till webbutiken där du loggar in.
2. **Hur beställer du?** Webbutik, app, mejl, telefon eller en blandning? Ser du dina egna priser först när du har loggat in?
3. **Hur loggar du in?** Kundnummer eller e-post och lösenord? Eller BankID, en sms-kod eller en kod som mejlas? Måste du logga in igen ofta?
4. **Finns något av det här?** Något som heter *prislista*, *Excel*, *PDF*, *ladda ned*, *app*, *integration* eller *API*, antingen på webbutiken eller i ett mejl du fått. Och en kontaktperson hos grossisten (säljare eller kundservice): namn, mejl och telefon.
5. **Hur står priserna?** Per stjälk, bunt eller kartong? Med eller utan moms? Är de samma hela veckan eller ändras de dag för dag?

## Hjälper, men är frivilligt

- De **5–10 blommor du köper oftast**, så att vi testar på det som spelar roll.
- **2–3 skärmdumpar** från webbutiken när du är inloggad och ser priserna. Inte inloggningssidan, så att inget lösenord syns.
- **Ett ja** till att vi, eller du med vårt färdiga mejl, frågar grossisten om en prisfil eller en koppling. Vi frågar ingenting i ditt namn utan att du sagt ja.

## Det vi inte ber om

Lösenord, koder, tekniska filer eller att du ändrar några inställningar.

---

## För utvecklaren: vad svaren avgör

Den bästa vägen väljs i den här ordningen (se planen): officiellt API eller feed, prisfil eller EDI, webbutikens egna strukturerade data (bara om villkoren tillåter), och först därefter inloggad webbläsare.

| Svaret säger | Då börjar vi med |
|--------------|------------------|
| Fråga 4: prisfil, Excel, feed, API eller integration finns | Den vägen, och kontaktpersonen får frågan först |
| Bara inloggad webbutik, enkel inloggning (inga koder, förblir inloggad) | Undersöka webbutikens egna data, med grossistens tillåtelse |
| BankID, sms-kod eller ofta utloggning | Inte inloggad automatik. Prisfil eller import tills grossisten erbjuder något bättre |
| Bara PDF, mejl eller telefon | Importera prislista (finns redan) och be grossisten om en maskinläsbar fil |
| Moms eller euro enligt fråga 5 | Först då byggs den logiken, och inte förr |

Jag kan inte öppna grossistens sidor från min arbetsmiljö, så allt jag vet kommer från svaren här och från offentliga sidor jag kan nå. Länk till grossistens villkor är bra att få med om floristen råkar se den, men det krävs inte.
