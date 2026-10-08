// Kontrollsidan (HTML, CSS och JavaScript i en sträng). Inga externa adresser, ingen inbäddad nyckel: __TOKEN__ och __CONSENT__ fylls i av servern.
// All data från webbplatsen och från AI:n sätts in som text (esc), aldrig som HTML.
// Obs: det här är en mallsträng. Använd inte backtick, dollar-klammer eller omvänt snedstreck i koden nedan.
export const PAGE = `<!doctype html><html lang="sv"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Grossistagent (försök)</title>
<style>
:root{--bg:#f2f5f1;--sf:#fff;--ink:#17231d;--ink2:#4b5c52;--line:#d2dcd4;--ac:#b3365f;--bad:#a0272b;--ok:#2d6a43}
@media (prefers-color-scheme:dark){:root{--bg:#101712;--sf:#18221c;--ink:#e9f0ea;--ink2:#9db0a3;--line:#2f3d34;--ac:#e0708f;--bad:#f08080;--ok:#7fc99a}}
body{margin:0;padding:16px;background:var(--bg);color:var(--ink);font:16px/1.45 system-ui,sans-serif}main{max-width:980px;margin:0 auto;display:grid;gap:14px}
section{background:var(--sf);border:1px solid var(--line);border-radius:12px;padding:14px;display:grid;gap:10px}section[hidden]{display:none}h1{font-size:22px;margin:0}h2{font-size:17px;margin:0}
button{min-height:44px;padding:0 14px;border-radius:10px;border:1px solid var(--line);background:var(--sf);color:var(--ink);font:inherit;font-weight:600;cursor:pointer}button.p{background:var(--ac);border-color:var(--ac);color:#fff}button.big{min-height:64px;font-size:18px}button:disabled{opacity:.5;cursor:default}
textarea,input[type=text],input:not([type]){font:inherit;color:var(--ink);background:var(--sf);border:1px solid var(--line);border-radius:8px;padding:8px;max-width:100%;box-sizing:border-box}textarea{width:100%;min-height:72px}
.muted{color:var(--ink2);font-size:14px}.note{padding:10px;border-radius:8px;border:1px solid var(--line)}.bad{border-color:var(--bad);color:var(--bad)}.ok{color:var(--ok)}
.row{display:flex;flex-wrap:wrap;gap:8px;align-items:center}.cards{display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(280px,1fr))}.card{border:1px solid var(--line);border-radius:12px;padding:12px;display:grid;gap:8px;align-content:start}
.badge[hidden]{display:none}.badge{display:inline-block;padding:2px 10px;border-radius:999px;border:1px solid var(--ac);color:var(--ac);font-size:13px;font-weight:700}
table{border-collapse:collapse;width:100%;font-size:14px}th,td{border-bottom:1px solid var(--line);padding:6px;text-align:left;vertical-align:top}.scroll{overflow-x:auto}
.chip{min-height:36px;font-weight:500}ul{margin:0;padding-left:18px}code{font-size:13px}#log li{list-style:none;margin-left:-18px}
</style></head><body><main>
<h1>Grossistagent <span id="modebadge" class="badge" hidden></span></h1>
<p class="muted">Skrivskyddat. Ingenting köps, och ingenting sparas när du avslutar. Det här är en försöksversion.</p>

<section id="startsec"><h2>Starta</h2>
<div id="aistatus" role="status" aria-live="polite"><p class="muted">Kontrollerar AI-anslutningen…</p></div>
<div class="row"><button id="aicheck">Kontrollera AI igen</button><span id="chromemsg" class="muted"></span></div>
<div class="cards">
<div class="card"><h2>DEMO</h2><p class="muted">En påhittad butik på den här datorn. Den riktiga AI-modellen söker i den med exakt samma verktyg och samma skydd som mot en riktig grossist. Du skriver dina egna frågor.</p><button class="p big" id="bdemo" disabled>Starta DEMO</button></div>
<div class="card"><h2>RIKTIG GROSSIST</h2><p class="muted">Ett begränsat, skrivskyddat test med floristens eget konto. Floristen loggar in själv i Chrome.</p>
<label class="muted" for="shopurl">Webbutikens adress (kontrollera den i floristens webbläsare)</label><input type="text" id="shopurl" autocomplete="off" spellcheck="false">
<button class="p big" id="breal" disabled>Starta RIKTIG GROSSIST</button></div>
</div>
<p id="startmsg" class="muted" role="status"></p><p id="limitsline" class="muted"></p></section>

<section id="s1" hidden><h2>1. Logga in i webbläsarfönstret</h2>
<div id="logindemo" hidden><p>Ett Chrome-fönster har öppnats på en <strong>påhittad butik</strong>. Logga in där med användarnamn <code>testkund</code> och lösenord <code>hemligt-123</code> (påhittade uppgifter, inget riktigt konto). Klicka sedan på knappen.</p></div>
<div id="loginreal" hidden><p>Ett Chrome-fönster har öppnats på grossistens inloggning. <strong>Floristen skriver användarnamn och lösenord direkt i det fönstret</strong>, aldrig här och aldrig till någon AI. Hon gör själv eventuell kod eller CAPTCHA. Klicka sedan på knappen. <strong>Agenten är pausad tills du skickar en uppgift.</strong></p>
<label class="row"><input type="checkbox" id="c1"> <span id="consenttext">__CONSENT__</span></label></div>
<div class="row"><button class="p" id="loggedin">Jag är inloggad. Starta agenten</button><span id="loginmsg" class="muted"></span></div></section>

<section id="s2" hidden><h2>2. Be agenten</h2>
<label for="instr">Vad ska agenten hitta?</label><textarea id="instr" placeholder="Till exempel: Hitta vita rosor som skulle passa till en romantisk brudbukett. Jag behöver ungefär 25."></textarea>
<div class="row"><button class="p" id="ask" disabled>Skicka</button><button id="stop" disabled>Stoppa</button><span id="run" class="muted" role="status" aria-live="polite"></span></div>
<div class="row" id="chips"></div><div id="err"></div><ul id="log" class="muted" aria-live="polite"></ul></section>

<section id="s3" hidden><h2>Resultat</h2><div id="limitnote"></div><div id="agentnote" class="muted"></div><div class="scroll" id="picks"><span class="muted">Inga resultat än.</span></div></section>
<section id="s4" hidden><h2>Alla utlästa artiklar <span class="muted" id="cnt"></span></h2><details><summary>Visa</summary><div class="scroll" id="all"></div></details></section>
<section id="s5" hidden><h2>Skydd och gränser</h2><div id="guard"></div><div id="blocked"></div><div id="meta" class="muted"></div></section>
<section id="s6" hidden><h2>Avsluta</h2><p class="muted">Stänger webbläsaren och raderar sessionen. Du måste logga in igen nästa gång. Rapporten innehåller bara struktur (adressmönster och fältnamn), inga artikeldata, om du inte väljer det.</p>
<div class="row"><button id="rep">Spara rapport (struktur)</button><button id="rep2">Spara rapport med artiklar</button><button class="p" id="end">Avsluta och radera sessionen</button></div></section>
<section><div id="endmsg" class="muted" role="status"></div><div class="row"><button id="quit">Stäng programmet</button></div></section>
</main><script>
const T='__TOKEN__';const $=s=>document.querySelector(s);
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function api(p,b){const r=await fetch(p,{method:b===undefined?'GET':'POST',headers:{'x-poc-token':T,'content-type':'application/json'},body:b===undefined?undefined:JSON.stringify(b)});const j=await r.json();if(!r.ok)throw new Error(j.error||r.status);return j;}
const show=(sel,on)=>{$(sel).hidden=!on;};
const showErr=e=>{$('#err').innerHTML='<p class="note bad" role="alert">'+esc(e&&e.message||e)+'</p>';};
const EX=['Hitta vita rosor som skulle passa till en romantisk brudbukett. Jag behöver ungefär 25.','Vilka vita eller krämvita rosor på minst 60 cm finns i lager?','Finns det något grönt (till exempel eukalyptus) som passar till vita rosor? Jag behöver 30 stjälkar.','Visa veckans erbjudanden på rosor.','Hitta en vit sommarblomma i gipsörtstil, helst 10 st per förpackning.'];
$('#chips').innerHTML=EX.map((x,i)=>'<button class="chip" data-i="'+i+'">Exempel '+(i+1)+'</button>').join('');
$('#chips').onclick=e=>{const i=e.target.dataset&&e.target.dataset.i;if(i!==undefined)$('#instr').value=EX[i];};
$('#aicheck').onclick=async()=>{try{$('#aistatus').innerHTML='<p class="muted">Kontrollerar…</p>';await api('/api/ai-check',{});}catch(e){$('#aistatus').innerHTML='<p class="note bad" role="alert">'+esc(e.message)+'</p>';}};
async function begin(mode){try{$('#startmsg').textContent='Startar Chrome…';$('#bdemo').disabled=true;$('#breal').disabled=true;await api('/api/begin',{mode,shopUrl:$('#shopurl').value});$('#startmsg').textContent='';$('#endmsg').textContent='';}catch(e){$('#startmsg').innerHTML='<span class="bad" role="alert">'+esc(e.message)+'</span>';}}
$('#bdemo').onclick=()=>begin('demo');$('#breal').onclick=()=>begin('real');
$('#loggedin').onclick=async()=>{try{$('#loginmsg').textContent='Kontrollerar…';const r=await api('/api/logged-in',{consent:$('#c1').checked});$('#loginmsg').textContent='Skrivskyddet är på. Godkända värdar: '+r.hosts.join(', ');$('#err').innerHTML='';}catch(e){$('#loginmsg').textContent='';showErr(e);}};
$('#ask').onclick=async()=>{try{$('#err').innerHTML='';await api('/api/ask',{instruction:$('#instr').value});}catch(e){showErr(e);}};
$('#stop').onclick=()=>api('/api/stop',{});
$('#rep').onclick=async()=>{const r=await api('/api/save-report',{includeProducts:false});$('#endmsg').textContent='Sparad: '+r.fil;};
$('#rep2').onclick=async()=>{const r=await api('/api/save-report',{includeProducts:true});$('#endmsg').textContent='Sparad (med artiklar, behandla som konfidentiell): '+r.fil;};
$('#end').onclick=async()=>{if(!confirm('Avsluta och radera sessionen?'))return;try{const r=await api('/api/end',{});shownFinal=null;allCount=-1;$('#endmsg').textContent=r.wiped?'Klart ✓ Webbläsaren är stängd och sessionen raderad. Du kan starta en ny eller stänga programmet.':'Stängd, men en tillfällig mapp kan finnas kvar: '+(r.profileDirsLeft||[]).join(', ');}catch(e){$('#endmsg').textContent=e.message;}};
$('#quit').onclick=async()=>{if(!confirm('Stäng programmet? En pågående session raderas.'))return;try{await api('/api/quit',{});clearInterval(timer);$('#endmsg').textContent='Programmet är stängt. Du kan stänga den här sidan.';}catch(e){$('#endmsg').textContent=e.message;}};
function row(p,calc){return '<tr><td>'+esc(p.id)+'</td><td>'+esc(p.name)+'</td><td>'+esc(p.variant||'')+'</td><td>'+esc(p.color||'')+'</td><td>'+(p.lengthCm||'?')+'</td><td>'+(p.packSize?p.packSize+(p.packSizeSource==='namn'?' (ur namnet)':''):'okänd')+'</td><td>'+(p.packPrice?esc(p.packPrice)+' '+esc(p.currency)+(p.currencyAssumed?' (valuta antagen)':'')+' / '+(p.priceUnit==='pack'?'förp':esc(p.priceUnit||'?'))+(p.priceDerived?' (räknat från pris per st)':''):'okänt')+'</td><td>'+(p.priceIncludesVat===true?'inkl.':p.priceIncludesVat===false?'exkl.':'okänt')+'</td><td>'+esc(p.availabilityRaw||p.availability)+'</td><td>'+esc(p.offer||'')+'</td><td>'+esc((p.issues||[]).join('; '))+'</td><td>'+calc+'</td></tr>';}
function calcCell(id,needed){return '<label class="muted">Behov <input size="4" inputmode="numeric" data-need="'+esc(id)+'" value="'+(needed||'')+'"></label> <button data-calc="'+esc(id)+'">Räkna</button><div data-out="'+esc(id)+'" class="muted"></div>';}
const HEAD='<table><thead><tr><th>Art.nr</th><th>Namn</th><th>Sort</th><th>Färg</th><th>Längd cm</th><th>Förp.</th><th>Förpackningspris</th><th>Moms</th><th>Lager</th><th>Erbjudande</th><th>Anmärkningar</th><th>Inköp (räknas av vår kod)</th></tr></thead><tbody>';
document.addEventListener('click',async e=>{const id=e.target.dataset&&e.target.dataset.calc;if(id===undefined)return;const inp=document.querySelector('[data-need="'+CSS.escape(id)+'"]');const out=document.querySelector('[data-out="'+CSS.escape(id)+'"]');try{const r=await api('/api/calc',{id,needed:parseInt(inp.value,10)});out.textContent=r.status==='ok'?r.needed+' behövs → '+r.packs+' förp. ('+r.bought+' st), '+r.leftover+' över, '+r.cost+' ('+r.costNote+')':(r.note||r.status);}catch(x){out.textContent=x.message;}});
document.addEventListener('click',async e=>{const i=e.target.dataset&&e.target.dataset.allow;if(i===undefined)return;try{await api('/api/allow-post',{index:Number(i)});}catch(x){showErr(x);}});
let shownFinal=null,allCount=-1,urlInit=false;
const fmt=n=>Number(n||0).toLocaleString('sv-SE');
function logLine(e){const m=esc(e.message||'');if(e.type==='status')return '<li>'+m+'</li>';if(e.type==='fråga')return '<li><strong>Uppgift:</strong> '+m+'</li>';if(e.type==='gräns')return '<li class="bad"><strong>Stoppad:</strong> '+m+'</li>';if(e.type==='fel')return '<li class="bad"><strong>Fel:</strong> '+m+'</li>';return '<li class="muted">'+m+'</li>';}
function renderStart(s){
 show('#startsec',true);['#s1','#s2','#s3','#s4','#s5','#s6'].forEach(x=>show(x,false));show('#modebadge',false);
 if(!urlInit&&s.defaultShopUrl){$('#shopurl').value=s.defaultShopUrl;urlInit=true;}
 const ai=s.ai;
 $('#aistatus').innerHTML=!ai?'':ai.ok?'<p class="ok" style="margin:0"><strong>'+esc(ai.message)+'</strong> <span class="muted">(nyckel från '+esc(ai.source||'?')+', modell '+esc(ai.model)+')</span></p>':ai.kind==='ej_kontrollerad'?'<p class="muted">Kontrollerar AI-anslutningen…</p>':'<p class="note bad" role="alert">'+esc(ai.message)+'</p>';
 const chromeOk=!s.chrome||s.chrome.ok!==false;
 $('#chromemsg').textContent=chromeOk?'':s.chrome.message;
 const ready=!!(ai&&ai.ok)&&chromeOk&&!s.starting;
 $('#bdemo').disabled=!ready;$('#breal').disabled=!ready;
 if(s.starting)$('#startmsg').textContent='Startar Chrome…';
 if(s.lastError)$('#startmsg').innerHTML='<span class="bad" role="alert">'+esc(s.lastError)+'</span>';
 const d=s.modes&&s.modes.demo&&s.modes.demo.limits,r=s.modes&&s.modes.real&&s.modes.real.limits;
 $('#limitsline').textContent=r?'Gränser (stoppar agenten): RIKTIG GROSSIST högst '+r.maxTurns+' steg, '+fmt(r.maxTaskTokens)+' tokens per uppdrag, '+fmt(r.maxSessionTokens)+' per session, '+r.maxSessionMinutes+' min, '+r.maxProductsPerTask+' artiklar per uppdrag, '+fmt(r.maxRequests)+' webbläsaranrop. DEMO: '+d.maxTurns+' steg, '+fmt(d.maxTaskTokens)+' tokens per uppdrag.':'';
}
function renderSession(s){
 show('#startsec',false);show('#s2',true);show('#s3',true);show('#s4',true);show('#s5',true);show('#s6',true);
 const real=s.mode==='real';
 show('#modebadge',true);$('#modebadge').textContent=real?'RIKTIG GROSSIST':'DEMO – påhittad butik';
 show('#s1',s.phase==='login');show('#logindemo',!real);show('#loginreal',real);
 $('#loggedin').disabled=s.phase!=='login';$('#ask').disabled=s.phase!=='agent'||s.running;$('#stop').disabled=!s.running;
 $('#run').textContent=s.phase==='login'?'Logga in först.':s.running?'Agenten arbetar…':'Redo.';
 $('#log').innerHTML=s.events.slice(-14).map(logLine).join('');
 if(s.lastError)$('#err').innerHTML='<p class="note bad" role="alert">'+esc(s.lastError)+'</p>';
 if(s.last&&s.last.error)$('#err').innerHTML='<p class="note bad" role="alert">'+esc(s.last.error)+'</p>';
 $('#limitnote').innerHTML=s.last&&s.last.limit?'<p class="note bad" role="alert">Agenten stoppades: '+esc(s.last.limit.message)+' Det som hunnit läsas ut syns nedan.</p>':'';
 const f=s.last&&s.last.picks;
 if(s.last&&!f)$('#agentnote').textContent=s.last.answer||'';
 if(f&&f!==shownFinal){shownFinal=f;$('#agentnote').innerHTML=esc(f.summary||'');$('#picks').innerHTML=HEAD+f.picks.map(p=>row(p.product,calcCell(p.product.id,p.needed))+'<tr><td></td><td colspan="11" class="muted">Agentens skäl: '+esc(p.reason)+(p.plan&&p.plan.status==='ok'?' · Beräkning: '+p.plan.needed+' behövs → '+p.plan.packs+' förp. ('+p.plan.bought+' st), '+p.plan.leftover+' över, '+esc(p.plan.cost)+' ('+esc(p.plan.costNote)+')':'')+'</td></tr>').join('')+'</tbody></table>'+(f.notFound.length?'<p class="note bad">Agenten nämnde artiklar som inte läst ut: '+esc(f.notFound.join(', '))+'</p>':'');}
 if(s.catalogCount!==allCount){allCount=s.catalogCount;$('#cnt').textContent='('+s.catalogCount+')';api('/api/products').then(a=>{$('#all').innerHTML=HEAD+a.artiklar.map(p=>row(p,calcCell(p.id,''))).join('')+'</tbody></table>';}).catch(()=>{});}
 const rq=(s.budget&&s.budget.requests)||{used:0,max:0},L=s.limits||{},B=(s.budget&&s.budget.session)||{tokens:0,minutes:0};
 $('#guard').innerHTML='<p>Anrop tillåtna: <strong>'+s.guard.allowed+'</strong> · nekade: <strong>'+s.guard.blocked+'</strong> · skrivskydd: <strong class="ok">'+(s.phase==='agent'?'PÅ':'på så fort du bekräftat inloggningen')+'</strong></p>'+(L.maxRequests?'<p class="muted">Gränser i den här sessionen: webbläsaranrop '+fmt(rq.used)+' av '+fmt(rq.max)+' · sidhämtningar '+s.pageLoads+' av '+L.maxPageLoads+' · tokens '+fmt(B.tokens)+' av '+fmt(L.maxSessionTokens)+' · tid '+B.minutes+' av '+L.maxSessionMinutes+' min · artiklar per uppdrag högst '+L.maxProductsPerTask+'</p>':'');
 const bp=s.blockedPosts||[];
 $('#blocked').innerHTML=(s.blocked.length?'<details><summary>Nekade anrop (senaste)</summary><ul>'+s.blocked.slice(-12).map(b=>'<li><code>'+esc(b.method+' '+b.host+b.path)+'</code> – '+esc(b.reason)+'</li>').join('')+'</ul></details>':'')+(bp.length?'<p class="note">Skyddet nekade en POST. Om det är en vanlig <strong>sökning</strong> (inte köp eller varukorg) kan du godkänna just den:</p><ul>'+bp.map(b=>'<li><code>'+esc(b.host+b.path)+'</code> <button data-allow="'+b.index+'">Det är en läsande sökning, tillåt</button></li>').join('')+'</ul>':'');
 $('#meta').textContent='Modell '+s.model+' · JSON-svar sedda '+s.jsonResponses+' · tokens in/ut '+s.usage.input_tokens+'/'+s.usage.output_tokens+(s.costUsd!=null?' · uppskattad AI-kostnad ≈ '+s.costUsd.toFixed(2)+' USD':'');
}
async function tick(){try{const s=await api('/api/state');if(s.stage==='start')renderStart(s);else renderSession(s);}catch(e){}}
const timer=setInterval(tick,1200);tick();
</script></body></html>`;
