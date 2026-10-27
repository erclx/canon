#!/usr/bin/env bash
# Installs the Playwright system packages for the named browsers, killing an
# attempt that outlives its bound and retrying it. A degraded apt mirror hangs
# one connection rather than failing it, so a step timeout alone turns the
# hang into a red check and never recovers it, while a fresh attempt usually
# lands on a healthy backend.
#
# Usage: install-playwright-deps.sh [--package <spec>] [--archives <dir>] <browser>...
# --archives points apt's download cache at <dir> for the rest of the job, so a
# restored cache supplies the archives and the mirror serves only the delta.
# Exits 0 on the first success, 2 when no browser is named, and the last
# attempt's code when every attempt fails.
set -e

usage="Usage: install-playwright-deps.sh [--package <spec>] [--archives <dir>] <browser>..."

package=playwright
archives=
while [ $# -gt 0 ]; do
  case "$1" in
  --package)
    package=$2
    shift 2
    ;;
  --archives)
    archives=$2
    shift 2
    ;;
  *) break ;;
  esac
done

if [ $# -eq 0 ]; then
  echo "$usage" >&2
  exit 2
fi

if [ -n "$archives" ]; then
  mkdir -p "${archives}/partial"
  # The drop-in outlives the script, so a later apt-get in the same job reads
  # and fills the same folder. Keep-Downloaded-Packages holds the archives
  # past the install whatever the image sets.
  printf 'Dir::Cache::Archives "%s/";\nAPT::Keep-Downloaded-Packages "true";\n' "$archives" |
    sudo tee /etc/apt/apt.conf.d/99playwright-archives >/dev/null
fi

attempts=3
bound=${INSTALL_ATTEMPT_SECONDS:-150}

# The runner image sets these, yet a stalled log shows gaps of minutes, so
# print what apt actually reads to settle whether they took effect
apt-config dump | grep -E '^Acquire::(Retries|http::Timeout) ' || true

status=0
for attempt in $(seq 1 "$attempts"); do
  if [ "$attempt" -gt 1 ]; then
    # timeout runs as the runner user, and Linux drops its signal to the root
    # apt-get playwright spawns through sudo. sudo relays it only to its own
    # child shell, so a root apt-get or dpkg can outlive the kill and hold the
    # lock the next attempt needs.
    sudo pkill -KILL -x 'apt-get|dpkg' || true
    # A kill during unpack leaves dpkg interrupted, which refuses the next
    # install. Its own failure must not end the loop.
    sudo dpkg --configure -a || echo "dpkg --configure -a failed before attempt ${attempt}" >&2
  fi

  status=0
  timeout --kill-after=10 "$bound" bunx "$package" install-deps "$@" || status=$?
  if [ "$status" -eq 0 ]; then
    exit 0
  fi
  echo "attempt ${attempt}/${attempts} failed with exit ${status}" >&2
done

exit "$status"
