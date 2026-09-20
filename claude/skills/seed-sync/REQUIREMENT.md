---
name: seed-sync
description: Scope boundary for section-granular seed reconciliation against the bulk install and sync commands
---

# Seed sync requirement

## Gap

Without this skill, a project that edited a seed has no way to take an upstream change without losing something. No `canon` command touches a seed at all, so the only route is a hand copy that overwrites the file and takes the edits with it, unrecorded. Nothing can deliver one upstream section into a file the project has customized, which is the case a grown project is always in.

A whole-file diff does not close it either. It cannot separate a section the user rewrote on purpose from a section the toolkit moved on without them, so the choice reaches the user as accept everything or lose everything, and the safe answer is always to skip.

Naming the bulk command carries a failure of its own. This skill decides which files the bulk sync should take and then hands that command over without stating what it does to them, and the boundary line below names the reference holding that answer where no session reads it. Claude Code loads the skill entry alone, so a sibling named here reaches nobody.

Two failures belong to the audit rather than to the diff. A decision taken in chat dies with the session, so an audit half applied cannot be resumed and the second run starts over. And a file the toolkit generates rather than ships, such as an index rebuilt from sibling frontmatter, is absent from every source catalog by design, so a naive comparison reports it as a local addition and invites the user to reconcile something nothing owns.

## Must

- Read seed content from the CLI rather than holding a copy, so the audit and the install cannot disagree
- Diff per section, treating the preamble as a section of its own
- Separate a customized section from a stale one by reading the attribution the drift report records, not by how the section looks, and default the customized one to no action
- Fall back to appearance only when attribution is unavailable, and mark every verdict reached that way as unverified
- Leave a file the report proves untouched to the bulk sync that owns it, rather than auditing what carries no edits
- Route to the overwrite contract from the body, at the point the bulk command is named, since the boundary below is read by an author and never by a session
- Persist the proposal and every decision to a review file that stays the source of truth across re-pings
- Apply one section at a time, never by rewriting a file

## Must not

- Propose removing a section present only in the target. Those are the customizations the skill exists to preserve.
- Write a target file before a decision is recorded against the item
- Read an empty decision slot as consent

## Guards

- No `canon` on PATH, or no `.claude/` directory at the project root, stops before any read

## Out of scope

- Bulk install and sync of a whole domain, which `canon <domain> install` and `canon <domain> sync` own and `canon-cli` documents. Reach for this skill when the target holds edits worth keeping, and for those commands when it does not.
- Golden configs, which overwrite by design and carry no section structure to diff
- Governance rules: `canon gov sync`
- First-time scaffold of a project that has installed nothing yet: `setup`
- Public `README.md` and `docs/` prose: `docs-sync`
