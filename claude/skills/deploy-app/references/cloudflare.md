---
title: Cloudflare Pages
description: The wrangler and gh calls a Cloudflare Pages deploy needs, the two stops for the API token and the custom domain, and the handoff to the seeded deploy workflow
---

# Cloudflare Pages

Run these steps once the body's Pick step resolves to Cloudflare.

## Guard

- If `wrangler whoami` fails, stop: `❌ wrangler is not authenticated. Run wrangler login, then re-invoke.`

## Step 1: create the Pages project

```bash
wrangler pages project create <project-name>
```

Report the command's own failure output and stop rather than retrying on a name collision. A project already existing under that name is the operator's to resolve.

## Step 2: fetch and set the account ID

Fetch the account ID from `wrangler`'s own authenticated session rather than asking the operator to copy it from the dashboard. The dashboard displays the account ID truncated, and a value copied from there fails the deploy silently:

```bash
wrangler whoami
```

Parse the account ID from that output and pipe it into the secret rather than printing it to the transcript first:

```bash
echo "<account-id>" | gh secret set CLOUDFLARE_ACCOUNT_ID
```

## Step 3: stop for the API token

Stop: `⏸ Create a Cloudflare API token with Pages edit permission at the Cloudflare dashboard, then run: gh secret set CLOUDFLARE_API_TOKEN. Re-invoke this skill once that's done.`

This is the one credential the skill never touches. Resume only once the operator confirms the token is set.

## Step 4: verify both secrets

```bash
gh secret list
```

- Both `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` present: continue.
- Either missing: stop and name which one, with the command that sets it.

## Step 5: stop for the custom domain

Stop: `⏸ Attach the custom domain to the <project-name> Pages project in the Cloudflare dashboard, then confirm here. Whether this can run through the API instead of the dashboard is out of scope for this skill, per its REQUIREMENT.md.`

## Step 6: hand off

Report that setup is complete and name the seeded workflow (`tooling/cloudflare/configs/.github/workflows/deploy.yml`, synced via `canon tooling sync cloudflare . --write`) as what deploys on the next push. Do not invoke `git-pr` or `git-ship` from here. The operator or the controlling session decides when to open that pull request.
