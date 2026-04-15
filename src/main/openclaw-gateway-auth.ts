import {
  createHash,
  createPrivateKey,
  generateKeyPairSync,
  sign as signWithPrivateKey
} from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { app } from 'electron'

const DEVICE_IDENTITY_FILENAME = 'openclaw-gateway-device.json'
const LEGACY_OPERATOR_SCOPES = ['operator.read', 'operator.write'] as const

export const DEFAULT_OPERATOR_ROLE = 'operator'
export const OPERATOR_ADMIN_SCOPE = 'operator.admin'
export const DEFAULT_OPERATOR_SCOPES = [OPERATOR_ADMIN_SCOPE] as const

export type GatewayDeviceIdentityRecord = {
  id: string
  publicKey: string
  privateKeyPem: string
  deviceTokens: Record<string, string>
  createdAt: string
  updatedAt: string
}

export type HelloAuthSnapshot = {
  role?: string
  scopes: string[]
  deviceToken?: string
  serverVersion?: string
}

type DeviceSignaturePayloadParams = {
  deviceId: string
  clientId: string
  clientMode: string
  role: string
  scopes: string[]
  platform: string
  deviceFamily: string
  signedAt: number
  signingToken?: string
  nonce: string
}

function toBase64Url(value: Buffer | string): string {
  const raw = Buffer.isBuffer(value)
    ? value.toString('base64')
    : Buffer.from(value, 'utf8').toString('base64')
  return raw.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function fromBase64Url(value: string): Buffer {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
  const padded = normalized + '='.repeat((4 - (normalized.length % 4 || 4)) % 4)
  return Buffer.from(padded, 'base64')
}

export function getDeviceIdentityFilePath(): string {
  return path.join(app.getPath('userData'), DEVICE_IDENTITY_FILENAME)
}

function createDeviceIdentityRecord(): GatewayDeviceIdentityRecord {
  const keyPair = generateKeyPairSync('ed25519')
  const exportedPublicJwk = keyPair.publicKey.export({
    format: 'jwk'
  }) as { x?: string }

  if (!exportedPublicJwk.x) {
    throw new Error('Failed to generate gateway device public key.')
  }

  const publicKeyBytes = fromBase64Url(exportedPublicJwk.x)
  const id = createHash('sha256').update(publicKeyBytes).digest('hex')
  const now = new Date().toISOString()

  return {
    id,
    publicKey: toBase64Url(publicKeyBytes),
    privateKeyPem: keyPair.privateKey.export({
      type: 'pkcs8',
      format: 'pem'
    }) as string,
    deviceTokens: {},
    createdAt: now,
    updatedAt: now
  }
}

function isGatewayDeviceIdentityRecord(value: unknown): value is GatewayDeviceIdentityRecord {
  if (!value || typeof value !== 'object') {
    return false
  }

  const record = value as Partial<GatewayDeviceIdentityRecord>
  return (
    typeof record.id === 'string' &&
    record.id.trim().length > 0 &&
    typeof record.publicKey === 'string' &&
    record.publicKey.trim().length > 0 &&
    typeof record.privateKeyPem === 'string' &&
    record.privateKeyPem.trim().length > 0 &&
    !!record.deviceTokens &&
    typeof record.deviceTokens === 'object'
  )
}

async function writeDeviceIdentityRecord(
  filePath: string,
  record: GatewayDeviceIdentityRecord
): Promise<void> {
  await mkdir(path.dirname(filePath), {
    recursive: true
  })
  await writeFile(filePath, JSON.stringify(record, null, 2), {
    encoding: 'utf8',
    mode: 0o600
  })
}

export async function loadOrCreateDeviceIdentityRecord(
  filePath: string
): Promise<GatewayDeviceIdentityRecord> {
  try {
    const raw = await readFile(filePath, 'utf8')
    const parsed = JSON.parse(raw) as unknown
    if (isGatewayDeviceIdentityRecord(parsed)) {
      return {
        ...parsed,
        deviceTokens: { ...parsed.deviceTokens }
      }
    }
  } catch {
    // Create a new identity record below.
  }

  const created = createDeviceIdentityRecord()
  await writeDeviceIdentityRecord(filePath, created)
  return created
}

export async function persistDeviceToken(
  filePath: string,
  identity: GatewayDeviceIdentityRecord,
  gatewayTokenCacheKey: string,
  nextToken: string
): Promise<void> {
  const normalizedToken = nextToken.trim()
  if (!normalizedToken || identity.deviceTokens[gatewayTokenCacheKey] === normalizedToken) {
    return
  }

  identity.deviceTokens[gatewayTokenCacheKey] = normalizedToken
  identity.updatedAt = new Date().toISOString()
  await writeDeviceIdentityRecord(filePath, identity)
}

export function buildDeviceSignaturePayloadCandidates(
  params: DeviceSignaturePayloadParams
): string[] {
  const scopePart = params.scopes.join(',')
  const tokenPart = params.signingToken ?? ''

  // Current upstream gateway verifies v3 first and retains v2 compatibility.
  return [
    [
      'v3',
      params.deviceId,
      params.clientId,
      params.clientMode,
      params.role,
      scopePart,
      String(params.signedAt),
      tokenPart,
      params.nonce,
      params.platform,
      params.deviceFamily
    ].join('|'),
    [
      'v2',
      params.deviceId,
      params.clientId,
      params.clientMode,
      params.role,
      scopePart,
      String(params.signedAt),
      tokenPart,
      params.nonce
    ].join('|')
  ]
}

export function signDevicePayload(privateKeyPem: string, payload: string): string {
  const privateKey = createPrivateKey(privateKeyPem)
  const signature = signWithPrivateKey(null, Buffer.from(payload, 'utf8'), privateKey)
  return toBase64Url(signature)
}

export function parseHelloAuthSnapshot(connectResult: unknown): HelloAuthSnapshot {
  if (!connectResult || typeof connectResult !== 'object') {
    throw new Error('Gateway connect succeeded but hello payload is missing.')
  }

  const resultRecord = connectResult as {
    auth?: unknown
    server?: unknown
  }
  const authValue = resultRecord.auth
  if (!authValue || typeof authValue !== 'object') {
    return {
      scopes: [],
      serverVersion:
        resultRecord.server && typeof resultRecord.server === 'object'
          ? typeof (resultRecord.server as { version?: unknown }).version === 'string'
            ? (resultRecord.server as { version: string }).version.trim() || undefined
            : undefined
          : undefined
    }
  }

  const auth = authValue as {
    role?: unknown
    scopes?: unknown
    deviceToken?: unknown
  }

  return {
    role: typeof auth.role === 'string' ? auth.role : undefined,
    scopes: Array.isArray(auth.scopes)
      ? auth.scopes.filter((scope): scope is string => typeof scope === 'string')
      : [],
    deviceToken: typeof auth.deviceToken === 'string' ? auth.deviceToken : undefined,
    serverVersion:
      resultRecord.server && typeof resultRecord.server === 'object'
        ? typeof (resultRecord.server as { version?: unknown }).version === 'string'
          ? (resultRecord.server as { version: string }).version.trim() || undefined
          : undefined
        : undefined
  }
}

export function listGrantedScopes(scopes: string[]): string {
  return scopes.join(',') || '(none)'
}

export function hasRequiredOperatorScopes(scopes: string[]): boolean {
  const normalizedScopes = new Set(
    scopes.map((scope) => scope.trim()).filter((scope) => scope.length > 0)
  )

  return (
    normalizedScopes.has(OPERATOR_ADMIN_SCOPE) ||
    LEGACY_OPERATOR_SCOPES.every((scope) => normalizedScopes.has(scope))
  )
}

function describeRequiredOperatorScopes(): string {
  return `${OPERATOR_ADMIN_SCOPE}（或兼容旧版 ${LEGACY_OPERATOR_SCOPES.join('/')}）`
}

function extractMissingScope(message: string): string | null {
  const match = message.match(/missing scope:\s*([a-z0-9._:-]+)/i)
  return match?.[1]?.trim() || null
}

export function createInsufficientScopeError(params: {
  deviceId: string
  scopes: string[]
}): Error {
  return new Error(
    `连接已建立，但当前凭证未获得操作权限（当前 scopes: ${listGrantedScopes(params.scopes)}）。` +
      `请在服务器上为 device=${params.deviceId} 配对并授予 ${describeRequiredOperatorScopes()}。`
  )
}

export function toActionableGatewayConnectError(
  error: unknown,
  params: {
    deviceId: string
    usingExplicitGatewayCredentials: boolean
  }
): Error {
  const message = error instanceof Error ? error.message : ''
  const missingScope = message ? extractMissingScope(message) : null
  if (!missingScope) {
    return error instanceof Error ? error : new Error('Gateway 连接失败。')
  }

  const remediation = params.usingExplicitGatewayCredentials
    ? `请检查当前 Gateway Token / Password 是否具有 ${missingScope}。`
    : `请在服务器端为 device=${params.deviceId} 重新配对并授予 ${missingScope}。`

  return new Error(
    `SSH 隧道已建立，但 Gateway 鉴权被拒绝：当前凭证缺少 ${missingScope}。${remediation}`
  )
}
