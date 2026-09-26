---
name: create-standard
description: Why a standard needs its shape read from the meta-standard before anything is drafted, and why the follow-up depends on who owns the folder it landed in
---

# Create standard requirement

## Gap

Without this skill, a standard is written from memory of what other standards look like. It arrives without the scope section that says what the file does not govern, so the next author cannot tell whether a rule belongs to it or to a sibling, and two standards end up claiming the same subject with no way to settle which one wins.

The second write surface is the second failure. A standard put under `.claude/standards/` looks like a correct file and reaches no resolver, since nothing installs the corpus into a project and no repository generates a copy there. One write surface removes the choice: `standards/` is what the resolver reads first and what every author writes to, in the toolkit and in a project alike.

A standard written and left there is the third. The index entry and the context table are both generated or maintained downstream of the write, so a file that ships without them is catalogued nowhere and reached only by whoever already knew the path.

## Must

- Read the meta-standard before drafting, since the shape is what makes the file arguable against a sibling
- Write to `standards/`, creating it when absent, since it is the one root the resolver reads and the only surface either kind of author has
- Confirm the slug and the full body with the user before writing
- Emit the written path in full, so the terminal can resolve it
- State what the write implies for whoever owns the folder, since a toolkit standard needs the index regenerated and a project-local one needs copying to the toolkit to ship

## Must not

- Work the standard's shape or frontmatter from memory
- Write into `.claude/standards/`, which no repository generates and no resolver reads

## Out of scope

- Editing a standard that already exists
- A path-scoped coding rule, which `create-rule` owns
- Reading a standard the toolkit ships, which `canon standards <name>` owns
