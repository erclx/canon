#!/usr/bin/env bash
# Installs the Playwright system packages for the named browsers, killing an
# attempt past its bound and retrying, since a degraded apt mirror hangs rather than fails.
# Usage: install-playwright-deps.sh [--package <spec>] <browser>... Exits 2 when no browser is named.
set -e

package=playwright
if [ "$1" = "--package" ]; then
  package=$2
  shift 2
fi

if [ $# -eq 0 ]; then
  echo "Usage: install-playwright-deps.sh [--package <spec>] <browser>..." >&2
  exit 2
fi

attempts=3
here=$(cd "$(dirname "$0")" && pwd)
bound=${INSTALL_ATTEMPT_SECONDS:-150}

# The runner image sets these, yet a stalled log shows gaps of minutes, so
# print what apt actually reads to settle whether they took effect
apt-config dump | grep -E '^Acquire::(Retries|http::Timeout) ' || true

# A mirror slow enough to hang an attempt is slow again on the next, so the
# first attempt drops the ec2 mirror and each retry leaves whichever came first
bash "$here/prefer-archive-mirror.sh" || true

status=0
for attempt in $(seq 1 "$attempts"); do
  if [ "$attempt" -gt 1 ]; then
    # timeout's signal is dropped before the root apt-get sudo spawns, so a root
    # apt-get or dpkg can outlive the kill and hold the lock the next attempt needs.
    sudo pkill -KILL -x 'apt-get|dpkg' || true
    # A kill during unpack leaves dpkg interrupted, which refuses the next
    # install. Its own failure must not end the loop.
    sudo dpkg --configure -a || echo "dpkg --configure -a failed before attempt ${attempt}" >&2
    bash "$here/prefer-archive-mirror.sh" --drop-first || true
  fi

  status=0
  timeout --kill-after=10 "$bound" bunx "$package" install-deps "$@" || status=$?
  if [ "$status" -eq 0 ]; then
    exit 0
  fi
  echo "attempt ${attempt}/${attempts} failed with exit ${status}" >&2
done

exit "$status"
