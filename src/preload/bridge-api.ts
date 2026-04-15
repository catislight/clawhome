import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

import { IPC_CHANNELS, type AppBridgeApi } from './bridge-contract'

type LegacyWindow = Window &
  typeof globalThis & {
    electron: typeof electronAPI
    api: AppBridgeApi
  }

function createAppBridgeApi(): AppBridgeApi {
  return {
    testSshConnection: (payload) => ipcRenderer.invoke(IPC_CHANNELS.sshTestConnection, payload),
    executeSshCommand: (payload) => ipcRenderer.invoke(IPC_CHANNELS.sshExecuteCommand, payload),
    createTerminalSession: (payload) =>
      ipcRenderer.invoke(IPC_CHANNELS.terminalSessionCreate, payload),
    writeTerminalInput: (payload) => ipcRenderer.invoke(IPC_CHANNELS.terminalSessionWrite, payload),
    resizeTerminalSession: (payload) =>
      ipcRenderer.invoke(IPC_CHANNELS.terminalSessionResize, payload),
    closeTerminalSession: (payload) =>
      ipcRenderer.invoke(IPC_CHANNELS.terminalSessionClose, payload),
    onTerminalData: (listener) => {
      const wrapped = (_event: IpcRendererEvent, payload: Parameters<typeof listener>[0]): void => {
        listener(payload)
      }

      ipcRenderer.on(IPC_CHANNELS.terminalSessionData, wrapped)

      return () => {
        ipcRenderer.off(IPC_CHANNELS.terminalSessionData, wrapped)
      }
    },
    onTerminalExit: (listener) => {
      const wrapped = (_event: IpcRendererEvent, payload: Parameters<typeof listener>[0]): void => {
        listener(payload)
      }

      ipcRenderer.on(IPC_CHANNELS.terminalSessionExit, wrapped)

      return () => {
        ipcRenderer.off(IPC_CHANNELS.terminalSessionExit, wrapped)
      }
    },
    connectGateway: (payload) => ipcRenderer.invoke(IPC_CHANNELS.gatewayConnect, payload),
    requestGateway: (payload) => ipcRenderer.invoke(IPC_CHANNELS.gatewayRequest, payload),
    getGatewayConnectionStatus: (payload) =>
      ipcRenderer.invoke(IPC_CHANNELS.gatewayConnectionStatus, payload),
    pullGatewayEvents: (payload) => ipcRenderer.invoke(IPC_CHANNELS.gatewayPullEvents, payload),
    listGatewayDebugLogs: (payload) =>
      ipcRenderer.invoke(IPC_CHANNELS.gatewayListDebugLogs, payload),
    clearGatewayDebugLogs: (payload) =>
      ipcRenderer.invoke(IPC_CHANNELS.gatewayClearDebugLogs, payload),
    disconnectGateway: (payload) => ipcRenderer.invoke(IPC_CHANNELS.gatewayDisconnect, payload),
    restartGateway: (payload) => ipcRenderer.invoke(IPC_CHANNELS.gatewayRestart, payload),
    discoverLocalOpenClaw: (payload) =>
      ipcRenderer.invoke(IPC_CHANNELS.localOpenClawDiscover, payload),
    readLocalSkillFile: (payload) => ipcRenderer.invoke(IPC_CHANNELS.localSkillFileRead, payload),
    writeLocalSkillFile: (payload) => ipcRenderer.invoke(IPC_CHANNELS.localSkillFileWrite, payload),
    deleteLocalCustomSkill: (payload) =>
      ipcRenderer.invoke(IPC_CHANNELS.localSkillDeleteCustom, payload),
    listLocalMemoryFiles: (payload) =>
      ipcRenderer.invoke(IPC_CHANNELS.localMemoryFilesList, payload),
    readLocalMemoryFile: (payload) => ipcRenderer.invoke(IPC_CHANNELS.localMemoryFileRead, payload),
    writeLocalMemoryFile: (payload) =>
      ipcRenderer.invoke(IPC_CHANNELS.localMemoryFileWrite, payload),
    deleteLocalMemoryFile: (payload) =>
      ipcRenderer.invoke(IPC_CHANNELS.localMemoryFileDelete, payload),
    uploadWorkspaceImage: (payload) =>
      ipcRenderer.invoke(IPC_CHANNELS.workspaceImageUpload, payload),
    readWorkspaceImage: (payload) => ipcRenderer.invoke(IPC_CHANNELS.workspaceImageRead, payload)
  }
}

export function exposeAppBridge(): void {
  const api = createAppBridgeApi()

  if (process.contextIsolated) {
    try {
      contextBridge.exposeInMainWorld('electron', electronAPI)
      contextBridge.exposeInMainWorld('api', api)
    } catch (error) {
      console.error(error)
    }
    return
  }

  const legacyWindow = window as LegacyWindow
  legacyWindow.electron = electronAPI
  legacyWindow.api = api
}
