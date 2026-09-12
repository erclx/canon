# Proposal format reference

Governs the proposal `markdown-propose` writes before it edits anything. The concern being screened is an input and does not change the format.

## Folder

- One folder per screening pass at `.canon/proposals/<slug>/`, where the slug names the subject rather than the activity
- One proposal file per source file, named `<nn>-<source filename, its own extension dropped>.md`, so a source already named `CLAUDE.md` becomes `01-CLAUDE.md` rather than `01-CLAUDE.md.md`
- `00-overview.md` when the pass spans more than two source files, holding the cross-file pattern, the change counts, and the settle order
- `applied.md` once the first change lands, holding every applied change with its reason and the answer it carried

The name carries both structures the folder has. The basename pairs a proposal to its source so a reader opens the two side by side, and the number is the settle order, which is a dependency rather than a preference: a file other files quote is settled first. Do not group proposals by theme.

A proposal opened after the initial pass takes the next free number, and the folder is never renumbered. Its number records when the site was found rather than where it belongs in the dependency order. Renumbering to restore the order would rewrite the names of files already carrying answers, which costs more than the ordering is worth once applying has started.

Settle a late proposal ahead of any unapplied proposal quoting the surface it covers, whatever the two numbers say. A proposal already applied is past the question, since the file it governs is committed.

## Change format

Each proposal file opens with `# Proposal: <source path>`, one line naming the concern, the settle order, and the full surface the pass screened, then one `###` heading per change, ending with a `## Left alone` section. A change never sits at `##`, which the closing section reserves, and a variant never sits at `###`, which the change heading reserves. Skipping from `#` straight to `###` is deliberate: the file has exactly one layer of change between its title and its variants.

Naming the surface on every file, not only the first, is what lets Applying's cross-surface grep run cold. The Propose and Apply invocations are typically separate sessions days apart, so the surface the operator named has to survive on the file rather than in a conversation neither session shares.

A change carries an `###` heading, a fenced `diff` block holding the current text against the proposed, the reason beneath it, and its own answer slot.

- Heading: `### N. The sentence or section it sits in`
- Body: a `diff` fence, `-` for current and `+` for proposed
- `- **Why:** the reason, naming what the change fixes`
- `- **Open:** only where the replacement was drafted rather than corrected`
- `- **Recommended:** only where a pick is proposed ahead of the answer, directly above the slot`
- `- **You:**` last on every change, shipped empty

### Variants

A corrected change carries one replacement. A drafted one carries three, because the intent behind invented prose is not recoverable from the source text and a single draft turns the answer slot into a veto.

- Ship three variants on any change carrying `Open:`, labelled `#### A`, `#### B`, `#### C`
- Make them differ in approach rather than in wording. Three phrasings of one bet are one variant.
- State the bet each one makes in a line above its block, so the choice is between strategies and not between paragraphs
- Ship one replacement everywhere else. A word swapped for the recorded fact has no second option worth reading.

Three is the cap as well as the count. A fourth splits attention without widening the space.

### Placement

- Title a change by the section or sentence it sits in, never by its position in the file
- Quote text from another file in a `markdown` block rather than citing a line number, which goes stale on the first applied change
- Split a `Why:` into labelled halves when one change fixes two things (`**Why, the date:**`)
- Carry an `Open:` on any change whose replacement text was written rather than corrected, so a blanket answer cannot swallow it

Close each file with what it leaves alone. A pass reporting only what it would change reads as one that found everything wanting.

## The answer contract

`You:` belongs to the operator and ships empty on every change. Empty means unread and never agreement, matching the intake contract in `${CLAUDE_SKILL_DIR}/../../standards/intake.md` rather than the plan file's, which reads a blank slot as accepting the suggestion above it. State the inversion at the top of `00-overview.md` when the folder spans more than one file, since a contract read from the wrong surface gets applied to the wrong document.

- One `You:` per change, last in its bullet list, so an answer lands where the change is read
- Never fill a `You:` slot and never infer a disposition from an empty one
- The slot takes free text, not only `ok`. A rejection, a caveat, or a rewrite of the proposed line are all valid answers and a later pass reads them correctly.
- A pick made on the operator's behalf goes on a `- **Recommended:**` line directly above the slot, never inside it, and states which variant it takes and why. The slot below it still ships empty, so a count of unread changes still reads the change as unread.

An answer rejecting the draft reopens the change rather than closing it. Move that answer to a `- **Answered:**` line above the variants it produced, and ship a fresh empty `- **You:**` beneath them. The change reads as unread again, which is what it is.

Per-change slots do not license a partial sweep. Answering a change records one decision, and the applying rule below is what holds the set together.

The overview file carries no slot, since it proposes no changes.

## Applying

- Apply one file at a time, in the folder's settle order
- Apply every change in that file that carries an answer, and nothing that does not
- Re-grep each change's anchor against its source before applying it, and again after a rebase
- Grep the other named surfaces for the same claim before committing the file
- Write every hit that grep returns onto the proposal owning the file it sits in, as a change with its own answer slot, and open a proposal for a surface the pass has none for
- Commit the file once its own answered changes are applied. A hit in a sibling never holds it.
- Move an applied change into `applied.md` beside the proposals, carrying its reason and its answer

A partial pass is worse than none, and a file is the unit that can be finished. Settling one claim across every file at once touches all of them and closes none, so each file ends the pass looking reviewed while other changes in it sit answered and unapplied. The surface grep is what covers the cross-file half a per-file pass would otherwise miss.

Recording a hit rather than acting on it is what keeps the grep from rebuilding the whole-set gate. A sibling holding the same claim is a change nobody has answered yet, and holding this file until it is answered makes every file wait on the slowest one, which is the shape the per-file unit replaced.

A proposal outlives its own diff. The source moves under it, so an approved change stops matching while the defect it names survives in fresh wording. The anchor re-grep is the only thing that catches that.

## After

- Strip the `diff` blocks
- Keep the files, their headings, their reasons, and the answers

What remains is the record of what changed and why, which is the half no commit message holds. The folder stays where it is, beside every earlier pass, so a later one reads what an earlier one settled instead of asking it again.

The folder is gitignored, and backed wherever a records remote is configured. It carries decision state rather than generated data, which is why `src/records/backup.ts` names it in `BACKED_FOLDERS` so `canon records push` and `canon records pull` carry it there, refusing with `no-remote` otherwise, but nothing else about its contents is enforced.

## Retrieval

Count the unread changes per file:

```bash
grep -c '^- \*\*You:\*\*$' .canon/proposals/<slug>/*.md
```

Report every answer given, against the change it sits under:

```bash
awk '/^### /{h=FILENAME": "$0} /^- \*\*You:\*\*./{print h; print "   "$0}' .canon/proposals/<slug>/*.md
```

Both walk `###` headings, which is the mechanical reason an answer typed anywhere else is lost.
