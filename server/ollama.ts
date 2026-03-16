import log from 'electron-log'
import { Ollama, type Message, type Tool } from 'ollama'
import { executeTool, getToolsForMode } from './tools'
import { AGENTS, DEFAULT_AGENT_MODE, type AgentMode } from './agents/agents'

const ollamaClient = new Ollama({ host: 'http://127.0.0.1:11434' })

interface OllamaToolCall {
  id: string
  type: 'function'
  function: {
    name: string
    arguments: Record<string, unknown>
  }
}

export interface OllamaMessage {
  role: 'user' | 'assistant' | 'tool' | 'system'
  content: string
  tool_calls?: OllamaToolCall[]
  tool_call_id?: string
  name?: string
}

type ToolCall = { id: string; name: string; arguments: Record<string, unknown> }

export interface ChatOptions {
  agentMode?: AgentMode
  systemPrompt?: string
  overrideTools?: Tool[]
  overrideToolExecutor?: (name: string, args: Record<string, unknown>) => Promise<string>
}

function formatToolResult(result: unknown): string {
  if (result === null || result === undefined) return ''
  if (typeof result === 'string') return result
  if (typeof result === 'object') return JSON.stringify(result, null, 2)
  return String(result)
}

function isResponseError(e: unknown): e is { status_code: number; error: string } {
  return typeof e === 'object' && e !== null && 'status_code' in e
}

export async function getOllamaModels(): Promise<string[]> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('Ollama model list timed out')), 30_000)
  )
  try {
    const result = await Promise.race([ollamaClient.list(), timeout])
    return result.models?.map(m => m.name) ?? []
  } catch (error) {
    log.error('Failed to get Ollama models:', error)
    return []
  }
}

// Returns null when the model rejected tools and the caller should retry without them.
async function openStream(model: string, messages: OllamaMessage[], activeTools: Tool[]) {
  try {
    return await ollamaClient.chat({
      model,
      messages: messages as Message[],
      stream: true,
      ...(activeTools.length > 0 ? { tools: activeTools } : {})
    })
  } catch (e) {
    if (isResponseError(e) && e.status_code === 400 && activeTools.length > 0) {
      log.warn(`chatWithOllama: request failed with 400, retrying without tools: ${e.error}`)
      return null
    }
    throw e
  }
}

async function executeToolCalls(
  toolCalls: ToolCall[],
  executor: (name: string, args: Record<string, unknown>) => Promise<string>
): Promise<OllamaMessage[]> {
  const results: OllamaMessage[] = []
  for (const tc of toolCalls) {
    try {
      const content = await executor(tc.name, tc.arguments)
      results.push({ role: 'tool', content, tool_call_id: tc.id, name: tc.name })
    } catch (e) {
      results.push({
        role: 'tool',
        content: `Error: ${String(e)}`,
        tool_call_id: tc.id,
        name: tc.name
      })
    }
  }
  return results
}

async function defaultToolExecutor(name: string, args: Record<string, unknown>): Promise<string> {
  const result = await executeTool(name, args)
  return result.success ? formatToolResult(result.result) : `Error: ${result.error}`
}

/**
 * Streams text from Ollama, automatically handling tool calls by executing them and continuing the conversation.
 *
 * @param model The Ollama model to use.
 * @param messages The conversation history.
 * @param options Optional configuration for agent mode, system prompt, and tool overrides.
 * @param depth The recursion depth to prevent infinite loops (internal).
 */
export async function* chatWithOllama(
  model: string,
  messages: OllamaMessage[],
  options: ChatOptions = {},
  depth = 0
): AsyncGenerator<string> {
  const mode = options.agentMode ?? DEFAULT_AGENT_MODE
  const systemPrompt = options.systemPrompt ?? AGENTS[mode].systemPrompt
  const activeTools = options.overrideTools ?? (getToolsForMode(mode) as Tool[])
  const executor = options.overrideToolExecutor ?? defaultToolExecutor

  // Prepend system message if not already present
  const hasSystem = messages.length > 0 && messages[0].role === 'system'
  const fullMessages: OllamaMessage[] = hasSystem
    ? messages
    : [{ role: 'system', content: systemPrompt }, ...messages]

  log.info(`chatWithOllama: model=${model}, mode=${mode}, tools=${activeTools.length}, messages=${fullMessages.length}`)

  const stream = await openStream(model, fullMessages, activeTools)
  if (!stream) {
    yield* chatWithOllama(model, messages, { ...options, overrideTools: [] }, depth)
    return
  }

  let contentAccumulated = ''
  const toolCalls: ToolCall[] = []

  for await (const chunk of stream) {
    if (chunk.message.content) {
      contentAccumulated += chunk.message.content
      yield chunk.message.content
    }
    if (chunk.message.tool_calls) {
      for (let i = 0; i < chunk.message.tool_calls.length; i++) {
        const tc = chunk.message.tool_calls[i]
        const args = typeof tc.function.arguments === 'string'
          ? JSON.parse(tc.function.arguments)
          : (tc.function.arguments ?? {})
        toolCalls.push({ id: `call_${Date.now()}_${i}`, name: tc.function.name, arguments: args as Record<string, unknown> })
      }
    }
  }

  if (toolCalls.length === 0) return
  if (depth >= 10) {
    log.warn('chatWithOllama: max tool-call depth reached')
    return
  }

  const toolResults = await executeToolCalls(toolCalls, executor)
  const updatedMessages: OllamaMessage[] = [
    ...fullMessages,
    {
      role: 'assistant',
      content: contentAccumulated,
      tool_calls: toolCalls.map(tc => ({ id: tc.id, type: 'function' as const, function: { name: tc.name, arguments: tc.arguments } }))
    },
    ...toolResults
  ]

  log.info(`chatWithOllama: recursive call depth=${depth + 1}, messages=${updatedMessages.length}`)
  yield* chatWithOllama(model, updatedMessages, { ...options, systemPrompt: undefined }, depth + 1)
}
