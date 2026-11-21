#!/usr/bin/env bash
# Fails when a tool the e2e suites gate on is missing, since each suite skips
# rather than fails without it. Usage: check-e2e-tools.sh <agent-cli-chromium-revision>
# It checks that exact revision, FFmpeg's animated WebP encoder, and one engine Chromium launch.
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
