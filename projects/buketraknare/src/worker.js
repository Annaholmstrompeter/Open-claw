// Brevlåda för Buketträknaren.
// Assistenten (till exempel ChatGPT Work) lämnar in prislistan på /leverera/KOD,
// och appen hämtar den på /api/inbox/KOD. Varje kod är slumpad i appen, gäller
// en halvtimme och töms när den hämtats. Här sparas bara en tabell med priser.

const CODE_RE = /^[A-Za-z0-9_-]{20,64}$/;
const MAX_CHARS = 20000;
const TTL_MS = 30 * 60 * 1000;

const SEC = {
  'cache-control': 'no-store',
  'x-robots-tag': 'noindex',
  'referrer-policy': 'no-referrer',
  'x-content-type-options': 'nosniff'
};
const json = (o, status = 200) =>
  new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json; charset=utf-8', ...SEC } });

const html = (title, body, status = 200) =>
  new Response(
    `<!doctype html><html lang="sv"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">` +
      `<title>${title}</title><style>body{font:16px/1.5 system-ui,sans-serif;max-width:40rem;margin:2rem auto;padding:0 1rem}` +
      `textarea{width:100%;font:inherit;padding:.5rem}button{font:inherit;padding:.6rem 1.2rem;margin-top:.5rem}</style></head>` +
      `<body>${body}</body></html>`,
    {
      status,
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
        ...SEC
      }
    }
  );

const formPage = () =>
  html(
    'Lämna in priser',
    '<h1>Lämna in priser</h1>' +
      '<p>Klistra in tabellen med priser i rutan och tryck på Skicka. Inget annat behövs.</p>' +
      '<form method="post"><label for="t">Tabell med priser</label><br>' +
      `<textarea id="t" name="t" rows="12" maxlength="${MAX_CHARS}" required></textarea><br>` +
      '<button type="submit">Skicka</button></form>'
  );

const stubFor = (env, code) => env.INBOX.get(env.INBOX.idFromName(code));

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path === '/api/ping') return json({ ok: !!env.INBOX, app: 'buketraknare' });

    let m = path.match(/^\/api\/inbox\/([^/]+)$/);
    if (m) {
      if (request.method !== 'GET') return json({ error: 'method' }, 405);
      if (!env.INBOX || !CODE_RE.test(m[1])) return json({ error: 'code' }, 400);
      const r = await stubFor(env, m[1]).fetch('https://inbox/take');
      return new Response(r.body, { status: r.status, headers: { 'content-type': 'application/json; charset=utf-8', ...SEC } });
    }

    m = path.match(/^\/leverera\/([^/]+)$/);
    if (m) {
      if (!env.INBOX || !CODE_RE.test(m[1])) return html('Ogiltig adress', '<h1>Ogiltig adress</h1><p>Koden i adressen stämmer inte.</p>', 400);
      if (request.method === 'GET') return formPage();
      if (request.method === 'POST') {
        const len = Number(request.headers.get('content-length') || 0);
        if (len > MAX_CHARS * 4) return html('För stor', '<h1>För stor</h1><p>Tabellen är för stor.</p>', 413);
        let text = '';
        try {
          text = String((await request.formData()).get('t') || '').trim();
        } catch (e) {
          return html('Fel', '<h1>Fel</h1><p>Kunde inte läsa formuläret.</p>', 400);
        }
        if (!text) return html('Tomt', '<h1>Tomt</h1><p>Rutan var tom. Gå tillbaka och klistra in tabellen.</p>', 400);
        if (text.length > MAX_CHARS) return html('För stor', '<h1>För stor</h1><p>Tabellen är för stor.</p>', 413);
        await stubFor(env, m[1]).fetch('https://inbox/put', { method: 'PUT', body: text });
        return html('Mottaget', '<h1>Tack, priserna är mottagna</h1><p>Du kan stänga den här sidan och gå tillbaka till appen.</p>');
      }
      return html('Fel', '<h1>Fel</h1><p>Metoden stöds inte.</p>', 405);
    }

    return env.ASSETS.fetch(request);
  }
};

export class Inbox {
  constructor(state) {
    this.state = state;
  }
  async fetch(request) {
    const op = new URL(request.url).pathname;
    if (op === '/put' && request.method === 'PUT') {
      await this.state.storage.put('t', await request.text());
      await this.state.storage.setAlarm(Date.now() + TTL_MS);
      return new Response('ok');
    }
    if (op === '/take') {
      const text = await this.state.storage.get('t');
      if (text === undefined) return json({ ready: false });
      await this.state.storage.deleteAlarm();
      await this.state.storage.deleteAll();
      return json({ ready: true, text });
    }
    return new Response('not found', { status: 404 });
  }
  async alarm() {
    await this.state.storage.deleteAll();
  }
}
