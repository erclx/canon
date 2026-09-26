---
title: Commit reference
description: Commit message format and type conventions
---

# Commit message reference

## Scope

Governs a git commit message: subject structure, the type and scope vocabulary, and the body.

Does not govern:

- Branch naming, which shares the type vocabulary: `branch.md`
- Pull request title and body, which share the subject form: `pr.md`
- Whether a phase label or a semver tag may appear in a subject: `versioning.md`

## Format

- Structure: `<type>(<scope>): <subject>`, with `!` before the colon for a breaking change
- Casing: lowercase for `<type>`, `<scope>`, and first word of `<subject>`
- Subject: 72 characters maximum, no trailing period

## Types

- `feat`: new feature or capability
- `fix`: bug fix
- `refactor`: structural changes (not a fix or feature)
- `docs`: documentation only (README)
- `chore`: maintenance tasks (deps, tooling, configs)
- `perf`: performance improvements
- `test`: add or modify tests
- `style`: code formatting (whitespace, semicolons)
- `build`: build system changes (webpack, npm scripts)
- `ci`: CI/CD pipeline changes (GitHub Actions)
- `revert`: revert a previous commit

## Scope vocabulary

- Single lowercase word representing a system component
- Prefer single word
- Use kebab-case only when two words are genuinely needed for specificity
- Do not use specific filenames as scopes
- Do not use a scope that duplicates the type
- Write scopes for release readability. They surface in `changelogithub` release notes.

## Subject

- Use imperative mood (`add` not `added`)
- Describe the actual technical change, not that something changed
- Do not use vague verbs (`improve`, `refine`, `enhance`)
- Do not repeat the scope in the subject line
- Use single quotes if quoting
- No backslash escaping or internal double quotes
- No conversational filler or introductory phrases

## Trailers

- Do not add a `Co-authored-by` trailer crediting Claude or Anthropic, by name or by address
- The `commit-msg` hook refuses a commit carrying one, so remove the line and commit again

## Examples

### Correct

```plaintext
feat(api): add retry logic for failed webhooks       # specific verb + clear change
fix(auth): update 'UserSession' validation logic     # scoped + imperative + single quotes
```

### Incorrect

```plaintext
fix(user-auth): Fixed the redirect loop.    # wrong casing + period + multi-word scope
docs(docs): update the readme.              # duplicate scope + period
docs(api): improve documentation            # vague verb + lacks specificity
```
