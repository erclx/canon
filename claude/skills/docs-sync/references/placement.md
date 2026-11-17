---
title: Placement reference
description: The closed list of triggers that let a sync create a page, a heading, or a subfolder, the default that creates nothing, the search for the nearest page, and the split steps
---

# Placement reference

Applies to every sync, before it rewrites a line. A sync left to rewrite in place lands every feature on the nearest existing page, until one section holds a whole product. This list names the only changes that earn a new page or heading, and everything else stays a rewrite.

## Triggers

Read the diff against each row in order and take the first that fires. A diff carrying several surfaces takes a row per surface.

| The diff adds                                               | The sync does                                          |
| ----------------------------------------------------------- | ------------------------------------------------------ |
| A command a person runs by hand, with no page               | Opens a `kind: reference` page for it                  |
| A name a user sees or types, which no title or H2 carries   | Adds an H2 on the nearest page, never a page           |
| An H2 past the bullet-run limit, or a page past its ceiling | Moves that H2 into a page of its own, links retargeted |
| A shelf that reads as a section of the catalog              | Moves the shelf to a subfolder with a seeded index     |
| Anything else                                               | Creates nothing, and rewrites stale lines in place     |

The last row is the default. A changed flag, a new output field, or a reworded refusal creates nothing, and the lines describing it are rewritten where they stand.

### Reading each row

Each row names a fact the diff and the pages settle between them, so two sessions reach the same row.

- **A command run by hand** is one a person or a target project types. A command only a skill calls gets no page, since the calling skill and its `--help` cover it, per `docs.md`.
- **A name a user sees or types** is a screen, a panel, a setting, or a mode in an app. In a command-line tool or a library it is a subcommand group or a public export.
- **The bullet-run limit and the ceiling** are the ones `markdown.md` states, being 5 plain bullets in a row and 300 rendered lines. Read both from `canon markdown audit`, never by counting.
- **A shelf reading as a section** is the signal `docs.md` states under its folder split. This reference adds no second rule for it.

## Finding the nearest page

The second row adds a heading to the nearest page, and a judgment there lets two sessions pick two pages. Run it as a search instead.

1. Read from the diff what the new name sits inside, such as the screen holding a new panel or the command group holding a new subcommand.
2. Search every discovered page's title and H2s for that parent name.
3. One match takes the new H2 on that page, placed beside the H2 that matched or under the title that did.
4. Several matches take the page whose title names the parent, and a tie between titles counts as no match.
5. No match writes nothing. Report the name as unplaced and let the author place it.

An unplaced name is a correct result, never a reason to fall back to the closest-sounding page. That fallback is the habit this list exists to stop.

## Opening a reference page

A page for a new command takes the four-part shape and template `docs.md` states under its reference pages, and nothing else.

- Name the file for the command, in the folder where its sibling command pages sit
- Declare `category` when its folder's pages declare one, spelled as its siblings spell it
- Link to it from the page that lists commands, in the same change
- Fill each part from the diff alone. A part the diff gives no fact for is left out rather than guessed.

## Splitting a page

The third and fourth rows move pages, which changes paths other work cites. A sync splits only what it is writing into, so a pull request never moves pages unrelated to its change.

### Which pages split

A page or an H2 qualifies only when this sync rewrites or adds a line in it, and the audit then reports it past a limit.

- Leave a page the diff does not reach as it is, even past its ceiling, and report it in the summary
- Leave a shelf this sync added no page to, whatever it reads as

### Moving an H2 to its own page

An H2 moving out becomes a page of its own beside the one it left.

1. Open the new page with frontmatter per `docs.md`, its title taken from the H2 and its `category` from the page it left.
2. Move the H2's body under the new page's H1, raising each H3 to an H2.
3. Leave one line under the old H2 linking to the new page, or drop the H2 when the page lists its siblings elsewhere.
4. Retarget every link into the moved section, across every discovered page, in the same change.

### Moving a shelf to a subfolder

Follow the folder split in `docs.md` as written, which moves every page on the shelf, seeds the subfolder's catalog page, and retargets every link. Name each moved path in the summary.

## Reporting

A created or moved path is a fact a reader of the pull request needs, since another branch may cite the old one. The summary names each, one line apiece, beside the lines for what was rewritten.

- A page or H2 created, by its path and the row that fired
- A page or H2 moved, by its old path and its new one
- A name left unplaced, with the parent the search looked for
- A page past a limit and left alone, with the limit it passed
