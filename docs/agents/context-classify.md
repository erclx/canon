---
title: Doc classifier
description: Classifying canonical-doc content as keep, replace/rewrite, history, or move in diff and sweep mode, the classifier setting pair, the record shape, and the exit codes
---

# Doc classifier

`canon context classify` reads content from the five canonical doc types (`context/<domain>.md`, `ARCHITECTURE.md`, `wireframes/<surface>.md`, `DESIGN.md`, `REQUIREMENTS.md`) and reports whether each piece states the project as it stands or should be rewritten, narrated elsewhere, or moved to another surface. It reports and never gates: a finding is a judgment for a writer to act on, not a fact a push fails over. Wiring it into `docs-fold`, the merge gate, or `canon context audit` is separate work this verb does not do.

Two modes read different units. Diff mode reads the chunks a git range changed, each with the section it landed in, which is what a session checks right after an edit. Sweep mode reads every section of the five doc types, split at H3, which is what a cleanup pass or a periodic re-scan runs over a whole corpus.

```bash
canon context classify diff
canon context classify diff --base origin/main --json
canon context classify diff --doc-types context,wireframes
canon context classify sweep
canon context classify sweep --doc-types design,requirements --json
```

| Option               | Behavior                                                       |
| -------------------- | -------------------------------------------------------------- |
| `--base <ref>`       | Diff mode only. Far side of the range, defaulting to the trunk |
| `--doc-types <list>` | Comma-separated canonical doc types (default: all five)        |
| `--backend <name>`   | Override the resolved model backend for this run               |
| `--model <name>`     | Override the resolved model name for this run                  |
| `--json`             | Add a machine-readable record on stdout                        |

## Two layers

The regex layer always runs. It is free, needs nothing installed, and catches narration (a branch name, "closed on", "did not survive") and a source file path named inside a wireframe. It never answers REPLACE in diff mode, since telling a restated figure from a genuinely new one needs the section a hunk landed in, which the model layer reads and the regex layer does not.

The local Ollama layer runs only when configured, through `canon context classifier`. When it runs, its call is one chunk or section per request, never batched: the groundwork measurement behind this verb found that batching 16 hunks into one call returned KEEP for every one of them. Thinking is always off, since it was measured to catch nothing thinking-off missed while running roughly five times slower and, in sweep mode, losing three real flags by reasoning past them.

A finding carries both layers' readings when the model ran. The `verdict` field takes the model's reading when it ran and parsed, and falls back to the regex reading otherwise, since the model catches shapes the regex layer cannot reach structurally. `decidedBy` names which one won.

A configured-but-unreachable backend warns on stderr and falls back to the regex layer alone. The run still exits clean: the record's `modelLayer` field names why the model layer did not run (`off`, `skipped-no-model`, `skipped-unreachable`, or `ran`), so a clean regex-only report never reads as a clean model pass.

## The classifier setting

```bash
canon context classifier show
canon context classifier show --json
canon context classifier set --backend ollama --model qwen3.8:27b
canon context classifier set --backend off
```

The backend and model resolve independently through the same four-tier precedence: a flag on the verb, then `CANON_CLASSIFIER_BACKEND` / `CANON_CLASSIFIER_MODEL`, then `canon/config/classifier.toml`, then off. `classifier show` reports the resolved backend and model and which tier decided them, without running a classification. There is no default model name: a model that resolves on one machine means nothing on another, so a backend configured with no model reports `no-model` from `show` and runs the regex layer alone from `classify`.

`classifier set` writes `canon/config/classifier.toml`, creating `canon/config/` when a project does not carry it yet:

```toml
[classifier]
backend = "ollama"
model = "qwen3.8:27b"
```

`--backend off` writes a file with no `model` line, which reads back as `off` at the same tier a missing file would default to, but with a source line saying the file decided it rather than the default.

## The record

```json
{
  "decision": "ok",
  "mode": "diff",
  "backend": "ollama",
  "model": "qwen3.8:27b",
  "modelLayer": "ran",
  "settingsSource": "file",
  "findings": [
    {
      "file": "canon/context/retrieval.md",
      "docType": "context",
      "regex": {
        "verdict": "KEEP",
        "quote": "",
        "reason": "no narration or wrong-surface pattern"
      },
      "model": {
        "verdict": "REPLACE",
        "quote": "the count moved",
        "reason": "restates a figure the section already carries"
      },
      "verdict": "REPLACE",
      "decidedBy": "model"
    }
  ]
}
```

Sweep mode's findings carry a `heading` field alongside `file` and use the sweep vocabulary (KEEP, REWRITE, MOVE) rather than diff mode's four (KEEP, REPLACE, HISTORY, MOVE). REWRITE stands in for both REPLACE and HISTORY, matching the sweep prompt's own three-verdict vocabulary: a whole section already shows its own history in view, so there is no diff-mode split left to make.

## Exit codes

| Code | Meaning                                                       |
| ---- | ------------------------------------------------------------- |
| `0`  | the run completed, whatever the findings say                  |
| `1`  | refused: a bad range, an unreadable file, or a malformed flag |

Findings never set a failing exit code, in either mode. Diff mode refuses on a git range it cannot resolve. Both modes refuse on a file the run could not read.
