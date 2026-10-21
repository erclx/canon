---
title: Output shape
description: The framed output shape every command renders into, the JSON and color modes, the exit discipline, the runtime catalogs, and a headless invocation per domain
---

# Output shape

Data goes to stdout. UI and logs go to stderr. Help is the exception and prints to stdout so it can be piped.

## Frame

```plaintext
┌
│ canon <domain>
│
├ Section
│ ✓ item
└
```

- `┌` opens the frame, `│ canon <domain>` is the banner, and `├ Section` groups items
- `└` closes the frame on stderr
- An error renders as `│ ✗ message` inside the frame, never as a lone line
- Help skips the banner and puts `Usage:` directly on `├`
- A stderr that is not a terminal gets plain lines instead, with the banner and section titles bare and each item behind its mark alone

A help request naming an unknown subcommand, under a group taking no operand, writes its refusal to stderr and exits 1.

## JSON and names modes

`--json` and `--names` keep stdout pure data. A `--json` run writes no progress to stderr, only its warnings and errors, since diagnostics reach stderr in every mode. A JSON refusal carries an action and a reason, so branch on the record rather than on stderr.

A shell profile may wrap `canon` in a function that takes its status from a later command. Where a verb documents a record field, read the field rather than the exit.

## Color

Escape sequences reach a destination that renders them and nowhere else, decided per stream. `NO_COLOR` set to any non-empty value turns color off, and so does a destination that is not a terminal. The `✓ ! + - ✗` marks survive both. The frame glyphs need a terminal.

## Exit discipline

A command action sets `process.exitCode` and returns. Calling `process.exit()` in an action truncates piped output at the 64K buffer. A file redirect hides the truncation, so test through a pipe.

## Runtime catalogs

Discover names at runtime rather than hardcoding them.

| Command                           | Returns                                                          |
| --------------------------------- | ---------------------------------------------------------------- |
| `canon tooling list --json`       | Stacks, extends chain, dep and script counts                     |
| `canon gov list --json`           | Governance stacks, rule sets, evidence, and unreferenced rules   |
| `canon gov detect --json`         | Opt-in rules a target's dependencies and paths propose           |
| `canon claude seeds list --json`  | Seed doc sources with content                                    |
| `canon claude skills list --json` | Plugin skills, descriptions, requirement flag, family vocabulary |
| `canon docs list --json`          | Consumer docs plus per-domain context                            |
| `canon audits list --json`        | Audits the set runs, the corpus each reads, and whether it gates |

- `gov list` expands each stack to its rules and carries `unreferenced`, the rules no stack reaches, which install only through `--add`
- `claude skills list` reports shipped skills only. Each carries `family` (or `null`) and `requirement`, and a `false` requirement is a gap to close. `--names` and `--by-family` change the render.
- A skill with unparseable frontmatter returns an empty description rather than failing the listing

## Headless invocation

A call with no terminal on stdin is headless and needs no prefix. Each prompt takes its documented default or refuses and names the flag to pass.

```bash
canon init --stack node --skip records /path/to/project
canon sync /path/to/project
canon gov install node --add astro,shadcn /path/to/project
canon gov sync /path/to/project
canon gov build /path/to/project
canon tooling diff astro /path/to/project
canon tooling sync astro /path/to/project --write
canon tooling inject base /path/to/project --configs --seeds
canon tooling prune-gitignore base /path/to/project
canon tooling verify vite-react
canon audits run --json
canon secrets scan --json
canon deps audit --json
```

- `canon tooling sync` needs `--check` or `--write` headlessly. With neither it reports and exits 1.
- `--skip base` syncs a monorepo subtree without the layer the root owns
- `canon audits run` exits 2 on a fact and 3 for an audit that did not report
- `secrets scan` and `deps audit` exit 2 on findings. Only a credential fails `audits run`, and an advisory reports without moving the verdict.
- Both refuse with a `reason` when they have no corpus, `no-manifest` for the scan and `no-lockfile` for the audit
