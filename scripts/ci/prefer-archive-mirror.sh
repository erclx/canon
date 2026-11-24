#!/usr/bin/env bash
# Drops the AWS ec2 mirror from the runner's apt list, since it can degrade to a trickle.
# Usage: prefer-archive-mirror.sh [--drop-first], which drops every line above archive.ubuntu.com.
# Always exits 0, since apt may pass without the change.
set -u

list=${APT_MIRRORS_FILE:-/etc/apt/apt-mirrors.txt}
mode=${1:-}

if [ ! -f "$list" ]; then
  echo "No apt mirror list at ${list}, so nothing to change."
  exit 0
fi

# A tab or a space may separate the URL from its priority, so match the host only
if [ "$mode" = "--drop-first" ]; then
  filtered=$(awk '
    /^[a-z]+:\/\/archive\.ubuntu\.com([\/ \t]|$)/ { found = 1 }
    { lines[NR] = $0 }
    END {
      if (!found) { for (i = 1; i <= NR; i++) print lines[i]; exit }
      seen = 0
      for (i = 1; i <= NR; i++) {
        if (lines[i] ~ /^[a-z]+:\/\/archive\.ubuntu\.com([\/ \t]|$)/) seen = 1
        if (seen) print lines[i]
      }
    }' "$list")
else
  filtered=$(grep -v -E '^[a-z]+://[^/ 	]*ec2\.archive\.ubuntu\.com' "$list" || true)
fi

# Never leave the list empty
if [ -n "$(printf '%s' "$filtered" | tr -d '[:space:]')" ]; then
  tmp=$(mktemp)
  printf '%s\n' "$filtered" >"$tmp"
  if [ -w "$list" ]; then
    cat "$tmp" >"$list" || echo "Could not write ${list}." >&2
  else
    sudo cp "$tmp" "$list" || echo "Could not write ${list}." >&2
  fi
  rm -f "$tmp"
fi

echo "apt mirror list:"
cat "$list"
exit 0
