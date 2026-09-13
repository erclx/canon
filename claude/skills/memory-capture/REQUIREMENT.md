---
name: memory-capture
description: Which surface a session fact is owed to, what earns a memory file once routing has run, and why capture never edits a context entry itself
---

# Memory capture requirement

## Gap

Without this skill, what a session learned dies with it, and the correction the user made in message four is re-earned next week. What does get written is a narrative of how the session went wrong rather than a rule that fires again, so a reader gets a story and no instruction. A new file lands beside one already holding the same topic, and the folder grows two entries per subject until nothing in it can be trusted as current.

Writing every fact to one folder is the deeper gap, because the folder has no reader. A fact about a domain has an owning surface already, the context entry the three-tier model loads on demand, and filing it in memory instead puts it where only a deliberate sweep will ever find it. The measured outcome is a store that grows on every ship and is drained by nothing.

The threshold is what the remaining folder lives or dies on. A first-occurrence slip saved as feedback is noise that costs every later session a read, and a fact the repository already records is worse, because it duplicates a source that will be updated without it. From a linked worktree, writes resolved against `pwd` land in a second memory folder nothing else reads.

## Must

- Resolve every read and write at the main worktree root, so parallel worktrees write one folder
- Classify each candidate as feedback, project, user, or reference before routing or writing
- Route a project candidate whose subject names an entry in `canon/context/index.md` to that entry, and hand it off as a file rather than an edit
- Keep a candidate that matches no entry, or two entries with no clear owner, as a memory file
- Apply the save threshold, firing feedback only on an explicit correction or a pattern that repeated twice
- Grep the folder for an existing file on the topic and update it in place rather than adding a second
- Keep a feedback or project body to the rule, one line of why, and one line of when it fires next
- Write frontmatter the index renderer can read, so the generated catalog stays current
- Report that nothing was worth capturing rather than manufacturing an entry to show work

## Must not

- Edit a context entry, which `docs-fold` owns
- Route a feedback, user, or reference candidate, since no context entry owns how to work or who to ask
- Route anything when the caller does not commit, because a context entry is a tracked file
- Hand-append a row to the memory index, which is generated from sibling frontmatter
- Write a session narrative or a recovery account in place of the pattern
- Save a first-occurrence slip as feedback
- Create a second file on a topic the folder already holds
- Save what the repository already records in code, git history, or its instruction files
- Curate, promote, or delete an existing entry

## Guards

- No correction, confirmation, or context disclosure worth persisting: stop with a pass
- Memory folder absent at the main root: create it rather than stopping
- Session in the main worktree, or a caller that does not commit: skip routing and write every candidate as a memory file

## Out of scope

- Editing the context entries themselves, which `docs-fold` owns on its own pass
- Curating what is already in the folder, which `memory-review` owns
- Promoting an entry into an instruction file or a skill body, which mutates how the agent operates and ships as its own change
