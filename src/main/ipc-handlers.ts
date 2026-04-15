import { ipcMain } from 'electron'

import {
  IPC_CHANNELS,
  type GatewayConnectPayload,
  type GatewayConnectResult,
  type GatewayConnectionStatusPayload,
  type GatewayConnectionStatusResult,
  type GatewayClearDebugLogsPayload,
  type GatewayClearDebugLogsResult,
  type GatewayDisconnectPayload,
  type GatewayDisconnectResult,
  type GatewayListDebugLogsPayload,
  type GatewayListDebugLogsResult,
  type GatewayRestartPayload,
  type GatewayRestartResult,
  type GatewayPullEventsPayload,
  type GatewayPullEventsResult,
  type GatewayRequestPayload,
  type GatewayRequestResult,
  type LocalSkillDeleteCustomPayload,
  type LocalSkillDeleteCustomResult,
  type TerminalSessionActionResult,
  type TerminalSessionClosePayload,
  type TerminalSessionCreatePayload,
  type TerminalSessionCreateResult,
  type TerminalSessionResizePayload,
  type TerminalSessionWritePayload,
  type LocalMemoryFileReadPayload,
  type LocalMemoryFileReadResult,
  type LocalMemoryFileDeletePayload,
  type LocalMemoryFileDeleteResult,
  type LocalMemoryFilesListPayload,
  type LocalMemoryFilesListResult,
  type LocalMemoryFileWritePayload,
  type LocalMemoryFileWriteResult,
  type LocalOpenClawDiscoveryPayload,
  type LocalOpenClawDiscoveryResult,
  type LocalSkillFileReadPayload,
  type LocalSkillFileReadResult,
  type LocalSkillFileWritePayload,
  type LocalSkillFileWriteResult,
  type WorkspaceImageUploadPayload,
  type WorkspaceImageUploadResult,
  type WorkspaceImageReadPayload,
  type WorkspaceImageReadResult,
  type SshCommandPayload,
  type SshCommandResult,
  type SshConnectionTestPayload,
  type SshConnectionTestResult
} from '../preload/bridge-contract'
import {
  deleteLocalCustomSkill,
  readLocalSkillFile,
  writeLocalSkillFile
} from './local-skill-files'
import {
  deleteLocalMemoryFile,
  listLocalMemoryFiles,
  readLocalMemoryFile,
  writeLocalMemoryFile
} from './local-memory-files'
import { readWorkspaceImageFile, uploadWorkspaceImageFile } from './workspace-image-files'
import { discoverLocalOpenClaw } from './local-openclaw-discovery'
import { executeSshCommand, testSshConnection } from './node-ssh-util'
import { OpenClawGatewaySessionManager } from './openclaw-gateway-session'
import { restartOpenClawGateway } from './openclaw-gateway-restart'
import { LocalTerminalSessionManager } from './local-terminal-session-manager'

export type RegisteredIpcHandlers = {
  dispose: () => Promise<void>
}

function toErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback
}

function toSshConfig(payload: SshConnectionTestPayload): Parameters<typeof testSshConnection>[0] {
  return {
    host: payload.host,
    port: payload.port,
    username: payload.username,
    password: payload.password,
    privateKey: payload.privateKey,
    passphrase: payload.privateKeyPassphrase
  }
}

function registerSshHandlers(): void {
  ipcMain.handle(
    IPC_CHANNELS.sshTestConnection,
    async (_, payload: SshConnectionTestPayload): Promise<SshConnectionTestResult> => {
      try {
        await testSshConnection(toSshConfig(payload))

        return {
          success: true,
          message: `连接成功：${payload.title}`
        }
      } catch (error) {
        return {
          success: false,
          message: toErrorMessage(error, 'SSH 连接失败')
        }
      }
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.sshExecuteCommand,
    async (_, payload: SshCommandPayload): Promise<SshCommandResult> => {
      try {
        const result = await executeSshCommand(toSshConfig(payload), payload.command)

        return {
          success: result.code === 0,
          message:
            result.code === 0
              ? `命令执行成功：${payload.command}`
              : `命令执行失败：${payload.command}`,
          stdout: result.stdout,
          stderr: result.stderr,
          code: result.code
        }
      } catch (error) {
        return {
          success: false,
          message: toErrorMessage(error, 'SSH 命令执行失败'),
          stdout: '',
          stderr: '',
          code: null
        }
      }
    }
  )
}

function registerTerminalSessionHandlers(
  terminalSessionManager: LocalTerminalSessionManager
): void {
  ipcMain.handle(
    IPC_CHANNELS.terminalSessionCreate,
    (event, payload: TerminalSessionCreatePayload): TerminalSessionCreateResult => {
      return terminalSessionManager.createSession(event.sender, payload)
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.terminalSessionWrite,
    (event, payload: TerminalSessionWritePayload): TerminalSessionActionResult => {
      return terminalSessionManager.writeInput(event.sender.id, payload)
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.terminalSessionResize,
    (event, payload: TerminalSessionResizePayload): TerminalSessionActionResult => {
      return terminalSessionManager.resizeSession(event.sender.id, payload)
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.terminalSessionClose,
    (event, payload: TerminalSessionClosePayload): TerminalSessionActionResult => {
      return terminalSessionManager.closeSession(event.sender.id, payload)
    }
  )
}

function registerGatewayHandlers(gatewaySessionManager: OpenClawGatewaySessionManager): void {
  ipcMain.handle(
    IPC_CHANNELS.gatewayConnect,
    async (_, payload: GatewayConnectPayload): Promise<GatewayConnectResult> => {
      try {
        const grantedAuth = await gatewaySessionManager.connect(
          payload.instanceId,
          payload.connection
        )

        return {
          success: true,
          message: `Gateway 连接成功：${payload.connection.title}（scopes: ${grantedAuth.scopes.join(',') || '(none)'}）`,
          role: grantedAuth.role,
          scopes: grantedAuth.scopes,
          deviceId: grantedAuth.deviceId,
          serverVersion: grantedAuth.serverVersion
        }
      } catch (error) {
        return {
          success: false,
          message: toErrorMessage(error, 'Gateway 连接失败')
        }
      }
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.gatewayRequest,
    async (_, payload: GatewayRequestPayload): Promise<GatewayRequestResult> => {
      try {
        const response = await gatewaySessionManager.request(
          payload.instanceId,
          payload.method,
          payload.params,
          payload.timeoutMs
        )

        return {
          success: true,
          message: `请求成功：${payload.method}`,
          payload: response
        }
      } catch (error) {
        return {
          success: false,
          message: toErrorMessage(error, `请求失败：${payload.method}`)
        }
      }
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.gatewayConnectionStatus,
    async (_, payload: GatewayConnectionStatusPayload): Promise<GatewayConnectionStatusResult> => {
      try {
        const status = gatewaySessionManager.getConnectionStatus(payload.instanceId)

        return {
          success: true,
          connected: status.connected,
          message: status.connected ? 'Gateway 已连接' : 'Gateway 已断开'
        }
      } catch (error) {
        return {
          success: false,
          connected: false,
          message: toErrorMessage(error, '连接状态查询失败')
        }
      }
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.gatewayPullEvents,
    async (_, payload: GatewayPullEventsPayload): Promise<GatewayPullEventsResult> => {
      try {
        const events = gatewaySessionManager.pullEvents(payload.instanceId, payload.maxEvents ?? 50)

        return {
          success: true,
          message: '事件拉取成功',
          events
        }
      } catch (error) {
        return {
          success: false,
          message: toErrorMessage(error, '事件拉取失败'),
          events: []
        }
      }
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.gatewayListDebugLogs,
    async (_, payload: GatewayListDebugLogsPayload): Promise<GatewayListDebugLogsResult> => {
      try {
        const logs = gatewaySessionManager.listDebugLogs(payload.instanceId, payload.limit ?? 300)

        return {
          success: true,
          message: '日志读取成功',
          logs
        }
      } catch (error) {
        return {
          success: false,
          message: toErrorMessage(error, '日志读取失败'),
          logs: []
        }
      }
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.gatewayClearDebugLogs,
    async (_, payload: GatewayClearDebugLogsPayload): Promise<GatewayClearDebugLogsResult> => {
      try {
        const clearedCount = gatewaySessionManager.clearDebugLogs(payload.instanceId)

        return {
          success: true,
          message: `日志清空成功（${clearedCount} 条）`,
          clearedCount
        }
      } catch (error) {
        return {
          success: false,
          message: toErrorMessage(error, '日志清空失败'),
          clearedCount: 0
        }
      }
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.gatewayDisconnect,
    async (_, payload: GatewayDisconnectPayload): Promise<GatewayDisconnectResult> => {
      try {
        await gatewaySessionManager.disconnect(payload.instanceId)

        return {
          success: true,
          message: 'Gateway 已断开'
        }
      } catch (error) {
        return {
          success: false,
          message: toErrorMessage(error, 'Gateway 断开失败')
        }
      }
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.gatewayRestart,
    async (_, payload: GatewayRestartPayload): Promise<GatewayRestartResult> => {
      try {
        const result = await restartOpenClawGateway(payload.connection)

        return result
      } catch (error) {
        const message = toErrorMessage(error, 'Gateway 重启失败')
        return {
          success: false,
          message,
          stdout: '',
          stderr: message,
          code: null
        }
      }
    }
  )
}

function registerLocalOpenClawDiscoveryHandlers(): void {
  ipcMain.handle(
    IPC_CHANNELS.localOpenClawDiscover,
    async (_, payload: LocalOpenClawDiscoveryPayload): Promise<LocalOpenClawDiscoveryResult> => {
      try {
        return await discoverLocalOpenClaw(payload)
      } catch (error) {
        return {
          success: false,
          message: toErrorMessage(error, '本地 OpenClaw 探测失败'),
          foundCli: false,
          foundToken: false,
          foundPassword: false,
          selectedAuthMode: 'none',
          gatewayToken: '',
          gatewayPassword: '',
          scannedAt: new Date().toISOString()
        }
      }
    }
  )
}

function registerLocalSkillFileHandlers(): void {
  ipcMain.handle(
    IPC_CHANNELS.localSkillFileRead,
    async (_, payload: LocalSkillFileReadPayload): Promise<LocalSkillFileReadResult> => {
      try {
        const content = await readLocalSkillFile(payload.filePath)
        return {
          success: true,
          message: '本地技能文件读取成功',
          content
        }
      } catch (error) {
        return {
          success: false,
          message: toErrorMessage(error, '本地技能文件读取失败'),
          content: ''
        }
      }
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.localSkillFileWrite,
    async (_, payload: LocalSkillFileWritePayload): Promise<LocalSkillFileWriteResult> => {
      try {
        await writeLocalSkillFile(payload.filePath, payload.content)
        return {
          success: true,
          message: '本地技能文件保存成功'
        }
      } catch (error) {
        return {
          success: false,
          message: toErrorMessage(error, '本地技能文件保存失败')
        }
      }
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.localSkillDeleteCustom,
    async (_, payload: LocalSkillDeleteCustomPayload): Promise<LocalSkillDeleteCustomResult> => {
      try {
        await deleteLocalCustomSkill({
          baseDir: payload.baseDir,
          filePath: payload.filePath
        })
        return {
          success: true,
          message: '本地自定义技能删除成功'
        }
      } catch (error) {
        return {
          success: false,
          message: toErrorMessage(error, '本地自定义技能删除失败')
        }
      }
    }
  )
}

function registerLocalMemoryFileHandlers(): void {
  ipcMain.handle(
    IPC_CHANNELS.localMemoryFilesList,
    async (_, payload: LocalMemoryFilesListPayload): Promise<LocalMemoryFilesListResult> => {
      try {
        const files = await listLocalMemoryFiles(payload.workspacePath)
        return {
          success: true,
          message: '本地 memory 文件列表读取成功',
          files
        }
      } catch (error) {
        return {
          success: false,
          message: toErrorMessage(error, '本地 memory 文件列表读取失败'),
          files: []
        }
      }
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.localMemoryFileRead,
    async (_, payload: LocalMemoryFileReadPayload): Promise<LocalMemoryFileReadResult> => {
      try {
        const result = await readLocalMemoryFile({
          workspacePath: payload.workspacePath,
          relativeFilePath: payload.relativeFilePath
        })
        return {
          success: true,
          message: '本地 memory 文件读取成功',
          found: result.found,
          content: result.content
        }
      } catch (error) {
        return {
          success: false,
          message: toErrorMessage(error, '本地 memory 文件读取失败'),
          found: false,
          content: ''
        }
      }
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.localMemoryFileWrite,
    async (_, payload: LocalMemoryFileWritePayload): Promise<LocalMemoryFileWriteResult> => {
      try {
        await writeLocalMemoryFile({
          workspacePath: payload.workspacePath,
          relativeFilePath: payload.relativeFilePath,
          content: payload.content
        })
        return {
          success: true,
          message: '本地 memory 文件保存成功'
        }
      } catch (error) {
        return {
          success: false,
          message: toErrorMessage(error, '本地 memory 文件保存失败')
        }
      }
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.localMemoryFileDelete,
    async (_, payload: LocalMemoryFileDeletePayload): Promise<LocalMemoryFileDeleteResult> => {
      try {
        const deleted = await deleteLocalMemoryFile({
          workspacePath: payload.workspacePath,
          relativeFilePath: payload.relativeFilePath
        })
        return {
          success: true,
          message: deleted ? '本地 memory 文件删除成功' : '本地 memory 文件不存在',
          deleted
        }
      } catch (error) {
        return {
          success: false,
          message: toErrorMessage(error, '本地 memory 文件删除失败'),
          deleted: false
        }
      }
    }
  )
}

function registerWorkspaceImageHandlers(): void {
  ipcMain.handle(
    IPC_CHANNELS.workspaceImageUpload,
    async (_, payload: WorkspaceImageUploadPayload): Promise<WorkspaceImageUploadResult> => {
      try {
        const uploaded = await uploadWorkspaceImageFile({
          workspacePath: payload.workspacePath,
          fileName: payload.fileName,
          mimeType: payload.mimeType,
          base64Data: payload.base64Data,
          connection: payload.connection
        })

        return {
          success: true,
          message: '图片上传成功',
          fileName: uploaded.fileName,
          relativePath: uploaded.relativePath,
          absolutePath: uploaded.absolutePath
        }
      } catch (error) {
        return {
          success: false,
          message: toErrorMessage(error, '图片上传失败'),
          fileName: '',
          relativePath: '',
          absolutePath: ''
        }
      }
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.workspaceImageRead,
    async (_, payload: WorkspaceImageReadPayload): Promise<WorkspaceImageReadResult> => {
      try {
        const image = await readWorkspaceImageFile({
          absolutePath: payload.absolutePath,
          relativePath: payload.relativePath,
          workspacePath: payload.workspacePath,
          connection: payload.connection
        })

        return {
          success: true,
          message: '图片读取成功',
          mimeType: image.mimeType,
          base64Data: image.base64Data,
          absolutePath: image.absolutePath
        }
      } catch (error) {
        return {
          success: false,
          message: toErrorMessage(error, '图片读取失败'),
          mimeType: '',
          base64Data: '',
          absolutePath: ''
        }
      }
    }
  )
}

export function registerIpcHandlers(): RegisteredIpcHandlers {
  const gatewaySessionManager = new OpenClawGatewaySessionManager()
  const terminalSessionManager = new LocalTerminalSessionManager()

  ipcMain.on(IPC_CHANNELS.ping, () => console.log('pong'))

  registerSshHandlers()
  registerTerminalSessionHandlers(terminalSessionManager)
  registerGatewayHandlers(gatewaySessionManager)
  registerLocalOpenClawDiscoveryHandlers()
  registerLocalSkillFileHandlers()
  registerLocalMemoryFileHandlers()
  registerWorkspaceImageHandlers()

  return {
    dispose: async () => {
      await Promise.all([gatewaySessionManager.disposeAll(), terminalSessionManager.disposeAll()])
    }
  }
}
