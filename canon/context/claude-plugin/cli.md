---
title: CLI
description: The canon claude command surface and what each verb writes into a target project
---

# CLI

| Command                   | Description                                                  |
| ------------------------- | ------------------------------------------------------------ |
| `canon claude init`       | Seed `.claude/` workflow docs and `CLAUDE.md` into a project |
| `canon claude seeds list` | List seed doc sources, plain text or `--json` for skills     |
| `canon claude sync`       | Reconcile `.gitignore` against the claude manifest           |
| `canon claude setup`      | Install user-level Claude config, `~/.claude/` by default    |

## init

### What lands

Seeds `.claude/` with project docs (`REQUIREMENTS.md`, `ARCHITECTURE.md`, `DESIGN.md`, `context/`, `tasks/`, `wireframes/`, `settings.json`) and hook scripts under `.claude/hooks/`. Also seeds `CLAUDE.md` at the project root and merges `.gitignore` entries. Skips files already present. Run once per project.

Coding and doc-authoring standards arrive separately via `canon gov install`, which `canon init` runs on every scaffold since `--stack` defaults to `base`. The seed `CLAUDE.md` carries no `## Markdown` section: `500-prose.md`, `501-markdown.md`, `510-context.md`, and `520-wireframes.md` deliver that routing path-scoped instead. `--skip governance` reopens the gap by design, and the run warns that standards land without the rules that route to them.

### Seeded folders

The `canon/wireframes/` folder ships with an `index.md` discovery anchor. Add a file per surface as the UI grows, following `standards/wireframes.md`. Read `index.md` first, then load only the surface files the current task touches. Per-surface files keep the lazy-load model honest as the project grows.

The `canon/context/` folder ships only its `index.md` discovery anchor. The entries themselves come from elsewhere: `tooling/base/seeds/` installs `development.md` and `ci.md` as user-owned files, and `canon init` runs base tooling before the Claude domain, so those land first and the Claude seed pass skips what is already present. Do not add a context entry to the Claude seeds without checking `tooling/base/seeds/canon/context/` for the same path, since two seed sources writing one destination resolve by whichever domain runs first.

### PostToolUse hooks

The seed `settings.json` ships eight hook scripts across four blocks. All eight open with the bounded stdin read covered in `development.md`, so a hook run by hand refuses instead of blocking, and seven stay byte-identical to their counterparts under `.claude/hooks/`.

A PostToolUse hook pairs with `.claude/hooks/standards-audit.sh`, which calls `canon markdown audit` against the edited file, reads the hits out of the `--json` record, and emits `additionalContext` so the agent self-corrects on the next turn. A checkout's own `src/cli.ts` wins over an installed binary, so the hook and the push stage read one build. Scratch dirs `.canon/tmp/`, `.canon/memory/`, `.canon/review/`, and `.canon/plans/` are skipped.

The seed copy calls the same verb and diverges in what it can resolve. It reaches an installed binary alone, since a scaffolded project has no checkout to run the CLI out of, and it names the install command when the machine carries none rather than exiting clean. `scripts/core/check-seed-independence.sh` exists to catch seed content depending on the toolkit checkout, which a resolved-binary call does not.

The same PostToolUse block also carries `.claude/hooks/tasks-index.sh`, which regenerates `.canon/tasks/index.md` after a task file changes. It is the only trigger that reaches that folder, because the board is gitignored and the whole-repo index walk filters candidates through `git check-ignore`.

The hook derives the walk-up boundary from the file path rather than the session, since the board resolves at the main worktree root and a linked worktree would otherwise reject the path, passes `--no-stage` so a hook never touches the git index, and reports both a frontmatter failure and a missing `canon` as `additionalContext`, because no gate stage can fail on a stale index in an ignored folder. Reporting is the point of the hook, so neither failure exits quietly, and the path guard keeps both messages scoped to a task-file edit.

`.claude/hooks/memory-index.sh` sits beside it and does the same job for `.canon/memory/index.md`, which is gitignored for the same reason and reached the same way. The two hooks differ only in the path they guard on, so a change to one is owed to the other.

`.claude/hooks/path-form.sh` closes the same block, handing back the absolute form of a path written from a linked worktree, covered in full in `canon/context/development/hooks.md`. It reads a `*/.claude/worktrees/*` segment off the write's own path rather than shelling out to git, the same derive-from-the-path precedent as the two index hooks above it.

### PreToolUse hooks

A PreToolUse hook on `Grep` and `Glob` pairs with `.claude/hooks/index-reminder.sh`, which walks up from the search path to the nearest `index.md` and reminds the agent to read it first, once per folder per session. It fires only where an index exists, so it self-scales to a project's index density.

A PreToolUse hook on `Write` and `Edit` pairs with `.claude/hooks/scratch-guard.sh`, which fires when a temp-path write lands outside `.canon/tmp/` and reminds the agent to write scratch there, once per session. It exempts anything under `CLAUDE_PROJECT_DIR` before matching the temp patterns, because the bare `*/tmp/*` match has no notion of a project root and fired on every source write in a project whose own path carried a `tmp` segment.

That trade gives up warning on a write to `<project>/tmp/`, which is a real violation, in exchange for silencing a false positive that fired constantly. It enforces the scratch rule deterministically instead of relying on CLAUDE.md prose the harness scratchpad instruction competes with.

### User-level settings

User-level pieces (attribution, permission `allow` entries, and `.env` denies) live at `~/.claude/settings.json` and install once per machine via `canon claude setup`. Project settings layer on top of user settings, so per-project files only need to carry what is genuinely project-specific.

## seeds

`canon claude seeds list [--json|--names]` enumerates the seed docs that `canon claude init` would copy into a project. Skills consume `--json` to compare a target project's installed copies against the toolkit's current seed source and propose targeted edits. The CLI only emits content. Reconciliation is the skill's job (see `seed-sync`).

The listing reads `planSeeds`, the same function `init` applies, so the two cannot disagree about what a seed install contains.

## sync

Reports whether each seeded project doc is present, then reconciles `.gitignore` against the `[gitignore]` section of `tooling/claude/manifest.toml`: appends any missing entries and prunes entries inside the `# Claude` section that the manifest no longer declares. Removed entries are logged as `-` lines. Never touches seeded project docs, so `.gitignore` is the only file it writes.

`canon sync` invokes this command with `CANON_NON_INTERACTIVE=1` when `.claude/` exists in the target, so gitignore reconciliation lands in the combined sync PR alongside other domains. The changed-file tracking in `src/sync/target.ts` watches `.gitignore` for this reason.

Seed audits are not automated. Run the `seed-sync` skill for per-part reconciliation across the preamble and each `##` section. `canon sync` prints a tip reminder at the tail.

## setup

Installs user-level Claude Code config from `tooling/claude/user/` into `~/.claude/`. Run once per machine after cloning the toolkit. Idempotent. Re-runs skip blocks that already match.

`canon claude setup [dest]` accepts a destination and falls back to `$HOME/.claude`. This is the only toolkit verb that writes outside a target project, so the argument exists to make it testable and to keep the sandbox scenario off the operator's real config. It refuses the toolkit's own `.claude/`, which is tracked and would otherwise take a `statusLine` pointing into the toolkit checkout.

It edits `settings.json` in place, restoring the file's mode and its existing indent width. Only the four keys the toolkit owns move, so a hand-maintained settings file comes back with the rest of its content and formatting untouched.

Three things land:

- `statusline-command.sh` copied to `~/.claude/` and registered as `statusLine.command` in `~/.claude/settings.json`.
- `attribution.commit` and `attribution.pr` set to empty strings to suppress Claude attribution in commits and PRs.
- `permissions.allow` and `permissions.deny` merged from `tooling/claude/user/settings.template.json`. Defaults: `Bash(bun run *)` on allow, and `Read(**/.env)` plus `Read(**/.env.*)` on deny. Existing user entries are preserved through `unique`-merge.

The statusline renders as: `Opus 4.8 | xhigh | 80k / 1000k | 92%`. Fields are model name, effort level, tokens used vs context window size, and remaining percentage. The effort field is omitted when the model does not report one. The percentage is colored by headroom: green at 30% or above, yellow below 30%, and red with a `⚠` prefix below 15%.
