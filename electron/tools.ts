import { existsSync, mkdirSync, writeFileSync, readFileSync, unlinkSync, readdirSync, statSync } from 'fs'
import { join, dirname } from 'path'
import { getBaseDirectory } from './state'

export const tools = [
  {
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
  },
  {
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
  },
  {
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
  },
  {
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
]

export async function executeTool(name: string, args: Record<string, unknown>) {
  const baseDir = getBaseDirectory()
  try {
    if (name === 'create_file') {
      const fullPath = join(baseDir, args.relativePath as string)
      if (!existsSync(dirname(fullPath))) mkdirSync(dirname(fullPath), { recursive: true })
      writeFileSync(fullPath, args.content as string, 'utf-8')
      return { success: true, result: { path: fullPath } }
    }
    if (name === 'read_file') {
      const fullPath = join(baseDir, args.relativePath as string)
      return { success: true, result: { content: readFileSync(fullPath, 'utf-8') } }
    }
    if (name === 'delete_file') {
      const fullPath = join(baseDir, args.relativePath as string)
      unlinkSync(fullPath)
      return { success: true, result: { path: fullPath } }
    }
    if (name === 'list_files') {
      const fullPath = join(baseDir, args.relativePath as string)
      const items = readdirSync(fullPath).map(n => ({
        name: n,
        isDirectory: statSync(join(fullPath, n)).isDirectory(),
        path: join(args.relativePath as string, n)
      }))
      return { success: true, result: { items } }
    }
    return { success: false, error: 'Unknown tool' }
  } catch (e) {
    return { success: false, error: String(e) }
  }
}
