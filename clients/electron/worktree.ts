import { existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import { promisify } from 'util'
import { exec } from 'child_process'
import log from 'electron-log'
import { workingDirectory, setWorktreePath, markWorktreeCreated, worktreeCreated } from './state'

const execAsync = promisify(exec)

const ADJECTIVES = ['happy', 'clever', 'brave', 'gentle', 'swift', 'bright', 'kind', 'wise', 'calm', 'eager', 'fierce', 'playful', 'curious', 'patient', 'focused', 'creative', 'calm', 'peaceful', 'serene', 'tranquil']
const ANIMALS = ['otter', 'fox', 'badger', 'owl', 'wolf', 'bear', 'hawk', 'deer', 'lynx', 'panda', 'tiger', 'lion', 'eagle', 'raven', 'beaver', 'moose', 'elk']

export function getRandomWorktreeName(): string {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)]
  const animal = ANIMALS[Math.floor(Math.random() * ANIMALS.length)]
  return `${adj}-${animal}`
}

export async function createWorktree(): Promise<string | null> {
  if (worktreeCreated || !workingDirectory) return null

  try {
    const worktreeName = getRandomWorktreeName()
    const workspaceDir = join(workingDirectory, 'workspace')
    const newWorktreePath = join(workspaceDir, worktreeName)

    if (!existsSync(workspaceDir)) {
      mkdirSync(workspaceDir, { recursive: true })
    }

    try {
      await execAsync('git rev-parse HEAD', { cwd: workingDirectory })
    } catch {
      log.info('No commits found, creating initial commit...')
      await execAsync('git commit --allow-empty -m "initial commit"', { cwd: workingDirectory })
    }

    log.info(`Creating worktree at: ${newWorktreePath}`)

    await execAsync(`git worktree add "${newWorktreePath}"`, { cwd: workingDirectory })

    setWorktreePath(newWorktreePath)
    markWorktreeCreated(true)
    log.info(`Worktree created successfully: ${newWorktreePath}`)

    return newWorktreePath
  } catch (error) {
    log.error('Failed to create worktree:', error)
    return null
  }
}
