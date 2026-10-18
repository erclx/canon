# Tooling public reference

## Overview

The public stack is an add-on that ships the open-source files a public repository carries. It extends nothing and syncs beside any other stack at the same root with `canon tooling sync public . --write`.

## Seeds

- Copy a seed only when its path is absent, so a project's filled `LICENSE`, `SECURITY.md`, or `CONTRIBUTING.md` is never overwritten.
- Fill each `<placeholder>` after the first sync. `LICENSE` needs a year and a holder, and the rest need the owner, the repository, and the project's own setup steps.
- Use MIT for `LICENSE`. Swap the text for a different license by hand.
- Point `SECURITY.md` and the issue chooser at GitHub private vulnerability reporting only, with no email. Switch it on under the repository's Settings, Code security.
- Ship `bug.yml`, `feature.yml`, and `config.yml` with blank issues off. Add fields specific to the project, such as its CLI's version command, by hand.
- Ship no `CODE_OF_CONDUCT.md`. Add one when outside contributors arrive.
- Start `release-please-config.json` on the `simple` release type with `initial-version` `0.0.1` and `bump-minor-pre-major` on. Switch the type, and add `extra-files`, for a package that carries its version in a manifest.
- Start `.release-please-manifest.json` at `0.0.0`.

## Release workflow

- Run `release-please.yml` on every push to `main`. It keeps one release pull request open and tags the release when that pull request merges.
- Publish nothing. A project that publishes a package adds its own workflow keyed on the release, and never edits this one, since each sync overwrites it.
- Open the release pull request with `RELEASE_PLEASE_TOKEN` when the secret exists, and fall back to the default token otherwise. A pull request authored by the default token does not start CI, so set the secret to a personal token for checks to run on it.
- Set the token to read-only at the top and grant `contents: write` and `pull-requests: write` on the one job.

## Dependabot

- Update `github-actions` weekly with an `ci` commit prefix.
- Group minor and patch updates into one pull request per run. Leave majors ungrouped, so each action major arrives as its own pull request.
- Reach an existing repository through this file. A seeded workflow never updates after install, so Dependabot is what keeps its action majors current.

## Beside another stack

- Run `canon tooling sync public . --write` on a repository that already carries a stack. Both chains stay recorded in the install stamp.
