---
name: deploy-app
description: What the deploy setup gap is on each host, which of the manual steps this skill closes, and why the credential and the custom domain stay the operator's
---

# Deploy app requirement

## Gap

Without this skill, a deploy setup is a sequence performed from memory. Most of its acts touch a service rather than the tree, so no workflow file absorbs them, and an account ID copied from a host's dashboard can be truncated in a way that shows only at deploy time.

The sequence repeats on Cloudflare and Vercel with different calls, so a skill per host duplicates every stop. A project mid-migration carries both hosts' files, and a silent pick creates a project on the account the operator was leaving.

## Must

- The host comes from the signals the project carries, and the operator is asked when it carries none or both
- The host's project is created and every account, org, or project ID fetched through the host CLI's own session or files
- The operator issues the API token and runs `gh secret set` themselves, and every secret the host needs is confirmed with `gh secret list` before continuing
- The run stops for the operator at the custom domain step
- `wrangler`, `vercel`, and `gh` are called directly for every step they cover, each confirmed authenticated first

## Must not

- Accept an API token as input in any form
- Take an ID from the operator
- Default to a host when the signals are absent or disagree
- Seed a deploy workflow for Vercel, whose git integration already deploys on push
- Open a pull request or merge

## Out of scope

- Running the deploy once secrets and the domain are set, which the seeded workflow or the host's git integration owns
- The workflow structure around a deploy job, which `ci-workflow` owns
- A Vercel tooling stack, a domain attached through the REST API, or reconfiguring an existing project's build settings, which no skill owns yet
