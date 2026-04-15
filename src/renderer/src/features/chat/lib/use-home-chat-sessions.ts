import { useCallback, useEffect, useMemo, useState } from 'react'

import { requestGatewayMethod } from '@/shared/api/gateway-client'
import { DEFAULT_CHAT_SESSION_KEY, isSameGatewaySessionKey } from '@/features/chat/lib/gateway-chat'
import {
  HOME_CHAT_REQUEST_TIMEOUT_MS,
  HOME_CHAT_SESSION_LIST_LIMIT
} from '@/features/chat/lib/chat-constants'
import { getAgentIdFromSessionKey } from '@/features/chat/lib/session-scope'
import {
  isGatewayMainSessionKey,
  parseGatewaySessionsList,
  type GatewaySessionListItem
} from '@/features/chat/lib/gateway-sessions'

type UseHomeChatSessionsOptions = {
  activeInstanceId: string | null
}

type UseHomeChatSessionsResult = {
  activeSessionKey: string
  pendingSessionKey: string
  sessionDialogSessions: GatewaySessionListItem[]
  sessionDialogLoading: boolean
  sessionDialogError: string | null
  setPendingSessionKey: (sessionKey: string) => void
  createConversation: (
    instanceId: string,
    name?: string,
    options?: {
      agentId?: string | null
    }
  ) => void
  loadSessionOptions: (
    instanceId: string,
    currentSessionKey: string,
    options?: {
      agentId?: string | null
    }
  ) => Promise<void>
  renameConversation: (instanceId: string, sessionKey: string, nextName: string) => Promise<void>
  deleteConversation: (
    instanceId: string,
    sessionKey: string,
    options?: {
      fallbackSessionKey?: string
      protectedSessionKeys?: string[]
    }
  ) => Promise<void>
  confirmSessionSwitch: (instanceId: string) => void
  resetSessionDialogState: () => void
}

function createDefaultConversationLabel(createdAt: Date): string {
  return `新会话 ${new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }).format(createdAt)}`
}

function createHomeConversationSession(name?: string): GatewaySessionListItem {
  const createdAt = new Date()
  const timestamp = createdAt.getTime()
  const randomPart =
    typeof globalThis.crypto?.randomUUID === 'function'
      ? globalThis.crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10)
  const normalizedName = name?.trim()

  return {
    key: `ui:${timestamp}:${randomPart}`,
    label:
      normalizedName && normalizedName.length > 0
        ? normalizedName
        : createDefaultConversationLabel(createdAt),
    updatedAt: timestamp
  }
}

function createScopedHomeConversationSession(params: {
  name?: string
  agentId?: string | null
}): GatewaySessionListItem {
  const baseSession = createHomeConversationSession(params.name)
  const normalizedAgentId = normalizeAgentId(params.agentId)
  if (!normalizedAgentId) {
    return baseSession
  }

  return {
    ...baseSession,
    key: `agent:${normalizedAgentId}:${baseSession.key}`
  }
}

function mergeGatewaySessions(
  listedSessions: GatewaySessionListItem[],
  localSessions: GatewaySessionListItem[]
): GatewaySessionListItem[] {
  const mergedSessions = listedSessions.map((session) => {
    const localSession = localSessions.find((item) =>
      isSameGatewaySessionKey(item.key, session.key)
    )

    if (!localSession) {
      return session
    }

    return {
      ...localSession,
      ...session,
      label: session.label ?? localSession.label,
      displayName: session.displayName ?? localSession.displayName,
      derivedTitle: session.derivedTitle ?? localSession.derivedTitle,
      updatedAt: session.updatedAt ?? localSession.updatedAt,
      lastMessagePreview: session.lastMessagePreview ?? localSession.lastMessagePreview,
      sessionId: session.sessionId ?? localSession.sessionId
    }
  })

  const missingLocalSessions = localSessions.filter(
    (localSession) =>
      !mergedSessions.some((session) => isSameGatewaySessionKey(session.key, localSession.key))
  )

  return [...mergedSessions, ...missingLocalSessions]
}

function normalizeAgentId(value?: string | null): string | null {
  const normalized = value?.trim().toLowerCase()
  return normalized ? normalized : null
}

function filterSessionsByAgentId(
  sessions: GatewaySessionListItem[],
  currentSessionKey: string,
  agentId?: string | null
): GatewaySessionListItem[] {
  const normalizedAgentId = normalizeAgentId(agentId)
  if (!normalizedAgentId) {
    return sessions
  }

  return sessions.filter((session) => {
    const sessionAgentId = getAgentIdFromSessionKey(session.key)
    if (sessionAgentId) {
      return sessionAgentId === normalizedAgentId
    }

    // Keep the current item when the backend returns canonical and shorthand forms mixed.
    return isSameGatewaySessionKey(session.key, currentSessionKey)
  })
}

export function useHomeChatSessions({
  activeInstanceId
}: UseHomeChatSessionsOptions): UseHomeChatSessionsResult {
  const [sessionKeysByInstanceId, setSessionKeysByInstanceId] = useState<Record<string, string>>({})
  const [localSessionsByInstanceId, setLocalSessionsByInstanceId] = useState<
    Record<string, GatewaySessionListItem[]>
  >({})
  const [sessionDialogSessions, setSessionDialogSessions] = useState<GatewaySessionListItem[]>([])
  const [sessionDialogLoading, setSessionDialogLoading] = useState(false)
  const [sessionDialogError, setSessionDialogError] = useState<string | null>(null)
  const [pendingSessionKey, setPendingSessionKey] = useState(DEFAULT_CHAT_SESSION_KEY)

  const activeSessionKey = useMemo(
    () =>
      (activeInstanceId ? sessionKeysByInstanceId[activeInstanceId] : null) ??
      DEFAULT_CHAT_SESSION_KEY,
    [activeInstanceId, sessionKeysByInstanceId]
  )

  useEffect(() => {
    setSessionDialogSessions([])
    setSessionDialogLoading(false)
    setSessionDialogError(null)
    setPendingSessionKey(activeSessionKey)
  }, [activeInstanceId, activeSessionKey])

  const createConversation = useCallback(
    (
      instanceId: string,
      name?: string,
      options?: {
        agentId?: string | null
      }
    ): void => {
      const nextSession = createScopedHomeConversationSession({
        name,
        agentId: options?.agentId
      })

      setLocalSessionsByInstanceId((current) => ({
        ...current,
        [instanceId]: mergeGatewaySessions([nextSession], current[instanceId] ?? [])
      }))
      setSessionKeysByInstanceId((current) => ({
        ...current,
        [instanceId]: nextSession.key
      }))

      // Best-effort: persist a friendly label so the new session also appears clearly
      // in the gateway-backed session list after the first message.
      void requestGatewayMethod(
        instanceId,
        'sessions.patch',
        {
          key: nextSession.key,
          label: nextSession.label
        },
        {
          timeoutMs: HOME_CHAT_REQUEST_TIMEOUT_MS.sessionPatch
        }
      ).catch(() => undefined)
    },
    []
  )

  const renameConversation = useCallback(
    async (instanceId: string, sessionKey: string, nextName: string): Promise<void> => {
      const normalizedName = nextName.trim()
      if (!normalizedName) {
        throw new Error('会话名称不能为空')
      }

      await requestGatewayMethod(
        instanceId,
        'sessions.patch',
        {
          key: sessionKey,
          label: normalizedName
        },
        {
          timeoutMs: HOME_CHAT_REQUEST_TIMEOUT_MS.sessionPatch
        }
      )

      const updateSessionTitle = (session: GatewaySessionListItem): GatewaySessionListItem => {
        if (!isSameGatewaySessionKey(session.key, sessionKey)) {
          return session
        }

        return {
          ...session,
          label: normalizedName,
          updatedAt: Date.now()
        }
      }

      setLocalSessionsByInstanceId((current) => ({
        ...current,
        [instanceId]: (current[instanceId] ?? []).map(updateSessionTitle)
      }))

      setSessionDialogSessions((current) => current.map(updateSessionTitle))
      setSessionDialogError(null)
    },
    []
  )

  const deleteConversation = useCallback(
    async (
      instanceId: string,
      sessionKey: string,
      options?: {
        fallbackSessionKey?: string
        protectedSessionKeys?: string[]
      }
    ): Promise<void> => {
      const protectedSessionKeys = options?.protectedSessionKeys ?? []
      const protectedByConfig = protectedSessionKeys.some((key) =>
        isSameGatewaySessionKey(key, sessionKey)
      )

      if (protectedByConfig || isGatewayMainSessionKey(sessionKey)) {
        throw new Error('主会话不支持删除')
      }

      await requestGatewayMethod(
        instanceId,
        'sessions.delete',
        {
          key: sessionKey
        },
        {
          timeoutMs: HOME_CHAT_REQUEST_TIMEOUT_MS.sessionDelete
        }
      )

      const requestedFallback = options?.fallbackSessionKey?.trim()
      const fallbackSessionKey =
        requestedFallback && !isSameGatewaySessionKey(requestedFallback, sessionKey)
          ? requestedFallback
          : DEFAULT_CHAT_SESSION_KEY

      setLocalSessionsByInstanceId((current) => ({
        ...current,
        [instanceId]: (current[instanceId] ?? []).filter(
          (session) => !isSameGatewaySessionKey(session.key, sessionKey)
        )
      }))

      setSessionDialogSessions((current) =>
        current.filter((session) => !isSameGatewaySessionKey(session.key, sessionKey))
      )

      setSessionKeysByInstanceId((current) => {
        const currentSessionKey = current[instanceId]
        if (!currentSessionKey || !isSameGatewaySessionKey(currentSessionKey, sessionKey)) {
          return current
        }

        return {
          ...current,
          [instanceId]: fallbackSessionKey
        }
      })

      setPendingSessionKey((current) =>
        isSameGatewaySessionKey(current, sessionKey) ? fallbackSessionKey : current
      )
      setSessionDialogError(null)
    },
    []
  )

  const loadSessionOptions = useCallback(
    async (
      instanceId: string,
      currentSessionKey: string,
      options?: {
        agentId?: string | null
      }
    ): Promise<void> => {
      setSessionDialogLoading(true)
      setSessionDialogError(null)

      try {
        const targetAgentId = normalizeAgentId(options?.agentId)
        const payload = await requestGatewayMethod(
          instanceId,
          'sessions.list',
          {
            includeGlobal: false,
            includeUnknown: false,
            includeDerivedTitles: true,
            includeLastMessage: true,
            limit: HOME_CHAT_SESSION_LIST_LIMIT,
            ...(targetAgentId ? { agentId: targetAgentId } : {})
          },
          {
            timeoutMs: HOME_CHAT_REQUEST_TIMEOUT_MS.sessionsList
          }
        )

        const localSessions = localSessionsByInstanceId[instanceId] ?? []
        const mergedSessions = mergeGatewaySessions(
          parseGatewaySessionsList(payload),
          localSessions
        )
        const listedSessions = filterSessionsByAgentId(
          mergedSessions,
          currentSessionKey,
          targetAgentId
        )
        const hasCurrentSession = listedSessions.some((session) =>
          isSameGatewaySessionKey(session.key, currentSessionKey)
        )
        const nextSessions = hasCurrentSession
          ? listedSessions
          : [
              localSessions.find((session) =>
                isSameGatewaySessionKey(session.key, currentSessionKey)
              ) ?? {
                key: currentSessionKey
              },
              ...listedSessions
            ]

        setSessionDialogSessions(
          nextSessions.toSorted((left, right) => {
            const leftIsCurrent = isSameGatewaySessionKey(left.key, currentSessionKey)
            const rightIsCurrent = isSameGatewaySessionKey(right.key, currentSessionKey)

            if (leftIsCurrent !== rightIsCurrent) {
              return leftIsCurrent ? -1 : 1
            }

            return (right.updatedAt ?? 0) - (left.updatedAt ?? 0)
          })
        )
      } catch (error) {
        setSessionDialogSessions([])
        setSessionDialogError(error instanceof Error ? error.message : '会话列表加载失败')
      } finally {
        setSessionDialogLoading(false)
      }
    },
    [localSessionsByInstanceId]
  )

  const confirmSessionSwitch = useCallback(
    (instanceId: string): void => {
      setSessionKeysByInstanceId((current) => ({
        ...current,
        [instanceId]: pendingSessionKey
      }))
      setSessionDialogError(null)
    },
    [pendingSessionKey]
  )

  const resetSessionDialogState = useCallback((): void => {
    setSessionDialogSessions([])
    setSessionDialogLoading(false)
    setSessionDialogError(null)
  }, [])

  return {
    activeSessionKey,
    pendingSessionKey,
    sessionDialogSessions,
    sessionDialogLoading,
    sessionDialogError,
    setPendingSessionKey,
    createConversation,
    loadSessionOptions,
    renameConversation,
    deleteConversation,
    confirmSessionSwitch,
    resetSessionDialogState
  }
}
