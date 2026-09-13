#!/usr/bin/env bash
set -e
set -o pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="${PROJECT_ROOT:-$(cd "$SCRIPT_DIR/../.." && pwd)}"

WEB_DIST="$PROJECT_ROOT/web/dist"
GALLERY_DIST="$PROJECT_ROOT/web/gallery-dist"
MARKER='name="canon-gallery-marker"'

# Nothing to grep without a build. Callers run this after `bun run web:build`
# and `bun run web:gallery`, so an absent dist here means a build step itself
# failed rather than something this check can verify.
if [ ! -d "$WEB_DIST" ]; then
  echo "No $WEB_DIST. Run bun run web:build first." >&2
  exit 1
fi

if [ ! -d "$GALLERY_DIST" ]; then
  echo "No $GALLERY_DIST. Run bun run web:gallery first." >&2
  exit 1
fi

# A prose notice is not load-bearing: rewording it silently retires the leak
# check it backed with every workflow still green. The marker is a fixed
# `<meta>` tag `web/gallery-src/pages/index.astro` carries for exactly this,
# so asserting it survives in the gallery's own build is what turns a dropped
# marker into a loud failure here rather than a blind spot in the check below.
if ! grep -rl "$MARKER" "$GALLERY_DIST" >/dev/null 2>&1; then
  echo "The gallery build at $GALLERY_DIST carries no $MARKER. The gallery page dropped its own marker, which is what the leak check below reads for." >&2
  exit 1
fi

# `web/gallery.config.mjs` keeps the components-panel gallery out of the
# published build by never pointing its srcDir at it. A later config change
# that widens srcDir, or a gallery file moving under web/src/, would publish
# this repository's component internals to a live domain with every other
# check still green, which is what this guards against.
if find "$WEB_DIST" -iname '*gallery*' | grep -q .; then
  echo "A file named for the gallery reached $WEB_DIST. See web/gallery.config.mjs's srcDir." >&2
  exit 1
fi

if grep -rl "$MARKER" "$WEB_DIST" >/dev/null 2>&1; then
  echo "The gallery's own marker ($MARKER) reached $WEB_DIST. See web/gallery.config.mjs's srcDir." >&2
  exit 1
fi

echo "check-gallery-exclusion: gallery marker present in $GALLERY_DIST, absent from $WEB_DIST"
