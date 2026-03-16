import { existsSync, mkdirSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { gitAdd } from '../git'

export const definition = {
  type: 'function',
  function: {
    name: 'create_file',
    description: 'Create a new file with content',
    parameters: {
      type: 'object',
      properties: {
        relativePath: { type: 'string', description: 'The relative path' },
        content: { type: 'string', description: 'File content' }
      },
      required: ['relativePath', 'content']
    }
  }
}

export async function execute(baseDir: string, args: Record<string, unknown>) {
  const fullPath = join(baseDir, args.relativePath as string)
  if (!existsSync(dirname(fullPath))) mkdirSync(dirname(fullPath), { recursive: true })
  writeFileSync(fullPath, args.content as string, 'utf-8')
  await gitAdd([args.relativePath as string])
  return { success: true, result: { path: fullPath } }
}
