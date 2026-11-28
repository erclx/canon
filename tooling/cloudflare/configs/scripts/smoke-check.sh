#!/usr/bin/env bash
# Requests a deployed Worker's health route and exits non-zero unless it answers
# with a success status. It retries, since a new version takes a few seconds to
# reach every edge, and `SMOKE_ATTEMPTS` and `SMOKE_DELAY` tune the wait.
#
# An answer carrying `cf-mitigated: challenge` is Cloudflare challenging the
# runner rather than the Worker failing, so it exits 3 as blocked at once. The
# caller reads 3 as no verdict on the deploy and rolls nothing back.
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
