---
description: Require a dependency to be declared in the manifest before it is imported
paths:
  - '**/*.ts'
  - '**/*.tsx'
  - '**/*.js'
  - '**/*.jsx'
  - '**/*.py'
  - '**/package.json'
  - '**/pyproject.toml'
---

# Dependency standards

## Declaration

- Declare a package in the project manifest before importing it anywhere in the source.
- Add a package with the package manager command that writes the manifest and the lockfile together, such as `bun add` or `uv add`. Never hand-edit the manifest and never install without recording the result.
- Commit the lockfile with the manifest change in the same commit.
- Declare a package used only by tests, builds, or tooling as a development dependency.
- Never import a package that arrives only as a transitive dependency of another package.

## Removal

- Remove a package from the manifest in the change that removes its last import.
