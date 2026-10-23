---
title: Onboarding to a domain
description: The context lookup, the safe run form per surface kind, and the not-run record a planner takes before reading code
---

# Onboarding to a domain

Applies to the first two reads of `plan-feature` Step 1 and Step 2, taken ahead of the source. They go cheapest first, being the context entry, then one run of the existing thing, then the code. A plan starting from the source alone inherits whatever the running code gets wrong.

## Read the context entry

- Run `canon indexes list --json canon/context` and read the entries whose title or description matches the domain, rather than walking the folder
- Report none and continue to the run when the project has no `canon/context/` folder or no entry matches
- Treat an entry as a claim about the code, to be confirmed by the run

## Run the existing thing once

When the feature changes a verb, a route, or a rendered surface that already exists, run it once in a form that writes nothing. Record the command and what it showed.

| Surface kind     | Safe form                                                                    |
| ---------------- | ---------------------------------------------------------------------------- |
| CLI verb         | its read verb, or the `--check` or `--dry-run` form, with `--help` for flags |
| Route or API     | one read request against a running instance                                  |
| Rendered surface | a capture against a running preview                                          |
| Anything else    | the project's own read command, or a sandbox scenario                        |

Three rules hold across every kind:

- Write only the plan, so never run a form that writes to the tree being planned against
- Send a verb with no read form to a sandbox scenario or a temporary copy, and name which
- Skip the step for a feature touching nothing that runs, such as prose or a config seed

## Record a run that did not happen

Write the surface as not run with the reason, such as a broken build, a preview that will not start, or a verb with no read form that no sandbox scenario or temporary copy can reach. A skipped run with no record reads the same as one nobody considered.

Step 3 writes each run, or its not-run reason, into `## Current behavior`.
