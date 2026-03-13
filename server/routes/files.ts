import { Hono } from 'hono'
import { existsSync, mkdirSync, writeFileSync, readFileSync, unlinkSync, readdirSync, statSync } from 'fs'
import { join, dirname } from 'path'
import { getBaseDirectory } from '../../clients/electron/state'
import { gitAdd } from '../../clients/electron/git'

const files = new Hono()

files.get('/', (c) => {
  const path = c.req.query('path') ?? ''
  const baseDir = getBaseDirectory()
  const fullPath = join(baseDir, path)
  try {
    const items = readdirSync(fullPath).map(name => ({
      name,
      isDirectory: statSync(join(fullPath, name)).isDirectory(),
      path: join(path, name)
    }))
    return c.json({ items })
  } catch (err) {
    return c.json({ error: String(err) }, 500)
  }
})

files.get('/content', (c) => {
  const path = c.req.query('path')
  if (!path) return c.json({ error: 'path required' }, 400)
  const baseDir = getBaseDirectory()
  const fullPath = join(baseDir, path)
  try {
    const content = readFileSync(fullPath, 'utf-8')
    return c.json({ content })
  } catch (err) {
    return c.json({ error: String(err) }, 500)
  }
})

files.post('/', async (c) => {
  const body = await c.req.json<{ relativePath: string; content: string }>()
  const { relativePath, content } = body
  const baseDir = getBaseDirectory()
  const fullPath = join(baseDir, relativePath)
  try {
    const dir = dirname(fullPath)
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    writeFileSync(fullPath, content, 'utf-8')
    await gitAdd([relativePath])
    return c.json({ path: fullPath })
  } catch (err) {
    return c.json({ error: String(err) }, 500)
  }
})

files.delete('/', async (c) => {
  const path = c.req.query('path')
  if (!path) return c.json({ error: 'path required' }, 400)
  const baseDir = getBaseDirectory()
  const fullPath = join(baseDir, path)
  try {
    unlinkSync(fullPath)
    await gitAdd([path])
    return c.json({ deleted: path })
  } catch (err) {
    return c.json({ error: String(err) }, 500)
  }
})

export default files
