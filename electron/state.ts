export let workingDirectory: string = ''
export let worktreePath: string | null = null
export let worktreeCreated = false

export function setWorkingDirectory(dir: string) {
  workingDirectory = dir
}

export function setWorktreePath(path: string | null) {
  worktreePath = path
}

export function markWorktreeCreated(created: boolean) {
  worktreeCreated = created
}

export function getBaseDirectory(): string {
  return worktreePath || workingDirectory
}
