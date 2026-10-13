import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'fs';
const blobs={};
for(const i of [1,2,3,4,5])for(const sh of ['wide','tall']){blobs[`${i}-${sh}`]=fs.readFileSync(`media/bme-film-${i}-${sh}.mp4`).toString('base64');}
const init=`(function(){const B=${JSON.stringify(blobs)};const cache={};HTMLMediaElement.prototype.canPlayType=function(){return 'probably'};const d=Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype,'src');Object.defineProperty(HTMLMediaElement.prototype,'src',{get(){return d.get.call(this)},set(v){const m=String(v).match(/bme-film-(\\d)-(wide|tall)\\.mp4/);if(!m){d.set.call(this,v);return;}const k=m[1]+'-'+m[2];if(!cache[k]){const bin=atob(B[k]);const u=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)u[i]=bin.charCodeAt(i);cache[k]=URL.createObjectURL(new Blob([u],{type:'video/webm'}));}d.set.call(this,cache[k]);}});})();`;
const VPS=(process.env.ONLY?process.env.ONLY.split(',').map(x=>x.split('x').map(Number)):[[2560,1440],[1920,1080],[1440,900],[1280,720],[1024,768],[820,1180],[768,1024],[414,896],[390,844],[360,640],[320,568]]);
const URL_=process.env.URL_||'https://9w0qpc-07.myshopify.com/?preview_theme_id=199116816758';
const real=URL_.startsWith('https');
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome', proxy: real?{server:process.env.HTTPS_PROXY}:undefined, args:['--ignore-certificate-errors','--autoplay-policy=no-user-gesture-required'] });
for (const [w,h] of VPS) {
  const ctx = await b.newContext({ viewport:{width:w,height:h}, ignoreHTTPSErrors:true, hasTouch:w<900, isMobile:w<900 });
  await ctx.addInitScript(init);
  const p = await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto(URL_,{waitUntil:'networkidle',timeout:90000}).catch(e=>errs.push('goto '+e.message));
  await p.evaluate(()=>{document.querySelectorAll('[id*=shopify-pc], #preview-bar-iframe').forEach(e=>e.remove());[...document.querySelectorAll('iframe')].forEach(e=>{let n=e;while(n&&n!==document.body){if(getComputedStyle(n).position==='fixed'){n.remove();return;}n=n.parentElement;}});});
  const info = await p.evaluate(()=>{const t=document.querySelector('[data-bwin-track]'); return {top:t.getBoundingClientRect().top+scrollY, n:t.querySelectorAll('[data-bwin-ch]').length, hh: (document.querySelector('header')||{offsetHeight:80}).offsetHeight};});
  const issues=new Map(); const add=m=>issues.set(m,(issues.get(m)||0)+1);
  const measure = async (tag)=>{
    await p.waitForTimeout(1500);
    const r = await p.evaluate(()=>{
      const out=[]; const vw=innerWidth,vh=innerHeight,R=e=>e.getBoundingClientRect();
      if(document.documentElement.scrollWidth>vw+1) out.push('PAGE HORIZONTAL SCROLL');
      const t=document.querySelector('[data-bwin-track]'),tr=R(t),tc=tr.left+tr.width/2;
      const s=[...t.querySelectorAll('[data-bwin-ch]')]; const a=s.findIndex(x=>x.classList.contains('is-active'));
      if(a<0) out.push('NO ACTIVE SLIDE'); else {
        const f=s[a].querySelector('[data-bwin-film]'),fr=R(f);
        if(Math.abs(fr.left+fr.width/2-tc)>3) out.push('ACTIVE NOT CENTERED '+Math.round(fr.left+fr.width/2-tc));
        if(fr.left<-1||fr.right>vw+1) out.push('ACTIVE FILM OUTSIDE SCREEN');
        s[a].querySelectorAll('.bwin__sense,.bwin__effect,.bwin__no').forEach(e=>{const er=R(e); if(er.left<fr.left-1||er.right>fr.right+1||er.top<fr.top-1||er.bottom>fr.bottom+1) out.push('TEXT OUTSIDE FILM '+e.className);});
        if(parseFloat(getComputedStyle(f).getPropertyValue('--o'))<.98) out.push('ACTIVE NOT FULLY OPEN');
        const isPlay=!s[a].querySelector('video').paused; if(!isPlay && !document.querySelector('[data-bwin-pause]').classList.contains('is-paused')) out.push('ACTIVE FILM NOT PLAYING');
        if(vw>=750){ const nb=s[a+1]||s[a-1]; const nr=R(nb.querySelector('[data-bwin-film]')); const vis=Math.min(nr.right,vw)-Math.max(nr.left,0); if(vis<24) out.push('NO NEIGHBOUR PEEK'); }
      }
      const bar=document.querySelector('[data-bwin-bar]'),br=R(bar);
      if(br.left<-1||br.right>vw+1) out.push('BAR OUTSIDE SCREEN');
      const btns=[...bar.querySelectorAll('.bwin__btn')].map(R);
      btns.forEach((x,i)=>{ if(x.width<43||x.height<43) out.push('TOUCH TARGET <44'); if(x.right>vw||x.left<0) out.push('BUTTON OFF SCREEN'); for(let j=i+1;j<btns.length;j++){const y=btns[j]; if(!(x.right<=y.left+.5||y.right<=x.left+.5||x.bottom<=y.top||y.bottom<=x.top)) out.push('BUTTONS OVERLAP');}});
      const playing=[...document.querySelectorAll('[data-bwin] video')].filter(v=>!v.paused).length; if(playing>2) out.push('MORE THAN 2 PLAYING '+playing);
      return out;
    });
    r.forEach(add);
  };
  await p.evaluate(({y})=>scrollTo(0,y),{y:info.top-info.hh-16}); await measure('0');
  for(let i=1;i<info.n;i++){ await p.click('[data-bwin-next]'); await measure(String(i)); }
  // bar must also be reachable in view at the last slide
  const barVisible = await p.evaluate(()=>{const r=document.querySelector('[data-bwin-bar]').getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight;});
  if(!barVisible) add('CONTROLS BELOW THE FOLD AT FILM POSITION');
  console.log(`${w}x${h}: ${info.n} slides, ${issues.size?'PROBLEM: '+[...issues].map(([m,n])=>`${m} (x${n})`).join('; '):'inga problem'}${errs.length?' | sidfel: '+errs.join(';'):''}`);
  await ctx.close();
}
await b.close();
