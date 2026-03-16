import { app, BrowserWindow, ipcMain } from 'electron'
import { existsSync } from 'fs'
import { join, resolve, isAbsolute } from 'path'
import log from 'electron-log'
import { setWorkingDirectory } from './state'
import { startHttpServer } from '../../server/app'

log.initialize()
log.transports.file.level = 'info'
log.info('Application starting...')

// URL of the REST server this process will proxy requests to
let proxyApiUrl = ''
const streamControllers = new Map<string, AbortController>()
let ipcProxyRegistered = false

function registerIpcProxy() {
  if (ipcProxyRegistered) return
  ipcProxyRegistered = true

  ipcMain.handle('api-request', async (_, { method, path, body }: { method: string; path: string; body?: unknown }) => {
    const res = await fetch(`${proxyApiUrl}${path}`, {
      method,
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : {},
      body: body !== undefined ? JSON.stringify(body) : undefined
    })
    const data = await res.json()
    if (!res.ok) throw new Error(`${method} ${path} failed: ${res.status}`)
    return data
  })

  ipcMain.on('api-stream-start', async (event, { id, path, body }: { id: string; path: string; body: unknown }) => {
    const controller = new AbortController()
    streamControllers.set(id, controller)

    const send = (eventName: string, data: string) => {
      if (!event.sender.isDestroyed()) {
        event.sender.send('api-stream-event', id, eventName, data)
      }
    }

    try {
      const res = await fetch(`${proxyApiUrl}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal
      })

      if (!res.ok || !res.body) {
        send('error', JSON.stringify({ message: `HTTP ${res.status}` }))
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        let eventName = ''
        for (const line of lines) {
          if (line.startsWith('event: ')) {
            eventName = line.slice(7).trim()
          } else if (line.startsWith('data: ')) {
            const rawData = line.slice(6)
            if (eventName) {
              send(eventName, rawData)
              eventName = ''
            }
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        send('error', JSON.stringify({ message: String(err) }))
      }
    } finally {
      streamControllers.delete(id)
    }
  })

  ipcMain.on('api-stream-abort', (_, id: string) => {
    streamControllers.get(id)?.abort()
    streamControllers.delete(id)
  })
}

async function createWindow() {
  log.info(`Environment WORKDIR: ${process.env.WORKDIR}`)
  const args = process.argv.slice(1)
  let providedDir = process.env.WORKDIR || args.find(arg => !arg.startsWith('-') && !arg.includes('='))

  log.info(`Args: ${JSON.stringify(args)}, providedDir: ${providedDir}`)

  let workingDirectory: string

  if (providedDir) {
    workingDirectory = isAbsolute(providedDir) ? providedDir : resolve(process.cwd(), providedDir)
    log.info(`Resolved workingDirectory: ${workingDirectory}, exists: ${existsSync(workingDirectory)}`)
    if (!existsSync(workingDirectory)) {
      log.warn(`Provided directory does not exist: ${workingDirectory}, falling back to cwd`)
      workingDirectory = process.cwd()
    }
  } else {
    workingDirectory = process.cwd()
  }

  setWorkingDirectory(workingDirectory)
  log.info(`Working directory: ${workingDirectory}`)

  const port = parseInt(process.env.PORT ?? '3579', 10)
  const remoteApiUrl = process.env.REMOTE_API_URL
  const mode = remoteApiUrl ? 'remote' : 'local'

  proxyApiUrl = remoteApiUrl ?? `http://127.0.0.1:${port}`
  registerIpcProxy()

  if (!remoteApiUrl) {
    await startHttpServer(port).catch((err: Error) => {
      log.error('HTTP server failed to start:', err)
    })
  }

  const mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    minWidth: 600,
    minHeight: 500,
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      additionalArguments: [`--mode=${mode}`]
    },
    backgroundColor: '#1e1e2e',
    title: 'Code Editor AI'
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(join(__dirname, '../dist/index.html'))
  }

  log.info('Window created')
}

const gotTheLock = app.requestSingleInstanceLock()

if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    const mainWindow = BrowserWindow.getAllWindows()[0]
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })

  process.on('uncaughtException', (error) => {
    log.error('Uncaught exception:', error)
    app.exit(1)
  })

  process.on('unhandledRejection', (reason) => {
    log.error('Unhandled rejection:', reason)
  })

  app.whenReady().then(async () => {
    await createWindow()

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow()
      }
    })
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit()
    }
  })
}
