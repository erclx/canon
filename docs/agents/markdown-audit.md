---
title: Markdown audit
description: Running the audit over any markdown path, where its bans and checkpoints are read from, what each check reports, and why the ban half gates while the structural half reports
---

# Markdown audit

`canon markdown audit [path...]` reports any markdown file against the attribute standard `markdown.md`. An attribute standard governs a file rather than a folder, so this resolves no folder and requires no `index.md`, which is what puts `.claude/rules/`, `governance/`, and `snippets/` in reach. Folder-shaped findings stay in `canon context audit`, described in `context-audit.md`.

```bash
canon markdown audit
canon markdown audit --json
canon markdown audit .claude/rules governance
canon markdown audit docs/agents/commands.md
canon markdown audit 'snippets/**/*.md'
```

| Option   | Behavior                                                   |
| -------- | ---------------------------------------------------------- |
| `--json` | Add a machine-readable record on stdout, keeping the frame |

## Scope

An argument is a file, a directory, or a glob. A directory narrows to everything under it and a glob narrows by match, both against the corpus git lists, which is what keeps `node_modules/` and the gitignored session-scratch folders out without naming either. An explicit file path is taken as given, so a gitignored draft can be measured before it is committed. Quote a glob the shell would expand first.

A bare run measures every markdown file git lists, tracked plus untracked-and-not-ignored, so a file added on this branch is in scope on the branch that adds it. An argument matching no markdown file is named on the scope line rather than passed over, since a run measuring the paths that did resolve otherwise reads as a pass over one it never opened.

## Where the rules come from

The ban set and all ten checkpoints ship with the `canon` package as data, in `src/markdown/bans.ts` and `src/markdown/structure.ts`. Every project is measured against the same set whether or not it installed any standards, and no file has to resolve for a run to mean something.

Seven of the ten are stated in `markdown.md` and the three cadence numbers are stated in the `write-human` skill. That split is the content boundary rather than an accident: `markdown.md` carries the enforced rules a scan can decide, and the skill carries the rhythm rules a ban list cannot express. A cadence number moved in the skill and left in the code drifts the same way, so move both.

Reading them out of the standards per run was the original design. It put a parser contract on a document authored for people, and the standard had to carry a paragraph of its own warning an author that a one-word backticked example in a `- Do not use ` bullet would be lifted into a literal ban set and ban that word everywhere. A rule existing to protect a parser from the prose it parses is the argument for separating them.

`markdown.md` still states every ban and every checkpoint, and a reader follows it rather than the code. Nothing compares the two, so a number moved in one place and left in the other drifts silently. Move both in the same change.

The set is closed rather than extensible, so a project cannot add a term by editing a file. It holds the two characters alone, since a character is the one class a literal match settles. The set once carried 13 words and 6 British spellings as well. The words moved to the `write-human` skill as guidance, because a word ban catches the token and misses the habit, and `just`, `allows`, and `very` carry honest uses no literal match separates. Spelling went to a project's spell checker, which already reads every word.

A set shipped empty is reported rather than passed. It finds nothing and would exit clean, which reports a corpus nobody checked as a corpus carrying no violation, so the run names the empty set and exits `3`. The set ships with the package, so a defect in the build is the only cause left.

`canon standards <name>` still resolves a standard at the authoring root, then the package corpus, and prints it, so the human catalog reads without a project copy on disk.

## What each check reports

### Bans

One closed set reports a hit: the characters `markdown.md` bans under `## Punctuation`.

Frontmatter, fenced blocks, inline code spans, and link destinations are excluded. Without the code-span exclusion each standard would report its own backticked examples, and without the link exclusion a semicolon in a query string would report as prose no rewrite can fix.

Word choice stays unmeasured and the report says so on every run. Single words travel in the `write-human` skill as guidance a reader applies. A multi-word ban escapes the harvest by width, whether it carries a placeholder standing in for the rest of the sentence or spells the phrase out in full, and every rule under `## Voice` is a judgment. The bans `## Language` states over what a sentence may claim are patterns of the multi-word kind by construction, since a literal match over a pattern reports the compliant text and reaches none of the violations. A report listing hits without naming those would read as a verdict on the whole standard.

### Links

A relative link's destination resolves against the filesystem, over the same corpus the ban scan reads. A destination is skipped rather than resolved when it is empty, opens with a URL scheme, opens with `#` as a same-file anchor, opens with `/` as a root-absolute reference, or carries `<` as a template placeholder such as `<slug>` or `<name>`. What remains is split on its first `#`, decoded, and resolved against the linking file's own folder, and a destination resolving to nothing on disk reports.

The placeholder exemption is the one live case the corpus needs. Every current instance is a genuine illustration rather than a literal path, and a marker-based override is available for the day a real one needs an exception instead.

### Bullets, paragraphs, and depth

Bullet weight and depth are the checks that moved off `canon context audit`, carrying what they measured at the time. A top-level bullet reports past roughly 400 characters with continuation lines folded in and nested items left out. A run reports past roughly 40 rendered lines, measured at 80 columns, where a heading breaks one and so does a bold section marker taking the whole line at column zero, either ending in a colon, or holding one whole code span at any width, or running to 20 characters or fewer, skipping fenced blocks and exempting a flat peer list averaging under 130 characters a bullet and a run that is entirely table rows. Each file reports its longest run alone, so a second run past the checkpoint in the same file is never named.

Every weight and depth measure counts the text a reader is shown. A link reduces to its anchor text and an autolink drops whole, since no reader is shown either destination. A backticked path stays counted, which is where these measures part from the ban scan above: that one blanks a code span so a standard quoting its own banned character does not report itself, and discounting the same span here would under-report a paragraph carrying several. One file holds both span sets and each answers its own question.

A code span is walked around rather than through, so a path quoting link or angle-bracket syntax keeps the width the page gives it. Masking inside one takes back the decision to count it, and the placeholders this toolkit writes are where that shows.

The paragraph check measures both halves of one rule. `markdown.md` caps a paragraph at four sentences, and a sentence cap on its own is satisfied by writing fewer and longer ones: 15 paragraphs in this corpus sit inside four sentences and past the weight checkpoint, and the heaviest of those runs 886 characters. The standard therefore states a weight beside the sentence cap, and the verb reads it as its own checkpoint.

A sentence boundary closes on terminal punctuation ahead of a capital or a code span. The capital is what keeps a version pin and a decimal from each reading as two sentences, and the code span is admitted beside it because a command name opening a sentence carries no capital to find.

The paragraph weight sits at 700 and the bullet weight at 400. Both shipped at 400, because the paragraph number was borrowed from the bullet rule when the two checks landed together, and each has since been read against a sample of its own. They are separate checkpoints in the standard and separate patterns in the parser, so a read that moves one leaves the other where it is.

#### The sample behind the paragraph number

The checkpoint shipped at 400 as a borrowed number and was decided against a read of the prose it reports. Thirty-six findings were sampled, six from each of six weight bands, drawn at even spacing through each band ordered by path and line, and each was classed as prose a reader wants split or prose the checkpoint should not have reported.

Every band below was measured before the scan stopped counting link syntax as prose, so a paragraph sitting in one of these bands is heavier than a paragraph reported at the same number today. The re-sample in the section below re-reads the same range against the corrected measure and reaches the opposite verdict on it, which is the measure moving rather than the reader.

| Band      | Wants the split | Reads as written |
| --------- | --------------- | ---------------- |
| 400 - 425 | 1               | 5                |
| 425 - 450 | 2               | 4                |
| 450 - 500 | 2               | 4                |
| 500 - 600 | 2               | 4                |
| 600 - 750 | 6               | 0                |
| Past 750  | 6               | 0                |

Precision is what moved the number rather than the finding count. Below 600 the checkpoint was right about seven of twenty-four sampled paragraphs, and past 600 it was right about all twelve. A checkpoint is a prompt to look, and a prompt wrong three times in four teaches a reader to stop looking. The distribution offers no seam to place the number against, with a median of 487 and a seventy-fifth percentile of 563, so the read is the whole of the evidence.

Nothing inside the 500 to 600 band separated the two classes by length, which is the reason the number did not land there. The two paragraphs wanting a split ran 543 and 590 characters against four reading well at 515, 532, 555, and 569.

The sample is thirty-six paragraphs against a reported population in the hundreds, and one reader classed all of them. Treat a band's rate as the order of magnitude it is rather than as a measured precision, and re-sample before moving the number again.

#### The re-sample that moved the number to 700

That re-sample ran once the scan stopped counting link syntax as prose. Findings at 604, 633, and 677 characters each read as an ordinary four-sentence paragraph on one topic, density arrived around 760 and was plain by 860, and the move cut the weight half of the report roughly in half while leaving the sentence cap untouched.

A bullet, a heading, a table row, a blockquote, a blank line, and a fence each end a paragraph, so a heavy bullet is reported by the bullet check alone and never counted twice.

### Cadence

Uniform cadence is the failure a ban list cannot express. A ban set states negatives, and fragments, verbless clauses, and sentences that all run one length are each the absence of something, so no word added to a ban list reaches any of them. The shape layer already measured a bullet, a paragraph, and a run, and stopped one level above where that failure lives.

Cadence measures a paragraph on two numbers. The spread is the words between its longest and shortest sentence, and the opener count is the times one word opens a sentence in it. A spread of five words or under reads as one cadence, and a word opening more than two sentences is a pattern rather than a coincidence. Both come from `## Rhythm` in the `write-human` skill, which states them about prose a person reads, and this measures against that statement rather than setting a threshold of its own.

Words are counted off the text a reader is shown. A link contributes its anchor text, an autolink contributes nothing, and the sentence boundaries do not move under that masking, since the boundary pattern requires whitespace after the terminal punctuation and no destination carries any. An opening word is lowercased and stripped of punctuation, so a sentence opening on a backticked command name reports the command.

A paragraph carrying fewer than three sentences is skipped rather than scored. A two-sentence configuration note has no spread worth reading, and the opener rule is written about a third sentence turning a coincidence into a pattern, so neither number says anything before the floor. That is the cheap form of a wider exemption: a shape-aware one, exempting a short reference block by what it is rather than by how many sentences it holds, waits on a second case.

The unit is the paragraph and each file names its worst on each measure, which follows the depth check rather than setting a precedent. A file's flattest paragraph and its most repetitive one are named only when each crosses its checkpoint, so a file reading healthy names nothing rather than offering its least healthy paragraph as a finding.

Neither number gates and neither names a file wrong. This is a weaker claim than the one the weight checkpoints make, because a healthy range differs by surface: a catalog entry is several short sentences carrying one fact each, and a page arguing a decision is not, so one range applied across the corpus would report the surfaces that are correct. The run therefore states where the numbers came from beside them, and the counts are what a reader compares against.

A reading of that spread across the whole corpus is what backs the range above, taken once against this repository's own tracked markdown rather than against a target project's.

That reading travels with the command rather than staying here. `BASELINE` in `src/markdown/structure.ts` carries the overall share, the per-file range, and the ten-paragraph floor beneath which a file's own rate says nothing, and the run prints all four in the legend beside the rate it measured. A count with no range beside it reads as a finding, and naming that a healthy range differs by surface states that a range exists rather than what it looks like. This page is toolkit-internal, so a reader running the command in a project that installed no standards would otherwise have two counts and nothing to place them against.

Two of the rules `write-human` states are deliberately not implemented. A sentence's grammatical shape and whether it carries a finite verb each need a parse rather than a match, and an imperative would read as a defect under a pattern that approximated either. The verbless share is the measure closest to the reported symptom, which is exactly why shipping it wrong would discredit the two that hold.

The condition on that was something identifying a finite verb rather than guessing at one, and two parsers have now been run against it over 11,389 paragraph sentences. They disagree by a factor of four. `compromise` reports 2 percent and reads a fronted past participle as a finite verb, so `Measured at <sha> on <date>.` counts as carrying one. `wink-pos-tagger` reports 9 percent, fixes that class, and is still wrong on roughly three in four, because an imperative's verb tags as a proper noun and a noun-ambiguous predicate tags as a noun, which makes `Each maps to a skill.` read verbless. Separating those needs to know which token is the predicate, and that is syntax rather than a tag. The measure stays unimplemented, now against a mechanism rather than against the idea of one.

### Length

The Length step sums rendered lines over the whole source, frontmatter and fenced blocks included, and lists each document past the 300-line ceiling, longest first. A changelog and a document carrying a whole-line `<!-- canon-length-exempt: <reason> -->` outside a fence are counted in one line rather than listed. Each `--json` entry carries `renderedLines` and `exempt`, the stated reason or `null`, and `checkpoints` carries `ceiling`.

## Exit codes

Exit codes are `0` for a completed run with no gating finding, `1` for a refusal, `2` for a ban hit or a dead relative link, and `3` for a shipped ban set that arrived empty. A banned character and a relative link resolving to nothing on disk each fail the run, both facts a scan settles rather than a reader judging. Bullet, paragraph, and depth weight are judgments a reader settles, and cadence is a distribution whose healthy range moves with the surface, so all four report under every code. Length reports the same way, since the audit also runs on a plan kept out of version control, and the Document ceiling stage in `canon gate run` owns that verdict instead.

`3` is separate from `1` because the two want different responses from a caller. A refusal means no corpus was built, and the `Markdown bans` stage in `canon gate run` is right to report it as unmeasured rather than as a pass. An empty set means the corpus was walked and nothing was looked for, so that stage fails the push on `3` rather than skipping.

`2` rather than `1` for the gate keeps a measurement that succeeded and found something distinct from the audit declining to measure at all. A caller reading one as the other sends a reader hunting a defect that does not exist, which is the distinction `canon context audit` and the gate's own seed stage already draw between the same two codes.

A banned character is a fact rather than a judgment, which is the test that admits it to a gate. What held it back was that gating on day one against a corpus never checked mechanically fails loudly on work nobody has had a chance to fix. The order was to land the verb reporting, measure the corpus once, fix what it finds, and turn the gate on as its own change, and the gate is the last of the four.

Of the five measures a first full reading took, the ban count is the only one a gate should ever read.

The ban half reached zero, which was the precondition the gate waited on, and it was re-measured against the same corpus at the moment the gate landed. Three sweep slices then took the structural half, and the corpus reports 1 heavy bullet and 22 heavy paragraphs across 6 files on 2026-08-06, every one on a ground the triage record holds as exempt.

Depth is the one measure no slice triaged, so its figure moved with the sweep rather than with the corpus. The break rule widened to bold section markers on 2026-08-28 and again to the colon-less ones the same day, and each drop came with no edit to any file, so the 41 above reads against a rule the command no longer runs. Read all four structural counts from a run rather than from this paragraph.

### What a hit asks of an author

Rewrite the sentence rather than swapping the banned token for a near-synonym. The rule is about the sense the token carries, so a swap that keeps the sense clears the report without clearing the violation.

A code span clears the report too, since the ban scan walks around one, and it is the answer only where the token is genuinely an identifier under discussion. `## Code and identifiers` in `markdown.md` reserves the span for commands, API names, file paths, and identifiers, so backticking a quoted utterance spends one rule to satisfy another and leaves the corpus no cleaner.

A hit the closed set could not separate from correct prose was the case with no third option while the set still carried words. The temporal `just` reported as the vague qualifier it happened to spell, and rewriting the sentence is what the toolkit settled on over building an exemption path, for the reasons below. That class is part of why the words left the gate.

### Where the rules are enforced

Five surfaces apply the ban set and four of them go through this verb. `.claude/hooks/standards-audit.sh` runs it against a single file after each markdown edit, the seed copy a project installs does the same, the `Markdown bans` stage in `canon gate run` runs it across the whole corpus before this repository's own push, and the same-named stage in `tooling/base/configs/scripts/verify.sh` runs it across a scaffolded project's tracked markdown before its own push. Each hook parsed its own copy of the word bans in awk before that, which left a British spelling passing at edit time and failing the push with nothing in between explaining the difference.

The seed copy moved onto the verb when the sets became data, since its awk had nothing left to parse. It resolves one runner where the toolkit copy resolves two, looking for no checkout source, and a machine carrying no `canon` gets a report naming the binary to install rather than a silent pass. `scripts/core/check-seed-independence.sh` scopes its walk to markdown and leaves the seed hooks outside it, which its own comment records as deliberate.

The target push stage reads the same exit codes `canon gate run`'s own stage reads: 0 passes, 1 is a refusal logged as a skip, 2 is a finding, and 3 is a shipped-empty ban set. It skips and logs rather than failing when no `canon` binary is on the machine's PATH, since a scaffolded project is not guaranteed the toolkit is installed, and its skip line names the install command.

The target push stage excludes `CHANGELOG.md`, unlike every other surface here. A changelog a generator builds from commit subjects carries prose nobody wrote against the ban set, where this repository's own passes only because `release-please` builds it from subjects sessions already wrote to the rule. The stage passes an explicit file list rather than the bare invocation the other surfaces use, so a corpus with no file left once the changelog is set aside reads as a pass rather than falling back to the whole tree.

The fifth surface reads the standards directly and is not a consolidation left half done. `claude/skills/standards-audit/SKILL.md` greps the banned tokens agent-side, which is a session reading prose rather than a process it can shell out to, and it ships to every target. It is the likeliest place for the next drift, since nothing compares it against the verb.

The hook prefers a checkout's own `src/cli.ts` over a globally installed binary, so it and the push stage read one build. A published binary lags a branch by whatever has not been released, which would put a ban kind added on the branch into the push and not into the edit. It reads its findings out of the `--json` record rather than off the exit code, so an older binary still reports where the fallback applies. It reads `bans.emptySets` out of the same record, so a set the verb shipped empty reaches the author as a check narrowed to what it could measure rather than as a clean pass.

That field replaced `bans.missingStandards`, which answered a standard resolving under none of three roots. The set ships with the package now, so the state it named cannot occur and the narrowed check has one cause left, a defect in the build. The hook keeps reading a field either way, since a reader cannot tell a narrowed check from a clean one without it.

Both hooks answer an absent record as well. A completed run always writes the record and a refusal writes none, so an empty one means the verb declined to measure rather than measured and found nothing. The verb needs a git repository to build its corpus and refuses without one, which is a project the seeded hook can be installed into, and reading the findings alone reported that as a clean file.

A machine with neither runner still blocks no edit, and it says so rather than exiting clean. The push stage holds either way. An edit nobody checked and an edit carrying no violation are one silence to a reader, so the enforcement a machine lacks is reported rather than inferred.

The stage measures the whole corpus rather than the changed files. A `Do not use` bullet added to a standard bans a token retroactively, and no file in the push that adds the bullet was edited.

### Why a recorded count goes stale

A count written into prose goes stale against the corpus it describes, and nothing compares the two. The paragraph figure recorded when the masking fix shipped was already wrong by twelve one release later, which is why the standard states the rule and this page carries the numbers.

A standard sits inside the corpus this verb measures, so rewriting a rule can breach the rule beside it. A rewrite of the paragraph weight bullet landed at 539 characters against the bullet checkpoint stated two lines below it, in the authoring copy and the consumed one alike. Neither the drift stage nor the test suite reads that, so run the verb over a standard after editing one.

Masking took 7 of the weight-only paragraphs the checkpoint reported at 400 and 4 of the 44 files under their checkpoints, and no bullet at all. The first corpus triage put those at 31 paragraphs and 2 bullets, and neither reproduces: a code span is walked around, so a backticked path holding an angle-bracket placeholder keeps the width the page gives it, and both bullets the triage counted were that shape.

### How the ban count reached zero

The set still carried words and spellings when the gate turned on, so this section and the next are history rather than a description of the current scan.

Eight word hits stood between the baseline and a gate, and only three carried the sense the standard bans. `leverage` sat in the requirements worldview, `allows` in the claude stack reference, and one `just` was the vague qualifier in a skill body. Those three lost the qualifier rather than the word.

The other five were correct prose the closed set cannot separate from a violation. Four were the temporal `just`, meaning a moment ago, in phrases like the implementation `just` completed and the field the user `just` edited. The fifth quoted an anti-pattern a skill exists to forbid. `markdown.md` banned vague qualifiers and listed the tokens those qualifiers happen to spell, so the rule as written reached none of the five while the scan reached all of them.

### Why they were rewritten rather than exempted

Rewriting all five is what settled them, over building an exemption path. An exemption has three consumers, `src/markdown/scan.ts` for the patterns, `src/markdown/bans.ts` for the sets, and `.claude/hooks/standards-audit.sh`, which held its own copy of the word bans in awk at that point. A mechanism landing in the verb and not the hook leaves an exempted line still failing on edit, which is the surface an author actually meets. Five sentences lost a small amount of naturalness and the count now means what it says.

A code span was the first answer for the quoted anti-pattern and it was the wrong one. The ban scan walks around a code span, so backticking a quotation clears the report, and `## Code and identifiers` reserves the span for commands, API names, file paths, and identifiers, which a quoted utterance is none of. Spending one rule to satisfy another leaves the corpus no cleaner than dropping the qualifier does.

The collision is structural rather than a property of five legacy sentences. Writing the task and the plan behind this change each reproduced it, because a fresh file discussing the ban quotes the tokens it discusses. A later author writing about vague qualifiers meets the same thing, and the answer is to name the token in a code span where it is genuinely an identifier being discussed, and to rewrite the sentence where it is not.

## What it does not cover

The verb reads the two attribute standards and nothing else. The five standards declaring `appliesTo: ["*"]` also include `publish.md`, `slug.md`, and `versioning.md`, none of which this implements.

`publish.md` describes a scan applying the same punctuation bans to finished text on its way out. No code implemented that scan before this command, so nothing is duplicated, and a later surface should call this verb rather than build a second one.

That standard's cross-reference rule is out of reach rather than merely unimplemented. It resolves by destination, bare where the destination auto-links a pull request or issue number and backticked where it does not, so this verb sees only the half where the backticked form is correct. A check here would report every compliant reference in the tree and reach none of the published text that goes wrong, which is why the rule holds on reading alone.

The list-density rule at `standards/markdown.md` is out of scope on purpose, since it carries no number and what a density figure should measure is still open.
