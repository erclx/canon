---
title: Deprecation and migration skill ledger
description: Sources for claude/skills/deprecation-migration/SKILL.md, one row per bullet or ordered step in its concern groups
---

# Deprecation and migration skill ledger

The field is retiring a surface its callers still reach. Software Engineering at Google carries deprecation policy and the Churn Rule, Martin Fowler carries parallel change and the strangler fig, and Addy Osmani's `agent-skills` carries the bridges and zombie code. The closing sections and `## What this delegates` restate these rules or route, so they take no table.

## Decide whether to deprecate at all

| Bullet                   | Source                                                                                                                                                                                               | Read       |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| What keeping it costs    | [Software Engineering at Google, ch. 15](https://abseil.io/resources/swe-book/html/ch15.html): "code is a liability, not an asset", with costs "borne as a system is maintained across its lifetime" | 2026-10-24 |
| Who calls it             | [Software Engineering at Google, ch. 15](https://abseil.io/resources/swe-book/html/ch15.html): tools that "statically determine which customers use a given library"                                 | 2026-10-24 |
| What replaces it         | [Software Engineering at Google, ch. 15](https://abseil.io/resources/swe-book/html/ch15.html): "deprecation usually isn't an option until a newer system is available"                               | 2026-10-24 |
| Who migrates the callers | [Software Engineering at Google, ch. 15](https://abseil.io/resources/swe-book/html/ch15.html): "without explicit owners, a deprecation process is unlikely to make meaningful progress"              | 2026-10-24 |

## Choose advisory or compulsory

| Bullet                                 | Source                                                                                                                                                                                                                                                                                          | Read       |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| Start advisory                         | [Software Engineering at Google, ch. 15](https://abseil.io/resources/swe-book/html/ch15.html): "Advisory deprecations are those that don't have a deadline", for a system "the team knows" has "been replaced"                                                                                  | 2026-10-24 |
| Compulsory once a removal date stands  | [Software Engineering at Google, ch. 15](https://abseil.io/resources/swe-book/html/ch15.html): compulsory deprecation "usually comes with a deadline for removal of the obsolete system"                                                                                                        | 2026-10-24 |
| Actionable and well-timed warnings     | [Software Engineering at Google, ch. 15](https://abseil.io/resources/swe-book/html/ch15.html): a warning is actionable when "the user can use the warning to actually perform some relevant action", and relevant "if it surfaces at a time when a user actually performs the indicated action" | 2026-10-24 |
| No open advisory without date or owner | [Software Engineering at Google, ch. 15](https://abseil.io/resources/swe-book/html/ch15.html): advisory deprecation "often lacks enforcement: we hope that clients move, but can't force them to"                                                                                               | 2026-10-24 |

## Migrate the callers yourself

| Bullet                             | Source                                                                                                                                                                                                           | Read       |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| Migrate every caller you can reach | [Software Engineering at Google, ch. 1](https://abseil.io/resources/swe-book/html/ch01.html): "infrastructure teams must do the work to move their internal users to new versions themselves", the Churn Rule    | 2026-10-24 |
| A compatible path for the rest     | [Software Engineering at Google, ch. 1](https://abseil.io/resources/swe-book/html/ch01.html): the Churn Rule's other branch, "or do the update in place, in backward-compatible fashion"                         | 2026-10-24 |
| No new feature on the old surface  | [Fowler, Strangler Fig](https://martinfowler.com/bliki/StranglerFigApplication.html): the move "begins with small additions, often new features, that are built on top of, yet separate to the legacy code base" | 2026-10-24 |

## Prove zero consumers before removal

| Bullet                        | Source                                                                                                                                                                                                                               | Read       |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- |
| Imports and direct calls      | [Software Engineering at Google, ch. 15](https://abseil.io/resources/swe-book/html/ch15.html): Code Search and Kythe "statically determine which customers use a given library"                                                      | 2026-10-24 |
| String references             | House choice: a handler, command, or fixture looked up by name passes an import search and fails at runtime once the surface goes                                                                                                    | 2026-10-24 |
| Configuration                 | [agent-skills, deprecation and migration](https://github.com/addyosmani/agent-skills/blob/2686b620/skills/deprecation-and-migration/SKILL.md): removal includes "Remove associated tests, documentation, and configuration"          | 2026-10-24 |
| Documentation and examples    | [agent-skills, deprecation and migration](https://github.com/addyosmani/agent-skills/blob/2686b620/skills/deprecation-and-migration/SKILL.md): its zombie signs include "Documentation that references systems that no longer exist" | 2026-10-24 |
| Copies outside the repository | [Fowler, Parallel Change](https://martinfowler.com/bliki/ParallelChange.html): a change is hardest "on a PublishedInterface with multiple or external clients", for whom migration "will be the longest phase"                       | 2026-10-24 |

## Bridge with an adapter or a strangler

| Bullet                           | Source                                                                                                                                                                                                                                     | Read       |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- |
| Adapter                          | [agent-skills, deprecation and migration](https://github.com/addyosmani/agent-skills/blob/2686b620/skills/deprecation-and-migration/SKILL.md): "Create an adapter that translates calls from the old interface to the new implementation." | 2026-10-24 |
| Strangler                        | [Fowler, Strangler Fig](https://martinfowler.com/bliki/StranglerFigApplication.html): "we move bits of behavior from the legacy system into the new code base", with bridging code "that will go away once the modernization is complete"  | 2026-10-24 |
| Adapter when the interface stays | [agent-skills, deprecation and migration](https://github.com/addyosmani/agent-skills/blob/2686b620/skills/deprecation-and-migration/SKILL.md): under an adapter "Consumers keep using the old interface while you migrate the backend"     | 2026-10-24 |

## Expand, migrate, contract as three changes

| Step     | Source                                                                                                                                                                                                    | Read       |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| Expand   | [Fowler, Parallel Change](https://martinfowler.com/bliki/ParallelChange.html): "In the expand phase you augment the interface to support both the old and the new versions."                              | 2026-10-24 |
| Migrate  | [Fowler, Parallel Change](https://martinfowler.com/bliki/ParallelChange.html): "During the migrate phase you update all clients using the old version to the new version. This can be done incrementally" | 2026-10-24 |
| Contract | [Fowler, Parallel Change](https://martinfowler.com/bliki/ParallelChange.html): "Once all usages have been migrated to the new version, you perform the contract phase to remove the old version"          | 2026-10-24 |

## Treat zombie code as a decision to make

| Bullet                              | Source                                                                                                                                                                                                                                            | Read       |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| Run the zero-consumers check on it  | [agent-skills, deprecation and migration](https://github.com/addyosmani/agent-skills/blob/2686b620/skills/deprecation-and-migration/SKILL.md): removal waits until you "Verify zero active usage (metrics, logs, dependency analysis)"            | 2026-10-24 |
| Remove it when the check is clean   | [agent-skills, deprecation and migration](https://github.com/addyosmani/agent-skills/blob/2686b620/skills/deprecation-and-migration/SKILL.md): against "Someone might need it later", "If it's needed later, it can be rebuilt."                  | 2026-10-24 |
| An owner or a deprecation otherwise | [agent-skills, deprecation and migration](https://github.com/addyosmani/agent-skills/blob/2686b620/skills/deprecation-and-migration/SKILL.md): "Either assign an owner and maintain it properly, or deprecate it with a concrete migration plan." | 2026-10-24 |
