---
title: Claude Code and git worktrees
description: Running parallel sessions on independent branches
---

# Claude Code and git worktrees

Each Claude Code conversation is a session tied to the current working directory. Sessions for a directory are stored under `~/.claude/projects/<sanitized-path>/`. A git worktree is a separate working directory on a separate branch, so a worktree gets its own session scope, its own transcripts, and its own `/resume` history. Two worktrees means two independent sessions, and those sessions can run in parallel.

Source: Anthropic for the session behavior, in [how Claude Code works](https://code.claude.com/docs/en/how-claude-code-works) and the [parallel sessions workflow](https://code.claude.com/docs/en/common-workflows). Worktrees themselves are a Git feature.

## Ways to create a worktree

Three paths, picked by when the decision happens and where the tree should live.

**Native `--worktree` flag.** Claude Code creates and manages the tree for you:

```bash
claude --worktree feature-auth    # creates <repo>/.claude/worktrees/feature-auth/ on a new branch
claude -w                         # auto-generated name
```

Trees created this way are auto-cleaned on exit when the working copy is unchanged. If there are changes, the tree persists and can be resumed later. `.claude/worktrees/` is already marked as a writable path in the default permission model, so edits inside it don't trigger protected-path prompts.

By default the branch starts from `origin/HEAD`, the remote's default branch, so it matches the remote rather than your local work. Set `worktree.baseRef: "head"` to branch from local `HEAD` instead, which is what you want when the worktree should carry in-progress changes. Passing `#<pr>` or a PR URL branches from that PR at `.claude/worktrees/pr-<number>`.

**Plain `git worktree`.** Use this when you want the worktree to live outside the repo, on an existing branch, or under your own naming scheme:

```bash
git worktree add ../toolkit-feat-snippets feat/snippets-polish
cd ../toolkit-feat-snippets
claude
```

All three paths produce the same session isolation. The native flag is convenient for short-lived branches decided up front. Plain `git worktree` is better for long-lived parallel work where the path matters. The in-session tools fit when the worktree decision happens mid-session.

## In-session entry and exit

`EnterWorktree` and `ExitWorktree` are in-session tools that wrap the same `.claude/worktrees/` mechanism as the `--worktree` flag, except mid-session. Use them when the worktree decision happens after the session has already started, like at the plan-to-execute boundary.

`EnterWorktree(name)` creates `.claude/worktrees/<name>/` on a new branch off current HEAD and switches the session into it. Names accept letters, digits, dots, underscores, dashes, and `/` separators, up to 64 chars. `EnterWorktree(path)` enters an already-registered worktree without creating one. The two parameters are mutually exclusive.

`ExitWorktree(action)` returns the session to the original directory. `action: "keep"` leaves the worktree on disk for later resume. `action: "remove"` deletes the worktree directory and its branch. The tool refuses `remove` when the worktree has uncommitted files or unmerged commits unless `discard_changes: true` is passed. On session exit while still inside the worktree, the user is prompted to keep or remove.

The tool descriptions explicitly require an instruction trail before invocation: a user request, a `CLAUDE.md` rule, or a memory entry. Wrapping invocation in a skill is the canonical pattern, since the skill body is the instruction trail. The `session-worktree` plugin skill is the toolkit's reference wrapper.

### Entry can mark the repository bare

`EnterWorktree` sometimes writes `core.bare = true` into the parent repository's shared config, and `ExitWorktree` does not restore it. Config is shared across every worktree, so the flag outlives the session that set it and reaches sessions that never entered a worktree at all.

Nothing surfaces at entry, because the linked worktree keeps working normally. The next command run from the main checkout fails instead:

```plaintext
fatal: this operation must be run in a work tree
```

The files are untouched on disk. Recovery is one line, and it works from any worktree of the repository because the write lands in the shared config:

```bash
git config core.bare false
```

`core.bare = true` on a repository whose root holds a `.git` directory is always this defect. A genuinely bare repository keeps its objects at the root and has no `.git` directory, which is the test worth automating.

Tracked upstream as `anthropics/claude-code#58345`, closed as not planned after a duplicate sweep, with `#45201` and `#45645` as sibling reports. All three describe the harness writing to shared config where worktree-local config belongs. Making the config file immutable at the filesystem level does stop the corruption, but it also blocks git's own legitimate writes, so prefer the repair over the lock.

## Background sessions

A background session is a full independent Claude Code session that runs without an attached terminal. Start one with `claude --bg "<task>"`, or send the current session to the background with `/bg`. Unlike a subagent, which runs inside the parent's context, a background session has its own conversation, transcript, and quota. See [Claude Code agent view](claude-agent-view.md) for the surface that manages one once it starts.

Each background session moves itself into its own worktree under `.claude/worktrees/` before editing files, so parallel sessions never collide. Disable this with `worktree.bgIsolation: "none"`.

## Session scoping and `/resume`

`/resume` defaults to sessions from the current worktree. Press `Ctrl+W` inside the picker to widen the list to sessions from sibling worktrees of the same repository. Sessions resumed by name resolve across all worktrees of the repository, so you can jump back into a sibling tree's session without switching directories first.

Transcripts for each worktree live under their own `~/.claude/projects/<sanitized-path>/` directory. Removing a worktree does not delete its transcript directory. Prune manually if you care about disk.

## Settings and `CLAUDE.md` inside a worktree

Settings resolve hierarchically through four scopes: managed, user, project, and local. The project-scope `.claude/settings.json` is loaded from the worktree's directory, not from the main repo root. If a worktree carries its own `.claude/settings.json`, it overrides the main repo's project settings. User-scope settings still apply otherwise.

`CLAUDE.md` loads from the working directory and its parents, so a worktree inherits the main repo's `CLAUDE.md` when it sits inside the repo (the default for `--worktree`). A worktree placed outside the repo will not see the main repo's `CLAUDE.md`. Copy or symlink it if you need the same project rules.

Skills from `.claude/skills/` resolve from the worktree's directory as well. Skills added to the main branch are not visible inside a sibling worktree until that branch is checked out.

## A worktree starts without dependencies

A linked worktree is a second working directory over one repository, and git shares only what it tracks. Every ecosystem installs into a folder its ignore file names, such as `node_modules/`, `.venv/`, or `vendor/`, so none of it crosses and a tree created seconds ago carries none of it.

Nothing announces this at entry. Every tracked file is present, so the worktree looks complete, and the first command that needs a dependency reports a missing module rather than an empty working directory. Install once per worktree, ahead of the first build, test, or server command.

The cost is disk per tree plus one install wait. A package manager with a content-addressed store links rather than copies, which keeps the repeat installs across sibling worktrees cheap.

## Shared session scratch

`.canon/plans/`, `.canon/review/`, and `.canon/memory/` are gitignored and live at the main worktree root, not inside a linked worktree. Agents running inside a worktree resolve these paths against the main root via `git worktree list --porcelain | grep -m 1 '^worktree ' | cut -d' ' -f2-`, falling back to `pwd` when not in a git repo. The canonical rule is `governance/rules/canon/605-worktrees.md`, which a target reads back at `.claude/rules/canon/canon/605-worktrees.md` once it has run `canon gov sync`.

Resolving the path is not enough to write it. Claude Code's session isolation refuses an editing-tool write to any path outside the worktree and offers the worktree copy instead, while reads resolve normally, so the boundary is tool-scoped rather than filesystem-scoped. An agent that accepts the offered redirect reports success and leaves the file where no later session looks.

A shell command reaches the main root, though only as a plain single command, since a compound one whose target cannot be statically verified is refused for complexity. That covers writing a whole file and not changing a line inside one, which needs a tool that resolves the main root in its own process.

Ephemeral per-command scratch like `.canon/tmp/pr/body.md` stays in the current worktree. It is deleted the same turn it is created, so centralizing buys nothing.

## Tooling caveats

Tools that honor `.gitignore` by walking parent directories will treat every file in a linked worktree as ignored once `.claude/worktrees/` is in the main repo's `.gitignore`. `cspell` is the concrete case in this repo. Bound its search with `gitignoreRoot: ["."]` in `cspell.json` so it stops at the config's own directory.

## Concurrent safety

Do not resume the same session in two terminals at once. Both terminals write to the same session file and messages interleave. Each terminal sees only its own view during the run, but the merged transcript becomes unreadable on the next resume. Use `--fork-session` to branch a session cleanly when two lines of work must share a starting context.

Separate sessions in separate worktrees are safe to run concurrently. There is no documented shared-cache or rate-limit contention between sessions, and no worktree-level locking. If two sessions auto-start the same stdio MCP server, each session spawns its own server process. Coordinate ports explicitly when a server binds one. Deriving the port from the worktree's own directory name is the coordination that needs no shared state, since the name is unique per tree and stable across restarts, and a claim file needs a lock to be correct under two sessions starting at once.

## Shipping from worktrees

A fan-out of N worktrees produces N PRs. The order they merge in matters only when two branches touch the same file. The rules below keep post-merge state clean without manual `git worktree remove` dances.

**Merge order.** Merge the branch with the smallest shared-hotspot footprint first. If any branch touches `CLAUDE.md`, a Claude context entry, or a regenerated `index.md`, that branch merges last. Its siblings rebase on the new `main` once it lands. See [Fan-out rules](#fan-out-rules-for-this-toolkit) for the hotspot list.

**Rebase before merging the next PR.** After PR 1 squash-merges, sibling branches are behind `main` and may have stale rebases of shared files. In each sibling worktree, run `git fetch origin && git rebase origin/main` before merging. Merge when the rebase is clean, and when it conflicts resolve in the worktree, push, then merge. Never force-merge a stale branch.

**Clean up after merge.** Once a PR merges, the worktree and its local branch are stale. Run `/git-worktree cleanup` to remove worktrees whose branches are merged on GitHub and prune the local branches. The skill detects merge state via `gh pr view`. To start a fresh feature from inside a stale worktree, `ExitWorktree(action: "keep")` back to main, then `/session-worktree <new-name>`.

**Session transcripts survive.** Removing a worktree does not delete its `~/.claude/projects/<sanitized-path>/` transcript directory. `/resume` still finds the session if the worktree is later recreated at the same path, but a new slug means a new transcript scope.

**When fan-out was the wrong call.** If every sibling needs a rebase and every rebase conflicts on the same file, the branches should have serialized. Land one, wait, then start the next. The skill does not recover from this state. It only cleans up after a flow that already worked.

## Fan-out rules for this toolkit

The toolkit domains have different collision profiles. A worktree-based fan-out is safe when the branches touch disjoint trees and do not both write to the shared hotspots listed below.

**Safe to fan out.** Work confined to a single domain directory usually does not collide with work in another domain:

- A new skill under `claude/skills/<new-name>/` or `.claude/skills/<new-name>/`
- Independent fixes in different subtrees of `scripts/`

**Shared hotspots.** If a branch touches any of these, serialize rather than fan out. Parallel edits almost always produce a merge conflict or a stale regenerated file:

- `CLAUDE.md`: cross-domain behavior lives here, so every edit is on the hot path
- `tooling/**`: stack manifests, golden configs, and seeds are tightly coupled, so a change often spans multiple files
- `canon/context/context-model.md`, `docs/agents/`: cross-referenced from multiple domains
- Any folder's `index.md`: regenerated by `bash scripts/core/regen-indexes.sh`, so two worktrees that both add files in regen-covered folders will race on the index

**Before fanning out.** Land any in-flight edit to a shared hotspot on `main` first. A worktree on a stale `CLAUDE.md` will drift from other parallel work and cost more to rebase than it saved.

## Related

- [Operating model](../../docs/workflow/operating-model.md) for the orchestrator and worker roles that run in these worktrees
- [Claude Code permissions](claude-permissions.md) for settings resolution details
- [Claude Code subagents](claude-subagents.md) for in-session parallelism without worktrees
- [Zshrc aliases for Claude Code](../../docs/workflow/zshrc-aliases.md) for `clw` and friends to shorten worktree spawn
