// Testbänk: renderar sektionen med en riktig Liquid-motor (liquidjs) + temats typsnitt (Cormorant) till lab/page.html.
// Körs: cd lab && npm i liquidjs playwright && node build.mjs && node shoot.mjs 1440 900 d 0,0.3,0.6,1
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Liquid } from 'liquidjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const theme = path.join(here, '..', 'theme');
const src = fs.readFileSync(path.join(theme, 'sections', 'bme-experience.liquid'), 'utf8');
const schema = JSON.parse(src.match(/\{%\s*schema\s*%\}([\s\S]*?)\{%\s*endschema\s*%\}/)[1]);
// liquidjs känner inte `blank` och ignorerar inte schema/comment: gör om till nil och ta bort
const body = src
  .replace(/\{%\s*schema\s*%\}[\s\S]*?\{%\s*endschema\s*%\}/, '')
  .replace(/\bblank\b/g, 'nil')
  .replace(/\{%-?\s*comment\s*-?%\}[\s\S]*?\{%-?\s*endcomment\s*-?%\}/g, '');

// Inställningar som i templates/index.json: nyckeln "emphasis" saknas där, så schemats standardvärde gäller (precis som i Shopify)
const settings = {};
schema.settings.forEach((s) => { if (s.id) settings[s.id] = s.default ?? ''; });
settings.window_image = null;
const blocks = [
  'Not every moment matters equally.',
  'Under the right conditions, when the senses carry a moment, attention holds it and feeling seals it, the brain learns more deeply, and keeps what it learns.',
  'Breathe. Regulate.\nScent. Evoke.\nTouch. Embody.\nFeel. Amplify.\nAnchor. Associate.',
  'Five moments. One direction. A mind that finds its way there more easily, every time.',
].map((t, i) => ({ type: 'panel', settings: { text: t }, shopify_attributes: '', id: 'b' + i }));

const engine = new Liquid({ root: [path.join(theme, 'snippets')], extname: '.liquid' });
const html = await engine.parseAndRender(body, { section: { id: 'lab', settings, blocks }, nil: null });

const page = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
@font-face{font-family:Cormorant;font-weight:400;font-style:normal;src:url(fonts/cormorant_n4.woff2) format("woff2");}
@font-face{font-family:Cormorant;font-weight:400;font-style:italic;src:url(fonts/cormorant_i4.woff2) format("woff2");}
:root{--font-heading--family:Cormorant,serif;--header-height:72px;--header-group-height:72px}
html,body{margin:0;background:#f3eee3}
header.fake{position:sticky;top:0;height:72px;background:#f3eee3;z-index:50;display:flex;align-items:center;justify-content:center;font-family:Cormorant,serif;letter-spacing:.1em}
.spacer{height:520px;background:#f7f1e7;display:flex;align-items:center;justify-content:center;font-family:Cormorant,serif;font-size:2rem;color:#8a6f43}
</style></head><body>
<header class="fake">BODY MIND EARTH</header><div class="spacer">(hero)</div>
${html}
<div class="spacer">(next section)</div></body></html>`;
fs.writeFileSync(path.join(here, 'page.html'), page);
console.log('page.html skriven,', page.length, 'tecken');
