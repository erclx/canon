#!/usr/bin/env bash
# Deletes the Cloudflare Pages preview deployments minted for one branch, called
# by the cleanup-preview job in deploy-site.yml with the Pages project name and
# the branch. CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID come from the step
# env.
#
# Deployments are listed through the REST API rather than wrangler, whose
# listing carries no branch filter. `force=true` is what lets a deployment
# still holding its branch alias be deleted.
#
# tooling/cloudflare/configs/scripts/delete-previews.sh is the seeded copy,
# which adds a skip for an absent secret. Keep the two otherwise the same.
set -e

PROJECT_NAME=$1
BRANCH=$2

api="https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/pages/projects/$PROJECT_NAME/deployments"
auth="Authorization: Bearer $CLOUDFLARE_API_TOKEN"
page=1
ids=""
while :; do
  listing=$(curl -fsS -H "$auth" "$api?env=preview&per_page=25&page=$page")
  [ "$(echo "$listing" | jq '.result | length')" -eq 0 ] && break
  ids="$ids $(echo "$listing" | jq -r --arg branch "$BRANCH" '.result[] | select(.deployment_trigger.metadata.branch == $branch) | .id')"
  page=$((page + 1))
done
deleted=0
for id in $ids; do
  curl -fsS -X DELETE -H "$auth" "$api/$id?force=true" >/dev/null
  echo "Deleted $id"
  deleted=$((deleted + 1))
done
echo "Deleted $deleted preview deployments for $BRANCH."
