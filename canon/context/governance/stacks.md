---
title: Stacks
description: How a stack resolves its rule set, why an entry may name a whole folder, the extras flag, the unreferenced-rules stage, and adding a stack
---

# Stacks

Each stack declares an optional `extends` chain and a `rules` list. An entry names a rule or a whole rule folder. The chain resolves recursively, so `react` resolves through `node` to `base` and the full deduplicated set installs.

| Stack            | Extends | Rules                                                                                                                                                                                                                                                 |
| ---------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `base`           | -       | the `core/` and `claude/` folders whole, which is every core rule plus every claude authoring rule, plus 120-bash                                                                                                                                     |
| `node`           | base    | 100-typescript                                                                                                                                                                                                                                        |
| `node-server`    | node    | 360-security-server, 370-database                                                                                                                                                                                                                     |
| `react`          | node    | 200-react, 250-tailwind, 300-testing-ts, 305-e2e-reliability, 306-test-scope, 310-zod, 350-security-web, 400-ui, 410-a11y, 420-forms, 430-ux-completeness, 440-surface-capture, 450-link-behavior, 460-design-taste, 465-interface-casing, 470-motion |
| `nextjs`         | react   | 230-nextjs                                                                                                                                                                                                                                            |
| `astro`          | node    | 210-astro, 300-testing-ts, 305-e2e-reliability, 306-test-scope, 350-security-web, 400-ui, 410-a11y, 420-forms, 430-ux-completeness, 440-surface-capture, 450-link-behavior, 460-design-taste, 465-interface-casing, 470-motion                        |
| `python`         | base    | 110-python, 330-testing-py, 340-pydantic, 360-security-server, 370-database                                                                                                                                                                           |
| `python-fastapi` | python  | 220-fastapi                                                                                                                                                                                                                                           |

`360-security-server` and `370-database` glob Python alongside TypeScript and JavaScript, so both reach a Python backend and a Node one and the stack naming them is what decides which target sees them. `350-security-web` globs component and markup files alone and matches nothing on a request handler or a query. `python` and `node-server` therefore carry the server pair, while `node`, `react`, and `astro` carry neither rule.

## Decisions

### A stack entry names a rule or a folder

`expandStackEntry` in `src/gov/stacks.ts` resolves one entry. A name matching a directory under `governance/rules/` yields every rule inside it, and anything else yields itself, so a folder and a slug leave the resolver as one shape. Dedupe runs on the expanded names, which is what lets a stack name a folder while an ancestor names a rule inside it without installing that rule twice.

`base` takes `core` and `claude` whole. Those two folders were enumerated one rule at a time and the list was always exactly the folder, so adding a rule needed a second edit nothing prompted. Every other stack stays enumerated, because taking three of six rule folders is a selection a folder entry cannot express.

The consequence is that both folders are now opt-out. A rule authored into `governance/rules/claude/` ships to every `base` consumer by existing, so the decision moved from the stack file to whether the file belongs in that folder. The install output is where the flat list is paid back, since `runInstall` expands before printing and the operator still reads every rule name.

### A Node backend takes a sibling stack where Python takes none

`python` names both server rules directly and can, because `python-fastapi` is the only stack extending it and a FastAPI target wants them. `node` cannot do the same. `react` and `astro` both extend it, so a persistence rule placed there arrives at every pure frontend target and matches none of its files, which is a reads-as-covered defect.

`node-server` extends `node` instead, beside those two rather than above them. `resolveRules` walks `extends` ancestors first and then the stack's own rules, so a child inherits from its parent and pushes nothing back up. `react` and `astro` resolve exactly what they would without this stack, and a Node backend picks the two server rules up by naming one stack.

Reaching for symmetry between the two ecosystems would reintroduce the defect, since the shape that works for Python turns on nothing extending it. Renaming `node` is the other candidate and it would break both frontend stack files plus every target installed under the old name, for a result the sibling already gives.

The stack carries those two rules and nothing else. `300-testing-ts` and `310-zod` read as reasonable on a backend and are currently named by `react`, so pulling either in is a separate decision about the default a Node backend gets, and it costs one line once a target asks.

`--add 360-security-server,370-database` still works as a route onto a `node` target. The flag layers on any stack, so it stays the way to reach a rule no stack names rather than the way to reach these two specifically, which `node-server` now names directly.

Nothing detects the stack. `target-setup` picks by matching a detected runtime or framework against stack names, and a Node backend detects the runtime, so it lands on `node` and resolves neither server rule. `node-server` is therefore named deliberately until that skill carries a rule for the backend case, which needs a decision about what evidence marks a project as one.

### A meta-framework takes a child stack rather than a rule in its parent

`230-nextjs` globs `**/*.ts` and `**/*.tsx`, the same files every React target holds, so its `paths:` scope cannot keep it off a Vite app. Stack membership is the only scope such a rule has, and a `react` listing would load App Router instructions on every source file of a Vite React target. `nextjs` carries it instead, extending `react` the way `python-fastapi` extends `python` and adding that one rule.

Moving a rule between stacks changes what a new install writes and nothing on a target that already holds the file. Sync matches an installed rule to its source by basename across `governance/rules/`, whichever stack names it, so a held `230-nextjs.md` reads as matching and keeps receiving updates. A target stamped `react` that deletes it gets no `missing` report back, since the `react` chain does not list the rule. A Next.js target stamped `react` reports a rule added to `nextjs` as missing only after it runs `canon gov install nextjs`, which rewrites the stamp's chain. No verb removes the file, so each kind of target learns what to do from the release note alone.

### The extras flag layers rather than defines

`--add` takes rule names alone and does not expand a folder. The flag layers onto a resolved stack rather than defining one, and a folder there has no case behind it yet. An unknown name warns rather than aborting, so `--add core` is loud rather than silent.

Extras are deduped against the stack's resolved rules, so a rule already in the stack is a no-op.

## Gotchas

### A rule in an unnamed folder installs for nobody

A rule authored under `governance/rules/` in a folder no stack names reaches no target. Folder entries close that for `core`, `claude`, `snippets`, and `ci`, since the other four folders are still enumerated per stack.

### Why the unreferenced stage stays advisory

The `Unreferenced rules` stage in `src/gate/stages.ts` reports rules no stack reaches and never fails, comparing the catalog against the list `src/gate/measures.ts` records. `260-shadcn` and `320-tanstack-query` are opt-in libraries this repository ships on purpose. `600-at-references` sits in its own `governance/rules/snippets/` folder rather than under `governance/rules/claude/`, since shipping the `@`-reference convention through the claude folder's whole-folder entry would ship it to every `base` consumer regardless of whether a project carries `.claude/snippets/`. `base` carries `snippets` as a folder-whole entry too, the same way it does `core` and `claude`, so the rule ships that way rather than through the retired `canon snippets install` channel. A gate here would fail every push over these two deliberate cases.

`GOV_EXPECTED_UNREFERENCED` in that script holds both, and a third rule arriving reads as new against it. Reconsider failing if the set keeps growing and the pattern turns out to be an accident rather than a design.

## Adding a stack

Create a new `.toml` file in `governance/stacks/`. Set `extends` to the parent stack name or leave it empty. List rule names without `.md` in the `rules` array, or a folder name under `governance/rules/` to take that folder whole. Nothing compiles the stack, so the file is live to `canon gov install` as soon as it is written.

Governance stacks are one of the five catalogs `scripts/core/regen-hero.sh` counts, so a new file moves the count on `assets/captures/hero.html`. The branch adding the stack owes no render. The Hero stage runs `regen-hero.sh --check`, which fills every template into a temporary folder and discards it, so a changed count does not fail it. `refresh-capture-frames.yml` regenerates the frames from `main` after the merge and carries the new count in its own pull request. Its path filter does not list `governance/stacks/`, so a merge touching only a stack file starts no refresh, and the count waits for the next merge that does.

```toml
extends = "node"
rules = ["200-react", "250-tailwind"]
```

Take a folder whole only when the stack wants every rule in it now and every rule added to it later. A stack selecting some of a folder stays enumerated, since the list is what records that the omission was a decision.

```toml
extends = ""
rules = ["core", "claude"]
```
