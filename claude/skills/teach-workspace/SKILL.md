---
name: teach-workspace
description: Opens and runs a learning workspace on one subject, holding a mission, resources, numbered lessons, reference pages, a glossary, and learning records that survive across sessions, and proposes where a durable page from one belongs once it outgrows the workspace. Use when asked to "teach me X", "open a learning workspace", "I want to learn X", "quiz me on this", "continue the lesson", "resume my workspace on X", or "promote this reference page". Do NOT use to write project documentation, which belongs to the surface owning that document, and do NOT use to answer one question, which is an ordinary reply.
disable-model-invocation: true
argument-hint: <subject to learn, or the topic of a workspace to resume or promote>
---

# Teach workspace

Run a learning workspace on one subject across sessions. The workspace holds what the learner has been through, so a session weeks later resumes from the folder rather than from the conversation.

The shape of the workspace is fixed by `${CLAUDE_SKILL_DIR}/../../standards/teach.md`. Read it before writing anything into the folder. The glossary answers to `${CLAUDE_SKILL_DIR}/../../standards/glossary.md` wherever it lands. The pedagogy sits in `${CLAUDE_SKILL_DIR}/references/pedagogy.md`, the lesson craft in `${CLAUDE_SKILL_DIR}/references/lesson-craft.md`, and the promotion routing in `${CLAUDE_SKILL_DIR}/references/promotion.md`.

## Guards

- If the invocation names no subject and no existing workspace matches, stop: `❌ No subject. Invoke with the subject to learn, or the topic of a workspace to resume.`
- Never trust recall for what the subject says. Research first, cite what was read, and say what was not.
- Write nothing outside the workspace folder, apart from the one handoff file Step 6 names. A durable page stays in `reference/` and is copied out by the skill that owns the destination, never by this one.
- Do not open a second workspace on a subject one already covers. Resume that one.
- Never promote a lesson. It is generated markup carrying a quiz and a learner, and no request makes it promotable.
- Never write a favicon link by hand. `canon teach nav` puts the toolkit's icon on every page it generates and inside a lesson's `style` region, so a hand-written one in a lesson's `<head>` gives the page two.

## Step 0: let the CLI resolve the workspace root

Workspaces live at the main worktree root, never inside a linked worktree. A copy per worktree forks the learning records, and the learner is one person.

Every `canon teach` verb resolves that root in-process, so no step below composes a path to a workspace file. Read the folder through the CLI rather than deriving its location:

```bash
canon teach list --json
```

It reports every workspace with its path, its counts, and the ordinal a new one would take. A `no-teach` refusal means the project has opened none yet, which is the new-workspace path in Step 1 rather than a reason to stop. The open verb creates the folder.

Every path under the main root is a main-root write, routed the way `session-worktree` states. The route splits by what the write does to the file:

- Creating a whole file that does not exist yet, which is a lesson, a reference page, and a learning record, goes out as a heredoc
- Changing a line inside a file that already exists goes through the verb that owns it

## Step 1: open or resume

A topic the listing already carries is a resume, and anything else is a new workspace. An invocation asking to promote is neither: read the named workspace through the listing and go to Step 6, which teaches nothing and writes no lesson.

On a resume, run `canon teach list <topic> --json` for the files behind each count, then read the highest-numbered learning record and `GLOSSARY.md`. Those carry where the learner stopped and what they got wrong. The listing record carries `success`, the mission's success lines, which are the exit criteria this workspace is finished against. Report them with what is already met before teaching anything.

It also carries `due`, what the learning records schedule, soonest first. Each entry names the item, its date, the rung it has reached, whether it is `overdue`, and the two dates the next record could write. Read it here rather than later: it is the input to what this session opens on, and `canon teach lesson` takes a `--slug` naming a choice already made. Report what is overdue before proposing a lesson. An empty `due` on a workspace holding records means no record scheduled anything, which is a gap in the records rather than a clear schedule.

On a new workspace, settle the starting point first, by asking rather than by assuming. Difficulty with no floor under it teaches nobody, and the mission cannot be written without it.

Then open the workspace, which derives the ordinal and writes all three required files:

```bash
canon teach open <topic> --json \
  --subject "<one line stating the subject>" \
  --starting-point "<what the learner already knows>" \
  --success "<an observable thing the learner will be able to do>" \
  --out-of-scope "<what this workspace does not cover>"
```

Repeat `--success` and `--out-of-scope` per line. The verb refuses a topic another workspace already covers, which is the guard against opening a second one on the same subject.

## Step 2: research before teaching

Read the subject from sources rather than from recall. Record what was read and what was only found through the verb that owns the file:

```bash
canon teach resource <topic> --json \
  --read "<title, naming which claims rest on it>=<url>" \
  --lead "<title>=<url>"
```

Each flag repeats, and the pair splits on the first `=` so a URL carrying one survives. A URL already listed is refused rather than repeated.

A claim nothing was read for is the failure this step exists against. Where no source is reachable, say so in the lesson and mark what rests on recall.

## Step 3: place the learner

Pick the next lesson from the learning records rather than from the subject's own order. The target is the band immediately past what the learner can already do unaided, which `${CLAUDE_SKILL_DIR}/references/pedagogy.md` states in full.

Open on what `due` reports as overdue, oldest date first, before anything new. Where nothing is overdue, open on retrieval of what the last session got wrong. A learner who cannot retrieve the previous lesson is not ready for the next one, and moving on anyway buys fluency that decays. Never place from the last record alone, since a topic missed three sessions ago is invisible to that read and sits in `due` with a date already past.

## Step 4: write the lesson and the reference

Two outputs with two lifetimes, and the split decides the format.

- A lesson is a self-contained page carrying its own quiz, a teach-back block, and the feedback for each question. It embeds one shared stylesheet rather than restating styles, and it is disposable and never promoted.
- A reference page goes to `reference/<slug>.md`, written for a reader with no learner in it. This is the half that survives the workspace, so it is written in markdown to pass the authoring gates a promotion would put it through. `canon teach nav` renders it to a `reference/<slug>.html` sibling, and a lesson links that sibling, since a served `.md` opens as plain text.

Resolve the lesson before writing it, rather than composing its name or its quiz order by hand:

```bash
canon teach lesson <topic> --json \
  --slug <kebab slug for what this lesson covers> \
  --questions <how many questions the quiz carries> \
  --options <how many options each question carries>
```

It writes nothing and reports three things:

- `lesson`, the numbered path the lesson takes. Write it there.
- `success`, the mission's success lines, carried here so Step 5 needs no second read.
- `quiz`, one entry per question, carrying `order` and `answer`.

Write the correct option first, then present the options in the order `order` reports, reading it as authored indices where `0` is the correct one. Take the order as given, since a lesson that reorders on its own judgment puts the answer back in the first slot.

### The quiz, the teach-back block, and the lesson body

Read `${CLAUDE_SKILL_DIR}/references/lesson-craft.md` before writing the lesson. `## Quiz construction` and `## Teach back` there fix the markup `canon teach nav`'s stepper gates on, so a quiz in any other shape shows every question at once and nothing reports it. `## Building the lesson body` carries the four marker pairs, the render, nav, stylesheet, and glossary verbs, and the rule against composing any of them by hand when a verb does not resolve. Keep every quiz answer the same length, so formatting leaks no clue about which one is correct.

### Hand over a link, never a path

A lesson is a page carrying a script, and an editor preview cannot run it, so a path alone opens markup with no working quiz. Serve the teach root and give the learner a link they can click. Take the serve line from the `Open` step of `canon teach list <topic>`, which resolves the teach folder against the directory the session runs in:

```bash
canon teach list <topic>
```

Run the line it prints with `--json` appended, rather than writing `canon serve .canon/teach` by hand. `canon serve` resolves its folder against the cwd, so that literal serves an absent folder from a linked worktree, where the list verb reads the main worktree root.

Start it in the background so the session keeps going, and read `url` off the record rather than composing one. The verb walks past a port already in use, so the port it took is exactly the half a guessed URL gets wrong. Report the refusal and its `reason` when `ok` is false, and report it rather than proceeding silently when the verb does not resolve at all, which is an installed CLI predating it.

Do this on every run that opens or resumes a workspace, including one that writes no lesson, since the learner's route into what is already there is the same link.

## Step 5: record what happened

Write `learning-records/<nnnn>-<slug>.md` before the session ends, carrying the lessons covered, what the learner retrieved unaided, what they got wrong with the wrong answer itself, and a `## Revisit` section.

Record the wrong answer rather than the count. The next session places the learner from this file, and a tally carries no misconception to work against.

Record what the teach-back left out under what the learner got wrong, naming the concept and where the explanation broke. A produced answer and a selected one are both retrieval failures the next session places from, so a second heading would split one input across two sections.

Then write `## Revisit`, one bullet per item, in the shape `${CLAUDE_SKILL_DIR}/../../standards/teach.md` fixes:

```markdown
## Revisit

- **<what comes back up>**: due <YYYY-MM-DD>, rung <n>
```

Take both the date and the rung from the `due` entry Step 1 already read, copying `hit` for an item the learner retrieved unaided and `miss` for one they did not, with the rung stepped the same way. Do not compute a date from the ladder. A session told to widen a gap still picks the number by judgment, which is the reason the verb reports both dates at all.

An item the records have never scheduled has no `due` entry to copy from. Open it at rung 1, dated the day after this session, which is the ladder's floor and the one number this body states. Every later date for it comes from the verb.

An entry outside this shape schedules nothing and nothing reports that it was skipped, so write the shape exactly. A later record naming the same item supersedes an earlier entry, so revise a schedule by writing the new bullet rather than editing the record it was set in.

Then restate the mission's success lines with what is now met, reading them from the `success` the lesson verb already reported rather than from `MISSION.md` by eye. Report each line as met or not met, and name what the learner did that meets it. A mission whose lines are all met is finished, and saying so is what closes a workspace.

## Step 6: propose where the durable half belongs

Run this when the invocation asks for it, or offer it in one line when a mission finishes, since that is when the workspace stops growing and its reference pages stop changing. Never run it unasked mid-course.

Read `${CLAUDE_SKILL_DIR}/references/promotion.md` first. It carries what may be promoted, the routing test, both spellings of the wiki folder, the refusal when a project has none, what each destination expects a page to carry, and under `## Proposing and handing off` the proposal block, the handoff file this step writes in place of any destination, and how the operator is told to fold it. Propose and wait, and write nothing to a destination here.

## Output

```plaintext
✅ <opened|resumed> .canon/teach/<nn>-<topic>/
Lesson:    .canon/teach/<nn>-<topic>/lessons/<nnnn>-<slug>.html
Reference: .canon/teach/<nn>-<topic>/reference/<slug>.md
Record:    .canon/teach/<nn>-<topic>/learning-records/<nnnn>-<slug>.md
Progress:  <n> of <m> success lines met
Open:      [<the url the serve verb reported>](<the same url>)
```

Omit the reference line where the lesson produced no durable page. The open line is the one line that is never omitted, since it is the only route the learner has into the page, and it carries what `canon serve` reported rather than a URL composed here. Where the verb refused, that line names the refusal instead of a link.

Write that line as a markdown link carrying the URL as both its text and its target, rather than as a bare URL and never inside backticks, since a code span is text the reader has to copy.

Emit every path from the project root, in the form the project's instruction file sets.

A promotion pass reports the shape `${CLAUDE_SKILL_DIR}/references/promotion.md` gives at the end of `## Proposing and handing off` instead.
