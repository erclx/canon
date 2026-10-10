---
title: Architecture set
description: The five architecture views with each one's question, source signal, and diagram type, the code-scan fallback, cited paths, and what moves to canon/context/ instead, read by draft-figure when a request names an architecture view
---

# Architecture set

`draft-figure` reads this file when the request names an architecture view. It shapes the subject, then the figure goes through `${CLAUDE_SKILL_DIR}/references/mermaid-path.md` like any other graph-shaped figure. The destination stays the one the user named.

## The five views

Draw the view the request names. Each answers one question and is drawn from one source signal:

| View           | Question it answers                                     | Source signal                                     | Diagram type                         |
| -------------- | ------------------------------------------------------- | ------------------------------------------------- | ------------------------------------ |
| System context | Who uses the system, what it talks to, where it ends    | `canon/REQUIREMENTS.md`                           | `flowchart TB`                       |
| Components     | The layered structure inside the boundary               | `canon/context/index.md` and the folder layout    | `flowchart TB` with `subgraph` lanes |
| Request flow   | A request lifecycle, an agent loop, or an actor handoff | the entry point and its handlers                  | `sequenceDiagram`                    |
| Data pipeline  | Retrieval, ranking, queues, or ETL                      | the pipeline's modules                            | `flowchart TB`                       |
| Deployment     | Hosts, services, and infrastructure config              | deploy config, compose files, infrastructure code | `flowchart TB`                       |

System context is the only view that draws the world outside the boundary, and the one a reader outside the team opens first, so assume no knowledge of the repository there.

Stay inside `flowchart` and `sequenceDiagram`. C4, state, ER, and class diagrams render inconsistently across viewers.

## Sources

- Read `canon/REQUIREMENTS.md`, `canon/context/index.md`, `CLAUDE.md`, and the language manifest (`package.json`, `pyproject.toml`, `Cargo.toml`) when present, plus the top-level folder layout through `ls`. Do not recurse speculatively.
- When neither planning file exists and no folder structure names a boundary, stop: `❌ No source signal for <view>. Add canon/REQUIREMENTS.md or run inside a project folder.`
- When the view came from a code scan rather than planning prose, open the caption with `Source: code.` and add `Fidelity is lower than prose-driven figures. Verify against the project's intent.`

## Caption and prose

- Name one or two code paths a reader can open, in the caption or the prose beside the figure. Cite only paths that exist and spell each one exactly, since a reader deciding whether the figure still holds starts by opening them.
- Keep implementation detail out of the figure: function names and call signatures, library versions, config keys and environment variable names, retry counts and timeouts, and workarounds needing more than a sentence. That detail belongs in a `canon/context/` entry, which the caption points at by path when a reader needs the mechanism.
