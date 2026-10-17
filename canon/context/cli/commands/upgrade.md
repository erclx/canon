---
title: Upgrade and skew
description: The upgrade verb, the version skew read and its two callers, and the record shapes that keep a behind report honest
---

# Upgrade and skew

## Decisions

### The upgrade verb

Reporting that the binary is behind is the fourth thing that earns a verb, and `canon upgrade` is the only one mutating the machine rather than a project.

It reads the manager off the install path in `src/version/manager.ts` rather than guessing from `PATH`, names what it matched first, and refuses a path under no install tree. That prevents reinstalling over a clone.

### A second refusal on a nameless manifest

It refuses when the manifest carries no `name`. The value reaches a global install command, so a manifest that failed to parse would install whatever sits under the placeholder, and the confirm defaults to yes headlessly, leaving the refusal as the only thing in the path.

### The reinstall's stdout goes to stderr

A package manager writes progress to stdout, and inheriting all three streams puts that output ahead of the `--json` record on the one stream a wrapper parses.

### The skew read has two callers

It sits in `src/version/skew.ts` and serves `canon sync --check` and `canon claude skills drift`, each a moment a target already stops to reconcile.

Putting it behind a catalog read was rejected. An agent runs those in a loop, so a registry round trip per read fails offline and needs a cache that is a second mechanism.

### Three states, never a fourth

`unknown` absorbs every failure with its reason, so `hasDrift` ignores the field and an offline machine cannot turn `canon sync --check --exit-code` red over a condition it never measured.

A version ahead of the published one reports `current`, being a checkout between a release commit and the publish job rather than skew.

### `SkewReport` is a union

It is a union on `state`, so a `behind` report cannot exist without the version it is behind. Both fields render into a line an operator reads, and an optional one renders the word `undefined` there.

### `InstalledPackage` is optional on both

It runs the opposite way, since either field is absent when the manifest did not parse. A sentinel string typed `string` reads as an ordinary value at each call site, which let a placeholder name reach a global install command unremarked. Optional forces the narrowing.

### The remedy follows detection

`describeSkew` picks the remedy from the same detection the verb runs. Both callers run from a source checkout routinely, which is where `canon upgrade` refuses, and a line naming the verb unconditionally would send a contributor whose clone is a release behind to a command that declines.

### `UpgradeRecord` carries a `message`

It is rendered once per outcome rather than left for a caller to rebuild from `before`, `after`, and `latest`. The `current` branch reuses `describeSkew` verbatim.

`.husky/post-merge` is the first caller reading `message` off `--json` rather than parsing the raw fields, covered in `canon/context/development/hooks/husky.md`.

### `message` is the one free-text field

`describeSkew`'s `unknown` branch embeds a registry error verbatim. `emit` runs it through `singleLine`, collapsing whitespace and swapping a double quote for an apostrophe, because the one caller reads it with a shell pattern that stops at the first `"`.

### A fourth state, `pending`, on the upgrade record

A pull lands a release commit before the publish job finishes, so for a few minutes the checkout leads npm, `canon upgrade` reads `current`, and the plugin update against the marketplace has already moved. 5.1.0 was pulled at 15:27:44Z and published at 15:33:07Z.

### How `pending` is read

The verb reads the version at cwd through `findCheckoutMismatch(process.cwd())`, which `PROJECT_ROOT` cannot answer since a global binary resolves to its own install. It reports `pending` with a `checkout` field when that version is ahead of `latest`.

- A target project sits in no canon checkout and reads nothing
- The `upgraded` path appends the same clause when the fresh install is still behind the checkout
- `describeSkew` and its two callers keep three states, since a checkout ahead of npm is no skew for them

### The message names what npm serves

It promises no publish, since a release that never publishes keeps `pending` printing on every pull until a newer one does. The hook prints the line unchanged, since it prints every state other than `current`.

Waiting on the publish was rejected because it holds the pull for about five minutes, and a background retry because it is a detached process nobody watches.

### The skew read reports versions, not verbs

A missing subcommand under a command that exists is the quieter failure. A target on an older binary archives a task and leaves its plan live, reporting success either way. A reader who never runs either caller is reached by no route at all.

### `skills drift` is run-dependent

`canon claude skills drift` answers only when a session runs it, goes quiet on a body the running session edited and has not committed, and refuses in a project consuming the plugin from a cache.

### The labels fallback

`git-pr` calls `canon labels audit` and keeps the stated matching rule as a fallback for a binary predating the verb. The duplication runs until a release retires it.
