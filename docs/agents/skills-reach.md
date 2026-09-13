---
title: Citation reach
description: Reporting the skill bodies that cite a path no target project receives, which corpus the verb reads, the ownership key that decides what counts, the one-word qualifier that marks a citation as decided, and why the verb reports instead of gating
---

# Citation reach

`canon claude skills reach [path]` reports every skill body citing a path that exists in the project and reaches no reader elsewhere. It reads and reports. Repairing what it finds is separate work.

```bash
canon claude skills reach
canon claude skills reach --json
canon claude skills reach ~/repos/my-project
```

| Option   | Behavior                                                   |
| -------- | ---------------------------------------------------------- |
| `--json` | Add a machine-readable record on stdout, keeping the frame |

## Which corpus it reads

`claude/skills/` when the project holds it, and `.claude/skills/` otherwise. The shipped tree wins where both are present, so a toolkit reads what it ships and a project holding only its own skills is measured rather than refused. Every report names the corpus it read on its `Corpus` line and carries it as `corpus` in the `--json` record.

## The defect it reads for

A plugin skill installs into a project and the toolkit's own tree is not there. A body naming `canon/context/transcripts.md` resolves for a session running in this repository and sends every other reader to nothing, and no stage asked the question until this one. The shape is wider than one folder: a seed naming a standard with no route and a machine-readable field naming a toolkit-only path are the same claim, true here and false in a target.

## What counts as a citation

A backticked token carrying a separator and an extension, which is how every body spells a path it means a reader to open. Three forms are skipped by construction.

- A placeholder such as `canon/context/<domain>.md`, which names a shape rather than a file
- A path resolved through `${CLAUDE_SKILL_DIR}`, which is self-contained wherever the plugin loads
- A sibling named relatively, such as `references/labels.md`, which matches no authoring root and travels with the body

The same sibling named from the repository root as `claude/skills/<name>/references/<file>.md` is reported rather than skipped. The plugin loads from a cache rather than from the project tree, so that spelling resolves for nobody and the report is correct.

A path the toolkit does not hold is dropped rather than reported. The measure asks whether a claim true here is false in a target, and a path true in neither is a different defect that `canon context audit` already reports against its own corpus.

## The ownership key

A cited path counts when it sits under an authoring root no install channel delivers. Standards and snippets install nowhere and are read through the plugin corpus, governance rules install under `.claude/rules/`, and the rest is this repository's own source, catalogs, and contract pages.

`src/`, `scripts/`, and bare `docs/` are deliberately outside the list. A body naming one of those is describing the reader's own tree, so listing them reports a correct citation on every run and buries the finding under the pass.

`canon/context/` joins them when the corpus read is a project's own. A seed put those entries there and the project owns them afterward, so a body under `.claude/skills/` naming one points at a file its reader holds. The seed disowning below cannot answer that in a project, since it reads a `tooling/` tree only the toolkit carries.

A path a seed installs is disowned twice, under its own name and under the folder spelling it takes once a project splits the entry. A domain that outgrows one file becomes `<domain>/`, which is still the entry the seed delivered, so reporting the split form would fail a project for growing.

## The qualifier

A correct citation and a defective one are the same string, and the sentence around it is the difference. A citation counts as decided when its line names the toolkit as the owner, matching the bodies that already spell it that way. The repair for a finding is to say whose copy the path is, never to delete the citation, since the paths name real documents a reader wants.

```markdown
Read `canon/context/indexes.md` from the toolkit if context on the system is needed.
```

A line mentioning the toolkit for an unrelated reason exempts a citation on it. That is the accepted cost of a word over a notation every future body would have to learn.

## Exit codes

Exit codes are `0` when every citation names its owner, `1` for a refusal, and `2` when at least one is unqualified. The refusal is a tree carrying neither `claude/skills/` nor `.claude/skills/`, which holds no skill body to measure, and it reports the reason rather than a clean count over nothing.

The verb reports rather than gates. A toolkit-scoped instruction is sometimes meant for a session in this repository, so failing a push on one would make the check something to route around. `canon audits run` registers it with no gating exit for the same reason, and carries `unqualifiedCitations` as its retained count.
