#!/usr/bin/env bash

if [ "${BASH_VERSINFO[0]:-0}" -lt 4 ]; then
  echo "canon requires bash 4 or newer. Current: ${BASH_VERSION:-unknown}." >&2
  echo "Install via Homebrew: brew install bash" >&2
  exit 1
fi

# The frame writes no color. The scripts left on it run as setup and gate steps,
# where a pipe or a log reads the output more often than a terminal does.

log_info() {
  echo -e "│ ✓ $1" >&2
}
log_warn() {
  echo -e "│ ! $1" >&2
}
log_error() {
  echo -e "│ ✗ $1" >&2
  exit 1
}
log_step() {
  echo -e "│\n├ $1" >&2
}
log_add() {
  echo -e "│ + $1" >&2
}
log_rem() {
  echo -e "│ - $1" >&2
}

pipe_output() {
  while IFS= read -r line; do echo -e "│  $line" >&2; done
}

open_timeline() {
  echo -e "┌" >&2
  if [ -n "${1:-}" ]; then
    echo -e "│ $1" >&2
  fi
}

close_timeline() {
  echo -e "└" >&2
}
