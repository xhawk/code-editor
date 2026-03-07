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

export interface ElectronAPI {
  getWorkingDirectory: () => Promise<string>
  getWorktreeStatus: () => Promise<WorktreeStatus>
  getOllamaModels: () => Promise<string[]>
  checkGitRepo: () => Promise<boolean>
  createWorktree: () => Promise<string | null>
  chat: (params: { model: string; messages: { role: string; content: string }[] }) => Promise<string>
  onChatStream: (callback: (chunk: string) => void) => void
  onWorktreeCreated: (callback: (data: { path: string }) => void) => void
  createFile: (params: { relativePath: string; content: string }) => Promise<FileOperationResult>
  readFile: (params: { relativePath: string }) => Promise<FileOperationResult>
  deleteFile: (params: { relativePath: string }) => Promise<FileOperationResult>
  listFiles: (params: { relativePath: string }) => Promise<{ success: boolean; items?: FileItem[]; error?: string }>
}

const api: ElectronAPI = {
  getWorkingDirectory: () => ipcRenderer.invoke('get-working-directory'),
  getWorktreeStatus: () => ipcRenderer.invoke('get-worktree-status'),
  getOllamaModels: () => ipcRenderer.invoke('get-ollama-models'),
  checkGitRepo: () => ipcRenderer.invoke('check-git-repo'),
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
  listFiles: (params) => ipcRenderer.invoke('list-files', params)
}

contextBridge.exposeInMainWorld('electron', api)
