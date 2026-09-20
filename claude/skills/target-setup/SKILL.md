---
name: target-setup
description: Gets a project onto the toolkit. Detects the stack, resolves per-domain arguments, previews the chain, runs `canon init`, then verifies at a stated depth and bootstraps the `index.md` system. Use when asked to "set up this project", "init this project", "bootstrap the toolkit", "install governance", "install gov rules", "set up indexes", "verify the scaffold", "run the smoke tests", or "one-shot install". Assumes the `canon` CLI is on PATH. Do NOT use on a project that already carries the toolkit, which is `canon-operator`, or to report per-domain drift without repairing it, which is `target-check`.
---

# Setup

Gets a project onto the toolkit. Detects project type, resolves per-domain
arguments, previews the chain, runs `canon init`, then verifies what landed and
bootstraps the `index.md` system over the project's own documentation folders.

The CLI holds the install logic. This skill resolves, previews, and routes. It
reimplements no verb and hardcodes no stack, rule, or snippet name.

## Phases

Five phases run in order on a bare invocation. Each is also reachable alone, so
a caller wanting one layer does not run the chain to get it.

| Phase     | What it does                                                | Reached alone by      |
| --------- | ----------------------------------------------------------- | --------------------- |
| `detect`  | Reads the project and resolves stack arguments              | `setup detect`        |
| `install` | Runs `canon init` and the tooling sync                      | `setup install`       |
| `gov`     | Installs governance rules and nothing else                  | `setup gov`           |
| `verify`  | Runs the installed scripts at a stated depth                | `setup verify [deep]` |
| `indexes` | Bootstraps the `index.md` system over documentation folders | `setup indexes`       |

An argument naming a phase runs that phase and stops. A bare invocation runs
`detect`, `install`, `verify`, then `indexes`. `gov` is a narrowing of `install`
rather than a step within it, so the full chain never runs it separately.

## Non-interactive path

Every phase runs under `CANON_NON_INTERACTIVE=1` with no TTY. Two phases
otherwise pause, and each takes an argument that answers its prompt ahead of
time:

- `indexes` confirms its folder list with the operator. `setup indexes --all`
  takes every candidate the scan found, and `--folders <a>,<b>` takes a named
  set. With neither, and with no TTY, the phase reports its candidates and stops
  rather than choosing for the operator.
- `gov` stops on a detected technology with no matching rule. `--skip-gaps`
  proceeds with the matched layer and lists the gap in the report.

Claude Code's tool permission dialog is the confirmation gate for everything
else. Do not pause for a separate confirmation.

## Scope

- This skill and `canon init` run once on a fresh scaffold, never on an existing project. They do not guard against clobbering existing configs. When tempted to add guards, mode switches, or an existing-project branch, stop. Extend the per-domain `canon <domain> install` or `canon sync` paths instead.
- The chain stops at the project edge. `repo-metadata` and `git-commit` also ship, reaching a remote and the project's history respectively, and neither runs here.
- Claude Code plugins are a machine concern rather than a project one, so no phase here installs them. Install them with `claude plugin install <name> --scope user`, which applies in every project on the machine and is copied into none.

## Declined states

Three states reach this skill that the chain does not serve. Name the destination for each, so the refusal routes rather than ends. The first two stop the chain outright and the third runs it on a default the person may not want.

- **An existing project.** Stop and hand off to `canon-operator`. It reads what the target already carries before it names a command, which this chain never does, so any per-domain install picked here is a guess against configs nobody read. The Scope bullet above names the same commands as the authoring alternative, and this is the destination a person takes.
- **An install wanting the `.claude/` folder alone.** Stop. Run `canon claude init` for the seed docs, then run the `indexes` phase over the project's own documentation folders. Neither needs the tooling sync the `install` phase runs.
- **A language the toolkit carries no stack for.** The chain still runs, on `base`, with the fallback marked in the preview. A project that wants none of what `base` carries declines there and takes the `gov` phase, which is language-neutral and installs rules without the `base` development dependencies the tooling layer would drop on it. Say so at the preview rather than resolving it here, since the fallback is a working default and only the person can say whether it fits.

Do not add a stack, a mode switch, or an existing-project branch to satisfy one of these. Each destination already exists and routing to it costs a line.

## Phase: detect

Read `${CLAUDE_SKILL_DIR}/references/detect.md`. It holds the catalog reads, the
evidence list, the argument resolution, the gap handling, and the preview, which
the `install` and `gov` phases share rather than each stating.

## Phase: install

Run the chain in order, starting immediately after the preview. Run from the
target project's current directory. Do not cd into the toolkit source tree. The
`canon` CLI is global.

Step 1: `canon init` installs base tooling, claude seeds, governance rules, and wiki.

```bash
CANON_NON_INTERACTIVE=1 canon init \
  --stack <stack> \
  --add <rules> \
  <target>
```

Omit any flag whose resolved value is empty.

Step 2: `canon tooling sync <tooling-stack> --write` installs stack deps, scripts, gitignore entries, seeds, golden configs, and drops the reference doc. The extends chain is walked, so syncing `vite-react` also pulls `web` and `base` configs. Skip if the tooling stack is `base` (already synced by `canon init`).

`--write` is required. A headless run without it reports what it would replace and exits 1, since golden configs overwrite whatever the target holds at those paths. Scaffolding into a fresh target has nothing to lose, so pass it directly rather than reading a report first.

```bash
CANON_NON_INTERACTIVE=1 canon tooling sync <tooling-stack> <target> --write
```

Monorepo with multiple language roots: run `canon init` once at the repo root so `base` (husky, prettier, cspell, commitlint, CI) lands single, then sync each subtree with `--skip base` so the shared layer is not re-dropped.

```bash
CANON_NON_INTERACTIVE=1 canon tooling sync vite-react ./frontend --skip base --write
CANON_NON_INTERACTIVE=1 canon tooling sync python ./backend --skip base --write
```

Without `--skip base`, each subtree re-drops husky, and git honors only one `core.hooksPath`, so the extra hook dirs silently break. Each subtree keeps its own framework configs, and its own stack reference reads through `canon tooling reference <stack>`.

Step 3: post-sync fixups. Golden configs arrive from sync, so no config generation is required. But a few items may need a one-time touch:

- **ESLint version pin.** If `bun create vite` installed `eslint@^10` and the manifest pins `eslint@^9`, sync does not override a present dep. Run `bun add -d eslint@^9` if `bun run lint:fix` fails with `Class extends value undefined`.
- **File naming.** `bun create vite`'s `App.tsx` violates the `KEBAB_CASE` rule. Rename to `app.tsx` and update the import in `main.tsx`.
- **Docs.** Run `canon tooling reference <tooling-stack>` and `canon tooling reference web` for any stack-specific follow-ups (Chrome extension overrides, setup script details).

Do not generate ESLint, Vitest, or Playwright configs. They ship as golden files. Generating from prose duplicates what sync already installed.

## Phase: gov

Governance rules and nothing else, for a project declining the tooling layer.
Resolve exactly as the detect reference states, then run:

```bash
CANON_NON_INTERACTIVE=1 canon gov install <stack> --add <extras> <target>
```

Report the rule count installed, the target path, and any rules that failed to
resolve, which the CLI warns on.

## Phase: verify

Read `${CLAUDE_SKILL_DIR}/references/verify.md`. It holds both depths and the
script chain each runs. The default depth runs the leaf scripts and reports pass
or fail per script. `deep` adds the dev and preview server smoke, the end-to-end
suite, and the screenshot harness.

The chain runs the default depth. `deep` is the operator's call rather than the
chain's, since a slow server start reads as a failure and an unattended run
should not fail a scaffold on that.

## Phase: indexes

Read `${CLAUDE_SKILL_DIR}/references/indexes.md`. It holds the scan, the
frontmatter drafting, the scaffold, the validate step, and the convention seed
offer.

This phase confirms candidate folders with the operator rather than running
unattended, which is the one phase in the chain that pauses for a conversation
unless `--all` or `--folders` answered it ahead of time. A fresh scaffold usually
has no markdown-heavy folder yet, so this phase frequently finds nothing to
present, which its reference defines as its own outcome rather than a failure of
the chain.

## Report

After the chain, report:

- Domains installed, with a check per domain
- Tooling stack synced, or skipped. Name the layers pulled via the extends chain.
- Any post-sync fixups applied (ESLint pin, filename renames)
- `verify` outcome, naming the depth it ran at
- `indexes` outcome (folders bootstrapped, or none found)
- Any domains or scripts that failed
- Any detection gaps surfaced during resolve
- Claude Code plugins as an onboarding step this chain does not cover, so a clean result does not read as onboarding complete

A resolved name and a fallback read alike once written, so the preview marks the
fallback rather than this report. The preview is the last point before the first
write, and the report runs after the files have landed.
