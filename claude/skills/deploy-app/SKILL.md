---
name: deploy-app
description: Sets up a deploy for the current project on Cloudflare Pages or Vercel by picking the host the project already carries, creating the host's project, setting the IDs it needs as repository secrets, and stopping for the operator to issue the API token and attach the custom domain. Calls `wrangler`, `vercel`, and `gh` rather than reimplementing them. Use when asked to "set up the deploy", "deploy this to Cloudflare Pages", "deploy this to Vercel", "set up the Pages project", "set up a Vercel project", or "connect this repo to Cloudflare". Do NOT use to run an already-configured deploy, which the host's own push trigger does, or to reconfigure an existing project's build settings.
---

# Deploy app

Runs the one-time setup a deploy needs before the host can publish on push, stopping for the acts only the operator can take. The procedure is the same on every host, and each host's CLI calls and stop points live in its own reference.

## Guards

- Never accept an API token as input, in a prompt, an argument, or a file. Verify a secret's presence with `gh secret list` rather than asking for or reading its content.
- Never print an account, org, or project ID to the transcript. Read it from the host CLI's own session or files and pipe it straight into `gh secret set`.
- Never reimplement a host CLI call or `gh secret set` as a hand-built HTTP call. Call the tools directly.
- If the project name is not supplied, derive it from the repository's own name (`basename` of `git remote get-url origin`, stripped of a trailing `.git`) and confirm it in the preview rather than asking first.

## Step 1: pick the host

Read the tree for these signals before running any command. A file that exists counts as a signal even when it is empty or stale, since the host reference's own guard is what judges whether it still works.

| Signal                                                                   | Host              |
| ------------------------------------------------------------------------ | ----------------- |
| `wrangler.toml` or `wrangler.jsonc` at the root                          | cloudflare        |
| a `pages deploy` line in any `.github/workflows/` file                   | cloudflare        |
| `.vercel/project.json`                                                   | vercel            |
| `vercel.json` at the root                                                | vercel            |
| a `wrangler` or `vercel` entry in `package.json` scripts or dependencies | the host it names |

- Signals for one host only: take that host.
- Signals for both, or for neither: ask the operator through the structured question surface, naming each signal found. Never default to a host, since a silent pick deploys to the wrong account.
- A host the operator named in the request wins over the signals. Say which signals disagreed with it, if any.

Report the pick on one line before the next step: `Host: <host>, from <signal>`.

## Step 2: check gh

If `gh auth status` fails, stop: `❌ gh is not authenticated. Run gh auth login, then re-invoke.`

## Step 3: run the host's steps

Read `${CLAUDE_SKILL_DIR}/references/<host>.md` for the host Step 1 picked, `cloudflare.md` or `vercel.md`, and run its steps in order, stopping wherever it stops. Each reference opens with its own CLI guard, creates the project, sets the IDs as secrets, stops for the token, verifies the secrets, stops for the custom domain, and hands off.

## Step 4: hand off

Report that setup is complete and name what deploys on the next push, in the words the host reference's handoff gives. Do not invoke `git-pr` or `git-ship` from here. The operator or the controlling session decides when to open that pull request.
