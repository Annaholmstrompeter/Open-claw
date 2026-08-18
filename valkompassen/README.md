# Valkompassen

En faktabaserad, källbelagd valkompass. Användaren tar ställning i ett tiotal
sakfrågor (med en kort neutral faktabrief per fråga), viktar hur viktig varje
fråga är, och får en matchning mot riksdagspartierna räknad på deras
källbelagda positioner — inte på gissningar. En AI-driven faktaassistent
(grundad enbart i samma källbelagda data) svarar sedan på följdfrågor om
resultatet, utan att ge röstningsrekommendationer eller böja svaren efter vad
användaren verkar vilja höra.

## Hur det hänger ihop

- `public/` — själva appen (statiska filer: `index.html`, `app.js`,
  `styles.css`, `manifest.json`).
- `public/data/parties.json` — de 8 riksdagspartierna (namn, färg, kort
  neutral beskrivning).
- `public/data/issues.json` — sakfrågorna: en faktabrief, en poängsatt axel
  (-2 till +2), och varje partis position med källa per fråga.
- `public/data/METHODOLOGY.md` — transparens-text om hur datan togs fram och
  dess begränsningar, visas i appens "Metodik & källor".
- `src/worker.js` — en Cloudflare Worker som (1) serverar de statiska
  filerna, och (2) svarar på `/api/chat` genom att anropa Claude API med ett
  systemprompt som är strikt låst till datan i `issues.json`/`parties.json`.
- `wrangler.toml` — konfiguration (statiska filer + Worker, ingen
  databas/KV behövs).

Kompassen (frågor, matchning, källor) fungerar helt utan AI-nyckel. Bara
chattfunktionen ("Fråga faktaassistenten") kräver att `ANTHROPIC_API_KEY` är
satt — annars visar den bara ett vänligt felmeddelande.

## Engångssetup (ca 5 minuter)

1. **Skapa ett gratis Cloudflare-konto** på https://dash.cloudflare.com om du
   inte redan har ett (samma konto som för `ledtrad-app` går bra).

2. **Koppla repot:** *Workers & Pages → Create → Import a repository*, välj
   det här GitHub-repot, och sätt **Root directory** till `valkompassen`.
   Inget byggkommando behövs (statiska filer + Worker). Klicka Deploy.

3. **(Valfritt, för AI-chatten) Lägg till Anthropic-nyckeln:** *Settings →
   Variables and Secrets → Add → typ: Secret*. Namn: `ANTHROPIC_API_KEY`.
   Utan den här fungerar hela kompassen ändå — bara chatten är avstängd.

4. **Öppna appen** på URL:en Cloudflare gav dig (t.ex.
   `valkompassen.<ditt-konto>.workers.dev`), eller koppla en egen domän under
   *Custom Domains* när ni är redo att lansera publikt.

## Efter setup

Framtida kodändringar (som Claude gör och pushar till repot) driftsätts
automatiskt av Cloudflare inom någon minut — inget du behöver göra.

## Lokal utveckling

```
cd valkompassen
npm install
npm run dev      # startar wrangler dev lokalt
npm run deploy   # manuell deploy (görs annars automatiskt av Cloudflare)
```

## Metodik i korthet

Se `public/data/METHODOLOGY.md` för fullständig text (visas även i appen).
Matchningsprocenten räknas fram genom att jämföra användarens svar (viktade
efter hur viktig de sa att frågan var) mot varje partis källbelagda
poängsatta position i samma sakfråga — inte genom att AI:n tolkar eller
gissar. AI-chatten är strikt instruerad att bara använda den källbelagda
datan, ange källa, aldrig ge röstningsrekommendationer, och aldrig böja svar
för att vara till lags.

## Nästa steg (inte i v1)

- Betald fördjupad rapport/personlig "utbildningsplan" (Stripe) — hölls
  utanför v1 för att inte försena lanseringen; kan läggas till som ett nytt
  API-anrop + betalvägg framför en fördjupad resultatvy.
- Fler sakfrågor / regionala/kommunala kompasser.
- Enkla ikoner + fullständig PWA-installation (manifest finns redan).
