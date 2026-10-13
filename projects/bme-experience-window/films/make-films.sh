#!/bin/bash
# Rebuilds the 10 hosted film files + 10 posters from the Pexels originals (free commercial use, no attribution).
# Usage: bash make-films.sh <workdir>     (needs ffmpeg with libx264, curl, python3)
# Output: <workdir>/out/bme-film-N-wide.mp4|jpg and bme-film-N-tall.mp4|jpg  (N = 1..5)
set -e
W=${1:-./films-work}; mkdir -p "$W/src" "$W/out"; cd "$W"
HERE=$(cd "$(dirname "$0")" && pwd)
UA="Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36"
dl(){ [ -s "src/px_$1.mp4" ] && return; u=$(curl -sS -A "$UA" -o /dev/null -w "%{redirect_url}" "https://www.pexels.com/download/video/$1/"); curl -sS -A "$UA" -o "src/px_$1.mp4" "$u"; }
# one shared base grade (lifted blacks, soft highlights) is inside encode-one.sh; per-clip grade below
G1="eq=saturation=0.78:gamma=0.97:contrast=1.02,colorbalance=rs=0.04:bs=-0.06:rm=0.07:gm=0.02:bm=-0.09:rh=0.05:gh=0.03:bh=-0.08"
G2="eq=saturation=1.0:gamma=1.18:contrast=1.06,colorbalance=rs=0.05:bs=-0.04:rm=0.07:gm=0.02:bm=-0.07:rh=0.04:bh=-0.04"
G3="eq=saturation=0.5:gamma=1.2:contrast=1.03,hue=h=6,colorbalance=rm=0.03:bm=-0.02"
G4="eq=saturation=0.95:gamma=1.05:contrast=1.12,colorbalance=rm=0.02:bm=0.01"
G5="eq=saturation=1.1:gamma=1.12:contrast=1.04,colorbalance=rm=0.04:bm=-0.04:rh=0.03:bh=-0.03"
PORT="crop=trunc(ih*0.75/2)*2:ih"
for id in 38675645 7302972 3224617 856327 8553230; do dl $id; done
# encode-one.sh expects the sources next to it as px_<id>.mp4 and writes to $OUT
cp src/px_*.mp4 . ; cp "$HERE/encode-one.sh" ./enc.sh; chmod +x enc.sh
enc(){ # id name L grade cropWide cropTall SS
  OUT=out CROP="${5:-}" SS="${7:-0}" ./enc.sh "$1" "w-$2" "$3" "$4" 1600 1000 >/dev/null
  OUT=out CROP="${6:-$PORT}" SS="${7:-0}" MAXRATE=1800 ./enc.sh "$1" "t-$2" "$3" "$4" 900 1200 >/dev/null; }
enc 38675645 1 6.0 "$G1" "crop=2400:1500:0:300" "crop=1620:2160:60:0" 3.0
enc 7302972  2 7   "$G2" "" ""
enc 3224617  3 10  "$G3" "" ""
enc 856327   4 6.4 "$G4" "" ""
enc 8553230  5 10  "$G5" "crop=1504:940:300:140" "crop=752:940:560:140"
for n in 1 2 3 4 5; do
  mv out/w-$n.mp4 out/bme-film-$n-wide.mp4; mv out/t-$n.mp4 out/bme-film-$n-tall.mp4
  for s in wide tall; do ffmpeg -y -v error -ss 1.6 -i out/bme-film-$n-$s.mp4 -frames:v 1 -q:v 5 out/bme-film-$n-$s.jpg; done
done
echo "done: $W/out"
