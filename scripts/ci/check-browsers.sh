#!/usr/bin/env bash
# Fails when a Playwright browser named in the arguments is missing from the
# cache, since a cache hit skips the install and an empty restore would surface
# later as a launch error. Called after the restore in pr-visual-checks.yml.
set -e

for browser in "$@"; do
  if ! compgen -G "$HOME/.cache/ms-playwright/${browser}-*" >/dev/null; then
    echo "Missing Playwright browser: ${browser}" >&2
    exit 1
  fi
done
