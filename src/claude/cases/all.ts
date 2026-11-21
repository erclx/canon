import type { SkillCase } from '@/claude/skills-rank'
import { AUTHORING_CASES } from '@/claude/cases/authoring'
import { GIT_CASES } from '@/claude/cases/git'
import { MISC_CASES } from '@/claude/cases/misc'
import { SETUP_CASES } from '@/claude/cases/setup'
import { WORKFLOW_CASES } from '@/claude/cases/workflow'

/**
 * The full routing case corpus, one file per domain so a description change
 * in one family touches only the file beside it. Positives are rephrased,
 * never lifted from a skill's own trigger, which would pass by construction.
 */
export const SKILL_CASES: readonly SkillCase[] = [
  ...WORKFLOW_CASES,
  ...GIT_CASES,
  ...SETUP_CASES,
  ...AUTHORING_CASES,
  ...MISC_CASES,
]
