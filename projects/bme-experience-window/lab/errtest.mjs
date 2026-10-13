import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args:['--autoplay-policy=no-user-gesture-required'] });
for (const [label,errName] of [['AbortError (interrupted by scroll)','AbortError'],['NotAllowedError (autoplay blocked)','NotAllowedError'],['NotSupportedError (bad file)','NotSupportedError']]) {
  const ctx = await b.newContext({ viewport:{width:1440,height:900} });
  await ctx.addInitScript(`HTMLMediaElement.prototype.canPlayType=function(){return 'probably'};HTMLMediaElement.prototype.play=function(){return Promise.reject(new DOMException('test','${errName}'));};`);
  const p = await ctx.newPage();
  await p.goto('http://127.0.0.1:8765/page.html',{waitUntil:'networkidle'});
  const top = await p.evaluate(()=>document.querySelector('[data-bwin]').getBoundingClientRect().top+scrollY);
  for (let y=top+1200;y<top+3000;y+=300){ await p.evaluate(y=>scrollTo(0,y),y); await p.waitForTimeout(150); }
  await p.waitForTimeout(500);
  const s = await p.evaluate(()=>({label:document.querySelector('[data-bwin-pause]').getAttribute('aria-label'),paused:document.querySelector('[data-bwin-pause]').classList.contains('is-paused')}));
  console.log(label.padEnd(40), JSON.stringify(s));
  await ctx.close();
}
await b.close();
