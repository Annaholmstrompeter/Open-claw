import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'fs';
const blobs={};for(const i of [1,2,3,4,5])for(const sh of ['wide','tall'])blobs[`${i}-${sh}`]=fs.readFileSync(`media/bme-film-${i}-${sh}.mp4`).toString('base64');
const init=`(function(){const B=${JSON.stringify(blobs)};const cache={};HTMLMediaElement.prototype.canPlayType=function(){return 'probably'};const d=Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype,'src');Object.defineProperty(HTMLMediaElement.prototype,'src',{get(){return d.get.call(this)},set(v){const m=String(v).match(/bme-film-(\\d)-(wide|tall)\\.mp4/);if(!m){d.set.call(this,v);return;}const k=m[1]+'-'+m[2];if(!cache[k]){const bin=atob(B[k]);const u=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)u[i]=bin.charCodeAt(i);cache[k]=URL.createObjectURL(new Blob([u],{type:'video/webm'}));}d.set.call(this,cache[k]);}});})();`;
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome', proxy:{server:process.env.HTTPS_PROXY}, args:['--ignore-certificate-errors','--autoplay-policy=no-user-gesture-required'] });
const ctx = await b.newContext({ viewport:{width:390,height:844}, ignoreHTTPSErrors:true, hasTouch:true, isMobile:true });
await ctx.addInitScript(init);
const p = await ctx.newPage(); const cdp = await ctx.newCDPSession(p);
await p.goto('https://9w0qpc-07.myshopify.com/?preview_theme_id=199116816758',{waitUntil:'networkidle'});
const top=await p.evaluate(()=>document.querySelector('[data-bwin-track]').getBoundingClientRect().top+scrollY);
await p.evaluate(y=>scrollTo(0,y-100),top); await p.waitForTimeout(1500);
const act=()=>p.evaluate(()=>({a:[...document.querySelectorAll('[data-bwin-ch]')].findIndex(x=>x.classList.contains('is-active')),count:document.querySelector('[data-bwin-count]').textContent,y:Math.round(scrollY),page:document.documentElement.scrollWidth>innerWidth+1}));
const swipe=async(dx,dy,x0=195,y0=350)=>{ const steps=14; await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:x0,y:y0}]}); for(let i=1;i<=steps;i++){ await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x0+dx*i/steps,y:y0+dy*i/steps}]}); await p.waitForTimeout(16);} await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]}); await p.waitForTimeout(1700); };
const st=()=>p.evaluate(()=>{const t=document.querySelector('[data-bwin-track]');return {a:[...document.querySelectorAll('[data-bwin-ch]')].findIndex(x=>x.classList.contains('is-active')),sl:Math.round(t.scrollLeft)}});
console.log('start',JSON.stringify(await st()));
for (const dx of [-170,-170,-170,-230,-230,-120,-120,200,200,200,200]) { await swipe(dx,0); console.log('swipe',String(dx).padStart(5),JSON.stringify(await st())); }
await b.close();
