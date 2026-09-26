---
title: Stacks
description: How a stack resolves its rule set, why an entry may name a whole folder, the extras flag, the unreferenced-rules stage, and adding a stack
---

# Stacks

Each stack declares an optional `extends` chain and a `rules` list. An entry names a rule or a whole rule folder. The chain resolves recursively, so `react` resolves through `node` to `base` and the full deduplicated set installs.

| Stack            | Extends | Adds                                                                       |
| ---------------- | ------- | -------------------------------------------------------------------------- |
| `base`           | -       | the `canon`, `claude`, `tooling`, and `writing` folders whole, plus bash   |
| `node`           | base    | the `code` folder whole, TypeScript                                        |
| `node-server`    | node    | the server pair: server security and database                              |
| `react`          | node    | React, Tailwind, TypeScript testing, Zod, web security, the UI band        |
| `nextjs`         | react   | Next.js                                                                    |
| `astro`          | node    | Astro, TypeScript testing, web security, the UI band                       |
| `python`         | base    | the `code` folder whole, Python, Python testing, Pydantic, the server pair |
| `python-fastapi` | python  | FastAPI                                                                    |

The table stays a table because it grows a row per stack rather than per rule. Each row names what the stack adds rather than listing rule names, and `canon gov list --json` reports the resolved set.

## Decisions

### A stack entry names a rule or a folder

`expandStackEntry` in `src/gov/stacks.ts` resolves one entry. A name matching a directory under `governance/rules/` yields every rule inside it, and anything else yields itself, so a folder and a slug leave the resolver as one shape. Dedupe runs on the expanded names, which lets a stack name a folder while an ancestor names a rule inside it without installing that rule twice.

`base` takes its four folders whole because its list was always exactly those folders, and enumerating them made adding a rule a second edit nothing prompted. `node` and `python` take `code` whole for the same reason, since every stack that writes code extends one of them. Every other stack stays enumerated, since taking some rules from a folder is a selection a folder entry cannot express.

The consequence is that those five folders are opt-out. A rule authored into `governance/rules/claude/` ships to every `base` consumer by existing, so the decision sits in whether the file belongs in that folder rather than in the stack file. `runInstall` expands before printing, so the operator still reads every rule name.

### A Node backend takes a sibling stack where Python takes none

`python` names both server rules directly, because `python-fastapi` is the only stack extending it and a FastAPI target wants them. `node` cannot do the same. `react` and `astro` both extend it, so a persistence rule placed there arrives at every frontend target and matches none of its files, which reads as covered while governing nothing.

`node-server` extends `node` beside those two rather than above them. `resolveRules` walks `extends` ancestors first and then the stack's own rules, so a child pushes nothing back up. `react` and `astro` resolve exactly what they would without it, and a Node backend picks up the server pair by naming one stack. Renaming `node` would break both frontend stack files and every target installed under the old name for a result the sibling already gives.

The stack carries those two rules and nothing else. `300-testing-ts` and `310-zod` would read as reasonable on a backend, and pulling either in is a separate decision about a Node backend's default that costs one line once a target asks.

Nothing detects the stack. `target-setup` matches a detected runtime or framework against stack names, and a Node backend detects the runtime, so it lands on `node` and resolves neither server rule. `--add 360-security-server,370-database` reaches the pair from a `node` target, and `node-server` is named deliberately until that skill carries a rule for what evidence marks a project as a backend.

### A meta-framework takes a child stack rather than a rule in its parent

`230-nextjs` globs `**/*.ts` and `**/*.tsx`, the same files every React target holds, so its `paths:` scope cannot keep it off a Vite app. Stack membership is the only scope such a rule has, so `nextjs` carries it, extending `react` the way `python-fastapi` extends `python`.

Moving a rule between stacks changes what a new install writes and nothing on a target already holding the file. Sync matches an installed rule to its source by basename across `governance/rules/`, whichever stack names it, so a held rule keeps receiving updates. A target reports a rule added to a stack it did not install as missing only after `canon gov install <stack>` rewrites its chain stamp, and no verb removes a file, so each kind of target learns what to do from the release note alone.

### Server rules glob every backend language

`360-security-server` and `370-database` glob Python, TypeScript, JavaScript, Go, and PHP, while only `python` and `node-server` name them, so the stack decides which target sees them and a Go or PHP backend reaches them through `--add`. `350-security-web` globs component and markup files alone and matches nothing on a request handler, which is why the frontend stacks carry it and not the server pair.

### The extras flag layers rather than defines

`--add` takes rule names alone and does not expand a folder, since the flag layers onto a resolved stack rather than defining one. An unknown name warns rather than aborting, so `--add code` is loud rather than silent. A Go or PHP target reaching `335-testing-go` or `336-testing-php` through `--add` therefore gets no `code/` rule, which is why those two keep their `canon:test-craft` pointer where `300-testing-ts` and `330-testing-py` dropped it. Extras are deduped against the stack's resolved rules, so a rule already in the stack is a no-op.

## Gotchas

### A rule in an unnamed folder installs for nobody

A rule authored in a folder no stack names reaches no target. The five folders `base`, `node`, and `python` take whole close that, and every other folder needs the rule's name in a stack file.

### The unreferenced stage stays advisory

The `Unreferenced rules` stage reports rules no stack reaches and never fails. It compares the catalog against `GOV_EXPECTED_UNREFERENCED` in `src/gate/measures.ts`, which records each deliberate case: `260-shadcn` and `320-tanstack-query` are opt-in libraries, and `130-go`, `140-php`, `335-testing-go`, and `336-testing-php` are opt-in until a Go or PHP stack ships, reached through `--add` when `target-setup` detects the language.

A rule outside that list reads as new and the stage warns. A failing gate would fail every push over the deliberate cases, so reconsider failing only if the set keeps growing by accident rather than by design.

## Adding a stack

Create a `.toml` file in `governance/stacks/`. Set `extends` to the parent stack name or leave it empty. List rule names without `.md` in the `rules` array, or a folder name under `governance/rules/` to take that folder whole. Nothing compiles the stack, so the file is live to `canon gov install` as soon as it is written.

```toml
extends = "node"
rules = ["200-react", "250-tailwind"]
```

Take a folder whole only when the stack wants every rule in it now and every rule added to it later. A stack selecting some of a folder stays enumerated, since the list records that the omission was a decision.

```toml
extends = ""
rules = ["canon", "claude"]
```

The branch adding a stack owes no hero render. The Hero stage runs `regen-hero.sh --check`, which discards what it fills, so a changed stack count does not fail it. `refresh-capture-frames.yml` lists `governance/stacks/**` in its path filter and regenerates the frames in its own pull request after the merge.
