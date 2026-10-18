# Tooling shell reference

## Overview

The shell stack is an add-on that formats and lints the shell scripts a project writes. It extends nothing and syncs beside any other stack at the same root with `canon tooling sync shell . --write`, so a project that writes no shell never installs shfmt or shellcheck.

## Install

- Install `shfmt` and `shellcheck` by hand with `sudo apt-get install shfmt shellcheck` or `brew install shfmt shellcheck`. Injection runs only `bun add -D`, and neither ships through the registry.
- `scripts/verify.ts` probes both before the `Shell` phase and names the install command when one is missing, rather than letting `find` report a missing executable.

## shfmt

- Indent with 2 spaces, set through `--indent 2` on every call.
- `.editorconfig` carries an `[*.sh]` block with `indent_style = space` and `indent_size = 2`, so the editor and shfmt agree. Dropping it because shfmt sets indentation produces spurious diffs.

## shellcheck

- Run at warning severity.
- `.shellcheckrc` sets `external-sources=true`, which shellcheck needs to follow `source` directives.

## Coverage

- Both tools take their files from `find scripts -name '*.sh'`, since `scripts/` can mix shell with TypeScript and shellcheck has no directory mode.
- A shell script with a shebang and no `.sh` extension is covered by neither, so give it the extension.
- Keep shell scripts in `scripts/`. A `.sh` file elsewhere, such as a seeded `.claude/hooks/` script, is left out on purpose.

## Verify

`scripts/verify.ts` runs `check:shell` in its `Shell` phase wherever `package.json` declares it, between the format check and the unit tests. No stack's `scripts/verify.json` requires it, so a folder that never synced this stack skips the phase.

## lint-staged

- `.lintstagedrc` is a base seed this stack cannot reach once written. Add a `**/*.sh` entry by hand to run the checks on commit.
- That entry runs `shfmt --write --indent 2` then `shellcheck --severity=warning`.
- Do NOT copy that glob into a `package.json` script. lint-staged expands its own globs and passes matched files as arguments, which a bare shell script does not.

## CI

`.github/workflows/shell.yml` runs on pull requests targeting `main` and on `workflow_dispatch`. Its steps are checkout, setup Bun, `bun install --frozen-lockfile`, installing both tools through apt, then `check:shell`.

## CLI

| Script                 | What it does                                                    |
| ---------------------- | --------------------------------------------------------------- |
| `bun run check:shell`  | Asserts shfmt formatting, then runs shellcheck at warning level |
| `bun run format:shell` | Writes shfmt formatting in place                                |
