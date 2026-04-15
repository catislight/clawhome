/**
 * Renderer 侧访问 preload 暴露 API 的最薄封装。
 *
 * 设计目标：
 * 1. 把 window.api 的可用性判断集中在一处，避免业务层重复判空。
 * 2. 在 preload 尚未更新或注入失败时，统一抛出可读错误信息，便于定位问题。
 * 3. 保持函数签名和 bridge-contract 完全一致，减少跨层类型漂移。
 */
type AppBridgeApi = Window['api']
type AppBridgeMethodName = keyof AppBridgeApi

/**
 * 每个 bridge 方法缺失时的统一提示文案。
 * 维护建议：新增/删除 bridge 方法时，请同步更新这里，保证错误提示可读。
 */
const APP_API_UNAVAILABLE_MESSAGES: Record<AppBridgeMethodName, string> = {
  testSshConnection: 'testSshConnection 不可用，请重启 Electron 开发进程后重试。',
  executeSshCommand: 'executeSshCommand 不可用，请重启 Electron 开发进程使 preload 更新生效。',
  createTerminalSession:
    'createTerminalSession 不可用，请重启 Electron 开发进程使 preload 更新生效。',
  writeTerminalInput: 'writeTerminalInput 不可用，请重启 Electron 开发进程使 preload 更新生效。',
  resizeTerminalSession:
    'resizeTerminalSession 不可用，请重启 Electron 开发进程使 preload 更新生效。',
  closeTerminalSession:
    'closeTerminalSession 不可用，请重启 Electron 开发进程使 preload 更新生效。',
  onTerminalData: 'onTerminalData 不可用，请重启 Electron 开发进程使 preload 更新生效。',
  onTerminalExit: 'onTerminalExit 不可用，请重启 Electron 开发进程使 preload 更新生效。',
  connectGateway: 'connectGateway 不可用，请重启 Electron 开发进程后重试。',
  requestGateway: 'requestGateway 不可用，请重启 Electron 开发进程后重试。',
  getGatewayConnectionStatus: 'getGatewayConnectionStatus 不可用，请重启 Electron 开发进程后重试。',
  pullGatewayEvents: 'pullGatewayEvents 不可用，请重启 Electron 开发进程后重试。',
  listGatewayDebugLogs: 'listGatewayDebugLogs 不可用，请重启 Electron 开发进程后重试。',
  clearGatewayDebugLogs: 'clearGatewayDebugLogs 不可用，请重启 Electron 开发进程后重试。',
  disconnectGateway: 'disconnectGateway 不可用，请重启 Electron 开发进程后重试。',
  restartGateway: 'restartGateway 不可用，请重启 Electron 开发进程后重试。',
  discoverLocalOpenClaw: 'discoverLocalOpenClaw 不可用，请重启 Electron 开发进程后重试。',
  readLocalSkillFile: 'readLocalSkillFile 不可用，请重启 Electron 开发进程后重试。',
  writeLocalSkillFile: 'writeLocalSkillFile 不可用，请重启 Electron 开发进程后重试。',
  deleteLocalCustomSkill: 'deleteLocalCustomSkill 不可用，请重启 Electron 开发进程后重试。',
  listLocalMemoryFiles: 'listLocalMemoryFiles 不可用，请重启 Electron 开发进程后重试。',
  readLocalMemoryFile: 'readLocalMemoryFile 不可用，请重启 Electron 开发进程后重试。',
  writeLocalMemoryFile: 'writeLocalMemoryFile 不可用，请重启 Electron 开发进程后重试。',
  deleteLocalMemoryFile: 'deleteLocalMemoryFile 不可用，请重启 Electron 开发进程后重试。',
  uploadWorkspaceImage: 'uploadWorkspaceImage 不可用，请重启 Electron 开发进程后重试。',
  readWorkspaceImage: 'readWorkspaceImage 不可用，请重启 Electron 开发进程后重试。'
}

function getAppBridge(): Partial<AppBridgeApi> | null {
  return typeof window === 'undefined'
    ? null
    : ((window.api as Partial<AppBridgeApi> | undefined) ?? null)
}

/**
 * 返回某个 bridge 方法不可用时的人类可读错误消息。
 */
export function getAppApiUnavailableMessage(methodName: AppBridgeMethodName): string {
  return APP_API_UNAVAILABLE_MESSAGES[methodName]
}

/**
 * 非抛错检测：用于“能力探测/兜底逻辑”，例如可选轮询能力判断。
 */
export function hasAppApiMethod(methodName: AppBridgeMethodName): boolean {
  const bridge = getAppBridge()
  return typeof bridge?.[methodName] === 'function'
}

/**
 * 强约束获取方法：方法不存在时直接抛错。
 * 适用于“该能力必须存在”的主链路 API。
 */
function requireAppApiMethod<MethodName extends AppBridgeMethodName>(
  methodName: MethodName
): AppBridgeApi[MethodName] {
  const bridge = getAppBridge()
  const method = bridge?.[methodName]

  if (typeof method !== 'function') {
    throw new Error(getAppApiUnavailableMessage(methodName))
  }

  return method as AppBridgeApi[MethodName]
}

/**
 * 下列导出函数都是纯转发：
 * - 保留原始参数和返回值类型
 * - 统一经过 requireAppApiMethod 做可用性守卫
 *
 * 好处：业务层只需要调用 typed wrapper，不需要关心 window.api 判空细节。
 */
export function testSshConnection(
  ...args: Parameters<AppBridgeApi['testSshConnection']>
): ReturnType<AppBridgeApi['testSshConnection']> {
  return requireAppApiMethod('testSshConnection')(...args)
}

export function executeSshCommand(
  ...args: Parameters<AppBridgeApi['executeSshCommand']>
): ReturnType<AppBridgeApi['executeSshCommand']> {
  return requireAppApiMethod('executeSshCommand')(...args)
}

export function createTerminalSession(
  ...args: Parameters<AppBridgeApi['createTerminalSession']>
): ReturnType<AppBridgeApi['createTerminalSession']> {
  return requireAppApiMethod('createTerminalSession')(...args)
}

export function writeTerminalInput(
  ...args: Parameters<AppBridgeApi['writeTerminalInput']>
): ReturnType<AppBridgeApi['writeTerminalInput']> {
  return requireAppApiMethod('writeTerminalInput')(...args)
}

export function resizeTerminalSession(
  ...args: Parameters<AppBridgeApi['resizeTerminalSession']>
): ReturnType<AppBridgeApi['resizeTerminalSession']> {
  return requireAppApiMethod('resizeTerminalSession')(...args)
}

export function closeTerminalSession(
  ...args: Parameters<AppBridgeApi['closeTerminalSession']>
): ReturnType<AppBridgeApi['closeTerminalSession']> {
  return requireAppApiMethod('closeTerminalSession')(...args)
}

export function onTerminalData(
  ...args: Parameters<AppBridgeApi['onTerminalData']>
): ReturnType<AppBridgeApi['onTerminalData']> {
  return requireAppApiMethod('onTerminalData')(...args)
}

export function onTerminalExit(
  ...args: Parameters<AppBridgeApi['onTerminalExit']>
): ReturnType<AppBridgeApi['onTerminalExit']> {
  return requireAppApiMethod('onTerminalExit')(...args)
}

export function connectGateway(
  ...args: Parameters<AppBridgeApi['connectGateway']>
): ReturnType<AppBridgeApi['connectGateway']> {
  return requireAppApiMethod('connectGateway')(...args)
}

export function requestGateway(
  ...args: Parameters<AppBridgeApi['requestGateway']>
): ReturnType<AppBridgeApi['requestGateway']> {
  return requireAppApiMethod('requestGateway')(...args)
}

export function getGatewayConnectionStatus(
  ...args: Parameters<AppBridgeApi['getGatewayConnectionStatus']>
): ReturnType<AppBridgeApi['getGatewayConnectionStatus']> {
  return requireAppApiMethod('getGatewayConnectionStatus')(...args)
}

export function pullGatewayEvents(
  ...args: Parameters<AppBridgeApi['pullGatewayEvents']>
): ReturnType<AppBridgeApi['pullGatewayEvents']> {
  return requireAppApiMethod('pullGatewayEvents')(...args)
}

export function listGatewayDebugLogs(
  ...args: Parameters<AppBridgeApi['listGatewayDebugLogs']>
): ReturnType<AppBridgeApi['listGatewayDebugLogs']> {
  return requireAppApiMethod('listGatewayDebugLogs')(...args)
}

export function clearGatewayDebugLogs(
  ...args: Parameters<AppBridgeApi['clearGatewayDebugLogs']>
): ReturnType<AppBridgeApi['clearGatewayDebugLogs']> {
  return requireAppApiMethod('clearGatewayDebugLogs')(...args)
}

export function disconnectGateway(
  ...args: Parameters<AppBridgeApi['disconnectGateway']>
): ReturnType<AppBridgeApi['disconnectGateway']> {
  return requireAppApiMethod('disconnectGateway')(...args)
}

export function restartGateway(
  ...args: Parameters<AppBridgeApi['restartGateway']>
): ReturnType<AppBridgeApi['restartGateway']> {
  return requireAppApiMethod('restartGateway')(...args)
}

export function discoverLocalOpenClaw(
  ...args: Parameters<AppBridgeApi['discoverLocalOpenClaw']>
): ReturnType<AppBridgeApi['discoverLocalOpenClaw']> {
  return requireAppApiMethod('discoverLocalOpenClaw')(...args)
}

export function readLocalSkillFile(
  ...args: Parameters<AppBridgeApi['readLocalSkillFile']>
): ReturnType<AppBridgeApi['readLocalSkillFile']> {
  return requireAppApiMethod('readLocalSkillFile')(...args)
}

export function writeLocalSkillFile(
  ...args: Parameters<AppBridgeApi['writeLocalSkillFile']>
): ReturnType<AppBridgeApi['writeLocalSkillFile']> {
  return requireAppApiMethod('writeLocalSkillFile')(...args)
}

export function deleteLocalCustomSkill(
  ...args: Parameters<AppBridgeApi['deleteLocalCustomSkill']>
): ReturnType<AppBridgeApi['deleteLocalCustomSkill']> {
  return requireAppApiMethod('deleteLocalCustomSkill')(...args)
}

export function listLocalMemoryFiles(
  ...args: Parameters<AppBridgeApi['listLocalMemoryFiles']>
): ReturnType<AppBridgeApi['listLocalMemoryFiles']> {
  return requireAppApiMethod('listLocalMemoryFiles')(...args)
}

export function readLocalMemoryFile(
  ...args: Parameters<AppBridgeApi['readLocalMemoryFile']>
): ReturnType<AppBridgeApi['readLocalMemoryFile']> {
  return requireAppApiMethod('readLocalMemoryFile')(...args)
}

export function writeLocalMemoryFile(
  ...args: Parameters<AppBridgeApi['writeLocalMemoryFile']>
): ReturnType<AppBridgeApi['writeLocalMemoryFile']> {
  return requireAppApiMethod('writeLocalMemoryFile')(...args)
}

export function deleteLocalMemoryFile(
  ...args: Parameters<AppBridgeApi['deleteLocalMemoryFile']>
): ReturnType<AppBridgeApi['deleteLocalMemoryFile']> {
  return requireAppApiMethod('deleteLocalMemoryFile')(...args)
}

export function uploadWorkspaceImage(
  ...args: Parameters<AppBridgeApi['uploadWorkspaceImage']>
): ReturnType<AppBridgeApi['uploadWorkspaceImage']> {
  return requireAppApiMethod('uploadWorkspaceImage')(...args)
}

export function readWorkspaceImage(
  ...args: Parameters<AppBridgeApi['readWorkspaceImage']>
): ReturnType<AppBridgeApi['readWorkspaceImage']> {
  return requireAppApiMethod('readWorkspaceImage')(...args)
}
