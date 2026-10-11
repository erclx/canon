#!/usr/bin/env bash

if [ "${BASH_VERSINFO[0]:-0}" -lt 4 ]; then
  echo "canon requires bash 4 or newer. Current: ${BASH_VERSION:-unknown}." >&2
  echo "Install via Homebrew: brew install bash" >&2
  exit 1
fi

# `NO_COLOR` follows the published convention, where any non-empty value turns
# color off whatever the value says.
supports_color() {
  [ -z "${NO_COLOR:-}" ] && [ -t "$1" ]
}

# Assigns the six palette names for one file descriptor. The blank palette keeps
# every frame character and drops only the escapes, so a captured run still
# reads as one block.
#
# Bash returns a string and nothing richer, so the palette arrives through the
# caller's own scope. A writer declaring all six `local` before calling this
# keeps the assignment to itself, which is what leaves the source-time answer
# below standing for anything that sources this file.
set_palette() {
  if supports_color "$1"; then
    GREEN='\033[0;32m'
    RED='\033[0;31m'
    YELLOW='\033[0;33m'
    WHITE='\033[1;37m'
    GREY='\033[0;90m'
    NC='\033[0m'
  else
    GREEN=''
    RED=''
    YELLOW=''
    WHITE=''
    GREY=''
    NC=''
  fi
}

# Every writer below frames to stderr and asks about that stream at write time,
# so no answer is frozen before a caller's redirect is in place. This one answers
# for stdout instead, because it is read by a sourcing script writing its own
# frame with a bare `echo`, and that is the stream a bare `echo` reaches.
set_palette 1

log_info() {
  local GREEN RED YELLOW WHITE GREY NC
  set_palette 2
  echo -e "${GREY}│${NC} ${GREEN}✓${NC} $1" >&2
}
log_warn() {
  local GREEN RED YELLOW WHITE GREY NC
  set_palette 2
  echo -e "${GREY}│${NC} ${YELLOW}!${NC} $1" >&2
}
log_error() {
  local GREEN RED YELLOW WHITE GREY NC
  set_palette 2
  echo -e "${GREY}│${NC} ${RED}✗${NC} $1" >&2
  exit 1
}
log_step() {
  local GREEN RED YELLOW WHITE GREY NC
  set_palette 2
  echo -e "${GREY}│${NC}\n${GREY}├${NC} ${WHITE}$1${NC}" >&2
}
log_add() {
  local GREEN RED YELLOW WHITE GREY NC
  set_palette 2
  echo -e "${GREY}│${NC} ${GREEN}+${NC} $1" >&2
}
log_rem() {
  local GREEN RED YELLOW WHITE GREY NC
  set_palette 2
  echo -e "${GREY}│${NC} ${RED}-${NC} $1" >&2
}

pipe_output() {
  local GREEN RED YELLOW WHITE GREY NC
  set_palette 2
  while IFS= read -r line; do echo -e "${GREY}│${NC}  $line" >&2; done
}

open_timeline() {
  local GREEN RED YELLOW WHITE GREY NC
  set_palette 2
  echo -e "${GREY}┌${NC}" >&2
  if [ -n "${1:-}" ]; then
    echo -e "${GREY}│${NC} ${WHITE}$1${NC}" >&2
  fi
}

close_timeline() {
  local GREEN RED YELLOW WHITE GREY NC
  set_palette 2
  echo -e "${GREY}└${NC}" >&2
}

guard_root() {
  local target="$1"
  local target_abs
  target_abs=$(cd "$target" && pwd)
  if [ "$target_abs" = "$PROJECT_ROOT" ]; then
    log_error "Cannot run against toolkit root. Files here are the source of truth."
  fi
}
