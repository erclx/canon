---
title: Markdown audit density
description: The six layout limits the markdown audit measures, what each one counts, which paths take a finding, and how a folder's gate turns on
---

# Markdown audit density

`canon markdown audit` measures six layout limits beside its bans. Each one is a count against a fixed number, so a finding is a fact rather than a judgment, and a gated path fails the run on it.

## The limits

Six limits report on the paths that take them, under `density` in each `--json` entry.

| Limit               | Finding                                                    |
| ------------------- | ---------------------------------------------------------- |
| Paragraph length    | a prose paragraph past 350 characters                      |
| Paragraphs in a row | more than 2 paragraphs with nothing else between them      |
| Bullet length       | a top-level bullet past 200 characters, marker excluded    |
| Bullets in a row    | more than 5 plain top-level bullets                        |
| Heading depth       | any heading past H3                                        |
| H3 opening          | an H3 whose first block is neither a paragraph nor a table |

## What counts as a block

A paragraph indented under a list item counts toward that bullet's length and never as a paragraph. A table, a fence, a list, a heading, and a bold section marker each break a paragraph run. Each finding carries `kind`, `line`, `value`, `limit`, and `gating`, and the H3 opening carries `null` for both numbers.

## Which paths take a finding

Only context entries, docs pages, skill bodies and references, tooling seeds and stack references, the wiki, `README.md`, and `CONTRIBUTING.md` take a finding. A rule, `CLAUDE.md`, a requirement or design record, the changelog, `examples/`, and every `.canon/` record take none, so a plan never reports one.

## When a finding gates

A finding gates when its path sits under a prefix in `GATED_PATHS` in `src/markdown/scope.ts`, and each rewrite batch adds its folders there at zero, or one file per entry where it covers part of a folder. A run of more than 5 plain bullets gates in context, docs, and skills from the start, since it failed the push there before this measure existed.

Outside a canon checkout every density finding reports and none gates, since the list describes this repository's own rewrite.

## What reads the finding

A gating finding sets exit `2`, the same code a ban hit takes, and `markdown-audit.md` carries the full exit contract. The `Markdown` stage of `canon gate run` reads that exit over the whole corpus, and the edit-time hook hands every finding back, gating or not.
