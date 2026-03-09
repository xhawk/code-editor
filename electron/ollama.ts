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

export async function* chatWithOllama(
  model: string,
  messages: OllamaMessage[],
  enableTools = true,
  depth = 0
): AsyncGenerator<string> {
  log.info(`chatWithOllama: model=${model}, enableTools=${enableTools}, messagesCount=${messages.length}`)

  let stream: AsyncIterable<{ message: { content?: string; tool_calls?: { function: { name: string; arguments: unknown } }[] } }>

  try {
    stream = await ollamaClient.chat({
      model,
      messages: messages as Message[],
      stream: true,
      ...(enableTools ? { tools: tools as Tool[] } : {})
    })
  } catch (e) {
    if (isResponseError(e) && e.status_code === 400 && enableTools) {
      log.warn(`chatWithOllama: request failed with 400, retrying without tools: ${e.error}`)
      yield* chatWithOllama(model, messages, false, depth)
      return
    }
    throw e
  }

  let contentAccumulated = ''
  const toolCallsCollected: Array<{ id: string; name: string; arguments: Record<string, unknown> }> = []

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
        toolCallsCollected.push({
          id: `call_${Date.now()}_${i}`,
          name: tc.function.name,
          arguments: args as Record<string, unknown>
        })
      }
    }
  }

  if (toolCallsCollected.length > 0) {
    if (depth >= 10) {
      log.warn('chatWithOllama: max tool-call depth reached')
      return
    }

    const toolResults: OllamaMessage[] = []

    for (const tc of toolCallsCollected) {
      try {
        const result = await executeTool(tc.name, tc.arguments)
        const resultContent = result.success
          ? formatToolResult(result.result)
          : `Error: ${result.error}`

        toolResults.push({
          role: 'tool',
          content: resultContent,
          tool_call_id: tc.id,
          name: tc.name
        })
      } catch (e) {
        toolResults.push({
          role: 'tool',
          content: `Error parsing arguments: ${String(e)}`,
          tool_call_id: tc.id,
          name: tc.name
        })
      }
    }

    const updatedMessages: OllamaMessage[] = [
      ...messages,
      {
        role: 'assistant',
        content: contentAccumulated,
        tool_calls: toolCallsCollected.map(tc => ({
          id: tc.id,
          type: 'function' as const,
          function: { name: tc.name, arguments: tc.arguments }
        }))
      },
      ...toolResults
    ]

    log.info(`chatWithOllama: recursive call depth=${depth + 1}, messages=${updatedMessages.length}`)

    for await (const chunk of chatWithOllama(model, updatedMessages, true, depth + 1)) {
      yield chunk
    }
  }
}
