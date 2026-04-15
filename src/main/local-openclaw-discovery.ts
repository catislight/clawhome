import { readFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

type OpenClawAuthMode = 'token' | 'password' | 'none'

export type LocalOpenClawDiscoveryPayload = {
  preferMode?: 'token' | 'password'
}

export type LocalOpenClawDiscoveryResult = {
  success: boolean
  message: string
  foundCli: boolean
  foundToken: boolean
  foundPassword: boolean
  selectedAuthMode: OpenClawAuthMode
  gatewayToken: string
  gatewayPassword: string
  scannedAt: string
}

type LocalOpenClawConfigSnapshot = {
  sourcePath: string
  mode: string
  token: string
  password: string
}

type OpenClawConfigShape = {
  gateway?: {
    auth?: {
      mode?: unknown
      token?: unknown
      password?: unknown
    }
    token?: unknown
  }
}

function readTrimmedString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function isRedactedTokenLike(value: string): boolean {
  const lowered = value.toLowerCase()
  if (
    lowered === '__openclaw_redacted__' ||
    lowered === '__redacted__' ||
    lowered === '<redacted>' ||
    lowered === '[redacted]' ||
    lowered === '(redacted)'
  ) {
    return true
  }

  return /^\*{4,}$/.test(value)
}

function normalizeConfigValue(rawValue: string): string {
  const trimmedValue = rawValue.trim()
  if (!trimmedValue) {
    return ''
  }

  const strippedQuotes =
    (trimmedValue.startsWith('"') && trimmedValue.endsWith('"')) ||
    (trimmedValue.startsWith("'") && trimmedValue.endsWith("'"))
      ? trimmedValue.slice(1, -1).trim()
      : trimmedValue

  const lowered = strippedQuotes.toLowerCase()
  if (
    lowered === 'null' ||
    lowered === 'undefined' ||
    lowered === '(not set)' ||
    lowered === 'not set' ||
    isRedactedTokenLike(strippedQuotes)
  ) {
    return ''
  }

  return strippedQuotes
}

function extractConfiguredSecretValue(value: unknown): string {
  if (typeof value === 'string') {
    return normalizeConfigValue(value)
  }

  if (!isObjectRecord(value)) {
    return ''
  }

  const valueCandidate = readTrimmedString(value.value)
  if (valueCandidate) {
    return normalizeConfigValue(valueCandidate)
  }

  const literalCandidate = readTrimmedString(value.literal)
  if (literalCandidate) {
    return normalizeConfigValue(literalCandidate)
  }

  return ''
}

function readGatewayAuthSnapshot(config: OpenClawConfigShape): Omit<LocalOpenClawConfigSnapshot, 'sourcePath'> {
  const auth = isObjectRecord(config.gateway?.auth) ? config.gateway.auth : {}
  const mode = normalizeConfigValue(readTrimmedString(auth.mode)).toLowerCase()

  const token =
    extractConfiguredSecretValue(auth.token) || extractConfiguredSecretValue(config.gateway?.token)
  const password = extractConfiguredSecretValue(auth.password)

  return {
    mode,
    token,
    password
  }
}

function resolveConfigPathCandidates(): string[] {
  const explicitConfigPaths = [process.env.OPENCLAW_CONFIG_PATH, process.env.CLAWDBOT_CONFIG_PATH]
    .map((value) => readTrimmedString(value))
    .filter((value) => value.length > 0)

  const stateDirPaths = [process.env.OPENCLAW_STATE_DIR, process.env.CLAWDBOT_STATE_DIR]
    .map((value) => readTrimmedString(value))
    .filter((value) => value.length > 0)
    .map((stateDir) => path.join(stateDir, 'openclaw.json'))

  const homeDir = os.homedir()
  const defaultPaths = [
    path.join(homeDir, '.openclaw', 'openclaw.json'),
    path.join(homeDir, '.clawdbot', 'openclaw.json'),
    path.join(homeDir, '.moldbot', 'openclaw.json'),
    path.join(homeDir, '.moltbot', 'openclaw.json')
  ]

  const deduped = new Set<string>()
  for (const currentPath of [...explicitConfigPaths, ...stateDirPaths, ...defaultPaths]) {
    const normalizedPath = currentPath.trim()
    if (normalizedPath) {
      deduped.add(normalizedPath)
    }
  }

  return Array.from(deduped)
}

async function readLocalOpenClawConfigSnapshot(): Promise<LocalOpenClawConfigSnapshot | null> {
  const configPathCandidates = resolveConfigPathCandidates()

  for (const configPath of configPathCandidates) {
    try {
      const rawContent = await readFile(configPath, 'utf8')
      const parsed = JSON.parse(rawContent) as OpenClawConfigShape
      const snapshot = readGatewayAuthSnapshot(parsed)
      return {
        sourcePath: configPath,
        ...snapshot
      }
    } catch {
      // Keep scanning candidates.
    }
  }

  return null
}

function selectOpenClawAuthMode(params: {
  preferMode?: 'token' | 'password'
  configuredMode: string
  token: string
  password: string
}): OpenClawAuthMode {
  if (params.preferMode === 'token' && params.token) {
    return 'token'
  }

  if (params.preferMode === 'password' && params.password) {
    return 'password'
  }

  if (params.configuredMode === 'token' && params.token) {
    return 'token'
  }

  if (params.configuredMode === 'password' && params.password) {
    return 'password'
  }

  if (params.token) {
    return 'token'
  }

  if (params.password) {
    return 'password'
  }

  return 'none'
}

function buildDiscoveryMessage(params: {
  sourcePath: string | null
  selectedAuthMode: OpenClawAuthMode
  tokenFromEnv: boolean
  passwordFromEnv: boolean
}): string {
  if (params.selectedAuthMode === 'token') {
    if (params.tokenFromEnv) {
      return '已从环境变量读取本地 OpenClaw token，将自动用于连接。'
    }

    if (params.sourcePath) {
      return `已从 ${params.sourcePath} 读取本地 OpenClaw token，将自动用于连接。`
    }
  }

  if (params.selectedAuthMode === 'password') {
    if (params.passwordFromEnv) {
      return '已从环境变量读取本地 OpenClaw password，将自动用于连接。'
    }

    if (params.sourcePath) {
      return `已从 ${params.sourcePath} 读取本地 OpenClaw password，将自动用于连接。`
    }
  }

  if (params.sourcePath) {
    return `已读取 ${params.sourcePath}，但未发现可用 token/password，将尝试使用已配对设备凭证。`
  }

  return '未读取到本地 OpenClaw 配置文件，将尝试使用已配对设备凭证。'
}

export async function discoverLocalOpenClaw(
  payload?: LocalOpenClawDiscoveryPayload
): Promise<LocalOpenClawDiscoveryResult> {
  const configSnapshot = await readLocalOpenClawConfigSnapshot()

  const envGatewayToken = normalizeConfigValue(
    process.env.OPENCLAW_GATEWAY_TOKEN ?? process.env.CLAWDBOT_GATEWAY_TOKEN ?? ''
  )
  const envGatewayPassword = normalizeConfigValue(
    process.env.OPENCLAW_GATEWAY_PASSWORD ?? process.env.CLAWDBOT_GATEWAY_PASSWORD ?? ''
  )

  const gatewayToken = envGatewayToken || configSnapshot?.token || ''
  const gatewayPassword = envGatewayPassword || configSnapshot?.password || ''
  const configuredMode = configSnapshot?.mode || ''

  const selectedAuthMode = selectOpenClawAuthMode({
    preferMode: payload?.preferMode,
    configuredMode,
    token: gatewayToken,
    password: gatewayPassword
  })

  return {
    success: true,
    message: buildDiscoveryMessage({
      sourcePath: configSnapshot?.sourcePath ?? null,
      selectedAuthMode,
      tokenFromEnv: Boolean(envGatewayToken),
      passwordFromEnv: Boolean(envGatewayPassword)
    }),
    foundCli: Boolean(configSnapshot || envGatewayToken || envGatewayPassword),
    foundToken: gatewayToken.length > 0,
    foundPassword: gatewayPassword.length > 0,
    selectedAuthMode,
    gatewayToken: selectedAuthMode === 'token' ? gatewayToken : '',
    gatewayPassword: selectedAuthMode === 'password' ? gatewayPassword : '',
    scannedAt: new Date().toISOString()
  }
}
