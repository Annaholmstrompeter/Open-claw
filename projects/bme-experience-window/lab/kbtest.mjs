import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args:['--autoplay-policy=no-user-gesture-required'] });
const ctx = await b.newContext({ viewport:{width:1440,height:900} });
await ctx.addInitScript("HTMLMediaElement.prototype.canPlayType=function(){return 'probably'}");
const p = await ctx.newPage();
await p.goto('http://127.0.0.1:8765/page.html',{waitUntil:'networkidle'});
// 1) can a keyboard user reach the button while it is still hidden (page top)?
let reached=false, tabs=0;
for (let i=0;i<12 && !reached;i++){ await p.keyboard.press('Tab'); tabs++; reached = await p.evaluate(()=>document.activeElement&&document.activeElement.hasAttribute('data-bwin-pause')); }
await p.waitForTimeout(800);
const vis = await p.evaluate(()=>{const c=document.querySelector('.bwin__ctl');const r=document.querySelector('[data-bwin-pause]').getBoundingClientRect();return {focusedOpacity:getComputedStyle(c).opacity,inViewport:r.top>=0&&r.bottom<=innerHeight&&r.left>=0&&r.right<=innerWidth}});
console.log('Tab reaches the pause button:',reached,'after',tabs,'Tab presses |',JSON.stringify(vis));
// 2) press Space/Enter: films stop, label flips, press again: films play
await p.waitForTimeout(1200);
const playing=()=>p.evaluate(()=>[...document.querySelectorAll('[data-bwin] video')].filter(v=>!v.paused).length);
const lbl=()=>p.evaluate(()=>document.querySelector('[data-bwin-pause]').getAttribute('aria-label'));
console.log('before:',await playing(),'playing,',await lbl());
await p.keyboard.press('Enter'); await p.waitForTimeout(500);
console.log('after Enter:',await playing(),'playing,',await lbl());
await p.keyboard.press('Space'); await p.waitForTimeout(900);
console.log('after Space:',await playing(),'playing,',await lbl());
await b.close();
