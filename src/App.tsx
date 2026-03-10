import { useState, useEffect } from 'react'
import Header from './components/Header'
import ChatPanel from './components/ChatPanel'
import TabSystem, { Tab } from './components/TabSystem'
import FilePanel from './components/FilePanel'
import GitSidebar from './components/GitSidebar'
import WorktreeList from './components/WorktreeList'



declare global {
  interface Window {
    electron: {
      archiveWorktree: (path: string) => Promise<void>
      getWorkingDirectory: () => Promise<string>
      getWorktreeStatus: () => Promise<{ created: boolean; path: string | null }>
      getOllamaModels: () => Promise<string[]>
      checkGitRepo: () => Promise<boolean>
      getGitStatus: (worktreePath?: string | null) => Promise<{ branch: string; files: { path: string; status: string; indexStatus: string; worktreeStatus: string; type: 'modified' | 'added' | 'deleted' | 'renamed' | 'untracked' }[] } | null>
      getAllWorktrees: () => Promise<{ path: string; branch: string; isMain: boolean }[]>
      setSelectedWorktree: (path: string | null) => Promise<void>
      createWorktree: () => Promise<string | null>
      chat: (params: { model: string; messages: { role: string; content: string }[] }) => Promise<string>
      onChatStream: (callback: (chunk: string) => void) => void
      onWorktreeCreated: (callback: (data: { path: string }) => void) => void
      createFile: (params: { relativePath: string; content: string }) => Promise<{ success: boolean; path?: string; error?: string }>
      readFile: (params: { relativePath: string; worktreePath?: string | null }) => Promise<{ success: boolean; content?: string; error?: string }>
      deleteFile: (params: { relativePath: string }) => Promise<{ success: boolean; error?: string }>
      listFiles: (params: { relativePath: string }) => Promise<{ success: boolean; items?: { name: string; isDirectory: boolean; path: string }[]; error?: string }>
      gitCommit: (message: string, worktreePath?: string | null) => Promise<void>
      getStagedDiffStat: (worktreePath?: string | null) => Promise<string>
    }
  }
}

function App() {
  const [models, setModels] = useState<string[]>([])
  const [selectedModel, setSelectedModel] = useState<string>('')
  const [workingDir, setWorkingDir] = useState<string>('')
  const [worktreeStatus, setWorktreeStatus] = useState<{ created: boolean; path: string | null }>({ created: false, path: null })
  const [isGitRepo, setIsGitRepo] = useState(false)
  const [selectedWorktree, setSelectedWorktree] = useState<string | null>(null)
  const [gitRefreshKey, setGitRefreshKey] = useState(0)
  const [tabs, setTabs] = useState<Tab[]>([])
  const [activeTabId, setActiveTabId] = useState<string>('chat')

  useEffect(() => {
    const init = async () => {
      const dir = await window.electron.getWorkingDirectory()
      setWorkingDir(dir)
      
      const git = await window.electron.checkGitRepo()
      setIsGitRepo(git)
      
      const status = await window.electron.getWorktreeStatus()
      setWorktreeStatus(status)
      
      const ollamaModels = await window.electron.getOllamaModels()
      setModels(ollamaModels)
      if (ollamaModels.length > 0) {
        setSelectedModel(ollamaModels[0])
      }
    }
    
    init()

    window.electron.onWorktreeCreated((data) => {
      setWorktreeStatus({ created: true, path: data.path })
    })
  }, [])

  // Initialize with ChatPanel tab
  useEffect(() => {
    if (tabs.length === 0) {
      setTabs([{
        id: 'chat',
        title: 'Chat',
        content: (
          <ChatPanel
            selectedModel={selectedModel}
            selectedWorktree={selectedWorktree}
            onGitRefresh={handleGitRefresh}
          />
        ),
        closable: false
      }])
    }
  }, [selectedModel, selectedWorktree])

  const refreshModels = async () => {
    const ollamaModels = await window.electron.getOllamaModels()
    setModels(ollamaModels)
    if (ollamaModels.length > 0 && !ollamaModels.includes(selectedModel)) {
      setSelectedModel(ollamaModels[0])
    }
  }

  const handleGitRefresh = () => {
    setGitRefreshKey(k => k + 1)
  }

  const handleOpenFile = (filePath: string) => {
    const fileName = filePath.split('/').pop() || filePath
    const tabId = `file-${filePath}`

    // Check if tab already exists
    const existingTab = tabs.find(t => t.id === tabId)
    if (existingTab) {
      setActiveTabId(tabId)
      return
    }

    // Create new file tab
    const newTab: Tab = {
      id: tabId,
      title: fileName,
      content: (
        <FilePanel
          filePath={filePath}
          worktreePath={selectedWorktree}
        />
      ),
      closable: true
    }

    setTabs(prev => [...prev, newTab])
    setActiveTabId(tabId)
  }

  const handleTabClose = (tabId: string) => {
    if (tabId === 'chat') return // Can't close chat tab

    setTabs(prev => prev.filter(t => t.id !== tabId))

    // If closing active tab, switch to chat
    if (activeTabId === tabId) {
      setActiveTabId('chat')
    }
  }

  const handleTabSelect = (tabId: string) => {
    setActiveTabId(tabId)
  }

  // Update chat tab content when model/worktree changes
  const updateChatTab = () => {
    setTabs(prev => prev.map(tab => {
      if (tab.id === 'chat') {
        return {
          ...tab,
          content: (
            <ChatPanel
              selectedModel={selectedModel}
              selectedWorktree={selectedWorktree}
              onGitRefresh={handleGitRefresh}
            />
          )
        }
      }
      return tab
    }))
  }

  useEffect(() => {
    updateChatTab()
  }, [selectedModel, selectedWorktree])

  return (
    <div className="app">
      <WorktreeList isGitRepo={isGitRepo} selectedWorktree={selectedWorktree} onSelectWorktree={setSelectedWorktree} />
      <div className="main-content">
        <Header
          workingDir={workingDir}
          models={models}
          selectedModel={selectedModel}
          onModelChange={setSelectedModel}
          onRefreshModels={refreshModels}
          worktreeStatus={worktreeStatus}
          isGitRepo={isGitRepo}
          selectedWorktree={selectedWorktree}
        />
        <TabSystem
          tabs={tabs}
          activeTabId={activeTabId}
          onTabSelect={handleTabSelect}
          onTabClose={handleTabClose}
        />
      </div>
      <GitSidebar
        isGitRepo={isGitRepo}
        selectedWorktree={selectedWorktree}
        refreshKey={gitRefreshKey}
        onOpenFile={handleOpenFile}
      />
    </div>
  )
}

export default App
