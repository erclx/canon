#!/usr/bin/env bash
# Pins the agent browser CLI the UI pass drives through, so every call in a run
# and every run on a machine reach one version. `open` is forced onto the
# bundled Chromium, since the CLI's default channel is a branded Chrome most
# machines lack, and it refuses rather than downloading when that browser is
# absent, since a dispatched reviewer that installs mid-pass spends its budget
# on the download.
set -euo pipefail

PW_CLI="@playwright/cli@0.1.22"
# The Chromium revision that CLI version requires. It moves with the pin, and
# it is separate from the revision any other Playwright on the machine uses.
PW_CHROMIUM_REVISION="1247"

die() {
  echo "pw.sh: $*" >&2
  exit 1
}

browsers_root() {
  if [ -n "${PLAYWRIGHT_BROWSERS_PATH:-}" ]; then
    echo "$PLAYWRIGHT_BROWSERS_PATH"
  elif [ "$(uname -s 2>/dev/null || echo unknown)" = Darwin ]; then
    echo "$HOME/Library/Caches/ms-playwright"
  else
    echo "$HOME/.cache/ms-playwright"
  fi
}

command -v bunx >/dev/null 2>&1 || die "bunx is not on PATH, so the pinned CLI cannot run"

# Global flags may lead the verb, as in `-s=<name> --raw open <url>`.
args=("$@")
verb_at=0
for i in "${!args[@]}"; do
  case "${args[$i]}" in
  -*) ;;
  *)
    verb_at=$i
    break
    ;;
  esac
done

if [ "${args[$verb_at]:-}" = open ]; then
  if [ ! -d "$(browsers_root)/chromium-$PW_CHROMIUM_REVISION" ]; then
    die "Chromium revision $PW_CHROMIUM_REVISION is not installed. Run once, outside the pass: bunx -y $PW_CLI install-browser chromium"
  fi
  has_browser=false
  for arg in "${args[@]}"; do
    case "$arg" in
    --browser=* | --browser) has_browser=true ;;
    esac
  done
  if [ "$has_browser" = false ]; then
    args=("${args[@]:0:$((verb_at + 1))}" --browser=chromium "${args[@]:$((verb_at + 1))}")
  fi
fi

exec bunx -y "$PW_CLI" "${args[@]}"
