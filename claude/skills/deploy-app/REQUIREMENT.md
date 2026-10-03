---
name: deploy-app
description: What the deploy setup gap is on each host, which of the manual steps this skill closes, and why the credential and the custom domain stay the operator's
---

# Deploy app requirement

## Gap

Without this skill, a deploy setup is a sequence performed from memory. Most of its repeated acts touch a service rather than the tree, so no workflow file can absorb them. One of those acts has already cost a broken deploy: the account ID displayed in the Cloudflare dashboard is truncated, and a value copied from there is wrong in a way that only shows up at deploy time. That is the Cloudflare instance of the general rule, that an ID comes from the host CLI's own session or files and never from a page a person copies out of.

The same sequence repeats on Vercel with different calls, so a skill per host would duplicate every guard and stop. Picking the wrong host is its own failure: a project mid-migration carries both hosts' files, and a silent pick creates a project on the account the operator was leaving.

## Must

- Pick the host from the signals the project already carries, and ask the operator when it carries none or both
- Create the host's project through its own CLI: `wrangler pages project create` or `vercel project add` and `vercel link`
- Fetch every account, org, or project ID from the host CLI's own session or files rather than have it typed or pasted
- Stop for the operator to issue the API token and run `gh secret set` for it themselves
- Verify every secret the host needs is present with `gh secret list` before continuing
- Stop for the operator at the custom domain step, since DNS sits outside the tree
- Call `wrangler`, `vercel`, and `gh` directly for every step those tools already cover

## Must not

- Accept an API token as input in any form. The toolkit verifies a secret exists, never what it contains.
- Print an ID to the transcript on its way to a secret
- Default to a host when the signals are absent or disagree
- Reimplement a host CLI call or `gh secret set` as a hand-built API call
- Seed a deploy workflow for Vercel, whose git integration already deploys on push
- Open a pull request or merge

## Guards

- `wrangler` or `vercel` not authenticated: stop and name the login command
- `gh` not authenticated: stop and name the login command
- A secret missing after the token stop: stop and name which one

## Out of scope

- Attaching a custom domain through the Cloudflare REST API instead of the dashboard. Measured absent from `wrangler pages` at plan time and the REST API was not read, so the dashboard stop stays for this pass.
- Running the deploy itself once secrets and the domain are set. On Cloudflare that is the seeded `deploy.yml` workflow, triggered by a push to main. On Vercel it is the git integration.
- A Vercel `tooling/` stack or a CI-gated Vercel deploy workflow.
- Reconfiguring an existing project's build settings on either host.
