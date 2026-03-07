import { app, BrowserWindow } from 'electron'
import { existsSync } from 'fs'
import { join, resolve, isAbsolute } from 'path'
import log from 'electron-log'
import { setWorkingDirectory } from './state'
import { setMainWindow, registerIpcHandlers } from './ipc-handlers'

log.initialize()
log.transports.file.level = 'info'
log.info('Application starting...')

const gotTheLock = app.requestSingleInstanceLock()

if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', (event, commandLine) => {
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

  function createWindow() {
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

    const mainWindow = new BrowserWindow({
      width: 900,
      height: 700,
      minWidth: 600,
      minHeight: 500,
      webPreferences: {
        preload: join(__dirname, 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false
      },
      backgroundColor: '#1e1e2e',
      title: 'Code Editor AI'
    })

    setMainWindow(mainWindow)

    if (process.env.VITE_DEV_SERVER_URL) {
      mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
      mainWindow.webContents.openDevTools()
    } else {
      mainWindow.loadFile(join(__dirname, '../dist/index.html'))
    }

    mainWindow.on('closed', () => {
      setMainWindow(null)
    })

    log.info('Window created')
  }

  app.whenReady().then(() => {
    registerIpcHandlers()
    createWindow()

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
