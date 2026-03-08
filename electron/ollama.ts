import log from 'electron-log'
import { tools, executeTool } from './tools'
import { writeFileSync } from 'fs'
import { join } from 'path'

function formatToolResult(result: unknown): string {
  if (result === null || result === undefined) return ''
  if (typeof result === 'string') return result
  if (typeof result === 'object') return JSON.stringify(result, null, 2)
  return String(result)
}

export async function getOllamaModels(): Promise<string[]> {
  try {
    const response = await fetch('http://127.0.0.1:11434/api/tags')
    if (!response.ok) throw new Error('Failed to fetch models')
    const data: { models: OllamaModel[] } = await response.json()
    return data.models?.map((m: OllamaModel) => m.name) || []
  } catch (error) {
    log.error('Failed to get Ollama models:', error)
    return []
  }
}

interface OllamaModel {
  name: string
  [key: string]: unknown
}

interface OllamaToolCall {
  id: string
  type: 'function'
  function: {
    name: string
    arguments: Record<string, unknown>
  }
}

export interface OllamaMessage {
  role: string
  content: string
  tool_calls?: OllamaToolCall[]
  tool_call_id?: string
  name?: string
}

export async function* chatWithOllama(
  model: string,
  messages: OllamaMessage[],
  enableTools = true
): AsyncGenerator<string> {
  const requestBody: Record<string, unknown> = { model, messages, stream: true }

  if (enableTools) {
    requestBody.tools = tools
  }

  log.info(`chatWithOllama: model=${model}, enableTools=${enableTools}, messagesCount=${messages.length}`)

  const response = await fetch('http://127.0.0.1:11434/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody)
  })

  // If tools enabled and we get 400, retry without tools (model may not support tool calling)
  if (!response.ok && enableTools) {
    const errorText = await response.text()
    log.warn(`chatWithOllama: first request failed with ${response.status}, retrying without tools: ${errorText}`)
    
    const retryBody: Record<string, unknown> = { model, messages, stream: true }
    const retryResponse = await fetch('http://127.0.0.1:11434/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(retryBody)
    })
    
    if (!retryResponse.ok) {
      const retryErrorText = await retryResponse.text()
      throw new Error(`Ollama API error: ${retryResponse.status} - ${retryErrorText}`)
    }
    
    yield* streamOllamaResponse(retryResponse, messages, model, false)
    return
  }

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Ollama API error: ${response.status} - ${errorText}`)
  }

  yield* streamOllamaResponse(response, messages, model, enableTools)
}

async function* streamOllamaResponse(
  response: Response,
  messages: OllamaMessage[],
  model: string,
  enableTools: boolean
): AsyncGenerator<string> {
  const reader = response.body?.getReader()
  const decoder = new TextDecoder()

  if (!reader) throw new Error('No response body')

  let buffer = ''
  let currentMessage = { role: '', content: '' }
  let hasToolCall = false
  let toolCalls: Array<{ id: string; name: string; arguments: Record<string, unknown> }> = []

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''

    for (const line of lines) {
      if (!line.trim()) continue
      try {
        const data = JSON.parse(line)

        if (data.message) {
          if (!currentMessage.role) {
            currentMessage.role = data.message.role || 'assistant'
          }

          if (data.message.tool_calls) {
            hasToolCall = true
            for (const tc of data.message.tool_calls) {
              toolCalls.push({
                id: tc.id || `call_${Date.now()}`,
                name: tc.function?.name || '',
                arguments: typeof tc.function?.arguments === 'string'
                  ? JSON.parse(tc.function.arguments)
                  : (tc.function?.arguments || {})
              })
            }
          }

          if (data.message.content) {
            currentMessage.content += data.message.content
            yield data.message.content
          }
        }

        if (data.done) {
          break
        }
      } catch {}
    }
  }

  if (hasToolCall && toolCalls.length > 0) {
    const toolResults: OllamaMessage[] = []

    for (const tc of toolCalls) {
      try {
        const result = await executeTool(tc.name, tc.arguments)
        // Format result as a plain string - will be stringified once in the API call
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

    messages.push({
      role: 'assistant',
      content: currentMessage.content,
      tool_calls: toolCalls.map(tc => ({
        id: tc.id,
        type: 'function',
        function: { name: tc.name, arguments: tc.arguments }
      }))
    })

    messages.push(...toolResults)

    log.info(`chatWithOllama: making recursive call with ${messages.length} messages (after tool execution)`)
    
    // Detailed logging of the messages being sent
    for (let i = 0; i < messages.length; i++) {
      const m = messages[i]
      log.info(`chatWithOllama: message[${i}] role=${m.role}, content=${JSON.stringify(m.content?.substring(0, 100))}, tool_calls=${m.tool_calls ? 'yes' : 'no'}, tool_call_id=${m.tool_call_id ? 'yes' : 'no'}`)
      if (m.tool_calls) {
        log.info(`chatWithOllama: tool_calls detail:`, JSON.stringify(m.tool_calls))
      }
    }
    
    // Log the full request body to file for debugging
    const requestBody: Record<string, unknown> = { model, messages, stream: true }
    if (enableTools) {
      requestBody.tools = tools
    }
    const requestJson = JSON.stringify(requestBody)
    log.info(`chatWithOllama: full request body length: ${requestJson.length}`)
    
    // Write to file for detailed debugging
    try {
      const debugPath = join('/tmp', `ollama-request-${Date.now()}.json`)
      writeFileSync(debugPath, requestJson, 'utf-8')
      log.info(`chatWithOllama: request written to ${debugPath}`)
    } catch (e) {
      log.warn('Failed to write debug file:', e)
    }

    let toolResponse = ''
    for await (const chunk of chatWithOllama(model, messages, true)) {
      toolResponse += chunk
      yield chunk
    }
  }
}
