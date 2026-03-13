import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serve } from '@hono/node-server'
import { workingDirectory } from '../clients/electron/state'
import models from './routes/models'
import chat from './routes/chat'
import files from './routes/files'
import git from './routes/git'
import worktrees from './routes/worktrees'
import settings from './routes/settings'

const corsOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',')
  : ['http://localhost:5173', 'http://localhost:4173']

export function createApp(): Hono {
  const app = new Hono()

  app.use('*', cors({ origin: corsOrigins }))

  // Optional bearer token auth
  if (process.env.API_TOKEN) {
    const token = process.env.API_TOKEN
    app.use('/api/*', async (c, next) => {
      const auth = c.req.header('Authorization')
      if (auth !== `Bearer ${token}`) {
        return c.json({ error: 'Unauthorized' }, 401)
      }
      await next()
    })
  }

  app.get('/api/v1/health', (c) => {
    return c.json({ status: 'ok', workingDirectory })
  })

  app.route('/api/v1/models', models)
  app.route('/api/v1/chat', chat)
  app.route('/api/v1/files', files)
  app.route('/api/v1/git', git)
  app.route('/api/v1/worktrees', worktrees)
  app.route('/api/v1/settings', settings)

  return app
}

export function startHttpServer(port: number): void {
  const app = createApp()
  serve({ fetch: app.fetch, hostname: '127.0.0.1', port }, () => {
    console.log(`HTTP server listening on http://127.0.0.1:${port}`)
  })
}
