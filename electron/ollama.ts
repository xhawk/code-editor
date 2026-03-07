import log from 'electron-log'
import { tools, executeTool } from './tools'

export async function getOllamaModels(): Promise<string[]> {
  try {
    const response = await fetch('http://127.0.0.1:11434/api/tags')
    if (!response.ok) throw new Error('Failed to fetch models')
    const data = await response.json()
    return data.models?.map((m: { name: string }) => m.name) || []
  } catch (error) {
    log.error('Failed to get Ollama models:', error)
    return []
  }
}

export async function* chatWithOllama(
  model: string,
  messages: { role: string; content: string }[],
  enableTools = true
): AsyncGenerator<string> {
  const requestBody: Record<string, unknown> = { model, messages, stream: true }

  if (enableTools) {
    requestBody.tools = tools
  }

  const response = await fetch('http://127.0.0.1:11434/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody)
  })

  if (!response.ok) {
    throw new Error(`Ollama API error: ${response.status}`)
  }

  const reader = response.body?.getReader()
  const decoder = new TextDecoder()

  if (!reader) throw new Error('No response body')

  let buffer = ''
  let currentMessage = { role: '', content: '' }
  let hasToolCall = false
  let toolCalls: Array<{ id: string; name: string; arguments: string }> = []

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
                arguments: typeof tc.function?.arguments === 'string' ? tc.function.arguments : JSON.stringify(tc.function?.arguments || {})
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
    const toolResults: Array<{ role: string; content: string; tool_call_id?: string; name?: string }> = []

    for (const tc of toolCalls) {
      try {
        const args = JSON.parse(tc.arguments)
        const result = await executeTool(tc.name, args)
        const resultContent = result.success
          ? JSON.stringify(result.result)
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
      ...(toolCalls.length > 0 && { tool_calls: toolCalls.map(tc => ({
        id: tc.id,
        type: 'function',
        function: { name: tc.name, arguments: tc.arguments }
      }))})
    })

    messages.push(...toolResults)

    let toolResponse = ''
    for await (const chunk of chatWithOllama(model, messages, false)) {
      toolResponse += chunk
      yield chunk
    }
  }
}
