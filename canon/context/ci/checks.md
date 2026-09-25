---
title: Checks
description: The gate stage table CI runs, the regeneration stages, the phase-label gate, the plugin CLI install, and the install check outside the gate
---

# Checks

## Stages

Defined in `.github/workflows/verify.yml`, which runs one step, `bun run check:ci`. That resolves to `canon gate run --all --no-write`, so the stage list lives in `src/gate/stages.ts` rather than in the workflow and every stage runs regardless of what the branch touched. Three rows report rather than gate, and the table marks each.

| Stage                     | Command                                                                  | What it asserts                                                                                          |
| ------------------------- | ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| Format check              | `bun run check:format`                                                   | prettier and shfmt are clean                                                                             |
| Indexes                   | `scripts/core/regen-indexes.sh`                                          | no `index.md` was committed stale or left untracked                                                      |
| Consumed copies           | `scripts/core/regen-claude-copies.sh`                                    | `.claude/rules` matches source                                                                           |
| Hero                      | `scripts/core/regen-hero.sh --check`                                     | the regen runs clean into a temp folder, and each stamp matches its pair                                 |
| Ignore parity             | `scripts/core/check-ignore-parity.sh`                                    | the ignore set a target receives matches this repository's own                                           |
| Skill paths               | `scripts/core/check-skill-paths.sh`                                      | no shipped skill cites a repo-local path                                                                 |
| Plugin boundary           | `scripts/core/check-plugin-boundary.sh`                                  | nothing the plugin ships resolves under `internal/`                                                      |
| Seed independence         | `scripts/core/check-seed-independence.sh`                                | no seed prose names the toolkit CLI                                                                      |
| Capability seeding        | `scripts/core/check-capability-seeding.sh`                               | a hook, workflow, or husky script reaches its seed or config, or carries a `canon-no-seed:` reason       |
| Unreferenced rules        | `bun src/cli.ts gov list --json`                                         | reports rules no stack reaches, and fails on none of them                                                |
| Context citations         | `bun src/cli.ts context audit --citations-only`                          | every cited context path resolves                                                                        |
| Architecture record       | `measureArchitecture` in-process                                         | the record holds no more decisions than its stated cap and sits under its own line ceiling               |
| Document ceiling          | `documentHeight` in-process over every listed markdown file              | reports each non-exempt document past 300 rendered lines, and fails on none of them yet                  |
| Rule citations            | `bun src/cli.ts gov citations`                                           | every path a rule cites and every internal frontmatter glob resolves                                     |
| Markdown bans             | `bun src/cli.ts markdown audit --json`                                   | no markdown carries a banned character                                                                   |
| Seed standards            | `bun src/cli.ts context audit --gate` per root                           | no seed breaks the standard governing the folder it seeds                                                |
| Skill requirements        | `bun src/cli.ts claude skills audit --requirements-only`                 | every skill folder carries a `REQUIREMENT.md`                                                            |
| Skill provenance          | `auditSkills` in-process over both skill corpora                         | no skill body or reference carries an ISO date outside a fence or code span                              |
| Standard success criteria | `bun src/cli.ts standards audit --arrivals-only`                         | a standard new to the branch carries a `## Success criterion` section                                    |
| Sandbox coverage          | `bun src/cli.ts sandbox coverage --json`                                 | undeclared scenarios stay at or under the ceiling `src/gate/measures.ts` pins                            |
| Audit set                 | `bun src/cli.ts audits run --corpus tracked --corpus per-machine --json` | reports the judgment half of every tracked and per-machine audit and its growth, and fails on none of it |
| Plugin manifests          | `claude plugin validate --strict`                                        | every plugin and marketplace manifest is well-formed                                                     |
| Spelling                  | `bun run check:spell`                                                    | cspell passes against dictionaries                                                                       |
| Shell                     | `bun run check:shell`                                                    | shellcheck passes at warning level                                                                       |
| Types                     | `bun run check:types`                                                    | `tsc --noEmit` passes against `src/`                                                                     |
| Tests                     | `bun run test`                                                           | the vitest suite passes                                                                                  |

Unreferenced rules and Audit set report rather than gate because every finding they carry is a judgment call, and a push failing on one would teach a contributor to route around the stage. Document ceiling reports for a different reason: its finding is a fact, and it stays report-only until the documents past the ceiling are brought under it. All three still print what they found.

One more qualification is a stage that could not read its input at all, which is a state any row can reach. Under `check:ci` that fails the run, since an absent tool on a runner is a broken workflow step. On a contributor's machine it warns and the run stays green, and the closing line names how many stages measured nothing rather than printing an unqualified pass. Shell, types, and tests skip on the changed-file set locally and never in CI, which is what `--all` buys.

Rebuild this table from `STAGES` in `src/gate/stages.ts` rather than editing rows by hand, since a hand edit can drift from the source it renders. Both format stages are entries in that table, so a rebuild reaches them the way it reaches every other row. This table names the check side, since `check:ci` passes `--no-write` and the write side heads its output `Formatting` instead. Nothing compares this table to the table it describes, so a stage added later can leave it wrong until the next rebuild.

### The regeneration stages

The two drift stages, Indexes and Consumed copies, regenerate and then assert twice through the `drift` check in `src/gate/sequencer.ts`, once with `git diff --exit-code` for modified tracked files and once with `git ls-files --others --exclude-standard` for new untracked ones. They catch content that was regenerated locally but committed stale, which is the failure a local-only gate lets through.

Regeneration runs in both modes, so `check:ci` writes to the working tree even though it never formats. Only the format stage changes behavior between modes.

## The phase-label gate

`phase-label-gate.yml` runs `canon labels scan` against `$GITHUB_EVENT_PATH`, since a pull request body and a posted review comment are the two things no stage in `bun run check` can see. It sits outside `verify.yml` rather than as a second job there, and the split turns on `types:` rather than on cost: this check exists to catch a title or body edited with no new commit, which needs `edited` on the trigger, and adding that to the shared trigger would re-run the whole Static Checks job on every such edit.

A `pull_request_review` trigger reaches the second surface, firing on `submitted` and `edited`, and reads `review.body` rather than the pull request's own title and body, which is text a person can publish without touching either. That event carries no `branches` filter GitHub reads, so the job's own `if:` checks the base ref instead of the trigger.

The checkout-root copy stays on `bun src/cli.ts labels scan` and its `bun install --frozen-lockfile` step, its own source tree, rather than switching to the published CLI, the same dogfooding reason `verify.yml`'s root copy carries steps its `base` config does not.

`tooling/base/configs/.github/workflows/phase-label-gate.yml` is the portable copy seeded to every scaffolded target, invoking `bunx -y @erclx/canon labels scan` instead, since a target has no `src/cli.ts` of its own to resolve. It carries no install step either: `bunx` fetches the published package fresh, so an install would serve nothing the scan uses and would fail outright on a target with no lockfile of its own, such as a `python`-stack scaffold.

It tells a release-please pull request apart from an ordinary one by two fixed signals rather than a label: the head branch prefix `release-please--branches--main` and the title prefix `chore(main): release `. Either alone is a string an ordinary pull request could reproduce to slip a leaked phase label past the check, so both have to hold together.

The scan reads a title and a body with every fenced block dropped and every inline code span blanked first, the same two exclusions `canon markdown audit` takes from its own ban scan over the same kind of text. A link destination stays unmasked, unlike the ban scan's reading, because a release-please body's real semver reference sits inside its generated compare link and masking it would empty the record on the one pull request the check exists to pass.

The code-span exclusion exists because a test fixture can carry its own version-shaped name inside a backticked span, which a naive scan of every code span would flag as a leaked label.

The board-identifier check (`VERSION_SPAN` in `src/labels/phase.ts`) reads a span whose whole content is a version token as a hit. A token folded into longer content clears it, which is the fixture-name shape the exclusion above protects. A phase label quoted alone in its own span still needs that check to catch it, since the phase-label check alone would clear it.

The carve-out stays, leaving authors responsible for a label quoted alone in its own span, rather than narrowing it to fenced blocks alone or dropping it and giving up every leak written with no backticks, the common case the check was built for. `standards/versioning.md` states the same three-way split.

The scan also spell-checks the title alone, since release-please copies a title straight into `CHANGELOG.md` with nothing having spell-checked it first: cspell reads tracked files, and a title is not one until the release that copies it there.

It shells this repository's own resolved `cspell` binary rather than a bare `execa('cspell', …)`, because `bun src/cli.ts labels scan`, the exact invocation `phase-label-gate.yml` runs, sits outside `bun run` and carries no `node_modules/.bin` on `PATH`. A target `phase-label-gate.yml` this repository does not control can carry no `cspell` at all, and that check reports `unavailable` there rather than reaching the network or forcing a new dependency, which is quiet by design rather than a defect in the workflow.

## The plugin CLI on the runner

The runner installs the plugin CLI so the manifest stage gates on a real binary rather than skipping for want of one. The plugin is the toolkit's second delivery path, so a manifest validated only on the author's machine could still reach a marketplace install unchecked.

`bun install -g @anthropic-ai/claude-code@2.1.236` lands the binary in the directory `setup-bun` already put on `PATH`. The version is pinned exactly rather than to a major, because `2.1.237` installs one package with no platform-native dependency and leaves a wrapper on `PATH` that cannot run. Whether a later release repairs the install on its own is unmeasured, so raising the pin is a move someone makes and reads the run for, rather than one the registry makes overnight.

The release itself is not the defect: `2.1.237` answers `claude --version` and passes `claude plugin validate --strict` on both manifests locally, so the failure is a condition of `bun install -g` against that release on a fresh runner. Raising the pin has to be tested on a runner and cannot be cleared by running the new version locally.

The published tarball explains why the health guard checks behavior rather than presence alone. `bin/claude.exe` as shipped is a shell stub that prints a native-binary error and exits 1 on any invocation, and the postinstall step replaces that stub with the real binary. A global install landing the wrapper alone leaves a name that resolves and a command that fails, which is exactly what `claude --version` tests.

Validation needs no credential, so this is an install step rather than a secret. The stage skips on a machine where the CLI is absent or cannot run, and fails instead when `CI` is set, because a silent skip on the runner would report the pass the stage exists to withhold.

## The install check

`check:install` runs in CI as its own step, after `check:ci`. `Verify install` costs about 3 seconds against `Verify`'s 70, since the runner's `bun install --frozen-lockfile` step has already primed the same package cache moments earlier in the same job. The local gate and the pre-push hook exclude it anyway, because a contributor's first run gets no such head start, and what a cold pack-and-install costs there is unmeasured.

A clone answers whether a checkout installs, which `bun install --frozen-lockfile` already proves earlier in the same job. Packing and installing from the extracted tarball answers what the `files` field ships, which nothing else in this workflow tests, and `canon/context/cli/packaging.md` covers what that check proves and what it still cannot see.

`typescript` is a declared devDependency rather than a hoisted peer of `@astrojs/check`. It is pinned to the v5 line those peers expect, so a `bun add -D typescript` that selects v7 would be a compiler upgrade, not a dependency fix.
