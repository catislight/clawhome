import type { ElectronAPI } from '@electron-toolkit/preload'

import type { AppBridgeApi } from './bridge-contract'

export type {
  AppBridgeApi,
  GatewayConnectionConfig,
  GatewayConnectPayload,
  GatewayConnectResult,
  GatewayConnectionStatusPayload,
  GatewayConnectionStatusResult,
  GatewayDebugLogEntry,
  GatewayDebugLogKind,
  GatewayDebugLogLevel,
  GatewayListDebugLogsPayload,
  GatewayListDebugLogsResult,
  GatewayClearDebugLogsPayload,
  GatewayClearDebugLogsResult,
  GatewayDisconnectPayload,
  GatewayDisconnectResult,
  GatewayRestartPayload,
  GatewayRestartResult,
  GatewayPullEventsPayload,
  GatewayPullEventsResult,
  GatewayRequestPayload,
  GatewayRequestResult,
  GatewaySessionEvent,
  LocalSkillDeleteCustomPayload,
  LocalSkillDeleteCustomResult,
  LocalMemoryFileReadPayload,
  LocalMemoryFileReadResult,
  LocalMemoryFileDeletePayload,
  LocalMemoryFileDeleteResult,
  LocalMemoryFilesListPayload,
  LocalMemoryFilesListResult,
  LocalMemoryFileWritePayload,
  LocalMemoryFileWriteResult,
  LocalOpenClawDiscoveryPayload,
  LocalOpenClawDiscoveryResult,
  LocalSkillFileReadPayload,
  LocalSkillFileReadResult,
  LocalSkillFileWritePayload,
  LocalSkillFileWriteResult,
  OpenClawConnectionType,
  WorkspaceImageUploadPayload,
  WorkspaceImageReadPayload,
  WorkspaceImageReadResult,
  WorkspaceImageUploadResult,
  TerminalSessionCreatePayload,
  TerminalSessionCreateResult,
  TerminalSessionWritePayload,
  TerminalSessionResizePayload,
  TerminalSessionClosePayload,
  TerminalSessionActionResult,
  TerminalSessionDataEvent,
  TerminalSessionExitEvent,
  SshCommandPayload,
  SshCommandResult,
  SshConnectionTestPayload,
  SshConnectionTestResult
} from './bridge-contract'

declare global {
  interface Window {
    electron: ElectronAPI
    api: AppBridgeApi
  }
}
