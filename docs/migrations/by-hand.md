---
title: Target migrations by hand
description: One-time moves a person makes by hand, which no canon migrate verb runs or detects
category: Agent surface
---

# Target migrations by hand

Each section is a move a project scaffolded before the change it names makes by hand, since no `canon migrate` verb runs it and `canon migrate status` never lists it. The moves a verb runs, and the order to run them in, are in [target migrations by verb](by-verb.md). A retired file you choose to keep or delete is in [keep or delete](keep-or-delete.md).

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

## Move decisions out of a held architecture record, once

The toolkit no longer seeds `canon/ARCHITECTURE.md`, and a held file and its `CLAUDE.md` import stay. Move a trap a session would hit into that domain's `## Gotchas`, then delete the file and its `@canon/ARCHITECTURE.md` line.

## Move the capture cases out of the harness, once

A web project's `e2e/screenshot.ts` is a config. It now loads `CASES` from a seeded `e2e/capture/cases.ts` that sync copies once and never overwrites. A harness you edited is held on `--write`, so the new one lands only once you pass `--replace e2e/screenshot.ts`.

- Copy your cases from the old `e2e/screenshot.ts` into `e2e/capture/cases.ts`, then sync with `--replace e2e/screenshot.ts`.
- Evidence now defaults to `e2e/evidence/`. Set `export const EVIDENCE_ROOT = 'evidence'` in `e2e/capture/cases.ts` to keep a committed baseline at the old path.
- A run from a folder holding neither `e2e/capture/cases.ts` nor a file under `e2e/capture/cases/` exits 1 and names both.

## Drop the 320 stills and move the README frame, once

A web project's capture harness now commits evidence at 390, 768, and 1280. It writes nothing at 320, and checks every case there for sideways scroll and clipped controls instead.

The README script writes its frame under `<EVIDENCE_ROOT>/readme/` in place of `assets/evidence/readme/`. The web stack no longer ships the script or its workflow, so a copy you hold takes the change by hand.

- Delete each committed `320--<theme>.png` under your `EVIDENCE_ROOT`, since no run rewrites or removes it, and commit the 390 and 768 frames the next capture writes.
- Fix a page the run now fails at 320, or name `'320'` in that case's `excludeViewports` to defer the check. An `excludeViewports` name no width carries is warned on and ignored.
- Merge the `README_EVIDENCE_DIR` default and the `GITHUB_OUTPUT` lines into your `scripts/readme-screenshot.sh`, since the workflow fails while the script hands it no `dir`.
- Point the README's `srcset` at `<EVIDENCE_ROOT>/readme/`, then delete `assets/evidence/readme/`. The README shows a broken image until you do.
- Give `RELEASE_PLEASE_TOKEN` Contents write, so the README refresh's push starts the required checks. Without the secret the workflow falls back to the default token, whose push starts none.

## Fold the ui rules onto one pointer, once

Eleven ui rules moved unchanged into the `ui-craft` skill, being `a11y`, `keyboard`, `pointer`, `forms`, `motion`, `ux-controls`, `ux-completeness`, `surface-capture`, `copy`, `interface-casing`, and `link-behavior`. Update the plugin, then sync, which folds each one you hold and `design-taste.md` onto one `craft.md` pointer without local edits.

```bash
canon gov sync .
```

## Group a long paths section in `CLAUDE.md`, once

The `## Key paths` section of `CLAUDE.md` now keeps to 5 bullets in a row, and every other section stays exempt. `canon claude sync` never rewrites a `CLAUDE.md` you hold, so it warns with the line of each longer run.

- Regroup the section by hand under H3s, each opening on a one-sentence lead.
- List `CLAUDE.md` in `canon/config/markdown.toml` to gate it from then on.

## Rewrite relative imports in a python project, once

The python stack's `ruff.toml` now selects `TID`, so its `ban-relative-imports = "all"` takes effect and `TID252` fails each relative import on the next lint. A project synced before this change may hold some.

```bash
ruff check --select TID252 --fix --unsafe-fixes .
```

- Run it once after the next `canon tooling sync`, since ruff rewrites most relative imports to absolute ones
- Ruff marks this fix unsafe, so a bare `--fix` leaves it alone. Read the diff before committing.
- Rewrite by hand an import it leaves flagged

## Split a guide past 200 lines under `docs/`, once

The Document ceiling gate stage now holds every page under the root `docs/` to 200 rendered lines, so a guide between 201 and 300 that passed before fails the next gate.

```bash
canon markdown audit docs
```

- Split each page the Length step lists at a seam into a second page, and retarget every link into a moved section
- For a verbatim record, add a `<!-- canon-length-exempt: <reason> -->` line naming why instead
