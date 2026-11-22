---
title: First pull request
description: The checklist the setup report closes on, naming each step the first pull request after the root commit needs and the verb or setting that does it
---

# First pull request

The setup report closes on this checklist. Each step writes to the remote, so the report names the step and what does it, and this skill runs none of them. Without the list, each step surfaces one at a time as the first pull request fails on it.

Fill each line for the project that just landed, and drop a line whose condition does not hold.

## Amend the root commit

A service or fix decided after the root commit goes to a scratch branch first. Push it there, let CI run on it, and force `main` only once that run passes, since an amend forced straight to `main` ships a commit no CI has seen.

- The route covers the root commit alone, before a ruleset protects `main`
- A history already pushed under a ruleset takes a pull request instead, never a force push

## Protect the trunk

- Add a branch ruleset on `main` under the repository's Settings, Rules, Rulesets, or through `gh api repos/<owner>/<repo>/rulesets`. Require a pull request before merging and block force pushes.
- Name the required status checks from the jobs the root `.github/workflows/` carries, plus each job a planned service's subtree sync named for the root CI
- Add the ruleset after the root commit is final, since a ruleset blocking force pushes closes the amend route above

## Release token

On a public run only, set the `RELEASE_PLEASE_TOKEN` secret so CI runs on the release pull request. Read `canon tooling reference public` for the token's scope and why the default token does not start CI. A private run drops this line.

## Labels

The label map at `canon/config/pr-labels.toml` covers what the toolkit installs, so a project's own surfaces reach no row yet.

- Add a row for each service folder and each surface of the project's own, then run `canon labels audit` to list the paths still reached by no row
- Run `canon labels sync` once the rows are in, which creates each label the map names that the remote lacks
- Both need the GitHub remote, so name them as follow-ups when setup ran before it existed
