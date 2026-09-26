# Promotion routing

Which surface a durable page from a learning workspace belongs to, and what to do when the destination does not exist yet.

## What may be promoted

Only the durable half. A reference page under `reference/` and `GLOSSARY.md` carry no learner and are ordinary reference prose about a subject, so they sort under the routing test like anything else.

A lesson is never promoted, at any age and on any request. It is generated markup written to be worked through once, it carries a quiz and a second person, and nothing downstream cites it. Promoting one puts ungated markup into a corpus every other page passed a gate to enter.

A reference page that reads like a lesson is a lesson wearing the wrong extension. Where a page under `reference/` carries a quiz, a second person, or an instruction to the learner, say so and propose rewriting it in place before promotion rather than promoting it and repairing it at the destination.

## The routing test

Sort by who owns the subject, which is the test the wiki already runs. The reader's activity decided the workspace and decides nothing here.

| The page's subject                                                                                                   | Destination                                                                                               |
| -------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Owned by Anthropic                                                                                                   | the project's wiki                                                                                        |
| Owned by another tool or vendor, owned by no single vendor, or written for someone consuming what this project ships | the project's public docs                                                                                 |
| How this project itself works, for the people who build it                                                           | `canon/context/<domain>.md`, or the domain's own nested `index.md` when it is already split into a folder |

A page a reader cannot sort by that question is a page whose subject has not been settled. Say which two destinations it sits between and let the operator choose, rather than picking the nearer one.

## Where the wiki sits

The folder has two spellings and a project carries whichever its scaffold wrote:

- `.claude/wiki/`, which is where the scaffolding verb creates one
- A folder named `wiki` at the project root, which is where a project scaffolded before the move keeps its pages

Read which one exists rather than composing either. A project carrying both keeps its pages at the root, so propose the root spelling and say the other folder is there.

A project carrying neither gets a refusal rather than a scaffold:

`❌ No wiki folder. Run canon wiki init to create one, then promote again.`

Creating the folder as a side effect of promoting one page hands the project a surface it never chose, and the refusal is one command from resolved.

## What a promoted page owes its destination

Each destination gates prose the workspace does not, so name what the page still needs rather than proposing a move that fails at the gate.

- A wiki page closes its intro paragraph with a sentence naming who owns the subject, and links the canonical page when one exists. A page carrying no such sentence is not ready to move.
- A context entry is internal narrative about one domain, so a page landing there merges into an existing entry rather than arriving as a new one.
- A glossary keeps the shape `glossary.md` fixes wherever it lands, and a promoted one has to state any rule it departs from.

## Anti-patterns

- **The page promoted into a new context entry.** Entries are created deliberately, so a promotion proposing one is proposing a domain rather than moving a page.
- **The glossary split across destinations.** Terms drawn from one subject move together or not at all, since an entry defining a term the other half uses strands both.
- **The workspace emptied on promotion.** Promotion copies rather than moves. The workspace stays readable to the learner who built it, and the page's later life belongs to its destination.

## Proposing and handing off

Step 6 of `teach-workspace` reads this section once the routing above has placed each page. Propose and wait. A promoted page is public prose that needs a line naming who owns its subject, which is a judgment about ownership rather than a move a session makes on its own reading. Present one block per candidate page:

```plaintext
reference/<slug>.md → <destination path>
Subject owner: <who owns it, in a few words>
Still owed:    <what the destination expects that the page does not carry yet>
```

Then stop and let the operator strike, redirect, or confirm each block.

Write nothing to a destination here. One skill owns the durable writes, and two skills editing one file at one step is the failure that rule exists against. Record each confirmed block in `.canon/tmp/handoff/teach-promotion/<slug>.md` at the main worktree root instead, appending when the file exists, with one H2 per destination naming its path, the source page beneath it, and the page body fenced:

````markdown
## <destination path>

Source: .canon/teach/<nn>-<topic>/reference/<slug>.md

```markdown
<the page body as it should land, with the source line the destination expects>
```
````

The body is fenced rather than written bare because a reference page carries headings of its own, and the reader splits this file on its H2 lines. An unfenced body turns every section heading in the page into a destination naming no path. Open the body fence with four backticks so a page carrying a fenced code block of its own still closes where it should, and widen both fences together if it carries a four-backtick fence.

Derive `<slug>` per `${CLAUDE_SKILL_DIR}/../../standards/slug.md`. Fall back to `latest` on an empty result.

The handoff is its own file rather than a shared one. The routed-facts file another skill writes is deleted by whichever pass folds it, so a second producer's unread work goes with it, and a sibling path costs the folding skill one more read and removes the interaction.

An append is a whole-file operation, so send it as a heredoc, per the skill's Step 0. Then tell the operator that `/context-fold` folds the file in from a branch. The proposal costs nothing tracked and runs anywhere, while the page it describes is a tracked file, so the fold is a worktree operation and the workspace it came from is not.

A promotion pass reports this shape in place of the skill's Output block, one line per page the operator confirmed and one naming the handoff:

```plaintext
➡️ Promoting: .canon/teach/<nn>-<topic>/reference/<slug>.md → <destination path>
→ Confirmed pages wait at .canon/tmp/handoff/teach-promotion/<slug>.md. Run /context-fold from a branch to fold them in.
```

A pass where the operator confirmed nothing writes no handoff file and reports that alone.
