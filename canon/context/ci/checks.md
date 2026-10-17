---
title: Checks
description: The gate stage table CI runs, the regeneration stages, the phase-label gate, the plugin CLI install, and the install check outside the gate
---

# Checks

## Layout

### Stages

`.github/workflows/verify.yml` runs one step, `bun run check:ci`, which resolves to `canon gate run --all`. The stage list lives in `src/gate/stages.ts` rather than in the workflow, and every stage runs regardless of what the branch touched.

| Stage                   | Command                                                                  | What it asserts                                                                                          |
| ----------------------- | ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| Format check            | `bun run check:format`                                                   | oxfmt, Prettier over `.astro`, and shfmt are clean                                                       |
| Indexes                 | `canon indexes regen`                                                    | no `index.md` was committed stale or left untracked                                                      |
| Consumed copies         | `canon gov regen`                                                        | `.claude/rules` matches source                                                                           |
| Hero                    | `bun scripts/core/regen-hero.ts --check`                                 | the regen runs clean into a temp folder, and each stamp matches its pair                                 |
| Ignore parity           | `ignoreParity` in-process                                                | the ignore set a target receives matches this repository's own                                           |
| Skill paths             | `skillPaths` in-process                                                  | no shipped skill cites a repo-local path                                                                 |
| Plugin boundary         | `pluginBoundary` in-process                                              | nothing the plugin ships resolves under `internal/`                                                      |
| Seed independence       | `seedIndependence` in-process                                            | no seed prose names the toolkit CLI                                                                      |
| Capability seeding      | `capabilitySeeding` in-process                                           | a hook, workflow, or husky script reaches its seed or config, or carries a `canon-no-seed:` reason       |
| Unreferenced rules      | `bun src/cli.ts gov list --json`                                         | reports rules no stack reaches, and fails on none of them                                                |
| Context citations       | `bun src/cli.ts context audit --gate`                                    | every cited path resolves, no entry carries an H2 outside the closed set, and each index agrees          |
| Canonical records       | `measureRequirements` in-process                                         | the requirements record holds no more words than the cap it states                                       |
| Document ceiling        | `documentHeight` in-process over every listed markdown file              | no non-exempt document runs past 300 rendered lines                                                      |
| Folder-echoed filenames | `listRepositoryFiles` in-process over every tracked path                 | no file's stem repeats its parent folder's name, whole or as a prefix                                    |
| Rule citations          | `bun src/cli.ts gov citations`                                           | every path a rule cites and every internal frontmatter glob resolves                                     |
| Markdown                | `bun src/cli.ts markdown audit --json`                                   | no markdown carries a banned character or a dead link, and no gated path breaks a density limit          |
| Seed standards          | `bun src/cli.ts context audit --gate` per root                           | no seed breaks the standard governing the folder it seeds                                                |
| Skill requirements      | `bun src/cli.ts claude skills audit --requirements-only`                 | every skill folder carries a `REQUIREMENT.md`                                                            |
| Skill provenance        | `auditSkills` in-process over both skill corpora                         | no skill body or reference carries an ISO date outside a fence or code span                              |
| Skill practice shape    | `auditSkills` in-process over `claude/skills/`                           | every listed practice skill carries its three closing sections and a source ledger                       |
| Skill family            | `auditSkills` in-process over `claude/skills/`                           | every shipped skill declares a `metadata.family` from the family vocabulary                              |
| Sandbox coverage        | `bun src/cli.ts sandbox coverage --json`                                 | undeclared scenarios stay at or under the ceiling `src/gate/measures.ts` pins                            |
| Audit set               | `bun src/cli.ts audits run --corpus tracked --corpus per-machine --json` | reports the judgment half of every tracked and per-machine audit and its growth, and fails on none of it |
| Plugin manifests        | `claude plugin validate --strict`                                        | every plugin and marketplace manifest is well-formed                                                     |
| Shell                   | `bun run check:shell`                                                    | shellcheck passes at warning level                                                                       |
| Lint                    | `bun run check:lint`                                                     | oxlint at its default rules raises no warning across tracked JS, TS, and `.astro` files                  |
| Types                   | `bun run check:types`                                                    | `tsc --noEmit` passes against `src/`                                                                     |
| Tests                   | `bun run test`                                                           | the vitest suite passes                                                                                  |

Two stages report rather than gate. Unreferenced rules and Audit set carry only judgment calls, and a push failing on one would teach a contributor to route around the stage. Both still print what they found.

### Unmeasured stages

A stage that could not read its input at all is a state any row can reach.

- Under `check:ci` it fails the run, since an absent tool on a runner is a broken workflow step
- On a contributor's machine it warns and the run stays green, and the closing line names how many stages measured nothing rather than printing an unqualified pass
- Shell, types, and tests skip on the changed-file set locally and never in CI, which is what `--all` buys

### Keeping the table current

Rebuild the table from `STAGES` in `src/gate/stages.ts` rather than editing rows by hand, since a hand edit can drift from the source it renders. Nothing compares the table to `STAGES`, so a stage added later leaves it wrong until the next rebuild.

### The regeneration stages

The two drift stages, Indexes and Consumed copies, regenerate and then assert twice through the `drift` check in `src/gate/sequencer.ts`. They catch content regenerated locally but committed stale, which a local-only gate lets through.

- `git diff --exit-code` covers modified tracked files
- `git ls-files --others --exclude-standard` covers new untracked ones
- Regeneration runs in every mode, so `check:ci` writes to the working tree even though it never formats

### The plugin CLI on the runner

The runner installs the plugin CLI so the manifest stage gates on a real binary rather than skipping for want of one. The plugin is the toolkit's second delivery path, so a manifest validated only on the author's machine could reach a marketplace install unchecked.

`bun install -g @anthropic-ai/claude-code@2.1.236` lands the binary in the directory `setup-bun` already put on `PATH`. The version is pinned exactly rather than to a major, so raising the pin is a move someone makes and reads the run for, rather than one the registry makes overnight.

- `2.1.237` installs one package with no platform-native dependency and leaves a wrapper on `PATH` that cannot run
- The release is not the defect, since it passes `claude plugin validate --strict` locally. The failure is `bun install -g` on a fresh runner, so test a raised pin on one.
- Whether a later release repairs the install on its own is unmeasured

The health guard checks behavior rather than presence because `bin/claude.exe` ships as a stub that prints a native-binary error and exits 1, until postinstall replaces it. A wrapper-only install leaves a name that resolves and a command that fails, which `claude --version` tests.

Validation needs no credential, so this is an install step rather than a secret. The stage skips on a machine where the CLI is absent or cannot run, and fails when `CI` is set, since a silent skip on the runner would report the pass the stage exists to withhold.

## Decisions

### The phase-label gate

`phase-label-gate.yml` runs `canon labels scan` against `$GITHUB_EVENT_PATH`, since a pull request body and a posted review comment are text no stage in `bun run check` sees. It sits outside `verify.yml` because it needs `edited` on the trigger, and adding that to the shared trigger would re-run the whole Static Checks job on every edit.

- A `pull_request_review` trigger fires on `submitted` and `edited` and reads `review.body`, text a person can publish without touching the pull request's own title or body
- That event carries no `branches` filter GitHub reads, so the job's own `if:` checks the base ref
- The checkout-root copy runs `bun src/cli.ts labels scan` after `bun install --frozen-lockfile`, dogfooding its own source tree
- `tooling/base/configs/.github/workflows/phase-label-gate.yml` is the seeded copy, running `bunx -y @erclx/canon labels scan` with no install step, since a `python`-stack target has no lockfile

### Release pull requests and masking

The scan tells a release-please pull request from an ordinary one by two fixed signals rather than a label, being the head branch prefix `release-please--branches--main` and the title prefix `chore(main): release `. Either alone is a string an ordinary pull request could reproduce to slip a leaked phase label past, so both must hold.

The scan reads a title and body with every fenced block dropped and every inline code span blanked, the exclusions `canon markdown audit` takes. A code span can carry a version-shaped test fixture name that a naive scan would flag as a leaked label.

- A link destination stays unmasked, unlike the ban scan, since a release-please body's real semver reference sits inside its generated compare link
- `VERSION_SPAN` in `src/labels/phase.ts` reads a span whose whole content is a version token as a hit, and a token folded into longer content clears it
- Authors stay responsible for a label quoted alone in its own span, since narrowing the exclusion to fenced blocks or dropping it would give up every unbackticked leak, the common case
- `claude/skills/git-commit/references/versioning.md` states the same three-way split

### Sections and character bans

The same gate holds the section list and the character bans, since both are text no stage in `bun run check` sees. The bans reuse `BAN_SETS` and run on every source, so a posted review is held to the same two characters as a pull request.

The headings check reads an ordinary pull request alone. A review body carries its own headings, a release-please body opens on a version link and takes the `isReleasePullRequest` test, and a scan carrying no title is a reply rather than a description.

### The install check

`check:install` runs in CI as its own step after `check:ci`. It costs about 3 seconds against `Verify`'s 70, since the runner's `bun install --frozen-lockfile` has already primed the package cache. The local gate and the pre-push hook exclude it, because a contributor's first run gets no such head start and a cold pack-and-install is unmeasured.

Packing and installing from the extracted tarball answers what the `files` field ships, which nothing else in this workflow tests. A clone only proves a checkout installs. `canon/context/cli/packaging.md` covers what the check proves and what it cannot see.

### TypeScript pin

`typescript` is a declared devDependency rather than a hoisted peer of `@astrojs/check`. It is pinned to the v5 line those peers expect, so a `bun add -D typescript` selecting v7 would be a compiler upgrade, not a dependency fix.
