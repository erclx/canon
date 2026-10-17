---
title: CLI
description: The canon claude command surface and what each verb writes into a target project
---

# CLI

## Overview

- `canon claude init` seeds the project docs, `.claude/settings.json`, its hook scripts, and `CLAUDE.md` into a project
- `canon claude seeds list` lists each seed destination beside its source
- `canon claude sync` reconciles `.gitignore` against the claude manifest
- `canon claude setup` installs user-level Claude config, `~/.claude/` by default

## Layout

### What lands

`canon claude seeds list` names every file `init` writes and where it comes from, so this entry does not restate the set. `init` also merges `.gitignore` entries, skips a file already present, and runs once per project.

- Coding and doc-authoring standards arrive separately via `canon gov install`, which `canon init` runs on every scaffold since `--stack` defaults to `base`
- The seed `CLAUDE.md` has no `## Markdown` section. `governance/rules/writing/markdown.md` and `governance/rules/canon/context.md` deliver that routing path-scoped instead.
- `--skip governance` reopens the gap by design, and the run warns that standards land without the rules that route to them

### PostToolUse hooks

The seed `settings.json` ships ten hook scripts across seven blocks on three events. All ten open with the bounded stdin read covered in `canon/context/development.md`, so a hook run by hand refuses instead of blocking. Eight stay byte-identical to their counterparts under `.claude/hooks/`.

- `pr-create-log.sh` is covered in `canon/context/development.md`
- `silent-turn.sh` and `reply-links.sh` are covered in `canon/context/development.md`
- The rest are below

### The standards audit hook

A PostToolUse hook pairs with `.claude/hooks/standards-audit.sh`. It calls `canon markdown audit` against the edited file, reads the hits out of the `--json` record, and emits `additionalContext` so the agent self-corrects on the next turn.

- A checkout's own `src/cli.ts` wins over an installed binary, so the hook and the push stage read one build
- Scratch dirs `.canon/tmp/`, `.canon/review/`, and `.canon/plans/` are skipped
- The seed copy reaches an installed binary alone, since a scaffolded project has no checkout, and names the install command when the machine carries none rather than exiting clean
- The Seed independence measure in `src/gate/boundaries.ts` catches seed content depending on the toolkit checkout, which a resolved-binary call does not

### The records index hook

The same block carries `.claude/hooks/records-index.sh`, which regenerates `.canon/tasks/index.md` after a task file changes. It is the only trigger that reaches the folder, because the folder is gitignored and the whole-repo index walk filters candidates through `git check-ignore`.

- It derives the walk-up boundary from the file path rather than the session, since records resolve at the main worktree root and a linked worktree would otherwise reject the path
- It passes `--no-stage` so a hook never touches the git index
- It reports a frontmatter failure and a missing `canon` as `additionalContext`, because no gate stage can fail on a stale index in an ignored folder
- Neither failure exits quietly, and the path guard keeps both messages scoped to a record-file edit
- An archived or declined task and a write under `.canon/memory/` exit silent. The script once served a memory folder too, and a target installed before that arm was dropped keeps it, inert.

A target installed before the merge keeps the two older scripts and their settings entries, since sync copies a seeded hook only where none exists and never rewrites a `hooks` block.

### The path form hook

`.claude/hooks/path-form.sh` closes the same block, handing back the absolute form of a path written from a linked worktree, covered in `canon/context/development.md`. It reads a `*/.claude/worktrees/*` segment off the write's own path rather than shelling out to git, the same derive-from-the-path precedent as the index hook.

### PreToolUse hooks

Four PreToolUse hooks remind or deny before a tool runs, each paired with a script under `.claude/hooks/`.

- On `Grep` and `Glob`, `index-reminder.sh` walks up from the search path to the nearest `index.md` and reminds the agent to read it, once per folder per session. It fires only where an index exists.
- On `Bash`, `review-post-scan.sh` runs `canon labels scan --body-file` against the body file of a `gh api` review or comment post and denies the call on a finding
- It blocks rather than reminds and calls `canon` from `PATH`, so a target on a CLI older than the flag has review posts refused until it upgrades
- The decision and its rejected alternative are in `canon/context/development.md`

### User-level settings

User-level pieces (attribution, permission `allow` entries, and `.env` denies) live at `~/.claude/settings.json` and install once per machine via `canon claude setup`. Project settings layer on top, so per-project files carry only what is project-specific.

### seeds list

`canon claude seeds list [--json|--names]` enumerates the seed docs that `canon claude init` would copy into a project. Skills consume `--json` to compare a target's installed copies against the toolkit's current seed source and propose targeted edits.

The CLI only emits content, and reconciliation is a hand merge against that source. The listing reads `planSeeds`, the same function `init` applies, so the two cannot disagree about what a seed install contains.

### sync

`canon claude sync` reports whether each seeded project doc is present, then reconciles `.gitignore` against the `[gitignore]` section of `tooling/claude/manifest.toml`. It never touches seeded project docs, so `.gitignore` is the only file it writes.

- It appends missing entries and prunes entries inside the `# Claude` section that the manifest no longer declares, logging removals as `-` lines
- `canon sync` invokes it with `CANON_NON_INTERACTIVE=1` when `.claude/` exists in the target, so the change lands in the combined sync PR
- The changed-file tracking in `src/sync/target.ts` watches `.gitignore` for this reason
- Seed audits are not automated. Merge a drifted seed by hand against the toolkit copy, one `##` section at a time. `canon sync` prints a tip reminder at the tail.

### setup

`canon claude setup [dest]` installs user-level Claude Code config from `tooling/claude/user/` into `~/.claude/`. Run it once per machine after cloning the toolkit. It is idempotent, and re-runs skip blocks that already match.

- The destination falls back to `$HOME/.claude`. It is the only toolkit verb writing outside a target project, so the argument keeps the sandbox scenario off the operator's real config.
- It refuses the toolkit's own `.claude/`, which is tracked and would otherwise take a `statusLine` pointing into the toolkit checkout
- It edits `settings.json` in place, restoring the file's mode and indent width. Only the four keys the toolkit owns move, so a hand-maintained file keeps the rest of its content and formatting.

### What lands in user settings

Three things land.

- `statusline-command.sh` is copied to `~/.claude/` and registered as `statusLine.command`
- `attribution.commit` and `attribution.pr` are set to empty strings to suppress Claude attribution in commits and PRs
- `permissions.allow` and `permissions.deny` merge from `tooling/claude/user/settings.template.json`, adding `Bash(bun run *)` to allow and `Read(**/.env)` plus `Read(**/.env.*)` to deny
- Existing user entries survive the `unique` merge

### The statusline

The statusline renders as `Opus 4.8 | xhigh | 80k / 1000k | 92%`, being model name, effort level, tokens used against context window size, and remaining percentage. The effort field is omitted when the model does not report one.

The percentage is colored by headroom, green at 30% or above, yellow below 30%, and red with a `⚠` prefix below 15%.

## Decisions

### The search reminder

On `WebSearch`, `search-reminder.sh` tells the session to load `canon:search-craft` before it searches, once per session. A skill description fires on what the user asked, so a session that decides mid-task to search never loads the method, and this hook is the one surface that sees the tool call.

- It names the skill and carries no method text, and its wording says to report the skill when it does not resolve, since a project on governance alone has no plugin
- It stays quiet on a payload with no `session_id` rather than dedupe on a shared key
- The matcher stops at `WebSearch`, leaving `WebFetch` alone

### The scratch guard

On `Write` and `Edit`, `scratch-guard.sh` fires when a temp-path write lands outside `.canon/tmp/` and reminds the agent to write scratch there, once per session. It enforces the scratch rule deterministically instead of relying on CLAUDE.md prose that the harness scratchpad instruction competes with.

- It strips `CLAUDE_PROJECT_DIR` before matching the temp patterns, since a bare `*/tmp/*` match would fire on every source write in a project whose own path carries a `tmp` segment
- Stripping the root rather than exiting on it keeps a write to `<project>/tmp/`, a real violation, warning
- It exempts the harness's `.claude/jobs/<id>/tmp/` by shape

## Gotchas

### Seeded folders

The Claude seeds carry nothing under `canon/context/`. `tooling/base/seeds/` installs the folder's `index.md`, `development.md`, and `ci.md` as user-owned files, and `canon init` runs base tooling before the Claude domain, so those land first and the Claude pass skips what is present.

Do not add a context entry to the Claude seeds without checking `tooling/base/seeds/canon/context/` for the same path. Two seed sources writing one destination resolve by whichever domain runs first.
