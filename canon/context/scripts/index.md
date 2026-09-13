---
title: Scripts
subtitle: Bash entry points and the migration boundary, repo maintenance, UI framing across the exec boundary, the shared lib surface, and the eval harness. Start with overview.
---

# Scripts

Bash entry points and the migration boundary, repo maintenance, UI framing across the exec boundary, the shared lib surface, and the eval harness. Start with overview.

- [Core scripts](core.md): Repo maintenance scripts, the guard stages check fires, and the bare-flag repair that runs ahead of them
- [Eval harness](eval.md): Arms and what each measures, the ablation strip, the two records a run leaves, and the limits a run cannot report past
- [UI framing](framing.md): Which domains still shell out, who opens the timeline frame once a dispatcher is gone, and the stream contract framing rests on
- [lib](lib.md): The four shared bash libraries, the functions each exports, and where the TypeScript equivalents sit
- [Overview](overview.md): What the scripts domain owns, the folder layout, and the decisions that set what stays bash
