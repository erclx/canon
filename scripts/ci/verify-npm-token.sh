#!/usr/bin/env bash
# Checks that the npm publish credential is set and authenticates, so a release
# is never cut it cannot publish. release-please.yml passes NPM_TOKEN from the
# step env, which keeps the secret named in the workflow.
set -e

if [ -z "$NPM_TOKEN" ]; then
  echo "::error::NPM_TOKEN is not set. Add the secret before a release can be cut."
  exit 1
fi
if ! curl -sf -H "Authorization: Bearer $NPM_TOKEN" https://registry.npmjs.org/-/whoami >/dev/null; then
  echo "::error::NPM_TOKEN did not authenticate. It is likely expired or revoked."
  exit 1
fi
