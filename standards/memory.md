---
title: Memory reference
description: Filename and type prefix, frontmatter, the body shape per type, links between entries, and the lifecycle from write to retire
---

# Memory reference

Applies to a memory entry at `.canon/memory/<type>-<slug>.md`. One file holds one rule or one fact, written at the end of the session that produced it and read by a session that holds none of it. Which surface owns a given fact is settled before an entry is written at all, and that routing is project policy rather than a shape rule.

The folder is gitignored and backed by `canon records push` and `canon records pull`, which protects it against the machine being lost but not against an entry deleted before anyone has pushed. That is why the retire step below is a move rather than a cleanup: a retired entry stays readable regardless of push timing, where a deleted one is gone the moment nothing has captured it yet.

## Scope

Governs a memory entry under `.canon/memory/<type>-<slug>.md`: the filename and its type prefix, the frontmatter, the body shape each type carries, links between entries, and the lifecycle from the first write to retirement.

Does not govern:

- The per-domain entry a domain fact is routed to instead of memory: `context.md`
- The feature plan a session executes, and its answer contract: `plan.md`
- The task file tracking what is being built: `tasks.md`
- Voice, rhythm, and sentence construction: the `write-human` skill
- Headings, punctuation, word choice, and file references: `markdown.md`
- Which facts a project captures at all, and where the folder sits, which are project policy

## What a working entry looks like

An entry works when a session holding none of the conversation that produced it can act on the rule from the file alone:

- What is the rule or the fact, stated in one line?
- What happened in a session to earn it, so a later reader can tell whether it still holds?
- When does it fire next, and what does the reader do at that moment?
- Does another surface already own this, which would make the entry a duplicate of something sessions trust more?

An entry failing these is non-conforming even when it satisfies every shape rule below.

## Types

Four types, and the type decides both the filename prefix and the body shape.

| Type        | Holds                                                                | Fires on                                    |
| ----------- | -------------------------------------------------------------------- | ------------------------------------------- |
| `feedback`  | a correction or a confirmed approach governing how the agent works   | explicit correction, or the same slip twice |
| `project`   | a decision, constraint, or measured fact not derivable from the code | first disclosure                            |
| `user`      | role, expertise, responsibilities, or working preferences            | first disclosure                            |
| `reference` | a pointer to an external system, repository, or channel              | first disclosure                            |

Hold a feedback entry to the higher bar. A first-occurrence slip is noise, and a folder that records every one of them buries the rules that were paid for.

Write no entry for a fact another surface already owns. A fact about a domain belongs in that domain's entry, where sessions working the domain already read it, and the same fact in memory sits in a folder nothing opens. Memory keeps the residue, which is whatever the ownership test leaves rather than any one type.

## Filename

- Name the file `<type>-<slug>.md`, with `<type>` one of the four above and `<slug>` kebab-case naming the rule rather than the incident.
- Write one rule per file. Two rules under one slug cannot be retired or promoted separately, and one of them always outlives the other.
- Keep the prefix and the `category` field the same fact in two spellings. A prefix outside the four types reads as a fifth type to anything grouping the folder, and it silently belongs to none.

## Frontmatter

Every entry carries all three fields.

```yaml
---
title: A scope glob wide enough for a correct run can be wide enough for every wrong one
description: Omit a declaration key whose only passing value admits the whole tree
category: Project
---
```

- `title` (required): the rule stated as a line a reader can act on, in sentence case.
- `description` (required): one line naming what the entry settles, so a reader scanning the catalog decides whether to open it.
- `category` (required): the type in sentence case, which is what groups the catalog.

Never write the filename stem as the `title`. The stem is a slug, and an entry titled with it reads as an unwritten file in every catalog that renders the field.

Quote a `description` opening with a backtick or a colon. An unquoted one fails to parse and takes the whole folder's catalog with it.

## Body

A `feedback` or `project` body carries three parts in this order. Blank lines between them are optional and the three parts are not.

- The rule or the fact, stated in one or two sentences as something to do rather than something that happened.
- A `**Why:**` line naming the session signal that earned it. This is what a later reader tests the rule against when the tree has moved.
- A `**How to apply:**` line naming the next moment the rule fires and what to do then.

A `user` or `reference` body is a single sentence and carries neither marker. There is no rule to apply and no signal to date, so the two lines would be filler.

Capture the pattern rather than the recovery. What was tried, what failed, and who noticed belong to the session that is ending, and a body carrying them is a story where the next reader needs an instruction.

## Links

Link a related entry as `[[name]]`, where `name` is the target's filename stem without the extension. Link freely: the folder is flat and the links are the only structure it has.

- Place links inside the body part they support, not in a list of their own at the end.
- A link naming an entry nobody has written yet is legal, and it marks a rule worth writing rather than a defect.
- A bracketed token inside a code span is not a link. Backticked syntax from another language routinely reads as one.

## Lifecycle

- Check the folder for an entry on the same topic before writing a new one, and update that entry in place when one exists. Two entries on one rule disagree the moment either is edited.
- Rewrite an entry the tree has moved under rather than appending a second passage narrating the change. A reader cannot tell which of two claims is current.
- Never delete an entry. Retire one by moving it to an archive under its own name, because a bulk judgment made before the next push has no undo behind it, and moving keeps the record where deleting would not.
- Treat the folder as a holding pen rather than a destination. An entry whose rule belongs on a durable surface is promoted there and retired here, and the rest is what the pen is for.

The catalog is generated from sibling frontmatter rather than authored. Never hand-edit it, since the next regeneration discards whatever was added by hand.

## Collecting a review receipt

A review of the pen writes a receipt recording what it proposed per entry and what was decided. The receipt is collected once every item on it has resolved, and it is held while any item is still pending, since a pending item is decision state the next round reads back.

Fold the declines before the receipt goes. A promoted entry survives in its target and in git and a retired one survives in the archive, so the one thing a receipt uniquely holds is the record that a rule was considered and turned down.

- Fold into the entry the item was about, and only into that entry. A decline whose proposed target was another surface still lands here.
- Fold a `feedback` or `project` entry alone. The decline belongs in the `**Why:**` line, which is what a later reader tests the rule against.
- Fold nothing into a `user` or `reference` entry. Its body is one sentence carrying neither marker, and such an entry is declined for having no in-repo target, which its type already states. Writing that on the entry restates the type and breaks the body shape.
- Record the decline by rewriting the entry, never by appending to it, per the lifecycle rule above.

Which surface runs the collection is project policy. More than one may, so a collector finding no receipt has been beaten to it rather than misconfigured.

## Anti-patterns

- **The domain fact filed as memory.** It reads as a capture and lands in the one folder no session opens while working that domain.
- **The incident narrative.** A body recounting what went wrong states no rule, so the next reader has to infer one and infers a different one.
- **The entry titled with its own slug.** Every catalog rendering the field shows a filename where the rule should be.
- **The duplicate written beside the original.** Two entries on one topic drift, and nothing says which is current.
- **The first-occurrence capture.** A folder recording every slip buries the rules that repeated.
- **The entry deleted on retire.** The folder has no history, so the judgment that discarded it cannot be reviewed or reversed.

## Template

```markdown
---
title: <the rule, stated as a line a reader can act on>
description: <one line naming what the entry settles>
category: <Feedback|Project|User|Reference>
---

<the rule or fact, in one or two sentences, as something to do>

**Why:** <the session signal that earned it, with the measurement where one exists>

**How to apply:** <the next moment it fires, and what to do then> See [[related-entry]].
```

A `user` or `reference` entry carries the same frontmatter and a single sentence in place of the three parts.
