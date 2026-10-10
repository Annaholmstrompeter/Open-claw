// Serves sanctuary/public the way Cloudflare Pages would, for the browser tests:
//  - the site's own _headers (including its Content-Security-Policy) are applied, so a blocked
//    script, style or connection shows up as a test failure. Only connect-src gains the local mock.
//  - an unknown path answers with index.html and 200, as Pages does for a site without 404.html
//    (this is what a missing recording looks like on the real site).
//  - the TOGETHER recording is the test tone given in `recording` (or missing, if null).
//  - config.js is replaced by one pointing at the mock Realtime server.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.png': 'image/png',
  '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.mp3': 'audio/mpeg', '.txt': 'text/plain' };

function parseHeaders(file) {
  const out = {};
  let block = null;
  for (const raw of fs.readFileSync(file, 'utf8').split('\n')) {
    if (!raw.trim()) continue;
    if (!/^\s/.test(raw)) { block = raw.trim(); out[block] = {}; continue; }
    const i = raw.indexOf(':');
    if (block && i > 0) out[block][raw.slice(0, i).trim()] = raw.slice(i + 1).trim();
  }
  return out;
}

export function startServer({ publicDir, recording = null, mockUrl = null, debug = true, spaFallback = true }) {
  const rules = parseHeaders(path.join(publicDir, '_headers'));
  const global = Object.assign({}, rules['/*']);
  if (mockUrl && global['Content-Security-Policy']) {
    const ws = mockUrl.replace(/^http/, 'ws');
    global['Content-Security-Policy'] = global['Content-Security-Policy'].replace("connect-src 'self'", `connect-src 'self' ${mockUrl} ${ws}`);
  }
  const state = { recording, hits: [] };

  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    let p = decodeURIComponent(url.pathname);
    state.hits.push(p);
    const send = (code, headers, body) => { res.writeHead(code, Object.assign({}, global, headers)); res.end(body); };

    if (p === '/assets/together/config.js') {
      return send(200, { 'content-type': 'text/javascript', 'cache-control': 'no-store' },
        `window.BME_TOGETHER = ${JSON.stringify(mockUrl ? { supabaseUrl: mockUrl, supabaseAnonKey: 'test-anon-key', debug } : { supabaseUrl: '', supabaseAnonKey: '', local: false, debug })};`);
    }
    let file = null;
    if (p === '/assets/audio/together/heart-to-heart.mp3') file = state.recording;
    else {
      if (p.endsWith('/')) p += 'index.html';
      const f = path.join(publicDir, p);
      if (f.startsWith(publicDir) && fs.existsSync(f) && fs.statSync(f).isFile()) file = f;
    }
    if (!file) {
      // like Cloudflare Pages without a 404.html: an unknown page is the home page, with status 200
      const isAsset = /\.(mp3|webp|png|woff2|js|css|svg|webmanifest)$/.test(p);
      if (spaFallback && (!isAsset || p === '/assets/audio/together/heart-to-heart.mp3')) {
        return send(200, { 'content-type': MIME['.html'] }, fs.readFileSync(path.join(publicDir, 'index.html')));
      }
      return send(404, { 'content-type': 'text/plain' }, 'not found');
    }
    const stat = fs.statSync(file);
    const type = MIME[path.extname(file)] || 'application/octet-stream';
    const range = req.headers.range && /bytes=(\d*)-(\d*)/.exec(req.headers.range);
    if (range) {
      const start = range[1] ? +range[1] : 0, end = range[2] ? Math.min(+range[2], stat.size - 1) : stat.size - 1;
      res.writeHead(206, Object.assign({}, global, { 'content-type': type, 'accept-ranges': 'bytes', 'content-range': `bytes ${start}-${end}/${stat.size}`, 'content-length': end - start + 1 }));
      return fs.createReadStream(file, { start, end }).pipe(res);
    }
    res.writeHead(200, Object.assign({}, global, { 'content-type': type, 'content-length': stat.size, 'accept-ranges': 'bytes', 'cache-control': 'no-store' }));
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(file).pipe(res);
  });

  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => {
    const port = server.address().port;
    resolve({ port, base: `http://127.0.0.1:${port}/`, state, stop: () => server.close() });
  }));
}
