import { readFileSync } from 'fs'
import { join } from 'path'

export const definition = {
  type: 'function',
  function: {
    name: 'read_file',
    description: 'Read file content',
    parameters: {
      type: 'object',
      properties: {
        relativePath: { type: 'string', description: 'The relative path' }
      },
      required: ['relativePath']
    }
  }
}

export function execute(baseDir: string, args: Record<string, unknown>) {
  const fullPath = join(baseDir, args.relativePath as string)
  return { success: true, result: { content: readFileSync(fullPath, 'utf-8') } }
}
