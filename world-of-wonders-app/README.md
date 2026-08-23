# Världens underverk

En lekfull app där du kan utforska världens åtta stora underverk (de nya sju
världsundren plus Giza-pyramiderna) och testa dig själv i ett quiz om vilket
land de ligger i.

- **Utforska** — bläddra bland korten, tryck på ett för fakta, byggår och en
  länk till Google Maps. Eller tryck "Slumpa ett underverk" för en
  överraskning.
- **Quiz** — åtta flervalsfrågor, poäng och "spela igen".

Helt fristående app utan server eller databas — allt ligger i `public/` och
körs direkt i webbläsaren. Fungerar offline efter första besöket och går att
lägga till på hemskärmen som en vanlig app (PWA).

## Köra lokalt

Öppna bara `public/index.html` i en webbläsare, eller kör en enkel
filserver i den här mappen, t.ex.:

```
npx serve public
```

## Driftsätta (valfritt, ca 2 minuter)

Vill du ha en riktig webbadress att öppna på mobilen räcker gratis
**Cloudflare Pages**:

1. Gå till https://dash.cloudflare.com → **Workers & Pages → Create → Pages
   → Connect to Git**, och välj det här GitHub-repot.
2. Sätt **Root directory** till `world-of-wonders-app/public`.
3. Lämna byggkommando tomt (det behövs inget bygge — det är bara statiska
   filer). Klicka **Deploy**.
4. Öppna URL:en du får (t.ex. `varldens-underverk.pages.dev`) på mobilen och
   tryck **"Lägg till på hemskärmen"** för att installera den som en app.

Framtida ändringar som pushas till repot driftsätts automatiskt av
Cloudflare inom någon minut.

Appen fungerar precis lika bra utan detta steg — då öppnar man bara
`public/index.html` direkt eller hostar mappen var som helst som stödjer
statiska filer (GitHub Pages, Netlify, m.fl.).
