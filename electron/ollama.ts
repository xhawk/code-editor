import log from 'electron-log'
import { Ollama, type Message, type Tool } from 'ollama'
import { tools, executeTool } from './tools'

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
async function openStream(model: string, messages: OllamaMessage[], enableTools: boolean) {
  try {
    return await ollamaClient.chat({
      model,
      messages: messages as Message[],
      stream: true,
      ...(enableTools ? { tools: tools as Tool[] } : {})
    })
  } catch (e) {
    if (isResponseError(e) && e.status_code === 400 && enableTools) {
      log.warn(`chatWithOllama: request failed with 400, retrying without tools: ${e.error}`)
      return null
    }
    throw e
  }
}

async function executeToolCalls(toolCalls: ToolCall[]): Promise<OllamaMessage[]> {
  const results: OllamaMessage[] = []
  for (const tc of toolCalls) {
    try {
      const result = await executeTool(tc.name, tc.arguments)
      results.push({
        role: 'tool',
        content: result.success ? formatToolResult(result.result) : `Error: ${result.error}`,
        tool_call_id: tc.id,
        name: tc.name
      })
    } catch (e) {
      results.push({
        role: 'tool',
        content: `Error parsing arguments: ${String(e)}`,
        tool_call_id: tc.id,
        name: tc.name
      })
    }
  }
  return results
}

/**
 * Streams text from Ollama, automatically handling tool calls by executing them and continuing the conversation.
 *
 * @param model The Ollama model to use.
 * @param messages The conversation history.
 * @param enableTools Whether to enable tool calling (defaults to true).
 * @param depth The recursion depth to prevent infinite loops.
 */
export async function* chatWithOllama(
  model: string,
  messages: OllamaMessage[],
  enableTools = true,
  depth = 0
): AsyncGenerator<string> {
  log.info(`chatWithOllama: model=${model}, enableTools=${enableTools}, messagesCount=${messages.length}`)

  const stream = await openStream(model, messages, enableTools)
  if (!stream) {
    yield* chatWithOllama(model, messages, false, depth)
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

  const toolResults = await executeToolCalls(toolCalls)
  const updatedMessages: OllamaMessage[] = [
    ...messages,
    {
      role: 'assistant',
      content: contentAccumulated,
      tool_calls: toolCalls.map(tc => ({ id: tc.id, type: 'function' as const, function: { name: tc.name, arguments: tc.arguments } }))
    },
    ...toolResults
  ]

  log.info(`chatWithOllama: recursive call depth=${depth + 1}, messages=${updatedMessages.length}`)
  yield* chatWithOllama(model, updatedMessages, true, depth + 1)
}
