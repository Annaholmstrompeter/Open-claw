// En lokal, Anthropic-kompatibel server (POST /v1/messages) för tester. Den används med den RIKTIGA SDK:n över riktig HTTP, så att kopplingen,
// rubrikerna, felhanteringen och meddelandeprotokollet provas på riktigt. Men svaren är ett MANUS: det är inte en AI och bevisar inget om modellens omdöme.
// Servern kontrollerar sådant som den riktiga API:n kontrollerar, och samlar alla brott i violations (ska vara tomt):
//   - x-api-key stämmer, anthropic-version finns, ingen authorization-rubrik
//   - kroppen har bara kända nycklar, model, max_tokens, messages (turordning user/assistant), tools med giltiga scheman
//   - varje verktygsanrop (tool_use) besvaras i nästa användarmeddelande med exakt ett tool_result per id, före all annan text
//   - assistentens förra svar skickas tillbaka oförändrat (inklusive tänkande-block)
import http from 'node:http';

const ALLOWED = new Set(['model', 'max_tokens', 'system', 'tools', 'messages', 'output_config', 'thinking', 'tool_choice', 'stream', 'temperature', 'metadata', 'stop_sequences', 'top_p', 'top_k']);

export function startFakeAnthropic({ key = 'sk-ant-api03-TESTKEY-0123456789abcdefghijklmnop', steps = [], rejectEffort = false, delayMs = 0 } = {}) {
  const requests = [], violations = [];
  let i = 0, lastContent = null, effortRejections = 0;
  const err = (res, status, type, message) => { res.writeHead(status, { 'content-type': 'application/json', 'request-id': 'req_fake' }); res.end(JSON.stringify({ type: 'error', error: { type, message } })); };

  function validate(body) {
    const v = m => violations.push(m);
    for (const k of Object.keys(body)) if (!ALLOWED.has(k)) v('okänd nyckel i kroppen: ' + k);
    if (typeof body.model !== 'string' || !body.model) v('model saknas');
    if (!Number.isInteger(body.max_tokens) || body.max_tokens < 1) v('max_tokens ogiltig');
    if (!Array.isArray(body.messages) || !body.messages.length) { v('messages saknas'); return; }
    if (body.messages[0].role !== 'user') v('första meddelandet ska vara user');
    body.messages.forEach((m, n) => { if (m.role !== (n % 2 === 0 ? 'user' : 'assistant')) v('turordningen bryts vid meddelande ' + n); });
    for (const t of body.tools || []) {
      if (!/^[a-zA-Z0-9_-]{1,64}$/.test(t.name || '')) v('ogiltigt verktygsnamn: ' + t.name);
      if (!t.input_schema || t.input_schema.type !== 'object') v('input_schema.type ska vara object: ' + t.name);
      if (typeof t.description !== 'string') v('beskrivning saknas: ' + t.name);
    }
    body.messages.forEach((m, n) => {
      if (m.role !== 'assistant' || !Array.isArray(m.content)) return;
      const uses = m.content.filter(b => b.type === 'tool_use');
      if (!uses.length) return;
      const next = body.messages[n + 1];
      if (!next) { v('tool_use utan svar i nästa meddelande'); return; }
      const results = Array.isArray(next.content) ? next.content : [];
      const lead = results.slice(0, uses.length);
      if (!lead.every(b => b.type === 'tool_result')) v('tool_result ska komma först i användarmeddelandet');
      const got = results.filter(b => b.type === 'tool_result').map(b => b.tool_use_id).sort().join(','), want = uses.map(b => b.id).sort().join(',');
      if (got !== want) v('tool_result-id stämmer inte: fick ' + got + ', väntade ' + want);
      for (const b of results) if (b.type === 'tool_result' && typeof b.content !== 'string' && !Array.isArray(b.content)) v('tool_result.content ogiltigt');
    });
    // förra svaret ska komma tillbaka oförändrat (tänkande-block med signatur måste vara orörda). Ett nytt samtal (inga assistentmeddelanden än) börjar om
    const asstMsgs = body.messages.filter(m => m.role === 'assistant');
    if (lastContent && asstMsgs.length) { const asst = asstMsgs.at(-1); if (!asst || JSON.stringify(asst.content) !== JSON.stringify(lastContent)) v('assistentens förra svar skickades inte tillbaka oförändrat'); }
  }

  const server = http.createServer((req, res) => {
    let raw = '';
    req.on('data', c => { raw += c; });
    req.on('end', async () => {
      const rec = { method: req.method, url: req.url, headers: { ...req.headers }, raw };
      requests.push(rec);
      if (req.method !== 'POST' || req.url.split('?')[0] !== '/v1/messages') return err(res, 404, 'not_found_error', 'finns inte');
      if (req.headers['x-api-key'] !== key) return err(res, 401, 'authentication_error', 'invalid x-api-key');
      if (!req.headers['anthropic-version']) violations.push('anthropic-version saknas');
      if (req.headers.authorization) violations.push('authorization-rubrik skickades');
      if (!/application\/json/.test(req.headers['content-type'] || '')) violations.push('content-type ska vara JSON');
      let body; try { body = JSON.parse(raw); } catch (e) { return err(res, 400, 'invalid_request_error', 'ogiltig JSON'); }
      rec.body = body;
      if (rejectEffort && body.output_config) { effortRejections++; return err(res, 400, 'invalid_request_error', 'output_config.effort: Extra inputs are not permitted'); }
      validate(body);
      if (delayMs) await new Promise(r => setTimeout(r, delayMs));
      if (i >= steps.length) return err(res, 500, 'api_error', 'manuset är slut');
      const step = steps[i++];
      const last = body.messages.at(-1);
      const results = Array.isArray(last.content) ? last.content.filter(b => b.type === 'tool_result').map(b => ({ error: !!b.is_error, text: b.content })) : [];
      let out; try { out = typeof step === 'function' ? await step(body, results) : step; } catch (e) { return err(res, 500, 'api_error', 'manusfel: ' + e.message); }
      if (out && out.error) return err(res, out.error.status, out.error.type, out.error.message);
      lastContent = out.content;
      res.writeHead(200, { 'content-type': 'application/json', 'request-id': 'req_fake' });
      res.end(JSON.stringify({ id: 'msg_fake' + i, type: 'message', role: 'assistant', model: body.model, content: out.content, stop_reason: out.stop_reason, stop_sequence: null,
        usage: { cache_creation_input_tokens: 0, cache_read_input_tokens: 0, ...out.usage } }));
    });
  });
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => {
    const port = server.address().port;
    resolve({ url: 'http://127.0.0.1:' + port, port, key, requests, violations, effortRejections: () => effortRejections, steps,
      close: () => new Promise(r => { server.closeAllConnections?.(); server.close(() => r()); }) });
  }));
}
