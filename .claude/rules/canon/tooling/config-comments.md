---
description: Keep comments in dotfiles, config, and workflow files to what a key does or accepts, true, and free of history
paths:
  - '**/.env*'
  - '**/.gitignore'
  - '**/.dockerignore'
  - '**/.editorconfig'
  - '**/Dockerfile*'
  - '**/*.config.*'
  - '**/*.json'
  - '**/*.yml'
  - '**/*.yaml'
  - '**/*.toml'
  - '**/*.jsonc'
---

# Config comment standards

## Comments

- Comment what a key does or its allowed values. Do not restate the key name.
- Hold a block of contiguous comment lines to 3 lines of text, split by a blank line. `canon comments scan` counts a commented-out key as text, and the gate fails a changed block past 3.
- Keep each comment true of the key it sits on, and update or delete one a change invalidates in that same change.
- Do not carry a date, a commit hash, an issue number, or a `TODO`. The pull request and the tracker hold them, and `canon comments scan` flags each one.
