---
title: Claude Code memory
description: CLAUDE.md hierarchy, auto-memory, and rules files
---

# Claude Code memory

Claude Code carries knowledge across sessions through two mechanisms: `CLAUDE.md` files you write, and auto-memory notes Claude writes itself. Source: Anthropic, in the [Claude Code docs](https://code.claude.com/docs).

## CLAUDE.md hierarchy

Claude loads all `CLAUDE.md` files it finds by walking up the directory tree from the working directory. More specific files take precedence. The four scopes, from broadest to narrowest:

- Managed policy: system-wide, set by an org admin. Managed `CLAUDE.md` cannot be excluded
- User: `~/.claude/CLAUDE.md`, applies to all your projects
- Project: `./CLAUDE.md` or `./.claude/CLAUDE.md`, shared via source control
- Local: `./CLAUDE.local.md`, personal overrides, add to `.gitignore`

`CLAUDE.local.md` appends after `CLAUDE.md` within each directory.

Subdirectory `CLAUDE.md` files load on demand when Claude reads files in that directory, not at startup. Root-level files load in full at startup.

Set `claudeMdExcludes` in settings to skip specific `CLAUDE.md` files via glob patterns or absolute paths. Useful in monorepos where ancestor files are noisy. Managed-policy files cannot be excluded.

Files under `--add-dir` directories are not loaded by default. Set `CLAUDE_CODE_ADDITIONAL_DIRECTORIES_CLAUDE_MD=1` to opt in.

## Auto-memory

Auto-memory stores notes Claude writes itself, per repository. Files live in `~/.claude/projects/<sanitized-cwd>/memory/`. The directory key is derived from the git repo root, so worktrees and subdirs of the same repo share one auto-memory store. Outside git, the project root is used.

Claude saves useful learnings automatically: build commands, debugging patterns, project conventions.

Only the first 200 lines or 25 KB of `MEMORY.md` loads at startup, whichever comes first. Topic files load on demand.

Toggle auto-memory with `/memory` or set `autoMemoryEnabled: false` in settings. Override the location with `autoMemoryDirectory` (ignored when set in checked-in project settings, for security).

## Toolkit memory workflow

Project-scoped memory complements Claude Code's auto-memory. Files live at `.canon/memory/` in the project tree, gitignored, written by capture and curated through a review loop. A fact about a domain does not land there at all: capture routes it to that domain's `canon/context/` entry, which the three-tier context model already loads on demand. What stays is the residue no entry owns, in whatever mix of types that leaves.

The toolkit treats that residue as a holding pen, not long-term storage. Every review should promote each entry to a durable surface (`CLAUDE.md`, skill body, standards, governance) or retire it to `.canon/memory/archive/`. User-type memories are the exception when no in-repo target exists.

Capture opens the ship chain and propose closes it. The cost of review is re-deriving why an entry was captured, and that context is gone once the session ends. Writing the proposed fix while the session is fresh turns the later decision into a one-glance confirm and stops the pen from stacking to ten or more cold entries. Propose reads `CLAUDE.md`, the skill bodies, standards, and governance each ship, so it pays a read cost, but that work moves earlier where the batch is small.

### The loop

1. **Capture** with `/memory-capture`. Classifies session patterns as `feedback`, `project`, `user`, or `reference`, routes a project fact naming a context entry to that entry, and writes the rest as files. The ship skills run it first, because a routed fact edits a tracked file and has to reach the branch before the commit steps.
2. **Propose** with `/memory-review`, run last by `auto-ship` and `git-ship` and skipped when capture wrote no file. A ship caller scopes it to that session's captures. Run standalone it sweeps the whole pen, which is what lets cross-session duplicates merge into one rule. Writes `.canon/memory/review/memory-review-<slug>.md` with a `Decision:` slot and a proposed fix per item.
3. **Apply** with `/memory-review` after reviewing the receipt. Apply mutates tracked files, so it runs in a worktree and ships as its own commit, separate from the feature. A feature reviewer should not have to vet a change to how the agent operates.
4. **Challenge, Discuss, Cleanup** by re-pinging `/memory-review` with the matching phase phrase. Challenge applies absorbed, delta, and generality tests to promote items. Discuss writes `Take:` lines for question decisions. Cleanup deletes one receipt and touches no entry, since Apply is the only phase that moves one.

The skill detects the phase from the user's phrasing and the review file state. Capture writes the information at ship, Propose writes the fix at ship, and Apply is the only gated step. See `claude/skills/memory-review/SKILL.md` for the phase-by-phase contract.

### Index and location

`.canon/memory/index.md` is generated from each entry's `title`, `description`, and sentence-case `category` by a `PostToolUse` hook, since the folder is gitignored and the whole-repo index walk never reaches it. An archive move is a shell `mv`, which the hook does not match, so the review calls `canon indexes regen` itself after the last move.

`.canon/memory/` and `.canon/review/` always live at the main worktree root, never inside a linked worktree. The skill resolves the main root via `git worktree list --porcelain | grep -m 1 '^worktree ' | cut -d' ' -f2-` before reading or writing.

## Rules files

For modular instructions, use `.claude/rules/`. Each file covers one topic (e.g. `testing.md`, `api-style.md`). Claude discovers them recursively. Symlinks are followed.

Files support path scoping via frontmatter:

```yaml
---
paths:
  - 'src/api/**/*.ts'
---
```

User-level rules at `~/.claude/rules/` apply to all projects.

The toolkit installs governance into `.claude/rules/` by default. See `canon/context/governance/install.md` for the install and sync path.

## Imports

`CLAUDE.md` supports `@path/to/file` to pull in additional markdown files. Paths resolve relative to the importing file.

```markdown
See @README for project overview and @package.json for commands.
```

Imports support up to five levels of nesting.

## Tips

- Keep individual `CLAUDE.md` files under 200 lines. Longer files reduce adherence
- Use HTML comments (`<!-- notes -->`) for internal notes. Claude strips them before injection to save tokens
- Use `CLAUDE.local.md` for personal preferences that should not be committed
