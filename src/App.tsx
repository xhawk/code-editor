import { useState, useEffect, useRef } from 'react'
import Header from './components/Header'
import ChatArea from './components/ChatArea'
import Input from './components/Input'

interface Message {
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

declare global {
  interface Window {
    electron: {
      getWorkingDirectory: () => Promise<string>
      getWorktreeStatus: () => Promise<{ created: boolean; path: string | null }>
      getOllamaModels: () => Promise<string[]>
      checkGitRepo: () => Promise<boolean>
      createWorktree: () => Promise<string | null>
      chat: (params: { model: string; messages: { role: string; content: string }[] }) => Promise<string>
      onChatStream: (callback: (chunk: string) => void) => void
      onWorktreeCreated: (callback: (data: { path: string }) => void) => void
      createFile: (params: { relativePath: string; content: string }) => Promise<{ success: boolean; path?: string; error?: string }>
      readFile: (params: { relativePath: string }) => Promise<{ success: boolean; content?: string; error?: string }>
      deleteFile: (params: { relativePath: string }) => Promise<{ success: boolean; error?: string }>
      listFiles: (params: { relativePath: string }) => Promise<{ success: boolean; items?: { name: string; isDirectory: boolean; path: string }[]; error?: string }>
    }
  }
}

function App() {
  const [models, setModels] = useState<string[]>([])
  const [selectedModel, setSelectedModel] = useState<string>('')
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [workingDir, setWorkingDir] = useState<string>('')
  const [worktreeStatus, setWorktreeStatus] = useState<{ created: boolean; path: string | null }>({ created: false, path: null })
  const [isGitRepo, setIsGitRepo] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

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

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async (content: string) => {
    if (!selectedModel || isLoading) return
    
    const userMessage: Message = { role: 'user', content, timestamp: new Date() }
    setMessages(prev => [...prev, userMessage])
    setIsLoading(true)
    setError(null)
    
    const chatMessages: { role: string; content: string }[] = [
      { 
        role: 'system', 
        content: 'You have access to tools for file operations. Use them when appropriate: create_file, read_file, delete_file, list_files. When you need to create, read, or list files, use the appropriate tool instead of just describing code. Always respond with a natural language explanation after using tools.' 
      }
    ]
    messages.forEach(m => chatMessages.push({ role: m.role, content: m.content }))
    chatMessages.push({ role: 'user', content })
    
    try {
      let assistantContent = ''
      
      window.electron.onChatStream((chunk) => {
        assistantContent += chunk
        setMessages(prev => {
          const last = prev[prev.length - 1]
          if (last?.role === 'assistant') {
            return [...prev.slice(0, -1), { ...last, content: assistantContent }]
          }
          return [...prev, { role: 'assistant', content: assistantContent, timestamp: new Date() }]
        })
      })
      
      await window.electron.chat({ model: selectedModel, messages: chatMessages })
      
      await processFileCreations(assistantContent)
      
      const status = await window.electron.getWorktreeStatus()
      setWorktreeStatus(status)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message')
    } finally {
      setIsLoading(false)
    }
  }

  const processFileCreations = async (content: string) => {
    const codeBlockRegex = /```(?:(\w+):)?([^\n]+)\n([\s\S]*?)```/g
    const createdFiles: string[] = []
    let match
    
    while ((match = codeBlockRegex.exec(content)) !== null) {
      const language = match[1]?.trim() || ''
      let filename = match[2].trim()
      const fileContent = match[3]
      
      // If filename matches the language identifier (e.g., "html" when language is "html"),
      // or is just an extension (e.g., ".html"), generate a default filename using the language as extension
      if (language && (filename === language || /^\.[a-zA-Z0-9]+$/.test(filename))) {
        filename = `untitled.${language}`
      }
      
      if (filename && fileContent && !filename.includes(' ')) {
        const result = await window.electron.createFile({
          relativePath: filename,
          content: fileContent
        })
        
        if (result.success && result.path) {
          createdFiles.push(result.path)
        }
      }
    }
    
    if (createdFiles.length > 0) {
      const fileList = createdFiles.map(f => `• ${f}`).join('\n')
      const systemMessage: Message = {
        role: 'assistant',
        content: `✅ Created file(s):\n${fileList}`,
        timestamp: new Date()
      }
      setMessages(prev => [...prev, systemMessage])
    }
  }

  const refreshModels = async () => {
    const ollamaModels = await window.electron.getOllamaModels()
    setModels(ollamaModels)
    if (ollamaModels.length > 0 && !ollamaModels.includes(selectedModel)) {
      setSelectedModel(ollamaModels[0])
    }
  }

  return (
    <div className="app">
      <Header
        workingDir={workingDir}
        models={models}
        selectedModel={selectedModel}
        onModelChange={setSelectedModel}
        onRefreshModels={refreshModels}
        worktreeStatus={worktreeStatus}
        isGitRepo={isGitRepo}
      />
      <ChatArea messages={messages} isLoading={isLoading} error={error} />
      <Input onSend={sendMessage} disabled={!selectedModel || isLoading} isLoading={isLoading} />
      <div ref={messagesEndRef} />
    </div>
  )
}

export default App
