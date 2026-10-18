# Tooling PHP reference

> Extends: `base`. Apply base stack first.

## Overview

The php stack covers Composer projects on PHP 8.3 or later, formatted by PHP CS Fixer, analysed by PHPStan, and tested by PHPUnit. It ships the three tools' configs, a php phase list for base's verify runner, and a copy-once smoke test.

## Scaffold checklist

1. Scaffold with `composer init -n --name <vendor>/<name> --autoload src/`. The package name and namespace are the project's own identity, so this stack never ships a `composer.json`.
2. Seed `package.json` with `bun init -y`, so the base layer's bun-side tools (husky, oxfmt, commitlint) have a target to install into.
3. Install base tooling with `canon tooling sync base . --write`.
4. Install php tooling with `canon tooling sync php . --write`.
5. Install the dev tools with `composer require --dev friendsofphp/php-cs-fixer phpstan/phpstan phpunit/phpunit`. This stays manual, since manifest injection runs `bun add -D`.
6. Run `bun run lint:fix`, then `bun run format`, then `bun run check`.

### Requirements

Use PHP 8.3 or later, since PHPUnit 12 requires it.

- Keep both `src/` and `tests/` in place, since all three tools read both paths and fail when either is missing.
- The scaffold creates `src/`, but git does not commit an empty folder. A fresh clone with no source fails `lint` and `typecheck` until the first class lands there.
- The stack ships `tests/SmokeTest.php` as a copy-once seed, so `bun run check` passes on a fresh scaffold. Delete or replace it with real tests.

## PHP CS Fixer

- Scan `src` and `tests`.
- Allow risky rules.
- Apply `@PER-CS`, plus `declare_strict_types`, `strict_comparison`, `no_unused_imports`, and `ordered_imports`.
- Write the cache to `.php-cs-fixer.cache` beside the config.

## PHPStan

- Set `level: max`.
- Analyse `src` and `tests`.

## PHPUnit

- Bootstrap from `vendor/autoload.php` and validate against the vendored schema.
- Set `colors`, `failOnWarning`, and `failOnRisky`.
- Run one `unit` suite over `tests`, with `src` as the source.

## verify.json

### Phases

The php phase list probes its tools and holds one precondition.

- Probe `php` and `composer` first.
- Hold a precondition on `vendor/bin/phpunit`, so the run stops and names `composer install` when it is missing.
- Require Typecheck (`phpstan analyse`), Lint (`php-cs-fixer check`), and Unit tests (`phpunit --testdox`).
- Base's runner adds its own four phases where the folder declares their scripts, then the markdown bans stage.

### Prepare

The manifest prepares a scaffold that lacks a `package.json`.

- The manifest's `[verify] prepare` runs checklist steps 2 and 5 for `canon tooling verify php`, being `bun init -y` and the `composer require --dev` line.
- The scaffold writes no `package.json`, and a verify that reaches its end with none fails.

## CI

- Install PHP with `shivammathur/setup-php` and `tools: composer`.
- Run `composer install`, then `bun run typecheck`, `bun run lint`, and `bun run test:run`.

## Anti-patterns

- Do not ship `composer.json` or `composer.lock` from tooling. Both belong to the project, and a golden copy would overwrite its package name on every sync.
- Do not add a `phpstan-baseline.neon` to reach `level: max`. Fix the finding or lower the level in the project.
- Do not ship a `Dockerfile`, `.dockerignore`, or `compose.yaml` under tooling. Those are deployment choices and belong in the project itself.

## Development docs (extend)

Append these rows to the `## Scripts` table.

| Command             | Purpose                                     |
| ------------------- | ------------------------------------------- |
| `bun run lint`      | Run `php-cs-fixer check --diff`.            |
| `bun run lint:fix`  | Auto-fix with `php-cs-fixer fix`.           |
| `bun run typecheck` | Run `phpstan analyse`.                      |
| `bun run test`      | Run `phpunit`.                              |
| `bun run test:run`  | Run `phpunit --testdox` (used by `verify`). |

## CI docs (extend)

In `canon/context/development/ci.md`, add or change three rows. <!-- audit-ignore-citations: canon/context/development/ci.md -->

- The Typecheck row asserts `` `phpstan analyse` passes ``.
- A Lint row asserts `` `php-cs-fixer check` passes ``.
- A Tests row asserts `` `phpunit` exits 0 ``.
