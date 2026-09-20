#!/usr/bin/env bash
set -euo pipefail

# Project-specific. Both are placeholders the project fills in, and the script
# refuses to run until it does, since a shipped default would capture the wrong
# part of the page in every project but the one it was written for.
README_FILTER='' # case label to capture, such as header/1280
README_EVIDENCE_DIR='assets/evidence/readme'

if [[ -z "$README_FILTER" ]]; then
  echo "README_FILTER is unset in scripts/readme-screenshot.sh. Name the case label the README frame is captured from, such as header/1280." >&2
  exit 1
fi

source "$(dirname "${BASH_SOURCE[0]}")/lib/preview-server.sh"

SCREENSHOT_BASE_URL="http://localhost:$PREVIEW_PORT" SCREENSHOT_FILTER="$README_FILTER" bun e2e/screenshot.ts

# The filter's section and viewport name the folder and the file prefix the
# capture wrote under screenshots/<hostname>/.
frame_dir="screenshots/localhost/$(dirname "$README_FILTER")"
frame_prefix="$(basename "$README_FILTER")"

mkdir -p "$README_EVIDENCE_DIR"
cp "$frame_dir/$frame_prefix--default.png" "$README_EVIDENCE_DIR/light.png"
cp "$frame_dir/$frame_prefix--dark.png" "$README_EVIDENCE_DIR/dark.png"
