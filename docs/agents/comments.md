---
title: Comments
description: Comment density by language and kind, the two structural exclusions, and how the degradation sweep finds its vocabulary
---

# Comments

`canon comments scan [path]` reports comment density for a tree, split by language and by comment kind. It is the only command that parses the target's own source, so its scope stays deliberately narrow: TypeScript and bash, line-oriented, no AST.

```bash
canon comments scan
canon comments scan src --json
canon comments scan --since v0.5.0
```

| Option               | Behavior                                                        |
| -------------------- | --------------------------------------------------------------- |
| `--json`             | Add a machine-readable record on stdout, keeping the frame      |
| `--since <rev>`      | Report the trend from this revision instead of a snapshot alone |
| `--languages <list>` | Comma-separated subset of `ts,sh` (default: both)               |

A line counts as a comment when its first non-whitespace token opens one, which is what keeps a URL in a string literal from reading as a `//` comment without a parser. Density is `commentLines / lines`, reported and never graded. The command produces the number and a rule produces the judgment.

Two exclusions are structural rather than tuning. Heredoc bodies are dropped from both the numerator and the denominator, because a scenario script carrying markdown inside one has `#` opening a heading rather than a comment, which inflated a measured 112 comment lines to 427. Fixture trees are pruned by path segment for the same reason. The line-1 shebang is not a comment, since every script has one and counting it puts a floor under density that reports the file count.

`--since` recomputes each point from git via `ls-tree` and `cat-file --batch`, checking nothing out. No ledger is written or read. Six points spread evenly across the window by default, and the boundary revision is always included so the series keeps the reading it is measured against.

This works only because density is a pure function of a tree. Which author or session wrote a comment is not recoverable from git and does not belong here.

## Degradation sweep

The degradation sweep reads its vocabulary from whichever rule publishes a `## Degradation vocabulary` heading, preferring `.claude/rules/` over `governance/rules/`, so one definition serves the toolkit and every target. Discovery anchors on the heading rather than a filename, because a renamed rule would otherwise empty the vocabulary while the sweep still reported clean. With no such rule the sweep reports **skipped** rather than zero hits, since finding nothing and looking for nothing mean opposite things.

`090-code-comments` is the rule that publishes the list, and it ships on the `base` stack. A project that installs or syncs governance for the first time after that rule landed gets a sweep that previously reported skipped, so hits appear where the command used to stay quiet. Edit the backticked terms in the installed copy to change what that project sweeps for. The sweep matches comment text, so a comment naming a term as an example is a hit, and a hit is a prompt to read the line rather than a verdict on it.
