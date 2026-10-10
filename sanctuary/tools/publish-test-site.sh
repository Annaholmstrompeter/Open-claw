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
# The optional mp3 is put in as the Together recording (assets/audio/together/heart-to-heart.mp3). Use any recording
# (for example one of the five rituals) so that you can HEAR whether two phones are in step: a voice that is out of
# step makes an echo. It goes into the test site only, never into the sanctuary's own branch. Without it Together
# says that the recording is being prepared.
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
# Every publish gets its own link: the scripts and styles are asked for as ?v=<time>, and the link we hand out ends in the
# same ?v=<time>, so a phone that still has the last version in its cache fetches the new one.
V="$(date +%y%m%d%H%M%S)"
sed -i -E "s#(src|href)=\"(assets/[^\"]+\.(js|css))\"#\1=\"\2?v=$V\"#g" "$SITE/index.html"
grep -q "assets/app.js?v=$V" "$SITE/index.html" || { echo "could not version the files in index.html: has it changed?" >&2; exit 1; }
# A test site must always show the latest: no offline cache. The page no longer registers the service worker, and
# the sw.js that is served only removes one that an earlier visit left behind.
sed -i "s/if ('serviceWorker' in navigator \&\&/if (false \&\&/" "$SITE/assets/app.js"
grep -q "if (false &&" "$SITE/assets/app.js" || { echo "could not switch off the service worker in app.js: has it changed?" >&2; exit 1; }
cat > "$SITE/sw.js" <<'JS'
/* Test site: no offline cache. This worker only clears away the cache an earlier visit may have left, then goes. */
self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) { return Promise.all(keys.map(function (k) { return caches.delete(k); })); })
      .then(function () { return self.registration.unregister(); })
  );
});
JS
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
PATHPART="${REMOTE%.git}"; REPO="${PATHPART##*/}"; OWNER="${PATHPART%/*}"; OWNER="${OWNER##*/}"
echo "link (live after about a minute): https://$OWNER.github.io/$REPO/?v=$V#/"
rm -rf "$SITE"
