import { useState, useEffect } from 'react'
import Header from './components/Header'
import ChatPanel from './components/ChatPanel'
import TabSystem, { Tab } from './components/TabSystem'
import FilePanel from './components/FilePanel'
import GitSidebar from './components/GitSidebar'
import WorktreeList from './components/WorktreeList'
import { api, waitForServer } from './api/client'
import type { AgentMode } from './api/types'

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
  const [theme, setTheme] = useState<string>('dark')
  const [agentMode, setAgentModeState] = useState<AgentMode>('code')

  useEffect(() => {
    const init = async () => {
      await waitForServer()
      const dir = await api.getWorkingDirectory()
      setWorkingDir(dir)

      const git = await api.checkGitRepo()
      setIsGitRepo(git)

      const status = await api.getWorktreeStatus()
      setWorktreeStatus(status)

      const ollamaModels = await api.getModels()
      setModels(ollamaModels)
      if (ollamaModels.length > 0) {
        setSelectedModel(ollamaModels[0])
      }

      const savedTheme = await api.getTheme()
      setTheme(savedTheme)
      document.documentElement.setAttribute('data-theme', savedTheme)

      const savedMode = await api.getAgentMode()
      setAgentModeState(savedMode)
    }

    init()
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
            agentMode={agentMode}
            onAgentModeChange={handleAgentModeChange}
            onWorktreeCreated={handleWorktreeCreated}
          />
        ),
        closable: false
      }])
    }
  }, [selectedModel, selectedWorktree, agentMode])

  const refreshModels = async () => {
    const ollamaModels = await api.getModels()
    setModels(ollamaModels)
    if (ollamaModels.length > 0 && !ollamaModels.includes(selectedModel)) {
      setSelectedModel(ollamaModels[0])
    }
  }

  const handleGitRefresh = () => {
    setGitRefreshKey(k => k + 1)
  }

  const handleWorktreeCreated = (path: string) => {
    setWorktreeStatus({ created: true, path })
  }

  const handleSelectWorktree = async (path: string | null) => {
    setSelectedWorktree(path)
    await api.setSelectedWorktree(path)
  }

  const handleThemeChange = async (newTheme: string) => {
    setTheme(newTheme)
    document.documentElement.setAttribute('data-theme', newTheme)
    await api.setTheme(newTheme)
  }

  const handleAgentModeChange = async (mode: AgentMode) => {
    setAgentModeState(mode)
    await api.setAgentMode(mode)
  }

  const handleOpenFile = (filePath: string) => {
    const fileName = filePath.split('/').pop() || filePath
    const tabId = `file-${filePath}`

    const existingTab = tabs.find(t => t.id === tabId)
    if (existingTab) {
      setActiveTabId(tabId)
      return
    }

    const newTab: Tab = {
      id: tabId,
      title: fileName,
      content: (
        <FilePanel
          filePath={filePath}
          worktreePath={selectedWorktree}
          theme={theme}
        />
      ),
      closable: true
    }

    setTabs(prev => [...prev, newTab])
    setActiveTabId(tabId)
  }

  const handleTabClose = (tabId: string) => {
    if (tabId === 'chat') return

    setTabs(prev => prev.filter(t => t.id !== tabId))

    if (activeTabId === tabId) {
      setActiveTabId('chat')
    }
  }

  const handleTabSelect = (tabId: string) => {
    setActiveTabId(tabId)
  }

  // Update chat tab content when model/worktree/agentMode changes
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
              agentMode={agentMode}
              onAgentModeChange={handleAgentModeChange}
              onWorktreeCreated={handleWorktreeCreated}
            />
          )
        }
      }
      return tab
    }))
  }

  useEffect(() => {
    updateChatTab()
  }, [selectedModel, selectedWorktree, agentMode])

  return (
    <div className="app">
      <WorktreeList isGitRepo={isGitRepo} selectedWorktree={selectedWorktree} onSelectWorktree={handleSelectWorktree} />
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
          theme={theme}
          onThemeChange={handleThemeChange}
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
