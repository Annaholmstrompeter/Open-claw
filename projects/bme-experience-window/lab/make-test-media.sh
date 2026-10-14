#!/bin/bash
# Headless Chromium has no H.264. This makes VP9 stand-ins (same names) of the hosted films, for the lab and live.mjs ONLY.
# Usage: bash make-test-media.sh [cdn-prefix]      -> lab/media/bme-film-N-wide|tall.mp4 (WebM bytes) + .jpg
P=${1:-https://cdn.shopify.com/s/files/1/0961/8377/9702/files/bme-film-}
cd "$(dirname "$0")"; mkdir -p media; cd media
for n in 1 2 3 4 5; do for s in wide tall; do
  curl -sS -o h264_$n$s.mp4 "$P$n-$s.mp4"; curl -sS -o bme-film-$n-$s.jpg "$P$n-$s.jpg"
  ffmpeg -y -v error -i h264_$n$s.mp4 -c:v libvpx-vp9 -b:v 0 -crf 38 -row-mt 1 -an -f webm bme-film-$n-$s.mp4; rm h264_$n$s.mp4
done; done; ls -la
