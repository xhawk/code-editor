import { ipcMain, BrowserWindow } from 'electron'
import { existsSync, mkdirSync, writeFileSync, readFileSync, unlinkSync, readdirSync, statSync } from 'fs'
import { join, dirname } from 'path'
import log from 'electron-log'
import { workingDirectory, worktreePath, getBaseDirectory } from './state'
import { getOllamaModels, chatWithOllama } from './ollama'
import { checkGitRepo } from './git'
import { createWorktree } from './worktree'

let mainWindow: BrowserWindow | null = null

export function setMainWindow(window: BrowserWindow | null) {
  mainWindow = window
}

export function registerIpcHandlers() {
  ipcMain.handle('get-working-directory', () => workingDirectory)

  ipcMain.handle('get-worktree-status', () => ({
    created: worktreePath !== null,
    path: worktreePath
  }))

  ipcMain.handle('get-ollama-models', async () => {
    return await getOllamaModels()
  })

  ipcMain.handle('check-git-repo', async () => {
    return await checkGitRepo()
  })

  ipcMain.handle('create-worktree', async () => {
    return await createWorktree()
  })

  ipcMain.handle('chat', async (event, { model, messages }) => {
    const isGitRepo = await checkGitRepo()

    if (isGitRepo && !worktreePath) {
      await createWorktree()
      mainWindow?.webContents.send('worktree-created', { path: worktreePath })
    }

    let fullResponse = ''

    for await (const chunk of chatWithOllama(model, messages, true)) {
      fullResponse += chunk
      mainWindow?.webContents.send('chat-stream', chunk)
    }

    return fullResponse
  })

  ipcMain.handle('create-file', async (event, { relativePath, content }: { relativePath: string; content: string }) => {
    try {
      const baseDir = getBaseDirectory()
      const fullPath = join(baseDir, relativePath)
      const dir = dirname(fullPath)

      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true })
      }

      writeFileSync(fullPath, content, 'utf-8')
      log.info(`File created: ${fullPath}`)
      return { success: true, path: fullPath }
    } catch (error) {
      log.error('Failed to create file:', error)
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('read-file', async (event, { relativePath }: { relativePath: string }) => {
    try {
      const baseDir = getBaseDirectory()
      const fullPath = join(baseDir, relativePath)
      const content = readFileSync(fullPath, 'utf-8')
      return { success: true, content }
    } catch (error) {
      log.error('Failed to read file:', error)
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('delete-file', async (event, { relativePath }: { relativePath: string }) => {
    try {
      const baseDir = getBaseDirectory()
      const fullPath = join(baseDir, relativePath)
      unlinkSync(fullPath)
      log.info(`File deleted: ${fullPath}`)
      return { success: true }
    } catch (error) {
      log.error('Failed to delete file:', error)
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('list-files', async (event, { relativePath }: { relativePath: string }) => {
    try {
      const baseDir = getBaseDirectory()
      const fullPath = join(baseDir, relativePath)
      const items = readdirSync(fullPath).map(name => {
        const itemPath = join(fullPath, name)
        const stats = statSync(itemPath)
        return {
          name,
          isDirectory: stats.isDirectory(),
          path: join(relativePath, name)
        }
      })
      return { success: true, items }
    } catch (error) {
      log.error('Failed to list files:', error)
      return { success: false, error: String(error) }
    }
  })
}
