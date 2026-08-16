# Ledtråd

Kost-, mående- och symtomdagbok, med riktiga push-notiser (fungerar med låst
skärm) för uppföljning efter loggade måltider.

Detta är den riktiga, driftsatta versionen av appen — till skillnad från
Claude-artefakten vi testade i (som bara kunde larma medan fliken var öppen),
kör den här på ett eget hostat Cloudflare Worker-projekt med en schemalagd
bakgrundstjänst som skickar riktiga notiser via Web Push.

## Hur det hänger ihop

- `public/` — själva appen (samma UI/logik som testades i Claude-artefakten,
  plus stöd för att installera som app och prenumerera på notiser).
- `src/worker.js` — en Cloudflare Worker som (1) svarar på API-anrop för att
  spara notis-prenumerationer och schemalägga påminnelser, och (2) använder
  en Durable Object med alarm för att skicka varje påminnelse vid rätt tid.
  Minutjobbet finns kvar som ett extra säkerhetsnät.
- `wrangler.toml` — konfiguration (KV-lagring, cron-schema, statiska filer).

Bara du (som ägare av Cloudflare-kontot) behöver göra driftsättningen en
gång. Var och en som sedan använder appen behöver bara installera den på sin
egen hemskärm och trycka "tillåt" på notis-frågan — inget mer.

## Engångssetup (ca 10 minuter)

1. **Skapa ett gratis Cloudflare-konto** på https://dash.cloudflare.com om du
   inte redan har ett.

2. **Koppla repot:** Gå till *Workers & Pages → Create → Import a
   repository*, välj det här GitHub-repot, och sätt **Root directory** till
   `ledtrad-app`. Inget byggkommando behövs (statiska filer + Worker). Klicka
   Deploy.

3. **Skapa ett KV-lager** (databasen som håller koll på vem som ska
   påminnas när): *Workers & Pages → KV → Create namespace*, kalla det t.ex.
   `ledtrad-kv`.

4. **Koppla ihop KV-lagret med Workern:** Gå in på din nya Worker →
   *Settings → Bindings → Add → KV Namespace*. Variabelnamn: `LEDTRAD_KV`.
   Välj namnrymden du skapade i steg 3.
   (Säg gärna till Claude vilket KV-namespace-ID du fick, så uppdaterar
   Claude `wrangler.toml` i repot så det stämmer även vid framtida
   driftsättningar.)

5. **Lägg till den hemliga VAPID-nyckeln:** *Settings → Variables and
   Secrets → Add → typ: Secret*. Namn: `VAPID_PRIVATE_KEY`. Värdet fick du
   av Claude i chatten (inte i den här filen, av säkerhetsskäl — en privat
   nyckel ska aldrig ligga i git).

6. **Kontrollera att schemat är på:** *Settings → Triggers → Cron Triggers*
   ska visa `* * * * *` (varje minut). Det är ett säkerhetsnät för Durable
   Object-alarmen och kommer automatiskt från `wrangler.toml`.

7. **Öppna appen på din telefon** (URL:en Cloudflare gav dig, t.ex.
   `ledtrad.<ditt-konto>.workers.dev`), tryck **"Lägg till på hemskärmen"**
   (Chrome: meny → Lägg till på startskärmen. Safari/iPhone: dela-ikonen →
   Lägg till på hemskärmen).

8. Öppna appen **från hemskärmsikonen** (inte webbläsaren), gå till
   **Inställningar → Aktivera påminnelser**, och tryck **Tillåt** när
   telefonen frågar.

Klart! Från och med nu skickas en riktig notis 30 minuter och 2 timmar efter
varje loggad måltid, även med låst skärm.

En obesvarad uppföljning ligger kvar utan tidsgräns. När nästa måltid ska
loggas får användaren en sista chans att checka in för den föregående
måltiden. Därefter stängs den gamla uppföljningen och fokus flyttas till den
nya måltiden.

## Efter setup

Framtida kodändringar (som Claude gör och pushar till repot) driftsätts
automatiskt av Cloudflare inom någon minut — inget du behöver göra.

## Integritet

Din faktiska logg (mat, mående, symtom) sparas bara lokalt i telefonens
webbläsare, precis som innan. Servern lagrar bara det minimala som krävs för
att kunna skicka en notis i rätt tid: en anonym enhets-id, din
notis-prenumeration, och en kort påminnelsetext ("Hur kändes det efter
lunch?") som tas bort så fort den skickats.
