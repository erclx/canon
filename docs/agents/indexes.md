---
title: Indexes
description: How canon indexes regen and canon indexes list resolve paths, what they stage, and the record and exit codes each emits
kind: reference
---

# Indexes

`canon indexes regen [paths…]` rewrites `index.md` files from sibling frontmatter, so a hand edit to a generated index is lost. `canon indexes list [path]` flattens each folder's `title` and `subtitle` plus each sibling's `title` and `description` into one catalog sorted by path.

`regen` takes `--dry-run`, `--json`, `--root <path>` (default the current directory), and `--no-stage`. `list` takes `--json`.

- With no paths `regen` walks the current directory, pruning `.git`, `node_modules`, and anything git ignores
- With paths, each resolves by walking up to the nearest indexed ancestor, bounded by `--root`, without consulting git. That is how `.canon/tasks/` and `.canon/memory/` stay current.
- A `PostToolUse` hook on `Write|Edit|MultiEdit` drives it, so a shell `mv` fires nothing. Run it after the last move.

## Output

`regen --json` emits a record per index in `results`, each with an `action`. A dry run reports drift as `would-write`.

```bash
canon indexes regen --dry-run --json | jq '.results[] | select(.action == "would-write")'
```

With paths inside a git repo, modified indexes are staged. A whole-repo walk and a git-ignored path never stage.

`list --json` emits `{ root, entries, errors }`.

- Each entry is `{ path, title, description }`, and an `index.md` row takes its `subtitle` as `description`
- A folder failing validation lands in `errors`, drops out of `entries`, and prints one `ERROR:` line on stderr
- Git-ignored folders never appear, so `.canon/tasks/` and `.canon/memory/` are absent

## Refusals

Read the record's `results` rather than the exit, on a write pass as well as a dry run.

| Verb    | Exit | Means                                                      |
| ------- | ---- | ---------------------------------------------------------- |
| `regen` | 0    | Clean                                                      |
| `regen` | 1    | A frontmatter error or a missing index                     |
| `regen` | 2    | Drift found under `--dry-run`                              |
| `list`  | 0    | No errors                                                  |
| `list`  | 1    | The root is not a directory, or a folder failed validation |

## See also

- `canon docs context-model`: the frontmatter contract and when to adopt indexes
