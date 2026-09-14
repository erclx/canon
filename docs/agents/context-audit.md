---
title: Context audit
description: Running the audit, its flags and folder scope, the exit codes, the citation gate, and the widened gate the seed stage runs
---

# Context audit

`canon context audit [path]` reports the structural state of the folders following the index-plus-entry contract, meaning a generated `index.md` beside entries carrying frontmatter, and it measures `canon/ARCHITECTURE.md` beside them. It reads and reports. Fixing what it finds is separate work. What each finding means is in `context-audit-checks.md`.

Findings stated over every markdown file rather than over a context entry are measured by `canon markdown audit`, described in `markdown-audit.md`. That command resolves no folder, so it reaches trees this one refuses.

```bash
canon context audit
canon context audit --json
canon context audit --citations-only
canon context audit --folder context,diagrams
canon context audit --folder docs
canon context audit tooling/base/seeds --gate
```

| Option             | Behavior                                                             |
| ------------------ | -------------------------------------------------------------------- |
| `--json`           | Add a machine-readable record on stdout, keeping the frame           |
| `--folder <list>`  | Comma-separated folder names (default: the three below)              |
| `--citations-only` | Run the gating citation check alone, printing nothing when it passes |
| `--gate`           | Fail on a missing required section or index drift as well            |

`--citations-only` and `--gate` refuse together. The first runs the citation check alone, so the two findings the second adds are never measured, and a run honoring both would exit clean on a file short a required section.

## Folder scope

Scope defaults to `context`, `decisions`, `diagrams`, and `wireframes`, and a folder the project does not carry is skipped rather than reported. A domain that outgrew one file and split into `<domain>/` is audited as its own folder, so a split entry measures at the same grain as a flat one.

A name passed to `--folder` resolves under the record roots first, `.canon/` ahead of `.claude/`, and at the project root last, which is what puts `docs/` and any later corpus in reach of the same engine. The root base is reached only by a name the caller passes, so the default list still resolves under a record root alone and a project holding a root `wireframes/` is not audited against a standard it never adopted. `diagrams` is the one default name that is a session record and moves with them, which is why both record roots are in the list rather than one, and `docs/agents/records.md` states the read order every verb shares. The scope line prints the resolved path, so a project carrying both spellings reads which one was taken. The JSON record carries the base per folder as `folders[].base`.

A run where no requested name resolves refuses, whichever list it read. Naming the absent ones narrows to `--folder`, since a project carrying one of the three default folders is the ordinary case and a name it never asked for is not a typo. The JSON record carries those names as `unresolvedFolders`.

## Exit codes

Exit codes are `0` for a clean run, `1` for a refusal, and `2` for a gating finding. An unresolved citation gates under every mode. An architecture record that states its own line allowances gates when it is past the ceiling those derive, on any run that measures it, which is every mode except `--citations-only`, and a record stating none is reported and never gated. Entry length, reference form, table, provenance, narration, and the record's claim classification print and return `0` under every mode, because each is a judgment and failing a push on one would make the check something to route around. Narration is the weakest of the five, since whether two bullets share a subject is a call the measure approximates from structure alone, and one of the shapes it matches is the rejected alternative the standard asks an entry to keep.

Required-section and index findings sit between the two. Both are answerable from the file rather than weighed, so `--gate` promotes them to failing codes while a bare run leaves them advisory. The toolkit runs the bare form against itself and the widened form against the seed tree, described below.

## The seed gate

`bun run check` runs `--gate` against every `tooling/<stack>/seeds/` directory carrying a `.claude/` folder, discovered per run so a new stack is covered without a script edit. The seed tree installs into every scaffolded project, so a seed breaking the standard it seeds teaches the wrong shape to each one, and no rule path reaches the tree to report it.

The widened gate is correct here and wrong at the project root. A seed is authored once and read by every target, while a context entry in a live project is edited under time pressure by the people who own it. A missing section in the first is a defect shipping outward, and in the second it is a threshold worth reporting and not worth blocking a push over.

Coverage follows the index-plus-entry contract, so it reaches seeded entries and the indexes beside them. `DESIGN.md` and `REQUIREMENTS.md` sitting directly under `.claude/` belong to no audited folder and stay outside it, while `ARCHITECTURE.md` is measured on its own path. The seed record states no line allowance, so it is reported rather than gated, which is what a seed template showing the shape of a record should be.

The stage prints the entries it measured per root and warns on a root that measured none. A root can resolve an audited folder and hold no entry in it, which `tooling/claude/seeds` does today, so a single pass line over the set would report coverage of a tree nothing opened.

It reads the exit code rather than pass against fail, since the two failing codes mean opposite things. A root carrying a `.claude/` that resolves no audited folder refuses at 1 and warns, while a seed short a required section gates at 2 and fails the push. A new stack seeding `.claude/` alone therefore reports what it is rather than a violation it does not have.

### Exempting a skeleton

A seed that deliberately omits a required section sets `stub: true` in its frontmatter, and the section check then skips it. Every other measure still reads the file, since a stub is exempt from owing sections rather than from being well formed.

```markdown
---
title: Architecture
stub: true
---
```

Only `true` counts. A field holding anything else reads as a seed that meant to turn the exemption off, so a typo cannot silence the gate. Both install paths strip the field on the way into a target, which keeps toolkit bookkeeping out of a project whose own tooling would never read it. A block holding nothing else is dropped whole.

The exemption exists because the section check has a false-positive class. A standard may sanction omitting a section, and no measure separates that from a file that forgot it, which is why the finding stays advisory everywhere the widened gate is not running. No seed sets the field today.

## The citation gate

The citation check resolves every path into an audited folder that appears anywhere in the repository, and it is the half wired into `bun run check`. A stale reference has a silent failure mode: the session opens nothing and carries on.

Three exclusions keep it from firing on prose about paths. Fenced blocks are skipped in markdown, which covers a standard displaying a path as an example. Fixture and harness trees are skipped by location, covering sandbox scenarios that describe their own scratch tree, the eval harness naming its target project, and `*.test.ts`. A path into a folder the project does not carry is skipped, so a skill directing a reader to `canon/wireframes/index.md` stays valid in a project that has wireframes and silent in one that does not.

Two cases remain, and no syntax separates either from a real reference. One is a sentence naming a hypothetical entry to show the shape of a name. The other is a line instructing a target project about its own tree, which resolves against the target rather than against this repository and passes here only while the two layouts agree. Splitting a seeded domain into a folder ends that agreement and turns every such line red at once.

Append `<!-- audit-ignore-citations: <path> -->` to the source line in either case, naming the exact path the sentence displays. The marker excuses only the paths it names, so a line carrying a real reference beside the displayed one keeps that reference checked. A bare `<!-- audit-ignore-citations -->` with no path excuses every citation the line carries instead, and the reference-form check reads either form the same way, since both ask whether a line points at a file and the marker is how a line says it displays a name instead.

The marker itself stays out of anything that installs. A seed, a plugin skill body, and a stack reference all reach a target, so a marker there lands as toolkit bookkeeping in someone else's tree. Reword those lines to drop the path instead, and where a stop message has to spell it, move that message into a fenced block, which this check already skips.

The pattern spells both record-root prefixes, so a citation into a folder that has moved still resolves and a folder resolved at the project root is measured by every other check while contributing nothing here. A pattern fixed at one root matches nothing after a move and reports nothing, which is a stale reference passing the check written to find it. Widening it to a bare `docs/x.md` would match prose that references nothing, which is a separate decision from where entries come from. A run whose folders all resolved at the root says the check is out of scope rather than reporting that zero paths resolved, and the same run under `--citations-only` refuses, because a gate exiting clean on a scope it could not build is the failure the gate exists to catch.
