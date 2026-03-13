import { Hono } from 'hono'
import { getTheme, setTheme, getChatMessages, setChatMessages } from '../storage'

const settings = new Hono()

settings.get('/theme', (c) => {
  return c.json({ theme: getTheme() })
})

settings.put('/theme', async (c) => {
  const body = await c.req.json<{ theme: string }>()
  if (!body.theme) return c.json({ error: 'theme required' }, 400)
  setTheme(body.theme)
  return c.json({ theme: body.theme })
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
