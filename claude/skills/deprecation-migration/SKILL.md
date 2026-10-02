---
name: deprecation-migration
description: Carries how a session retires a function, a flag, a field, a file, or a command without stranding whoever still calls it, from deciding whether to deprecate at all through proving no caller remains, migrating callers through an adapter or a strangler, and removing the old surface in its own change after the new one has carried every caller. Use when deleting or replacing code something may still call, when a deprecated path has lingered with no date, when finding dead or unowned code, or when asked "can I delete this", "how do I retire this", "how do I migrate callers off X", or "is anything still using this". Do NOT use to move or rename a file with no caller change, which is `codebase-layout`, to migrate a database schema, which the project's persistence rule governs, or to shape a new field or flag added beside an old one, which is `api-design`.
---

# Deprecation and migration

A session asked to remove something tends to grep for its name, find nothing it recognizes, and delete it. What it misses calls the thing by a string, a config key, or a copy shipped somewhere the search never looked, and the first anyone hears of it is a break in a place the diff never touched. The reverse failure is as common: a replacement ships, the old path gets a deprecation note, and nobody ever moves the callers, so both live on with no owner. This skill carries the discipline that ends with the old surface gone and every caller working.

Load it before deleting or replacing anything a caller outside the current change could reach. Skip it for code introduced on the same branch that nothing has shipped against yet.

## Decide whether to deprecate at all

Answer four questions before writing a deprecation notice, and keep the surface when the answers do not add up.

- **What does keeping it cost?** Name the concrete cost, such as a duplicate path to test, a dependency that blocks an upgrade, or a behavior that confuses readers. "It is old" is not a cost.
- **Who calls it?** Count the callers you can see and name the kinds you cannot, by the method in the zero-consumers section below.
- **What replaces it?** A deprecation with no shipped replacement only tells callers they are on their own. Build the replacement first, or keep the old surface.
- **Who migrates the callers?** Name an owner. A deprecation nobody owns stalls at the notice.

## Choose advisory or compulsory

- Start advisory: mark the surface deprecated, name the replacement, and leave it working. Callers move when they next touch the code.
- Move to compulsory only once the replacement has shipped and a removal date is stated where a caller looks, such as the warning text, the changelog, or the docs page for the surface.
- Make every warning actionable and well timed. Name the replacement and the change a caller makes, and raise it where the caller uses the old surface rather than in a log nobody reads.
- Never leave an advisory deprecation open with no date and no owner. Either schedule the move to compulsory or withdraw the deprecation.

## Migrate the callers yourself

The owner of a surface moves its callers, the Churn Rule. Announcing a deprecation and waiting for callers to migrate pushes the work onto everyone downstream, and most of them never do it.

- Migrate every caller you can reach in the repository you own, as part of the deprecation work rather than after it.
- For a caller you cannot edit, such as another team's code or a published consumer, ship a backward-compatible path or migration notes they can apply, and track them as a caller still on the old surface.
- Never add a feature to the deprecated surface. New behavior goes on the replacement, which gives callers a reason to move.

## Prove zero consumers before removal

A clean search for one spelling of the name proves only that this spelling is absent from the files searched. Check every caller kind before removing anything.

- **Imports and direct calls**, including re-exports and aliases that call it by another name.
- **String references**, such as a handler looked up by name, a command dispatched from a table, a reflection call, or a test fixture naming it.
- **Configuration**, including build files, CI workflows, environment defaults, and data files that name the surface.
- **Documentation and examples**, which callers copy from long after the code moves.
- **Copies outside the repository**, such as a published package, an installed copy in another project, a shipped binary, a script someone runs from their own machine, or a saved request in an API client.

Say which kinds your search could not reach and why, rather than reporting zero. "No callers in this repository, but a published release still exports it" is a finding a reader can act on, since it names where the remaining risk sits. A bare "no callers" is a guess.

## Bridge with an adapter or a strangler

- **Adapter.** Keep the old interface as a thin layer over the new implementation, so callers keep working while the implementation moves underneath them. The adapter holds no logic of its own and goes once its last caller moves.
- **Strangler.** Route callers to the new path a group at a time, leaving the old path serving the rest. The old path is done when it serves nothing, and only then is it removed.
- Prefer the adapter when the interface stays and the implementation changes. Prefer the strangler when callers have to change how they call.

## Expand, migrate, contract as three changes

Never add a replacement and remove the original in one change. Three separate changes keep every step reversible:

1. **Expand.** Add the replacement beside the original. Both work, and nothing calls the new one yet.
2. **Migrate.** Move callers to the replacement, in one change or several. The original still works for anything missed.
3. **Contract.** Remove the original once the zero-consumers check passes, in a change of its own.

Reverting any one step leaves a working tree. A change that expands and contracts together leaves no point where a missed caller still works, and reverting it reverts the migration too.

This sits beside the One-Version Rule `api-design` states rather than against it. Two versions live only between the expand and the contract, and the migrate step moves every caller rather than splitting them between the two.

## Treat zombie code as a decision to make

Zombie code is unowned and uncalled yet still built, tested, and shipped. It costs build time and reader attention, and it hides which code is live.

- Run the zero-consumers check on it like anything else, since "nothing calls it" is the claim to prove.
- When the check comes back clean, remove it, through expand, migrate, contract if anything outside the repository could still reach it.
- When something does still call it, it is not zombie code. Give it an owner, or deprecate it through the steps above.

Read `${CLAUDE_SKILL_DIR}/references/adopted.md` only when extending this guidance or arguing against a rule in it. It records which external sources were adopted, which declined, and why.

## Excuses and rebuttals

| Excuse                                                   | Rebuttal                                                                                                                         |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| I searched for the name and nothing calls it             | A search finds one spelling in the files it read. A handler looked up by string, a config key, or a published copy stays hidden. |
| I'll keep the fallback until callers move                | With no date and no owner, the fallback outlives every caller it was kept for. State when it goes and who removes it.            |
| The callers can migrate when they get to it              | They will not. The owner of the surface moves its callers, or the deprecation never finishes.                                    |
| It's cleaner to add the new one and drop the old one now | One change that adds and removes leaves no state where a missed caller still works, and a revert undoes the migration too.       |
| The old layout only matters on one machine               | One caller is still a caller. Migrate it, or record it as the reason the old path stays.                                         |
| Nobody owns this, so I can just delete it                | No owner is not no caller. Run the zero-consumers check before deciding, since unowned code is often the code nobody dares move. |
| I'll mark it deprecated and move on                      | A notice with no shipped replacement and no removal date tells callers nothing they can act on.                                  |

## Red flags

- You are about to delete a surface after one search for its exact name.
- A deprecation notice names no replacement or no removal date.
- The diff adds a replacement and deletes the original in the same change.
- A fallback or compatibility path has no stated condition for its removal.
- You are adding behavior to the surface being deprecated.
- Your report says "no callers" without naming the caller kinds the search could not reach.
- A caller outside the repository was found and the plan still deletes the original.

## Before handing over

Check each line against what the change produced. A line answering no is fixed or reported, never left with a note.

- The surface is deprecated only if it has a stated cost, a shipped replacement, and a named owner.
- Every compulsory deprecation states its removal date where a caller looks.
- Every caller reachable in the repository was migrated, or is named with the reason it was not.
- The zero-consumers check covered every caller kind, and the report names the kinds it could not reach.
- No change both adds the replacement and removes the original.
- Every fallback left in place states when it goes and who removes it.

## What this delegates

- Adding a field, flag, or parameter beside an old one, and the One-Version Rule for a surface callers cannot pin: `api-design`
- Moving or renaming a file with no caller change, and where a replacement file sits: `codebase-layout`
- Database schema changes and their migrations: the project's persistence rule
- Sequencing expand, migrate, and contract into committed slices on one branch: `build-in-slices`
- Listing the consumers a finished change breaks, during review: `review-craft`
