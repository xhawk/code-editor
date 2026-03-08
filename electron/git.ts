import { promisify } from 'util'
import { exec } from 'child_process'
import { workingDirectory, getBaseDirectory } from './state'
import log from 'electron-log'

const execAsync = promisify(exec)

export interface GitStatusFile {
  path: string
  status: string
  indexStatus: string
  worktreeStatus: string
  type: 'modified' | 'added' | 'deleted' | 'renamed' | 'untracked'
}

export interface GitStatus {
  branch: string
  files: GitStatusFile[]
}

export interface GitWorktree {
  path: string
  branch: string
  isMain: boolean
}

export async function checkGitRepo(): Promise<boolean> {
  try {
    const baseDir = getBaseDirectory()
    await execAsync('git rev-parse --git-dir', { cwd: baseDir })
    return true
  } catch {
    return false
  }
}

function getFileType(indexStatus: string, worktreeStatus: string): 'modified' | 'added' | 'deleted' | 'renamed' | 'untracked' {
  if (indexStatus === '?' && worktreeStatus === '?') {
    return 'untracked'
  }
  if (indexStatus === 'A') return 'added'
  if (indexStatus === 'D') return 'deleted'
  if (indexStatus === 'R') return 'renamed'
  if (indexStatus === 'M' || indexStatus === 'T' || worktreeStatus === 'M') return 'modified'
  return 'modified'
}

export async function getGitStatus(worktreePath?: string): Promise<GitStatus | null> {
  try {
    const baseDir = getBaseDirectory()
    const cwd = worktreePath || baseDir
    const isRepo = await checkGitRepo()
    if (!isRepo) return null

    const { stdout: branchOutput } = await execAsync('git branch --show-current', { cwd })
    const branch = branchOutput.trim()

    const { stdout: statusOutput } = await execAsync('git status --porcelain', { cwd })
    const files: GitStatusFile[] = []

    for (const line of statusOutput.split('\n')) {
      if (!line.trim()) continue

      const status = line.substring(0, 2)
      const path = line.substring(3)
      const indexStatus = status[0] === ' ' ? '' : status[0]
      const worktreeStatus = status[1] === ' ' ? '' : status[1]

      files.push({
        path,
        status,
        indexStatus,
        worktreeStatus,
        type: getFileType(indexStatus, worktreeStatus),
      })
    }

    return { branch, files }
  } catch {
    return null
  }
}

export async function getStagedDiffStat(worktreePath?: string): Promise<string> {
  const cwd = worktreePath || getBaseDirectory()
  const { stdout } = await execAsync('git diff --cached --stat', { cwd })
  return stdout.trim()
}

export async function gitCommit(message: string, worktreePath?: string): Promise<void> {
  const cwd = worktreePath || getBaseDirectory()
  await execAsync(`git commit -m "${message.replace(/"/g, '\\"')}"`, { cwd })
}

export async function gitAdd(filePaths: string[], worktreePath?: string): Promise<void> {
  const baseDir = getBaseDirectory()
  const cwd = worktreePath || baseDir
  const paths = filePaths.map(p => `"${p}"`).join(' ')
  await execAsync(`git add -- ${paths}`, { cwd })
}

export async function getAllWorktrees(): Promise<GitWorktree[]> {
  try {
    const baseDir = getBaseDirectory()
    log.info(`getAllWorktrees: baseDir = ${baseDir}`)
    const isRepo = await checkGitRepo()
    if (!isRepo) {
      log.info('getAllWorktrees: not a git repo')
      return []
    }

    const { stdout } = await execAsync('git worktree list --porcelain', { cwd: baseDir })
    log.info(`getAllWorktrees: raw output = ${stdout}`)
    const worktrees: GitWorktree[] = []
    let currentWorktree: Partial<GitWorktree> | null = null
    let hasGitdir = false

    for (const line of stdout.split('\n')) {
      if (line.startsWith('worktree ')) {
        if (currentWorktree && currentWorktree.path) {
          worktrees.push({
            ...currentWorktree,
            isMain: !hasGitdir,
          } as GitWorktree)
        }
        currentWorktree = {
          path: line.substring(9).trim(),
        }
        hasGitdir = false
      } else if (line.startsWith('branch ')) {
        const branch = line.substring(7).trim().replace('refs/heads/', '')
        if (currentWorktree) {
          currentWorktree.branch = branch
        }
      } else if (line.startsWith('gitdir ')) {
        hasGitdir = true
      }
    }

    if (currentWorktree && currentWorktree.path) {
      worktrees.push({
        ...currentWorktree,
        isMain: !hasGitdir,
      } as GitWorktree)
    }

    return worktrees
  } catch (error) {
    log.error('getAllWorktrees error:', error)
    return []
  }
}
