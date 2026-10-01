---
name: teach-workspace
description: Scope boundary for learning a subject across sessions, and the split between the disposable lesson and the durable reference page
---

# Teach workspace requirement

## Gap

Without this skill, a session asked to teach a subject answers in the conversation, so everything it produced dies with the session and the next one starts from nothing. It teaches from recall rather than from a source, so the learner is handed claims nothing was read for and cannot tell which ones. When it does read, it takes whatever a search returned first, so a course rests on a few thin sources, and it cites the learner's own projects or an employer's material as proof of a general concept.

It picks the next topic from the subject's own order rather than from what the learner got wrong, so it teaches past a gap it never measured. It asks nothing about what the learner already knows, so difficulty has no floor and the session lands either below or far above them.

It also produces one output where two are needed. A page written to be worked through once and a page written to be looked up later have different lifetimes and different readers, and merging them yields material that is disposable and gets kept, or durable and carries a quiz nobody can promote. Writing the durable half in a format the authoring gates do not read costs a conversion at the moment it matters most, which is the moment someone tries to promote it.

A lesson on a structure can also point at one and draw none. Nothing asks the author whether the subject is a relationship, boundary, path, or before-and-after, so a lesson on layers and ports tells the learner to draw arrows and ships none, and nothing records whether prose was a choice or an omission.

A session that does record something records the wrong thing. It writes what was taught rather than what the learner retrieved, and a tally of errors carries none of the misconception a later session would work against.

The lesson then reaches nobody. It is a page carrying a stylesheet and a script, and the only thing a session hands over is a file path, which an editor preview opens with neither. The learner reads unstyled markup and takes it for the lesson, or opens nothing at all, and either way the session reports the lesson as delivered. A path is also the wrong unit once a workspace holds several pages, since the learner wants the one they are on rather than the folder it sits in.

The durable half then has nowhere to go. A reference page and a glossary carry no learner and are ordinary reference prose, so they belong wherever the project already keeps prose on that subject, and a workspace holding them is a gitignored folder one person reads. A session moving them by hand picks a destination from the reader's activity rather than from who owns the subject, drops a page into a corpus without the source line that corpus requires, and has nothing stopping it from carrying a lesson across.

Two failures land specifically on where the folder sits. A workspace resolved against the current directory forks into a copy per linked worktree, so the learning records split and no session sees the whole history. A body naming only the destination path reports success and loses the write, because the file-editing tools refuse a main-root path from a linked worktree and offer a worktree copy instead.

## Must

- Hold the workspace at the main worktree root, so one learner has one history rather than one per worktree
- Name the write route for a main-root path from a linked worktree, since a body naming only the destination reports a success that did not happen
- Route every edit inside a workspace file that already exists through a verb resolving the root in-process, since a heredoc reaches a whole-file create alone and the stream editors that would reach the rest are banned
- Settle the learner's starting point by asking, so difficulty sits above a measured floor
- Research the subject from sources before teaching it, choosing them by the teach standard's ladder, and record what was read and what was found and not opened
- Place each lesson from the learning records rather than from the subject's order, and open with retrieval on the last wrong answer
- Split the output by lifetime, sending the worked-through half to lessons and the looked-up half to reference pages in the format the authoring gates read
- Record the wrong answer itself rather than the count, since that is what the next session places the learner from
- Decide each lesson's figure before writing its body, drawing it or recording in the reply the one-line reason prose carries it, so a structure lesson never ships with neither
- Report progress against the mission's success lines, so a mission can be called finished
- Hand the learner a link that opens the workspace in a real browser on every run, reading it back from the verb that served it rather than composing one, since the port a preview lands on is not the port it asked for
- Propose a destination for each durable page by who owns its subject, and wait for the operator rather than routing on the session's own reading
- Hand each confirmed page off through a named file of its own, so one skill owns the durable writes and no other producer's unread work is discarded with it
- Name what the destination expects that the page does not carry yet, since the workspace runs none of the gates the destination does

## Must not

- Teach from recall without saying which claims rest on it
- Write to a destination surface directly, since the skill owning that file makes the edit and two skills writing one file at one step is what the handoff exists against
- Open a second workspace on a subject an existing one already covers
- Renumber a workspace folder, a lesson, or a learning record, since the number is cited by files already written
- Promote a lesson, at any age and on any request, since it is generated markup carrying a quiz and a learner into a corpus every other page passed a gate to enter

## Guards

- No subject named and no existing workspace matching, stop rather than opening a workspace with nothing to learn
- No wiki folder in the project and a page routing there, refuse and name the command that creates one rather than scaffolding a surface the project never chose

## Out of scope

- Landing a promoted page at its destination, which belongs to the skill that owns durable writes there, and creating a wiki folder a project never chose
- What the verbs do internally, which is the CLI domain's own contract rather than this skill's, and the records backup that carries the folder off one disk
- What a lesson renders as and how a quiz behaves once rendered, which the lesson-craft reference shapes and a rendering layer executes
- Deciding when to fire. The skill is user-invoked through `disable-model-invocation`, so opening a workspace is the learner's call rather than a description match.
