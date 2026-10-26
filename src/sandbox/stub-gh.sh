#!/usr/bin/env bash
# stub gh
dir="$STUB_GH_DIR"
line="$(printf '%q ' "$@")"
line="${line% }"
printf '%s\n' "$line" >>"$dir/gh.log"

case "$1" in
api) exit 0 ;;
pr)
  case "$2" in
  create)
    count="$(cat "$dir/pr-count" 2>/dev/null || echo 0)"
    count=$((count + 1))
    echo "$count" >"$dir/pr-count"
    echo "https://github.com/stub-org/canon-sandbox/pull/$count"
    exit 0
    ;;
  close | list) exit 0 ;;
  esac
  ;;
esac

printf '%s\n' "$line" >>"$dir/gh-unknown.log"
echo "stub gh: unknown call: $line" >&2
exit 1
