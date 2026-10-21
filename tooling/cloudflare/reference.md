# Tooling cloudflare reference

## Overview

The cloudflare stack ships one parameterized GitHub Actions workflow that deploys a static build to Cloudflare Pages. It is keyed on host rather than on framework and carries no dependencies or seeds of its own, so it syncs onto a project already carrying `astro`, `vite-react`, or any other stack without colliding. It ships one script, `scripts/delete-previews.sh`, which the cleanup job calls and which overwrites a project's own file of that name on every sync.

## Deploy workflow

### Job shape

Separate `build` and `deploy` jobs connect through an uploaded artifact, converged on the shape already running in the closest prior art rather than invented fresh.

- The deploy job checks for `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` first, and skips with a `::notice::` when either is absent, so a first merge ahead of the Pages project stays green.
- The deploy job checks out the repository and installs Bun though it builds nothing, since `wrangler-action` resolves its package manager from `bun.lock` in the checkout.
- The concurrency group carries `${{ github.ref_name }}`. GitHub cancels a pending run when a newer one queues in its group, so a shared group lets a preview displace a production deploy.

### Previews

Every branch gets a preview URL rather than only `main`.

- `--branch=${{ github.ref_name }}` on every deploy gives each branch a Cloudflare preview URL.
- A `workflow_dispatch` run from an unmerged branch therefore lands on a preview and never on production, which makes dispatching it safe.
- The Publish step carries `id: publish` and pins `wranglerVersion`, since the `pages-deployment-alias-url` output it reads first appears in wrangler 3.78.
- A step after Publish prints the alias to the job log as `canon-preview-alias: <url>` and to the step summary.
- `canon pr preview` reads that line out of the run log, so the marker text is a contract with the CLI.

### Cleanup

A `pull_request` trigger on `closed` runs only the `cleanup-preview` job, which deletes every preview deployment Cloudflare holds for that branch.

- It checks out the default branch and runs `scripts/delete-previews.sh` with the Pages project name and the closing branch as arguments.
- The script lists them through the Pages REST API, because the wrangler listing has no branch filter.
- It deletes each with `force=true`, so a deployment still holding the branch alias goes too.
- It skips with a notice when the secrets are absent, the same as the deploy job.

## Parameters a project fills in by hand

Three values in the seeded file have no generic default, and a project sets them once right after sync.

- The `paths:` filter under the `push` trigger ships as a single `src/**` glob. Widen it to every path the build reads when the build draws on catalogs or generated content outside `src/`.
- The `concurrency.group` name ships as `deploy-${{ github.ref_name }}`, enough for one deploy. Rename the `deploy` prefix only for a second deploy workflow, and keep the ref suffix.
- The Pages project name appears twice as `REPLACE_WITH_PROJECT_NAME`, in the `--project-name` flag and as the first argument to `scripts/delete-previews.sh` in the cleanup job.
- Set both to the name the `deploy-app` skill creates the project under.

## Re-sync

`configs/` is golden and always overwrites, `scripts/delete-previews.sh` included. Re-running `canon tooling sync cloudflare . --write` after hand-editing any of the three parameters above discards that edit and restores the shipped defaults. Re-fill the parameters after any re-sync rather than expecting the file to preserve them.
