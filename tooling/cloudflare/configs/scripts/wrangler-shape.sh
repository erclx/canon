#!/usr/bin/env bash
# Prints the deploy shape of the Wrangler config in the working directory, and
# the D1 databases it binds, as `key=value` lines for `$GITHUB_OUTPUT`. Both
# deploy workflows read it, so one reading decides which of them deploys.
set -euo pipefail

config=""
for name in wrangler.json wrangler.jsonc wrangler.toml; do
  if [ -f "$name" ]; then
    config=$name
    break
  fi
done

if [ -z "$config" ]; then
  printf 'shape=none\nd1=\n'
  exit 0
fi

# Strings are matched first and kept, so a `//` or `/*` inside a value is no comment.
if [ "$config" = wrangler.toml ]; then
  body=$(perl -0777 -pe 's{("(?:\\.|[^"\\])*"|'"'"'[^'"'"']*'"'"')|#[^\n]*}{defined $1 ? $1 : ""}ge' "$config")
  entry='^[[:space:]]*main[[:space:]]*='
  output='^[[:space:]]*pages_build_output_dir[[:space:]]*='
  database='database_name[[:space:]]*=[[:space:]]*"[^"]*"'
else
  body=$(perl -0777 -pe 's{("(?:\\.|[^"\\])*")|/\*.*?\*/|//[^\n]*}{defined $1 ? $1 : ""}gse' "$config")
  entry='"main"[[:space:]]*:'
  output='"pages_build_output_dir"[[:space:]]*:'
  database='"database_name"[[:space:]]*:[[:space:]]*"[^"]*"'
fi

has_entry=false
has_output=false
grep -Eq "$entry" <<<"$body" && has_entry=true
grep -Eq "$output" <<<"$body" && has_output=true

case "$has_entry/$has_output" in
true/true) shape=both ;;
true/false) shape=worker ;;
false/true) shape=pages ;;
*) shape=none ;;
esac

databases=$(grep -Eo "$database" <<<"$body" | sed -E 's/.*"([^"]*)"$/\1/' | paste -sd ' ' - || true)
printf 'shape=%s\nd1=%s\n' "$shape" "$databases"
