import { readdirSync, statSync } from 'fs'
import { join } from 'path'

export const definition = {
  type: 'function',
  function: {
    name: 'list_files',
    description: 'List files in directory',
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
  const items = readdirSync(fullPath).map(n => ({
    name: n,
    isDirectory: statSync(join(fullPath, n)).isDirectory(),
    path: join(args.relativePath as string, n)
  }))
  return { success: true, result: { items } }
}
