---
name: canon-feedback
description: Why a toolkit defect is reported from session context alone, and what opening an issue through the CLI replaces
---

# Canon feedback requirement

## Gap

Without this skill, a toolkit defect noticed inside a target project dies with the session. The user is told to mention it in the toolkit repository later, which means retyping a report they no longer have the context to write, so the defect is either reported badly or not at all.

The report itself fails two ways. A block printed in chat needs a copy-paste into another repository, and a step that manual is skipped under any time pressure. A report that names no surface cannot be routed, because the toolkit acts on a plugin skill, a CLI command, and a seed through different paths, and the difference is not recoverable from the symptom.

The last failure is the session's own effort. Asked to report, a session starts diagnosing instead, searching the toolkit and reading its surfaces to find the cause. That spends the context the report was meant to capture cheaply, and it produces a diagnosis from a project that cannot see the toolkit's current source.

## Must

- Build the report from what the session already holds
- Name the surface and its type, since the toolkit routes on that rather than on the symptom
- Write the stated fallback for a field the session cannot fill, so an empty field reads as absent rather than as unreported
- Open a GitHub issue on the toolkit repo through the CLI so the report lands where triage reads it, and print the returned URL on its own line
- Say which file and which reason when the issue call fails and the report falls back to a local folder, since a silent fallback leaves it where nothing reads it
- Hold a report the operator marks sensitive, since the issue is public
- Fall back to printing the block when the CLI is absent, so the report still exists

## Must not

- Probe the project, list files, grep, or read toolkit surfaces to enrich the report
- Guess the surface type when the session is ambiguous. Ask one line.
- Diagnose or fix, which needs the toolkit's source rather than the target's

## Guards

- Nothing in session context pointing at a toolkit issue stops, since a report assembled from nothing wastes the triage it reaches

## Out of scope

- Fixing the defect, which happens in the toolkit repository against its own source
- Draining the queue this fills: `canon-feedback-triage`
- Filing an issue against the current project, which `git-issue` does and this skill cannot delegate to, since that skill targets the current repository
- Complaints about tooling the toolkit does not own
