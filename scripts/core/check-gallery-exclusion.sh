#!/usr/bin/env bash
set -e
set -o pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="${PROJECT_ROOT:-$(cd "$SCRIPT_DIR/../.." && pwd)}"

WEB_DIST="$PROJECT_ROOT/web/dist"

# Nothing to grep without a build. Callers run this after `bun run web:build`,
# so an absent dist here means the build step itself failed rather than
# something this check can verify.
if [ ! -d "$WEB_DIST" ]; then
  echo "No $WEB_DIST. Run bun run web:build first." >&2
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

if grep -rl 'Unrendered\. Needs' "$WEB_DIST" >/dev/null 2>&1; then
  echo "The gallery's unrendered-component notice reached $WEB_DIST. See web/gallery.config.mjs's srcDir." >&2
  exit 1
fi

echo "check-gallery-exclusion: gallery output absent from $WEB_DIST"
