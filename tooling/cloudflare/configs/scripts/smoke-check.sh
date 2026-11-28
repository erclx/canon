#!/usr/bin/env bash
# Requests a deployed Worker's health route, exiting 0 on a 2xx, 3 as blocked when
# Cloudflare challenges the runner, and 1 otherwise. It retries, since a new version
# takes seconds to reach every edge, and `SMOKE_ATTEMPTS` and `SMOKE_DELAY` tune it.
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

headers=$(mktemp)
trap 'rm -f "$headers"' EXIT

for attempt in $(seq 1 "$attempts"); do
  : >"$headers"
  status=$(curl -sS -o /dev/null -D "$headers" -w '%{http_code}' --max-time 10 "$url" || true)
  # A challenge gives no verdict on the Worker, so the caller rolls nothing back on 3.
  if grep -iqE '^cf-mitigated:[[:space:]]*challenge[[:space:]]*$' <(tr -d '\r' <"$headers"); then
    echo "::error::Smoke check blocked: Cloudflare challenged the request to $url, so the run cannot tell whether the deploy is healthy. Allow the runner through, such as with a WAF skip rule on the health route." >&2
    exit 3
  fi
  if [[ "$status" =~ ^2[0-9][0-9]$ ]]; then
    echo "Smoke check passed: $url answered $status."
    exit 0
  fi
  echo "Attempt $attempt of $attempts: $url answered ${status:-nothing}."
  [ "$attempt" -lt "$attempts" ] && sleep "$delay"
done

echo "::error::Smoke check failed: $url never answered with a 2xx status." >&2
exit 1
