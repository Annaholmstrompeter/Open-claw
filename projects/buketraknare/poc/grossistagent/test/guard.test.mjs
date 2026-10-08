// Skrivskyddet, ren logik. Alla adresser är påhittade (shop.exempel.test).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createGuard, isReadOnlyGraphql, hostMatches, safePath, RISKY_TEXT_RE } from '../src/guard.mjs';

const SHOP = 'shop.exempel.test';
const agent = (over = {}) => { const g = createGuard({ hosts: [SHOP], ...over }); g.setPhase('agent'); return g; };
const req = (method, path, over = {}) => ({ method, url: 'https://' + SHOP + path, resourceType: over.resourceType || (method === 'GET' ? 'xhr' : 'fetch'), isNavigation: false, ...over });
const ok = (g, r) => g.decide(r).allow;

test('inloggningsfasen släpper igenom allt (människan styr), agentfasen börjar nekande', () => {
  const g = createGuard({ hosts: [SHOP] });
  assert.equal(g.phase, 'login');
  assert.equal(ok(g, req('POST', '/login')), true);
  assert.equal(ok(g, { method: 'GET', url: 'https://sso.annan.test/auth', resourceType: 'document', isNavigation: true }), true);
  g.setPhase('agent');
  assert.equal(ok(g, req('POST', '/login')), false);
  assert.equal(ok(g, { method: 'GET', url: 'https://sso.annan.test/auth', resourceType: 'document', isNavigation: true }), false);
  assert.throws(() => g.setPhase('annat'), /okänd fas/);
});

test('läsande metoder släpps igenom, alla skrivande metoder nekas som standard', () => {
  const g = agent();
  for (const m of ['GET', 'HEAD', 'OPTIONS']) assert.equal(ok(g, req(m, '/api/products?q=ros')), true, m);
  for (const m of ['POST', 'PUT', 'PATCH', 'DELETE', 'post', 'PROPFIND']) assert.equal(ok(g, req(m, '/api/products')), false, m);
  assert.equal(g.decide(req('POST', '/api/products')).reason, 'skrivande metod (POST) nekas som standard');
});

test('sökvägar för varukorg, kassa, beställning och utloggning nekas för ALLA metoder, även GET', () => {
  const g = agent();
  const denied = ['/cart', '/cart/add', '/api/cart/add', '/api/v1/cart', '/basket', '/varukorg', '/varukorgen/lagg-till', '/kundvagn', '/checkout', '/checkout/step2', '/kassa', '/kassan',
    '/betala', '/payment/confirm', '/order', '/orders/123', '/order/submit', '/api/orders', '/bestall', '/best%C3%A4ll', '/best%C3%A4llning/ny', '/logout', '/logga-ut', '/signout',
    '/account/delete', '/produkt/12/remove', '/purchase', '/buy/12', '/api/cart.json', '/a_cart_b', '/produkt/123?add=1', '/sortiment?action=add&id=5', '/sortiment?addtocart=5',
    '/produkt?add-to-cart=12', '/produkt?add_to_cart=12', '/x?remove=3', '/x?delete=3', '/x?action=checkout', '/x?cmd=buy', '/x?q=ros&buy=1', '/%EF%BC%8Fcart'];
  for (const p of denied) for (const m of ['GET', 'POST']) assert.equal(ok(g, req(m, p)), false, m + ' ' + p);
});

test('vanliga läsande adresser nekas inte av misstag', () => {
  const g = agent();
  const allowed = ['/', '/sortiment', '/sortiment?q=vit+ros&sida=2', '/sok?q=order', '/sok?q=cart&sort=pris', '/produkt/123', '/produkt/avalanche-60', '/api/products?query=rose&sort=price',
    '/api/products?color=white&length=60', '/sortiment/kategori/rosor', '/border/blommor', '/recorder', '/sortiment?valuta=sek&addr=1', '/api/search?term=checkout-fri-frakt'];
  for (const p of allowed) assert.equal(ok(g, req('GET', p)), true, p);
});

test('GraphQL: läsande frågor släpps igenom, mutationer, prenumerationer och trasig JSON nekas', () => {
  const g = agent();
  const gql = body => ({ ...req('POST', '/graphql'), postData: typeof body === 'string' ? body : JSON.stringify(body) });
  assert.equal(ok(g, gql({ query: 'query Search($q:String){ products(q:$q){ sku name } }', variables: { q: 'ros' } })), true);
  assert.equal(ok(g, gql({ query: '{ products { sku } }' })), true);
  assert.equal(ok(g, gql([{ query: 'query A { a }' }, { query: 'query B { b }' }])), true);
  for (const bad of [{ query: 'mutation AddToCart($id:ID){ addToCart(id:$id){ ok } }' }, { query: 'MUTATION x { y }' }, { query: 'query A { a }  mutation B { b }' }, { query: 'subscription S { s }' },
    [{ query: 'query A { a }' }, { query: 'mutation B { b }' }], { query: 'query AddToCart { x }', operationName: 'AddToCart' }, { operationName: 'Search' }, { query: 42 }, [], 'inte json', '{"query":"query A {a}"'])
    assert.equal(ok(g, gql(bad)), false, JSON.stringify(bad));
  assert.equal(isReadOnlyGraphql(undefined), false); assert.equal(isReadOnlyGraphql('x'.repeat(300000)), false);
  assert.equal(ok(g, { ...req('POST', '/graphql') }), false);                                      // ingen kropp
  assert.equal(ok(g, gql({ query: 'query A { a }' }) && { ...gql({ query: 'query A { a }' }), url: 'https://' + SHOP + '/graphql/cart' }), false);   // sökvägsregeln går före
});

test('operatörens godkännande: bara den värd och sökväg som godkänts, aldrig något som liknar varukorg eller beställning', () => {
  const g = agent();
  assert.equal(ok(g, req('POST', '/api/search')), false);
  g.allowPostPattern({ host: SHOP, pathRegex: '^/api/search$' });
  assert.equal(ok(g, req('POST', '/api/search')), true);
  assert.equal(g.decide(req('POST', '/api/search')).reason, 'godkänt av operatören som läsande sökning');
  assert.equal(ok(g, req('POST', '/api/search/save')), false);
  assert.equal(ok(g, req('PUT', '/api/other')), false);
  assert.equal(ok(g, { ...req('POST', '/api/search'), url: 'https://annan.test/api/search' }), false);
  for (const bad of ['^/api/cart/add$', '/checkout', 'order', '^/bestall', 'varukorg']) assert.throws(() => g.allowPostPattern({ host: SHOP, pathRegex: bad }), /liknar varukorg/, bad);
  assert.throws(() => g.allowPostPattern({ host: SHOP, pathRegex: '(' }));
  assert.throws(() => g.allowPostPattern({ host: '', pathRegex: 'x' }), /värd krävs/);
  // ett brett mönster kan inte upphäva sökvägsreglerna
  g.allowPostPattern({ host: SHOP, pathRegex: '^/api/.*' });
  assert.equal(ok(g, req('POST', '/api/anything')), true);
  assert.equal(ok(g, req('POST', '/api/cart/add')), false);
  assert.equal(ok(g, req('POST', '/api/orders')), false);
  assert.equal(ok(g, req('POST', '/api/checkout')), false);
  assert.ok(g.audit().some(a => a.reason.startsWith('OPERATÖRSBESLUT')), 'beslutet syns i loggen');
  assert.equal(g.approvedPosts().length, 2);
});

test('operatörens godkännande gäller bara den värd som godkändes, även när en annan värd också är godkänd för läsning', () => {
  const g = agent({ hosts: [SHOP, 'api.exempel.test'] });
  g.allowPostPattern({ host: SHOP, pathRegex: '^/api/search$' });
  assert.equal(ok(g, req('POST', '/api/search')), true);
  assert.equal(ok(g, { method: 'POST', url: 'https://api.exempel.test/api/search', resourceType: 'fetch' }), false);
  assert.equal(ok(g, { method: 'GET', url: 'https://api.exempel.test/api/search', resourceType: 'fetch' }), true);
});

test('värdar: sidan lämnas aldrig, data hämtas bara från godkända värdar, skript från andra värdar tillåts bara som GET', () => {
  const g = agent();
  const other = (method, type, host = 'cdn.annan.test') => ({ method, url: 'https://' + host + '/x.js', resourceType: type, isNavigation: type === 'document' });
  assert.equal(ok(g, other('GET', 'document')), false);
  assert.equal(g.decide(other('GET', 'document')).reason, 'lämnar den godkända sidan');
  assert.equal(ok(g, other('GET', 'xhr')), false); assert.equal(ok(g, other('GET', 'fetch')), false); assert.equal(ok(g, other('GET', 'ping')), false);
  assert.equal(ok(g, other('GET', 'script')), true); assert.equal(ok(g, other('GET', 'stylesheet')), true);
  assert.equal(ok(g, other('POST', 'script')), false);
  assert.equal(ok(createGuard({ hosts: [SHOP], allowThirdPartyStatic: false }) && (() => { const x = createGuard({ hosts: [SHOP], allowThirdPartyStatic: false }); x.setPhase('agent'); return x; })(), other('GET', 'script')), false);
  g.addHost('api.exempel.test'); assert.equal(ok(g, other('GET', 'xhr', 'api.exempel.test')), true);
  const w = agent({ hosts: ['*.exempel.test'] });
  assert.equal(ok(w, { method: 'GET', url: 'https://a.exempel.test/x', resourceType: 'xhr' }), true);
  assert.equal(ok(w, { method: 'GET', url: 'https://exempel.test/x', resourceType: 'xhr' }), false);                   // jokern gäller underdomäner
  assert.equal(ok(w, { method: 'GET', url: 'https://evilexempel.test/x', resourceType: 'xhr' }), false);
  assert.equal(hostMatches('SHOP.Exempel.test', 'shop.exempel.test'), true); assert.equal(hostMatches('a.b.exempel.test', '*.exempel.test'), true);
});

test('bilder, media och typsnitt hämtas inte (men kan slås på), data-adresser släpps igenom lokalt', () => {
  const g = agent();
  for (const t of ['image', 'media', 'font']) assert.equal(ok(g, req('GET', '/a.png', { resourceType: t })), false, t);
  assert.equal(ok(agent({ blockHeavy: false }), req('GET', '/a.png', { resourceType: 'image' })), true);
  assert.equal(ok(g, { method: 'GET', url: 'data:image/png;base64,AAAA', resourceType: 'image' }), true);
  assert.equal(ok(g, { method: 'GET', url: 'about:blank', resourceType: 'document' }), true);
});

test('allt som är oklart nekas: ogiltig adress, okänt protokoll, tillägg i webbläsaren', () => {
  const g = agent();
  for (const url of ['inte-en-adress', 'chrome-extension://abc/x.js', 'file:///etc/passwd', 'ftp://shop.exempel.test/x', 'javascript:alert(1)'])
    assert.equal(ok(g, { method: 'GET', url, resourceType: 'document' }), false, url);
  assert.equal(ok(g, { method: 'GET', url: 'wss://' + SHOP + '/live', resourceType: 'websocket' }), true);        // websocket mot godkänd värd (kan inte avlyssnas, se README)
  assert.equal(ok(g, { method: 'GET', url: 'wss://annan.test/live', resourceType: 'websocket' }), false);
});

test('loggen innehåller aldrig frågevärden, anropskroppar eller rubriker, och är begränsad', () => {
  const g = agent({ maxAudit: 50 });
  g.decide({ ...req('GET', '/api/products?q=hemlig-sökning&token=abc123SECRET'), postData: undefined });
  g.decide({ ...req('POST', '/api/search'), postData: '{"password":"hemligt-123","token":"xyz"}' });
  const text = JSON.stringify(g.audit());
  for (const secret of ['hemlig-sökning', 'abc123SECRET', 'hemligt-123', 'xyz']) assert.ok(!text.includes(secret), 'läcker ' + secret);
  assert.ok(text.includes('q=…') && text.includes('token=…'), 'bara frågenamn');
  for (let i = 0; i < 120; i++) g.decide(req('GET', '/p/' + i));
  assert.equal(g.audit().length, 50); assert.equal(g.summary().total, 122);
  const s = g.summary(); assert.equal(s.allowed + s.blocked, s.total); assert.ok(s.reasons['läsande metod'] >= 120);
  assert.equal(safePath(new URL('https://x.test/a?b=1&b=2&c=3')), '/a?b=…&c=…');
  assert.ok(safePath(new URL('https://x.test/' + 'a'.repeat(300))).length < 130);
});

test('klick på köp-liknande knappar och länkar nekas av texten (andra försvarslinjen)', () => {
  for (const t of ['Lägg i varukorg', 'Köp', 'Köp nu', 'Beställ', 'Gå till kassan', 'Add to cart', 'Buy now', 'Checkout', 'Place order', 'Betala', 'Bekräfta order', 'Slutför köp', 'Ta bort', 'Spara', 'Ändra uppgifter', 'Logga ut', 'Sign out', 'Submit', 'Skicka', 'btn-add-to-cart', 'Prenumerera'])
    assert.ok(RISKY_TEXT_RE.test(t), t);
  for (const t of ['Sök', 'Visa fler', 'Nästa sida', 'Rosor', 'Avalanche 60 cm', 'Sortera', 'Filtrera', 'Vit', 'Visa detaljer', 'Tillbaka'])
    assert.ok(!RISKY_TEXT_RE.test(t), t);
});
