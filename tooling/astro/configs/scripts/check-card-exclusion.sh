#!/usr/bin/env bash
set -e
set -o pipefail

# `card.config.mjs` keeps the social card route out of the published build by
# never pointing its srcDir at it. A later config change that widens srcDir, or
# a card file moving under src/pages/, would publish a half-size scaffolding
# page to a live domain with every other check still green.
#
# The card route has three consumers: the card server reads it, the capture
# reads it, and the published build must not carry it. This is the only one of
# the three a check can enforce, so the route's exclusion is a check rather than
# a convention.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="${PROJECT_ROOT:-$(cd "$SCRIPT_DIR/.." && pwd)}"

DIST="$PROJECT_ROOT/dist"
CARD_CONFIG="$PROJECT_ROOT/card.config.mjs"
MARKER='name="og-card-marker"'

# No card route installed, so there is nothing to exclude. Reported rather than
# passed silently, since a check that says nothing is indistinguishable from one
# that looked and found nothing.
if [ ! -f "$CARD_CONFIG" ]; then
  echo "check-card-exclusion: no card.config.mjs, so no card route to exclude"
  exit 0
fi

# Nothing to grep without a build. Callers run this after `bun run build`, so an
# absent dist here means the build itself failed rather than something this
# check can verify.
if [ ! -d "$DIST" ]; then
  echo "No $DIST. Run bun run build first." >&2
  exit 1
fi

# The marker is a fixed <meta> tag the card route carries for exactly this, so
# asserting it survives in the route's own source is what turns a dropped marker
# into a loud failure here rather than a blind spot in the test below. A prose
# notice is not load-bearing: rewording it silently retires the leak check it
# backed with every workflow still green.
if ! grep -rl "$MARKER" "$PROJECT_ROOT/card-src" >/dev/null 2>&1; then
  echo "No $MARKER under $PROJECT_ROOT/card-src. The card route dropped its own marker, which is what the leak test below reads for." >&2
  exit 1
fi

if grep -rl "$MARKER" "$DIST" >/dev/null 2>&1; then
  echo "The card route's marker ($MARKER) reached $DIST. See card.config.mjs's srcDir." >&2
  exit 1
fi

if find "$DIST" -iname '*og-card*' | grep -q .; then
  echo "A file named for the card route reached $DIST. See card.config.mjs's srcDir." >&2
  exit 1
fi

echo "check-card-exclusion: card marker present in card-src, absent from $DIST"
