---
name: canon-cli
description: Reference for what a canon verb does before you run it. Run `canon docs agents` for the full command catalog, `canon docs` for any other reference doc, and read this skill's own table for what a sync or install command overwrites, merges, or leaves untouched in a target project. Use when asked "which canon command do I run", "is there a doc for X", "will this overwrite my changes", or before running `canon tooling`, `canon standards`, `canon claude sync`, or `canon init`. Do NOT use to execute a sync, an install, or a docs lookup, only to know which command answers the question.
---

# Toolkit CLI contract

Consult before running an unfamiliar `canon` verb, before a sync or install, or when asked "will this overwrite my changes". This skill is reference only. It never runs a sync or an install.

## Verb catalog and reference docs

- Run `canon docs agents` for the full command catalog and invocation contract, rather than guessing at a verb from its name.
- Run `canon docs list` for every other reference doc, then `canon docs <topic>` by name.
- State neither list here. Both read live off the CLI, and a copy in this body ships on a different cadence than the commands it names.

## Overwrite contract

| Surface                                                  | Command              | Effect on existing files                                                    |
| -------------------------------------------------------- | -------------------- | --------------------------------------------------------------------------- |
| Golden configs                                           | `canon tooling sync` | Overwritten once `--write` is passed. Local edits are lost.                 |
| Dictionary seeds (`.cspell/*.txt`)                       | `canon tooling sync` | Merged and sorted. Existing terms preserved.                                |
| Other seeds (`cspell.json`, `.lintstagedrc`, state docs) | `canon tooling sync` | Copy-once. Dropped on first install, untouched after.                       |
| Standards                                                | none                 | Nothing installs. `canon standards <name>` reads and never writes.          |
| Seed docs and `CLAUDE.md`                                | `canon claude init`  | Skipped when present. Never overwritten.                                    |
| Seed docs                                                | `canon claude sync`  | Never touched. Only `.gitignore` is written.                                |
| Stack references                                         | none                 | Nothing installs. `canon tooling reference <stack>` reads and never writes. |
| `.gitignore`, deps, scripts                              | any sync             | Additive. Existing entries preserved. Deps re-pin on major skew.            |
| Generated `index.md`                                     | any sync or regen    | Rewritten from target state. Hand edits are lost.                           |

## What a tooling sync can overwrite

A golden config is any file a stack ships under `configs/`, and the category is wider than its name suggests. It carries the CI workflow, the git hooks, the end-to-end harness, the shell scripts under `scripts/`, and the editor settings, alongside the linters and compilers a reader expects. A stack inherits its parent's configs, so syncing `astro` also writes everything `web` and `base` hold.

No list of those paths ships in this body, since a copy would go stale on a different cadence than the stacks. Run `canon tooling diff <stack> <target>` for the list resolved against a real target. It reports every path, writes nothing, and exits 1 when any differs. A binary older than that verb answers the same question through `canon tooling sync <stack> <target> --check`, which names each file it would replace.

## Rules

- `canon tooling sync` writes nothing until `--write` is passed. A headless run without it reports and exits 1, so a script that forgets the flag fails rather than silently skipping the sync.
- Run `--check` first when the project carries local edits to a config the stack ships. The report names each file it would replace, which is the warning the user needs before the write.
- An interactive run still prompts. `--write` skips the prompt, and `--check` refuses to write even with a TTY.
- Seeds are user-owned. Dictionary `.txt` files merge and sort. Other seeds are copy-once, so re-seeding a structured file means deleting it and syncing again.
- No command writes a standard into a project. A `.claude/standards/` folder from an older toolkit is inert, and deleting it costs nothing.
- For section-level customizations of a seed doc, use the `seed-sync` skill, not `canon ... sync`. It diffs per section and preserves edits.

## CLAUDE.md

- `CLAUDE.md` is a copy-once seed. No `canon` sync command ever updates it. Reconcile it with the `seed-sync` skill, which diffs the preamble and each section and preserves customizations by default.

## Source of truth

- Full semantics live in the toolkit's own context entries. This skill is the target-session summary. When they disagree, the context docs win.
