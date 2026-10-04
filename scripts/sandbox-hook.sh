#!/usr/bin/env bash
# No `-u`. Scenarios ran under the retired dispatcher without it and read unset
# variables as empty, so turning it on here changes what they provision.
set -e
set -o pipefail

# Runs one scenario's hooks for the provisioning order in
# `src/sandbox/provision.ts`. Scenarios and the library they call stay bash, so
# the harness reaches them through this entry and nothing else.
#
#   probe <scenario>         runs `use_config` and `use_anchor` when declared
#                            and prints every export they changed, closed by an
#                            `@anchor=<0|1>` record
#   stage <scenario> <file>  re-runs both hooks, runs `stage_setup` inside the
#                            tree, and writes the exports it changed to <file>,
#                            or an `@exited` record when the shell exits first
#
# Pairs are NUL-separated `NAME=value`, since a value can hold a newline. The
# retired dispatcher ran `stage_setup` in its own shell, so an export, an `exit`,
# or an `exec` there reached the harness, and the report carries all three: an
# `exec` skips the EXIT trap and leaves no report at all. The stage re-runs the
# hooks rather than receiving the probe's pairs, since they only export.

SCRIPT_DIR="$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
export PROJECT_ROOT

# Globals carry a prefix, since the scenario sourced below shares this shell.
_hook_die() {
  echo "sandbox-hook: $1" >&2
  exit 2
}
_hook_mode="${1:-}"
_hook_scenario="${2:-}"
_hook_report="${3:-}"

[[ "$_hook_mode" == "probe" || "$_hook_mode" == "stage" ]] || _hook_die "mode must be probe or stage, got: ${_hook_mode:-<empty>}"
[ -f "$_hook_scenario" ] || _hook_die "no scenario file at: ${_hook_scenario:-<empty>}"
[ "$_hook_mode" = "probe" ] || [ -n "$_hook_report" ] || _hook_die "stage needs a file to report its exports to"
[ "$_hook_mode" = "probe" ] || trap 'printf "@exited\0" >"$_hook_report"' EXIT

declare -A _hook_before
_hook_snapshot() {
  local name
  _hook_before=()
  for name in $(compgen -e); do
    _hook_before[$name]="${!name}"
  done
}

# The shell moves PWD and OLDPWD itself on every `cd`, and neither is state.
_hook_changed() {
  local name
  for name in $(compgen -e); do
    [[ "$name" == "PWD" || "$name" == "OLDPWD" ]] && continue
    if [[ ! -v _hook_before[$name] ]] || [ "${_hook_before[$name]}" != "${!name}" ]; then
      printf '%s=%s\0' "$name" "${!name}"
    fi
  done
}

# Taken before `config.sh`, so a `GITHUB_ORG` it derives from the remote reaches
# the harness as an export like any other.
_hook_snapshot

source "$PROJECT_ROOT/scripts/config.sh"
source "$PROJECT_ROOT/scripts/lib/ui.sh"
source "$PROJECT_ROOT/scripts/lib/sandbox-path.sh"
source "$PROJECT_ROOT/scripts/lib/sandbox-git.sh"
source "$PROJECT_ROOT/scripts/lib/sandbox-fixtures.sh"

# Unexported, as the dispatcher held them, so a scenario reads both while a
# child it spawns sees neither. Shellcheck cannot see the scenario reading them.
# shellcheck disable=SC2034
SANDBOX="$(resolve_sandbox_dir)" SANDBOX_DIR="$PROJECT_ROOT/sandbox"

# shellcheck source=/dev/null
source "$_hook_scenario"

_hook_declared() { [[ "$(type -t "$1")" == "function" ]]; }
_hook_run() {
  if _hook_declared use_config; then use_config; fi
  if _hook_declared use_anchor; then use_anchor; fi
}

if [ "$_hook_mode" = "probe" ]; then
  # Stdout carries the pairs alone, so a hook that prints is moved off it.
  _hook_run >&2
  _hook_changed
  if _hook_declared use_anchor; then printf '@anchor=1\0'; else printf '@anchor=0\0'; fi
  exit 0
fi

_hook_run
_hook_snapshot
cd "$SANDBOX"
stage_setup
trap - EXIT
_hook_changed >"$_hook_report"
