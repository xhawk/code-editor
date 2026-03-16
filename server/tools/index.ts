import { getBaseDirectory } from '../../clients/electron/state'

export type ToolResult = { success: true; result: unknown } | { success: false; error: string }
import { AGENTS } from '../agents/agents'
import type { AgentMode } from '../agents/agents'
import * as createFile from './create_file'
import * as readFile from './read_file'
import * as deleteFile from './delete_file'
import * as listFiles from './list_files'
import * as getGitStatus from './get_git_status'

const registry = [createFile, readFile, deleteFile, listFiles, getGitStatus]

export const tools = registry.map(t => t.definition)

export function getToolsForMode(mode: AgentMode) {
  const allowed = AGENTS[mode].allowedTools
  if (allowed === null) return tools
  return tools.filter(t => allowed.includes(t.function.name))
}

export async function executeTool(name: string, args: Record<string, unknown>): Promise<ToolResult> {
  const baseDir = getBaseDirectory()
  try {
    const tool = registry.find(t => t.definition.function.name === name)
    if (!tool) return { success: false, error: 'Unknown tool' }
    return (await tool.execute(baseDir, args)) as ToolResult
  } catch (e) {
    return { success: false, error: String(e) }
  }
}
