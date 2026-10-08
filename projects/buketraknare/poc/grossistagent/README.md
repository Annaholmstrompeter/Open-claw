# Grossistagent: ett skrivskyddat försök (MVP 1B, del A)

Floristen loggar **själv** in hos sin grossist i en riktig webbläsare. Därefter kan en AI-agent söka i den inloggade webbutiken och ge tillbaka strukturerad artikeldata. Vår egen kod (inte AI:n) läser ut, tolkar och räknar. Allt är **skrivskyddat** och **ingen session sparas**.

Det här är ett försök och ingen produktfunktion. Det är helt separat från Buketträknaren: ingen del av appen importerar något härifrån, och ett misslyckat försök kan inte skada den.

## Så kör ni

**0. Innan ni börjar.** Floristen har sagt ja och använder sitt eget konto. Läs webbutikens publika villkor (länk i sidfoten). Förbjuder de uttryckligen robotar eller automatiserad åtkomst: **gör inte testet.** Programmet kräver att ni kryssar för båda sakerna innan agenten startar.

**1. Förberedelser (en gång, på en dator med Chrome).** Kräver Node 20 eller senare och Google Chrome.
```
git pull
cd projects/buketraknare/poc/grossistagent
npm install
```
Skaffa en egen API-nyckel hos Anthropic. Skriv aldrig nyckeln i en fil eller i repot, bara i terminalen:

| System | Starta |
|---|---|
| Mac eller Linux | `ANTHROPIC_API_KEY=sk-ant-... npm start -- --shop https://webbutikens-adress/` |
| Windows (PowerShell) | `$env:ANTHROPIC_API_KEY="sk-ant-..."; npm start -- --shop https://webbutikens-adress/` |

Webbutikens adress för Blomstergrossisten är ej verifierad. Sökträffar pekar på `shop.blomstergrossisten.net`. Kontrollera den i floristens webbläsare. Använder Chrome en annan sökväg: sätt `CHROME_PATH`.

**Prova först utan florist (rekommenderas).** `npm run demo` (eller `npm start -- --demo`) kör hela försöket (med samma API-nyckel som nedan) mot en **påhittad butik** på den egna datorn (inloggning `testkund` / `hemligt-123`, påhittade uppgifter). Det är det säkraste sättet att se att Chrome, API-nyckeln och agenten fungerar innan florist och riktig webbutik är inblandade, och det kostar bara några ören.

**2. Det som händer.** Två fönster öppnas:
- **Ett Chrome-fönster** på webbutikens inloggning. Det är det agenten senare arbetar i.
- **En kontrollsida** i din vanliga webbläsare (adressen skrivs också ut i terminalen).

**3. Floristen** skriver användarnamn och lösenord **direkt i Chrome-fönstret** och gör själv eventuell kod eller CAPTCHA. Lösenordet skrivs aldrig på kontrollsidan, aldrig till någon AI, och passerar aldrig vår kod.

**4. Du** kryssar de två rutorna på kontrollsidan och klickar *Jag är inloggad*. Skrivskyddet slås på. Skriv en instruktion och klicka *Skicka*.

**5. Avsluta** med knappen *Avsluta och radera sessionen*. Webbläsaren stängs och allt töms. Nästa gång måste floristen logga in igen.

## Fem saker att säga till agenten
1. *Hitta vita rosor som skulle passa till en romantisk brudbukett. Jag behöver ungefär 25.*
2. *Vilka vita eller krämvita rosor på minst 60 cm finns i lager?*
3. *Finns det något grönt, till exempel eukalyptus, som passar till vita rosor? Jag behöver 30 stjälkar.*
4. *Visa veckans erbjudanden på rosor.*
5. *Hitta en vit sommarblomma i gipsörtstil, helst 10 st per förpackning.*

Svaret är en tabell: artikelnummer, namn, sort, färg, längd, förpackning, **floristens eget pris**, momsstatus, tillgänglighet, erbjudande och anmärkningar. Saknas något står det som **okänt**. Det gissas aldrig. Skriver du ett behov ("25 rosor") räknar vår kod förpackningar, överskott och kostnad: 25 behövs i 20-pack ger 2 förpackningar, 40 st, 15 över och 2 × förpackningspriset.

## Vad som skyddar mot att något köps eller ändras
Skyddet är **teknik, inte en uppmaning**. Allt agenten gör går genom det, och det sitter på hela webbläsarkontexten från första anropet (flikar, popup-fönster och workers):

1. **Sökvägar och åtgärder nekas för alla metoder, även GET:** varukorg, kassa, beställning, betalning, utloggning, borttagning, `?add=`, `?action=buy` och liknande (även med omskrivna tecken).
2. **Bara läsande metoder släpps igenom** (GET, HEAD, OPTIONS). POST, PUT, PATCH och DELETE nekas som standard.
3. **Undantag:** en läsande GraphQL-fråga (aldrig `mutation`), och en POST som du själv godkänner efter att ha sett exakt vad som nekades (för butiker som söker med POST). Ett godkännande kan aldrig gälla något som liknar varukorg eller beställning.
4. **Sidan lämnas aldrig:** navigering och dataanrop till andra värdar nekas. WebSockets nekas. Service workers är avstängda. Bilder, media och typsnitt hämtas inte.
5. **Verktygen är en andra försvarslinje:** agenten kan inte köra egen kod, inte klicka på något som liknar köp, varukorg, kassa, beställning, spara eller utloggning, och inte skriva i lösenordsfält. Den ser aldrig lösenordsfält eller värden som skrivits i fält.
6. **Gränser:** högst 100 sidhämtningar och minst 2 sekunder mellan dem. Möts agenten av CAPTCHA, spärr eller en ny inloggning ska den sluta och rapportera.
7. **Självkontroll:** innan agenten startar provas att ett popup-fönsters första anrop fångas av skyddet. Om inte, startar agenten inte.

Allt som nekades syns på kontrollsidan. Webbplatsens data är för agenten bara data: text på sidan som säger "gör si eller så" ignoreras, och skyddet gäller ändå.

## Vad som skickas till AI:n (Anthropics API)
Sidans struktur (länkar, knappar, fältnamn, nyckelnamn i JSON-svar), två exempelrader ur ett JSON-svar så att agenten förstår vilket fält som är vad (de innehåller **pris**), och artiklarnas namn, sort, färg, längd, förpackning, tillgänglighet och erbjudandets text. **Inte** priserna i listorna, inte lösenord, cookies, rubriker eller fältvärden. Det ska stå i det samtycke floristen ger. Priserna i resultatet kommer från vår kod, aldrig från AI:ns text.

## Kostnad (uppskattning, ej mätt mot en riktig körning)
Webbläsaren kostar ingenting (den körs lokalt). AI-delen: system och verktyg är ungefär 1 800 tokens per anrop, och ett uppdrag tar ungefär 10 anrop med växande sammanhang, alltså storleksordningen 70 000 indatatokens och några tusen utdatatokens, ungefär 0,2 USD med Sonnet 5.5 ($2 / $10 per miljon tokens). 30 minuter med 6 till 10 uppdrag blir ungefär **1 till 3 USD, alltså 10 till 30 kr**. Med `--model claude-opus-5-5` ungefär det dubbla. Kontrollsidan visar tokens och uppskattad kostnad löpande.

## Vad som är provat och inte provat
**Provat (påhittad butik, riktig webbläsare, `npm test`, 47 tester):** skyddet mot allt en sida kan göra (fetch, XHR, beacon, formulär, bild, iframe, popup, worker, websocket), att servern aldrig får ett muterande anrop och att inloggningen finns kvar; JSON- och DOM-extraktion; exakt inköpsberäkning (inklusive 400 slumpade fall); att resultatet godkänns av grossistkontraktet i `model.js`; samtycke och villkorskrav; att sessionen raderas; kontrollsidan (nyckel, värdnamn, XSS). Skyddet är mutationstestat.

**Inte provat:** mot den **riktiga** webbutiken (jag når den inte härifrån och har inget konto), med en **riktig AI-modell** (testerna kör ett manus i stället för en modell, så de bevisar maskineriet och inte modellens omdöme), och i floristens egen Chrome. De publika villkoren har jag inte kunnat läsa.

## Kända begränsningar
- **Webbläsaren styrs av automatik** och Chrome visar det. Vi döljer det inte. En butik med robotskydd kan visa CAPTCHA eller spärra. Då avbryter ni.
- Butikens egna skript körs som vanligt. Skyddet bygger på att varje skrivande anrop går via nätverket, vilket gäller allt utom WebSockets (nekas helt).
- En butik som lägger varukorgen helt i webbläsaren (utan anrop) kan inte påverka något hos grossisten, och agenten kan inte klicka på knappen ändå.
- AI-modellens val av fält kan vara fel. Gör stickprov mot det floristen ser i butiken. Kontrollsidan visar varifrån varje värde kommer.
- **Rapport:** *Spara rapport* ger en sanerad bild (adressmönster och nyckelnamn, inga artikeldata) som hjälper oss att förbättra läsningen utan att se butiken. Spara aldrig artikeldata i repot: grossistens kundpriser är konfidentiella (`out/` är ignorerad av git).

## Varför en lokal webbläsare och inte Cloudflare Browser Run
Cloudflare har Live View, överlämning till människa och Puppeteer-styrning (enligt paketets typer, dokumentationen går inte att nå härifrån). Men jag kan inte bevisa att det räcker utan ett konto och åtkomst till butiken, 30 minuter kräver betalplan, webbläsaren körs från ett datacenter med signaturrubriker som inte går att ta bort (risk för spärr), och Cloudflare-bygget för repot är sedan tidigare trasigt. Den lokala vägen går att bevisa, kostar inget och använder floristens egen dator och adress. Kärnan (skydd, agent, extraktion, beräkning) är oberoende av var webbläsaren körs.

## Filer
`src/guard.mjs` skrivskyddet · `src/capture.mjs` sidans egna JSON-svar · `src/extract.mjs` tolkning och normalisering · `src/plan.mjs` inköpsberäkning (använder `public/js/core/purchase.js`, läses bara) · `src/tools.mjs` agentens verktyg · `src/agent.mjs` AI-slingan · `src/session.mjs` sessionen (login, agent, radering) · `src/server.mjs` kontrollsidan · `src/launch.mjs` Chrome · `src/cli.mjs` start.
