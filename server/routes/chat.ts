import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import { chatWithOllama, type OllamaMessage } from '../ollama'
import type { AgentMode } from '../agents/agents'
import { checkGitRepo } from '../git'
import { createWorktree } from '../worktree'
import { worktreePath } from '../../clients/electron/state'

const chat = new Hono()

chat.post('/', async (c) => {
  const body = await c.req.json<{ model: string; messages: OllamaMessage[]; agentMode?: AgentMode }>()
  const { model, messages, agentMode } = body

  return streamSSE(c, async (stream) => {
    let fullResponse = ''
    try {
      const isGitRepo = await checkGitRepo()
      if (isGitRepo && !worktreePath) {
        const newPath = await createWorktree()
        if (newPath) {
          await stream.writeSSE({ event: 'worktree', data: JSON.stringify({ path: newPath }) })
        }
      }

      for await (const chunk of chatWithOllama(model, messages, { agentMode })) {
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
