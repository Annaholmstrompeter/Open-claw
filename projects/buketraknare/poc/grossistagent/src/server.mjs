// Kontrollsidan som operatören (Anna) och floristen använder: en liten lokal webbsida i den vanliga webbläsaren, aldrig i den styrda.
// Lyssnar bara på 127.0.0.1, kräver en slumpad nyckel och kontrollerar värdnamnet (skydd mot att andra sidor eller program styr den).
import http from 'node:http';
import crypto from 'node:crypto';

const MAX_BODY = 20000;

export async function startControlServer({ session, saveDir = './out', onEnd = () => {}, token = crypto.randomBytes(18).toString('base64url') }) {
  let port = 0, lastError = null, askPromise = null;
  const json = (res, code, o) => { res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }); res.end(JSON.stringify(o)); };
  const hostOk = h => { const m = String(h || '').match(/^(127\.0\.0\.1|localhost):(\d+)$/); return !!m && Number(m[2]) === port; };

  const server = http.createServer((req, res) => {
    if (!hostOk(req.headers.host)) return json(res, 403, { error: 'fel värdnamn' });
    if (req.headers.origin && !hostOk(String(req.headers.origin).replace(/^https?:\/\//, ''))) return json(res, 403, { error: 'fel ursprung' });
    const u = new URL(req.url, 'http://127.0.0.1');
    if (req.method === 'GET' && u.pathname === '/') {
      if (u.searchParams.get('t') !== token) return json(res, 403, { error: 'nyckel saknas' });
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'content-security-policy': "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'" });
      return res.end(PAGE.replace('__TOKEN__', token));
    }
    if (req.headers['x-poc-token'] !== token) return json(res, 403, { error: 'nyckel saknas' });
    let body = '', over = false;
    req.on('data', c => { body += c; if (body.length > MAX_BODY) { over = true; req.destroy(); } });
    req.on('end', async () => {
      if (over) return;
      let input = {}; if (body) { try { input = JSON.parse(body); } catch (e) { return json(res, 400, { error: 'ogiltig JSON' }); } }
      try {
        if (req.method === 'GET' && u.pathname === '/api/state') return json(res, 200, { ...session.state(), lastError });
        if (req.method === 'GET' && u.pathname === '/api/products') return json(res, 200, { artiklar: session.products() });
        if (req.method !== 'POST') return json(res, 404, { error: 'finns inte' });
        if (u.pathname === '/api/logged-in') return json(res, 200, await session.confirmLogin({ consent: input.consent === true, termsChecked: input.termsChecked === true }));
        if (u.pathname === '/api/ask') {
          const st = session.state();
          if (st.phase !== 'agent') return json(res, 400, { error: 'Bekräfta inloggningen först.' });
          if (st.running) return json(res, 409, { error: 'Agenten arbetar redan.' });
          if (!String(input.instruction || '').trim()) return json(res, 400, { error: 'Skriv en instruktion.' });
          lastError = null;
          askPromise = session.ask(String(input.instruction || '')).catch(e => { lastError = String(e.message || e).slice(0, 300); });
          return json(res, 202, { startad: true });
        }
        if (u.pathname === '/api/stop') { session.stop(); return json(res, 200, { ok: true }); }
        if (u.pathname === '/api/calc') return json(res, 200, session.calc(String(input.id || ''), Number.isInteger(input.needed) ? input.needed : NaN));
        if (u.pathname === '/api/allow-post') { session.allowBlockedPost(Number(input.index)); return json(res, 200, { ok: true }); }
        if (u.pathname === '/api/allow-host') { session.allowHost(String(input.host || '')); return json(res, 200, { ok: true }); }
        if (u.pathname === '/api/save-report') return json(res, 200, { fil: session.saveReport(saveDir, { includeProducts: !!input.includeProducts }) });
        if (u.pathname === '/api/end') { const r = await session.end(); json(res, 200, r); setTimeout(() => { server.close(); onEnd(); }, 200); return; }
        return json(res, 404, { error: 'finns inte' });
      } catch (e) { return json(res, 400, { error: String(e && e.message || e).slice(0, 300) }); }
    });
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  port = server.address().port;
  return { port, host: server.address().address, token, url: 'http://127.0.0.1:' + port + '/?t=' + token, close: () => new Promise(r => { server.closeAllConnections?.(); server.close(() => r()); }), idle: () => askPromise };
}

export const PAGE = `<!doctype html><html lang="sv"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Grossistagent (försök)</title>
<style>
:root{--bg:#f2f5f1;--sf:#fff;--ink:#17231d;--ink2:#4b5c52;--line:#d2dcd4;--ac:#b3365f;--bad:#a0272b;--ok:#2d6a43}
@media (prefers-color-scheme:dark){:root{--bg:#101712;--sf:#18221c;--ink:#e9f0ea;--ink2:#9db0a3;--line:#2f3d34;--ac:#e0708f;--bad:#f08080;--ok:#7fc99a}}
body{margin:0;padding:16px;background:var(--bg);color:var(--ink);font:16px/1.45 system-ui,sans-serif}main{max-width:980px;margin:0 auto;display:grid;gap:14px}
section{background:var(--sf);border:1px solid var(--line);border-radius:12px;padding:14px;display:grid;gap:10px}h1{font-size:22px;margin:0}h2{font-size:17px;margin:0}
button{min-height:44px;padding:0 14px;border-radius:10px;border:1px solid var(--line);background:var(--sf);color:var(--ink);font:inherit;font-weight:600;cursor:pointer}button.p{background:var(--ac);border-color:var(--ac);color:#fff}button:disabled{opacity:.5;cursor:default}
textarea,input{font:inherit;color:var(--ink);background:var(--sf);border:1px solid var(--line);border-radius:8px;padding:8px;max-width:100%;box-sizing:border-box}textarea{width:100%;min-height:72px}
.muted{color:var(--ink2);font-size:14px}.note{padding:10px;border-radius:8px;border:1px solid var(--line)}.bad{border-color:var(--bad);color:var(--bad)}.ok{color:var(--ok)}
.row{display:flex;flex-wrap:wrap;gap:8px;align-items:center}table{border-collapse:collapse;width:100%;font-size:14px}th,td{border-bottom:1px solid var(--line);padding:6px;text-align:left;vertical-align:top}.scroll{overflow-x:auto}
.chip{min-height:36px;font-weight:500}ul{margin:0;padding-left:18px}code{font-size:13px}
</style></head><body><main>
<h1>Grossistagent: ett försök</h1>
<p class="muted">Skrivskyddat. Ingenting köps, och ingenting sparas när du avslutar. Det här är en försöksversion.</p>
<section id="s1"><h2>1. Logga in i webbläsarfönstret</h2>
<p>Ett webbläsarfönster har öppnats på grossistens inloggning. <strong>Skriv användarnamn och lösenord direkt i det fönstret</strong>, aldrig här och aldrig till någon AI. Gör eventuell kod eller CAPTCHA själv. Klicka sedan på knappen.</p>
<label class="row"><input type="checkbox" id="c1"> <span>Floristen har själv sagt ja till att prova, och använder sitt eget konto och loggar in själv.</span></label>
<label class="row"><input type="checkbox" id="c2"> <span>Jag har tittat på webbplatsens publika villkor (länk i sidfoten) och de förbjuder inte uttryckligen den här sortens test. Om de gör det: stäng den här sidan.</span></label>
<div class="row"><button class="p" id="loggedin">Jag är inloggad. Starta agenten</button><span id="loginmsg" class="muted"></span></div></section>
<section id="s2"><h2>2. Be agenten</h2>
<label for="instr">Vad ska agenten hitta?</label><textarea id="instr" placeholder="Till exempel: Hitta vita rosor som skulle passa till en romantisk brudbukett. Jag behöver ungefär 25."></textarea>
<div class="row"><button class="p" id="ask" disabled>Skicka</button><button id="stop" disabled>Stoppa</button><span id="run" class="muted" role="status" aria-live="polite"></span></div>
<div class="row" id="chips"></div><div id="err"></div><ul id="events" class="muted"></ul></section>
<section id="s3"><h2>Resultat</h2><div id="agentnote" class="muted"></div><div class="scroll" id="picks"><span class="muted">Inga resultat än.</span></div></section>
<section><h2>Alla utlästa artiklar <span class="muted" id="cnt"></span></h2><details><summary>Visa</summary><div class="scroll" id="all"></div></details></section>
<section><h2>Skydd och status</h2><div id="guard"></div><div id="blocked"></div><div id="meta" class="muted"></div></section>
<section><h2>Avsluta</h2><p class="muted">Avslutar webbläsaren och raderar sessionen. Du måste logga in igen nästa gång. Rapporten innehåller bara struktur (adressmönster och fältnamn), inga artikeldata, om du inte väljer det.</p>
<div class="row"><button id="rep">Spara rapport (struktur)</button><button id="rep2">Spara rapport med artiklar</button><button class="p" id="end">Avsluta och radera sessionen</button></div><div id="endmsg" class="muted"></div></section>
</main><script>
const T='__TOKEN__';const $=s=>document.querySelector(s);
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function api(p,b){const r=await fetch(p,{method:b===undefined?'GET':'POST',headers:{'x-poc-token':T,'content-type':'application/json'},body:b===undefined?undefined:JSON.stringify(b)});const j=await r.json();if(!r.ok)throw new Error(j.error||r.status);return j;}
const EX=['Hitta vita rosor som skulle passa till en romantisk brudbukett. Jag behöver ungefär 25.','Vilka vita eller krämvita rosor på minst 60 cm finns i lager?','Finns det något grönt (till exempel eukalyptus) som passar till vita rosor? Jag behöver 30 stjälkar.','Visa veckans erbjudanden på rosor.','Hitta en vit sommarblomma i gipsörtstil, helst 10 st per förpackning.'];
$('#chips').innerHTML=EX.map((x,i)=>'<button class="chip" data-i="'+i+'">Exempel '+(i+1)+'</button>').join('');
$('#chips').onclick=e=>{const i=e.target.dataset&&e.target.dataset.i;if(i!==undefined)$('#instr').value=EX[i];};
$('#loggedin').onclick=async()=>{try{$('#loginmsg').textContent='Kontrollerar…';const r=await api('/api/logged-in',{consent:$('#c1').checked,termsChecked:$('#c2').checked});$('#loginmsg').textContent='Skrivskyddet är på. Godkända värdar: '+r.hosts.join(', ');}catch(e){$('#loginmsg').textContent='';$('#err').innerHTML='<p class="note bad" role="alert">'+esc(e.message)+'</p>';}};
$('#ask').onclick=async()=>{try{$('#err').innerHTML='';await api('/api/ask',{instruction:$('#instr').value});}catch(e){$('#err').innerHTML='<p class="note bad" role="alert">'+esc(e.message)+'</p>';}};
$('#stop').onclick=()=>api('/api/stop',{});
$('#rep').onclick=async()=>{const r=await api('/api/save-report',{includeProducts:false});$('#endmsg').textContent='Sparad: '+r.fil;};
$('#rep2').onclick=async()=>{const r=await api('/api/save-report',{includeProducts:true});$('#endmsg').textContent='Sparad (med artiklar, behandla som konfidentiell): '+r.fil;};
$('#end').onclick=async()=>{if(!confirm('Avsluta och radera sessionen?'))return;try{const r=await api('/api/end',{});$('#endmsg').textContent=r.wiped?'Klart. Webbläsaren är stängd och sessionen raderad. Du kan stänga den här sidan.':'Stängd, men en tillfällig mapp kan finnas kvar: '+esc((r.profileDirsLeft||[]).join(', '));clearInterval(timer);}catch(e){$('#endmsg').textContent=e.message;}};
function row(p,calc){return '<tr><td>'+esc(p.id)+'</td><td>'+esc(p.name)+'</td><td>'+esc(p.variant||'')+'</td><td>'+esc(p.color||'')+'</td><td>'+(p.lengthCm||'?')+'</td><td>'+(p.packSize?p.packSize+(p.packSizeSource==='namn'?' (ur namnet)':''):'okänd')+'</td><td>'+(p.packPrice?esc(p.packPrice)+' '+esc(p.currency)+(p.currencyAssumed?' (valuta antagen)':'')+' / '+(p.priceUnit==='pack'?'förp':esc(p.priceUnit||'?'))+(p.priceDerived?' (räknat från pris per st)':''):'okänt')+'</td><td>'+(p.priceIncludesVat===true?'inkl.':p.priceIncludesVat===false?'exkl.':'okänt')+'</td><td>'+esc(p.availabilityRaw||p.availability)+'</td><td>'+esc(p.offer||'')+'</td><td>'+esc((p.issues||[]).join('; '))+'</td><td>'+calc+'</td></tr>';}
function calcCell(id,needed){return '<label class="muted">Behov <input size="4" inputmode="numeric" data-need="'+esc(id)+'" value="'+(needed||'')+'"></label> <button data-calc="'+esc(id)+'">Räkna</button><div data-out="'+esc(id)+'" class="muted"></div>';}
const HEAD='<table><thead><tr><th>Art.nr</th><th>Namn</th><th>Sort</th><th>Färg</th><th>Längd cm</th><th>Förp.</th><th>Förpackningspris</th><th>Moms</th><th>Lager</th><th>Erbjudande</th><th>Anmärkningar</th><th>Inköp (räknas av vår kod)</th></tr></thead><tbody>';
document.addEventListener('click',async e=>{const id=e.target.dataset&&e.target.dataset.calc;if(id===undefined)return;const inp=document.querySelector('[data-need="'+CSS.escape(id)+'"]');const out=document.querySelector('[data-out="'+CSS.escape(id)+'"]');try{const r=await api('/api/calc',{id,needed:parseInt(inp.value,10)});out.textContent=r.status==='ok'?r.needed+' behövs → '+r.packs+' förp. ('+r.bought+' st), '+r.leftover+' över, '+r.cost+' ('+r.costNote+')':(r.note||r.status);}catch(x){out.textContent=x.message;}});
document.addEventListener('click',async e=>{const i=e.target.dataset&&e.target.dataset.allow;if(i===undefined)return;try{await api('/api/allow-post',{index:Number(i)});}catch(x){$('#err').innerHTML='<p class="note bad" role="alert">'+esc(x.message)+'</p>';}});
let shownFinal=null,allCount=-1;
async function tick(){try{const s=await api('/api/state');
 $('#loggedin').disabled=s.phase!=='login';$('#ask').disabled=s.phase!=='agent'||s.running;$('#stop').disabled=!s.running;
 $('#run').textContent=s.phase==='login'?'Logga in först.':s.running?'Agenten arbetar…':'Redo.';
 $('#events').innerHTML=s.events.slice(-12).map(e=>'<li>'+esc(e.type)+': '+esc(e.message||'')+'</li>').join('');
 if(s.lastError)$('#err').innerHTML='<p class="note bad" role="alert">'+esc(s.lastError)+'</p>';
 if(s.last&&s.last.error)$('#err').innerHTML='<p class="note bad" role="alert">'+esc(s.last.error)+'</p>';
 const f=s.last&&s.last.picks;if(f&&f!==shownFinal){shownFinal=f;$('#agentnote').innerHTML=esc(s.last.text||f.summary||'');$('#picks').innerHTML=HEAD+f.picks.map(p=>row(p.product,calcCell(p.product.id,p.needed))+'<tr><td></td><td colspan="11" class="muted">Agentens skäl: '+esc(p.reason)+(p.plan&&p.plan.status==='ok'?' · Beräkning: '+p.plan.needed+' behövs → '+p.plan.packs+' förp. ('+p.plan.bought+' st), '+p.plan.leftover+' över, '+esc(p.plan.cost)+' ('+esc(p.plan.costNote)+')':'')+'</td></tr>').join('')+'</tbody></table>'+(f.notFound.length?'<p class="note bad">Agenten nämnde artiklar som inte läst ut: '+esc(f.notFound.join(', '))+'</p>':'');}
 if(s.catalogCount!==allCount){allCount=s.catalogCount;$('#cnt').textContent='('+s.catalogCount+')';const a=await api('/api/products');$('#all').innerHTML=HEAD+a.artiklar.map(p=>row(p,calcCell(p.id,''))).join('')+'</tbody></table>';}
 $('#guard').innerHTML='<p>Anrop tillåtna: <strong>'+s.guard.allowed+'</strong> · nekade: <strong>'+s.guard.blocked+'</strong> · skrivskydd: <strong class="ok">'+(s.phase==='agent'?'PÅ':'på så fort du bekräftat inloggningen')+'</strong></p>';
 const bp=s.blockedPosts||[];
 $('#blocked').innerHTML=(s.blocked.length?'<details><summary>Nekade anrop (senaste)</summary><ul>'+s.blocked.slice(-12).map(b=>'<li><code>'+esc(b.method+' '+b.host+b.path)+'</code> – '+esc(b.reason)+'</li>').join('')+'</ul></details>':'')+(bp.length?'<p class="note">Skyddet nekade en POST. Om det är en vanlig <strong>sökning</strong> (inte köp eller varukorg) kan du godkänna just den:</p><ul>'+bp.map(b=>'<li><code>'+esc(b.host+b.path)+'</code> <button data-allow="'+b.index+'">Det är en läsande sökning, tillåt</button></li>').join('')+'</ul>':'');
 $('#meta').textContent='Modell '+s.model+' · sidhämtningar '+s.pageLoads+' · JSON-svar sedda '+s.jsonResponses+' · tokens in/ut '+s.usage.input_tokens+'/'+s.usage.output_tokens+(s.costUsd!=null?' · uppskattad AI-kostnad ≈ '+s.costUsd.toFixed(2)+' USD':'');
}catch(e){}}
const timer=setInterval(tick,1200);tick();
</script></body></html>`;
