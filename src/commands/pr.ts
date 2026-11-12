import type { Command } from 'commander'
import { registerKeyChanges } from '@/commands/pr/key-changes'
import { registerHead } from '@/commands/pr/head'
import { registerChecks } from '@/commands/pr/checks'
import { registerReviewState } from '@/commands/pr/review-state'
import { registerEvidence } from '@/commands/pr/evidence'
import { registerLift } from '@/commands/pr/lift'
import { registerMerge } from '@/commands/pr/merge'
import { registerClose } from '@/commands/pr/close'
import { registerPreview } from '@/commands/pr/preview'
import { registerLocal } from '@/commands/pr/local'
import { registerTick } from '@/commands/pr/tick'
import { registerDriveCopy } from '@/commands/pr/drive-copy'
import { registerFrames } from '@/commands/pr/frames'

export function register(program: Command): void {
  const pr = program
    .command('pr')
    .description('Read a pull request body against the change it describes')
    .helpOption('-h, --help', 'Show this help message')

  registerKeyChanges(pr)

  registerHead(pr)

  registerChecks(pr)

  registerReviewState(pr)

  registerEvidence(pr)

  registerLift(pr)

  registerMerge(pr)

  registerClose(pr)

  registerPreview(pr)

  registerLocal(pr)

  registerTick(pr)

  registerDriveCopy(pr)

  registerFrames(pr)
}
