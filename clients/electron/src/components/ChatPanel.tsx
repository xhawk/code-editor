import { useState, useEffect, useRef } from 'react'
import ChatArea from './ChatArea'
import Input from './Input'
import { api } from '../api/client'
import type { AgentMode } from '../api/types'

interface Message {
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

interface ChatPanelProps {
  selectedModel: string
  selectedWorktree: string | null
  onGitRefresh: () => void
  agentMode: AgentMode
  onAgentModeChange: (mode: AgentMode) => void
  onWorktreeCreated?: (path: string) => void
}

function ChatPanel({ selectedModel, selectedWorktree, onGitRefresh, agentMode, onAgentModeChange, onWorktreeCreated }: ChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const hasLoadedRef = useRef(false)
  const abortRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    hasLoadedRef.current = false
    const worktreeKey = selectedWorktree ?? 'main'
    api.getChatMessages(worktreeKey).then((saved) => {
      const loaded: Message[] = saved.map(m => ({
        role: m.role,
        content: m.content,
        timestamp: new Date(m.timestamp)
      }))
      setMessages(loaded)
      hasLoadedRef.current = true
    })
  }, [selectedWorktree])

  useEffect(() => {
    if (!hasLoadedRef.current) return
    const worktreeKey = selectedWorktree ?? 'main'
    const toSave = messages.map(m => ({
      role: m.role,
      content: m.content,
      timestamp: m.timestamp.toISOString()
    }))
    void api.setChatMessages(worktreeKey, toSave)
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

      let commitMsg = trimmed.slice(6).trim()
      if (!commitMsg) {
        const stat = await api.getStagedDiffStat(selectedWorktree)
        commitMsg = stat || 'Update files'
      }
      try {
        await api.gitCommit(commitMsg, selectedWorktree)
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

    const chatMessages: { role: string; content: string }[] = []
    messages.forEach(m => chatMessages.push({ role: m.role, content: m.content }))
    chatMessages.push({ role: 'user', content })

    let assistantContent = ''

    abortRef.current = api.chatStream(
      { model: selectedModel, messages: chatMessages, agentMode },
      (chunk) => {
        assistantContent += chunk
        setMessages(prev => {
          const last = prev[prev.length - 1]
          if (last?.role === 'assistant') {
            return [...prev.slice(0, -1), { ...last, content: assistantContent }]
          }
          return [...prev, { role: 'assistant', content: assistantContent, timestamp: new Date() }]
        })
      },
      async (fullResponse) => {
        await processFileCreations(fullResponse)
        onGitRefresh()
        setIsLoading(false)
        abortRef.current = null
      },
      (message) => {
        setError(message)
        setIsLoading(false)
        abortRef.current = null
      },
      (path) => {
        onWorktreeCreated?.(path)
      }
    )
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
        const result = await api.createFile({
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
      <Input
        onSend={sendMessage}
        disabled={!selectedModel || isLoading}
        isLoading={isLoading}
        agentMode={agentMode}
        onAgentModeChange={onAgentModeChange}
      />
      <div ref={messagesEndRef} />
    </>
  )
}

export default ChatPanel
