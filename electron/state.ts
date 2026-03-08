export let workingDirectory: string = ''
export let worktreePath: string | null = null
export let worktreeCreated = false
export let selectedWorktreePath: string | null = null

export function setWorkingDirectory(dir: string) {
  workingDirectory = dir
}

export function setWorktreePath(path: string | null) {
  worktreePath = path
}

export function markWorktreeCreated(created: boolean) {
  worktreeCreated = created
}

export function setSelectedWorktreePath(path: string | null) {
  selectedWorktreePath = path
}

export function getBaseDirectory(): string {
  return selectedWorktreePath || worktreePath || workingDirectory
}
