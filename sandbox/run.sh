#!/usr/bin/env bash
set -e

# Kept so the paths citing this runner keep resolving. `canon sandbox run` is the
# runner, and `-h` or `--help` reach its usage through the pass-through below.
SCRIPT_DIR="$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

exec bun "$PROJECT_ROOT/src/cli.ts" sandbox run "$@"
