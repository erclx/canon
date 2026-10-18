# Tooling public reference

## Overview

The public stack is an add-on that ships the open-source files a public repository carries. It extends nothing and syncs beside any other stack at the same root with `canon tooling sync public . --write`.

## Seeds

A seed is copied only when its path is absent, so a project's filled `LICENSE`, `SECURITY.md`, or `CONTRIBUTING.md` is never overwritten. Fill each `<placeholder>` after the first sync.

### Policy files

These three name the project's owner and terms.

- Use MIT for `LICENSE`, which needs a year and a holder. Swap the text by hand for a different license.
- Point `SECURITY.md` and the issue chooser at GitHub private vulnerability reporting only, with no email.
- Switch private reporting on under the repository's Settings, Code security.
- Ship no `CODE_OF_CONDUCT.md`. Add one when outside contributors arrive.

### Issue forms

`bug.yml`, `feature.yml`, and `config.yml` turn blank issues off.

- Add fields specific to the project, such as its CLI's version command, by hand.

### Release files

- Start `release-please-config.json` on the `simple` release type, with `initial-version` `0.0.1` and `bump-minor-pre-major` on.
- Switch the type and add `extra-files` for a package that carries its version in a manifest.
- Start `.release-please-manifest.json` at `0.0.0`.

## Release workflow

`release-please.yml` is a config, so each sync overwrites it and a fix reaches every public repository.

- Run it on every push to `main`. It keeps one release pull request open and tags the release when that pull request merges.
- Publish nothing. A project that publishes a package adds its own workflow keyed on the release, and never edits this one.
- Open the release pull request with `RELEASE_PLEASE_TOKEN` when the secret exists, and fall back to the default token otherwise.
- Set the secret to a personal token so CI runs on the release pull request, since the default token's author does not start it.
- Keep the token read-only at the top, with `contents: write` and `pull-requests: write` on the one job.

## Dependabot

`dependabot.yml` is how an existing repository keeps its seeded workflows' action majors current, since a seed never updates after install.

- Update `github-actions` weekly with an `ci` commit prefix.
- Group minor and patch updates into one pull request per run, and leave majors ungrouped so each arrives alone.

## Beside another stack

Run `canon tooling sync public . --write` on a repository that already carries a stack. The install stamp keeps the core chain and lists the add-on after it.
