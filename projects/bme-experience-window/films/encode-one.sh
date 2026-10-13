#!/bin/bash
# enc3.sh <id> <name> <L> <grade> [W H]   16:10 landscape loop with 1.2s crossfade, one shared base grade
id=$1; name=$2; L=$3; grade=$4; W=${5:-1600}; H=${6:-1000}; X=1.2
T=$(python3 -c "print($L+$X)")
CROP="${CROP:-crop=trunc(ih*1.6/2)*2:ih}"
BASE="curves=all='0/0.04 0.5/0.5 1/0.955',"
ffmpeg -y -v error -ss ${SS:-0} -i px_$id.mp4 -filter_complex "[0:v]${CROP},scale=${W}:${H}:flags=lanczos,fps=25,${grade},${BASE}format=yuv420p,split=2[a][b];[a]trim=0:${L},setpts=PTS-STARTPTS[m];[b]trim=${L}:${T},setpts=PTS-STARTPTS[t];[t][m]xfade=transition=fade:duration=${X}:offset=0,format=yuv420p[v]" -map "[v]" -an -c:v libx264 -preset slow -crf 28 -maxrate ${MAXRATE:-2600}k -bufsize $(( ${MAXRATE:-2600} * 2 ))k -profile:v high -level 4.0 -movflags +faststart ${OUT:-out3}/$name.mp4 && echo "$name $(stat -c %s ${OUT:-out3}/$name.mp4) $(ffprobe -v error -show_entries format=duration -of csv=p=0 ${OUT:-out3}/$name.mp4)"
