#!/usr/bin/env bash
set -e
set -o pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="${PROJECT_ROOT:-$(cd "$SCRIPT_DIR/../.." && pwd)}"

GITIGNORE="$PROJECT_ROOT/.gitignore"
MANIFEST="$PROJECT_ROOT/tooling/claude/manifest.toml"
SECTION="# Claude"

# Parity is exact, with no exception list behind it, and the move to `.canon/`
# is what removed the one there was. Its two members each named a path inside
# `.claude/` that this repository ignored and the manifest withheld, so a target
# kept tracking it. A single root entry can withhold nothing inside itself: git
# does not descend into an excluded directory, so a re-inclusion like
# `!.canon/diagrams/` matches nothing. Retiring both is what buys the one line.
#
# The diagrams divergence is the one that cost something. A target used to track
# its diagrams and keep the context audit's default coverage of them, and it now
# ignores them with the rest of its records, so that coverage is gone unless the
# project names the folder itself. `canon/context/tooling/manifests.md` carries the
# narrative.
#
# An exception mechanism is not kept against a future divergence, because an
# empty one cannot be exercised and a check nobody can test is a check nobody
# should trust. It comes back with its first real member or not at all.

if [ ! -f "$GITIGNORE" ]; then
  echo "No .gitignore at ${GITIGNORE#"$PROJECT_ROOT/"}, ignore parity unverifiable." >&2
  exit 1
fi

if [ ! -f "$MANIFEST" ]; then
  echo "No claude manifest at ${MANIFEST#"$PROJECT_ROOT/"}, ignore parity unverifiable." >&2
  exit 1
fi

# A gitignore pattern and a manifest entry describe the same folder whether or
# not either spells the trailing slash, so presence is compared with it dropped.
# No live pair differs that way now that both lists carry the same two entries,
# and the normalization stays because either side may be written without one.
normalize() {
  printf '%s\n' "${1%/}"
}

# Every pattern the file carries, comments and blank lines dropped. The whole
# file rather than one header, since a claude-scoped entry filed under a header
# of its own would otherwise read as missing from a list that carries it.
gitignore_patterns() {
  awk '{ sub(/[[:space:]]+$/, "") } $0 ~ /^[[:space:]]*#/ || $0 == "" { next } { print }' "$GITIGNORE"
}

# Every entry of the named array in the manifest's `[gitignore]` table. The
# array is accumulated to its closing bracket before the quoted strings are read
# out, so a formatter wrapping it across lines does not silently empty this.
manifest_entries() {
  awk -v key="\"$SECTION\"" '
    /^\[/ { table = $0 }
    table != "[gitignore]" { next }
    index($0, key) == 1 { collecting = 1; buf = "" }
    collecting { buf = buf $0 }
    collecting && index($0, "]") > 0 {
      collecting = 0
      buf = substr(buf, index(buf, "["))
      count = split(buf, parts, "\"")
      for (i = 2; i <= count; i += 2) print parts[i]
    }
  ' "$MANIFEST"
}

contains() {
  local needle=$1
  shift
  local candidate
  for candidate in "$@"; do
    [ "$candidate" = "$needle" ] || continue
    return 0
  done
  return 1
}

ignored=()
while IFS= read -r pattern; do
  [ -n "$pattern" ] || continue
  ignored+=("$(normalize "$pattern")")
done < <(gitignore_patterns)

shipped=()
while IFS= read -r entry; do
  [ -n "$entry" ] || continue
  shipped+=("$(normalize "$entry")")
done < <(manifest_entries)

# An empty read on either side is a parse that failed rather than a repository
# ignoring nothing, and reporting parity off it would say the two lists agree
# having compared none of their entries.
if [ ${#ignored[@]} -eq 0 ]; then
  echo "No patterns read from .gitignore, ignore parity unverifiable." >&2
  exit 1
fi

if [ ${#shipped[@]} -eq 0 ]; then
  echo "No entries read from the \"$SECTION\" array in ${MANIFEST#"$PROJECT_ROOT/"}, ignore parity unverifiable." >&2
  exit 1
fi

failures=""

# Entries the manifest ships that this repository does not ignore. A target is
# told to ignore a folder the toolkit itself tracks, which no decision sanctions,
# so this direction carries no exception list.
for entry in "${shipped[@]}"; do
  contains "$entry" "${ignored[@]}" && continue
  failures="$failures  $entry is shipped by the manifest and absent from .gitignore"$'\n'
done

# Claude-scoped patterns this repository ignores that the manifest does not
# ship. Scoped to the two record roots because the manifest is the claude stack
# and says nothing about `node_modules/` or `.env`.
#
# `.canon` is read as a bare root as well as a prefix, since it is one line
# covering a whole tree where `.claude/` names a folder inside a root that also
# holds tracked content. Leaving it out is what would let a new entry sit outside
# the only stage comparing the two lists, which is the direction that goes
# silently blind.
for pattern in "${ignored[@]}"; do
  case "$pattern" in
  .claude/* | .canon | .canon/*) ;;
  *) continue ;;
  esac
  contains "$pattern" "${shipped[@]}" && continue
  failures="$failures  $pattern is ignored here and absent from the manifest"$'\n'
done

if [ -n "$failures" ]; then
  echo "The ignore set a target receives disagrees with this repository's own:" >&2
  printf '%s' "$failures" >&2
  echo "Add the entry to the \"$SECTION\" array in ${MANIFEST#"$PROJECT_ROOT/"} and to .gitignore. The two lists are compared exactly, and nothing here records an exception." >&2
  exit 1
fi
