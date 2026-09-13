---
title: Plugin discovery
description: How a local session loads the plugin from this repository and from a target project
---

# Plugin discovery

Inside the toolkit repository, Claude Code auto-discovers the plugin from `claude/.claude-plugin/plugin.json`. No flag needed on a fresh launch. Discovery does not fire on a resume, which restores whatever registration the session started with and recomputes nothing, so `claude --resume` needs `--plugin-dir` passed again wherever the session depends on the plugin.

In other repositories, pass `--plugin-dir` explicitly:

```bash
claude --plugin-dir $TOOLKIT/claude
```

Add shell aliases to avoid typing the flag each time. Set `TOOLKIT` once in `~/.zshrc` and reference it in the `clp` alias:

```zsh
TOOLKIT=~/path/to/toolkit

alias cl='claude'
alias clp='claude --plugin-dir $TOOLKIT/claude'
alias clps='clp --model sonnet'
```

For the full alias set covering resume, continue, worktree, and model shortcuts, see `docs/workflow/zshrc-aliases.md`.

Machine provisioning is a separate concern reachable by the same word. `canon claude setup` installs user-level Claude config at `~/.claude/` and is covered in `canon/context/claude-plugin/cli.md`.

## Gotchas

### Worktree entry branches from whatever the local ref holds

Worktree entry bases the new branch on the local `origin/main` tracking ref rather than fetching, so a stale ref starts the work behind the remote with nothing reporting it. One worktree opened two commits and one release behind the remote, with `package.json` and `.cspell/tech-stack.txt` touched on either side. Neither entry, `bun run check`, nor the commit path reports the gap, so fetch and compare `git rev-parse HEAD` against `git ls-remote --heads origin main` at the start of a run.

### A skill edited on the branch serves its pre-edit body

A session that edits a plugin skill and then invokes it receives the pre-edit body, because `--plugin-dir` resolves against the main worktree rather than the branch. Autoship Step 7 invoked `docs-fold` while the branch was replacing its Step 8, and the loaded body still instructed deleting the shipped plan, which would have destroyed the plan the branch existed to preserve. A probe meets the same trap sideways: asking a session to load a skill carrying `disable-model-invocation: true` makes it search the filesystem and find the main worktree's stale copy, so invoke by slash command and forbid the search.

### The isolation guard reads a command as text

The isolation guard scans a `Bash` line as text rather than parsing it, so two shapes are refused before they run. A second `git` token anywhere in the line, file paths included, reads as unverifiable: `git diff --staged -- standards/slug.md claude/skills/session-worktree claude/skills/git-followup` was refused while the same command with no pathspec ran, and a bare `ls` naming those same paths was refused though it invokes no git at all. A command substitution wrapping a redirect or a chain is refused for complexity, as a `git merge-base` capture feeding a braced pipe was, though every path it touched sat inside the worktree. A read-only `for` loop over worktree-local files is refused on the same trigger. Drop the pathspec and filter the full output, or run the producing command alone and paste its literal into the next call.

A bulk move of many files at the main worktree root goes out as `xargs -a <list> mv -t <destination>`, with the argument list built into a scratchpad file by an earlier command. Neither the obvious loop nor a `mkdir -p ... && mv ...` runs past the guard, and issuing one plain `mv` per file does not scale past a handful, so building the list first is what keeps every call plain and single.

### A branch listing carries decoration

`git branch --merged` prefixes the current branch with `*` and every branch checked out in a linked worktree with `+`, so a grep matching a literal two-space indent misses exactly the branches a worktree-aware command enumerates. `git-worktree`'s local-ancestry fallback ran `grep -qx "  <branch>"` and reported `unmerged` for every merged worktree branch with no pull request, so cleanup skipped the rows it exists to remove. `--format='%(refname:short)'` drops decoration entirely. The paired sandbox scenario already asserted the correct state and had never been run, so a correct scenario is not coverage until something executes it.

### A linked worktree's `.git` is a file

A linked worktree's `.git` is a file holding a `gitdir:` pointer rather than a directory, so the usual `-not -path '*/.git/*'` does not reach its duplicated tree. The eval runner's created-or-changed report listed forty duplicated project files around the three the session actually wrote. Any `find`, `grep -r`, or checksum sweep over a project root an agent works in needs `*/.claude/worktrees/*` excluded by name as well, and the tell is the worktree's own `.git` showing up as a matched file.
