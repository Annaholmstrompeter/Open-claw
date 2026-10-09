// Simulerar artefaktvisaren: sidans innehåll i en iframe med sandbox="allow-scripts" (ogenomskinligt ursprung, ingen lagring, inga formulärinskick,
// historiken begränsad) på en värdsida med viewport-meta. Skelettet motsvarar det visaren lägger runt sidans innehåll.
import fs from 'node:fs';
import path from 'node:path';
import { scaleFonts } from './granska-lib.mjs';
export function hostFor(artFile, k, dir) {
  let art = fs.readFileSync(artFile, 'utf8'); if (k && k !== 1) art = scaleFonts(art, k);
  // skelettet är det visaren lägger runt sidans innehåll (avläst ur den publicerade sidan)
  const skeleton = `<!doctype html><html><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover"><style>:root{color-scheme:light;box-sizing:border-box;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}html{scroll-padding-top:env(safe-area-inset-top,0px)}body{margin:0;padding:0;font:14px -apple-system,BlinkMacSystemFont,sans-serif;background:#faf9f5;color:#141413}img{max-width:100%}[hidden]:not([hidden=until-found i]){display:none!important}</style></head><body>${art}</body></html>`;
  const f = path.join(dir, 'host-' + (k || 1) + '.html');
  fs.writeFileSync(f, `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0"><iframe id="f" sandbox="allow-scripts" style="border:0;width:100vw;height:100vh" srcdoc="${skeleton.replace(/&/g, '&amp;').replace(/"/g, '&quot;')}"></iframe></body></html>`);
  return f;
}
