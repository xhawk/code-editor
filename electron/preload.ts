import { contextBridge, ipcRenderer } from 'electron'

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

export interface ElectronAPI {
  getWorkingDirectory: () => Promise<string>
  getWorktreeStatus: () => Promise<WorktreeStatus>
  getOllamaModels: () => Promise<string[]>
  checkGitRepo: () => Promise<boolean>
  getGitStatus: (worktreePath?: string | null) => Promise<GitStatus | null>
  getAllWorktrees: () => Promise<GitWorktree[]>
  createWorktree: () => Promise<string | null>
  chat: (params: { model: string; messages: { role: string; content: string }[] }) => Promise<string>
  onChatStream: (callback: (chunk: string) => void) => void
  onWorktreeCreated: (callback: (data: { path: string }) => void) => void
  createFile: (params: { relativePath: string; content: string }) => Promise<FileOperationResult>
  readFile: (params: { relativePath: string; worktreePath?: string | null }) => Promise<FileOperationResult>
  deleteFile: (params: { relativePath: string }) => Promise<FileOperationResult>
  listFiles: (params: { relativePath: string }) => Promise<{ success: boolean; items?: FileItem[]; error?: string }>
  gitCommit: (message: string, worktreePath?: string | null) => Promise<void>
  getStagedDiffStat: (worktreePath?: string | null) => Promise<string>
  archiveWorktree: (path: string) => Promise<void>
}

const api: ElectronAPI = {
  getWorkingDirectory: () => ipcRenderer.invoke('get-working-directory'),
  getWorktreeStatus: () => ipcRenderer.invoke('get-worktree-status'),
  getOllamaModels: () => ipcRenderer.invoke('get-ollama-models'),
  checkGitRepo: () => ipcRenderer.invoke('check-git-repo'),
  getGitStatus: (worktreePath) => ipcRenderer.invoke('get-git-status', worktreePath),
  getAllWorktrees: () => ipcRenderer.invoke('get-all-worktrees'),
  createWorktree: () => ipcRenderer.invoke('create-worktree'),
  chat: (params) => ipcRenderer.invoke('chat', params),
  onChatStream: (callback) => {
    ipcRenderer.on('chat-stream', (_, chunk) => callback(chunk))
  },
  onWorktreeCreated: (callback) => {
    ipcRenderer.on('worktree-created', (_, data) => callback(data))
  },
  createFile: (params) => ipcRenderer.invoke('create-file', params),
  readFile: (params) => ipcRenderer.invoke('read-file', params),
  deleteFile: (params) => ipcRenderer.invoke('delete-file', params),
  listFiles: (params) => ipcRenderer.invoke('list-files', params),
  gitCommit: (message, worktreePath) => ipcRenderer.invoke('git-commit', message, worktreePath),
  getStagedDiffStat: (worktreePath) => ipcRenderer.invoke('get-staged-diff-stat', worktreePath),
  archiveWorktree: (path) => ipcRenderer.invoke('archive-worktree', path)
}

contextBridge.exposeInMainWorld('electron', api)
