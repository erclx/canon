---
title: Scripts
subtitle: Bash entry points and the migration boundary, repo maintenance, UI framing across the exec boundary, the shared lib surface, and the frozen eval records. Start with overview.
---

# Scripts

Bash entry points and the migration boundary, repo maintenance, UI framing across the exec boundary, the shared lib surface, and the frozen eval records. Start with overview.

- [Core scripts](core.md): Repo maintenance scripts, the guard stages check fires, and the bare-flag repair that runs ahead of them
- [Eval records](eval.md): What each arm measured, the ablation findings, the frozen records a run left, and the limits the results report past
- [UI framing](framing.md): Which domains still shell out, who opens the timeline frame once a dispatcher is gone, and the stream contract framing rests on
- [lib](lib.md): The three shared bash libraries, the functions each exports, and where the TypeScript equivalents sit
- [Overview](overview.md): What the scripts domain owns, the folder layout, and the decisions behind what has not moved to TypeScript yet
