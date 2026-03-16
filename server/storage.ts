import Conf from 'conf'
import { DEFAULT_AGENT_MODE } from './agents/agents'
import type { AgentMode } from './agents/agents'

type ChatMessage = { role: 'user' | 'assistant'; content: string; timestamp: string }

const conf = new Conf<{
  theme: string
  agentMode: AgentMode
  worktreeChats: Record<string, ChatMessage[]>
}>({ projectName: 'code-editor-ai' })

export function getTheme(): string {
  return conf.get('theme', 'dark') as string
}

export function setTheme(theme: string): void {
  conf.set('theme', theme)
}

export function getAgentMode(): AgentMode {
  return conf.get('agentMode', DEFAULT_AGENT_MODE) as AgentMode
}

export function setAgentMode(mode: AgentMode): void {
  conf.set('agentMode', mode)
}

export function getChatMessages(key: string): ChatMessage[] {
  const chats = conf.get('worktreeChats', {}) as Record<string, ChatMessage[]>
  return chats[key] ?? []
}

export function setChatMessages(key: string, messages: ChatMessage[]): void {
  const chats = conf.get('worktreeChats', {}) as Record<string, ChatMessage[]>
  chats[key] = messages
  conf.set('worktreeChats', chats)
}
