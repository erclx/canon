---
title: Hooks
description: Running the post-merge steps through one verb, the order and the child call behind each, the root and working directory each step reads, the skip switches, and the line each record maps to
---

# Hooks

`canon hooks post-merge` runs the steps a git `post-merge` hook drives, so the hook itself stays a guard plus one call. It reads which pull requests the merge brought in, runs each step as a child `canon` call with `--json`, and prints one line per outcome worth reporting.

```bash
canon hooks post-merge
canon hooks post-merge --root "$root"
```

| Option          | Behavior                                                                                             |
| --------------- | ---------------------------------------------------------------------------------------------------- |
| `--root <path>` | Main worktree root holding the board and the records, resolved from `git worktree list` when omitted |

Exit codes: `0` on every path, since a hook failing aborts nothing useful. Lines go to stderr, and stdout stays empty. An ordinary merge prints nothing.

## The steps

The steps run in this order, and the verb's `--help` lists the child calls from the same table it runs them from.

| Step                     | Child call                                                    | Runs from        |
| ------------------------ | ------------------------------------------------------------- | ---------------- |
| Archive the merged task  | `canon tasks archive --pull-request <n> --root <root> --json` | the caller's cwd |
| Push the records         | `canon records push --root <root> --json`                     | the caller's cwd |
| Reclaim merged worktrees | `canon worktrees reclaim --json`                              | the caller's cwd |
| Reinstall the CLI        | `canon upgrade --json`, under `CANON_NON_INTERACTIVE=1`       | the caller's cwd |
| Update the plugin cache  | `canon claude plugin-update --json`                           | the caller's cwd |

The archive runs once per pull request number, read as the trailing `(#NNN)` on every subject in `ORIG_HEAD..HEAD`, or on the tip alone when the merge left no `ORIG_HEAD`.

The reclaim takes no `--root`. It refuses the worktree its own working directory names, so a root would let a pull inside a linked worktree remove the worktree it stands in. The archive and the push take the root because the board and the records live at the main worktree root.

Each step is a separate process rather than an in-process call, so the plugin update runs the binary the upgrade just installed. Every child, and every `git` read, runs with the repository variables a hook exports stripped, since `GIT_DIR` beats `-C`.

## Skip switches

| Variable                     | Skips                   |
| ---------------------------- | ----------------------- |
| `CANON_SKIP_RECLAIM=1`       | the worktree reclaim    |
| `CANON_SKIP_UPGRADE=1`       | the CLI reinstall       |
| `CANON_SKIP_PLUGIN_UPDATE=1` | the plugin cache update |

Any non-empty value skips the step, and each switch skips its own step only.

## What prints

Each line is decided from the child's parsed record. A child producing no parseable record is an older binary carrying no such subcommand, and that step stays quiet.

- Archive: the archived task and its number, plus the files named in a non-empty `relinkFailed` whose links still point at the old path, or the refusal's `message` with a pointer to the task board. A record carrying no `relinkFailed` reads as empty. `no-match` and `no-board` stay quiet.
- Records push: the count of changed paths when above zero, or the refusal reason. `no-repository` stays quiet.
- Reclaim: the removal count and the failure count, both read from the fields whatever the exit, or an unreadable reason. `gh-missing` stays quiet.
- Upgrade and plugin update: the record's `message` on any state but `current`, or on a failure. The plugin update stays quiet on `no-claude` and `no-plugin`.
