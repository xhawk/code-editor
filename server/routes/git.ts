import { Hono } from 'hono'
import { checkGitRepo, getGitStatus, gitCommit, getStagedDiffStat } from '../git'

const git = new Hono()

git.get('/check', async (c) => {
  const isRepo = await checkGitRepo()
  return c.json({ isRepo })
})

git.get('/status', async (c) => {
  const worktreePath = c.req.query('worktreePath') ?? undefined
  const status = await getGitStatus(worktreePath)
  if (!status) return c.json({ error: 'Not a git repository' }, 404)
  return c.json(status)
})

git.post('/commit', async (c) => {
  const body = await c.req.json<{ message: string; worktreePath?: string | null }>()
  const { message, worktreePath } = body
  if (!message) return c.json({ error: 'message required' }, 400)
  try {
    await gitCommit(message, worktreePath ?? undefined)
    return c.json({ committed: true })
  } catch (err) {
    return c.json({ error: String(err) }, 500)
  }
})

git.get('/staged-diff-stat', async (c) => {
  const worktreePath = c.req.query('worktreePath') ?? undefined
  try {
    const stat = await getStagedDiffStat(worktreePath)
    return c.json({ stat })
  } catch (err) {
    return c.json({ error: String(err) }, 500)
  }
})

export default git
