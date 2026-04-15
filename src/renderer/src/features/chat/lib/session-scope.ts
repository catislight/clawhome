type ParsedAgentScopedSessionKey = {
  agentId: string
  scopedKey: string
}

export function parseAgentScopedSessionKey(
  sessionKey: string | undefined | null
): ParsedAgentScopedSessionKey | null {
  const normalizedSessionKey = sessionKey?.trim().toLowerCase()
  if (!normalizedSessionKey?.startsWith('agent:')) {
    return null
  }

  const parts = normalizedSessionKey.split(':').filter(Boolean)
  if (parts.length < 3) {
    return null
  }

  const agentId = parts[1]?.trim()
  const scopedKey = parts.slice(2).join(':').trim()
  if (!agentId || !scopedKey) {
    return null
  }

  return {
    agentId,
    scopedKey
  }
}

export function getAgentIdFromSessionKey(sessionKey: string | undefined | null): string | null {
  return parseAgentScopedSessionKey(sessionKey)?.agentId ?? null
}
