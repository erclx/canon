# Tooling cloudflare reference

## Overview

The cloudflare stack ships two parameterized GitHub Actions workflows, `deploy.yml` for a static build on Cloudflare Pages and `deploy-worker.yml` for a Worker. It is keyed on host rather than framework and carries no dependencies or seeds, so it syncs onto a project on `astro`, `vite-react`, or any other stack without colliding.

It ships three scripts, `scripts/delete-previews.sh`, `scripts/wrangler-shape.sh`, and `scripts/smoke-check.sh`, each overwriting a project's own file of that name on every sync.

## Which workflow deploys

Both workflows ship to every cloudflare project, and each reads the Wrangler config through `scripts/wrangler-shape.sh` before doing anything, so exactly one deploys.

- A config declaring `main` and no `pages_build_output_dir` is a Worker, so `deploy-worker.yml` deploys and `deploy.yml` skips with a `::notice::`
- No config, or one declaring `pages_build_output_dir` and no `main`, is Pages, so `deploy.yml` deploys and `deploy-worker.yml` skips with a notice
- A config declaring both deploys nowhere, and each workflow says so in a notice, so remove the key this project does not deploy by
- The script reads `wrangler.json`, `wrangler.jsonc`, then `wrangler.toml`, taking the first present, and ignores a key named only in a comment

## Scaffold

The manifest's scaffold starts a new project as a TypeScript Worker from the `hello-world` template, through `npm create cloudflare@latest` with deploy and git both off. `canon tooling scaffold cloudflare` runs it in an empty folder.

- The starter installs its own dependencies, since `create-cloudflare` runs the install itself.
- A project already on `astro` or `vite-react` never takes this scaffold. It syncs the stack onto the framework it has.
- The stack extends nothing and ships no scripts, so `canon tooling verify cloudflare` syncs `base` onto the starter first, as `canon init` would
- A verify pass proves the two syncs and the base format check alone, since the Worker declares no typecheck, lint, or build

## Deploy workflow

### Job shape

Separate `build` and `deploy` jobs connect through an uploaded artifact, converged on the shape already running in the closest prior art rather than invented fresh.

- A `gate` job reads the config shape first, and `build` and `cleanup-preview` both need it, so a Worker project runs neither and the run stays green.
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

## Worker deploy

`deploy-worker.yml` runs a deploy job on a merge to `main` or a dispatch from it, in an order that keeps the old code serving until the new version proves healthy. A pull request runs a dry-run job instead.

### Order

Each step runs only when the one before it passed, so a failure anywhere ahead of the deploy leaves the old version serving.

1. Install, then run the `test` and `build` scripts where `package.json` declares each, since a Worker with no build has `wrangler deploy` bundle it.
2. Record the version serving now through `wrangler deployments status --json`, the rollback target, taking the one with the largest traffic share.
3. Record each bound database's current bookmark through `wrangler d1 time-travel info --json`, the restore point, and stop before migrating when one cannot be read.
4. Apply remote D1 migrations for every `database_name` the config binds at its top level, and skip both D1 steps when it binds none.
5. Deploy with `wrangler deploy`, its message naming the commit.
6. Run `scripts/smoke-check.sh` against the health route, which retries five times three seconds apart and fails on any status outside 2xx.
7. Roll back to the recorded version through `wrangler rollback` when the smoke check fails, and leave the run red.

### Staging

A Wrangler config declaring `env.staging` deploys staging first in the same run. `scripts/wrangler-shape.sh` reports `staging=true` and lists staging's own databases as `d1_staging`, since an environment inherits no D1 binding.

- Staging runs steps 2 through 7 with `--env staging` against `STAGING_HEALTH_URL`, and production runs them only after staging's smoke check passes.
- A failed staging smoke check rolls staging back to its own recorded version and leaves production undeployed.
- A config without `env.staging` runs no staging step and never reads `STAGING_HEALTH_URL`.
- A JSON config the script cannot parse fails the read with an error in both workflows, since a guess would migrate a database against the wrong environment.

### Dry run

A pull request touching the deploy paths runs `wrangler deploy --dry-run`, which compiles the Worker and uploads nothing. The job reads no secret, since Actions logs on a public repository are public, and it adds a second dry run under `--env staging` when the config declares one.

The job takes a concurrency group per pull request and cancels a superseded run, so it never queues behind a deploy.

### Blocked smoke check

`scripts/smoke-check.sh` exits 3 when the health route answers with `cf-mitigated: challenge`, meaning Cloudflare challenged the runner rather than the Worker failing. The run ends red with `blocked` in the log and rolls nothing back, since the check gave no verdict on the new version.

Let the runner through to the health route, such as with a WAF skip rule on its path, so the next run can read it.

### Gating

The job skips green, refuses red, or deploys, and every skip names its reason in a notice.

- Skip with a notice when either secret is absent, the same as the Pages workflow, so a first merge stays green.
- Skip with a notice on a dispatch from any branch but the default, since a Worker has no preview alias and every deploy is production.
- Refuse before installing when the health route is still the placeholder, since a smoke check failing on it would roll back a healthy version.
- Deploy no per-branch previews. Set `workers_dev` and `preview_urls` in the Wrangler config where a project wants them.
- Key the concurrency group on no ref, since only the default branch deploys, and never cancel a running job, which could stop it between the migration and the deploy.

### The rollback's limit

A rollback creates a new deployment of the recorded version and touches no database, so a migration this run applied stays applied.

- Keep every migration readable by the version before it, such as adding a column rather than renaming one, so the rolled-back code still runs.
- Migrate before deploying, so a failed migration stops the run with the old code still serving.
- A first deploy records no version, so a failed smoke check on it fails the run with the new version still serving.
- The record step reads API code 10007 as a Worker never deployed and `has no deployments` as one with an empty history, and fails on any other error.

### The restore is a hand step

A failure after a bookmark was recorded prints `wrangler d1 time-travel restore <database> --bookmark=<bookmark>` for each database, with `--env staging` on staging's. The run never restores by itself, because a restore discards every write since the bookmark, users' own included. Whether to run it is the operator's call.

### Rollback drill

Dispatch the workflow from `main` with `drill_rollback` ticked to deploy and then fail the smoke check once on purpose. The run ends red after the rollback, which proves the path before a real failure needs it.

## Parameters a project fills in by hand

A few values in each seeded workflow have no generic default, and a project sets them once right after sync.

### Pages

A Pages project fills three values in `deploy.yml`.

- The `paths:` filter under the `push` trigger ships as a single `src/**` glob. Widen it to every path the build reads when the build draws on catalogs or generated content outside `src/`.
- The `concurrency.group` name ships as `deploy-${{ github.ref_name }}`, enough for one deploy. Rename the `deploy` prefix only for a second deploy workflow, and keep the ref suffix.
- The Pages project name appears twice as `REPLACE_WITH_PROJECT_NAME`, in the `--project-name` flag and as the first argument to `scripts/delete-previews.sh` in the cleanup job.
- Set both to the name the `deploy-app` skill creates the project under.

### Worker

A Worker project fills its values in `deploy-worker.yml` and sets its token's scope.

- Grant `CLOUDFLARE_API_TOKEN` Workers Scripts edit and D1 edit, since a Pages-edit token runs neither `wrangler deploy` nor `d1 migrations apply`.

- Set `HEALTH_URL` to the full URL of a route answering 2xx only when the Worker is healthy.
- Set `STAGING_HEALTH_URL` the same way for staging when the config declares `env.staging`, and leave the placeholder otherwise.
- Widen both `paths:` filters, under `push` and `pull_request`, the same way as the Pages one, keeping `migrations/**` and `wrangler.*` in each.

## Re-sync

`configs/` is golden and always overwrites, `scripts/delete-previews.sh` included. Re-running `canon tooling sync cloudflare . --write` after hand-editing any of the parameters above, `HEALTH_URL` included, discards that edit and restores the shipped defaults. Re-fill the parameters after any re-sync rather than expecting the file to preserve them.
