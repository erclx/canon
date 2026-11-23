#!/usr/bin/env bash
# Builds the landing page, captures it, and stages the frames over assets/evidence/home,
# the baseline `canon pr evidence` compares against. Two workflows share it so they cannot drift.
# `tooling/web/configs/e2e/screenshot.ts` is reused, run against the root-level scripts since this checkout has no web/package.json.
set -e
set -o pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="${PROJECT_ROOT:-$(cd "$SCRIPT_DIR/../.." && pwd)}"

PORT=4321
BASE_URL="http://localhost:$PORT"
BASELINE="$PROJECT_ROOT/assets/evidence/home"

cd "$PROJECT_ROOT"

bun run web:build

bun run web:preview &
PREVIEW_PID=$!
trap 'kill "$PREVIEW_PID" 2>/dev/null || true' EXIT

for _ in $(seq 1 40); do
  curl -sSf "$BASE_URL/" >/dev/null 2>&1 && break
  sleep 0.25
done
curl -sSf "$BASE_URL/" >/dev/null 2>&1 || {
  echo "Preview server not responding on port $PORT after 10s." >&2
  exit 1
}

(cd web && SCREENSHOT_BASE_URL="$BASE_URL" bun ../tooling/web/configs/e2e/screenshot.ts)

# The committed tree is cleared first rather than copied over, so a section
# dropped from the case list shows as a deletion instead of leaving stale frames.
rm -rf "$BASELINE"
mkdir -p "$BASELINE"
cp -R web/screenshots/localhost/home/. "$BASELINE/"

# The sweep holds four widths and this repository commits two, 390 and 1280.
# The harness's VIEWPORTS is the place to change if that set moves.
find "$BASELINE" \( -name '768--*.png' -o -name '1536--*.png' \) -delete

# The shared golden config names the case that emulates nothing `default`, and
# this repository's baseline names that frame `light`.
find "$BASELINE" -name '*--default.png' -execdir sh -c 'mv "$1" "${1%--default.png}--light.png"' _ {} \;

echo "capture-home: staged frames in assets/evidence/home"
