import { unlinkSync } from 'fs'
import { join } from 'path'
import { gitAdd } from '../git'

export const definition = {
  type: 'function',
  function: {
    name: 'delete_file',
    description: 'Delete a file',
    parameters: {
      type: 'object',
      properties: {
        relativePath: { type: 'string', description: 'The relative path' }
      },
      required: ['relativePath']
    }
  }
}

export async function execute(baseDir: string, args: Record<string, unknown>) {
  const fullPath = join(baseDir, args.relativePath as string)
  unlinkSync(fullPath)
  await gitAdd([args.relativePath as string])
  return { success: true, result: { path: fullPath } }
}
