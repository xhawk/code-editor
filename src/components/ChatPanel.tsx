import { useState, useEffect, useRef } from 'react'
import ChatArea from './ChatArea'
import Input from './Input'

interface Message {
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

interface ChatPanelProps {
  selectedModel: string
  selectedWorktree: string | null
  onGitRefresh: () => void
}

function ChatPanel({ selectedModel, selectedWorktree, onGitRefresh }: ChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    window.electron.getChatMessages().then((saved) => {
      const loaded: Message[] = saved.map(m => ({
        role: m.role,
        content: m.content,
        timestamp: new Date(m.timestamp)
      }))
      setMessages(loaded)
    })
  }, [])

  useEffect(() => {
    const toSave = messages.map(m => ({
      role: m.role,
      content: m.content,
      timestamp: m.timestamp.toISOString()
    }))
    window.electron.setChatMessages(toSave)
  }, [messages])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async (content: string) => {
    if (!selectedModel || isLoading) return

    const trimmed = content.trim()
    if (/^commit(\s|$)/i.test(trimmed)) {
      const userMessage: Message = { role: 'user', content, timestamp: new Date() }
      setMessages(prev => [...prev, userMessage])

      const customMsg = trimmed.slice(6).trim()
      let commitMsg = customMsg
      if (!commitMsg) {
        const stat = await window.electron.getStagedDiffStat(selectedWorktree)
        commitMsg = stat || 'Update files'
      }
      try {
        await window.electron.gitCommit(commitMsg, selectedWorktree)
        setMessages(prev => [...prev, { role: 'assistant', content: `Committed: "${commitMsg}"`, timestamp: new Date() }])
        onGitRefresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Commit failed')
      }
      return
    }

    const userMessage: Message = { role: 'user', content, timestamp: new Date() }
    setMessages(prev => [...prev, userMessage])
    setIsLoading(true)
    setError(null)
    
    const chatMessages: { role: string; content: string }[] = [
      { 
        role: 'system', 
        content: 'You have access to tools for file operations. Use them when appropriate: create_file, read_file, delete_file, list_files, get_git_status. When you need to create, read, list files, or check git status/changed files, use the appropriate tool instead of just describing code. Always respond with a natural language explanation after using tools.'
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
      
      onGitRefresh()
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

  return (
    <>
      <ChatArea messages={messages} isLoading={isLoading} error={error} />
      <Input onSend={sendMessage} disabled={!selectedModel || isLoading} isLoading={isLoading} />
      <div ref={messagesEndRef} />
    </>
  )
}

export default ChatPanel
