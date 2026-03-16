export interface FileItem {
  name: string
  isDirectory: boolean
  path: string
}

export interface FileOperationResult {
  success: boolean
  path?: string
  content?: string
  error?: string
}

export interface WorktreeStatus {
  created: boolean
  path: string | null
}

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

export type AgentMode = 'code' | 'plan'

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: string
}
