export const IPC_CHANNELS = {
  ping: 'ping',
  sshTestConnection: 'ssh:test-connection',
  sshExecuteCommand: 'ssh:execute-command',
  terminalSessionCreate: 'terminal:session-create',
  terminalSessionWrite: 'terminal:session-write',
  terminalSessionResize: 'terminal:session-resize',
  terminalSessionClose: 'terminal:session-close',
  terminalSessionData: 'terminal:session-data',
  terminalSessionExit: 'terminal:session-exit',
  gatewayConnect: 'gateway:connect',
  gatewayRequest: 'gateway:request',
  gatewayConnectionStatus: 'gateway:connection-status',
  gatewayPullEvents: 'gateway:pull-events',
  gatewayListDebugLogs: 'gateway:list-debug-logs',
  gatewayClearDebugLogs: 'gateway:clear-debug-logs',
  gatewayDisconnect: 'gateway:disconnect',
  gatewayRestart: 'gateway:restart',
  localOpenClawDiscover: 'local-openclaw:discover',
  localSkillFileRead: 'local-skill-file:read',
  localSkillFileWrite: 'local-skill-file:write',
  localSkillDeleteCustom: 'local-skill-file:delete-custom',
  localMemoryFilesList: 'local-memory-files:list',
  localMemoryFileRead: 'local-memory-files:read',
  localMemoryFileWrite: 'local-memory-files:write',
  localMemoryFileDelete: 'local-memory-files:delete',
  workspaceImageUpload: 'workspace-image:upload',
  workspaceImageRead: 'workspace-image:read'
} as const

export type SshConnectionTestPayload = {
  title: string
  port: number
  host: string
  username: string
  password: string
  privateKey: string
  privateKeyPassphrase?: string
}

export type SshConnectionTestResult = {
  success: boolean
  message: string
}

export type SshCommandPayload = SshConnectionTestPayload & {
  command: string
}

export type SshCommandResult = {
  success: boolean
  message: string
  stdout: string
  stderr: string
  code: number | null
}

export type OpenClawConnectionType = 'ssh' | 'local'

export type GatewayConnectionConfig = SshConnectionTestPayload & {
  connectionType?: OpenClawConnectionType
  gatewayToken?: string
  gatewayPassword?: string
  gatewayOrigin?: string
  gatewayHost?: string
  gatewayPort?: number
  gatewayPath?: string
}

export type GatewayConnectPayload = {
  instanceId: string
  connection: GatewayConnectionConfig
}

export type GatewayConnectResult = {
  success: boolean
  message: string
  role?: string
  scopes?: string[]
  deviceId?: string
  serverVersion?: string
}

export type GatewayRequestPayload = {
  instanceId: string
  method: string
  params?: unknown
  timeoutMs?: number
}

export type GatewayRequestResult = {
  success: boolean
  message: string
  payload?: unknown
}

export type GatewayConnectionStatusPayload = {
  instanceId: string
}

export type GatewayConnectionStatusResult = {
  success: boolean
  connected: boolean
  message: string
}

export type GatewaySessionEvent = {
  event: string
  payload?: unknown
  seq?: number
  stateVersion?: unknown
  receivedAt: string
}

export type GatewayPullEventsPayload = {
  instanceId: string
  maxEvents?: number
}

export type GatewayPullEventsResult = {
  success: boolean
  message: string
  events: GatewaySessionEvent[]
}

export type GatewayDebugLogLevel = 'info' | 'warn' | 'error'
export type GatewayDebugLogKind = 'event' | 'request' | 'response' | 'system'

export type GatewayDebugLogEntry = {
  id: string
  level: GatewayDebugLogLevel
  kind: GatewayDebugLogKind
  source: string
  message: string
  requestId?: string
  payloadText?: string
  receivedAt: string
}

export type GatewayListDebugLogsPayload = {
  instanceId: string
  limit?: number
}

export type GatewayListDebugLogsResult = {
  success: boolean
  message: string
  logs: GatewayDebugLogEntry[]
}

export type GatewayClearDebugLogsPayload = {
  instanceId: string
}

export type GatewayClearDebugLogsResult = {
  success: boolean
  message: string
  clearedCount: number
}

export type GatewayDisconnectPayload = {
  instanceId: string
}

export type GatewayDisconnectResult = {
  success: boolean
  message: string
}

export type GatewayRestartPayload = {
  instanceId: string
  connection: GatewayConnectionConfig
}

export type GatewayRestartResult = {
  success: boolean
  message: string
  stdout: string
  stderr: string
  code: number | null
}

export type LocalOpenClawDiscoveryPayload = {
  preferMode?: 'token' | 'password'
}

export type LocalOpenClawDiscoveryResult = {
  success: boolean
  message: string
  foundCli: boolean
  foundToken: boolean
  foundPassword: boolean
  selectedAuthMode: 'token' | 'password' | 'none'
  gatewayToken: string
  gatewayPassword: string
  scannedAt: string
}

export type LocalSkillFileReadPayload = {
  filePath: string
}

export type LocalSkillFileReadResult = {
  success: boolean
  message: string
  content: string
}

export type LocalSkillFileWritePayload = {
  filePath: string
  content: string
}

export type LocalSkillFileWriteResult = {
  success: boolean
  message: string
}

export type LocalSkillDeleteCustomPayload = {
  baseDir: string
  filePath: string
}

export type LocalSkillDeleteCustomResult = {
  success: boolean
  message: string
}

export type LocalMemoryFilesListPayload = {
  workspacePath: string
}

export type LocalMemoryFilesListResult = {
  success: boolean
  message: string
  files: string[]
}

export type LocalMemoryFileReadPayload = {
  workspacePath: string
  relativeFilePath: string
}

export type LocalMemoryFileReadResult = {
  success: boolean
  message: string
  found: boolean
  content: string
}

export type LocalMemoryFileWritePayload = {
  workspacePath: string
  relativeFilePath: string
  content: string
}

export type LocalMemoryFileWriteResult = {
  success: boolean
  message: string
}

export type LocalMemoryFileDeletePayload = {
  workspacePath: string
  relativeFilePath: string
}

export type LocalMemoryFileDeleteResult = {
  success: boolean
  message: string
  deleted: boolean
}

export type WorkspaceImageUploadPayload = {
  workspacePath: string
  fileName?: string
  mimeType?: string
  base64Data: string
  connection?: GatewayConnectionConfig
}

export type WorkspaceImageUploadResult = {
  success: boolean
  message: string
  fileName: string
  relativePath: string
  absolutePath: string
}

export type WorkspaceImageReadPayload = {
  absolutePath?: string
  relativePath?: string
  workspacePath?: string
  connection?: GatewayConnectionConfig
}

export type WorkspaceImageReadResult = {
  success: boolean
  message: string
  mimeType: string
  base64Data: string
  absolutePath: string
}

export type TerminalSessionCreatePayload = {
  cwd?: string
  shell?: string
  cols?: number
  rows?: number
}

export type TerminalSessionCreateResult = {
  success: boolean
  message: string
  sessionId: string
  pid: number | null
}

export type TerminalSessionWritePayload = {
  sessionId: string
  data: string
}

export type TerminalSessionResizePayload = {
  sessionId: string
  cols: number
  rows: number
}

export type TerminalSessionClosePayload = {
  sessionId: string
}

export type TerminalSessionActionResult = {
  success: boolean
  message: string
}

export type TerminalSessionDataEvent = {
  sessionId: string
  data: string
}

export type TerminalSessionExitEvent = {
  sessionId: string
  exitCode: number
  signal: number
}

export type AppBridgeApi = {
  testSshConnection: (payload: SshConnectionTestPayload) => Promise<SshConnectionTestResult>
  executeSshCommand: (payload: SshCommandPayload) => Promise<SshCommandResult>
  createTerminalSession: (
    payload: TerminalSessionCreatePayload
  ) => Promise<TerminalSessionCreateResult>
  writeTerminalInput: (payload: TerminalSessionWritePayload) => Promise<TerminalSessionActionResult>
  resizeTerminalSession: (
    payload: TerminalSessionResizePayload
  ) => Promise<TerminalSessionActionResult>
  closeTerminalSession: (
    payload: TerminalSessionClosePayload
  ) => Promise<TerminalSessionActionResult>
  onTerminalData: (listener: (event: TerminalSessionDataEvent) => void) => () => void
  onTerminalExit: (listener: (event: TerminalSessionExitEvent) => void) => () => void
  connectGateway: (payload: GatewayConnectPayload) => Promise<GatewayConnectResult>
  requestGateway: (payload: GatewayRequestPayload) => Promise<GatewayRequestResult>
  getGatewayConnectionStatus: (
    payload: GatewayConnectionStatusPayload
  ) => Promise<GatewayConnectionStatusResult>
  pullGatewayEvents: (payload: GatewayPullEventsPayload) => Promise<GatewayPullEventsResult>
  listGatewayDebugLogs: (
    payload: GatewayListDebugLogsPayload
  ) => Promise<GatewayListDebugLogsResult>
  clearGatewayDebugLogs: (
    payload: GatewayClearDebugLogsPayload
  ) => Promise<GatewayClearDebugLogsResult>
  disconnectGateway: (payload: GatewayDisconnectPayload) => Promise<GatewayDisconnectResult>
  restartGateway: (payload: GatewayRestartPayload) => Promise<GatewayRestartResult>
  discoverLocalOpenClaw: (
    payload: LocalOpenClawDiscoveryPayload
  ) => Promise<LocalOpenClawDiscoveryResult>
  readLocalSkillFile: (payload: LocalSkillFileReadPayload) => Promise<LocalSkillFileReadResult>
  writeLocalSkillFile: (payload: LocalSkillFileWritePayload) => Promise<LocalSkillFileWriteResult>
  deleteLocalCustomSkill: (
    payload: LocalSkillDeleteCustomPayload
  ) => Promise<LocalSkillDeleteCustomResult>
  listLocalMemoryFiles: (
    payload: LocalMemoryFilesListPayload
  ) => Promise<LocalMemoryFilesListResult>
  readLocalMemoryFile: (payload: LocalMemoryFileReadPayload) => Promise<LocalMemoryFileReadResult>
  writeLocalMemoryFile: (
    payload: LocalMemoryFileWritePayload
  ) => Promise<LocalMemoryFileWriteResult>
  deleteLocalMemoryFile: (
    payload: LocalMemoryFileDeletePayload
  ) => Promise<LocalMemoryFileDeleteResult>
  uploadWorkspaceImage: (
    payload: WorkspaceImageUploadPayload
  ) => Promise<WorkspaceImageUploadResult>
  readWorkspaceImage: (payload: WorkspaceImageReadPayload) => Promise<WorkspaceImageReadResult>
}
