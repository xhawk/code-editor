import { Hono } from 'hono'
import { getAllWorktrees, removeWorktree } from '../git'
import { createWorktree } from '../worktree'
import {
  setSelectedWorktreePath,
  setWorktreePath,
  markWorktreeCreated,
  worktreePath,
  selectedWorktreePath
} from '../../clients/electron/state'

const worktrees = new Hono()

worktrees.get('/status', (c) => {
  return c.json({ created: worktreePath !== null, path: worktreePath })
})

worktrees.get('/', async (c) => {
  const list = await getAllWorktrees()
  return c.json(list)
})

worktrees.post('/', async (c) => {
  const path = await createWorktree()
  if (!path) return c.json({ error: 'Failed to create worktree' }, 500)
  return c.json({ path }, 201)
})

worktrees.delete('/:encodedPath', async (c) => {
  const path = decodeURIComponent(c.req.param('encodedPath'))
  try {
    await removeWorktree(path)
    if (worktreePath === path) {
      setWorktreePath(null)
      markWorktreeCreated(false)
    }
    if (selectedWorktreePath === path) {
      setSelectedWorktreePath(null)
    }
    return c.json({ archived: path })
  } catch (err) {
    return c.json({ error: String(err) }, 500)
  }
})

worktrees.post('/select', async (c) => {
  const body = await c.req.json<{ path: string | null }>()
  setSelectedWorktreePath(body.path)
  return c.json({ selected: body.path })
})

export default worktrees
