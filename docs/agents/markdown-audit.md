---
title: Markdown audit
description: Running the markdown audit over any path, each finding it reports with whether it gates, the six density limits, the four table limits, the advisory measures, the exit codes, and where the audit runs
kind: reference
---

# Markdown audit

`canon markdown audit [path...]` reports any markdown file against the `markdown-craft` skill's `markdown.md`. It resolves no folder and needs no `index.md`, so `.claude/rules/` and `governance/` are in reach. Folder-shaped findings belong to `canon context audit`, in `context-audit.md`.

```bash
canon markdown audit
canon markdown audit --json
canon markdown audit .claude/rules governance
canon markdown audit docs/agents/install-and-sync.md
canon markdown audit 'docs/**/*.md'
```

An argument is a file, a directory, or a glob, taken against the corpus git lists. A bare run measures every tracked or untracked-and-not-ignored file. An explicit file is taken as given, so a gitignored draft can be measured, and an argument matching nothing is named on the scope line.

## Output

The ban set and checkpoints ship in `src/markdown/bans.ts` and `src/markdown/structure.ts`. `markdown.md` states each rule and the `write-human` skill states the cadence numbers, so move a number in both places in one change.

| Finding         | Reports                                                                              | Gates             |
| --------------- | ------------------------------------------------------------------------------------ | ----------------- |
| Bans            | The two characters `markdown.md` bans, outside frontmatter, fences, spans, and links | Always            |
| Links           | A relative link resolving to nothing on disk                                         | Always            |
| Density         | The six limits below, under `density`                                                | On a gated prefix |
| Reference shape | A `kind: reference` page breaking its shape, under `referenceShape`                  | On a gated prefix |
| Tables          | The four table limits below, under `tables`                                          | Never             |
| Colons          | A colon followed by more text in a prose line, under `colons`                        | Never             |
| Heading case    | A capital after the first word of a heading or `title`, under `headingCase`          | Never             |

A page marked `kind: reference` holds its opening, then `Output`, `Refusals`, and `See also` as H2s, each at most once and in that order. It takes no H3 and no table headed `Flag` or `Option`. An unmarked page is never measured.

Tables take the four limits in the `markdown-craft` skill's `tables.md`, on the paths density measures. A cell past 120 visible characters reports as `table-cell`, more than 8 body rows as `table-rows`, a list right after a table as `table-then-list`, and a code span with a run past 30 characters as `table-token`. None sets the exit code.

| Density limit       | Finding                                                    |
| ------------------- | ---------------------------------------------------------- |
| Paragraph length    | A prose paragraph past 350 characters                      |
| Paragraphs in a row | More than 2 paragraphs with nothing else between them      |
| Bullet length       | A top-level bullet past 200 characters                     |
| Bullets in a row    | More than 5 plain top-level bullets                        |
| Heading depth       | Any heading past H3                                        |
| H3 opening          | An H3 whose first block is neither a paragraph nor a table |

- A paragraph under a list item counts toward that bullet, never as a paragraph
- A table, fence, list, heading, or bold section marker ends a run of paragraphs
- A run whose every item opens with a bold label or a link is exempt, and numbered items never count
- Only context entries, docs, skill bodies, references, and requirements, tooling seeds and stack references, the wiki, `README.md`, and `CONTRIBUTING.md` take a finding
- A requirement gates only once the gated list below names its own file, never through its skill's prefix and never on a bullet run alone

| Root              | A density or reference shape finding gates                                                                 |
| ----------------- | ---------------------------------------------------------------------------------------------------------- |
| Canon's checkout  | Under a `GATED_PATHS` prefix in `src/markdown/scope.ts`, and a bullet run on every density path above      |
| Any other project | Under a prefix `canon/config/markdown.toml` lists, a bullet run included. With no such file nothing gates. |

A project's list grows through `canon markdown gated add <prefix>`, which appends a folder only once it carries no finding, and `canon init` starts a new project with every root that passes already listed. A config that does not parse refuses the audit with its path named.

Five measures report and never set the exit code on their own.

| Measure    | Reports                                                                              | Gate or report                         |
| ---------- | ------------------------------------------------------------------------------------ | -------------------------------------- |
| Bullets    | A bullet past 200 characters                                                         | Gates through the density length       |
| Paragraphs | A paragraph past 4 sentences or 350 characters                                       | Gates through the density length       |
| Cadence    | 3 or more sentences with a spread of 5 words or under, or a word opening more than 2 | Reports                                |
| Depth      | A run past about 40 rendered lines at 80 columns                                     | Reports                                |
| Length     | A document past 300 rendered lines, unless it carries `canon-length-exempt`          | Reports, and the gate owns the verdict |

| Code | Meaning                                                            |
| ---- | ------------------------------------------------------------------ |
| `0`  | No gating finding                                                  |
| `1`  | Refused, with the reason on stderr                                 |
| `2`  | A ban, a dead link, or a gating density or reference shape finding |
| `3`  | The shipped ban set is empty, so nothing was measured              |

Rewrite the sentence on a ban hit rather than swapping the token. A code span clears the report only where the token is an identifier under discussion.

The audit runs in four places:

- `.claude/hooks/standards-audit.sh` after each markdown edit, handing back every finding
- The `Markdown` stage of `canon gate run`, over the whole corpus
- `scripts/verify.ts` in a scaffolded project, excluding `CHANGELOG.md` and skipping with a logged line when no `canon` is on `PATH`
- The seeded hook in a target

## Refusals

- `no-git` or `no-markdown`: no corpus can be built, and the gate reads it as unmeasured

## See also

- `context-audit.md`: the folder-shaped findings
- `audits.md`: the aggregate that runs this audit
