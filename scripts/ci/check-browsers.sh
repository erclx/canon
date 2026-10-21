#!/usr/bin/env bash
# Fails when a Playwright browser named in the arguments is missing from the
# cache, called after the cache restore in pr-visual-checks.yml. A cache hit
# skips the install step, so a restore that came back empty would otherwise
# surface later as a launch error.
set -e

for browser in "$@"; do
  if ! compgen -G "$HOME/.cache/ms-playwright/${browser}-*" >/dev/null; then
    echo "Missing Playwright browser: ${browser}" >&2
    exit 1
  fi
done
