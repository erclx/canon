#!/usr/bin/env bash
set -e
set -o pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="${PROJECT_ROOT:-$(cd "$SCRIPT_DIR/../.." && pwd)}"

source "$PROJECT_ROOT/scripts/lib/tooling.sh"

TOOLKIT_TOKEN="canon"
TOOLING_ROOT="$PROJECT_ROOT/tooling"

# `find` writes to stderr and returns non-zero for a missing root, inside a
# process substitution whose status nothing reads. Without this the walk covers
# nothing and the check reports the seeds independent having never read one.
if [ ! -d "$TOOLING_ROOT" ]; then
  echo "No tooling root at ${TOOLING_ROOT#"$PROJECT_ROOT/"}, seed independence unverifiable." >&2
  exit 1
fi

# An empty discovery is a real state rather than a broken walk, and the Seed
# standards stage already reports it as a skip. Failing here would have the two
# stages disagree about what the same condition means.
seed_roots=$(collect_seed_roots)
if [ -z "$seed_roots" ]; then
  echo "No seed root carries .claude/ or canon/, nothing to check." >&2
  exit 0
fi

# Markdown alone. The seed tree also ships hooks that call the toolkit CLI on
# purpose, each reporting a named stale-index warning when the binary is absent,
# and scoping by extension leaves them outside this walk without an exemption
# list that would have to be maintained against them.
cited=""
measured=0
while IFS= read -r seed_root; do
  while IFS= read -r file; do
    measured=$((measured + 1))
    # A token followed by `/` is the tracked surface root, a folder the seed
    # itself installs, rather than the binary. Every other spelling still
    # reports, which keeps a verb, a plugin skill prefix, and a bare mention in.
    while IFS= read -r hit; do
      cited="$cited  ${file#"$PROJECT_ROOT/"}:$hit"$'\n'
    done < <(grep -nE "${TOOLKIT_TOKEN}([^/]|$)" "$file" || true)
  done < <(find "$PROJECT_ROOT/$seed_root" -type f -name '*.md')
done <<<"$seed_roots"

# Roots resolved and no markdown under any of them is a walk that covered
# nothing, which is the verdict-without-a-measurement the guards above refuse for
# a missing tree. Reporting a pass here would say the seeds cite no CLI on the
# strength of having read no prose.
if [ "$measured" -eq 0 ]; then
  echo "Seed roots resolved but carry no markdown, seed independence unverifiable." >&2
  exit 1
fi

if [ -n "$cited" ]; then
  echo "Seed prose cites the toolkit CLI:" >&2
  printf '%s' "$cited" >&2
  echo "A scaffolded project may not have $TOOLKIT_TOKEN installed. State the capability the line needs rather than the binary that supplies it." >&2
  exit 1
fi
