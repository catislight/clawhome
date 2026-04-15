import { app, BrowserWindow } from 'electron'

import { electronApp, optimizer } from '@electron-toolkit/utils'

import { registerIpcHandlers } from './ipc-handlers'
import { createMainWindow } from './main-window'

function handleWindowAllClosed(): void {
  if (process.platform !== 'darwin') {
    app.quit()
  }
}

export function bootstrapMainApp(): void {
  const ipcHandlers = registerIpcHandlers()

  void app.whenReady().then(() => {
    electronApp.setAppUserModelId('com.electron')

    app.on('browser-window-created', (_, window) => {
      optimizer.watchWindowShortcuts(window)
    })

    createMainWindow()

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createMainWindow()
      }
    })
  })

  app.on('window-all-closed', handleWindowAllClosed)
  app.on('before-quit', () => {
    void ipcHandlers.dispose()
  })
}
