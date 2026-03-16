import { contextBridge, ipcRenderer } from 'electron'

// Map from stream ID to callback, populated by stream() and cleaned up by streamAbort()
const streamHandlers = new Map<string, (event: string, data: string) => void>()

ipcRenderer.on('api-stream-event', (_, id: string, event: string, data: string) => {
  streamHandlers.get(id)?.(event, data)
})

contextBridge.exposeInMainWorld('__bridge__', {
  request: (method: string, path: string, body?: unknown) =>
    ipcRenderer.invoke('api-request', { method, path, body }),

  stream: (id: string, path: string, body: unknown, callback: (event: string, data: string) => void) => {
    streamHandlers.set(id, callback)
    ipcRenderer.send('api-stream-start', { id, path, body })
  },

  streamAbort: (id: string) => {
    streamHandlers.delete(id)
    ipcRenderer.send('api-stream-abort', id)
  }
})

const mode = process.argv.find(a => a.startsWith('--mode='))?.slice(7) ?? 'local'
contextBridge.exposeInMainWorld('__API_CONFIG__', { mode })
