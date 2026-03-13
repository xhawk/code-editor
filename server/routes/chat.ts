import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import { chatWithOllama, type OllamaMessage } from '../../clients/electron/ollama'

const chat = new Hono()

chat.post('/', async (c) => {
  const body = await c.req.json<{ model: string; messages: OllamaMessage[] }>()
  const { model, messages } = body

  return streamSSE(c, async (stream) => {
    let fullResponse = ''
    try {
      for await (const chunk of chatWithOllama(model, messages)) {
        fullResponse += chunk
        await stream.writeSSE({ event: 'chunk', data: JSON.stringify({ text: chunk }) })
      }
      await stream.writeSSE({ event: 'done', data: JSON.stringify({ fullResponse }) })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      await stream.writeSSE({ event: 'error', data: JSON.stringify({ message }) })
    }
  })
})

export default chat
