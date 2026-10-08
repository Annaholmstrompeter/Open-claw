// Gör en version av enfilen för Claudes artefaktvisare: bara sidans innehåll, utan <html>, <head> och <body> (visaren lägger på dem).
// Titeln är ett namn på två till fyra ord. Kör: node verktyg/bygg-artefakt.mjs [utfil]   (bygg enfilen först med bygg-enfil.mjs)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.resolve(process.argv[2] || path.join(ROOT, 'maison-studio-artefakt.html'));
const src = fs.readFileSync(path.join(ROOT, 'maison-studio-enfil.html'), 'utf8');
const part = (re, what) => { const m = re.exec(src); if (!m) throw new Error('hittar inte ' + what); return m[0]; };
const fonts = part(/<link rel="stylesheet" href="https:\/\/fonts\.googleapis\.com[^>]*>/, 'typsnittslänken');
const style = part(/<style>[\s\S]*?<\/style>/, 'CSS');
const body = /<body[^>]*>([\s\S]*)<\/body>/.exec(src)[1].trim();
const page = '<title>Buketträknaren Maison Studio</title>\n' + fonts + '\n' + style + '\n' + body + '\n';
if (/<(!doctype|html|head|body)\b/i.test(page)) throw new Error('sidan innehåller fortfarande en dokumentram');
fs.writeFileSync(OUT, page);
console.log(path.relative(process.cwd(), OUT) + ': ' + (Buffer.byteLength(page) / 1024).toFixed(0) + ' KB');
