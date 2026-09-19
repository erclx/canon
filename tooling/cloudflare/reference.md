# Tooling cloudflare reference

## Overview

The cloudflare stack ships one parameterized GitHub Actions workflow that deploys a static build to Cloudflare Pages. It is keyed on host rather than on framework and carries no dependencies, seeds, or scripts of its own, so it syncs onto a project already carrying `astro`, `vite-react`, or any other stack at the same root without colliding.

## Deploy workflow

- Separate `build` and `deploy` jobs, connected by an uploaded artifact, converged on the shape already running in the closest prior art rather than invented fresh.
- The deploy job checks for `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` before doing anything else, and skips with a `::notice::` rather than failing when either is absent. A first merge lands ahead of the Pages project existing, and this guard is what keeps that push green.
- `--branch=${{ github.ref_name }}` on every deploy, which gives every branch a Cloudflare preview URL rather than only `main`. A `workflow_dispatch` run from a branch therefore lands on a preview and never on production, which is what makes dispatching the workflow from an unmerged branch safe.
- The Publish step carries `id: publish` and pins `wranglerVersion`, since the `pages-deployment-alias-url` output it reads first appears in wrangler 3.78. A step after it prints that alias to the job log as `canon-preview-alias: <url>` and to the step summary. `canon pr preview` reads the line out of the run log, so the marker text is a contract with the CLI rather than decoration.
- The concurrency group carries `${{ github.ref_name }}`. GitHub cancels a pending run when a newer one queues in the same group, so a shared group would let a branch preview displace a production deploy waiting its turn.
- A `pull_request` trigger on `closed` runs only the `cleanup-preview` job, which deletes every preview deployment Cloudflare holds for that branch. It lists them through the Pages REST API, because the wrangler listing has no branch filter, and deletes each with `force=true` so a deployment still holding the branch alias goes too. It skips with a notice when the secrets are absent, the same as the deploy job.
- The deploy job checks out the repository and installs Bun even though it builds nothing. `wrangler-action` resolves its package manager from `bun.lock` in the checkout, and dropping that step breaks the deploy on every push once the toolchain it relies on silently goes missing.

## Parameters a project fills in by hand

Three values in the seeded file have no generic default and are set once, right after sync:

- The `paths:` filter under the `push` trigger. The shipped default is a single `src/**` glob. Widen it to cover every path the build reads when the build draws on catalogs or generated content living outside `src/`.
- The `concurrency.group` name. The shipped default is `deploy-${{ github.ref_name }}`, which is enough for a single-deploy project. Give the `deploy` prefix a project-specific name only if the project runs more than one deploy workflow, and keep the ref suffix.
- The Pages project name, written twice as `REPLACE_WITH_PROJECT_NAME`: once in the `--project-name` flag on the `wrangler pages deploy` command and once as `PROJECT_NAME` in the cleanup job. Set both to the name the `deploy-cloudflare` skill creates the Pages project under.

## Re-sync

`configs/` is golden and always overwrites. Re-running `canon tooling sync cloudflare . --write` after hand-editing any of the three parameters above discards that edit and restores the shipped defaults. Re-fill the parameters after any re-sync rather than expecting the file to preserve them.
