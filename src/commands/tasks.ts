import type { Command } from 'commander'
import { registerArchive } from '@/commands/tasks/archive'
import { registerBoard } from '@/commands/tasks/board'
import { registerList } from '@/commands/tasks/list'
import { registerPlans } from '@/commands/tasks/plans'
import { registerRecord } from '@/commands/tasks/record'
import { registerValidate } from '@/commands/tasks/validate'

export function register(program: Command): void {
  const tasks = program
    .command('tasks')
    .description('Manage the task board in .canon/tasks/')
    .helpOption('-h, --help', 'Show this help message')

  registerArchive(tasks)
  registerValidate(tasks)
  registerPlans(tasks)
  registerRecord(tasks)
  registerList(tasks)
  registerBoard(tasks)
}
