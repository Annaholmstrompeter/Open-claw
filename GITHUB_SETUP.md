# Enkla steg för att säkra Aethers minnen på GitHub

## Steg 1: Skapa GitHub-konto (gratis)
1. Gå till: https://github.com
2. Klicka "Sign up"
3. Fyll i:
   - E-post: (din e-post)
   - Lösenord: (välj ett säkert)
   - Användarnamn: (t.ex. "Anna-Assistent" eller liknande)
4. Verifiera e-postadressen

## Steg 2: Skapa nytt repository
1. Logga in på GitHub
2. Klicka "+" uppe till höger → "New repository"
3. Fyll i:
   - Repository name: `aether-memory` (eller vad du vill)
   - Description: `Aethers minnen och konfiguration`
   - Välj **Private** (viktigt! så ingen annan ser)
   - Lämna resten som det är
4. Klicka "Create repository"

## Steg 3: Skapa access token
1. Klicka på din profilbild uppe till höger → "Settings"
2. I vänstermenyn: "Developer settings"
3. Välj "Personal access tokens" → "Tokens (classic)"
4. Klicka "Generate new token" → "Generate new token (classic)"
5. Fyll i:
   - Note: `Aether Backup`
   - Expiration: Välj "90 days" (längre är bättre)
   - Under "Select scopes", kryssa i:
     - [x] `repo` (full kontroll av privata repositories)
     - [x] `workflow` (om vi vill automatisera mer senare)
6. Klicka "Generate token"
7. **VIKTIGT**: Kopiera token som visas (den visas bara en gång!)

## Steg 4: Ge token till Aether
Skicka mig token i ett meddelande så:
```
GitHub token: ghp_xxxxxxxxxxxxxxxxxxxx
Repository: anna-username/aether-memory
```

## Vad händer sedan?
Jag länkar vårt lokala minnesarkiv till ditt GitHub. Varje natt kommer robotjobbet att:
1. Kolla om det finns nya minnen
2. Skicka upp dem till GitHub
3. Allt sparas både på din dator OCH på GitHub

## Om du vill avsluta
- Du kan när som helst ta bort token på GitHub
- Du kan ta bort repositoryt
- Allt finns fortfarande på din dator

## Support
Om du fastnar, skicka skärmbild eller beskriv vad som händer så hjälper jag dig genom det! ✨