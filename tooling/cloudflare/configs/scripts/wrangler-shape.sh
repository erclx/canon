#!/usr/bin/env bash
# Prints the Wrangler config's deploy shape, D1 databases, and staging environment
# as `key=value` lines for `$GITHUB_OUTPUT`. Both deploy workflows read it to decide
# which one deploys, so add a key as a new line and never change an existing one.
set -euo pipefail

config=""
for name in wrangler.json wrangler.jsonc wrangler.toml; do
  if [ -f "$name" ]; then
    config=$name
    break
  fi
done

if [ -z "$config" ]; then
  printf 'shape=none\nd1=\nstaging=false\nd1_staging=\n'
  exit 0
fi

# Strings are matched first and kept, so a `//` or `/*` inside a value is no comment.
if [ "$config" = wrangler.toml ]; then
  body=$(perl -0777 -pe 's{("(?:\\.|[^"\\])*"|'"'"'[^'"'"']*'"'"')|#[^\n]*}{defined $1 ? $1 : ""}ge' "$config")
  entry='^[[:space:]]*main[[:space:]]*='
  output='^[[:space:]]*pages_build_output_dir[[:space:]]*='
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

# A Wrangler environment inherits no D1 binding, so production and staging each
# migrate their own databases, and any other environment's are left out.
if [ "$config" = wrangler.toml ]; then
  environments=$(perl -ne '
    $table = $1 if /^\s*\[\[?\s*([^\]]+?)\s*\]\]?\s*$/;
    my $owner = $table =~ /^env\.staging(\.|$)/ ? "staging" : $table =~ /^env\./ ? "" : "top";
    $staging = 1 if $owner eq "staging";
    push @{ $names{$owner} }, $1 while $owner ne "" && /database_name\s*=\s*"([^"]*)"/g;
    END { printf "d1=%s\nstaging=%s\nd1_staging=%s\n", join(" ", @{ $names{top} || [] }), $staging ? "true" : "false", join(" ", @{ $names{staging} || [] }) }
  ' <<<"$body")
else
  # Parsed rather than matched, so a `staging` key under `vars` is no environment.
  # A config that does not parse keeps every database it names and no staging.
  databases=$(grep -Eo "$database" <<<"$body" | sed -E 's/.*"([^"]*)"$/\1/' | paste -sd ' ' - || true)
  environments=$(DATABASES=$databases perl -MJSON::PP -e '
    my $config = eval { JSON::PP->new->relaxed->decode(do { local $/; <STDIN> }) };
    if (ref $config ne "HASH") { printf "d1=%s\nstaging=false\nd1_staging=\n", $ENV{DATABASES}; exit }
    my $names = sub { join " ", map { ref $_ eq "HASH" ? $_->{database_name} // () : () } @{ ref $_[0] eq "ARRAY" ? $_[0] : [] } };
    my $staging = ref $config->{env} eq "HASH" && ref $config->{env}{staging} eq "HASH" ? $config->{env}{staging} : undef;
    printf "d1=%s\nstaging=%s\nd1_staging=%s\n", $names->($config->{d1_databases}), $staging ? "true" : "false", $staging ? $names->($staging->{d1_databases}) : "";
  ' <<<"$body")
fi

printf 'shape=%s\n%s\n' "$shape" "$environments"
