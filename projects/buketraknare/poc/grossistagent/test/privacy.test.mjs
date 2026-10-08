// Det som skickas till AI-modellen ska vara så litet som möjligt: aldrig lösenord, cookies, token, personuppgifter eller kontodata, bara det som krävs för att navigera bland produkter.
// Dels sållet i sig (privacy.mjs), dels hela vägen: en fientlig påhittad butik som skriver ut sådant i sidan, i adressen och i sina JSON-svar, och att inget av det når modellens förfrågningar
// medan artikelnummer, namn och priser bevaras exakt. Sållet är bäst möjligt och mönsterbaserat; testet visar vad det klarar, inte att det kan klara allt.
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { scrubText, scrubTokens, scrubUrl, scrubValue, isSensitiveKey } from '../src/privacy.mjs';
import { createSession } from '../src/session.mjs';
import { CHROME } from './support/browser.mjs';
import { scripted, toolUse, endTurn, parse } from './support/fake-client.mjs';

test('scrubText: e-post, telefon, personnummer, token, långa nycklar och "inloggad som" tas bort; artikelnummer, priser och mått rörs inte', () => {
  const dold = '[dolt]';
  for (const [inp, bad] of [
    ['Skriv till anna.svensson@exempel.se för frågor', 'anna.svensson@exempel.se'],
    ['Ring 070-123 45 67 eller 08-123 45 67', '070-123 45 67'], ['Ring 08-123 45 67', '08-123 45 67'], ['Telefon +46 70 123 45 67', '+46 70 123 45 67'],
    ['Personnummer 850101-1234', '850101-1234'], ['Org 19850101-1234', '19850101-1234'],
    ['Authorization: Bearer abcdefghijklmnop1234567890', 'abcdefghijklmnop1234567890'],
    ['jwt eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0In0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV', 'eyJhbGciOiJIUzI1NiJ9'],
    ['sid aB3dE5gH7jK9mN1pQ3sT5vX7zA9cE1gI3kM5', 'aB3dE5gH7jK9mN1pQ3sT5vX7zA9cE1gI3kM5'], ['hash 0123456789abcdef0123456789abcdef', '0123456789abcdef0123456789abcdef'],
    ['Inloggad som Anna Svensson, kundnr 12345.', 'Anna Svensson'], ['Hej Anna! Välkommen tillbaka', 'Hej Anna'], ['Kundnummer: 998877', '998877'], ['Leveransadress: Storgatan 1, 111 22 Stockholm', 'Storgatan']
  ]) {
    const out = scrubText(inp);
    assert.ok(!out.includes(bad), '"' + bad + '" ska bort ur "' + inp + '" men blev "' + out + '"');
    assert.ok(out.includes(dold), 'markerat som dolt: ' + out);
  }
  for (const keep of ['Ros Avalanche 60 cm 20-pack', 'R-1001', '118,00 kr', 'EAN 7350012345678', '0123-456-789', 'artikel 12345678', 'Veckans erbjudande: 15 % rabatt', 'Hej och välkommen', '2026-10-08', 'ros-avalanche-60-cm-20-pack-vit-kvalitet-1']) assert.equal(scrubText(keep), keep, 'ska inte ändras: ' + keep);
});

test('scrubUrl: ursprung och sökväg behålls, parametrarnas värden och fragment tas bort (de kan vara sessions-id eller token)', () => {
  assert.equal(scrubUrl('https://shop.exempel.se/produkt/ros-avalanche-60-cm?session=HEMLIGT&q=ros#frag'), 'https://shop.exempel.se/produkt/ros-avalanche-60-cm?session=…&q=…');
  assert.equal(scrubUrl('https://shop.exempel.se/sortiment'), 'https://shop.exempel.se/sortiment');
  assert.ok(!scrubUrl('https://x.se/a?token=eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.abcdefghijk').includes('eyJ'));
  assert.equal(scrubTokens('/produkt/0123-456-789'), '/produkt/0123-456-789', 'artikelnummer i adresser rörs inte av tokensållet');
  assert.ok(!scrubTokens('/reset/aB3dE5gH7jK9mN1pQ3sT5vX7zA9cE1gI3kM5').includes('aB3dE5gH7'));
});

test('scrubValue: känsliga nycklar och personbehållare döljs, siffror och produktfält bevaras exakt', () => {
  const inp = { user: { email: 'a@b.se', name: 'Anna' }, token: 'x', session: { id: 's' }, kundnr: '77', adress: { gata: 'Storgatan 1' },
    resultat: { antal: 2, artiklar: [{ artikelnr: '0123-456-789', benamning: 'Ros Avalanche 60 cm', pris: { belopp: 118.5, per: 'förp', inklmoms: false }, forpackning: { antal: 20 }, lager: { status: 'I lager' }, kampanj: null, password: 'p' }] } };
  const out = scrubValue(inp);
  assert.equal(out.user, '[dolt]'); assert.equal(out.token, '[dolt]'); assert.equal(out.session, '[dolt]'); assert.equal(out.adress, '[dolt]');
  assert.ok(!JSON.stringify(out).includes('Anna') && !JSON.stringify(out).includes('Storgatan') && !JSON.stringify(out).includes('"77"'));
  const row = out.resultat.artiklar[0];
  assert.deepEqual([row.artikelnr, row.benamning, row.pris.belopp, row.pris.per, row.pris.inklmoms, row.forpackning.antal, row.lager.status, row.kampanj, row.password], ['0123-456-789', 'Ros Avalanche 60 cm', 118.5, 'förp', false, 20, 'I lager', null, '[dolt]']);
  assert.equal(out.resultat.antal, 2);
  for (const key of ['password', 'losenord', 'access_token', 'Authorization', 'cookie', 'sessionId', 'csrfToken', 'email', 'epost', 'telefon', 'phone', 'personnummer', 'kundnummer', 'customer_name', 'firstName', 'iban', 'phoneNumber', 'emailAddress', 'customerNo', 'userName', 'accessToken', 'shippingAddress', 'customerInfo', 'userData']) assert.ok(isSensitiveKey(key), key + ' ska vara känslig');
  for (const key of ['name', 'benamning', 'artikelnr', 'pris', 'price', 'forpackning', 'color', 'farg', 'length', 'langd_cm', 'lager', 'kampanj', 'sort', 'variant', 'antal', 'enhet', 'valuta', 'author', 'authority', 'packSize', 'priceUnit', 'lengthCm', 'itemName', 'productName']) assert.ok(!isSensitiveKey(key), key + ' ska inte vara känslig');
});

test('scrubValue sållar strängar under vanliga nycklar, men låter artikelnummer och adresser vara (de undantas bara från telefon- och personmönster, inte från token)', () => {
  const out = scrubValue({ anmarkning: 'mejla anna@exempel.se', djupt: [{ text: 'ring 070-123 45 67', ok: 'Ros Avalanche' }], hash: '12345678901234567890123456789012' });
  assert.deepEqual(out, { anmarkning: 'mejla [dolt]', djupt: [{ text: 'ring [dolt]', ok: 'Ros Avalanche' }], hash: '[dolt]' });
  const ph = '012-345 67 89';                                                      // ser ut som ett telefonnummer, men är här ett artikelnummer
  const keep = { artikelnr: ph, id: ph, nr: ph, href: '/produkt/' + ph, url: 'https://x.se/produkt/0123-456-789' };
  assert.deepEqual(scrubValue(keep), keep, 'artikelnummer och adresser rörs inte av telefonmönstret');
  assert.deepEqual(scrubValue({ beskrivning: ph }), { beskrivning: '[dolt]' }, 'under en vanlig nyckel kan samma text vara ett telefonnummer: den döljs hellre än visas');
  assert.equal(scrubValue({ id: 'aB3dE5gH7jK9mN1pQ3sT5vX7zA9cE1gI3kM5' }).id, '[dolt]', 'men en lång token under en id-nyckel döljs ändå');
  assert.equal(scrubText('md5 12345678901234567890123456789012'), 'md5 [dolt]');
});

// -------- hela vägen: en fientlig butik --------
const SECRET_SESSION = 'SUPERHEMLIGTSESSIONSID12345', EMAIL = 'anna.svensson@exempel.se', PHONE = '070-123 45 67', NAME = 'Anna Svensson', KUNDNR = '4711', JWT = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiI0NzExIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV', PASSWORD = 'Lösen-ord-9876';
const ARTNR = '0123-456-789';

function startHostileShop() {
  const requests = [];
  const html = `<!doctype html><meta charset="utf-8"><title>Butiken, inloggad som ${NAME}</title>
<h1>Sortiment</h1><p>Inloggad som ${NAME}, kundnr ${KUNDNR}. Frågor? ${EMAIL} eller ${PHONE}.</p>
<a href="/produkt/${ARTNR}?session=${SECRET_SESSION}">Ros Avalanche</a> <a href="/konto?token=${JWT}">Mitt konto (${EMAIL})</a>
<form action="/sok"><input type="search" name="q" placeholder="Sök artikel" aria-label="Sök artikel"><button>Sök</button></form>
<script>
fetch('/api/me').then(r => r.json()); fetch('/api/products?q=ros').then(r => r.json());
</script>`;
  const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x'); requests.push(req.method + ' ' + u.pathname + u.search);
    const send = (type, body, headers = {}) => { res.writeHead(200, { 'content-type': type, ...headers }); res.end(body); };
    if (u.pathname === '/api/me') return send('application/json', JSON.stringify({ user: { name: NAME, email: EMAIL, phone: PHONE, customerNo: KUNDNR }, token: JWT, session: { id: SECRET_SESSION }, csrf: 'abc123def456', password: PASSWORD, roll: 'kund' }));
    if (u.pathname === '/api/products') return send('application/json', JSON.stringify({ resultat: { antal: 1, artiklar: [{ nr: ARTNR, namn: 'Ros Avalanche 60 cm', pris: 118.5, forp: 20, farg: 'Vit', langd: 60, lager: 'I lager', kontaktperson: NAME }] } }));
    return send('text/html; charset=utf-8', html, { 'set-cookie': 'sid=' + SECRET_SESSION + '; Path=/; HttpOnly' });
  });
  return new Promise(r => server.listen(0, '127.0.0.1', () => r({ url: 'http://127.0.0.1:' + server.address().port, requests, close: () => new Promise(x => { server.closeAllConnections?.(); server.close(() => x()); }) })));
}

test('en fientlig butik skriver ut lösenord, token, sessions-id, e-post, telefon, namn och kundnummer i sidan, adressen och JSON-svaren: inget av det når modellen, men artikelnummer, namn och priser bevaras exakt', async () => {
  const shop = await startHostileShop();
  const FIELDS = { id: 'nr', name: 'namn', color: 'farg', lengthCm: 'langd', packSize: 'forp', price: 'pris', availability: 'lager' };
  let ids = {};
  const client = scripted([
    toolUse('goto', { url: '/?session=' + SECRET_SESSION + '&token=' + JWT }),
    toolUse('observe', { include_text: true }),
    (req, results) => { const j = parse(results[0]).json_svar; ids.me = j.find(x => x.path === '/api/me').id; ids.prod = j.find(x => x.path.startsWith('/api/products')).id; return toolUse('inspect_json', { response_id: ids.me }); },
    () => toolUse('inspect_json', { response_id: ids.prod, path: 'resultat.artiklar' }),
    () => toolUse('set_extraction', { source: 'json', response_id: ids.prod, items_path: 'resultat.artiklar', fields: FIELDS, price_unit: 'pack', price_includes_vat: false, currency: 'SEK' }),
    toolUse('find_products', { text: 'ros' }),
    toolUse('report_candidates', { picks: [{ id: ARTNR, reason: 'Passar', needed: 25 }], summary: 'En ros.' })
  ]);
  const s = await createSession({ shopUrl: shop.url + '/', mode: 'demo', executablePath: CHROME, headless: true, extraArgs: ['--no-sandbox'], client, limits: { minGapMs: 0 } });
  try {
    await s.confirmLogin();
    const res = await s.ask('Hitta vita rosor. Jag behöver ungefär 25.');
    assert.equal(res.stop, 'klar', res.error);
    // det programmet skickar TILL modellen: systemtext, verktygsbeskrivningar, användarens uppgift och verktygens resultat (modellens egna anrop är manuset och räknas inte)
    const last0 = client.requests.at(-1);
    const toModel = JSON.stringify([last0.system, last0.tools, last0.messages.filter(m => m.role === 'user')]);
    for (const secret of [SECRET_SESSION, EMAIL, PHONE, NAME, KUNDNR, JWT, 'eyJhbGciOi', PASSWORD, 'abc123def456']) assert.ok(!toModel.includes(secret), '"' + secret + '" nådde modellen: ' + toModel.slice(Math.max(0, toModel.indexOf(secret) - 120), toModel.indexOf(secret) + 60));
    // sådant som modellen behöver finns kvar
    assert.ok(toModel.includes('Sortiment') && toModel.includes('Sök artikel'), 'rubriker och fält för navigering finns kvar');
    assert.ok(toModel.includes(ARTNR), 'artikelnumret bevarades i det modellen såg');
    const last = res; const pick = last.picks.picks[0];
    assert.deepEqual([pick.product.id, pick.product.name, pick.product.packSize, pick.product.packPrice, pick.plan.packs, pick.plan.bought, pick.plan.leftover, pick.plan.cost], [ARTNR, 'Ros Avalanche 60 cm', 20, '118.50', 2, 40, 15, '237 kr']);
    // sessions-id i adressen visas aldrig, men parameternamnen gör det
    const urls = last0.messages.flatMap(m => Array.isArray(m.content) ? m.content : []).filter(b => b.type === 'tool_result').map(b => b.content).join('\n');
    assert.match(urls, /\?session=…&token=…/);
    // webbläsaren skickar förstås sin cookie till butiken, men den syns inte för modellen (verktygen läser aldrig cookies eller rubriker)
    assert.ok(!/set-cookie|cookie/i.test(toModel.replace(/"name":"[^"]*"/g, '')) || !toModel.includes('sid='), 'cookien nådde modellen');
  } finally { await s.end(); await shop.close(); }
});
