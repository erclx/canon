---
description: Require a dependency to be declared in the manifest before it is imported
paths:
  - '**/*.ts'
  - '**/*.tsx'
  - '**/*.js'
  - '**/*.jsx'
  - '**/*.py'
  - '**/*.go'
  - '**/*.php'
  - '**/package.json'
  - '**/pyproject.toml'
  - '**/go.mod'
  - '**/composer.json'
---

# Dependency standards

## Declaration

- Declare a package in the project manifest before importing it anywhere in the source.
- Add a package with the command that writes the manifest and lockfile together, such as `bun add`, `uv add`, `go get`, or `composer require`. Re-lock in the same change after a hand edit.
- Commit the lockfile with the manifest change in the same commit.
- Declare a package used only by tests, builds, or tooling as a development dependency.
- Never import a package that arrives only as a transitive dependency of another package.

## Removal

- Remove a package from the manifest in the change that removes its last import.
