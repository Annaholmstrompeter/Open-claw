// En fejkad Anthropic-klient med manus. Den följer svarsformen i SDK:n (stop_reason, content med tool_use, usage), så att agentslingan
// körs på riktigt, men det är manuset och inte en AI som väljer verktygen. Det är alltså ett test av maskineriet, inte av modellens omdöme.
let n = 0;
export const toolUse = (name, input, text = '') => ({ stop_reason: 'tool_use', content: [...(text ? [{ type: 'text', text }] : []), { type: 'tool_use', id: 'tu_' + (++n), name, input }], usage: { input_tokens: 1200, output_tokens: 80 } });
export const endTurn = text => ({ stop_reason: 'end_turn', content: [{ type: 'text', text }], usage: { input_tokens: 900, output_tokens: 40 } });

/** steps: lista av svar eller funktioner (req, tidigareVerktygsresultat) → svar. */
export function scripted(steps) {
  const requests = [];
  let i = 0;
  const client = {
    requests,
    messages: {
      async create(req) {
        requests.push(JSON.parse(JSON.stringify(req)));
        if (i >= steps.length) throw new Error('manuset är slut');
        const step = steps[i++];
        const last = req.messages[req.messages.length - 1];
        const results = Array.isArray(last.content) ? last.content.filter(b => b.type === 'tool_result').map(b => ({ error: !!b.is_error, text: b.content })) : [];
        return typeof step === 'function' ? step(req, results) : step;
      }
    }
  };
  return client;
}
export const parse = r => { try { return JSON.parse(r.text); } catch (e) { return null; } };
