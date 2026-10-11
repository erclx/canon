---
title: Rule detection
description: Proposing opt-in governance rules from a target's dependencies and paths, the evidence file the verb reads, the record it emits, and its exit codes
---

# Rule detection

`canon gov detect` proposes the opt-in governance rules a target's evidence points at, and writes nothing. A rule no stack names reaches a project only through this verb, which `canon:target-setup` calls before it previews an install.

```bash
canon gov detect
canon gov detect ../my-app --stack node --json
```

| Option            | Behavior                                         |
| ----------------- | ------------------------------------------------ |
| `--stack <stack>` | Leave out every rule this stack already resolves |
| `--json`          | Emit the record on stdout instead of the frame   |

## Evidence

Each opt-in rule keeps a table in the toolkit's `governance/detect.toml`, keyed by rule basename. Its `deps` are package names, read from `package.json` (`dependencies` and `devDependencies`), `pyproject.toml`, `go.mod`, and `composer.json`. Its `files` are globs matched against the target's git-listed paths and against each folder on those paths, so `.github/workflows` matches a folder holding a workflow. A glob with no wildcard is also tested on disk, which is how `.canon/canvas` matches in a target that gitignores `.canon/`.

Both reads stop at depth two, which reaches a service folder and a workspace package under `packages/<name>/`. Outside git the verb walks the directory to the same depth and skips `.git`, `node_modules`, `vendor`, and `.venv`. A manifest that does not parse contributes nothing.

## Record

```json
{
  "target": "/abs/path/my-app",
  "stack": "node",
  "proposals": [
    {
      "rule": "200-react",
      "evidence": [{ "kind": "dep", "match": "react", "path": "package.json" }]
    }
  ]
}
```

`kind` is `dep` for a dependency, with `path` naming the manifest that declares it, or `file` for a glob, with `path` naming what it matched. `stack` is null when no `--stack` was passed.

## Exit codes

The verb exits 0 on every readable target, including one with no evidence, which returns an empty `proposals` array. A target that does not exist and a `--stack` that does not resolve each exit 1 with the reason on stderr.

Install what the operator kept with `canon gov install --add <rules> <target>`, which needs no stack.
