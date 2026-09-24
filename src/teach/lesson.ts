import { existsSync } from 'node:fs'
import { join } from 'node:path'
import {
  readWorkspace,
  refuse,
  TEACH_ASSETS,
  TEACH_LESSONS,
  TEACH_STYLESHEET,
  type TeachRefused,
} from '@/teach/workspace'

/** Four digits inside a workspace, per the standard, because one holds many. */
const LESSON_WIDTH = 4

/** The ordinal a lesson filename opens with, which fixes its read order. */
export const LESSON_NUMBER = /^(\d{4})-/

const LESSON_SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/

/** A quiz needs a right answer and at least one thing to confuse it with. */
const MIN_OPTIONS = 2

export interface QuizOrder {
  /** One-based, so a report reads the same way the lesson numbers them. */
  readonly question: number
  /**
   * Authored indices in the order the lesson presents them, where the authored
   * index `0` is the correct answer. The author writes the correct option first
   * and reads its position back off this list.
   */
  readonly order: readonly number[]
  /** Where the correct answer lands, one-based, so no caller derives it. */
  readonly answer: number
}

export interface LessonPlanned {
  readonly ok: true
  readonly slug: string
  /** Relative to the root, so a caller prints a path a reader can open. */
  readonly path: string
  readonly lesson: string
  /** Read this and embed its content in the lesson's `<style>` block. */
  readonly stylesheet: string
  /** False on the first lesson in a workspace, which writes the stylesheet. */
  readonly stylesheetExists: boolean
  /** The mission's success lines, reported as the exit criteria they are. */
  readonly success: readonly string[]
  readonly quiz: readonly QuizOrder[]
}

export type LessonOutcome = LessonPlanned | TeachRefused

export interface LessonRequest {
  readonly slug: string
  readonly questions: number
  readonly options: number
  /**
   * Injected so a test can assert the shape of an order against a generator it
   * controls. Every caller outside a test takes the default, which is what
   * keeps the position of a correct answer off the author's judgment.
   */
  readonly random?: () => number
}

/**
 * A uniform permutation of `0 .. count - 1` by Fisher-Yates.
 *
 * The bias this exists against is the authored order surviving into the
 * lesson, which puts the correct answer first whenever the author wrote it
 * first. Drawing the permutation here rather than in a prompt is what makes the
 * position unguessable from the outside.
 */
function shuffled(count: number, random: () => number): number[] {
  const order = Array.from({ length: count }, (_, index) => index)

  for (let index = count - 1; index > 0; index -= 1) {
    const pick = Math.floor(random() * (index + 1))
    const held = order[index]
    order[index] = order[pick]
    order[pick] = held
  }

  return order
}

/**
 * One presentation order per question, each carrying where the correct answer
 * landed. Both halves travel together because a caller deriving the position
 * itself is a caller that can derive it wrongly.
 */
export function orderQuiz(
  questions: number,
  options: number,
  random: () => number = Math.random,
): QuizOrder[] {
  return Array.from({ length: questions }, (_, index) => {
    const order = shuffled(options, random)

    return {
      question: index + 1,
      order,
      answer: order.indexOf(0) + 1,
    }
  })
}

/**
 * The number the next lesson takes, read off the filenames already there.
 *
 * A file whose name carries no ordinal moves nothing, the way a workspace
 * folder with no ordinal moves no workspace number. Numbering past it would
 * renumber nothing and skipping it would hide it.
 */
function nextLesson(files: readonly string[]): string {
  const highest = files
    .map((file) => LESSON_NUMBER.exec(file)?.[1])
    .filter((ordinal): ordinal is string => ordinal !== undefined)
    .reduce((carry, ordinal) => Math.max(carry, Number(ordinal)), 0)

  return String(highest + 1).padStart(LESSON_WIDTH, '0')
}

/**
 * Everything a lesson needs resolved before it is written: where it goes, which
 * stylesheet it embeds and whether that file is already on disk, the mission's
 * exit criteria, and the order each quiz presents its options in.
 *
 * The stylesheet is reported rather than written. Every lesson after the first
 * reads the one the first wrote, so a verb that rewrote it on every lesson
 * would discard whatever the last one added.
 */
export async function planLesson(
  root: string,
  selector: string,
  request: LessonRequest,
): Promise<LessonOutcome> {
  if (!LESSON_SLUG.test(request.slug)) {
    return refuse('bad-input', `Not a kebab-case slug: ${request.slug}.`, [
      request.slug,
    ])
  }

  if (!Number.isInteger(request.questions) || request.questions < 1) {
    return refuse(
      'bad-input',
      'A lesson carries at least one question. Pass --questions <n>.',
    )
  }

  if (!Number.isInteger(request.options) || request.options < MIN_OPTIONS) {
    return refuse(
      'bad-input',
      `A question carries at least ${MIN_OPTIONS} options. Pass --options <n>.`,
    )
  }

  const found = await readWorkspace(root, selector)
  if (!found.ok) return found

  const workspace = found.workspace
  const lesson = join(
    workspace.path,
    TEACH_LESSONS,
    `${nextLesson(workspace.lessonFiles)}-${request.slug}.html`,
  )
  const stylesheet = join(workspace.path, TEACH_ASSETS, TEACH_STYLESHEET)

  return {
    ok: true,
    slug: workspace.slug,
    path: workspace.path,
    lesson,
    stylesheet,
    stylesheetExists: existsSync(join(root, stylesheet)),
    success: workspace.success,
    quiz: orderQuiz(request.questions, request.options, request.random),
  }
}
