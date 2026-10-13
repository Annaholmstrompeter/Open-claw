import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'fs';
const blobs={};
for(const i of [1,2,3,4,5])for(const sh of ['wide','tall']){blobs[`${i}-${sh}`]=fs.readFileSync(`media/bme-film-${i}-${sh}.mp4`).toString('base64');}
const init=`(function(){const B=${JSON.stringify(blobs)};const cache={};HTMLMediaElement.prototype.canPlayType=function(){return 'probably'};const d=Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype,'src');Object.defineProperty(HTMLMediaElement.prototype,'src',{get(){return d.get.call(this)},set(v){const m=String(v).match(/bme-film-(\\d)-(wide|tall)\\.mp4/);if(!m){d.set.call(this,v);return;}const k=m[1]+'-'+m[2];if(!cache[k]){const bin=atob(B[k]);const u=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)u[i]=bin.charCodeAt(i);cache[k]=URL.createObjectURL(new Blob([u],{type:'video/webm'}));}d.set.call(this,cache[k]);}});})();`;
const VPS=[[2560,1440],[1920,1080],[1440,900],[1280,720],[1024,768],[820,1180],[768,1024],[414,896],[390,844],[360,640],[320,568]];
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome', proxy:{server:process.env.HTTPS_PROXY}, args:['--ignore-certificate-errors','--autoplay-policy=no-user-gesture-required'] });
const only = process.argv[2] ? process.argv[2].split(',').map(Number) : null;
for (const [w,h] of VPS) {
  if (only && !only.includes(w)) continue;
  const ctx = await b.newContext({ viewport:{width:w,height:h}, ignoreHTTPSErrors:true, hasTouch:w<900, isMobile:w<900 });
  await ctx.addInitScript(init);
  const p = await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto('https://9w0qpc-07.myshopify.com/?preview_theme_id=199116816758',{waitUntil:'networkidle',timeout:90000}).catch(e=>errs.push('goto '+e.message));
  await p.evaluate(()=>document.querySelectorAll('[id*=shopify-pc], #preview-bar-iframe').forEach(e=>e.remove()));
  const top = await p.evaluate(()=>{const r=document.querySelector('[data-bwin]').getBoundingClientRect();return {t:r.top+scrollY,h:r.height}});
  const issues = new Map(); let maxPlaying=0, steps=0;
  const step = Math.max(80, Math.round(h/7));
  for (let y=top.t-100; y<top.t+top.h; y+=step) {
    await p.evaluate(y=>scrollTo(0,y),y); await p.waitForTimeout(260); steps++;
    const r = await p.evaluate(()=>{
      const out=[]; const vw=innerWidth, vh=innerHeight; const R=e=>e.getBoundingClientRect();
      if (document.documentElement.scrollWidth>vw+1) out.push('HORIZONTAL SCROLL '+document.documentElement.scrollWidth+'>'+vw);
      const hdr=[...document.querySelectorAll('header,.header,[class*=header]')].map(R).filter(r=>r.top<5&&r.height>30&&r.height<200&&r.width>vw*.8)[0];
      const hb=hdr?hdr.bottom:0;
      const ctl=document.querySelector('.bwin__ctl.is-show:not(.is-dodge) .bwin__pause'); const cr=ctl&&R(ctl);
      document.querySelectorAll('[data-bwin-ch]').forEach((c,i)=>{
        const f=c.querySelector('[data-bwin-film]'),fr=R(f);
        const vis=fr.bottom>hb&&fr.top<vh; if(!vis) return;
        const o=parseFloat(getComputedStyle(f).getPropertyValue('--o'));
        c.querySelectorAll('.bwin__sense,.bwin__effect,.bwin__no').forEach(e=>{
          const er=R(e); const inView=er.bottom>hb&&er.top<vh;
          if(o>.95){
            if(er.left<fr.left-1||er.right>fr.right+1||er.top<fr.top-1||er.bottom>fr.bottom+1) out.push(`ch${i+1} TEXT OUTSIDE FILM ${e.className}`);
            if(er.right>vw+1||er.left<-1) out.push(`ch${i+1} TEXT OFF-SCREEN ${e.className}`);
          }
          if(cr&&inView&&!(cr.right<er.left||cr.left>er.right||cr.bottom<er.top||cr.top>er.bottom)) out.push(`ch${i+1} PAUSE BUTTON OVER TEXT ${e.className}`);
        });
      });
      if(cr){ if(cr.top<hb-1) out.push('PAUSE BUTTON UNDER HEADER'); if(cr.right>vw+1) out.push('PAUSE BUTTON OFF-SCREEN'); }
      const playing=[...document.querySelectorAll('[data-bwin] video')].filter(v=>!v.paused).length;
      return {out,playing};
    });
    maxPlaying=Math.max(maxPlaying,r.playing);
    r.out.forEach(m=>issues.set(m,(issues.get(m)||0)+1));
  }
  console.log(`${w}x${h}: ${steps} steg, max samtidiga filmer ${maxPlaying}, ${issues.size?'PROBLEM: '+[...issues].map(([m,n])=>`${m} (x${n})`).join('; '):'inga problem'}${errs.length?' | sidfel: '+errs.join(';'):''}`);
  await ctx.close();
}
await b.close();
