---
title: Branch reference
description: Branch naming format and type conventions
---

# Branch reference

## Scope

Governs a git branch name: its structure, its length, and the type vocabulary it draws from.

Does not govern:

- Commit subject format, which shares the type vocabulary: `commit.md`
- Pull request title and body: `pr.md`
- Whether a phase label may appear in a branch name: `versioning.md`
- Deriving a slug from a branch name for use in an output filename: `slug.md`

## Format

- Structure: `<type>/<description>` or `<type>/<ticket>-<description>`
- Length: 50 characters maximum
- Casing: kebab-case only, no underscores or camelCase
- Description: 2 words maximum, up to 4 only when genuinely needed for specificity

### Description content

The description names the change, and 2 words stays the target.

- Capture the core change, not the commit message verbatim
- For branches with multiple commits, use the unifying concern as the description.
- Do not duplicate type in description (e.g., `feat/feature-login`)

### Why the bound reads 4

The upper bound reads 4 for every branch, whoever named it, so a branch taking its description from a planning document's filename is not renamed at ship. A rename there is a third derivation, and it parts the branch from the filename later tooling reads back to find the document.

Nothing can tell such a name from any other, so the wider bound holds for all of them.

## Types

| Type       | Use                                         |
| ---------- | ------------------------------------------- |
| `feat`     | new feature or capability                   |
| `fix`      | bug fix                                     |
| `refactor` | structural changes (not a fix or feature)   |
| `docs`     | documentation only (README)                 |
| `chore`    | maintenance tasks (deps, tooling, configs)  |
| `perf`     | performance improvements                    |
| `test`     | add or modify tests                         |
| `style`    | code formatting (whitespace, semicolons)    |
| `build`    | build system changes (webpack, npm scripts) |
| `ci`       | CI/CD pipeline changes (GitHub Actions)     |
| `revert`   | revert a previous commit                    |

## Examples

### Correct

Each line names its reason after the `#`.

```plaintext
feat/jwt-expiration                    # clear feature scope
fix/AUTH-123-connection-pool           # includes ticket ID
refactor/remove-deprecated-endpoints   # clear refactor intent
```

### Incorrect

Each line names its fault after the `#`.

```plaintext
feature/auth_stuff                                        # wrong type + underscore
feat/feature-add-login                                    # duplicates type in description
fix/DB-456-fix-the-database-connection-pool-memory-leak   # exceeds 50 chars + verbatim message
```
