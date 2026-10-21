#!/usr/bin/env bash
# Deletes the Cloudflare Pages preview deployments minted for one branch, called
# by the cleanup-preview job in .github/workflows/deploy.yml with the Pages
# project name and the branch. CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID
# come from the step env, and an absent secret skips the job the way the
# deploy's own guard does.
#
# Deployments are listed through the REST API rather than wrangler, whose
# listing carries no branch filter. `force=true` is what lets a deployment
# still holding its branch alias be deleted.
set -e

PROJECT_NAME=$1
BRANCH=$2

if [ -z "$CLOUDFLARE_API_TOKEN" ] || [ -z "$CLOUDFLARE_ACCOUNT_ID" ]; then
  echo "::notice::CLOUDFLARE_API_TOKEN or CLOUDFLARE_ACCOUNT_ID is not set, skipping preview cleanup."
  exit 0
fi
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
