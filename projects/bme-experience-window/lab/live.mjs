import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const [,, w='1440', h='900', prefix='live-d', mode='tour'] = process.argv;
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome', proxy:{server:process.env.HTTPS_PROXY, bypass:'127.0.0.1,localhost'}, args:['--ignore-certificate-errors','--autoplay-policy=no-user-gesture-required'] });
const ctx = await b.newContext({ viewport:{width:+w,height:+h}, ignoreHTTPSErrors:true, hasTouch:+w<900, isMobile:+w<900 });
// headless Chromium has no H.264: map the CDN films to local VP9 stand-ins of the same files, only for viewing
import fs from 'fs';
const blobs={};
for(const i of [1,2,3,4,5])for(const sh of ['wide','tall']){blobs[`${i}-${sh}`]=fs.readFileSync(`media/bme-film-${i}-${sh}.mp4`).toString('base64');}
await ctx.addInitScript(`(function(){const B=${JSON.stringify(blobs)};const cache={};
  HTMLMediaElement.prototype.canPlayType=function(){return 'probably'};
  const d=Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype,'src');
  Object.defineProperty(HTMLMediaElement.prototype,'src',{get(){return d.get.call(this)},set(v){const m=String(v).match(/bme-film-(\\d)-(wide|tall)\\.mp4/);
    if(!m){d.set.call(this,v);return;}
    const k=m[1]+'-'+m[2];if(!cache[k]){const bin=atob(B[k]);const u=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)u[i]=bin.charCodeAt(i);cache[k]=URL.createObjectURL(new Blob([u],{type:'video/webm'}));}
    d.set.call(this,cache[k]);}});})();`);
const p = await ctx.newPage(); const logs=[]; p.on('pageerror',e=>logs.push('PAGEERROR '+e.message)); p.on('console',m=>{if(['error'].includes(m.type()))logs.push(m.text().slice(0,160))}); p.on('response',r=>{if(r.status()>=400)logs.push(r.status()+' '+r.url().slice(0,110))});
await p.goto('https://9w0qpc-07.myshopify.com/?preview_theme_id=199116816758',{waitUntil:'networkidle',timeout:90000}).catch(e=>logs.push('goto '+e.message));
await p.evaluate(()=>{document.querySelectorAll('[id*=shopify-pc], .shopify-pc__banner__dialog, #preview-bar-iframe, iframe#preview-bar-iframe').forEach(e=>e.remove());});
await p.waitForTimeout(2500);
const info = await p.evaluate(()=>{const r=document.querySelector('[data-bwin]');if(!r)return {err:'section not found'};const q=s=>r.querySelector(s);const films=[...r.querySelectorAll('[data-bwin-film]')].map(f=>f.getBoundingClientRect().top+scrollY);const cs=getComputedStyle;return {live:r.classList.contains('is-live'),on:r.hasAttribute('data-bwin-on'),top:r.getBoundingClientRect().top+scrollY,h:r.offsetHeight,films,lead:q('.bwin__lead').getBoundingClientRect().top+scrollY,tail:q('.bwin__tail').getBoundingClientRect().top+scrollY,font:cs(q('.bwin__h2')).fontFamily.slice(0,40),h2:cs(q('.bwin__h2')).fontSize,effect:cs(q('.bwin__effect')).fontFamily.slice(0,30),words:r.querySelectorAll('.ch').length,videos:r.querySelectorAll('video').length,sw:document.documentElement.scrollWidth,iw:innerWidth}});
console.log(JSON.stringify(info));
if(mode==='tour'&&!info.err){
  const H=+h; const shot=async(n,y,wait=2200)=>{await p.evaluate(y=>scrollTo(0,y),y);await p.waitForTimeout(wait);await p.screenshot({path:`shots/${prefix}-${n}.png`});};
  await shot('1-intro',info.top-90,1500); await shot('2-lead',info.lead-H*.45,1500);
  for(let i=0;i<info.films.length;i++){await shot(`3-ch${i+1}a`,info.films[i]-H*.78,900);await shot(`3-ch${i+1}b`,info.films[i]-H*.3,2800);}
  await shot('4-tail',info.tail-H*.3,1800);
}
const st = await p.evaluate(()=>[...document.querySelectorAll('[data-bwin] video')].map(v=>({cur:(v.getAttribute('data-cur')||'').slice(-24),paused:v.paused,rs:v.readyState,err:v.error&&v.error.code})));
console.log(JSON.stringify(st)); console.log(logs.slice(0,12).join('\n')||'inga fel');
await b.close();
