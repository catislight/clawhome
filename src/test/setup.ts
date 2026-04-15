import { cleanup } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'
import { vi } from 'vitest'

import { useGatewayConversationStore } from '../renderer/src/stores/use-gateway-conversation-store'

afterEach(() => {
  useGatewayConversationStore.setState({
    conversations: {},
    workspacePathByInstanceId: {},
    sessionModelOverrideByConversationKey: {}
  })
  cleanup()
})

Object.defineProperty(window, 'electron', {
  value: {
    process: {
      versions: {
        electron: '0.0.0',
        chrome: '0.0.0',
        node: '0.0.0'
      }
    },
    ipcRenderer: {
      send: vi.fn()
    }
  },
  writable: true
})

Object.defineProperty(window, 'api', {
  value: {
    testSshConnection: vi.fn().mockResolvedValue({
      success: true,
      message: 'mock connection success'
    }),
    executeSshCommand: vi.fn().mockResolvedValue({
      success: true,
      message: 'mock command success',
      stdout: 'mock output',
      stderr: '',
      code: 0
    }),
    createTerminalSession: vi.fn().mockResolvedValue({
      success: true,
      message: 'mock terminal session created',
      sessionId: 'mock-terminal-session',
      pid: 1234
    }),
    writeTerminalInput: vi.fn().mockResolvedValue({
      success: true,
      message: 'mock terminal write success'
    }),
    resizeTerminalSession: vi.fn().mockResolvedValue({
      success: true,
      message: 'mock terminal resize success'
    }),
    closeTerminalSession: vi.fn().mockResolvedValue({
      success: true,
      message: 'mock terminal close success'
    }),
    onTerminalData: vi.fn(() => vi.fn()),
    onTerminalExit: vi.fn(() => vi.fn()),
    connectGateway: vi.fn().mockResolvedValue({
      success: true,
      message: 'mock gateway connected'
    }),
    requestGateway: vi.fn().mockResolvedValue({
      success: true,
      message: 'mock request success',
      payload: {}
    }),
    getGatewayConnectionStatus: vi.fn().mockResolvedValue({
      success: true,
      connected: true,
      message: 'mock connected'
    }),
    pullGatewayEvents: vi.fn().mockResolvedValue({
      success: true,
      message: 'mock events success',
      events: []
    }),
    listGatewayDebugLogs: vi.fn().mockResolvedValue({
      success: true,
      message: 'mock logs success',
      logs: []
    }),
    clearGatewayDebugLogs: vi.fn().mockResolvedValue({
      success: true,
      message: 'mock logs cleared',
      clearedCount: 0
    }),
    disconnectGateway: vi.fn().mockResolvedValue({
      success: true,
      message: 'mock disconnected'
    }),
    restartGateway: vi.fn().mockResolvedValue({
      success: true,
      message: 'mock gateway restarted',
      stdout: '',
      stderr: '',
      code: 0
    }),
    discoverLocalOpenClaw: vi.fn().mockResolvedValue({
      success: true,
      message: 'mock local discovery success',
      foundCli: true,
      foundToken: true,
      foundPassword: false,
      selectedAuthMode: 'token',
      gatewayToken: 'mock-token',
      gatewayPassword: '',
      scannedAt: '2026-04-04T00:00:00.000Z'
    }),
    readLocalSkillFile: vi.fn().mockResolvedValue({
      success: true,
      message: 'mock local skill read success',
      content: ''
    }),
    writeLocalSkillFile: vi.fn().mockResolvedValue({
      success: true,
      message: 'mock local skill write success'
    }),
    deleteLocalCustomSkill: vi.fn().mockResolvedValue({
      success: true,
      message: 'mock local skill delete success'
    }),
    listLocalMemoryFiles: vi.fn().mockResolvedValue({
      success: true,
      message: 'mock local memory list success',
      files: []
    }),
    readLocalMemoryFile: vi.fn().mockResolvedValue({
      success: true,
      message: 'mock local memory read success',
      found: false,
      content: ''
    }),
    writeLocalMemoryFile: vi.fn().mockResolvedValue({
      success: true,
      message: 'mock local memory write success'
    }),
    deleteLocalMemoryFile: vi.fn().mockResolvedValue({
      success: true,
      message: 'mock local memory delete success',
      deleted: true
    }),
    uploadWorkspaceImage: vi.fn().mockResolvedValue({
      success: true,
      message: 'mock workspace image upload success',
      fileName: 'uploaded.png',
      relativePath: 'images/uploaded.png',
      absolutePath: '/workspace/images/uploaded.png'
    }),
    readWorkspaceImage: vi.fn().mockResolvedValue({
      success: true,
      message: 'mock workspace image read success',
      mimeType: 'image/png',
      base64Data: 'QUJDRA==',
      absolutePath: '/workspace/images/uploaded.png'
    })
  },
  writable: true
})

Object.defineProperty(window.HTMLElement.prototype, 'scrollIntoView', {
  value: vi.fn(),
  writable: true
})
