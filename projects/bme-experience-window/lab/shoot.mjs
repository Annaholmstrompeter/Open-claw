import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const [,, w='1440', h='900', prefix='d', mode='tour', reduce='0', target='http://127.0.0.1:8765/page.html'] = process.argv;
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args:['--autoplay-policy=no-user-gesture-required','--ignore-certificate-errors'] });
const ctx = await b.newContext({ viewport:{width:+w,height:+h}, reducedMotion: reduce==='1'?'reduce':'no-preference', ignoreHTTPSErrors:true, hasTouch: +w<900, isMobile: +w<900 });
await ctx.addInitScript(()=>{ HTMLMediaElement.prototype.canPlayType=function(){return 'probably'}; });
const p = await ctx.newPage(); const logs=[]; p.on('pageerror',e=>logs.push('PAGEERROR '+e.message)); p.on('console',m=>{if(m.type()==='error')logs.push(m.text().slice(0,140))});
await p.goto(target,{waitUntil:'networkidle',timeout:90000}).catch(e=>logs.push('goto '+e.message));
await p.waitForTimeout(1200);
const info = await p.evaluate(()=>{const r=document.querySelector('[data-bwin]');const b=r.getBoundingClientRect();return {top:b.top+scrollY,h:b.height,films:[...document.querySelectorAll('[data-bwin-film]')].map(f=>f.getBoundingClientRect().top+scrollY),lead:(document.querySelector('.bwin__lead')||{getBoundingClientRect(){return{top:0}}}).getBoundingClientRect().top+scrollY,tail:document.querySelector('.bwin__tail').getBoundingClientRect().top+scrollY}});
const shot = async (name,y,wait=2200)=>{ await p.evaluate(y=>window.scrollTo(0,y),y); await p.waitForTimeout(wait); await p.screenshot({path:`shots/${prefix}-${name}.png`}); };
const H=+h;
if (mode==='tour') {
  await shot('1-intro', info.top-72);
  await shot('2-lead', info.lead-H*0.45);
  for (let i=0;i<info.films.length;i++){ await shot(`3-ch${i+1}a`, info.films[i]-H*0.78, 900); await shot(`3-ch${i+1}b`, info.films[i]-H*0.3, 2600); }
  await shot('4-tail', info.tail-H*0.3, 2000);
  await shot('5-end', info.top+info.h-H+20, 1800);
}
const st = await p.evaluate(()=>[...document.querySelectorAll('video')].map(v=>({cur:(v.getAttribute('data-cur')||'').slice(-18),t:+v.currentTime.toFixed(2),paused:v.paused,rs:v.readyState,w:v.videoWidth})));
console.log(JSON.stringify(st)); console.log(JSON.stringify(info)); console.log(logs.slice(0,8).join('\n')||'inga sidfel');
await b.close();
