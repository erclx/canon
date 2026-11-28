#!/usr/bin/env bash
# Prints the deploy shape of the Wrangler config in the working directory, the
# D1 databases it binds, and whether it declares `env.staging`, as `key=value`
# lines for `$GITHUB_OUTPUT`. Both deploy workflows read it, so one reading
# decides which of them deploys. Add a key as a new line, never by changing one.
set -euo pipefail

config=""
for name in wrangler.json wrangler.jsonc wrangler.toml; do
  if [ -f "$name" ]; then
    config=$name
    break
  fi
done

if [ -z "$config" ]; then
  printf 'shape=none\nd1=\nstaging=false\n'
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

# A JSON config is parsed rather than matched, so a `staging` key under `vars`
# is no environment. A config that does not parse reads as having none.
staging=false
if [ "$config" = wrangler.toml ]; then
  grep -Eq '^[[:space:]]*\[\[?[[:space:]]*env\.staging([.[:space:]]|\])' <<<"$body" && staging=true
else
  staging=$(perl -MJSON::PP -e '
    my $config = eval { JSON::PP->new->relaxed->decode(do { local $/; <STDIN> }) };
    my $env = ref $config eq "HASH" ? $config->{env} : undef;
    print ref $env eq "HASH" && ref $env->{staging} eq "HASH" ? "true" : "false";
  ' <<<"$body")
fi

printf 'shape=%s\nd1=%s\nstaging=%s\n' "$shape" "$databases" "$staging"
