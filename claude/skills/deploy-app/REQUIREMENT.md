---
name: deploy-app
description: What the Cloudflare Pages setup gap is, which of the four manual steps this skill closes, and why the credential and the custom domain stay the operator's
---

# Deploy app requirement

## Gap

Without this skill, a Cloudflare Pages setup is a sequence performed from memory. Three of its four repeated acts touch a service rather than the tree, so no workflow file can absorb them, and one of the acts has already cost a broken deploy: the account ID displayed in the Cloudflare dashboard is truncated, and a value copied from there is wrong in a way that only shows up at deploy time.

## Must

- Create the Pages project through `wrangler pages project create`
- Fetch the account ID from `wrangler`'s own authenticated session rather than have it typed or pasted
- Stop for the operator to issue the API token and run `gh secret set CLOUDFLARE_API_TOKEN` themselves
- Verify both secrets are present with `gh secret list` before continuing
- Stop for the operator to attach the custom domain in the dashboard
- Call `wrangler` and `gh` directly for every step those tools already cover

## Must not

- Accept a Cloudflare API token as input in any form. The toolkit verifies a secret exists, never what it contains.
- Reimplement `wrangler pages project create` or `gh secret set` as a hand-built API call
- Open a pull request or merge

## Guards

- `wrangler` not authenticated: stop and name the login command
- `gh` not authenticated: stop and name the login command
- A secret missing after the token stop: stop and name which one

## Out of scope

- Attaching a custom domain through the Cloudflare REST API instead of the dashboard. Measured absent from `wrangler pages` at plan time and the REST API was not read, so the dashboard stop stays for this pass.
- Running the deploy itself once secrets and the domain are set. That is the seeded `tooling/cloudflare/configs/.github/workflows/deploy.yml` workflow, triggered by a push to main.
- Reconfiguring an existing Pages project's build settings.
