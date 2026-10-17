---
title: Plugin discovery
description: How a local session loads the plugin from this repository and from a target project
---

# Plugin discovery

Inside the toolkit repository, Claude Code auto-discovers the plugin from `claude/.claude-plugin/plugin.json`, with no flag on a fresh launch. A resume restores the registration the session started with and recomputes nothing, so `claude --resume` needs `--plugin-dir` again wherever the session depends on the plugin.

In other repositories, pass `--plugin-dir` explicitly:

```bash
claude --plugin-dir $TOOLKIT/claude
```

Set `TOOLKIT` once in `~/.zshrc` and reference it in an alias to skip the flag:

```zsh
TOOLKIT=~/path/to/toolkit

alias cl='claude'
alias clp='claude --plugin-dir $TOOLKIT/claude'
alias clps='clp --model sonnet'
```

The full alias set, covering resume, continue, worktree, and model shortcuts, is in `docs/workflow/zshrc-aliases.md`.

Machine provisioning is a separate concern reachable by the same word. `canon claude setup` installs user-level Claude config at `~/.claude/`, covered in `canon/context/claude-plugin/cli.md`.

## Gotchas

### Worktree entry branches from whatever the local ref holds

Entry bases the new branch on the local `origin/main` tracking ref without fetching, so a stale ref starts the work behind the remote.

- Nothing reports the gap, not entry, `bun run check`, or the commit path
- Fetch at the start of a run, then compare `git rev-parse HEAD` against `git ls-remote --heads origin main`

### A skill edited on the branch serves its pre-edit body

A session that edits a plugin skill and then invokes it gets the pre-edit body, because `--plugin-dir` resolves against the main worktree rather than the branch.

- Autoship invoked `context-fold` while the branch was replacing its Step 8, and the loaded body still instructed deleting the shipped plan, the plan the branch existed to preserve
- A skill with `disable-model-invocation: true` sends a probe searching the filesystem for it, which finds the main worktree's stale copy. Invoke by slash command and forbid the search.

### The isolation guard reads a command as text

The guard scans a `Bash` line as text rather than parsing it, so a second occurrence of the token `git` reads as an unverifiable second git invocation. A pathspec naming `claude/skills/git-followup` trips it, and so does `ls`.

- A command substitution wrapping a redirect or a chain is refused for complexity, as are a `git merge-base` capture feeding a braced pipe and a read-only `for` loop over worktree-local files
- Drop the pathspec and filter the full output, or run the producing command alone and paste its literal into the next call

A bulk move at the main worktree root goes out as `xargs -a <list> mv -t <destination>`, with the list built into a scratchpad file by an earlier command. A loop and a `mkdir -p ... && mv ...` both fail the guard, and one `mv` per file does not scale past a handful.

### A branch listing carries decoration

`git branch --merged` prefixes the current branch with `*` and every branch checked out in a linked worktree with `+`, so a grep matching a literal two-space indent misses the branches a worktree-aware command enumerates. Read `--format='%(refname:short)'` instead, which drops the decoration.

### A linked worktree's `.git` is a file

A linked worktree's `.git` is a file holding a `gitdir:` pointer, so `-not -path '*/.git/*'` does not reach its duplicated tree. The eval runner's created-or-changed report once listed forty duplicated project files around the three the session wrote.

- Exclude `*/.claude/worktrees/*` by name from any `find`, `grep -r`, or checksum sweep over a project root an agent works in
- The tell is the worktree's own `.git` showing up as a matched file
