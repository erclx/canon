---
name: canon-feedback
description: Why a toolkit defect is reported from session context alone, and what opening an issue through the CLI replaces
---

# Canon feedback requirement

## Gap

Without this skill, a toolkit defect noticed in a target project dies with the session. The user retypes a report later without the context, so it is reported badly or not at all. A block printed in chat needs a copy-paste into another repository, which gets skipped under time pressure, and a report naming no surface cannot be routed.

Asked to report, a session also starts diagnosing, which spends the context the report was meant to capture and yields a diagnosis from a project that cannot see the toolkit's source.

## Must

- Build the report from what the session already holds, name the surface and its type, and write the stated fallback for a field it cannot fill
- Carry the whole request in the issue body alone, since a body and a comment that differ leave triage choosing
- Open a GitHub issue on the toolkit repository through the CLI and print the returned URL on its own line
- Surface the block and the reason when the issue call fails or the CLI is absent, so the report still exists
- Hold a report the operator marks sensitive, since the issue is public

## Must not

- Probe the project, list files, grep, or read toolkit surfaces to enrich the report
- Guess the surface type when the session is ambiguous
- Diagnose or fix, which needs the toolkit's source rather than the target's
- Report from a session holding nothing that points at a toolkit issue

## Out of scope

- Fixing the defect, which happens in the toolkit repository against its own source
- Draining the queue this fills, which `canon-feedback-triage` owns
- Filing an issue against the current project, which `git-issue` owns
- Complaints about tooling the toolkit does not own
