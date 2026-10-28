#!/usr/bin/env bash
# Reports whether a pull request changes anything besides Markdown, called by
# the changes job in verify.yml to skip the macOS tests on a docs-only change.
# Prints code=false only when git lists at least one changed file and every
# one ends in .md, so a missing base, a failed diff, or an empty diff runs the
# tests rather than skipping them. Renames are split into a delete and an add,
# so a code file renamed to .md still counts as code.
#
# Usage: docs-only.sh <base>
# Writes to $GITHUB_OUTPUT, or stdout outside Actions, and always exits 0.

set -e

out=${GITHUB_OUTPUT:-/dev/stdout}
code=true

if [ $# -eq 1 ] && files=$(git diff --name-only --no-renames "$1" HEAD) && [ -n "$files" ]; then
  if ! grep -qv '\.md$' <<<"$files"; then
    code=false
  fi
fi

echo "code=$code" >>"$out"
echo "code=$code" >&2
