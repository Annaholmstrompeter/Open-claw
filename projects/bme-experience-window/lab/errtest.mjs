// How does the player react when play() is rejected? Only NotAllowedError (autoplay blocked) may flip the button to "Play films".
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const target = process.argv[2] || 'http://127.0.0.1:8765/page.html';
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args:['--autoplay-policy=no-user-gesture-required'] });
for (const errName of ['AbortError','NotAllowedError','NotSupportedError']) {
  const ctx = await b.newContext({ viewport:{width:1440,height:900} });
  await ctx.addInitScript(`HTMLMediaElement.prototype.canPlayType=function(){return 'probably'};HTMLMediaElement.prototype.play=function(){return Promise.reject(new DOMException('test','${errName}'));};`);
  const p = await ctx.newPage();
  await p.goto(target,{waitUntil:'networkidle'});
  const top = await p.evaluate(()=>document.querySelector('[data-bwin-track]').getBoundingClientRect().top+scrollY);
  await p.evaluate(y=>scrollTo(0,y-100),top); await p.waitForTimeout(500);
  for (let i=0;i<3;i++){ await p.click('[data-bwin-next]'); await p.waitForTimeout(300); }
  await p.waitForTimeout(500);
  const s = await p.evaluate(()=>({label:document.querySelector('[data-bwin-pause]').getAttribute('aria-label'),paused:document.querySelector('[data-bwin-pause]').classList.contains('is-paused')}));
  console.log(errName.padEnd(18), JSON.stringify(s));
  await ctx.close();
}
await b.close();
