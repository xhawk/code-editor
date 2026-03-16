import type { FileItem, FileOperationResult, WorktreeStatus, GitStatus, GitWorktree, AgentMode, ChatMessage } from './types'

interface Bridge {
  request: (method: string, path: string, body?: unknown) => Promise<unknown>
  stream: (id: string, path: string, body: unknown, callback: (event: string, data: string) => void) => void
  streamAbort: (id: string) => void
}

function bridge(): Bridge {
  return (window as any).__bridge__ as Bridge
}

export async function waitForServer(timeoutMs = 15000): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      await bridge().request('GET', '/api/v1/health')
      return
    } catch {}
    await new Promise(r => setTimeout(r, 250))
  }
  throw new Error('Server did not become available in time')
}

async function get<T>(path: string): Promise<T> {
  return bridge().request('GET', path) as Promise<T>
}

async function post<T>(path: string, body?: unknown): Promise<T> {
  return bridge().request('POST', path, body) as Promise<T>
}

async function put<T>(path: string, body?: unknown): Promise<T> {
  return bridge().request('PUT', path, body) as Promise<T>
}

async function del<T>(path: string): Promise<T> {
  return bridge().request('DELETE', path) as Promise<T>
}

export const api = {
  getModels: (): Promise<string[]> =>
    get<string[]>('/api/v1/models'),

  getWorkingDirectory: (): Promise<string> =>
    get<{ workingDirectory: string }>('/api/v1/settings/working-directory').then(r => r.workingDirectory),

  getTheme: (): Promise<string> =>
    get<{ theme: string }>('/api/v1/settings/theme').then(r => r.theme),

  setTheme: (theme: string): Promise<void> =>
    put('/api/v1/settings/theme', { theme }).then(() => undefined),

  getAgentMode: (): Promise<AgentMode> =>
    get<{ agentMode: AgentMode }>('/api/v1/settings/agent-mode').then(r => r.agentMode),

  setAgentMode: (agentMode: AgentMode): Promise<void> =>
    put('/api/v1/settings/agent-mode', { agentMode }).then(() => undefined),

  getChatMessages: (key: string): Promise<ChatMessage[]> =>
    get<ChatMessage[]>(`/api/v1/settings/chat-messages/${encodeURIComponent(key)}`),

  setChatMessages: (key: string, messages: ChatMessage[]): Promise<void> =>
    put(`/api/v1/settings/chat-messages/${encodeURIComponent(key)}`, messages).then(() => undefined),

  checkGitRepo: (): Promise<boolean> =>
    get<{ isRepo: boolean }>('/api/v1/git/check').then(r => r.isRepo),

  getGitStatus: (worktreePath?: string | null): Promise<GitStatus | null> => {
    const params = worktreePath ? `?worktreePath=${encodeURIComponent(worktreePath)}` : ''
    return get<GitStatus>(`/api/v1/git/status${params}`).catch(() => null)
  },

  gitCommit: (message: string, worktreePath?: string | null): Promise<void> =>
    post('/api/v1/git/commit', { message, worktreePath }).then(() => undefined),

  getStagedDiffStat: (worktreePath?: string | null): Promise<string> => {
    const params = worktreePath ? `?worktreePath=${encodeURIComponent(worktreePath)}` : ''
    return get<{ stat: string }>(`/api/v1/git/staged-diff-stat${params}`).then(r => r.stat)
  },

  getAllWorktrees: (): Promise<GitWorktree[]> =>
    get<GitWorktree[]>('/api/v1/worktrees'),

  getWorktreeStatus: (): Promise<WorktreeStatus> =>
    get<WorktreeStatus>('/api/v1/worktrees/status'),

  createWorktree: (): Promise<string | null> =>
    post<{ path: string }>('/api/v1/worktrees').then(r => r.path).catch(() => null),

  archiveWorktree: (path: string): Promise<void> =>
    del(`/api/v1/worktrees/${encodeURIComponent(path)}`).then(() => undefined),

  setSelectedWorktree: (path: string | null): Promise<void> =>
    post('/api/v1/worktrees/select', { path }).then(() => undefined),

  createFile: (params: { relativePath: string; content: string }): Promise<FileOperationResult> =>
    post<{ path: string }>('/api/v1/files', params)
      .then(r => ({ success: true, path: r.path }))
      .catch(e => ({ success: false, error: String(e) })),

  readFile: (params: { relativePath: string; worktreePath?: string | null }): Promise<FileOperationResult> => {
    const qs = new URLSearchParams({ path: params.relativePath })
    if (params.worktreePath) qs.set('worktreePath', params.worktreePath)
    return get<{ content: string }>(`/api/v1/files/content?${qs}`)
      .then(r => ({ success: true, content: r.content }))
      .catch(e => ({ success: false, error: String(e) }))
  },

  deleteFile: (params: { relativePath: string }): Promise<FileOperationResult> =>
    del(`/api/v1/files?path=${encodeURIComponent(params.relativePath)}`)
      .then(() => ({ success: true }))
      .catch(e => ({ success: false, error: String(e) })),

  listFiles: (params: { relativePath: string }): Promise<{ success: boolean; items?: FileItem[]; error?: string }> => {
    const qs = new URLSearchParams({ path: params.relativePath })
    return get<{ items: FileItem[] }>(`/api/v1/files?${qs}`)
      .then(r => ({ success: true, items: r.items }))
      .catch(e => ({ success: false, error: String(e) }))
  },

  chatStream: (
    params: { model: string; messages: { role: string; content: string }[]; agentMode?: AgentMode },
    onChunk: (chunk: string) => void,
    onDone: (fullResponse: string) => void,
    onError: (message: string) => void,
    onWorktree?: (path: string) => void
  ): (() => void) => {
    const id = Math.random().toString(36).slice(2)

    bridge().stream(id, '/api/v1/chat', params, (event, data) => {
      try {
        const parsed = JSON.parse(data)
        if (event === 'chunk') onChunk(parsed.text)
        else if (event === 'done') onDone(parsed.fullResponse)
        else if (event === 'error') onError(parsed.message)
        else if (event === 'worktree' && onWorktree) onWorktree(parsed.path)
      } catch {}
    })

    return () => bridge().streamAbort(id)
  }
}
