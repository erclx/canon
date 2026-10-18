---
title: Code comments rule ledger
description: Sources for governance/rules/tooling/code-comments.md, one row per bullet
---

# Code comments rule ledger

The field is software engineering practice for source comments, which has no spec. The authorities are the published style guides of large codebases, here Google's guides for Python, C++, TypeScript, JavaScript, and shell, read as practice from one large codebase rather than as a settlement of the field.

## When a comment should exist

| Bullet                                   | Source                                                                                                                                                                                                                                             | Read       |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| Only a fact the code cannot carry        | [Google Python Style Guide](https://google.github.io/styleguide/pyguide.html): "The final place to have comments is in tricky parts of the code. If you're going to have to explain it at the next code review, you should comment it now."        | 2026-10-18 |
| Do not restate the line                  | [Google Python Style Guide](https://google.github.io/styleguide/pyguide.html): "never describe the code. Assume the person reading the code knows Python (though not what you're trying to do) better than you do."                                | 2026-10-18 |
| No comment on a self-describing function | [Google TypeScript Style Guide](https://google.github.io/styleguide/tsguide.html): "Method, parameter, and return descriptions may be omitted if they are obvious from the rest of the method's JSDoc or from the method name and type signature." | 2026-10-18 |
| No comment moved to hit a density figure | House choice: a comment added to reach a figure restates the line beside it, and one deleted to reach it drops a contract the code cannot carry. No style guide states a density target to depart from.                                            | 2026-10-18 |

## What a comment may claim

| Bullet                                  | Source                                                                                                                                                                                                                                                                                                                        | Read       |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| True as written, updated in the change  | House choice: a comment describing behavior the code does not have, whether planned or since changed, reads as authoritative and misleads the next reader. Updating it in the same change puts both sides in front of one reviewer.                                                                                           | 2026-10-18 |
| Contract, not steps                     | [Google Python Style Guide](https://google.github.io/styleguide/pyguide.html): "The docstring should describe the function's calling syntax and its semantics, but generally not its implementation details, unless those details are relevant to how the function is to be used."                                            | 2026-10-18 |
| No person, ticket, or date in its place | House choice: a comment that only points at a person, a ticket, or a date tells the reader nothing once the person leaves or the ticket closes. Google's guides attach a bug or a name to a `TODO` beside its description, and the Python guide adds "Avoid adding TODOs that refer to an individual or team as the context". | 2026-10-18 |

## What never goes in a comment

| Bullet                    | Source                                                                                                                                                                                                                                                                                                                 | Read       |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| Delete commented-out code | House choice: commented-out code escapes the type checker and the tests, so it rots while reading as an option still open, and version control already keeps it                                                                                                                                                        | 2026-10-18 |
| No edit history           | House choice: a comment recording the edit that made the code goes stale at the next edit and duplicates what `git log` and `git blame` hold                                                                                                                                                                           | 2026-10-18 |
| No deferred work          | House choice: deferred work in a comment is work no tracker query finds, so nobody schedules it. [Google C++ Style Guide](https://google.github.io/styleguide/cppguide.html) asks for `TODO` comments carrying "the bug ID, name, e-mail address, or other identifier", which is Google's convention for its own code. | 2026-10-18 |

## Degradation vocabulary

| Bullet                         | Source                                                                                                                                                                                                                                                                                                                                                                                    | Read       |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| `TODO`, `FIXME`, `HACK`, `XXX` | House choice: each term marks deferred work or a known defect in a place no tracker query reaches. Google's guides depart, asking for a `TODO` with an owner or a bug link so it "can be searched to find out how to get more details" (Python guide). Google's guide governs Google's code rather than settling the field, so this rule keeps the ban and sends the work to the tracker. | 2026-10-18 |

## Declined

Every bullet the rewrite removed or reshaped, grouped by why.

### Merged or reworded

- Merged "Let comment density follow how much of a file's behavior is decided outside that file" into the density bullet as its reason. On its own it named no line a reviewer could check.
- Merged "State only what is true of the code as written" into the update bullet, which states the same requirement and adds when to meet it
