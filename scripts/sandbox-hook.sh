#!/usr/bin/env bash
# No `-u`. Scenarios ran under the retired dispatcher without it and read unset
# variables as empty, so turning it on here changes what they provision.
set -e
set -o pipefail

# Runs one scenario's hooks for the provisioning order in
# `src/sandbox/provision.ts`. Scenarios and the library they call stay bash, so
# the harness reaches them through this entry and nothing else.
#
#   probe <scenario>  runs `use_config` and `use_anchor` when declared and prints
#                     every export they changed as NUL-separated NAME=value
#                     pairs, closed by an `@anchor=<0|1>` record
#   stage <scenario>  re-runs both hooks, then `stage_setup` inside the tree
#
# The stage re-runs the hooks rather than receiving the probe's pairs, since
# every scenario's hooks only export, and a re-run keeps `stage_setup` in the
# one shell those exports land in, as the retired dispatcher ran it.

SCRIPT_DIR="$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
export PROJECT_ROOT

die() {
  echo "sandbox-hook: $1" >&2
  exit 2
}

mode="${1:-}"
scenario="${2:-}"

[[ "$mode" == "probe" || "$mode" == "stage" ]] || die "mode must be probe or stage, got: ${mode:-<empty>}"
[ -f "$scenario" ] || die "no scenario file at: ${scenario:-<empty>}"

# Taken before `config.sh`, so a `GITHUB_ORG` it derives from the remote reaches
# the harness as an export like any other.
declare -A exported_before
if [ "$mode" = "probe" ]; then
  for name in $(compgen -e); do
    exported_before[$name]="${!name}"
  done
fi

source "$PROJECT_ROOT/scripts/config.sh"
source "$PROJECT_ROOT/scripts/lib/ui.sh"
source "$PROJECT_ROOT/scripts/lib/sandbox-path.sh"
source "$PROJECT_ROOT/scripts/lib/sandbox-git.sh"
source "$PROJECT_ROOT/scripts/lib/sandbox-fixtures.sh"

# Unexported, as the dispatcher held them, so a scenario reads both while a
# child it spawns sees neither.
# shellcheck disable=SC2034
SANDBOX="$(resolve_sandbox_dir)"
# shellcheck disable=SC2034
SANDBOX_DIR="$PROJECT_ROOT/sandbox"

# shellcheck source=/dev/null
source "$scenario"

has_hook() {
  [[ "$(type -t "$1")" == "function" ]]
}

run_hooks() {
  if has_hook use_config; then use_config; fi
  if has_hook use_anchor; then use_anchor; fi
}

if [ "$mode" = "probe" ]; then
  # Stdout carries the pairs alone, so a hook that prints is moved off it.
  run_hooks >&2

  for name in $(compgen -e); do
    if [[ ! -v exported_before[$name] ]] || [ "${exported_before[$name]}" != "${!name}" ]; then
      printf '%s=%s\0' "$name" "${!name}"
    fi
  done

  anchor=0
  if has_hook use_anchor; then anchor=1; fi
  printf '@anchor=%s\0' "$anchor"
  exit 0
fi

run_hooks
cd "$SANDBOX"
stage_setup
