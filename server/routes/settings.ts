import { Hono } from 'hono'
import { getTheme, setTheme, getChatMessages, setChatMessages, getAgentMode, setAgentMode } from '../storage'
import { workingDirectory, setWorkingDirectory } from '../../clients/electron/state'

const settings = new Hono()

settings.get('/working-directory', (c) => {
  return c.json({ workingDirectory })
})

settings.put('/working-directory', async (c) => {
  const body = await c.req.json<{ workingDirectory: string }>()
  if (!body.workingDirectory) return c.json({ error: 'workingDirectory required' }, 400)
  setWorkingDirectory(body.workingDirectory)
  return c.json({ workingDirectory: body.workingDirectory })
})

settings.get('/theme', (c) => {
  return c.json({ theme: getTheme() })
})

settings.put('/theme', async (c) => {
  const body = await c.req.json<{ theme: string }>()
  if (!body.theme) return c.json({ error: 'theme required' }, 400)
  setTheme(body.theme)
  return c.json({ theme: body.theme })
})

settings.get('/agent-mode', (c) => {
  return c.json({ agentMode: getAgentMode() })
})

settings.put('/agent-mode', async (c) => {
  const body = await c.req.json<{ agentMode: string }>()
  if (!body.agentMode) return c.json({ error: 'agentMode required' }, 400)
  setAgentMode(body.agentMode as 'code' | 'plan')
  return c.json({ agentMode: body.agentMode })
})

settings.get('/chat-messages/:key', (c) => {
  const key = c.req.param('key')
  return c.json(getChatMessages(key))
})

settings.put('/chat-messages/:key', async (c) => {
  const key = c.req.param('key')
  const messages = await c.req.json()
  setChatMessages(key, messages)
  return c.json({ saved: true })
})

export default settings
