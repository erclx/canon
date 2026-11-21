#!/usr/bin/env bash
# Prints code=false only when git lists at least one changed file and every one
# ends in .md, so a missing base or empty diff runs the tests. Renames are split,
# so a code file renamed to .md counts as code. Usage: docs-only.sh <base>

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
