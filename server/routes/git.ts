import { Hono } from 'hono'
import { getGitStatus, gitCommit } from '../../clients/electron/git'

const git = new Hono()

git.get('/status', async (c) => {
  const status = await getGitStatus()
  if (!status) return c.json({ error: 'Not a git repository' }, 404)
  return c.json(status)
})

git.post('/commit', async (c) => {
  const body = await c.req.json<{ message: string }>()
  const { message } = body
  if (!message) return c.json({ error: 'message required' }, 400)
  try {
    await gitCommit(message)
    return c.json({ committed: true })
  } catch (err) {
    return c.json({ error: String(err) }, 500)
  }
})

export default git
