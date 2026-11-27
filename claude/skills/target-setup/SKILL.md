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
| `verify`  | Runs the installed scripts and audits context coverage      | `setup verify [deep]` |
| `indexes` | Bootstraps the `index.md` system over documentation folders | `setup indexes`       |

An argument naming a phase runs that phase and stops. A bare invocation runs
`detect`, `install`, `verify` then `verify deep`, then `indexes`. `gov` is a narrowing of `install`
rather than a step within it, so the full chain never runs it separately.

## Non-interactive path

Every phase runs headless with no prefix, since a call with no terminal on
stdin is already headless. Three phases otherwise pause, and each takes an
argument that answers its prompt ahead of time:

| Phase               | Pauses to                                  | Answered ahead by                                          | With neither and no TTY                               |
| ------------------- | ------------------------------------------ | ---------------------------------------------------------- | ----------------------------------------------------- |
| `indexes`           | Confirm its folder list                    | `--all` for every candidate, `--folders <a>,<b>` for a set | Reports its candidates and stops rather than choosing |
| `install` and `gov` | Confirm the proposed extras                | `--extras <a>,<b>` for a set, `--extras none` for none     | Takes every proposal and lists each in the report     |
| `install`           | Ask whether the repository is public       | `--visibility public` or `--visibility private`            | Takes private and says so in the report               |
| `install`           | Ask which services the project will carry  | `--services <folder>:<kind>,...`, or `--services none`     | Plans none and says so in the report                  |
| `install`           | Ask whether to initialize shadcn           | `--shadcn yes` or `--shadcn no`                            | Takes yes on an app root and says so in the report    |
| `gov`               | Stop on a detected technology with no rule | `--skip-gaps`, which proceeds and lists the gap            | Stops on the gap                                      |

Claude Code's tool permission dialog is the confirmation gate for everything
else. Ask only the questions this body and its references name.

## Scope

- This skill and `canon init` run once on a fresh scaffold, never on an existing project, and do not guard against clobbering existing configs
- Add no guard, mode switch, or existing-project branch here. Extend the per-domain `canon <domain> install` or `canon sync` paths instead.
- The chain stops at the project edge. `git-commit` also ships, reaching the project's history, and does not run here.
- Claude Code plugins are a machine concern, so no phase installs them. `claude plugin install <name> --scope user` applies in every project on the machine and copies into none.

## Declined states

An empty folder, an existing project, the `.claude/` folder alone, and a language with no stack each reach this skill without the chain serving them. Read `${CLAUDE_SKILL_DIR}/references/declined.md` on meeting one, for the destination each routes to rather than a refusal that ends.

## Phase: detect

Read `${CLAUDE_SKILL_DIR}/references/detect.md`. It holds the catalog reads, the
evidence list, the argument resolution, the gap handling, and the preview, which
the `install` and `gov` phases share rather than each stating.

## Phase: install

Run the chain in order, starting once the operator has confirmed the extras the
preview proposed, per the detect reference. Run from the
target project's current directory. Do not cd into the toolkit source tree. The
`canon` CLI is global.

Step 1: `canon init` installs base tooling, claude seeds, and governance rules.

```bash
canon init \
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
canon tooling sync <tooling-stack> <target> --write
```

### Monorepo with multiple language roots

Run `canon init` once at the repo root so `base` (husky, oxfmt, commitlint, CI) lands once, then sync each subtree with `--skip base`. Take the subtree commands from the preview's per-root rows rather than picking folders by hand.

```bash
canon tooling sync vite-react ./frontend --skip base --write
canon tooling sync python ./backend --skip base --write
```

- Without `--skip base`, each subtree re-drops husky, and git honors only one `core.hooksPath`, so the extra hook dirs silently break
- Each subtree keeps its own framework configs, and its stack reference reads through `canon tooling reference <stack>`
- A subtree sync withholds `.github/`, since GitHub reads workflows only at the root, and names each withheld file with the `working-directory` a root CI job needs
- A subtree with no `package.json` gets a minimal one from the sync, so its scripts and dependencies land in the same pass

### Planned services

Sync each planned service the preview resolved to a stack into its folder before the first commit, per `${CLAUDE_SKILL_DIR}/references/services.md`, and skip one marked `gap`.

### Public layer and shadcn

On a public answer, run `canon tooling sync public <target> --write` at the root after every stack sync, then apply `${CLAUDE_SKILL_DIR}/references/public.md`. Skip both otherwise.

On a shadcn yes, initialize each app root after every sync and ahead of Step 3, per `${CLAUDE_SKILL_DIR}/references/shadcn.md`.

### Detect again after the sync

Step 3: the sync lands dependencies and configs the first detection never saw, so detection runs again once every sync in Step 2 has finished.

```bash
canon gov detect <target> --stack <stack> --json
```

- Offer only the proposals the first pass lacked, through the same extras question, per the detect reference
- Run no question and no install when the second pass proposes nothing new
- Install only the second-pass rules the operator kept, and skip the install when they kept none
- Name no stack, since that form installs the named rules alone and keeps the stack the first install recorded

```bash
canon gov install --add <second-pass extras> <target>
```

Skip this step when Step 2 was skipped, since nothing landed for a second pass to read.

### Post-sync fixups

Step 4: post-sync fixups. Golden configs arrive from sync, so no config generation is required. But a few items may need a one-time touch:

- **Docs.** Run `canon tooling reference <tooling-stack>` and `canon tooling reference web` for any stack-specific follow-ups (Chrome extension overrides, setup script details).

Do not generate oxlint, ESLint, Vitest, or Playwright configs. They ship as golden files. Generating from prose duplicates what sync already installed.

## Phase: gov

Governance rules and nothing else, for a project declining the tooling layer.
Resolve exactly as the detect reference states, confirm the proposed extras
there, then run:

```bash
canon gov install <stack> --add <extras> <target>
```

Report the rule count installed, the target path, and any rules that failed to
resolve, which the CLI warns on.

## Phase: verify

Read `${CLAUDE_SKILL_DIR}/references/verify.md`. It holds both depths and the
script chain each runs. The default depth runs the leaf scripts and reports pass
or fail per script. `deep` adds the dev and preview server smoke, the end-to-end
suite, and the screenshot harness.

The bare chain on a fresh scaffold runs `verify` at the default depth, then
`verify deep`, so the report says whether the app was started.

- An unattended deep failure warns and names the script rather than failing the scaffold
- A stage the machine cannot run is named as skipped, never as passed
- The phase closes on `canon context audit`, reporting each uncovered code folder as a finding rather than a failure

## Phase: indexes

Read `${CLAUDE_SKILL_DIR}/references/indexes.md`. It holds the scan, the
frontmatter drafting, the scaffold, and the validate step.

This is the one phase that pauses to confirm candidate folders with the
operator, unless `--all` or `--folders` answered it ahead of time. A fresh scaffold usually has no markdown-heavy folder yet, so this phase often
finds nothing, which its reference defines as an outcome rather than a failure.

## Report

After the chain, report:

- Domains installed, with a check per domain
- Tooling stack synced, or skipped. Name the layers pulled via the extends chain.
- Any post-sync fixups applied (filename renames)
- `verify` outcome at each depth it ran, and whether the app was started
- Each code folder the context audit found no entry naming, with `/canon:context-sync` as its fix

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

Report the visibility taken and what answered it, plus what the public reference says a public run owes.
Report each planned service with the sync it took or its `gap` mark, or that none was planned and what answered it.

### After the root commit

A late amend to the root commit goes to a scratch branch for CI before `main` is forced, per the checklist below.

Close the report on the checklist in `${CLAUDE_SKILL_DIR}/references/first-pull-request.md`, filled for this project. Name each step and the verb or setting that does it, and run none, since each one writes to the remote and is the operator's call.
