import { describe, expect, it } from 'vitest'
import { scanPhaseLabels } from '@/labels/phase'
import { BAN_SETS } from '@/markdown/bans'

const FEATURE_HEAD = 'feat/phase-label-gate'
const RELEASE_HEAD = 'release-please--branches--main--components--canon'
const RELEASE_TITLE = 'chore(main): release 3.46.0'

/**
 * The two session links that reached the trunk, carried verbatim.
 *
 * Both sit in public history already, at `ae69bfdd` and `834dbbf8`, so the
 * fixture records the defect it was measured against rather than imitating it.
 */
const MERGED_SESSION_LINK =
  'https://claude.ai/code/session_01VgM3xMwitxkp2EM3h5GPbt'
const SECOND_SESSION_LINK =
  'https://claude.ai/code/session_01FZZTHsjo3QSFhTJCZmdEny'

describe('scanPhaseLabels', () => {
  it('should fail a feature body carrying a phase label', () => {
    const result = scanPhaseLabels({
      title: 'feat: add the phase label gate',
      body: 'Planned under v59.7. See the plan for detail.',
      headRefName: FEATURE_HEAD,
    })

    expect(result).toEqual({
      cutsRelease: false,
      phaseLabels: ['v59.7'],
      semverTags: [],
      boardReferences: [],
      sessionLinks: [],
    })
  })

  it('should pass a release body carrying a semver reference', () => {
    const result = scanPhaseLabels({
      title: RELEASE_TITLE,
      body: '## [3.46.0](https://github.com/erclx/canon/compare/v3.45.0...v3.46.0)',
      headRefName: RELEASE_HEAD,
    })

    expect(result).toEqual({
      cutsRelease: true,
      phaseLabels: [],
      semverTags: ['v3.45.0', 'v3.46.0'],
      boardReferences: [],
      sessionLinks: [],
    })
  })

  it('should fail a feature body carrying both a phase label and a semver reference, naming only the phase label', () => {
    const result = scanPhaseLabels({
      title: 'fix: unblock v3.44',
      body: 'Scheduled under v68.5, references the v3.44 release.',
      headRefName: FEATURE_HEAD,
    })

    expect(result).toEqual({
      cutsRelease: false,
      phaseLabels: ['v3.44', 'v68.5'],
      semverTags: [],
      boardReferences: [],
      sessionLinks: [],
    })
  })

  it('should not flag a phase label quoted inside a fenced block', () => {
    const result = scanPhaseLabels({
      title: 'fix: reproduce the task row',
      body: [
        'Quoting the row verbatim:',
        '',
        '```',
        '- v59.7: fix the gate',
        '```',
      ].join('\n'),
      headRefName: FEATURE_HEAD,
    })

    expect(result).toEqual({
      cutsRelease: false,
      phaseLabels: [],
      semverTags: [],
      boardReferences: [],
      sessionLinks: [],
    })
  })

  it('should not flag a version-shaped token inside an inline code span', () => {
    const result = scanPhaseLabels({
      title: 'fix: document the fixture name',
      body: 'The function prints `v2.0-second` for the second call in the example.',
      headRefName: FEATURE_HEAD,
    })

    expect(result).toEqual({
      cutsRelease: false,
      phaseLabels: [],
      semverTags: [],
      boardReferences: [],
      sessionLinks: [],
    })
  })

  it('should still flag a phase label written as plain text beside a code span', () => {
    const result = scanPhaseLabels({
      title: 'fix: document the fixture name',
      body: 'Planned under v59.7. The function prints `v2.0-second` in the example.',
      headRefName: FEATURE_HEAD,
    })

    expect(result).toEqual({
      cutsRelease: false,
      phaseLabels: ['v59.7'],
      semverTags: [],
      boardReferences: [],
      sessionLinks: [],
    })
  })

  it('should require both the release head prefix and the release title to treat tokens as semver', () => {
    const result = scanPhaseLabels({
      title: 'feat: pretend this cuts a release',
      body: 'v59.7',
      headRefName: RELEASE_HEAD,
    })

    expect(result).toEqual({
      cutsRelease: false,
      phaseLabels: ['v59.7'],
      semverTags: [],
      boardReferences: [],
      sessionLinks: [],
    })
  })

  it('should find no tokens in ordinary text', () => {
    const result = scanPhaseLabels({
      title: 'fix: correct the off-by-one',
      body: 'No version-shaped text here.',
      headRefName: FEATURE_HEAD,
    })

    expect(result).toEqual({
      cutsRelease: false,
      phaseLabels: [],
      semverTags: [],
      boardReferences: [],
      sessionLinks: [],
    })
  })

  it('should report a board identifier a code span holds on its own', () => {
    const result = scanPhaseLabels({
      title: 'feat: widen the scan',
      body: 'Planned under `v75.1` and nothing else.',
      headRefName: FEATURE_HEAD,
    })

    expect(result).toEqual({
      cutsRelease: false,
      phaseLabels: [],
      semverTags: [],
      boardReferences: ['v75.1'],
      sessionLinks: [],
    })
  })

  it('should report a board identifier a code span holds where the possessive sits outside it', () => {
    const result = scanPhaseLabels({
      title: 'feat: widen the scan',
      body: "Carried over from `v53.9`'s pass on the same surface.",
      headRefName: FEATURE_HEAD,
    })

    expect(result).toEqual({
      cutsRelease: false,
      phaseLabels: [],
      semverTags: [],
      boardReferences: ['v53.9'],
      sessionLinks: [],
    })
  })

  it('should name a token once when it is written both bare and quoted', () => {
    const result = scanPhaseLabels({
      title: 'feat: widen the scan',
      body: 'Planned under v75.1, which the row writes as `v75.1`.',
      headRefName: FEATURE_HEAD,
    })

    expect(result).toEqual({
      cutsRelease: false,
      phaseLabels: ['v75.1'],
      semverTags: [],
      boardReferences: [],
      sessionLinks: [],
    })
  })

  it('should report a record path whether or not a code span holds it', () => {
    const result = scanPhaseLabels({
      title: 'feat: widen the scan',
      body: 'See .canon/review/feedback/ and `.canon/tasks/priority.md` for detail.',
      headRefName: FEATURE_HEAD,
    })

    expect(result).toEqual({
      cutsRelease: false,
      phaseLabels: [],
      semverTags: [],
      boardReferences: ['.canon/review/feedback/', '.canon/tasks/priority.md'],
      sessionLinks: [],
    })
  })

  it('should report a record path written at the root an unmigrated project still uses', () => {
    const result = scanPhaseLabels({
      title: 'feat: widen the scan',
      body: 'The row sits in .claude/tasks/priority.md on that target.',
      headRefName: FEATURE_HEAD,
    })

    expect(result).toEqual({
      cutsRelease: false,
      phaseLabels: [],
      semverTags: [],
      boardReferences: ['.claude/tasks/priority.md'],
      sessionLinks: [],
    })
  })

  it('should report an ignored path the record move left behind', () => {
    const result = scanPhaseLabels({
      title: 'feat: widen the scan',
      body: 'Worktree left at .claude/worktrees/x and receipt at .canon/review/branch/y.md.',
      headRefName: FEATURE_HEAD,
    })

    expect(result).toEqual({
      cutsRelease: false,
      phaseLabels: [],
      semverTags: [],
      boardReferences: ['.claude/worktrees/x', '.canon/review/branch/y.md'],
      sessionLinks: [],
    })
  })

  it('should report the scratch folder under the tracked root at its own spelling', () => {
    const result = scanPhaseLabels({
      title: 'feat: widen the scan',
      body: 'Scratch on that target sits at .claude/.tmp/x.md.',
      headRefName: FEATURE_HEAD,
    })

    expect(result).toEqual({
      cutsRelease: false,
      phaseLabels: [],
      semverTags: [],
      boardReferences: ['.claude/.tmp/x.md'],
      sessionLinks: [],
    })
  })

  it('should leave a tracked path under the same root alone', () => {
    const result = scanPhaseLabels({
      title: 'feat: widen the scan',
      body: 'The rule is .claude/rules/core/005-behavior.md, which every clone resolves.',
      headRefName: FEATURE_HEAD,
    })

    expect(result).toEqual({
      cutsRelease: false,
      phaseLabels: [],
      semverTags: [],
      boardReferences: [],
      sessionLinks: [],
    })
  })

  it('should report a path under a record-root folder no entry list names', () => {
    const result = scanPhaseLabels({
      title: 'feat: widen the scan',
      body: 'See .canon/notes/x.md for detail.',
      headRefName: FEATURE_HEAD,
    })

    expect(result).toEqual({
      cutsRelease: false,
      phaseLabels: [],
      semverTags: [],
      boardReferences: ['.canon/notes/x.md'],
      sessionLinks: [],
    })
  })

  it('should report the old scratch spelling written under the new root', () => {
    const result = scanPhaseLabels({
      title: 'feat: widen the scan',
      body: 'Scratch sits at .canon/.tmp/x.md until it is cleaned up.',
      headRefName: FEATURE_HEAD,
    })

    expect(result).toEqual({
      cutsRelease: false,
      phaseLabels: [],
      semverTags: [],
      boardReferences: ['.canon/.tmp/x.md'],
      sessionLinks: [],
    })
  })

  it('should report nothing for a bare record root with nothing after the separator, in a span and out of one', () => {
    const result = scanPhaseLabels({
      title: 'feat: widen the scan',
      body: 'Every record lives under .canon/ now, and the ignore line spells it `.canon/` too.',
      headRefName: FEATURE_HEAD,
    })

    expect(result).toEqual({
      cutsRelease: false,
      phaseLabels: [],
      semverTags: [],
      boardReferences: [],
      sessionLinks: [],
    })
  })

  it('should report nothing when a fenced block carries the unnamed-folder, scratch-spelling, and bare-root shapes', () => {
    const result = scanPhaseLabels({
      title: 'feat: widen the scan',
      body: [
        'Reproducing what the report would look like:',
        '',
        '```',
        'See .canon/notes/x.md and .canon/.tmp/x.md, or just .canon/ bare.',
        '```',
      ].join('\n'),
      headRefName: FEATURE_HEAD,
    })

    expect(result).toEqual({
      cutsRelease: false,
      phaseLabels: [],
      semverTags: [],
      boardReferences: [],
      sessionLinks: [],
    })
  })

  it('should report nothing when a fenced block carries every reportable shape', () => {
    const result = scanPhaseLabels({
      title: 'fix: quote the row verbatim',
      body: [
        'Reproducing what the board holds:',
        '',
        '```',
        '- v59.7: fix the gate',
        'Planned under `v75.1`, tracked at .canon/tasks/priority.md',
        '```',
      ].join('\n'),
      headRefName: FEATURE_HEAD,
    })

    expect(result).toEqual({
      cutsRelease: false,
      phaseLabels: [],
      semverTags: [],
      boardReferences: [],
      sessionLinks: [],
    })
  })

  it('should find no board identifier in the markdown ban sets, which are scanned inside the repository', () => {
    const result = scanPhaseLabels({
      title: 'fix: restate the ban sets',
      body: [...BAN_SETS.characters].join(' '),
      headRefName: FEATURE_HEAD,
    })

    expect(result).toEqual({
      cutsRelease: false,
      phaseLabels: [],
      semverTags: [],
      boardReferences: [],
      sessionLinks: [],
    })
  })

  it('should report a session link a body ends on, which is the shape both merged instances carry', () => {
    const result = scanPhaseLabels({
      title: 'fix: repoint every dead heading citation',
      body: `Repoints the citations.\n\n${MERGED_SESSION_LINK}`,
      headRefName: FEATURE_HEAD,
    })

    expect(result).toEqual({
      cutsRelease: false,
      phaseLabels: [],
      semverTags: [],
      boardReferences: [],
      sessionLinks: [MERGED_SESSION_LINK],
    })
  })

  it('should report a session link a code span holds', () => {
    const result = scanPhaseLabels({
      title: 'feat: widen the scan',
      body: `The harness appends \`${MERGED_SESSION_LINK}\` to the body.`,
      headRefName: FEATURE_HEAD,
    })

    expect(result).toEqual({
      cutsRelease: false,
      phaseLabels: [],
      semverTags: [],
      boardReferences: [],
      sessionLinks: [MERGED_SESSION_LINK],
    })
  })

  it('should report nothing when a fenced block holds the session link', () => {
    const result = scanPhaseLabels({
      title: 'feat: widen the scan',
      body: [
        'Quoting the instruction verbatim:',
        '',
        '```',
        `End the body with ${MERGED_SESSION_LINK}`,
        '```',
      ].join('\n'),
      headRefName: FEATURE_HEAD,
    })

    expect(result).toEqual({
      cutsRelease: false,
      phaseLabels: [],
      semverTags: [],
      boardReferences: [],
      sessionLinks: [],
    })
  })

  it('should report a session link on a release pull request, which the board-reference exemption does not reach', () => {
    const result = scanPhaseLabels({
      title: RELEASE_TITLE,
      body: `## [3.46.0](https://github.com/erclx/canon/compare/v3.45.0...v3.46.0)\n\n${SECOND_SESSION_LINK}`,
      headRefName: RELEASE_HEAD,
    })

    expect(result).toEqual({
      cutsRelease: true,
      phaseLabels: [],
      semverTags: ['v3.45.0', 'v3.46.0'],
      boardReferences: [],
      sessionLinks: [SECOND_SESSION_LINK],
    })
  })

  it('should sort a phase label, a record path, and a session link into three fields', () => {
    const result = scanPhaseLabels({
      title: 'feat: widen the scan',
      body: `Planned under v77.4, tracked at .canon/tasks/priority.md.\n\n${MERGED_SESSION_LINK}`,
      headRefName: FEATURE_HEAD,
    })

    expect(result).toEqual({
      cutsRelease: false,
      phaseLabels: ['v77.4'],
      semverTags: [],
      boardReferences: ['.canon/tasks/priority.md'],
      sessionLinks: [MERGED_SESSION_LINK],
    })
  })

  it('should leave an ordinary claude.ai link that names no session alone', () => {
    const result = scanPhaseLabels({
      title: 'docs: link the product page',
      body: 'Read https://claude.ai/code and https://claude.ai/chat/abc for detail.',
      headRefName: FEATURE_HEAD,
    })

    expect(result).toEqual({
      cutsRelease: false,
      phaseLabels: [],
      semverTags: [],
      boardReferences: [],
      sessionLinks: [],
    })
  })
})
