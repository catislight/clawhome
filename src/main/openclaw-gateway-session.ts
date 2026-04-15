import type { Server as NetServer } from 'node:net'

import { app } from 'electron'
import { NodeSSH } from 'node-ssh'

import {
  buildDeviceSignaturePayloadCandidates,
  createInsufficientScopeError,
  DEFAULT_OPERATOR_ROLE,
  DEFAULT_OPERATOR_SCOPES,
  getDeviceIdentityFilePath,
  hasRequiredOperatorScopes,
  loadOrCreateDeviceIdentityRecord,
  parseHelloAuthSnapshot,
  persistDeviceToken,
  signDevicePayload,
  toActionableGatewayConnectError,
  type GatewayDeviceIdentityRecord,
  type HelloAuthSnapshot
} from './openclaw-gateway-auth'
import { approveLocalOpenClawPairing } from './local-openclaw-pairing'
import { approveRemoteOpenClawPairing } from './remote-openclaw-pairing'
import type { SshConnectionConfig } from './node-ssh-util'
import {
  buildGatewayOrigin,
  buildGatewayWsUrl,
  DEFAULT_GATEWAY_HOST,
  DEFAULT_GATEWAY_PATH,
  DEFAULT_GATEWAY_PORT,
  listenLocalTunnel,
  normalizeMessageData,
  parseGatewayFrame,
  waitWebSocketOpen,
  type GatewayRequestFrame
} from './openclaw-gateway-transport'

const DEFAULT_PROTOCOL_VERSION = 3
const DEFAULT_REQUEST_TIMEOUT_MS = 15_000
const CONNECT_TIMEOUT_MS = 12_000
const MAX_BUFFERED_EVENTS = 300
const MAX_BUFFERED_DEBUG_LOGS_PER_INSTANCE = 1_200
const MAX_DEBUG_LOG_PAYLOAD_CHARS = 6_000

type PendingRequest = {
  resolve: (payload: unknown) => void
  reject: (error: Error) => void
  timeoutId: ReturnType<typeof setTimeout>
  method: string
}

type ConnectChallengePayload = {
  nonce: string
  ts?: number
}

type RequestedOperatorAccess = {
  role: string
  scopes: string[]
}

type ConnectRequestParams = {
  minProtocol: number
  maxProtocol: number
  client: {
    id: 'gateway-client'
    displayName: string
    version: string
    platform: string
    deviceFamily?: string
    modelIdentifier?: string
    mode: 'ui'
    instanceId: string
  }
  caps?: string[]
  auth?: {
    token?: string
    deviceToken?: string
    password?: string
  }
  role: string
  scopes: string[]
  device?: {
    id: string
    publicKey: string
    signature: string
    signedAt: number
    nonce: string
  }
}

export type GatewayConnectionConfig = SshConnectionConfig & {
  title: string
  connectionType?: 'ssh' | 'local'
  gatewayToken?: string
  gatewayPassword?: string
  gatewayOrigin?: string
  gatewayHost?: string
  gatewayPort?: number
  gatewayPath?: string
}

export type GatewaySessionEvent = {
  event: string
  payload?: unknown
  seq?: number
  stateVersion?: unknown
  receivedAt: string
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

export type GatewayGrantedAuth = {
  role?: string
  scopes: string[]
  deviceId: string
  serverVersion?: string
}

type RemoteGatewaySessionOptions = {
  instanceId: string
  connection: GatewayConnectionConfig
  deviceIdentity: GatewayDeviceIdentityRecord
  deviceIdentityPath: string
  gatewayTokenCacheKey: string
  onClosed: () => void
  onDebugLog: (entry: Omit<GatewayDebugLogEntry, 'id'>) => void
}

type GatewayDebugLogDraft = {
  level: GatewayDebugLogLevel
  kind: GatewayDebugLogKind
  source: string
  message: string
  requestId?: string
  payload?: unknown
  receivedAt?: string
}

class GatewayRequestError extends Error {
  code?: string
  details?: unknown

  constructor(message: string, options?: { code?: string; details?: unknown }) {
    super(message)
    this.name = 'GatewayRequestError'
    this.code = options?.code
    this.details = options?.details
  }
}

class GatewayReconnectRequiredError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'GatewayReconnectRequiredError'
  }
}

function toErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function readTrimmedString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function stringifySafe(value: unknown): string {
  try {
    return JSON.stringify(value)
  } catch {
    return '[unserializable]'
  }
}

function toDebugPayloadText(value: unknown): string | undefined {
  if (value === undefined) {
    return undefined
  }

  const serialized = stringifySafe(value)
  if (serialized.length <= MAX_DEBUG_LOG_PAYLOAD_CHARS) {
    return serialized
  }

  return `${serialized.slice(0, MAX_DEBUG_LOG_PAYLOAD_CHARS)} …[truncated ${serialized.length - MAX_DEBUG_LOG_PAYLOAD_CHARS} chars]`
}

function inferDebugLevelFromEventName(eventName: string): GatewayDebugLogLevel {
  const normalized = eventName.trim().toLowerCase()

  if (normalized.includes('error') || normalized.includes('failed')) {
    return 'error'
  }

  if (normalized.includes('warn') || normalized.includes('timeout') || normalized.includes('aborted')) {
    return 'warn'
  }

  return 'info'
}

function resolveConnectionType(connection: GatewayConnectionConfig): 'ssh' | 'local' {
  return connection.connectionType === 'local' ? 'local' : 'ssh'
}

function createGatewayTokenCacheKey(connection: GatewayConnectionConfig): string {
  const connectionType = resolveConnectionType(connection)
  const sshHost = readTrimmedString(connection.host).toLowerCase()
  const sshPort = connection.port
  const gatewayHost = (readTrimmedString(connection.gatewayHost) || DEFAULT_GATEWAY_HOST).toLowerCase()
  const gatewayPort = connection.gatewayPort ?? DEFAULT_GATEWAY_PORT
  const gatewayPath = readTrimmedString(connection.gatewayPath) || DEFAULT_GATEWAY_PATH
  if (connectionType === 'local') {
    return `local|${gatewayHost}:${gatewayPort}|${gatewayPath}`
  }

  return `${sshHost}:${sshPort}|${gatewayHost}:${gatewayPort}|${gatewayPath}`
}

function buildConnectRequestBase(params: {
  instanceId: string
  authToken?: string
  gatewayPassword?: string
  effectiveDeviceToken?: string
  requestedAccess: RequestedOperatorAccess
}): ConnectRequestParams {
  const request: ConnectRequestParams = {
    minProtocol: DEFAULT_PROTOCOL_VERSION,
    maxProtocol: DEFAULT_PROTOCOL_VERSION,
    client: {
      id: 'gateway-client',
      displayName: 'ClawHome',
      version: app.getVersion(),
      platform: process.platform,
      deviceFamily: 'desktop',
      modelIdentifier: 'electron',
      mode: 'ui',
      instanceId: params.instanceId
    },
    caps: ['tool-events'],
    role: params.requestedAccess.role,
    scopes: [...params.requestedAccess.scopes]
  }

  if (params.authToken || params.effectiveDeviceToken || params.gatewayPassword) {
    request.auth = {
      token: params.authToken,
      deviceToken: params.effectiveDeviceToken,
      password: params.gatewayPassword
    }
  }

  return request
}

function resolveGrantedAuth(params: {
  authSnapshot: HelloAuthSnapshot
  requestedAccess: RequestedOperatorAccess
  deviceId: string
}): GatewayGrantedAuth {
  return {
    role: params.authSnapshot.role ?? params.requestedAccess.role,
    scopes:
      params.authSnapshot.scopes.length > 0
        ? [...params.authSnapshot.scopes]
        : [...params.requestedAccess.scopes],
    deviceId: params.deviceId,
    serverVersion: params.authSnapshot.serverVersion
  }
}

function shouldRetryWithDeviceTokenFallback(error: unknown): boolean {
  if (!(error instanceof GatewayRequestError)) {
    return false
  }

  if (error.code === 'AUTH_TOKEN_MISMATCH') {
    return true
  }

  if (!isObjectRecord(error.details)) {
    return false
  }

  const detailCode = readTrimmedString(error.details.code)
  const authReason = readTrimmedString(error.details.authReason)
  const recommendedNextStep = readTrimmedString(error.details.recommendedNextStep)
  const canRetryWithDeviceToken = error.details.canRetryWithDeviceToken === true

  return (
    canRetryWithDeviceToken ||
    recommendedNextStep === 'retry_with_device_token' ||
    detailCode === 'AUTH_TOKEN_MISMATCH' ||
    authReason === 'token_mismatch'
  )
}

function isPairingRequiredError(error: unknown): boolean {
  if (!(error instanceof GatewayRequestError)) {
    return false
  }

  if (error.code === 'PAIRING_REQUIRED') {
    return true
  }

  if (isObjectRecord(error.details)) {
    const detailCode = readTrimmedString(error.details.code)
    const detailReason = readTrimmedString(error.details.reason)
    if (detailCode === 'PAIRING_REQUIRED' || detailReason === 'not-paired') {
      return true
    }
  }

  return error.message.toLowerCase().includes('pairing required')
}

function readPairingRequestId(error: unknown): string | undefined {
  if (!(error instanceof GatewayRequestError) || !isObjectRecord(error.details)) {
    return undefined
  }

  const requestId = readTrimmedString(error.details.requestId)
  return requestId || undefined
}

function isGatewaySessionUnavailableError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false
  }

  const normalizedMessage = error.message.toLowerCase()
  return (
    normalizedMessage.includes('gateway session already disposed') ||
    normalizedMessage.includes('gateway websocket is not open')
  )
}

class RemoteGatewaySession {
  private readonly instanceId: string
  private readonly gatewayTokenCacheKey: string
  private readonly deviceIdentityPath: string
  private readonly deviceIdentity: GatewayDeviceIdentityRecord
  private readonly ssh: NodeSSH | null
  private readonly tunnelServer: NetServer | null
  private readonly ws: WebSocket
  private readonly onClosed: () => void
  private readonly onDebugLog: (entry: Omit<GatewayDebugLogEntry, 'id'>) => void
  private readonly pendingRequests = new Map<string, PendingRequest>()
  private readonly events: GatewaySessionEvent[] = []
  private readonly connectChallengeWaiters = new Set<{
    resolve: (value: ConnectChallengePayload) => void
    reject: (error: Error) => void
    timeoutId: ReturnType<typeof setTimeout>
  }>()
  private latestConnectChallenge: ConnectChallengePayload | null = null
  private grantedAuth: GatewayGrantedAuth
  private requestSequence = 0
  private disposed = false
  private readonly handleSshConnectionError = (error: Error): void => {
    const message = toErrorMessage(error, 'Gateway SSH tunnel encountered an error.')
    this.events.push({
      event: 'gateway.tunnel.error',
      payload: {
        message
      },
      receivedAt: new Date().toISOString()
    })
    this.emitDebugLog({
      level: 'error',
      kind: 'system',
      source: 'gateway.tunnel.error',
      message: 'SSH 隧道发生错误。',
      payload: {
        message
      }
    })
    this.trimEventQueue()
    this.failPendingRequests(new Error(`Gateway SSH tunnel error: ${message}`))
    void this.dispose()
  }
  private readonly handleSshConnectionClose = (): void => {
    if (this.disposed) {
      return
    }
    this.events.push({
      event: 'gateway.tunnel.closed',
      payload: {
        message: 'Gateway SSH tunnel closed unexpectedly.'
      },
      receivedAt: new Date().toISOString()
    })
    this.emitDebugLog({
      level: 'warn',
      kind: 'system',
      source: 'gateway.tunnel.closed',
      message: 'SSH 隧道异常关闭。'
    })
    this.trimEventQueue()
    this.failPendingRequests(new Error('Gateway SSH tunnel closed unexpectedly.'))
    void this.dispose()
  }

  private constructor(
    instanceId: string,
    gatewayTokenCacheKey: string,
    deviceIdentityPath: string,
    deviceIdentity: GatewayDeviceIdentityRecord,
    ssh: NodeSSH | null,
    tunnelServer: NetServer | null,
    ws: WebSocket,
    onClosed: () => void,
    onDebugLog: (entry: Omit<GatewayDebugLogEntry, 'id'>) => void
  ) {
    this.instanceId = instanceId
    this.gatewayTokenCacheKey = gatewayTokenCacheKey
    this.deviceIdentityPath = deviceIdentityPath
    this.deviceIdentity = deviceIdentity
    this.ssh = ssh
    this.tunnelServer = tunnelServer
    this.ws = ws
    this.onClosed = onClosed
    this.onDebugLog = onDebugLog
    this.grantedAuth = {
      scopes: [],
      deviceId: deviceIdentity.id
    }
    this.bindSocketEvents()
    this.bindSshConnectionEvents()
  }

  static async create(options: RemoteGatewaySessionOptions): Promise<RemoteGatewaySession> {
    const gatewayHost = readTrimmedString(options.connection.gatewayHost) || DEFAULT_GATEWAY_HOST
    const gatewayPort = options.connection.gatewayPort ?? DEFAULT_GATEWAY_PORT
    const gatewayPath = options.connection.gatewayPath
    const origin = buildGatewayOrigin(options.connection.gatewayOrigin, gatewayPort)

    if (resolveConnectionType(options.connection) === 'local') {
      const gatewayUrl = buildGatewayWsUrl(gatewayPort, gatewayPath, gatewayHost)
      const ws = new (WebSocket as unknown as {
        new (url: string, init?: { headers?: Record<string, string> }): WebSocket
      })(gatewayUrl, {
        headers: {
          origin
        }
      })

      const session = new RemoteGatewaySession(
        options.instanceId,
        options.gatewayTokenCacheKey,
        options.deviceIdentityPath,
        options.deviceIdentity,
        null,
        null,
        ws,
        options.onClosed,
        options.onDebugLog
      )

      try {
        await waitWebSocketOpen(ws, CONNECT_TIMEOUT_MS)
        await session.performConnectHandshake(options.connection)
        return session
      } catch (error) {
        try {
          ws.close()
        } catch {
          // no-op
        }
        throw error
      }
    }

    const ssh = new NodeSSH()
    const sshConfig = {
      host: options.connection.host,
      port: options.connection.port,
      username: options.connection.username,
      password: options.connection.password,
      privateKey: options.connection.privateKey,
      passphrase: options.connection.privateKeyPassphrase
    }

    let tunnelServer: NetServer | null = null
    let ws: WebSocket | null = null

    try {
      await ssh.connect(sshConfig)

      const tunnel = await listenLocalTunnel(ssh, gatewayHost, gatewayPort)
      tunnelServer = tunnel.server
      const gatewayUrl = buildGatewayWsUrl(tunnel.localPort, gatewayPath)
      ws = new (WebSocket as unknown as {
        new (url: string, init?: { headers?: Record<string, string> }): WebSocket
      })(gatewayUrl, {
        headers: {
          origin
        }
      })

      const session = new RemoteGatewaySession(
        options.instanceId,
        options.gatewayTokenCacheKey,
        options.deviceIdentityPath,
        options.deviceIdentity,
        ssh,
        tunnelServer,
        ws,
        options.onClosed,
        options.onDebugLog
      )
      await waitWebSocketOpen(ws, CONNECT_TIMEOUT_MS)
      await session.performConnectHandshake(options.connection)
      return session
    } catch (error) {
      try {
        ws?.close()
      } catch {
        // no-op
      }
      try {
        tunnelServer?.close()
      } catch {
        // no-op
      }
      ssh.dispose()
      throw error
    }
  }

  async request(
    method: string,
    params?: unknown,
    timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS
  ): Promise<unknown> {
    if (this.disposed) {
      throw new Error('Gateway session already disposed.')
    }
    if (this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('Gateway websocket is not open.')
    }

    const id = `${method}-${Date.now()}-${this.requestSequence++}`
    const frame: GatewayRequestFrame = {
      type: 'req',
      id,
      method,
      params
    }
    this.emitDebugLog({
      level: 'info',
      kind: 'request',
      source: method,
      message: `发送请求：${method}`,
      requestId: id,
      payload: params
    })

    return new Promise<unknown>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.pendingRequests.delete(id)
        const timeoutError = new Error(`Gateway request timeout: ${method}`)
        this.emitDebugLog({
          level: 'error',
          kind: 'response',
          source: method,
          message: timeoutError.message,
          requestId: id
        })
        reject(timeoutError)
      }, timeoutMs)

      this.pendingRequests.set(id, {
        resolve,
        reject,
        timeoutId,
        method
      })

      try {
        this.ws.send(JSON.stringify(frame))
      } catch (error) {
        clearTimeout(timeoutId)
        this.pendingRequests.delete(id)
        const sendError = new Error(toErrorMessage(error, `Failed to send gateway request: ${method}`))
        this.emitDebugLog({
          level: 'error',
          kind: 'request',
          source: method,
          message: sendError.message,
          requestId: id
        })
        reject(sendError)
      }
    })
  }

  pullEvents(maxEvents: number): GatewaySessionEvent[] {
    const safeMaxEvents = Number.isFinite(maxEvents) ? Math.max(1, Math.floor(maxEvents)) : 50
    return this.events.splice(0, safeMaxEvents)
  }

  isConnected(): boolean {
    return !this.disposed && this.ws.readyState === WebSocket.OPEN
  }

  getGrantedAuth(): GatewayGrantedAuth {
    return {
      role: this.grantedAuth.role,
      scopes: [...this.grantedAuth.scopes],
      deviceId: this.grantedAuth.deviceId,
      serverVersion: this.grantedAuth.serverVersion
    }
  }

  async dispose(): Promise<void> {
    if (this.disposed) {
      return
    }
    this.disposed = true

    const pendingErrors = new Error('Gateway session closed.')
    this.failPendingRequests(pendingErrors)

    for (const waiter of this.connectChallengeWaiters) {
      clearTimeout(waiter.timeoutId)
      waiter.reject(pendingErrors)
    }
    this.connectChallengeWaiters.clear()

    try {
      this.ws.close()
    } catch {
      // no-op
    }

    if (this.tunnelServer) {
      await new Promise<void>((resolve) => {
        this.tunnelServer?.close(() => resolve())
      })
    }
    this.ssh?.dispose()
    this.emitDebugLog({
      level: 'info',
      kind: 'system',
      source: 'gateway.session.dispose',
      message: 'Gateway 会话已释放。'
    })
    this.onClosed()
  }

  private emitDebugLog(entry: GatewayDebugLogDraft): void {
    this.onDebugLog({
      level: entry.level,
      kind: entry.kind,
      source: entry.source,
      message: entry.message,
      requestId: entry.requestId,
      payloadText: toDebugPayloadText(entry.payload),
      receivedAt: entry.receivedAt ?? new Date().toISOString()
    })
  }

  private waitForConnectChallenge(timeoutMs: number): Promise<ConnectChallengePayload> {
    if (this.latestConnectChallenge) {
      return Promise.resolve(this.latestConnectChallenge)
    }

    return new Promise<ConnectChallengePayload>((resolve, reject) => {
      const waiter = {
        resolve: (challenge: ConnectChallengePayload) => {
          this.connectChallengeWaiters.delete(waiter)
          resolve(challenge)
        },
        reject: (error: Error) => {
          this.connectChallengeWaiters.delete(waiter)
          reject(error)
        },
        timeoutId: setTimeout(() => {
          waiter.reject(new Error(`Gateway connect.challenge timeout after ${timeoutMs}ms`))
        }, timeoutMs)
      }

      this.connectChallengeWaiters.add(waiter)
    })
  }

  private async performConnectHandshake(connection: GatewayConnectionConfig): Promise<void> {
    const explicitAuthToken = connection.gatewayToken?.trim() || undefined
    const gatewayPassword = connection.gatewayPassword?.trim() || undefined
    const cachedDeviceToken =
      this.deviceIdentity.deviceTokens[this.gatewayTokenCacheKey]?.trim() || undefined
    const requestedAccess: RequestedOperatorAccess = {
      role: DEFAULT_OPERATOR_ROLE,
      scopes: [...DEFAULT_OPERATOR_SCOPES]
    }
    const challenge = await this.waitForConnectChallenge(CONNECT_TIMEOUT_MS)
    const signedAt = typeof challenge.ts === 'number' ? challenge.ts : Date.now()

    const attemptHandshake = async (params: {
      authToken?: string
      gatewayPassword?: string
      deviceToken?: string
    }): Promise<void> => {
      const connectParamsBase = buildConnectRequestBase({
        instanceId: this.instanceId,
        authToken: params.authToken,
        gatewayPassword: params.gatewayPassword,
        effectiveDeviceToken: params.deviceToken,
        requestedAccess
      })
      const signingToken = params.authToken || params.deviceToken
      const signaturePayloadCandidates = buildDeviceSignaturePayloadCandidates({
        deviceId: this.deviceIdentity.id,
        clientId: connectParamsBase.client.id,
        clientMode: connectParamsBase.client.mode,
        role: requestedAccess.role,
        scopes: requestedAccess.scopes,
        platform: connectParamsBase.client.platform,
        deviceFamily: connectParamsBase.client.deviceFamily ?? 'desktop',
        signedAt,
        signingToken,
        nonce: challenge.nonce
      })

      let lastError: unknown = null
      for (const signaturePayload of signaturePayloadCandidates) {
        const connectParams: ConnectRequestParams = {
          ...connectParamsBase,
          scopes: [...connectParamsBase.scopes],
          device: {
            id: this.deviceIdentity.id,
            publicKey: this.deviceIdentity.publicKey,
            signature: signDevicePayload(this.deviceIdentity.privateKeyPem, signaturePayload),
            signedAt,
            nonce: challenge.nonce
          }
        }

        try {
          const connectResult = await this.request('connect', connectParams, CONNECT_TIMEOUT_MS)
          const authSnapshot = parseHelloAuthSnapshot(connectResult)
          await this.applyAuthSnapshot(authSnapshot, requestedAccess)

          if (!hasRequiredOperatorScopes(this.grantedAuth.scopes)) {
            throw createInsufficientScopeError({
              deviceId: this.deviceIdentity.id,
              scopes: this.grantedAuth.scopes
            })
          }

          return
        } catch (error) {
          lastError = error
          if (
            error instanceof GatewayRequestError &&
            (error.code === 'DEVICE_AUTH_SIGNATURE_INVALID' ||
              error.code === 'DEVICE_AUTH_PUBLIC_KEY_INVALID')
          ) {
            continue
          }
          break
        }
      }

      throw lastError ?? new Error('Gateway connect handshake failed.')
    }

    try {
      await attemptHandshake({
        authToken: explicitAuthToken,
        gatewayPassword,
        deviceToken: explicitAuthToken || gatewayPassword ? undefined : cachedDeviceToken
      })
      return
    } catch (error) {
      let connectError: unknown = error

      const shouldAutoApprovePairing = isPairingRequiredError(connectError)
      if (shouldAutoApprovePairing) {
        const pairingRequestId = readPairingRequestId(connectError)
        if (pairingRequestId) {
          const pairingApprovalResult =
            resolveConnectionType(connection) === 'local'
              ? await approveLocalOpenClawPairing(pairingRequestId)
              : await approveRemoteOpenClawPairing(connection, pairingRequestId)
          if (!pairingApprovalResult.success) {
            connectError = new Error(
              `${toErrorMessage(connectError, '连接失败。')} ${pairingApprovalResult.message}`
            )
          } else {
            if (this.disposed || this.ws.readyState !== WebSocket.OPEN) {
              throw new GatewayReconnectRequiredError('配对已批准，需要重建连接会话。')
            }

            try {
              await attemptHandshake({
                authToken: explicitAuthToken,
                gatewayPassword,
                deviceToken: explicitAuthToken || gatewayPassword ? undefined : cachedDeviceToken
              })
              return
            } catch (retryAfterPairingError) {
              if (isGatewaySessionUnavailableError(retryAfterPairingError)) {
                throw new GatewayReconnectRequiredError('配对已批准，需要重建连接会话。')
              }
              connectError = retryAfterPairingError
            }
          }
        }
      }

      const canRetryWithDeviceToken =
        Boolean(explicitAuthToken && cachedDeviceToken && !gatewayPassword) &&
        shouldRetryWithDeviceTokenFallback(connectError)

      if (canRetryWithDeviceToken) {
        try {
          await attemptHandshake({
            authToken: undefined,
            gatewayPassword: undefined,
            deviceToken: cachedDeviceToken
          })
          return
        } catch (fallbackError) {
          throw toActionableGatewayConnectError(fallbackError, {
            deviceId: this.deviceIdentity.id,
            usingExplicitGatewayCredentials: false
          })
        }
      }

      throw toActionableGatewayConnectError(connectError, {
        deviceId: this.deviceIdentity.id,
        usingExplicitGatewayCredentials: Boolean(explicitAuthToken || gatewayPassword)
      })
    }
  }

  private async applyAuthSnapshot(
    authSnapshot: HelloAuthSnapshot,
    requestedAccess: RequestedOperatorAccess
  ): Promise<void> {
    if (typeof authSnapshot.deviceToken === 'string') {
      await persistDeviceToken(
        this.deviceIdentityPath,
        this.deviceIdentity,
        this.gatewayTokenCacheKey,
        authSnapshot.deviceToken
      )
    }

    this.grantedAuth = resolveGrantedAuth({
      authSnapshot,
      requestedAccess,
      deviceId: this.deviceIdentity.id
    })
  }

  private bindSocketEvents(): void {
    this.ws.addEventListener('message', (event) => {
      void this.handleSocketMessage(event.data)
    })

    this.ws.addEventListener('close', () => {
      this.emitDebugLog({
        level: 'warn',
        kind: 'system',
        source: 'gateway.socket.closed',
        message: 'Gateway WebSocket 已关闭。'
      })
      void this.dispose()
    })

    this.ws.addEventListener('error', () => {
      this.emitDebugLog({
        level: 'error',
        kind: 'system',
        source: 'gateway.socket.error',
        message: 'Gateway WebSocket 发生错误。'
      })
      this.failPendingRequests(new Error('Gateway websocket encountered an error.'))
    })
  }

  private bindSshConnectionEvents(): void {
    if (!this.ssh) {
      return
    }

    const connection = this.ssh.connection
    if (!connection) {
      return
    }
    connection.on('error', this.handleSshConnectionError)
    connection.on('close', this.handleSshConnectionClose)
  }

  private failPendingRequests(error: Error): void {
    for (const [requestId, pending] of this.pendingRequests.entries()) {
      clearTimeout(pending.timeoutId)
      pending.reject(error)
      this.pendingRequests.delete(requestId)
    }
  }

  private async handleSocketMessage(data: unknown): Promise<void> {
    const rawMessage = await normalizeMessageData(data)
    if (!rawMessage) {
      return
    }

    const frame = parseGatewayFrame(rawMessage)
    if (!frame) {
      this.events.push({
        event: 'gateway.frame.parse_error',
        payload: {
          rawMessage
        },
        receivedAt: new Date().toISOString()
      })
      this.emitDebugLog({
        level: 'error',
        kind: 'system',
        source: 'gateway.frame.parse_error',
        message: '解析网关消息失败。',
        payload: {
          rawMessage
        }
      })
      this.trimEventQueue()
      return
    }

    if (frame.type === 'res') {
      const pending = this.pendingRequests.get(frame.id)
      if (!pending) {
        return
      }
      clearTimeout(pending.timeoutId)
      this.pendingRequests.delete(frame.id)

      if (frame.ok) {
        this.emitDebugLog({
          level: 'info',
          kind: 'response',
          source: pending.method,
          message: `请求成功：${pending.method}`,
          requestId: frame.id,
          payload: frame.payload
        })
        pending.resolve(frame.payload)
        return
      }

      const errorMessage =
        frame.error?.message ?? frame.error?.code ?? `Gateway request failed: ${frame.id}`
      const details = frame.error?.details ? ` details=${stringifySafe(frame.error.details)}` : ''
      this.emitDebugLog({
        level: 'error',
        kind: 'response',
        source: pending.method,
        message: errorMessage,
        requestId: frame.id,
        payload: frame.error
      })
      pending.reject(
        new GatewayRequestError(`${errorMessage}${details}`, {
          code: frame.error?.code,
          details: frame.error?.details
        })
      )
      return
    }

    if (frame.type === 'event') {
      if (frame.event === 'connect.challenge') {
        const challengePayload = frame.payload as Partial<ConnectChallengePayload> | undefined
        if (challengePayload && typeof challengePayload.nonce === 'string') {
          const challenge: ConnectChallengePayload = {
            nonce: challengePayload.nonce,
            ts: typeof challengePayload.ts === 'number' ? challengePayload.ts : undefined
          }
          this.latestConnectChallenge = challenge

          for (const waiter of this.connectChallengeWaiters) {
            clearTimeout(waiter.timeoutId)
            waiter.resolve(challenge)
          }
          this.connectChallengeWaiters.clear()
        }
      }

      this.events.push({
        event: frame.event,
        payload: frame.payload,
        seq: frame.seq,
        stateVersion: frame.stateVersion,
        receivedAt: new Date().toISOString()
      })
      this.emitDebugLog({
        level: inferDebugLevelFromEventName(frame.event),
        kind: 'event',
        source: frame.event,
        message: `收到事件：${frame.event}`,
        payload: frame.payload
      })
      this.trimEventQueue()
    }
  }

  private trimEventQueue(): void {
    if (this.events.length <= MAX_BUFFERED_EVENTS) {
      return
    }
    this.events.splice(0, this.events.length - MAX_BUFFERED_EVENTS)
  }
}

export class OpenClawGatewaySessionManager {
  private readonly sessions = new Map<string, RemoteGatewaySession>()
  private readonly debugLogsByInstance = new Map<string, GatewayDebugLogEntry[]>()
  private readonly debugLogSequenceByInstance = new Map<string, number>()

  private appendDebugLog(
    instanceId: string,
    entry: Omit<GatewayDebugLogEntry, 'id' | 'receivedAt'> & { receivedAt?: string }
  ): void {
    const currentLogs = this.debugLogsByInstance.get(instanceId) ?? []
    const nextSequence = this.debugLogSequenceByInstance.get(instanceId) ?? 0
    this.debugLogSequenceByInstance.set(instanceId, nextSequence + 1)

    currentLogs.push({
      id: `${instanceId}:${Date.now()}:${nextSequence}`,
      level: entry.level,
      kind: entry.kind,
      source: entry.source,
      message: entry.message,
      requestId: entry.requestId,
      payloadText: entry.payloadText,
      receivedAt: entry.receivedAt ?? new Date().toISOString()
    })

    if (currentLogs.length > MAX_BUFFERED_DEBUG_LOGS_PER_INSTANCE) {
      currentLogs.splice(0, currentLogs.length - MAX_BUFFERED_DEBUG_LOGS_PER_INSTANCE)
    }

    this.debugLogsByInstance.set(instanceId, currentLogs)
  }

  async connect(
    instanceId: string,
    connection: GatewayConnectionConfig
  ): Promise<GatewayGrantedAuth> {
    this.appendDebugLog(instanceId, {
      level: 'info',
      kind: 'system',
      source: 'gateway.connect',
      message: '开始连接 Gateway。',
      receivedAt: new Date().toISOString()
    })
    await this.disconnect(instanceId)

    const deviceIdentityPath = getDeviceIdentityFilePath()
    const deviceIdentity = await loadOrCreateDeviceIdentityRecord(deviceIdentityPath)
    const gatewayTokenCacheKey = createGatewayTokenCacheKey(connection)

    const createSession = async (): Promise<RemoteGatewaySession> =>
      RemoteGatewaySession.create({
        instanceId,
        connection,
        deviceIdentity,
        deviceIdentityPath,
        gatewayTokenCacheKey,
        onClosed: () => {
          this.sessions.delete(instanceId)
        },
        onDebugLog: (entry) => {
          this.appendDebugLog(instanceId, entry)
        }
      })

    let session: RemoteGatewaySession
    try {
      session = await createSession()
    } catch (error) {
      const shouldRetryReconnect = error instanceof GatewayReconnectRequiredError

      if (!shouldRetryReconnect) {
        this.appendDebugLog(instanceId, {
          level: 'error',
          kind: 'system',
          source: 'gateway.connect',
          message: toErrorMessage(error, 'Gateway 连接失败。'),
          payloadText: toDebugPayloadText(error)
        })
        throw error
      }

      session = await createSession()
    }

    this.sessions.set(instanceId, session)
    const grantedAuth = session.getGrantedAuth()
    this.appendDebugLog(instanceId, {
      level: 'info',
      kind: 'system',
      source: 'gateway.connect',
      message: `Gateway 连接成功（role: ${grantedAuth.role ?? 'unknown'}）。`,
      payloadText: toDebugPayloadText({
        role: grantedAuth.role,
        scopes: grantedAuth.scopes,
        deviceId: grantedAuth.deviceId,
        serverVersion: grantedAuth.serverVersion
      })
    })

    return grantedAuth
  }

  async request(
    instanceId: string,
    method: string,
    params?: unknown,
    timeoutMs?: number
  ): Promise<unknown> {
    const session = this.sessions.get(instanceId)
    if (!session) {
      this.appendDebugLog(instanceId, {
        level: 'error',
        kind: 'system',
        source: 'gateway.request',
        message: `请求失败：${method}，当前实例未连接 Gateway。`,
        payloadText: toDebugPayloadText(params),
        receivedAt: new Date().toISOString()
      })
      throw new Error('Gateway session is not connected.')
    }

    return session.request(method, params, timeoutMs)
  }

  pullEvents(instanceId: string, maxEvents = 50): GatewaySessionEvent[] {
    const session = this.sessions.get(instanceId)
    if (!session) {
      return []
    }
    return session.pullEvents(maxEvents)
  }

  getConnectionStatus(instanceId: string): { connected: boolean } {
    const session = this.sessions.get(instanceId)
    if (!session) {
      return {
        connected: false
      }
    }

    return {
      connected: session.isConnected()
    }
  }

  async disconnect(instanceId: string): Promise<void> {
    const existing = this.sessions.get(instanceId)
    if (!existing) {
      return
    }
    this.sessions.delete(instanceId)
    this.appendDebugLog(instanceId, {
      level: 'info',
      kind: 'system',
      source: 'gateway.disconnect',
      message: '主动断开 Gateway 连接。',
      receivedAt: new Date().toISOString()
    })
    await existing.dispose()
  }

  listDebugLogs(instanceId: string, limit = 300): GatewayDebugLogEntry[] {
    const currentLogs = this.debugLogsByInstance.get(instanceId) ?? []
    const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.floor(limit)) : 300

    if (currentLogs.length <= safeLimit) {
      return [...currentLogs]
    }

    return currentLogs.slice(currentLogs.length - safeLimit)
  }

  clearDebugLogs(instanceId: string): number {
    const currentLogs = this.debugLogsByInstance.get(instanceId) ?? []
    const clearedCount = currentLogs.length

    this.debugLogsByInstance.set(instanceId, [])

    return clearedCount
  }

  async disposeAll(): Promise<void> {
    const instanceIds = Array.from(this.sessions.keys())
    await Promise.all(instanceIds.map((instanceId) => this.disconnect(instanceId)))
  }
}
