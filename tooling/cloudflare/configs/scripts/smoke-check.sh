#!/usr/bin/env bash
# Requests a deployed Worker's health route and exits non-zero unless it answers
# with a success status. It retries, since a new version takes a few seconds to
# reach every edge, and `SMOKE_ATTEMPTS` and `SMOKE_DELAY` tune the wait.
set -euo pipefail

url=${1:-}
attempts=${SMOKE_ATTEMPTS:-5}
delay=${SMOKE_DELAY:-3}

case "$url" in
http://* | https://*) ;;
*)
  echo "::error::smoke-check.sh needs the health route's full URL, got '$url'." >&2
  exit 2
  ;;
esac

for attempt in $(seq 1 "$attempts"); do
  status=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 10 "$url" || true)
  if [[ "$status" =~ ^2[0-9][0-9]$ ]]; then
    echo "Smoke check passed: $url answered $status."
    exit 0
  fi
  echo "Attempt $attempt of $attempts: $url answered ${status:-nothing}."
  [ "$attempt" -lt "$attempts" ] && sleep "$delay"
done

echo "::error::Smoke check failed: $url never answered with a 2xx status." >&2
exit 1
