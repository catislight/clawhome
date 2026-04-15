import { BrowserWindow, shell } from 'electron'
import { join } from 'path'

import { is } from '@electron-toolkit/utils'

import icon from '../../resources/icon.png?asset'

export function createMainWindow(): BrowserWindow {
  const titleBarConfig =
    process.platform === 'darwin'
      ? {
          titleBarStyle: 'hiddenInset' as const
        }
      : process.platform === 'win32'
        ? {
            titleBarStyle: 'hidden' as const,
            titleBarOverlay: {
              color: '#ffffff',
              symbolColor: '#111827',
              height: 36
            }
          }
        : {}

  const mainWindow = new BrowserWindow({
    width: 1300,
    minWidth: 950,
    height: 670,
    title: '',
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#ffffff',
    ...titleBarConfig,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    void shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    void mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return mainWindow
}
