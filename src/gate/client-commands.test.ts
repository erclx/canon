import { describe, expect, it } from 'vitest'
import {
  CLIENT_COMMAND_MARKER,
  type ClientCommand,
  clientCommandCitationsIn,
} from '@/gate/client-commands'

const RM: ClientCommand = {
  command: 'claude rm',
  canonicalArgument: 'id',
  source: 'test fixture',
}

describe('clientCommandCitationsIn', () => {
  it('should pass the canonical bracketed form', () => {
    const citations = clientCommandCitationsIn(
      'docs/agents/worktrees.md',
      'Removal there goes through `claude rm <id>`.\n',
      [RM],
    )

    expect(citations).toEqual([])
  })

  it('should flag a wrong bracketed argument', () => {
    const citations = clientCommandCitationsIn(
      'src/commands/worktrees.ts',
      // canon-allow-client-command: fixture for a wrong argument, not a real citation
      "goes through: claude rm '<name>'\n",
      [RM],
    )

    expect(citations).toHaveLength(1)
    expect(citations[0]).toMatchObject({
      file: 'src/commands/worktrees.ts',
      line: 1,
      command: 'claude rm',
      argument: 'name',
      // canon-allow-client-command: fixture for a wrong argument, not a real citation
      text: "claude rm '<name>'",
    })
  })

  it('should flag a wrong template-interpolation argument', () => {
    const citations = clientCommandCitationsIn(
      'src/commands/worktrees.ts',
      // canon-allow-client-command: fixture for a wrong argument, not a real citation
      "goes through: claude rm '${name}'\n",
      [RM],
    )

    expect(citations).toHaveLength(1)
    expect(citations[0]?.argument).toBe('name')
  })

  it('should pass the canonical template-interpolation form', () => {
    const citations = clientCommandCitationsIn(
      'src/commands/worktrees.ts',
      "goes through: claude rm '${id}'\n",
      [RM],
    )

    expect(citations).toEqual([])
  })

  it('should pass a property access ending in the canonical argument', () => {
    const citations = clientCommandCitationsIn(
      'src/commands/worktrees.ts',
      "goes through: claude rm '${session.id}'\n",
      [RM],
    )

    expect(citations).toEqual([])
  })

  it('should flag a property access ending in the wrong argument', () => {
    const citations = clientCommandCitationsIn(
      'src/commands/worktrees.ts',
      // canon-allow-client-command: fixture for a wrong argument, not a real citation
      "goes through: claude rm '${session.name}'\n",
      [RM],
    )

    expect(citations).toHaveLength(1)
    expect(citations[0]).toMatchObject({
      argument: 'name',
      // canon-allow-client-command: fixture for a wrong argument, not a real citation
      text: "claude rm '${session.name}'",
    })
  })

  it('should leave a sentence with no bracketed argument unchecked', () => {
    const citations = clientCommandCitationsIn(
      'src/worktrees/reclaim.ts',
      '`claude rm` takes an id rather than a name.\n',
      [RM],
    )

    expect(citations).toEqual([])
  })

  it('should mute a flagged line carrying the marker', () => {
    const citations = clientCommandCitationsIn(
      'src/commands/worktrees.ts',
      `goes through: claude rm '\${name}' <!-- ${CLIENT_COMMAND_MARKER}: illustrates the wrong form on purpose -->\n`,
      [RM],
    )

    expect(citations).toEqual([])
  })

  it('should name the line above when the marker sits there instead', () => {
    const citations = clientCommandCitationsIn(
      'src/commands/worktrees.ts',
      `<!-- ${CLIENT_COMMAND_MARKER}: illustrates the wrong form on purpose -->\ngoes through: claude rm '\${name}'\n`,
      [RM],
    )

    expect(citations).toEqual([])
  })

  it('should check nothing against an empty table', () => {
    const citations = clientCommandCitationsIn(
      'src/commands/worktrees.ts',
      // canon-allow-client-command: fixture for a wrong argument, not a real citation
      "goes through: claude rm '${name}'\n",
      [],
    )

    expect(citations).toEqual([])
  })
})
