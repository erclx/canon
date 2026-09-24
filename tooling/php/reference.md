# Tooling PHP reference

> Extends: `base`. Apply base stack first.

## Overview

The php stack covers Composer projects on PHP 8.3 or later, formatted by PHP CS Fixer, analysed by PHPStan, and tested by PHPUnit. It ships the three tools' configs, a PHP-aware `verify.sh`, and a copy-once smoke test.

## Scaffold checklist

1. Scaffold with `composer init -n --name <vendor>/<name> --autoload src/`. The package name and namespace are the project's own identity, so this stack never ships a `composer.json`.
2. Seed `package.json` so the base layer's bun-side tools (husky, prettier, cspell, commitlint) have a target to install into: `bun init -y`.
3. Install base tooling: `canon tooling sync base . --write`
4. Install php tooling: `canon tooling sync php . --write`
5. Install the dev tools: `composer require --dev friendsofphp/php-cs-fixer phpstan/phpstan phpunit/phpunit`. The manifest declares no `[dependencies.dev]`, because manifest injection runs `bun add -D`, which cannot install a Composer package. This step stays manual.
6. Run `bun run lint:fix` then `bun run check`.

Use PHP 8.3 or later, since PHPUnit 12 requires it.

Keep both `src/` and `tests/` in place. All three tools read both paths and fail when either is missing. The scaffold creates `src/`, but git does not commit an empty folder, so a fresh clone with no source yet fails `lint` and `typecheck` until the first class lands there.

The php stack also ships `tests/SmokeTest.php` as a copy-once seed, so `bun run check` passes on a fresh scaffold. Delete or replace it with real tests.

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

## verify.sh

- Stop and name `composer install` when `vendor/bin/phpunit` is missing.
- Run Typecheck (`phpstan analyse`), Lint (`php-cs-fixer check`), and Unit tests (`phpunit --testdox`), plus the four base phases wherever the folder declares their scripts.

## Gitignore

- `# PHP`: `vendor/`, `.php-cs-fixer.cache`, `.phpunit.cache/`, `.phpunit.result.cache`

## CI

- Install PHP with `shivammathur/setup-php` and `tools: composer`.
- Run `composer install`, then `bun run typecheck`, `bun run lint`, and `bun run test:run`.

## Anti-patterns

- Do not ship `composer.json` or `composer.lock` from tooling. Both belong to the project, and a golden copy would overwrite its package name on every sync.
- Do not add a `phpstan-baseline.neon` to reach `level: max`. Fix the finding or lower the level in the project.
- Do not ship a `Dockerfile`, `.dockerignore`, or `compose.yaml` under tooling. Those are deployment choices and belong in the project itself.

## Development docs (extend)

Append to the `## Scripts` table:

| `bun run lint` | Run `php-cs-fixer check --diff`. |
| `bun run lint:fix` | Auto-fix with `php-cs-fixer fix`. |
| `bun run typecheck` | Run `phpstan analyse`. |
| `bun run test` | Run `phpunit`. |
| `bun run test:run` | Run `phpunit --testdox` (used by `verify`). |

## CI docs (extend)

In `canon/context/ci.md`, the Typecheck row's assertion reads: `` `phpstan analyse` passes ``. Add a Lint row whose assertion reads: `` `php-cs-fixer check` passes ``. Add a Tests row whose assertion reads: `` `phpunit` exits 0 ``.
