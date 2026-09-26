#!/usr/bin/env bash
set -e
set -o pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="${PROJECT_ROOT:-$(cd "$SCRIPT_DIR/../.." && pwd)}"

INTERNAL_ROOT="$PROJECT_ROOT/internal"
PLUGIN_ROOT="$PROJECT_ROOT/claude"

# `find` writes to stderr and returns non-zero for a missing root, inside a
# process substitution whose status nothing reads. Without this the walk covers
# nothing and the check reports the boundary clean having never measured it.
if [ ! -d "$PLUGIN_ROOT" ]; then
  echo "No plugin root at ${PLUGIN_ROOT#"$PROJECT_ROOT/"}, boundary unverifiable." >&2
  exit 1
fi

# `realpath` resolves each walked path below. Absent, `set -e` aborts on the
# substitution and the stage reports a leak for a tool that is not installed,
# which is the same unmeasured-tree-with-a-verdict shape the guard above closes.
if ! command -v realpath >/dev/null 2>&1; then
  echo "realpath is not installed, boundary unverifiable." >&2
  exit 1
fi

# The plugin reaches `standards/` through a symlink, which an
# installer dereferences with no code in the path to filter. Walking the plugin
# tree with symlinks followed is what an install actually copies, so resolving
# each file and rejecting anything under `internal/` asserts the boundary at the
# only place it can be measured.
leaked=""
while IFS= read -r file; do
  resolved=$(realpath "$file")
  case "$resolved" in
  "$INTERNAL_ROOT"/*) leaked="$leaked  ${file#"$PROJECT_ROOT/"} -> ${resolved#"$PROJECT_ROOT/"}"$'\n' ;;
  esac
done < <(find -L "$PLUGIN_ROOT" -type f)

if [ -n "$leaked" ]; then
  echo "Plugin ships toolkit-internal content:" >&2
  printf '%s' "$leaked" >&2
  echo "Author internal content under internal/, which nothing under claude/ reaches." >&2
  exit 1
fi
