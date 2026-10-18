---
title: Dependencies rule ledger
description: Sources for governance/rules/tooling/dependencies.md, one row per bullet
---

# Dependencies rule ledger

The field is package management for JavaScript and Python projects. The authorities are each package manager's own documentation, being Bun at bun.com, npm at docs.npmjs.com, uv at docs.astral.sh, and pnpm at pnpm.io for the hoisting behavior it was built to remove.

Bun's docs moved from bun.sh to bun.com, where the old paths now return a not-found page.

## Declaration

| Bullet                               | Source                                                                                                                                                                                                                                                                                                                                                                                                                                      | Read                        |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| Declare before importing             | [Isolated installs](https://bun.com/docs/pm/isolated-installs): under isolated installs "packages can only access their explicitly declared dependencies", the default for new workspaces, so an undeclared import fails to resolve there                                                                                                                                                                                                   | 2026-10-18, Bun 1.3         |
| Add through the package manager      | [uv, managing dependencies](https://docs.astral.sh/uv/concepts/projects/dependencies/): "uv supports modifying the project's dependencies with `uv add` and `uv remove`, but dependency metadata can also be updated by editing the `pyproject.toml` directly", and [uv, locking](https://docs.astral.sh/uv/concepts/projects/sync/): "if you add a dependency to your `pyproject.toml`, the lockfile will be considered outdated"          | 2026-10-18                  |
| Commit the lockfile with the change  | [Bun lockfile](https://bun.com/docs/pm/lockfile): "Should it be committed to git? Yes". [package-lock.json](https://docs.npmjs.com/cli/v11/configuring-npm/package-lock-json): "This file is intended to be committed into source repositories". [bun install](https://bun.com/docs/pm/cli/install): a frozen install fails when the manifest and lockfile disagree, so "Run `bun install` and commit the updated `bun.lock`"               | 2026-10-18, Bun 1.3, npm 11 |
| Development-only as a dev dependency | [package.json](https://docs.npmjs.com/cli/v11/configuring-npm/package-json): a module's users "probably don't want or need to download and build the external test or documentation framework that you use. In this case, it's best to map these additional items in a `devDependencies` object". [bun add](https://bun.com/docs/pm/cli/add): "Bun writes the package to `dependencies` unless you pass `--dev`, `--optional`, or `--peer`" | 2026-10-18, Bun 1.3, npm 11 |
| No transitive-only imports           | [pnpm motivation](https://pnpm.io/motivation): under npm or Yarn Classic hoisting, "source code has access to dependencies that are not added as dependencies to the project". The import works until the parent package drops or bumps the dependency, then breaks with no change to this project's manifest                                                                                                                               | 2026-10-18                  |

## Removal

| Bullet                      | Source                                                                                                                                                                               | Read       |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- |
| Remove with the last import | House choice: an entry nothing imports keeps installing on every machine and in every build, and nothing fails to point at it, so it stays until someone audits the manifest by hand | 2026-10-18 |

## Declined

Every bullet the rewrite removed or reshaped, grouped by why.

### Contradicted by the docs

- Rewrote "Never hand-edit the manifest" to re-locking after a hand edit, since uv documents editing `pyproject.toml` directly. The bug the ban guarded against is a stale lockfile.

### Merged or reworded

- Cut "never install without recording the result", which the declare bullet already covers, and which brought the line to 206 characters against the 200 limit
