import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const [,, w='1440', h='900', prefix='c', mode='full', target='http://127.0.0.1:8765/page-v4.html'] = process.argv;
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args:['--autoplay-policy=no-user-gesture-required'] });
const ctx = await b.newContext({ viewport:{width:+w,height:+h}, hasTouch:+w<900, isMobile:+w<900, reducedMotion: mode==='rm'?'reduce':'no-preference', javaScriptEnabled: mode!=='nojs' });
await ctx.addInitScript("HTMLMediaElement.prototype.canPlayType=function(){return 'probably'}");
const p = await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
await p.goto(target,{waitUntil:'networkidle'}); await p.waitForTimeout(800);
const trackTop = await p.evaluate(()=>document.querySelector('[data-bwin-track]').getBoundingClientRect().top+scrollY);
const hh=+w<750?80:72;
const place = async()=>{ await p.evaluate(y=>scrollTo(0,y),trackTop-(hh+24)); await p.waitForTimeout(900); };
const state = ()=>p.evaluate(()=>{const t=document.querySelector('[data-bwin-track]');const s=[...document.querySelectorAll('[data-bwin-ch]')];const tr=t.getBoundingClientRect();return {count:(document.querySelector('[data-bwin-count]')||{}).textContent,scrollLeft:Math.round(t.scrollLeft),maxScroll:t.scrollWidth-t.clientWidth,active:s.findIndex(x=>x.classList.contains('is-active')),centerOffset:s.map(x=>{const r=x.getBoundingClientRect();return Math.round(r.left+r.width/2-(tr.left+tr.width/2));}),o:s.map(x=>+getComputedStyle(x.querySelector('[data-bwin-film]')).getPropertyValue('--o')),playing:[...document.querySelectorAll('[data-bwin] video')].map(v=>!v.paused),prevDis:(document.querySelector('[data-bwin-prev]')||{}).disabled,nextDis:(document.querySelector('[data-bwin-next]')||{}).disabled,pageOverflow:document.documentElement.scrollWidth>innerWidth+1,live:(document.querySelector('[data-bwin-live]')||{}).textContent}});
await place();
if(mode==='full'){
  console.log('start',JSON.stringify(await state()));
  await p.screenshot({path:`shots/${prefix}-0.png`});
  for(let i=1;i<5;i++){ await p.click('[data-bwin-next]'); await p.waitForTimeout(1600); await p.screenshot({path:`shots/${prefix}-${i}.png`}); const s=await state(); console.log('next',i,JSON.stringify({count:s.count,active:s.active,center:s.centerOffset[s.active],playing:s.playing,prevDis:s.prevDis,nextDis:s.nextDis,live:s.live})); }
  await p.click('[data-bwin-prev]'); await p.waitForTimeout(1500); console.log('prev',JSON.stringify((({count,active})=>({count,active}))(await state())));
  // mid-swipe: half way to the next film
  await p.evaluate(()=>{const t=document.querySelector('[data-bwin-track]');t.style.scrollSnapType='none';const s=document.querySelectorAll('[data-bwin-ch]');t.scrollLeft=(s[2].offsetLeft-(t.clientWidth-s[2].offsetWidth)/2+s[3].offsetLeft-(t.clientWidth-s[3].offsetWidth)/2)/2;});
  await p.waitForTimeout(500); await p.screenshot({path:`shots/${prefix}-mid.png`}); console.log('mid',JSON.stringify((({o,active})=>({o:o.map(x=>+x.toFixed(2)),active}))(await state())));
  await p.evaluate(()=>{document.querySelector('[data-bwin-track]').style.scrollSnapType='';}); await p.waitForTimeout(900);
  // keyboard
  await p.focus('[data-bwin-track]'); await p.keyboard.press('ArrowRight'); await p.waitForTimeout(1300); const k1=await state(); await p.keyboard.press('End'); await p.waitForTimeout(1500); const k2=await state(); await p.keyboard.press('Home'); await p.waitForTimeout(1500); const k3=await state();
  console.log('keys: Right ->',k1.active,'| End ->',k2.active,k2.count,'| Home ->',k3.active,k3.count);
  // snap: leave the track misaligned, it should settle on a film
  await p.evaluate(()=>{const t=document.querySelector('[data-bwin-track]');t.scrollTo({left:t.scrollLeft+180,behavior:'auto'});}); await p.waitForTimeout(1200); const sn=await state(); console.log('snap after +180px:',sn.active,'centerOffset',sn.centerOffset[sn.active]);
  // click a neighbour
  const before=(await state()).active; await p.evaluate(()=>{const s=document.querySelectorAll('[data-bwin-ch]');const a=[...s].findIndex(x=>x.classList.contains('is-active'));(s[a+1]||s[a-1]).querySelector('figure').click();}); await p.waitForTimeout(1500); console.log('click neighbour:',before,'->',(await state()).active);
  // pause button
  await p.click('[data-bwin-pause]'); await p.waitForTimeout(400); const ps=await state(); await p.click('[data-bwin-pause]'); await p.waitForTimeout(900); const ps2=await state(); console.log('pause -> playing',ps.playing.filter(Boolean).length,'| resume -> playing',ps2.playing.filter(Boolean).length);
} else { const s=await state(); console.log(mode,JSON.stringify({count:s.count,active:s.active,playing:s.playing.filter(Boolean).length,o:s.o,scrollable:s.maxScroll>0})); await p.screenshot({path:`shots/${prefix}-${mode}.png`}); await p.click('[data-bwin-track] [data-bwin-ch]:nth-child(3)',{timeout:1500}).catch(()=>{}); }
console.log('overflow',(await state()).pageOverflow,'errors',errs.join(';')||'none');
await b.close();
