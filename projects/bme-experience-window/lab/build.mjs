import fs from 'fs';
import { Liquid } from 'liquidjs';
const th = '../theme';
const src = fs.readFileSync(`${th}/sections/bme-experience.liquid`,'utf8');
const schema = JSON.parse(src.match(/\{%\s*schema\s*%\}([\s\S]*?)\{%\s*endschema\s*%\}/)[1]);
const body = src.replace(/\{%\s*schema\s*%\}[\s\S]*?\{%\s*endschema\s*%\}/,'').replace(/\bblank\b/g,'nil').replace(/\{%-?\s*comment\s*-?%\}[\s\S]*?\{%-?\s*endcomment\s*-?%\}/g,'');
const settings = {}; schema.settings.forEach(s=>{ if(s.id) settings[s.id]= (s.type==='video'||s.type==='image_picker') ? null : (s.default ?? ''); });
settings.film_files_url = 'media/bme-film-';
const blocks = ['Not every moment matters equally.','Under the right conditions, when the senses carry a moment, attention holds it and feeling seals it, the brain learns more deeply, and keeps what it learns.','Breathe. Regulate.\nScent. Evoke.\nTouch. Embody.\nFeel. Amplify.\nAnchor. Associate.','Five moments. One direction. A mind that finds its way there more easily, every time.'].map((t,i)=>({type:'panel',settings:{text:t},shopify_attributes:'',id:'b'+i}));
const eng = new Liquid({root:[`${th}/snippets`],extname:'.liquid'});
const html = await eng.parseAndRender(body,{section:{id:'lab',settings,blocks},nil:null});
const page = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
@font-face{font-family:Cormorant;font-weight:400;font-style:normal;src:url(fonts/cormorant_n4.woff2) format("woff2");}
@font-face{font-family:Cormorant;font-weight:400;font-style:italic;src:url(fonts/cormorant_i4.woff2) format("woff2");}
:root{--font-heading--family:Cormorant,serif;--header-height:72px;--header-group-height:72px}
html,body{margin:0;background:#f3eee3;font-family:Garamond,serif}
header.fake{position:sticky;top:0;height:72px;background:#f3eee3;z-index:50;display:flex;align-items:center;justify-content:center;font-family:Cormorant,serif;letter-spacing:.1em;border-bottom:1px solid #ddd}
.spacer{height:420px;background:#f7f1e7;display:flex;align-items:center;justify-content:center;font-family:Cormorant,serif;font-size:2rem;color:#8a6f43}
</style></head><body><header class="fake">BODY MIND EARTH</header><div class="spacer">(hero)</div>
${html}
<div class="spacer">(next section)</div></body></html>`;
fs.writeFileSync('page.html',page); console.log('page', page.length);
