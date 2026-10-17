---
title: Stacks
description: How a stack resolves its rule set, why base names rules one by one, why framework stacks retired, the extras flag, and adding a stack
---

# Stacks

Each stack declares an optional `extends` chain and a `rules` list. An entry names a rule or a whole rule folder. The chain resolves recursively, so `node` resolves through `base` and the full deduplicated set installs.

| Stack    | Extends | Adds                                                                        |
| -------- | ------- | --------------------------------------------------------------------------- |
| `base`   | -       | ten rules by name: output, the board and plan rules, git, indexes, markdown |
| `node`   | base    | the `code` folder whole, TypeScript, TypeScript testing                     |
| `python` | base    | the `code` folder whole, Python, Python testing                             |
| `go`     | base    | the `code` folder whole, Go, Go testing                                     |
| `php`    | base    | the `code` folder whole, PHP, PHP testing                                   |

The table grows a row per stack rather than per rule, so each row names what the stack adds. `canon gov list --json` reports the resolved set. Every rule outside those five stacks is opt-in, reached through `canon gov detect` or `--add`.

## Decisions

### A stack entry names a rule or a folder

`expandStackEntry` in `src/gov/stacks.ts` resolves one entry. A name matching a directory under `governance/rules/` yields every rule inside it, and anything else yields itself, so a folder and a slug leave the resolver as one shape. Dedupe runs on the expanded names, so a stack can name a folder while an ancestor names a rule inside it.

The language stacks take `code` whole, since every stack that writes code wants every rule in it, including any added later. A folder entry makes that folder opt-out, so a rule authored into it ships to every consumer by existing. `runInstall` expands before printing, so the operator still reads every rule name.

### Base names its rules one by one

Base installs ten rules: the session output rule, the board, plan, scratch, worktree, and git rules, the index rule, and markdown. Taking the `canon`, `claude`, `tooling`, and `writing` folders whole measured 16 rules on 2026-10-11, so naming keeps the base minimal.

- Base takes one of the two `claude` rules and none of `tooling`, so a folder entry cannot express its set
- A folder entry for `canon` alone would put the next rule authored there into every project, which is the default this avoids
- A rule base drops reaches a project through `canon gov detect`, whose evidence table the unreferenced stage requires
- `baseFolders` in `src/sync/check.ts` reads the folders of the rules base resolves to, so the fallback for a target with no recorded chain still reports a new rule authored beside one of base's
- Sync never retracts a rule, so the minimal base changes new installs only

### Governance stacks are per language

One stack exists per language and none per framework. With every framework, UI, security, and database rule opt-in, each framework stack would equal its parent plus the one rule `canon gov detect` already proposes from the same dependency.

Thin aliases naming one framework rule each were rejected. They give a project two routes to one install, which is the dual mode the plan standard warns against, and the alias drifts from the detect entry the first time either changes.

- `target-setup` picks the stack from the repository root's language alone, and a framework's rules arrive as extras the operator confirms
- `nextjs` globs every `.ts` and `.tsx` file, so detect proposes it only from `next` in a manifest or a `next.config.*` file
- A target recorded on a retired stack still syncs, since `readNewRules` in `src/sync/check.ts` reads a chain that does not resolve as no chain and falls back to rule folders
- That target is offered a new rule only in a folder it already carries or one holding a base rule

### Server rules glob every backend language

`security-server` and `database` glob Python, TypeScript, JavaScript, Go, and PHP. No stack names them, so `canon gov detect` proposes them from a server framework or database client in the manifest, and any backend language matches once installed. `security-web` globs component and markup files alone and matches nothing on a request handler.

### The extras flag layers rather than defines

`--add` takes rule names alone and does not expand a folder, since the flag layers onto a resolved stack rather than defining one. An unknown name warns rather than aborting, so `--add code` is loud rather than silent. Extras are deduped against the stack's resolved rules, so a rule already in the stack is a no-op.

A target reaching `testing-go` or `testing-php` through `--add` rather than the `go` or `php` stack gets no `code/` rule. That is why those two keep their `canon:test-craft` pointer where `testing-ts` and `testing-py` dropped it. With no stack named, `--add` installs its rules alone, which `canon/context/governance/install.md` covers.

### Adding a stack

Create a `.toml` file in `governance/stacks/`. Set `extends` to the parent stack name or leave it empty, and list rule names without `.md` in `rules`, or a folder name under `governance/rules/` to take that folder whole. Nothing compiles the stack, so it is live to `canon gov install` as soon as it is written.

```toml
extends = "base"
rules = ["code", "go", "testing-go"]
```

- Take a folder whole only when the stack wants every rule in it now and later. A stack selecting some of a folder stays enumerated, since the list records the omission as a decision.
- A stack is a language. A framework or library gets a `governance/detect.toml` entry rather than a stack.
- The branch owes no hero render, since `regen-hero.ts --check` discards what it fills. `refresh-capture-frames.yml` lists `governance/stacks/**` and regenerates the frames after the merge.

## Gotchas

### A rule in an unnamed folder installs for nobody

A rule authored in a folder no stack names reaches no target. `code` is the only folder a stack takes whole, so a rule anywhere else needs its name in a stack file or an entry in `governance/detect.toml`.

### The unreferenced stage fails on a rule nothing proposes

A rule no stack names reaches a target only through `canon gov detect`. The `Unreferenced rules` stage fails when such a rule has no table in `governance/detect.toml`, and when a table there names no live rule.

A fixed expected-unreferenced list that warned and never failed was rejected. With thin stacks the unreferenced set is most of the catalog, and a list rewritten on every new rule is one nobody compares against.
