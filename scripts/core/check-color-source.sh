#!/usr/bin/env bash
set -e
set -o pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="${PROJECT_ROOT:-$(cd "$SCRIPT_DIR/../.." && pwd)}"

SCRIPTS_ROOT="$PROJECT_ROOT/scripts"
SANDBOX_ROOT="$PROJECT_ROOT/sandbox"
PALETTE_SOURCE="$SCRIPTS_ROOT/lib/ui.sh"

# `find` writes to stderr and returns non-zero for a missing root, inside a
# process substitution whose status nothing reads. Without this the walk covers
# nothing and the check reports the tree clean having never measured it.
if [ ! -f "$PALETTE_SOURCE" ]; then
  echo "No palette source at ${PALETTE_SOURCE#"$PROJECT_ROOT/"}, color sourcing unverifiable." >&2
  exit 1
fi

# The same silence follows a root that moved, so a walked root that is gone
# fails here rather than shrinking the corpus with no message.
for root in "$SCRIPTS_ROOT" "$SANDBOX_ROOT"; do
  if [ ! -d "$root" ]; then
    echo "No shell root at ${root#"$PROJECT_ROOT/"}, color sourcing unverifiable." >&2
    exit 1
  fi
done

# Any SGR sequence in either spelling. The cursor and erase sequences an
# interactive prompt writes end in a letter instead, and they run only where a
# terminal already exists, so they are not what this measures.
SGR='\\(033|e|x1b)\[[0-9;]*m'

# Sixteen copies of one decision is what made color impossible to turn off on
# the TypeScript side. A rule nothing enforces rebuilds them the next time a
# script wants grey, so the escape lives in the shared library and every other
# script reads the palette that library derives for its stream.
offenders=""
while IFS= read -r file; do
  [ "$file" = "$PALETTE_SOURCE" ] && continue
  if grep -qE "$SGR" "$file"; then
    offenders="$offenders  ${file#"$PROJECT_ROOT/"}"$'\n'
  fi
done < <(find "$SCRIPTS_ROOT" "$SANDBOX_ROOT" -type f -name '*.sh')

if [ -n "$offenders" ]; then
  echo "A color escape is defined outside the shared library:" >&2
  printf '%s' "$offenders" >&2
  echo "Source scripts/lib/ui.sh and read its palette, so one answer covers every writer." >&2
  exit 1
fi
