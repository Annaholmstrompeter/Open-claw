#!/usr/bin/env bash
# Puts the sanctuary on the internet as a TEST site, on GitHub Pages, so Together can be tried on real phones.
#
#   sanctuary/tools/publish-test-site.sh [test-recording.mp3]
#   sanctuary/tools/publish-test-site.sh --build-only DIR [test-recording.mp3]     (only assembles the site in DIR)
#
# What it does: builds content.js, copies sanctuary/public (nothing else: no manuscripts, no notes) to a
# clean folder, and force-pushes that folder as the branch "gh-pages". GitHub Pages then serves it at
#   https://<owner>.github.io/<repo>/
# The branch is a build product: never edit it by hand, run this script again instead.
#
# The optional mp3 is put in as the Together recording (assets/audio/together/heart-to-heart.mp3). Use it for a
# click-track test file so that you can HEAR whether two phones are in step. It goes into the test site only, never
# into the sanctuary's own branch. Without it Together says that the recording is being prepared.
#
# One-time, in the GitHub repository (needs an owner): Settings -> Pages -> "Deploy from a branch" -> gh-pages, / (root).
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
BUILD_ONLY=""
if [ "${1:-}" = "--build-only" ]; then BUILD_ONLY="${2:?folder needed}"; shift 2; fi
REC="${1:-}"

python3 "$ROOT/sanctuary/tools/build-content.py" > /dev/null

SITE="${BUILD_ONLY:-$(mktemp -d)}"
mkdir -p "$SITE"
cp -R "$ROOT/sanctuary/public/." "$SITE/"
rm -f "$SITE/_headers"                 # GitHub Pages does not read it
touch "$SITE/.nojekyll"                # serve the files as they are
if [ -n "$REC" ]; then
  mkdir -p "$SITE/assets/audio/together"
  cp "$REC" "$SITE/assets/audio/together/heart-to-heart.mp3"
fi

if [ -n "$BUILD_ONLY" ]; then echo "site assembled in $SITE"; exit 0; fi

SRC="$(git -C "$ROOT" rev-parse --short HEAD)"
REMOTE="$(git -C "$ROOT" remote get-url origin)"
cd "$SITE"
git init -q -b gh-pages
git add -A
git -c user.name="${GIT_AUTHOR_NAME:-$(git -C "$ROOT" config user.name || echo publish)}" \
    -c user.email="${GIT_AUTHOR_EMAIL:-$(git -C "$ROOT" config user.email || echo publish@localhost)}" \
    commit -q -F - <<EOF
Testsida: fristaden med Together (byggd från $SRC)

Byggprodukt från sanctuary/tools/publish-test-site.sh. Redigeras inte för hand.

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01ECPs2YrbQPeDdGpYZqUbRn
EOF
git push -q --force "$REMOTE" gh-pages
echo "pushed branch gh-pages (from $SRC)"
rm -rf "$SITE"
