Third-party code used by TOGETHER (hosted here so guests' phones call no external code host).
Both files are loaded only when a shared session is opened; the rest of the sanctuary never loads them.

realtime.min.js   @supabase/realtime-js 2.117.3 (MIT, Copyright (c) 2020 Supabase)
                  bundled with @supabase/phoenix 0.4.5 (MIT, Copyright (c) 2014 Chris McCord)
                  and tslib 2.8.1 (0BSD, Copyright (c) Microsoft Corporation).
                  Used for Presence and Broadcast. Exposes window.BMERealtime.RealtimeClient.
qrcode.min.js     qrcode-generator 1.4.4 (MIT, Copyright (c) Kazuhiko Arase).
                  Draws the invitation QR code in the browser. Exposes window.BMEQR.qrcode.

Rebuild (needs Node):
  npm i @supabase/realtime-js@2.117.3 qrcode-generator@1.4.4 esbuild
  echo "import { RealtimeClient } from '@supabase/realtime-js'; window.BMERealtime = { RealtimeClient };" > rt.js
  echo "window.BMEQR = { qrcode: require('qrcode-generator') };" > qr.js
  npx esbuild rt.js --bundle --minify --format=iife --platform=browser --target=es2019,safari14 --legal-comments=none --outfile=realtime.min.js
  npx esbuild qr.js --bundle --minify --format=iife --platform=browser --target=es2019,safari14 --legal-comments=none --outfile=qrcode.min.js

The anon key you put in ../config.js is public by design. Never put a service_role or secret key anywhere in public/.
