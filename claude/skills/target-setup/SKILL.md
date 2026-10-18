---
name: target-setup
description: Gets a project onto the toolkit. Detects the stack, resolves per-domain arguments, previews the chain, runs `canon init`, then verifies at a stated depth and bootstraps the `index.md` system. Use when asked to "set up this project", "init this project", "bootstrap the toolkit", "install governance", "install gov rules", "set up indexes", "verify the scaffold", "run the smoke tests", or "one-shot install". Assumes the `canon` CLI is on PATH. Do NOT use on a project that already carries the toolkit, or to report per-domain drift without repairing it, which is `target-check`.
metadata:
  family: setup
---

# Setup

Gets a project onto the toolkit. Detects project type, resolves per-domain
arguments, previews the chain, runs `canon init`, then verifies what landed and
bootstraps the `index.md` system over the project's own documentation folders.

The CLI holds the install logic. This skill resolves, previews, and routes. It
reimplements no verb and hardcodes no stack or rule name.

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

Every phase runs under `CANON_NON_INTERACTIVE=1` with no TTY. Three phases
otherwise pause, and each takes an argument that answers its prompt ahead of
time:

| Phase               | Pauses to                                  | Answered ahead by                                          | With neither and no TTY                               |
| ------------------- | ------------------------------------------ | ---------------------------------------------------------- | ----------------------------------------------------- |
| `indexes`           | Confirm its folder list                    | `--all` for every candidate, `--folders <a>,<b>` for a set | Reports its candidates and stops rather than choosing |
| `install` and `gov` | Confirm the proposed extras                | `--extras <a>,<b>` for a set, `--extras none` for none     | Takes every proposal and lists each in the report     |
| `gov`               | Stop on a detected technology with no rule | `--skip-gaps`, which proceeds and lists the gap            | Stops on the gap                                      |

Claude Code's tool permission dialog is the confirmation gate for everything
else. Do not pause for a separate confirmation beyond the extras question.

## Scope

- This skill and `canon init` run once on a fresh scaffold, never on an existing project, and do not guard against clobbering existing configs
- Add no guard, mode switch, or existing-project branch here. Extend the per-domain `canon <domain> install` or `canon sync` paths instead.
- The chain stops at the project edge. `git-commit` also ships, reaching the project's history, and does not run here.
- Claude Code plugins are a machine concern, so no phase installs them. `claude plugin install <name> --scope user` applies in every project on the machine and copies into none.

## Declined states

Three states reach this skill that the chain does not serve. Name the destination for each, so the refusal routes rather than ends.

### An existing project

Stop and hand off to `target-check`, which reports what the target already carries before anything is repaired. This chain never reads that, so a per-domain install picked here is a guess against configs nobody read.

### The `.claude/` folder alone

Stop. Run `canon claude init` for the seed docs, then the `indexes` phase over the project's own documentation folders. Neither needs the tooling sync the `install` phase runs.

### A language with no stack

The chain still runs, on `base`, with the fallback marked in the preview. A project wanting none of `base` declines there and takes the `gov` phase, which is language-neutral and drops no `base` development dependencies.

Say so at the preview rather than resolving it here, since the fallback is a working default and only the person can say whether it fits.

### Route rather than build

Do not add a stack, a mode switch, or an existing-project branch to satisfy one of these. Each destination already exists and routing to it costs a line.

## Phase: detect

Read `${CLAUDE_SKILL_DIR}/references/detect.md`. It holds the catalog reads, the
evidence list, the argument resolution, the gap handling, and the preview, which
the `install` and `gov` phases share rather than each stating.

## Phase: install

Run the chain in order, starting once the operator has confirmed the extras the
preview proposed, per the detect reference. Run from the
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

Step 2: `canon tooling sync <tooling-stack> --write` installs stack deps, scripts, gitignore entries, seeds, golden configs, and the reference doc. It walks the extends chain, so `vite-react` also pulls `web` and `base`.

- Skip it if the tooling stack is `base`, which `canon init` already synced
- `--write` is required. Without it a headless run reports what it would replace and exits 1, since golden configs overwrite the target's files.
- A fresh target has nothing to lose, so pass `--write` directly rather than reading a report first

```bash
CANON_NON_INTERACTIVE=1 canon tooling sync <tooling-stack> <target> --write
```

### Monorepo with multiple language roots

Run `canon init` once at the repo root so `base` (husky, oxfmt, commitlint, CI) lands once, then sync each subtree with `--skip base`. Take the subtree commands from the preview's per-root rows rather than picking folders by hand.

```bash
CANON_NON_INTERACTIVE=1 canon tooling sync vite-react ./frontend --skip base --write
CANON_NON_INTERACTIVE=1 canon tooling sync python ./backend --skip base --write
```

- Without `--skip base`, each subtree re-drops husky, and git honors only one `core.hooksPath`, so the extra hook dirs silently break
- Each subtree keeps its own framework configs, and its stack reference reads through `canon tooling reference <stack>`
- A subtree sync withholds `.github/`, since GitHub reads workflows only at the root, and names each withheld file with the `working-directory` a root CI job needs
- A subtree with no `package.json` gets a minimal one from the sync, so its scripts and dependencies land in the same pass

### Post-sync fixups

Step 3: post-sync fixups. Golden configs arrive from sync, so no config generation is required. But a few items may need a one-time touch:

- **File naming.** `bun create vite`'s `App.tsx` violates the `KEBAB_CASE` rule. Rename to `app.tsx` and update the import in `main.tsx`.
- **Docs.** Run `canon tooling reference <tooling-stack>` and `canon tooling reference web` for any stack-specific follow-ups (Chrome extension overrides, setup script details).

Do not generate oxlint, ESLint, Vitest, or Playwright configs. They ship as golden files. Generating from prose duplicates what sync already installed.

## Phase: gov

Governance rules and nothing else, for a project declining the tooling layer.
Resolve exactly as the detect reference states, confirm the proposed extras
there, then run:

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

This is the one phase that pauses to confirm candidate folders with the
operator, unless `--all` or `--folders` answered it ahead of time. A fresh scaffold usually has no markdown-heavy folder yet, so this phase often
finds nothing, which its reference defines as an outcome rather than a failure.

## Report

After the chain, report:

- Domains installed, with a check per domain
- Tooling stack synced, or skipped. Name the layers pulled via the extends chain.
- Any post-sync fixups applied (filename renames)
- `verify` outcome, naming the depth it ran at

### Outcomes and gaps

After the chain, report as well:

- `indexes` outcome (folders bootstrapped, or none found)
- Any domains or scripts that failed
- Any detection gaps surfaced during resolve
- Claude Code plugins as an onboarding step this chain does not cover, so a clean result does not read as onboarding complete
- `/canon:write-doc README.md` when the root `README.md` is missing or carries no H1 naming the project, and nothing when it is authored

A resolved name and a fallback read alike once written, so the preview marks the
fallback rather than this report. The preview is the last point before the first
write, and the report runs after the files have landed.
