---
title: Stacks
description: How a stack resolves its rule set, why an entry may name a whole folder, the extras flag, the unreferenced-rules stage, and adding a stack
---

# Stacks

Each stack declares an optional `extends` chain and a `rules` list. An entry names a rule or a whole rule folder. The chain resolves recursively, so `react` resolves through `node` to `base` and the full deduplicated set installs.

| Stack            | Extends | Rules                                                                                                                                                                                                         |
| ---------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `base`           | -       | the `core/` and `claude/` folders whole, which is every core rule plus every claude authoring rule, plus 120-bash                                                                                             |
| `node`           | base    | 100-typescript                                                                                                                                                                                                |
| `node-server`    | node    | 360-security-server, 370-database                                                                                                                                                                             |
| `react`          | node    | 200-react, 230-nextjs, 250-tailwind, 300-testing-ts, 305-e2e-reliability, 306-test-scope, 310-zod, 350-security-web, 400-ui, 410-a11y, 420-forms, 430-ux-completeness, 440-surface-capture, 450-link-behavior |
| `astro`          | node    | 210-astro, 350-security-web, 400-ui, 410-a11y, 430-ux-completeness, 440-surface-capture, 450-link-behavior                                                                                                    |
| `python`         | base    | 110-python, 330-testing-py, 340-pydantic, 360-security-server, 370-database                                                                                                                                   |
| `python-fastapi` | python  | 220-fastapi                                                                                                                                                                                                   |

`360-security-server` and `370-database` glob Python alongside TypeScript and JavaScript, so both reach a Python backend and a Node one and the stack naming them is what decides which target sees them. `350-security-web` globs component and markup files alone and matches nothing on a request handler or a query. `python` and `node-server` therefore carry the server pair, while `node`, `react`, and `astro` carry neither rule.

## Decisions

### A stack entry names a rule or a folder

`expandStackEntry` in `src/gov/stacks.ts` resolves one entry. A name matching a directory under `governance/rules/` yields every rule inside it, and anything else yields itself, so a folder and a slug leave the resolver as one shape. Dedupe runs on the expanded names, which is what lets a stack name a folder while an ancestor names a rule inside it without installing that rule twice.

`base` takes `core` and `claude` whole. Those two folders were enumerated one rule at a time and the list was always exactly the folder, so adding a rule needed a second edit nothing prompted. Every other stack stays enumerated, because taking three of six rule folders is a selection a folder entry cannot express.

The consequence is that both folders are now opt-out. A rule authored into `governance/rules/claude/` ships to every `base` consumer by existing, so the decision moved from the stack file to whether the file belongs in that folder. The install output is where the flat list is paid back, since `runInstall` expands before printing and the operator still reads every rule name.

### A Node backend takes a sibling stack where Python takes none

`python` names both server rules directly and can, because `python-fastapi` is the only stack extending it and a FastAPI target wants them. `node` cannot do the same. `react` and `astro` both extend it, so a persistence rule placed there arrives at every pure frontend target and matches none of its files, which is the reads-as-covered defect the corpus work opened against.

`node-server` extends `node` instead, beside those two rather than above them. `resolveRules` walks `extends` ancestors first and then the stack's own rules, so a child inherits from its parent and pushes nothing back up. `react` and `astro` resolve exactly what they resolved before this stack existed, and a Node backend picks the two server rules up by naming one stack.

Reaching for symmetry between the two ecosystems is what reintroduces the defect, since the shape that works for Python turns on nothing extending it. Renaming `node` was the other candidate and it breaks both frontend stack files plus every target that installed under the old name, for a result the sibling already gives.

The stack carries those two rules and nothing else. `300-testing-ts` and `310-zod` read as reasonable on a backend and are currently named by `react`, so pulling either in is a separate decision about the default a Node backend gets, and it costs one line once a target asks.

`--add 360-security-server,370-database` was the interim route onto a `node` target and this stack supersedes it. The flag is unchanged and still layers on any stack, so it stays the way to reach a rule no stack names rather than the way to reach these two.

Nothing detects the stack. `setup-init` and `setup-gov` both pick by matching a detected runtime or framework against stack names, and a Node backend detects the runtime, so it lands on `node` and resolves neither server rule. `node-server` is therefore named deliberately until one of those skills carries a rule for the backend case, which needs a decision about what evidence marks a project as one.

### The extras flag layers rather than defines

`--add` takes rule names alone and does not expand a folder. The flag layers onto a resolved stack rather than defining one, and a folder there has no case behind it yet. An unknown name warns rather than aborting, so `--add core` is loud rather than silent.

Extras are deduped against the stack's resolved rules, so a rule already in the stack is a no-op.

## Gotchas

### A rule in an unnamed folder installs for nobody

A rule authored under `governance/rules/` in a folder no stack names reaches no target. Folder entries close that for `core`, `claude`, `snippets`, and `ci`, since the other four folders are still enumerated per stack.

### Why the unreferenced stage stays advisory

The `Unreferenced rules` stage in `src/gate/stages.ts` reports rules no stack reaches and never fails, comparing the catalog against the list `src/gate/measures.ts` records. `260-shadcn` and `320-tanstack-query` are opt-in libraries this repository ships on purpose. `600-at-references` used to reach no stack by design: a rule under `governance/rules/claude/` would ship to every `base` consumer through that folder's whole-folder entry, so the `@`-reference convention sat in its own `governance/rules/snippets/` instead, reachable only through `canon snippets install`. That install channel retired, leaving the rule no delivery path at all, so `base` now carries `snippets` as a folder-whole entry too and the rule ships the same way `core` and `claude` do. A gate here would fail every push over the two deliberate cases that remain.

`GOV_EXPECTED_UNREFERENCED` in that script holds both, and a third rule arriving reads as new against it. Reconsider failing if the set keeps growing and the pattern turns out to be an accident rather than a design.

## Adding a stack

Create a new `.toml` file in `governance/stacks/`. Set `extends` to the parent stack name or leave it empty. List rule names without `.md` in the `rules` array, or a folder name under `governance/rules/` to take that folder whole. Nothing compiles the stack, so the file is live to `canon gov install` as soon as it is written.

`bun run check` still has something to say about it. Governance stacks are one of the five catalogs `scripts/core/regen-hero.sh` counts, so a new file moves the count on `assets/captures/hero.html` and the Hero stage fails until `canon capture assets/captures/hero.html --selector .window --out assets` re-renders the image. The capture writes `assets/hero.stamp` alongside, and the `captureStamps` measure in `src/gate/measures.ts` compares the two digests it holds against the markup and the image on disk.

```toml
extends = "node"
rules = ["200-react", "250-tailwind"]
```

Take a folder whole only when the stack wants every rule in it now and every rule added to it later. A stack selecting some of a folder stays enumerated, since the list is what records that the omission was a decision.

```toml
extends = ""
rules = ["core", "claude"]
```
