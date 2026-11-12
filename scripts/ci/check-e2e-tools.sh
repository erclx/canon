#!/usr/bin/env bash
# Fails when a tool the e2e suites gate on is missing, called after the cache
# restore in verify.yml. Each suite skips rather than fails without its tool,
# so this turns a missing one into a red step before any suite starts.
#
# Usage: check-e2e-tools.sh <agent-cli-chromium-revision>
# The engine's browsers are checked by check-browsers.sh. This checks the
# exact Chromium revision the pinned agent CLI launches, which a glob on
# chromium-* would pass on the engine's revision alone, and FFmpeg's animated
# WebP encoder, which the reel suite needs. It also launches the engine's
# Chromium once, the probe the Playwright suites skip on, since a browser on
# disk that cannot start would otherwise skip five suites green.
set -eo pipefail

if [ $# -ne 1 ]; then
  echo "Usage: check-e2e-tools.sh <agent-cli-chromium-revision>" >&2
  exit 2
fi

if [ ! -d "$HOME/.cache/ms-playwright/chromium-$1" ]; then
  echo "Missing agent CLI Chromium revision $1" >&2
  exit 1
fi

if ! bun -e "const { chromium } = await import('playwright-core'); await (await chromium.launch()).close()"; then
  echo "The engine's Chromium is installed but does not launch" >&2
  exit 1
fi

ffmpeg -hide_banner -version >/dev/null
# grep reads the whole list rather than quitting at the first match, since an
# early close would fail ffmpeg on a broken pipe under pipefail
ffmpeg -hide_banner -encoders | grep libwebp_anim
