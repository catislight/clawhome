export type GatewaySessionListItem = {
  key: string
  displayName?: string
  label?: string
  derivedTitle?: string
  model?: string
  modelProvider?: string
  updatedAt?: number
  lastMessagePreview?: string
  sessionId?: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined
}

function readNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

export function parseGatewaySessionsList(payload: unknown): GatewaySessionListItem[] {
  if (!isRecord(payload) || !Array.isArray(payload.sessions)) {
    return []
  }

  return payload.sessions.flatMap((entry) => {
    if (!isRecord(entry)) {
      return []
    }

    const key = readString(entry.key)
    if (!key) {
      return []
    }

    return [
      {
        key,
        displayName: readString(entry.displayName),
        label: readString(entry.label),
        derivedTitle: readString(entry.derivedTitle),
        model: readString(entry.model),
        modelProvider: readString(entry.modelProvider),
        updatedAt: readNumber(entry.updatedAt),
        lastMessagePreview: readString(entry.lastMessagePreview),
        sessionId: readString(entry.sessionId)
      }
    ]
  })
}

export function getGatewaySessionTitle(session: GatewaySessionListItem): string {
  return (
    session.label?.trim() ||
    session.derivedTitle?.trim() ||
    session.displayName?.trim() ||
    session.key
  )
}

export function isGatewayMainSessionKey(sessionKey: string): boolean {
  const normalized = sessionKey.trim().toLowerCase()
  if (!normalized) {
    return false
  }

  if (normalized === 'main') {
    return true
  }

  const parts = normalized.split(':').filter(Boolean)
  if (parts.length < 3) {
    return false
  }

  return parts[0] === 'agent' && parts[parts.length - 1] === 'main'
}

export function formatGatewaySessionTimestamp(updatedAt?: number): string | null {
  if (typeof updatedAt !== 'number' || !Number.isFinite(updatedAt) || updatedAt <= 0) {
    return null
  }

  const date = new Date(updatedAt)
  if (Number.isNaN(date.getTime())) {
    return null
  }

  return new Intl.DateTimeFormat('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date)
}
