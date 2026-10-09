// Bygger maison-studio-enfil.html: index.html med CSS och alla skript inbyggda i en enda fil. Ingen installation behövs.
// Kör: node verktyg/bygg-enfil.mjs [källmapp] [utfil]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(process.argv[2] || path.join(HERE, '..'));
const OUT = path.resolve(process.argv[3] || path.join(ROOT, 'maison-studio-enfil.html'));
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
let html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
let n = 0;
html = html.replace(/<link rel="stylesheet" href="(css\/[^"]+)">/g, (_, f) => { n++; return '<style>\n' + read(f) + '\n</style>'; });
html = html.replace(/<script src="(js\/[^"]+)"><\/script>/g, (_, f) => { n++; return '<script>\n' + read(f) + '\n</script>'; });
html = html.replace(/<!-- Buketträknarens riktiga prismotor[^>]*-->/, '<!-- Enfilsversion: allt inbyggt (prismotor, data, gränssnitt, CSS). Typsnitten hämtas från Google Fonts. -->');
if (/<script src=|href="css\//.test(html)) throw new Error('en fil återstår som inte byggdes in');
fs.writeFileSync(OUT, html);
console.log(`${path.relative(process.cwd(), OUT) || OUT}: ${n} filer inbyggda, ${(Buffer.byteLength(html) / 1024).toFixed(0)} KB`);
