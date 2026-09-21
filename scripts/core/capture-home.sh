#!/usr/bin/env bash
# Builds the landing page, captures it, and stages the frames over
# assets/evidence/home, the baseline `canon pr evidence` compares against.
#
# Two workflows call it. pr-visual-checks.yml stages the frames into the runner
# tree to diff them against the baseline, and refresh-capture-frames.yml stages
# them to commit as the new baseline. Both need the same frames, so one script
# keeps the two from drifting apart.
#
# `tooling/web/configs/e2e/screenshot.ts` is reused as is. This checkout has no
# web/package.json, so the preview server and the cases run against the
# root-level scripts rather than through screenshot.sh, which assumes a
# per-project `bun run build`/`bun run preview` pair.
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

# The committed tree is cleared first rather than copied over. A copy only adds
# and overwrites, so a section dropped from the case list would leave its
# frames in place and a diff would see no change. Clearing first shows that
# section as a deletion.
rm -rf "$BASELINE"
mkdir -p "$BASELINE"
cp -R web/screenshots/localhost/home/. "$BASELINE/"

# The sweep holds all four widths and this repository commits two, 320 and
# 1280. The case list is the place to change if that set moves.
find "$BASELINE" \( -name '768--*.png' -o -name '1536--*.png' \) -delete

# The shared golden config names the case that emulates nothing `default`, and
# this repository's baseline names that frame `light`.
find "$BASELINE" -name '*--default.png' -execdir sh -c 'mv "$1" "${1%--default.png}--light.png"' _ {} \;

echo "capture-home: staged frames in assets/evidence/home"
