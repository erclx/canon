---
title: Records validate
description: Validating the session records, the per-kind checks, which root they default to, the exit codes, and the refusal reasons
---

# Records validate

`canon records validate <kind>` reports where a file and the standard governing it disagree. Four kinds exist, each a gitignored folder under the record root resolved at `.canon/` first: `plans`, `groundwork`, `intake`, and `teach`.

```bash
canon records validate plans
canon records validate intake --json
```

| Option          | Behavior                                      |
| --------------- | --------------------------------------------- |
| `--json`        | Add a machine-readable record on stdout       |
| `--root <path>` | Project root, defaulting to the main worktree |

It reads and never writes. A session record is per-machine scratch with no history behind it, so a repair that guessed wrong could not be undone.

Nothing fires it automatically. The four record folders are gitignored, so the standards-audit hook exits early on them and any check reading changed files from git never lists one. The verb runs at the moment a session claims the record is finished, which is the same placement `canon tasks validate` takes over the board.

The two record roots every kind resolves at are in `records.md`.

## What each kind checks

| Kind         | What it reports                                                                                                                                                                                                                                                                                                                                   |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `plans`      | A filename that is not `feature-<slug>.md`, a missing `# Feature:` heading, a missing required section, a files-to-touch entry naming no file or saying nothing about one, a question carrying no suggestion or no answer slot, and a batch still staged with a `**Batch N**` sub-heading inside the one file rather than split into its own plan |
| `groundwork` | A track with no `README.md` or no `01-current-state.md`, a file missing `title` or `description`, a `README.md` with no `date` as `YYYY-MM-DD`, an unnumbered file, and a track holding a decision without its handoff or the reverse                                                                                                             |
| `intake`     | A dump with no `00-overview.md`, the same frontmatter and numbering checks, an item missing any of `Problem`, `Fix`, `Worth it`, or `You`, and an item carrying `Open` with no `Suggested`                                                                                                                                                        |
| `teach`      | A workspace folder carrying no two-digit ordinal, an absent `MISSION.md`, `RESOURCES.md`, or `GLOSSARY.md`, a file missing `title` or `description`, a mission with no `date` as `YYYY-MM-DD` or no `## Success looks like` section, an unnumbered learning record, and a reference page opening with an ordinal                                  |

The half-closed track is the groundwork check a reader cannot run by eye. A folder holding `06` without `07` reads as closed to anyone scanning filenames while the file a returning session actually opens is absent.

The item check skips `00-overview.md` and `99-next-session.md`, since neither holds items and running it over the handoff would report every heading it carries.

A plan section opens as a bold label or as an H2 and the check counts both, naming the reference's spelling when it reports one missing. Plans split roughly four to one between the two forms, so failing the variant would report nearly every plan on a rule that costs a reader nothing.

A section runs to the next marker-shaped line whatever it names, so a plan carrying a label of its own closes the section above it rather than collecting into it. Fenced blocks are dropped before any of this, since a plan showing the shape it writes puts real-looking bullets and headings inside a fence.

## Exit codes and refusals

Exit codes: `0` every check passed, `1` refused, `2` at least one record carries a finding. A `reason` field carries which gate fired: `no-folder` when none of the kind's directories exist, and `unknown-kind` when the argument names no published kind. A `no-folder` message names every candidate, so a refusal names both record roots.

An exit code says nothing about a call made from a session, since a shell profile may wrap the binary in a function taking its status from a later command. Read the record's `findings` array and its `reason` rather than the exit when a skill consumes this.

The four record folders are shared scratch at the main worktree root, so `--root` defaults to the first entry of `git worktree list` rather than the working directory. A linked worktree validates the same records every other session reads.

Skills branch on the findings rather than on the exit code:

```bash
canon records validate plans --json | jq -r '.findings[] | "\(.kind): \(.subject)"'
```

For the shapes each check enforces, see `claude/skills/plan-feature/references/plan.md`, `claude/skills/plan-groundwork/references/groundwork.md`, and `claude/skills/plan-intake/references/intake.md`.
