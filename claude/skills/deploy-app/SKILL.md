---
name: deploy-app
description: Sets up a Cloudflare Pages deploy for the current project by creating the Pages project, fetching the account ID, and stopping twice for the operator to issue the API token and attach the custom domain. Calls `wrangler` and `gh` rather than reimplementing them. Use when asked to "set up Cloudflare deploy", "deploy this to Cloudflare Pages", "set up the Pages project", or "connect this repo to Cloudflare". Do NOT use to run an already-configured deploy, which the seeded workflow does on push, or to reconfigure an existing Pages project's build settings.
---

# Deploy app

Runs the one-time setup a Cloudflare Pages deploy needs before the seeded `deploy.yml` workflow can run, stopping twice for the two acts only the operator can take.

## Guards

- If `gh auth status` fails, stop: `❌ gh is not authenticated. Run gh auth login, then re-invoke.`
- Never accept a Cloudflare API token as input, in a prompt, an argument, or a file. Verify a secret's presence with `gh secret list` rather than asking for or reading its content.
- Never reimplement `wrangler pages project create` or `gh secret set` as a hand-built HTTP call. Call the tools directly.
- If the project name is not supplied, derive it from the repository's own name (`basename` of `git remote get-url origin`, stripped of a trailing `.git`) and confirm it in the preview rather than asking first.

## Step 1: run the host's steps

Read `${CLAUDE_SKILL_DIR}/references/cloudflare.md` and run its steps in order, stopping wherever it stops.
