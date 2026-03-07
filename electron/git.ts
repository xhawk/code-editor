import { promisify } from 'util'
import { exec } from 'child_process'
import { workingDirectory } from './state'

const execAsync = promisify(exec)

export async function checkGitRepo(): Promise<boolean> {
  try {
    await execAsync('git rev-parse --git-dir', { cwd: workingDirectory })
    return true
  } catch {
    return false
  }
}
