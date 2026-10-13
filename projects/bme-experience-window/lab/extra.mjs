import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args:['--autoplay-policy=no-user-gesture-required'] });
const run = async (name, opts, vp, y) => {
  const ctx = await b.newContext({ viewport:vp, ...opts });
  await ctx.addInitScript(()=>{ HTMLMediaElement.prototype.canPlayType=function(){return 'probably'}; });
  const p = await ctx.newPage(); const logs=[]; p.on('pageerror',e=>logs.push('ERR '+e.message)); p.on('response',r=>{if(r.status()>=400)logs.push(r.status()+' '+r.url().slice(-60))});
  await p.goto('http://127.0.0.1:8765/page.html',{waitUntil:'networkidle'}); await p.waitForTimeout(1200);
  const pos = await p.evaluate(()=>[...document.querySelectorAll('[data-bwin-film]')].map(f=>f.getBoundingClientRect().top+scrollY));
  for (const [k,yy] of Object.entries(y(pos,vp.height))) { await p.evaluate(v=>scrollTo(0,v),yy); await p.waitForTimeout(1500); await p.screenshot({path:`shots/${name}-${k}.png`}); }
  const st = await p.evaluate(()=>({live:document.querySelector('[data-bwin]').classList.contains('is-live'),playing:[...document.querySelectorAll('video')].filter(v=>!v.paused).length,btn:(document.querySelector('[data-bwin-pause-txt]')||{}).textContent,ctl:getComputedStyle(document.querySelector('.bwin__ctl')).display}));
  console.log(name, JSON.stringify(st), logs.join(' | ')||'no errors'); await ctx.close();
};
await run('rm',{reducedMotion:'reduce'},{width:1440,height:900},(pos,h)=>({a:pos[0]-h*.2,b:pos[1]-h*.2}));
await run('nojs',{javaScriptEnabled:false},{width:1440,height:900},(pos,h)=>({a:pos[0]-h*.2,b:pos[4]-h*.2}));
await run('w19',{},{width:1920,height:1080},(pos,h)=>({a:pos[1]-h*.25,b:pos[2]-h*.25}));
await run('t10',{},{width:1024,height:768},(pos,h)=>({a:pos[1]-h*.25,b:pos[3]-h*.25}));
await b.close();
