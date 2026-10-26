---
title: Target migrations by hand
description: One-time moves and keep-or-delete calls a person makes by hand, which no canon migrate verb runs or detects
category: Agent surface
---

# Target migrations by hand

Each section is a move a project scaffolded before the change it names makes by hand, since no `canon migrate` verb runs it and `canon migrate status` never lists it. The moves a verb runs, and the order to run them in, are in [target migrations](migrations.md).

## Back records up off this machine, once

Run `canon records push` once a private repository exists. It prints the one-time setup command when it finds none, and `canon init` prints the same reminder.

## Rename the pull request template headings, once

The template headings are now `## Key changes` and `## Technical context`, and `canon labels scan` compares case exactly. Rename them in `.github/pull_request_template.md`, or delete it and run `canon tooling sync base . --write`.

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
| `plan-ready`      | `ready` <!-- canon-keep-retired -->                           |
| `write-doc`       | `requirements`, `wiki`                                        |
| `session-map`     | `session`                                                     |

The `standard` name became `skill-reference.md` in `create-skill`.

## Keep or delete the wireframes folder, your call

The wireframes record is retired, and nothing deletes what a project holds.

- `canon/wireframes/` stays yours and unaudited. Keep it as notes or delete it.
- Delete the `@canon/wireframes/index.md` line in your `CLAUDE.md` with the folder. `canon claude sync` does not rewrite it.
- `canon gov sync` removes `.claude/rules/canon/standards/wireframes.md`

## Keep or delete the retired product files, your call

The learning workspace, deck renderer, app recorder, canvas, and design install are retired with their verbs, and nothing deletes what a project holds.

- `.canon/teach/` holds HTML that opens as it is <!-- canon-keep-retired -->
- `.canon/slides/` and a `demos/` folder hold sources nothing renders any more, so delete them once nothing cites them <!-- canon-keep-retired -->
- Move the `.claude/design/project/` values, `fonts/`, and `fonts.css` to the stylesheet your `canon/DESIGN.md` lead names, then delete `.claude/design/`

A reference to a retired skill takes a hand edit.

- Replace a `canon:teach-workspace` reference with `canon:teach-craft` by hand, since `canon migrate skill-names` does not rewrite it <!-- canon-keep-retired -->
- Delete a `canon:make-deck`, `canon:script-screencast`, `canon:record-screencast`, `canon:read-frames`, or `canon:video-craft` reference, since none has a successor <!-- canon-keep-retired -->
- Delete a `canon:canvas-board` reference too. Frameboard, which `canon:design-pick` drives, reads each `.canon/canvas/` folder as a project, so move a kept page under one <!-- canon-keep-retired -->

## Move decisions out of a held architecture record, once

The toolkit no longer seeds `canon/ARCHITECTURE.md`, and a held file and its `CLAUDE.md` import stay. Move a trap a session would hit into that domain's `## Gotchas`, then delete the file and its `@canon/ARCHITECTURE.md` line.

## Move the capture cases out of the harness, once

A web project's `e2e/screenshot.ts` is a config. It now loads `CASES` from a seeded `e2e/capture/cases.ts` that sync copies once and never overwrites. A harness you edited is held on `--write`, so the new one lands only once you pass `--replace e2e/screenshot.ts`.

- Copy your cases from the old `e2e/screenshot.ts` into `e2e/capture/cases.ts`, then sync with `--replace e2e/screenshot.ts`.
- Evidence now defaults to `e2e/evidence/`. Set `export const EVIDENCE_ROOT = 'evidence'` in `e2e/capture/cases.ts` to keep a committed baseline at the old path.
- A run from a folder with no `e2e/capture/cases.ts` exits 1 and names the file.

## Fold the ui rules onto one pointer, once

Eleven ui rules moved unchanged into the `ui-craft` skill, being `a11y`, `keyboard`, `pointer`, `forms`, `motion`, `ux-controls`, `ux-completeness`, `surface-capture`, `copy`, `interface-casing`, and `link-behavior`. Update the plugin, then sync, which folds each one you hold and `design-taste.md` onto one `craft.md` pointer without local edits.

```bash
canon gov sync .
```

## Group a long paths section in `CLAUDE.md`, once

The `## Key paths` section of `CLAUDE.md` now keeps to 5 bullets in a row, and every other section stays exempt. `canon claude sync` never rewrites a `CLAUDE.md` you hold, so it warns with the line of each longer run.

- Regroup the section by hand under H3s, each opening on a one-sentence lead.
- List `CLAUDE.md` in `canon/config/markdown.toml` to gate it from then on.
