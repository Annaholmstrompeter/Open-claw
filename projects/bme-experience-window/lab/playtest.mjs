// reproduces the reviewer's HIGH finding: does a pending play() that gets interrupted flip every film to "paused by the user"?
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'fs';
const blobs={};for(const i of [1,2,3,4,5])for(const sh of ['wide','tall'])blobs[`${i}-${sh}`]=fs.readFileSync(`media/bme-film-${i}-${sh}.mp4`).toString('base64');
const init=`(function(){const B=${JSON.stringify(blobs)};const cache={};HTMLMediaElement.prototype.canPlayType=function(){return 'probably'};const d=Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype,'src');Object.defineProperty(HTMLMediaElement.prototype,'src',{get(){return d.get.call(this)},set(v){const m=String(v).match(/bme-film-(\\d)-(wide|tall)\\.mp4/);if(!m){d.set.call(this,v);return;}const k=m[1]+'-'+m[2];if(!cache[k]){const bin=atob(B[k]);const u=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)u[i]=bin.charCodeAt(i);cache[k]=URL.createObjectURL(new Blob([u],{type:'video/webm'}));}d.set.call(this,cache[k]);}});})();`;
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome', proxy:{server:process.env.HTTPS_PROXY}, args:['--ignore-certificate-errors','--autoplay-policy=no-user-gesture-required'] });
const ctx = await b.newContext({ viewport:{width:390,height:844}, ignoreHTTPSErrors:true, hasTouch:true, isMobile:true });
await ctx.addInitScript(init);
const p = await ctx.newPage();
await p.goto(process.argv[2]||'https://9w0qpc-07.myshopify.com/?preview_theme_id=199116816758',{waitUntil:'networkidle',timeout:90000});
await p.evaluate(()=>document.querySelectorAll('[id*=shopify-pc], #preview-bar-iframe').forEach(e=>e.remove()));
const top = await p.evaluate(()=>document.querySelector('[data-bwin]').getBoundingClientRect().top+scrollY);
// fast flick through the section, then settle on chapter 2
for (let y=top; y<top+3200; y+=260){ await p.evaluate(y=>scrollTo(0,y),y); await p.waitForTimeout(35); }
for (let y=top+3200; y>top+1500; y-=300){ await p.evaluate(y=>scrollTo(0,y),y); await p.waitForTimeout(35); }
await p.waitForTimeout(2500);
const s = await p.evaluate(()=>({btn:document.querySelector('[data-bwin-pause-txt]').textContent,pressed:document.querySelector('[data-bwin-pause]').getAttribute('aria-pressed'),playing:[...document.querySelectorAll('[data-bwin] video')].filter(v=>!v.paused).length}));
console.log(JSON.stringify(s)); await b.close();
