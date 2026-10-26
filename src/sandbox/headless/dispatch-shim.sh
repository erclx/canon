#!/usr/bin/env bash
# Run by the claude wrapper installDispatchShim writes in src/sandbox/headless/dispatch.ts.
# $1 is the real claude binary, and everything after it is the caller's arguments.
real="$1"
shift

for arg in "$@"; do
  case "$arg" in
  --bg | --background)
    echo "canon sandbox harness: refusing $arg. A sandbox run may not dispatch a background session, so this shim stands first on PATH in place of the real claude binary. Drive the refusal the fixture asks for, or run this outside the harness." >&2
    exit 64
    ;;
  esac
done
exec "$real" "$@"
