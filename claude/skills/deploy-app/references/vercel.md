---
title: Vercel
description: The vercel and gh calls a Vercel deploy needs, the two stops for the token and the custom domain, and the handoff to the git integration that deploys on push
---

# Vercel

Run these steps once the body's Pick step resolves to Vercel. Read `vercel <command> --help` before each call, since flags move between CLI releases and the installed one is the authority.

## Guard

- If `vercel whoami` fails, stop: `❌ vercel is not authenticated. Run vercel login, then re-invoke.`
- If `command -v jq` fails, stop: `❌ jq is not installed. Install it, then re-invoke.` Step 3 pipes its output into a secret, and a missing reader would set that secret empty while `gh secret list` still lists its name.

## Step 1: create and link the project

Skip the `project add` when `.vercel/project.json` already exists, and run the link anyway. A file left from a deleted or renamed project still counts as a signal, so the link is what judges it, failing on a project that is gone and rewriting the file against the one that answers.

```bash
vercel project add <project-name>
vercel link --yes --project <project-name>
```

The link writes `.vercel/project.json` and adds `.vercel` to `.gitignore`. Report the command's own failure output and stop rather than retrying on a name collision. A project already existing under that name is the operator's to resolve.

## Step 2: connect the repository

```bash
vercel git connect
```

Vercel deploys on push only once the project is connected to the repository, so this call is what makes the handoff true. Report its failure output and stop, since a project with no connection publishes nothing on push.

## Step 3: set the org and project IDs

Read both IDs from `.vercel/project.json`, which the link just wrote, rather than asking the operator to copy them from the dashboard. Confirm the file carries both before setting anything, since `jq -r` prints `null` for a missing key and exits zero, and `gh secret list` in Step 5 reads names rather than values:

```bash
jq -e '(.orgId | type == "string" and length > 0) and (.projectId | type == "string" and length > 0)' .vercel/project.json >/dev/null
```

On a non-zero exit, stop: `❌ .vercel/project.json carries no orgId or projectId. Delete it and re-invoke so the link writes it again.` Otherwise pipe each ID straight into its secret rather than printing it first:

```bash
jq -r .orgId .vercel/project.json | gh secret set VERCEL_ORG_ID
jq -r .projectId .vercel/project.json | gh secret set VERCEL_PROJECT_ID
```

No workflow reads these today. They are what a GitHub Actions job calling `vercel` reads, so a project that later moves to CI-gated deploys finds them set.

## Step 4: stop for the token

Stop: `⏸ Create a Vercel token at the Vercel account settings, then run: gh secret set VERCEL_TOKEN. Confirm here once that's done.`

This is the one credential the skill never touches. Resume only once the operator confirms the token is set.

## Step 5: verify the secrets

```bash
gh secret list
```

- `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`, and `VERCEL_TOKEN` present: continue.
- Any missing: stop and name which one, with the command that sets it.

## Step 6: stop for the custom domain

`vercel domains add <domain> <project-name>` attaches the domain to the project, and the DNS record that points the domain at Vercel is the operator's. Run the add only when the operator names the domain, then stop: `⏸ Point <domain>'s DNS at Vercel as vercel domains inspect <domain> describes, then confirm here.`

## Step 7: hand off

Report that setup is complete and that Vercel's git integration deploys every push, with production on the default branch and a preview on every other. No workflow is seeded for Vercel, since one would deploy each push a second time.
