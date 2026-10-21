---
title: Target migrations
description: One-time moves a project scaffolded under an older toolkit runs before its next sync
category: Agent surface
---

# Target migrations

Each section is a move a project runs once, when it was scaffolded before the change it names. Run `canon upgrade` first, then `canon migrate status --json` to list the moves a project still needs in the order to run them. The recurring sync that follows is in [target sync](sync.md).

`canon:target-update` is the guided path through both. It runs the moves in that order once you approve its preview.

## Move the records first, once

Gitignored session records, being the task board, plans, review reports, and scratch, moved from `.claude/` to `.canon/`. Run these from inside the project, and read the `ok` field of the `--json` record rather than the exit code.

```bash
canon tooling sync claude . --write
canon migrate records --json
canon migrate records --write --json
```

The first line takes the `.canon/` ignore entry the verb requires. The second reports the plan and the third applies it, repointing every tracked file that cites a moved folder. A line naming an old record path on purpose keeps it with `canon-keep-record-root` on that line or the nearest non-blank line above.

Then sweep the citations inside the records, which the verb above never reaches.

```bash
canon migrate record-tree --json
canon migrate record-tree --write --json
```

It covers `diagrams`, `memory`, `plans`, `proposals`, `review`, `tasks`, and `teach`. Read the report before `--write`. The record tree is untracked, and a wrong rewrite has no undo.

## Back records up off this machine, once

Run `canon records push` once a private repository exists. It prints the one-time setup command when it finds none, and `canon init` prints the same reminder.

## Move rules off the flat layout, once

Installed rules moved from `.claude/rules/<subdir>/` to `.claude/rules/canon/<subdir>/`. On the flat layout `canon gov sync` exits 0 reporting `No governance surfaces found in target`, and `canon gov install` lands a second copy.

```bash
canon migrate rule-layout --json
canon migrate rule-layout --write --json
```

Run it once, ahead of `canon gov sync` or `canon gov install`.

## Rename the skill citations, once

Plugin skills dropped their `claude-` prefix, so `canon:claude-docs` answers as `canon:context-fold` and `canon:claude-tasks` as `canon:task-board`. The five per-kind drafters merged into `write-doc`, and no pointer under an old name ships. <!-- canon-keep-retired -->

The seven `draft-` skills took verb-first names for what each makes. `canon migrate skill-names --write` carries a project across, and a pointer under each old name answers a typed invocation until it retires.

| Old name           | New name                                        |
| ------------------ | ----------------------------------------------- |
| `draft-doc`        | `write-doc` <!-- canon-keep-retired -->         |
| `draft-figure`     | `draw-figure` <!-- canon-keep-retired -->       |
| `draft-identity`   | `design-identity` <!-- canon-keep-retired -->   |
| `draft-slides`     | `make-deck` <!-- canon-keep-retired -->         |
| `draft-and-pick`   | `pick-by-eye` <!-- canon-keep-retired -->       |
| `draft-ready`      | `plan-ready` <!-- canon-keep-retired -->        |
| `draft-screencast` | `script-screencast` <!-- canon-keep-retired --> |

- `canvas` is now `canvas-board`. The sweep rewrites only `canon:canvas` and `skills/canvas`, so replace a bare prose mention by hand. <!-- canon-keep-retired -->
- `draft-ready` is rewritten only as `canon:draft-ready` and `skills/draft-ready`, since bare it also describes a pull request. Replace a bare mention of the skill by hand. <!-- canon-keep-retired -->
- `design-extract` and `sketch-design` are replaced by `canon:canvas-board`. <!-- canon-keep-retired -->
- `review-branch`, `seed-sync`, `restate-plainly`, `bash-cli-script`, `canon-operator`, and `canon-rollout` have no successor <!-- canon-keep-retired -->
- `create-standard`, `markdown-propose`, `memory-review`, `project-commands`, `repo-metadata`, and `ux-walkthrough` have no successor <!-- canon-keep-retired -->

Replace a citation of a skill with no successor by hand, or delete the sentence.

- `canon repo metadata`, `canon autoship`, and the `120-bash` rule are gone, and `canon gov sync` removes the rule <!-- canon-keep-retired -->
- `memory-capture`, the `603-memory` rule, and the `memory` standard are gone, so send a lesson to the context entry that owns the fact <!-- canon-keep-retired -->

The `memory` record kind left `canon records`, so `canon records validate memory` refuses as an unknown kind and `canon records migrate` is gone.

Two held files run, `.husky/post-merge` and `.claude/hooks/pr-create-log.sh`, and a stale copy calls a missing binary or names a removed skill. Resync what the toolkit owns before sweeping what the project wrote, and run the second line once per stack.

```bash
canon gov sync
canon tooling sync <stack> . --write
canon migrate skill-names --json
canon migrate skill-names --write --json
```

## Rename the pull request template headings, once

The template headings are now `## Key changes` and `## Technical context`, and `canon labels scan` compares case exactly. Rename them in `.github/pull_request_template.md`, or delete it and run `canon tooling sync base . --write`.

## Move the surfaces off `.claude/`, once

`context/`, `wireframes/`, `ARCHITECTURE.md`, `REQUIREMENTS.md`, `DESIGN.md`, and the install stamp folder, now `canon/config/`, moved under `canon/`. `rules/`, `skills/`, `hooks/`, and `settings.json` stay where Claude Code reads them.

```bash
canon migrate surface-roots --json
canon migrate surface-roots --write --json
```

It moves each surface with `git mv` and repoints every tracked citation. No other command notices a surface left at `.claude/`.

## Delete the retired snippets, once

A project scaffolded while snippets installed may hold `.claude/snippets/` or a root `snippets/`.

```bash
canon sync --check . --json | jq '.reverse'
```

- `dropped` is the toolkit's copy, unchanged, so delete it
- `unattributed` is often an edited copy, so read what changed first
- `project` is the project's own content, so leave it

From the registry the walk reports `historyUnavailable`, so check both paths by hand.

## Stop calling the standards verb, once

`canon standards <name>` is gone, and a call now fails with a too-many-arguments error. Replace each call with the skill that owns the standard, at `references/<name>.md`. <!-- canon-allow-reference: verb retired -->

| Skill             | Standards                                                     |
| ----------------- | ------------------------------------------------------------- |
| `task-board`      | `board`, `tasks`, `tasks-decline`                             |
| `context-fold`    | `context`                                                     |
| `canvas-board`    | `canvas`, `design` <!-- canon-keep-retired -->                |
| `docs-sync`       | `docs`, `readme`                                              |
| `draw-figure`     | `figures`, `mermaid`                                          |
| `create-rule`     | `rule`                                                        |
| `create-skill`    | `skill`, `skill-paths`, `skill-practice`, `skill-requirement` |
| `git-branch`      | `branch`, `slug`                                              |
| `git-commit`      | `commit`, `versioning`                                        |
| `git-pr`          | `pr`, `publish`                                               |
| `markdown-craft`  | `markdown`                                                    |
| `teach-workspace` | `glossary`, `teach` <!-- canon-keep-retired -->               |
| `plan-groundwork` | `groundwork`, `groundwork-spikes`                             |
| `plan-intake`     | `intake`                                                      |
| `plan-feature`    | `plan`, `plan-lifecycle`                                      |
| `plan-ready`      | `ready`                                                       |
| `write-doc`       | `requirements`, `wiki`                                        |
| `session-map`     | `session`                                                     |

The `standard` name became `skill-reference.md` in `create-skill`.

## Keep or delete the wireframes folder, your call

The wireframes record is retired, and nothing deletes what a project holds.

- `canon/wireframes/` stays yours and unaudited. Keep it as notes or delete it.
- Delete the `@canon/wireframes/index.md` line in your `CLAUDE.md` with the folder. `canon claude sync` does not rewrite it.
- `canon gov sync` removes `.claude/rules/canon/standards/wireframes.md`

## Keep or delete the retired product files, your call

The learning workspace, the deck renderer, the app recorder, and the canvas are retired with their verbs and skills, and nothing deletes what a project holds.

- `.canon/teach/` holds rendered HTML that opens as it is, so it needs nothing <!-- canon-keep-retired -->
- `.canon/slides/` and a `demos/` folder hold sources nothing renders any more, so delete them once nothing cites them <!-- canon-keep-retired -->
- Replace a `canon:teach-workspace` reference with `canon:teach-craft` by hand, since `canon migrate skill-names` does not rewrite it <!-- canon-keep-retired -->
- Delete a `canon:make-deck`, `canon:script-screencast`, `canon:record-screencast`, `canon:read-frames`, or `canon:video-craft` reference, since none has a successor <!-- canon-keep-retired -->
- Delete a `canon:canvas-board` reference too. Frameboard, which `canon:pick-by-eye` drives, reads each `.canon/canvas/` folder as a project, so move a kept page under one <!-- canon-keep-retired -->

## Move the design install into your own stylesheet, once

The design install, sync, fonts, and render verbs are retired, and `canon sync` no longer reports a `design` domain. A held `.claude/design/` stops showing drift, and nothing deletes it. <!-- canon-keep-retired -->

- Move each value under `.claude/design/project/` into the stylesheet your app loads, faces in `project/fonts/` included
- Name that stylesheet in the lead of `canon/DESIGN.md`, the way `canon:design-record` writes it
- Delete `.claude/design/` once nothing imports `base.css` or a file under `project/`
- A stamp from an older sync still carries a `design` entry, which `canon sync --check` ignores and the next sync drops

## Move decisions out of a held architecture record, once

The toolkit no longer seeds `canon/ARCHITECTURE.md`, and a held file and its `CLAUDE.md` import stay. Move a trap a session would hit into that domain's `## Gotchas`, then delete the file and its `@canon/ARCHITECTURE.md` line.

## Deny subagents and merges, and turn auto memory off, once

The seeded `.claude/settings.json` now denies the `Agent` and `Task` tools and both merge commands, and sets `autoMemoryEnabled` to `false`. `canon claude sync` never rewrites a settings file you hold, so it warns while the file holds no default or lacks a merge entry. Removing `Agent` and `Task` later draws no warning.

```bash
canon migrate session-defaults --json
canon migrate session-defaults --write --json
```

The verb only adds a key that is absent. A person who wants auto memory back sets it in their own `.claude/settings.local.json`.

The verb adds `Bash(canon pr merge:*)` and `Bash(gh pr merge:*)` so a session cannot merge. A project migrated before them runs `--write` once more, which also restores `Agent` and `Task` for a person who removed them to allow subagents, so remove them again after.

## Move the capture cases out of the harness, once

A web project's `e2e/screenshot.ts` is a config, so sync overwrites it. It now loads `CASES` from a seeded `e2e/capture/cases.ts` that sync copies once and never overwrites. Cases edited in the old harness leave the working tree on the first sync and stay in git history.

- Copy your cases from the old `e2e/screenshot.ts` into `e2e/capture/cases.ts` before the next sync.
- Evidence now defaults to `e2e/evidence/`. Set `export const EVIDENCE_ROOT = 'evidence'` in `e2e/capture/cases.ts` to keep a committed baseline at the old path.
- A run from a folder with no `e2e/capture/cases.ts` exits 1 and names the file.

## Add the keyboard rule beside a held a11y rule, once

The `a11y` rule split in two. Focus styles, Escape and shortcuts, composite widgets, focus management, and pointer target size moved to a new `keyboard` rule. `canon gov sync` refreshes only the rules a project holds, so it rewrites `a11y.md` without those bullets and never adds `keyboard.md`.

A project holding `.claude/rules/canon/ui/a11y.md` adds the new rule alone:

```bash
canon gov install --add keyboard --yes .
```

## Group a long paths section in `CLAUDE.md`, once

The `## Key paths` section of `CLAUDE.md` now keeps to 5 bullets in a row, and every other section stays exempt. `canon claude sync` never rewrites a `CLAUDE.md` you hold, so it warns with the line of each longer run.

- Regroup the section by hand under H3s, each opening on a one-sentence lead.
- List `CLAUDE.md` in `canon/config/markdown.toml` to gate it from then on.
