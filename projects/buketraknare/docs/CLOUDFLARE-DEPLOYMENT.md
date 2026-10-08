# Cloudflare-bygget som fallerar: diagnos

**Status:** inget är ändrat i Cloudflare. Den exakta felraden saknas ännu eftersom byggloggen kräver inloggning. Det här är vad som är säkert, vad som är trolig orsak och vad som behövs.

## Säkra fakta

- Det finns **en** Cloudflare-koppling mot repot, bygget "Workers Builds: open-claw". Workern `open-claw` är **Ledtråds** (`ledtrad-app/wrangler.toml`: `name = "open-claw"`).
- Buketträknarens egen Worker (`buketraknare`) **har aldrig skapats**. Ingenting av Buketträknaren har alltså driftsatts.
- Resultat per PR (kontrollerat via GitHub):

  | PR | Datum | Innehåll | Bygge |
  |----|-------|----------|-------|
  | #5 | 16 aug | Ledtråd + Durable Object | misslyckades |
  | #6 | 16 aug | Ledtråd, ovanpå #5 | lyckades |
  | #7 | 18 aug | Valkompassen | misslyckades |
  | #8 | 23 aug | Världens underverk | misslyckades |
  | #9 | 7 okt | Buketträknaren | misslyckades |

- #5 och #6 återställdes från `master` samma dag. Det tog bort Durable Object-konfigurationen ur `ledtrad-app/wrangler.toml`. Sedan dess har varje PR-bygge misslyckats, oavsett innehåll.
- Buketträknarens kod är inte orsaken. `wrangler deploy --dry-run` mot en ren kopia (wrangler 4.148.0, efter `npm ci`) paketerar felfritt med `INBOX`, `LIMITER`, assets och `READ_DAILY_LIMIT`. Det gäller också efter att datamodell och tester lagts till.

**Slutsats (hög säkerhet):** felet gäller hela repot och beror inte på något i PR #9 eller PR #10.

## Trolig orsak (medel säkerhet)

Ledtråd-Workern har ett Durable Object-tillstånd som inte längre stämmer med koden på `master`. #5 introducerade en Durable Object. Icke-produktionsbyggen kör enligt min förståelse `wrangler versions upload`, som inte kan skapa nya Durable Object-klasser (därför föll just det första bygget, #5, men inte #6 när klassen redan fanns i produktion). När `master` sedan återställdes saknar koden en klass som produktionsworkern fortfarande har, och efterföljande uppladdningar kan avvisas tills klassen tas bort med en uttrycklig migrering.

Detta är ett resonemang utifrån historiken, inte en bekräftad felrad. Två andra förklaringar utesluts inte av historiken: att bygge-token eller behörighet ändrats eller gått ut efter 16 aug, och att bygginställningar (root directory, byggkommando) ändrats i dashboarden efter #6.

## Det som behövs: byggloggen

Öppna byggloggen för PR #9 (länk i Cloudflares kommentar på PR:en, eller `https://dash.cloudflare.com/` → Workers & Pages → `open-claw` → Builds) och skicka de röda raderna.

| Det loggen säger (ungefär) | Betyder | Åtgärd |
|----------------------------|---------|--------|
| *Durable Object class … migration / deleted_classes / not exported* | Trolig orsak stämmer | Lägg en migrering som tar bort `ReminderScheduler` i `ledtrad-app/wrangler.toml` och deploya en gång från `master`. Rör inte Buketträknaren. |
| *Missing entry-point / no wrangler config / could not find …* | Root directory pekar fel | Rätta root directory för `open-claw` till `ledtrad-app`. |
| *Authentication / token / permission / unauthorized* | Bygge-token ogiltig | Återskapa token under Settings → Builds. |
| Något annat | Okänt | Skicka raderna. |

## Det som behövs för Buketträknaren oavsett

1. **Skapa en egen Worker `buketraknare`** via Import a repository med Root directory `projects/buketraknare`. Rör inte `open-claw`-kopplingen.
2. **Sätt "build watch paths"** för båda Workers (`ledtrad-app/*` respektive `projects/buketraknare/*`) så att en PR som rör något annat inte bygger fel app.
3. **Första driftsättningen måste vara ett produktionsbygge** (eller en körning av `wrangler deploy`), eftersom `wrangler.toml` har Durable Object-migreringar (`Inbox`, `Limiter`) som en versionsuppladdning inte kan skapa (enligt min förståelse, ej verifierat).
4. `package.json` har nu `jsdom` som utvecklingsberoende (för testerna). Cloudflares bygge installerar det också, vilket tar några sekunder extra men inte påverkar driftsättningen. Behövs det kan byggkommandot ändras till att hoppa över utvecklingsberoenden, men det är inte gjort.
5. **Ändra ingenting i Cloudflare förrän loggen är läst.**
