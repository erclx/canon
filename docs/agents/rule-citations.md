---
title: Rule citations
description: Resolving every path a governance rule cites and every frontmatter glob the internal corpus declares, the three forms a citation is written in, the shapes that look like citations and are not, the two classes where an absent path is correct, why the glob half reads one corpus, and why this one gates
---

# Rule citations

`canon gov citations` resolves every path a rule cites and every frontmatter glob the internal corpus declares, naming the ones reaching nothing. It answers a failure no other stage sees: a rule points a reader at a file, the file moves, and nothing reports it until a session opens the path and finds an absence.

A glob fails the same way and more quietly. A rule scoped at a directory that moved stops matching, so it never loads again, and a rule that never fires looks exactly like a rule nobody violated.

```bash
canon gov citations
canon gov citations --json
canon gov citations --root ../my-app
```

| Option          | Behavior                                                   |
| --------------- | ---------------------------------------------------------- |
| `--root <path>` | Tree to read, defaulting to the current directory          |
| `--json`        | Add a machine-readable record on stdout, keeping the frame |

Under `--json` the record holds stdout alone and the frame still renders on stderr, refusals included, which is the split `output-shape.md` fixes for every mode.

## What the drift check cannot see

`bun run check` asserts that an authored rule and its consumed copy agree, and a dead citation passes that assertion because both copies carry it. `governance/rules/claude/561-teach.md` told its reader to open a `references/glossary.md` inside the teach skill that had never existed at that path. The rule shipped, survived a release, and fired during a real teach run before anyone noticed.

Two files agreeing is what a drift check measures. Whether either one is right about the tree is a different question, and this is the stage that asks it.

## The three forms

A citation reaches a reader in one of three shapes, and each resolves against a different root.

| Form       | Shape                    | Resolves against                   |
| ---------- | ------------------------ | ---------------------------------- |
| `standard` | `canon standards <name>` | `standards/<name>.md`              |
| `path`     | a backticked path        | the root                           |
| `sibling`  | a bare `<nnn>-<slug>.md` | the folder the citing rule sits in |

`standard` is the live form and carries most of the corpus, which is what makes scoping this check to the two path shapes a check over almost nothing.

A standard name resolves against the authoring root and nowhere else, matching `standardRoots` in `src/standards/read.ts`, which reads `standards/` at the working root and then the package corpus. The stage refuses a tree holding no rule corpus, so it runs only where those two roots are one directory. `internal/standards/` is deliberately not tried: `canon standards <name>` never reaches it, so admitting it would pass a citation that refuses for the session opening it, which is a gate failing open.

A `path` is anchored on the whole backticked span rather than on a trailing pattern inside it. Cutting `standards/tooling-reference.md` out of `internal/standards/tooling-reference.md` and resolving that against the standards root reports a file that exists as missing, which is a mistake made by hand while measuring this corpus before the stage was written.

## What is not a citation

A rule body is full of backticked spans carrying a slash, and almost none of them names a file in this tree. The stage declines four shapes outright.

- A placeholder or glob segment describes a shape rather than naming a file: `canon/context/<domain>.md`, `standards/<name>.md`, `app/**/route.ts`, `${CLAUDE_SKILL_DIR}/../../standards/<name>.md`.
- A bare filename names a convention: `route.ts`, `manifest.toml`, `components.json`, `playwright.config.ts`. A bare name is read as a citation only when it matches a rule filename, which is how `562-session.md` points at `555-tasks.md`.
- A span carrying no file extension is a folder or a module specifier: `src/pages/`, `next/font`, `try/except`, `react-hooks/set-state-in-effect`, `oven-sh/setup-bun@v2`, `@/lib/utils`.
- A fenced block displays a path rather than pointing at one.

The extension test is what carries most of the separation, and it costs one real path: `claude/standards` is a symlink this stage declines to check because nothing in the span says it is a file. Declining is the right direction for a gate, where a guess that goes wrong fails a push over prose.

## Where an absent path is correct

Two classes resolve to nothing and are right to. Both are reported by name rather than dropped, so a reader can see what the verdict declined to judge.

**Governed.** A rule spelling a path in its own frontmatter `paths:` is naming an artifact a target holds rather than a file here. `governance/rules/claude/560-diagrams.md` declares `.claude/DIAGRAMS.md` and then tells its reader to convert one an older install left behind, so the file is correctly absent from this tree and correctly named in the rule.

Only an exact declaration exempts, never a glob match against one. A glob declares a shape, so a body path sitting inside it is still a citation and a stale one is still a defect. A rule scoped at `docs/**` citing a `docs/agents/renamed.md` that moved is exactly the class this stage exists to catch, and matching the glob would excuse it.

**Ignored.** A path git ignores is session scratch no clone is expected to hold. `governance/rules/claude/555-tasks.md` cites `.canon/tasks/index.md`, which is real in a live project and absent from a fresh clone and from every linked worktree. Resolving against the filesystem alone would make the verdict depend on which tree the stage ran in, so the unresolved paths go to one batched `git check-ignore` and an ignored one is excused. A read git cannot answer refuses rather than reporting those paths dead.

## Why the glob half reads one corpus

Bodies are read across both corpora and frontmatter globs across `internal/rules/` alone.

A rule under `governance/rules/` installs into a target, and its `paths:` entries name the shape that project holds rather than anything here. Measured over that corpus, 32 of its 72 globs match nothing in this tree and every one of them is correct. `src/pages/**` in the Astro rule cannot be told by pattern from a path this repository might hold, so a check cannot separate the two, and gating them would ship an exemption list the length of the corpus. Nothing reads the shipped globs, and the measurement is the reason rather than a gap left for someone to close.

`internal/rules/` ships nowhere. The tree it governs is the tree present, which makes the question answerable, and all 14 of its globs across 7 rules match at the commit this shipped on.

What that leaves unreached is a glob that matches real files and still reaches none of the work it was scoped at. `governance/rules/lib/305-e2e-reliability.md` scopes itself at `e2e/*.ts` and `e2e/**/*.ts`, and no probe in this repository is written under `e2e/`, so the rule asking a session to watch a new guard fail never fired for the session writing guards. Resolution is mechanical and reach is a judgment about where the work happens, so only the first is here.

## The exemption marker

Everything the classifier can separate mechanically is separated there. For the residue, a line carries `canon-allow-citation: <reason>` on itself or the one directly above, which moves it into the report's `Exempt` section. Only a marker naming a reason counts, since a bare token is a line that meant to say something and did not. This is the `canon-allow-superseded` shape, and both read the same placement rule through one helper.

## The blind spots

A citation that resolves and points at the wrong file passes. Resolution is mechanical and correctness is a reading, and only the first is a gate's business.

A path written into running prose without backticks is not read at all. Matching one would report every sentence that happens to name a file, and the backticks are what separate a reference a reader follows from a name in a sentence.

A folder or a path carrying no extension is declined rather than guessed at, which is stated above as the cost of the test that carries the separation.

A glob under `governance/rules/` is not read, and a glob that resolves while reaching none of the work it was scoped at is a reading rather than a resolution. Both are stated above.

## Exit codes

Exit codes are `0` when every citation resolves or is excused and every glob read matches, `1` for a refusal, and `2` for at least one cited path reaching nothing or one glob matching nothing. It refuses a tree holding neither rule corpus, since a tree with no rules passes each of its zero rules, and a `git check-ignore` read that fails.

This gates, and `bun run check` runs it as the `Rule citations` stage. The sibling sweeps report rather than gate because a value appears for reasons unrelated to the convention, so their output is a reading. A path resolving to nothing carries no judgment: either the file is there or the citation is stale, and the two classes where absence is correct are separated before the verdict rather than left for a reader to settle. The corpus is clean at the commit this shipped on, so the gate starts green and stays that way until something breaks.

An exit code says nothing about a call made from a session, since a shell profile may wrap the binary in a function taking its status from a later command. Read the JSON record's `citations` array and filter on `status` rather than the exit when a skill consumes this.
