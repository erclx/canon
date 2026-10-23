---
title: Context audit
description: Running the context audit, its folder scope, the exit codes, every check with the folders it reaches and whether it gates, the seed gate, and the citation exclusions
kind: reference
---

# Context audit

`canon context audit [path]` reports the structure of the folders following the index-plus-entry contract, meaning a generated `index.md` beside entries carrying frontmatter, and measures `canon/REQUIREMENTS.md` beside them. It reads and reports. Findings over every markdown file belong to `canon markdown audit`, in `markdown-audit.md`.

```bash
canon context audit
canon context audit --json
canon context audit --citations-only
canon context audit --folder context,diagrams
canon context audit tooling/base/seeds --gate
```

`--gate` widens the failing set to the findings marked below. `--citations-only` runs the citation check alone, and the two refuse together.

`--folder` takes comma-separated names, defaulting to `context`, `decisions`, and `diagrams`. A folder the project lacks is skipped, and `folders[].base` names where each resolved.

## Output

| Check               | Reports                                                                                                                 | Reaches                 | Finding                                                     |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------- | ----------------------- | ----------------------------------------------------------- |
| Citations           | A path into an audited folder that resolves nowhere                                                                     | Every audited folder    | Gates always                                                |
| Requirements record | Words past the cap the record states as `This record holds at most 600 words.`                                          | `canon/REQUIREMENTS.md` | Gates past a stated cap, never under `--citations-only`     |
| Required sections   | An entry missing `Overview` or `Layout`. A split folder answers by any sibling                                          | `canon/context/`        | Gates under `--gate`                                        |
| Closed set          | An H2 outside `Overview`, `Layout`, and `Gotchas`, under `extraSections`                                                | `canon/context/`        | Gates under `--gate`                                        |
| Shape               | A break of the entry shape, in any kind listed under the table                                                          | `canon/context/`        | Gates under `--gate` in a `SHAPE_GATED_FOLDERS` folder only |
| Index drift         | An entry its index does not link, or a link resolving to nothing                                                        | Every audited folder    | Gates under `--gate`                                        |
| Coverage            | A folder directly under a code root no Layout names, a Layout H3 in two entries, or an unmatched root, under `coverage` | `canon/context/`        | Gates under `--gate`, never under `--citations-only`        |
| Reference form      | A backticked bare filename matching a sibling entry, under `bareReferences`                                             | Split folders           | Reports                                                     |
| Length              | An entry past about 150 rendered lines at 80 columns, with its `causes`                                                 | Every audited folder    | Reports                                                     |
| Tables              | Six or more body rows whose first column mostly carries a path, command, or link                                        | Every audited folder    | Reports                                                     |
| Provenance          | A date, change number, or release label. A date after measured, verified, driven, passed, or fired is excluded          | `canon/context/`        | Reports                                                     |

The coverage roots come from `roots` in `canon/config/context.toml`, a list of folders or globs such as `packages/*/src`.

- Without the file the root defaults to `src` when that folder exists, and `roots = []` opts out
- A file that is not valid TOML, or holds no list of strings under `roots`, gates under `--gate`
- With no declaration and no `src/`, the audit reports no code root and never gates

The shape kinds are `retired-section`, `gotcha-count`, `gotcha-heading`, `gotcha-paragraph`, `layout-heading`, `layout-bullets`, `layout-paragraphs`, and `layout-depth`. A shape break is any of these:

- A `## Decisions` H2, or a `Gotchas` section past five bullets or holding a heading or paragraph
- A `Layout` H3 titled neither a code-spanned path nor `Other folders`, or a heading below H3 under `Layout`
- A folder H3 past five bullets or its one-paragraph lead

The development entry may carry a `Scripts` H3 exempt from both folder caps. `SHAPE_GATED_FOLDERS` lives in `src/context/shape-gated.ts`.

| Code | Meaning                                    |
| ---- | ------------------------------------------ |
| `0`  | A clean run, or findings that report       |
| `1`  | Refused, with the reason on stderr         |
| `2`  | A gating finding for the mode the run took |

The exit code follows the mode the run took. The bullets cover where the gate runs, what refuses, and how a seed opts out.

- `bun run check` runs `--gate` against every `tooling/<stack>/seeds/` directory carrying a `.claude/` folder
- A root resolving no audited folder refuses with `1` and warns, a root measuring no entry warns, and a seed short a section fails with `2`
- A seed omitting a required section on purpose sets `stub: true` in its frontmatter. Only the value `true` counts, and both install paths strip the field.

The citation check skips fenced blocks, fixture and harness trees including `*.test.ts`, and a path into a folder the project lacks.

Append `<!-- audit-ignore-citations: <path> -->` to a line that displays a path without pointing at it. The marker excuses only the paths it names, and a bare `<!-- audit-ignore-citations -->` excuses every citation on the line. In seeds, plugin skill bodies, and stack references, which install into a target, reword the line instead.

## Refusals

- No requested `--folder` name resolves, with the names under `unresolvedFolders`
- `--citations-only` together with `--gate`
- `--citations-only` over folders that all resolved at the project root, which is out of scope

## See also

- `markdown-audit.md`: depth and bullet weight, which this audit no longer measures
- `audits.md`: the aggregate that runs this audit
