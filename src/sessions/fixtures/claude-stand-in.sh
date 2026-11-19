#!/usr/bin/env bash
# Answers like the client: `agents --json` lists one background session under
# a short id beside its full sessionId, and `stop` and `rm` match the short id
# alone, refusing the full one the way the real client does.
set -euo pipefail

SHORT='11111111'
FULL='11111111-1111-4111-8111-111111111111'

case "$1" in
agents)
  printf '[{"id":"%s","kind":"background","sessionId":"%s"},{"pid":9,"kind":"interactive","sessionId":"99999999-9999-4999-8999-999999999999"}]\n' "$SHORT" "$FULL"
  ;;
stop | rm)
  if [ "$2" = "$SHORT" ]; then
    echo "$1 $2"
    exit 0
  fi
  echo "No session matching '$2'. Run 'claude agents' to list running sessions." >&2
  exit 1
  ;;
*)
  exit 2
  ;;
esac
