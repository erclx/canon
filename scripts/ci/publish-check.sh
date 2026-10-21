#!/usr/bin/env bash
# Reports whether the newest GitHub release reached npm, called by the
# publish-check job in release-please.yml. The step passes GH_TOKEN and GH_REPO
# for gh. A release inside the publish job's 15-minute window passes, since its
# publish may still be running.
set -e

package=@erclx/canon

if ! release=$(gh release view --json tagName,publishedAt --jq '"\(.tagName) \(.publishedAt)"') || [ -z "$release" ]; then
  echo "::error::Could not read the newest GitHub release, so whether it reached npm is unknown."
  exit 1
fi
read -r tag published <<<"$release"
age=$(($(date +%s) - $(date -d "$published" +%s)))
if [ "$age" -lt 900 ]; then
  echo "$tag is ${age}s old, inside the 15-minute window its publish job runs in."
  exit 0
fi
# A missing version is an E404, so read the whole list to tell it from an outage
if ! versions=$(npm view "$package" versions --json); then
  echo "::error::Could not read $package from npm, so whether $tag reached it is unknown."
  exit 1
fi
if ! jq -e --arg v "${tag#v}" '[.] | flatten | index($v) != null' <<<"$versions" >/dev/null; then
  echo "::error::$tag has a GitHub release but npm does not serve it. Publish it with: gh workflow run release-please.yml -f tag=$tag"
  exit 1
fi
echo "$tag is on npm."
