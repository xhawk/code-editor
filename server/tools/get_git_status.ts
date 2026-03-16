import { getGitStatus } from '../git'

export const definition = {
  type: 'function',
  function: {
    name: 'get_git_status',
    description: 'Get git status showing changed, staged, and untracked files in the current worktree',
    parameters: {
      type: 'object',
      properties: {},
      required: []
    }
  }
}

export async function execute(baseDir: string, _args: Record<string, unknown>) {
  const status = await getGitStatus(baseDir)
  return { success: true, result: status }
}
