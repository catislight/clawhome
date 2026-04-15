import { startTransition, useCallback, useEffect, useMemo, type SetStateAction } from 'react'

import {
  DEFAULT_CHAT_SESSION_KEY,
  formatConversationTime,
  isSilentAssistantReply,
  isSilentAssistantReplyFragment,
  isSameGatewaySessionKey,
  mapGatewayHistoryMessages,
  parseGatewayChatEvent
} from '@/features/chat/lib/gateway-chat'
import {
  GATEWAY_CHAT_POLL_INTERVAL_MS,
  GATEWAY_EVENTS_DRAIN_MAX_ATTEMPTS,
  GATEWAY_EVENTS_MAX_EVENTS,
  GATEWAY_REQUEST_TIMEOUT_MS
} from '@/features/chat/lib/chat-constants'
import {
  mapGatewayHistoryMessageTraces,
  parseGatewayAgentEvent,
  reduceRunTracesFromGatewayEvents,
  removeRunTracesByRunId,
  type ConversationRunTrace
} from '@/features/chat/lib/gateway-run-trace'
import {
  NON_STREAMING_HISTORY_FALLBACK_WINDOW_MS,
  createAssistantErrorMessage,
  createAssistantMessageId,
  createAssistantSegmentMessageId,
  createChatRunId,
  createLiveAssistantRunState,
  normalizeModelOverride,
  removeAssistantMessagesByRunId,
  resolveConversationTimeLabel,
  upsertAssistantMessage,
  updateAssistantMessageStatus
} from '@/features/chat/lib/gateway-conversation-runtime'
import {
  buildImageOnlyUserMessage,
  buildImageUnderstandingPrompt,
  parseWorkspacePathFromConfigPayload,
  uploadChatImagesToWorkspace
} from '@/features/chat/lib/chat-image-understanding'
import type { ChatSubmitImage, ChatSubmitTag } from '@/features/chat/lib/chat-send-types'
import type { SshConnectionFormValues } from '@/features/instances/model/ssh-connection'
import {
  getAppApiUnavailableMessage,
  hasAppApiMethod,
  pullGatewayEvents as pullGatewayEventsViaBridge
} from '@/shared/api/app-api'
import { requestGatewayMethod } from '@/shared/api/gateway-client'
import type { ConversationMessage } from '@/shared/contracts/chat-conversation'
import {
  buildGatewayConversationRuntimeKey,
  EMPTY_GATEWAY_CONVERSATION_RUNTIME_STATE,
  type GatewayConversationRuntimeState,
  useGatewayConversationStore
} from '@/stores/use-gateway-conversation-store'
import {
  useStreamingHistoryReconcile,
  type StreamingHistorySnapshot
} from '@/features/chat/lib/use-streaming-history-reconcile'

type GatewaySessionEventLike = {
  event: string
  payload?: unknown
  receivedAt?: string
}

type UseGatewayConversationOptions = {
  instanceId: string | null
  enabled?: boolean
  sessionKey?: string
}

type UseGatewayConversationResult = {
  messages: ConversationMessage[]
  messageTraces: Record<string, ConversationRunTrace>
  loadingHistory: boolean
  showHistoryLoadingState: boolean
  historyError: string | null
  submitting: boolean
  resettingConversation: boolean
  canResetConversation: boolean
  sendMessage: (nextValue: string, options?: SendMessageOptions) => Promise<void>
  resetConversation: () => Promise<void>
}

type SendMessageOptions = {
  model?: string | null
  images?: ChatSubmitImage[]
  userTags?: ChatSubmitTag[]
  connectionConfig?: SshConnectionFormValues | null
}

function hasPendingLocalConversationMessages(messages: ConversationMessage[]): boolean {
  return messages.some((message) => message.status === 'sending' || message.status === 'streaming')
}

function shouldApplyAuthoritativeHistorySnapshot(
  runtime: GatewayConversationRuntimeState,
  mappedMessages: ConversationMessage[]
): boolean {
  if (!hasPendingLocalConversationMessages(runtime.messages)) {
    return true
  }

  if (runtime.submitting) {
    return false
  }

  // Keep optimistic local cards when history is still empty (reply in progress),
  // but trust history once it has concrete transcript items.
  return mappedMessages.length > 0
}

export function useGatewayConversation({
  instanceId,
  enabled = true,
  sessionKey = DEFAULT_CHAT_SESSION_KEY
}: UseGatewayConversationOptions): UseGatewayConversationResult {
  const conversationRuntimeKey = useMemo(() => {
    if (!instanceId) {
      return null
    }

    return buildGatewayConversationRuntimeKey(instanceId, sessionKey)
  }, [instanceId, sessionKey])
  const ensureConversation = useGatewayConversationStore((state) => state.ensureConversation)
  const conversationRuntime = useGatewayConversationStore((state) =>
    conversationRuntimeKey
      ? (state.conversations[conversationRuntimeKey] ?? EMPTY_GATEWAY_CONVERSATION_RUNTIME_STATE)
      : EMPTY_GATEWAY_CONVERSATION_RUNTIME_STATE
  )
  const {
    messages,
    messageTraces,
    loadingHistory,
    hasResolvedHistorySnapshot,
    historyError,
    pendingHistoryFallbackRunIdToExpiresAt
  } = conversationRuntime
  const submitting = conversationRuntime.submitting
  const resettingConversation = conversationRuntime.resettingConversation

  useEffect(() => {
    if (!conversationRuntimeKey) {
      return
    }

    ensureConversation(conversationRuntimeKey)
  }, [conversationRuntimeKey, ensureConversation])

  const getConversationRuntime = useCallback((): GatewayConversationRuntimeState => {
    if (!conversationRuntimeKey) {
      return EMPTY_GATEWAY_CONVERSATION_RUNTIME_STATE
    }

    const storeState = useGatewayConversationStore.getState()
    return (
      storeState.conversations[conversationRuntimeKey] ?? EMPTY_GATEWAY_CONVERSATION_RUNTIME_STATE
    )
  }, [conversationRuntimeKey])

  const patchConversationRuntime = useCallback(
    (patch: Partial<GatewayConversationRuntimeState>): void => {
      if (!conversationRuntimeKey) {
        return
      }

      useGatewayConversationStore.getState().patchConversation(conversationRuntimeKey, patch)
    },
    [conversationRuntimeKey]
  )

  const updateConversationRuntime = useCallback(
    (updater: (current: GatewayConversationRuntimeState) => GatewayConversationRuntimeState): void => {
      if (!conversationRuntimeKey) {
        return
      }

      useGatewayConversationStore.getState().updateConversation(conversationRuntimeKey, updater)
    },
    [conversationRuntimeKey]
  )

  const setMessages = useCallback(
    (nextState: SetStateAction<ConversationMessage[]>): void => {
      updateConversationRuntime((current) => ({
        ...current,
        messages:
          typeof nextState === 'function'
            ? (nextState as (messages: ConversationMessage[]) => ConversationMessage[])(
                current.messages
              )
            : nextState
      }))
    },
    [updateConversationRuntime]
  )

  const setMessageTraces = useCallback(
    (nextState: SetStateAction<Record<string, ConversationRunTrace>>): void => {
      updateConversationRuntime((current) => ({
        ...current,
        messageTraces:
          typeof nextState === 'function'
            ? (nextState as (
                traces: Record<string, ConversationRunTrace>
              ) => Record<string, ConversationRunTrace>)(current.messageTraces)
            : nextState
      }))
    },
    [updateConversationRuntime]
  )

  const setLoadingHistory = useCallback(
    (loading: boolean): void => {
      patchConversationRuntime({
        loadingHistory: loading
      })
    },
    [patchConversationRuntime]
  )

  const setHasResolvedHistorySnapshot = useCallback(
    (hasResolved: boolean): void => {
      patchConversationRuntime({
        hasResolvedHistorySnapshot: hasResolved
      })
    },
    [patchConversationRuntime]
  )

  const setHistoryError = useCallback(
    (error: string | null): void => {
      patchConversationRuntime({
        historyError: error
      })
    },
    [patchConversationRuntime]
  )

  const setSubmitting = useCallback(
    (nextSubmitting: boolean): void => {
      patchConversationRuntime({
        submitting: nextSubmitting
      })
    },
    [patchConversationRuntime]
  )

  const setResettingConversation = useCallback(
    (nextResettingConversation: boolean): void => {
      patchConversationRuntime({
        resettingConversation: nextResettingConversation
      })
    },
    [patchConversationRuntime]
  )

  const pendingHistoryFallbackRunIdSet = useMemo(
    () => new Set(Object.keys(pendingHistoryFallbackRunIdToExpiresAt)),
    [pendingHistoryFallbackRunIdToExpiresAt]
  )
  const hasStreamingAssistantMessage = useMemo(() => {
    return messages.some((message) => {
      if (message.role !== 'assistant' || message.status !== 'streaming') {
        return false
      }

      if (message.content.trim().length > 0) {
        return true
      }

      return !(message.runId && pendingHistoryFallbackRunIdSet.has(message.runId))
    })
  }, [messages, pendingHistoryFallbackRunIdSet])
  const chatPollIntervalMs =
    hasStreamingAssistantMessage || submitting
      ? GATEWAY_CHAT_POLL_INTERVAL_MS.busy
      : GATEWAY_CHAT_POLL_INTERVAL_MS.idle
  const isConversationActive = enabled && Boolean(instanceId)
  const showHistoryLoadingState =
    isConversationActive &&
    !historyError &&
    messages.length === 0 &&
    (loadingHistory || !hasResolvedHistorySnapshot)
  const canResetConversation =
    isConversationActive && !submitting && !resettingConversation && !hasStreamingAssistantMessage

  const applyStreamingHistorySnapshot = useCallback((snapshot: StreamingHistorySnapshot): void => {
    const currentRuntime = getConversationRuntime()
    const pendingHistoryFallbackRunIdToExpiresAt = {
      ...currentRuntime.pendingHistoryFallbackRunIdToExpiresAt
    }
    const pendingRunIds = Object.keys(pendingHistoryFallbackRunIdToExpiresAt)
    if (pendingRunIds.length > 0) {
      const resolvedAssistantRunIds = new Set(
        snapshot.messages.flatMap((message) =>
          message.role === 'assistant' &&
          typeof message.runId === 'string' &&
          message.content.trim().length > 0
            ? [message.runId]
            : []
        )
      )

      for (const runId of pendingRunIds) {
        if (resolvedAssistantRunIds.has(runId)) {
          delete pendingHistoryFallbackRunIdToExpiresAt[runId]
        }
      }
    }

    startTransition(() => {
      updateConversationRuntime((current) => ({
        ...current,
        messages: snapshot.messages,
        messageTraces: snapshot.messageTraces,
        pendingHistoryFallbackRunIdToExpiresAt
      }))
    })
  }, [getConversationRuntime, updateConversationRuntime])

  const { markPendingStreamingHistoryReconcile } = useStreamingHistoryReconcile({
    enabled: isConversationActive && !resettingConversation,
    instanceId,
    sessionKey,
    hasStreamingAssistantMessage,
    submitting,
    onHistoryReconciled: applyStreamingHistorySnapshot
  })

  const pullGatewayEvents = useCallback(
    async (targetInstanceId: string): Promise<void> => {
      if (!hasAppApiMethod('pullGatewayEvents')) {
        return
      }

      const currentRuntime = getConversationRuntime()
      if (currentRuntime.gatewayPullInFlight) {
        return
      }

      patchConversationRuntime({
        gatewayPullInFlight: true
      })

      try {
        const liveRunStates = {
          ...currentRuntime.liveAssistantRunStateByRunId
        }
        const initialLiveRunIds = new Set(Object.keys(currentRuntime.liveAssistantRunStateByRunId))
        const streamingHistoryRunIds = new Set(currentRuntime.streamingHistoryRunIds)
        const initialStreamingHistoryRunIds = new Set(currentRuntime.streamingHistoryRunIds)
        const pendingHistoryFallbackRunIdToExpiresAt = {
          ...currentRuntime.pendingHistoryFallbackRunIdToExpiresAt
        }
        const initialPendingHistoryFallbackRunIds = new Set(
          Object.keys(currentRuntime.pendingHistoryFallbackRunIdToExpiresAt)
        )
        const now = Date.now()
        const expiredFallbackRunIds: string[] = []
        for (const [runId, expiresAt] of Object.entries(pendingHistoryFallbackRunIdToExpiresAt)) {
          if (expiresAt <= now) {
            delete pendingHistoryFallbackRunIdToExpiresAt[runId]
            expiredFallbackRunIds.push(runId)
          }
        }

        const response = await pullGatewayEventsViaBridge({
          instanceId: targetInstanceId,
          maxEvents: GATEWAY_EVENTS_MAX_EVENTS
        })

        if (!response.success) {
          patchConversationRuntime({
            pendingHistoryFallbackRunIdToExpiresAt
          })
          return
        }

        if (response.events.length === 0) {
          if (Object.keys(pendingHistoryFallbackRunIdToExpiresAt).length > 0) {
            markPendingStreamingHistoryReconcile()
          }
          patchConversationRuntime({
            pendingHistoryFallbackRunIdToExpiresAt
          })
          return
        }

        const events = response.events as GatewaySessionEventLike[]
        const parsedChatEvents = events.map((event) => parseGatewayChatEvent(event))
        const completedStreamingRunIds = new Set<string>()
        const abortedRunIds = parsedChatEvents.flatMap((parsed) =>
          parsed &&
          parsed.state === 'aborted' &&
          isSameGatewaySessionKey(parsed.sessionKey, sessionKey) &&
          parsed.runId
            ? [parsed.runId]
            : []
        )

        for (const parsedChatEvent of parsedChatEvents) {
          if (
            !parsedChatEvent ||
            !isSameGatewaySessionKey(parsedChatEvent.sessionKey, sessionKey) ||
            !parsedChatEvent.runId
          ) {
            continue
          }

          if (parsedChatEvent.state === 'aborted' || parsedChatEvent.state === 'error') {
            delete pendingHistoryFallbackRunIdToExpiresAt[parsedChatEvent.runId]
            continue
          }

          if (parsedChatEvent.state === 'delta') {
            if (parsedChatEvent.content.trim().length > 0) {
              delete pendingHistoryFallbackRunIdToExpiresAt[parsedChatEvent.runId]
            }
            continue
          }

          const finalContent = parsedChatEvent.content.trim()
          const hasRenderableFinalContent =
            finalContent.length > 0 &&
            !isSilentAssistantReply(finalContent) &&
            !isSilentAssistantReplyFragment(finalContent)

          if (hasRenderableFinalContent) {
            delete pendingHistoryFallbackRunIdToExpiresAt[parsedChatEvent.runId]
            continue
          }

          if (liveRunStates[parsedChatEvent.runId]) {
            pendingHistoryFallbackRunIdToExpiresAt[parsedChatEvent.runId] =
              now + NON_STREAMING_HISTORY_FALLBACK_WINDOW_MS
          }
        }

        for (const event of events) {
          const parsedAgentEvent = parseGatewayAgentEvent(event, sessionKey)
          if (!parsedAgentEvent) {
            continue
          }

          if (parsedAgentEvent.type === 'assistant') {
            const nextText = parsedAgentEvent.text.trim()
              ? parsedAgentEvent.text
              : parsedAgentEvent.delta

            if (
              nextText &&
              !isSilentAssistantReply(nextText) &&
              !isSilentAssistantReplyFragment(nextText)
            ) {
              streamingHistoryRunIds.add(parsedAgentEvent.runId)
              delete pendingHistoryFallbackRunIdToExpiresAt[parsedAgentEvent.runId]
            }
            continue
          }

          if (parsedAgentEvent.type === 'lifecycle') {
            const liveRunState = liveRunStates[parsedAgentEvent.runId]
            if (
              parsedAgentEvent.phase === 'end' &&
              liveRunState &&
              !liveRunState.sawAssistantEvent
            ) {
              pendingHistoryFallbackRunIdToExpiresAt[parsedAgentEvent.runId] =
                now + NON_STREAMING_HISTORY_FALLBACK_WINDOW_MS
            }

            if (parsedAgentEvent.phase === 'end' && streamingHistoryRunIds.has(parsedAgentEvent.runId)) {
              completedStreamingRunIds.add(parsedAgentEvent.runId)
            }

            streamingHistoryRunIds.delete(parsedAgentEvent.runId)

            if (parsedAgentEvent.phase === 'error') {
              delete pendingHistoryFallbackRunIdToExpiresAt[parsedAgentEvent.runId]
            }
          }
        }

        for (const abortedRunId of abortedRunIds) {
          streamingHistoryRunIds.delete(abortedRunId)
          delete pendingHistoryFallbackRunIdToExpiresAt[abortedRunId]
        }

        startTransition(() => {
          setMessages((current) => {
            let nextMessages = current
            const agentDrivenRunIds = new Set<string>()

            if (expiredFallbackRunIds.length > 0) {
              const expiredRunIdsSet = new Set(expiredFallbackRunIds)
              nextMessages = nextMessages.filter(
                (message) =>
                  !(
                    message.role === 'assistant' &&
                    message.runId &&
                    expiredRunIdsSet.has(message.runId) &&
                    message.content.trim().length === 0
                  )
              )
            }

            for (const event of events) {
              const parsedAgentEvent = parseGatewayAgentEvent(event, sessionKey)
              if (parsedAgentEvent) {
                if (parsedAgentEvent.type === 'assistant') {
                  agentDrivenRunIds.add(parsedAgentEvent.runId)
                  const runState =
                    liveRunStates[parsedAgentEvent.runId] ??
                    (() => {
                      const created = createLiveAssistantRunState(parsedAgentEvent.runId)
                      liveRunStates[parsedAgentEvent.runId] = created
                      return created
                    })()

                  const nextText = parsedAgentEvent.text.trim()
                    ? parsedAgentEvent.text
                    : parsedAgentEvent.delta

                  if (
                    !nextText ||
                    isSilentAssistantReply(nextText) ||
                    isSilentAssistantReplyFragment(nextText)
                  ) {
                    continue
                  }

                  nextMessages = upsertAssistantMessage(nextMessages, {
                    id: runState.currentMessageId,
                    runId: parsedAgentEvent.runId,
                    role: 'assistant',
                    content: nextText,
                    timeLabel: resolveConversationTimeLabel(parsedAgentEvent.receivedAt),
                    status: 'streaming'
                  })

                  runState.sawAssistantEvent = true
                  runState.lastAssistantText = parsedAgentEvent.text
                  continue
                }

                if (parsedAgentEvent.type === 'tool') {
                  agentDrivenRunIds.add(parsedAgentEvent.runId)
                  const runState = liveRunStates[parsedAgentEvent.runId]
                  if (!runState) {
                    const created = createLiveAssistantRunState(parsedAgentEvent.runId)
                    liveRunStates[parsedAgentEvent.runId] = created
                    nextMessages = upsertAssistantMessage(nextMessages, {
                      id: created.currentMessageId,
                      runId: parsedAgentEvent.runId,
                      role: 'assistant',
                      content: '',
                      timeLabel: resolveConversationTimeLabel(event.receivedAt),
                      status: 'streaming'
                    })
                    continue
                  }

                  if (parsedAgentEvent.phase === 'start' && runState.sawAssistantEvent) {
                    nextMessages = updateAssistantMessageStatus(
                      nextMessages,
                      runState.currentMessageId,
                      undefined
                    )
                    runState.segmentIndex += 1
                    runState.currentMessageId = createAssistantSegmentMessageId(
                      parsedAgentEvent.runId,
                      runState.segmentIndex
                    )
                    runState.sawAssistantEvent = false
                    runState.lastAssistantText = ''

                    nextMessages = upsertAssistantMessage(nextMessages, {
                      id: runState.currentMessageId,
                      runId: parsedAgentEvent.runId,
                      role: 'assistant',
                      content: '',
                      timeLabel: resolveConversationTimeLabel(event.receivedAt),
                      status: 'streaming'
                    })
                  }
                  continue
                }

                if (parsedAgentEvent.type === 'lifecycle') {
                  const runState = liveRunStates[parsedAgentEvent.runId]
                  if (!runState) {
                    continue
                  }

                  if (runState.sawAssistantEvent) {
                    agentDrivenRunIds.add(parsedAgentEvent.runId)
                  }

                  const hasVisibleCurrentMessage = nextMessages.some(
                    (message) =>
                      message.id === runState.currentMessageId &&
                      message.role === 'assistant' &&
                      message.content.trim().length > 0
                  )

                  if (!hasVisibleCurrentMessage) {
                    if (parsedAgentEvent.phase === 'end') {
                      pendingHistoryFallbackRunIdToExpiresAt[parsedAgentEvent.runId] =
                        Date.now() + NON_STREAMING_HISTORY_FALLBACK_WINDOW_MS
                      nextMessages = upsertAssistantMessage(nextMessages, {
                        id: runState.currentMessageId,
                        runId: parsedAgentEvent.runId,
                        role: 'assistant',
                        content: '',
                        timeLabel: resolveConversationTimeLabel(event.receivedAt),
                        status: 'streaming'
                      })
                    } else {
                      nextMessages = nextMessages.filter(
                        (message) => message.id !== runState.currentMessageId
                      )
                    }
                  } else {
                    nextMessages = updateAssistantMessageStatus(
                      nextMessages,
                      runState.currentMessageId,
                      parsedAgentEvent.phase === 'error' ? 'error' : undefined
                    )
                  }

                  if (!runState.sawAssistantEvent) {
                    delete liveRunStates[parsedAgentEvent.runId]
                  }
                  continue
                }
              }

              const parsed = parseGatewayChatEvent(event)
              if (
                !parsed ||
                !isSameGatewaySessionKey(parsed.sessionKey, sessionKey) ||
                !parsed.runId
              ) {
                continue
              }

              const liveRunState = liveRunStates[parsed.runId]

              if (parsed.state === 'aborted') {
                nextMessages = removeAssistantMessagesByRunId(nextMessages, parsed.runId)
                delete liveRunStates[parsed.runId]
                continue
              }

              if (agentDrivenRunIds.has(parsed.runId) || liveRunState?.sawAssistantEvent) {
                continue
              }

              const assistantMessageId =
                liveRunState?.currentMessageId ?? createAssistantMessageId(parsed.runId)

              const content =
                parsed.content ||
                (parsed.state === 'error' && parsed.errorMessage
                  ? `请求出错：${parsed.errorMessage}`
                  : '')

              if (
                parsed.state !== 'error' &&
                (isSilentAssistantReply(content) || isSilentAssistantReplyFragment(content))
              ) {
                nextMessages = nextMessages.filter((message) => message.id !== assistantMessageId)
                continue
              }

              if (!content) {
                if (parsed.state !== 'error' && pendingHistoryFallbackRunIdToExpiresAt[parsed.runId]) {
                  nextMessages = upsertAssistantMessage(nextMessages, {
                    id: assistantMessageId,
                    runId: parsed.runId,
                    role: 'assistant',
                    content: '',
                    timeLabel: parsed.timeLabel,
                    status: 'streaming'
                  })
                  continue
                }

                nextMessages = nextMessages.filter((message) => message.id !== assistantMessageId)
                continue
              }

              nextMessages = upsertAssistantMessage(nextMessages, {
                id: assistantMessageId,
                runId: parsed.runId,
                role: 'assistant',
                content,
                timeLabel: parsed.timeLabel,
                status:
                  parsed.state === 'delta'
                    ? 'streaming'
                    : parsed.state === 'error'
                      ? 'error'
                      : undefined
              })

              if (parsed.state !== 'delta') {
                delete liveRunStates[parsed.runId]
              }
            }

            return nextMessages
          })

          setMessageTraces((current) =>
            removeRunTracesByRunId(
              reduceRunTracesFromGatewayEvents(current, events, sessionKey),
              abortedRunIds
            )
          )

          updateConversationRuntime((current) => ({
            ...current,
            liveAssistantRunStateByRunId: (() => {
              const nextLiveAssistantRunStateByRunId = {
                ...current.liveAssistantRunStateByRunId,
                ...liveRunStates
              }

              for (const runId of initialLiveRunIds) {
                if (!(runId in liveRunStates)) {
                  delete nextLiveAssistantRunStateByRunId[runId]
                }
              }

              return nextLiveAssistantRunStateByRunId
            })(),
            streamingHistoryRunIds: (() => {
              const nextStreamingHistoryRunIds = new Set(current.streamingHistoryRunIds)

              for (const runId of initialStreamingHistoryRunIds) {
                if (!streamingHistoryRunIds.has(runId)) {
                  nextStreamingHistoryRunIds.delete(runId)
                }
              }

              for (const runId of streamingHistoryRunIds) {
                nextStreamingHistoryRunIds.add(runId)
              }

              return Array.from(nextStreamingHistoryRunIds)
            })(),
            pendingHistoryFallbackRunIdToExpiresAt: (() => {
              const nextPendingHistoryFallbackRunIdToExpiresAt = {
                ...current.pendingHistoryFallbackRunIdToExpiresAt,
                ...pendingHistoryFallbackRunIdToExpiresAt
              }

              for (const runId of initialPendingHistoryFallbackRunIds) {
                if (!(runId in pendingHistoryFallbackRunIdToExpiresAt)) {
                  delete nextPendingHistoryFallbackRunIdToExpiresAt[runId]
                }
              }

              return nextPendingHistoryFallbackRunIdToExpiresAt
            })()
          }))
        })

        if (
          completedStreamingRunIds.size > 0 ||
          Object.keys(pendingHistoryFallbackRunIdToExpiresAt).length > 0
        ) {
          markPendingStreamingHistoryReconcile()
        }
      } finally {
        patchConversationRuntime({
          gatewayPullInFlight: false
        })
      }
    },
    [
      getConversationRuntime,
      markPendingStreamingHistoryReconcile,
      patchConversationRuntime,
      sessionKey,
      setMessageTraces,
      setMessages,
      updateConversationRuntime
    ]
  )

  const drainGatewayEvents = useCallback(async (targetInstanceId: string): Promise<void> => {
    if (!hasAppApiMethod('pullGatewayEvents')) {
      return
    }

    for (let attempt = 0; attempt < GATEWAY_EVENTS_DRAIN_MAX_ATTEMPTS; attempt += 1) {
      const response = await pullGatewayEventsViaBridge({
        instanceId: targetInstanceId,
        maxEvents: GATEWAY_EVENTS_MAX_EVENTS
      })

      if (!response.success || response.events.length === 0) {
        return
      }
    }
  }, [])

  const reloadConversation = useCallback(
    async (
      targetInstanceId: string,
      options?: {
        clearMessages?: boolean
      }
    ): Promise<void> => {
      const clearMessages = options?.clearMessages ?? true
      const requestId = getConversationRuntime().historyRequestId + 1
      patchConversationRuntime({
        historyRequestId: requestId
      })

      if (!hasAppApiMethod('requestGateway')) {
        const errorMessage = getAppApiUnavailableMessage('requestGateway')
        if (clearMessages) {
          updateConversationRuntime((current) => ({
            ...current,
            messages: [],
            messageTraces: {},
            liveAssistantRunStateByRunId: {},
            streamingHistoryRunIds: [],
            pendingHistoryFallbackRunIdToExpiresAt: {},
            hasResolvedHistorySnapshot: false
          }))
        }
        setLoadingHistory(false)
        setHistoryError(errorMessage)
        setHasResolvedHistorySnapshot(true)
        throw new Error(errorMessage)
      }

      if (clearMessages) {
        updateConversationRuntime((current) => ({
          ...current,
          messages: [],
          messageTraces: {},
          liveAssistantRunStateByRunId: {},
          streamingHistoryRunIds: [],
          pendingHistoryFallbackRunIdToExpiresAt: {}
        }))
      }
      setHasResolvedHistorySnapshot(false)
      setHistoryError(null)
      setLoadingHistory(true)

      try {
        try {
          await requestGatewayMethod(
            targetInstanceId,
            'chat.subscribe',
            {
              sessionKey
            },
            {
              timeoutMs: GATEWAY_REQUEST_TIMEOUT_MS.subscribe
            }
          )
        } catch {
          // Ignore subscribe failures and continue with polling.
        }

        const historyPayload = await requestGatewayMethod(
          targetInstanceId,
          'chat.history',
          {
            sessionKey
          },
          {
            timeoutMs: GATEWAY_REQUEST_TIMEOUT_MS.history
          }
        )

        const mappedMessages = mapGatewayHistoryMessages(historyPayload)
        const mappedTraces = mapGatewayHistoryMessageTraces(historyPayload)

        if (getConversationRuntime().historyRequestId === requestId) {
          const latestRuntime = getConversationRuntime()
          if (shouldApplyAuthoritativeHistorySnapshot(latestRuntime, mappedMessages)) {
            updateConversationRuntime((current) => ({
              ...current,
              messages: mappedMessages,
              messageTraces: mappedTraces,
              liveAssistantRunStateByRunId: {},
              streamingHistoryRunIds: [],
              pendingHistoryFallbackRunIdToExpiresAt: {}
            }))
          }
          setHasResolvedHistorySnapshot(true)
        }
      } catch (error) {
        if (getConversationRuntime().historyRequestId === requestId) {
          setHistoryError(error instanceof Error ? error.message : '聊天记录加载失败')
          setHasResolvedHistorySnapshot(true)
        }
        throw error
      } finally {
        if (getConversationRuntime().historyRequestId === requestId) {
          setLoadingHistory(false)
        }
      }

      await pullGatewayEvents(targetInstanceId)
    },
    [
      getConversationRuntime,
      patchConversationRuntime,
      pullGatewayEvents,
      sessionKey,
      setHasResolvedHistorySnapshot,
      setHistoryError,
      setLoadingHistory,
      setMessageTraces,
      setMessages,
      updateConversationRuntime
    ]
  )

  const resolveWorkspacePathForImageUpload = useCallback(
    async (targetInstanceId: string): Promise<string> => {
      const cachedWorkspacePath =
        useGatewayConversationStore.getState().workspacePathByInstanceId[targetInstanceId]
      if (cachedWorkspacePath) {
        return cachedWorkspacePath
      }

      const configPayload = await requestGatewayMethod(targetInstanceId, 'config.get', {}, {
        timeoutMs: GATEWAY_REQUEST_TIMEOUT_MS.history
      })
      const workspacePath = parseWorkspacePathFromConfigPayload(configPayload)

      if (!workspacePath) {
        throw new Error(
          '未配置 agents.defaults.workspace，无法上传图片。请先在设置页补充工作区路径。'
        )
      }

      useGatewayConversationStore.getState().setWorkspacePath(targetInstanceId, workspacePath)
      return workspacePath
    },
    []
  )

  useEffect(() => {
    if (!instanceId) {
      setLoadingHistory(false)
      return
    }

    if (!isConversationActive) {
      setLoadingHistory(false)
      return
    }

    const initializeConversation = async (): Promise<void> => {
      try {
        await reloadConversation(instanceId, { clearMessages: false })
      } catch {
        // Errors are already reflected in hook state.
      }
    }

    void initializeConversation()
  }, [instanceId, isConversationActive, reloadConversation])

  useEffect(() => {
    if (!instanceId || !isConversationActive || resettingConversation) {
      return
    }

    let cancelled = false
    let timeoutId: number | null = null

    const scheduleNextPull = (delayMs: number): void => {
      timeoutId = window.setTimeout(() => {
        void runPullLoop()
      }, delayMs)
    }

    const runPullLoop = async (): Promise<void> => {
      await pullGatewayEvents(instanceId)

      if (!cancelled) {
        scheduleNextPull(chatPollIntervalMs)
      }
    }

    scheduleNextPull(chatPollIntervalMs)

    return () => {
      cancelled = true

      if (timeoutId !== null) {
        window.clearTimeout(timeoutId)
      }
    }
  }, [
    chatPollIntervalMs,
    instanceId,
    isConversationActive,
    pullGatewayEvents,
    resettingConversation
  ])

  const sendMessage = useCallback(
    async (nextValue: string, options?: SendMessageOptions): Promise<void> => {
      if (!instanceId || !isConversationActive || resettingConversation) {
        return
      }

      const normalizedImages = (options?.images ?? []).filter(
        (image) =>
          Boolean(image.src?.trim()) ||
          (Boolean(image.relativePath?.trim()) && Boolean(image.absolutePath?.trim()))
      )
      const normalizedUserTags = (options?.userTags ?? []).flatMap((tag) => {
        const label = tag.label?.trim()
        if (!label) {
          return []
        }

        return [
          {
            type: tag.type,
            label,
            previewSrc: tag.previewSrc?.trim() || undefined,
            relativePath: tag.relativePath?.trim() || undefined,
            absolutePath: tag.absolutePath?.trim() || undefined
          }
        ]
      })
      const hasImages = normalizedImages.length > 0
      const normalizedText = nextValue.trim()
      if (!normalizedText && !hasImages) {
        return
      }

      if (!hasAppApiMethod('requestGateway')) {
        setHistoryError(getAppApiUnavailableMessage('requestGateway'))
        return
      }

      const userVisibleMessage = normalizedText || buildImageOnlyUserMessage(normalizedImages)

      const submittedAt = new Date()
      const runId = createChatRunId()
      const userMessageId = `user-${runId}`
      const assistantMessageId = createAssistantMessageId(runId)
      updateConversationRuntime((current) => {
        const { [runId]: _removedRunId, ...nextPendingHistoryFallbackRunIdToExpiresAt } =
          current.pendingHistoryFallbackRunIdToExpiresAt

        return {
          ...current,
          liveAssistantRunStateByRunId: {
            ...current.liveAssistantRunStateByRunId,
            [runId]: createLiveAssistantRunState(runId)
          },
          pendingHistoryFallbackRunIdToExpiresAt: nextPendingHistoryFallbackRunIdToExpiresAt
        }
      })

      setSubmitting(true)

      startTransition(() => {
        setMessages((currentMessages) => [
          ...currentMessages,
          {
            id: userMessageId,
            role: 'user',
            content: userVisibleMessage,
            tags: normalizedUserTags,
            timeLabel: formatConversationTime(submittedAt),
            status: 'sending'
          },
          {
            id: assistantMessageId,
            runId,
            role: 'assistant',
            content: '',
            timeLabel: formatConversationTime(submittedAt),
            status: 'streaming'
          }
        ])
      })

      try {
        if (options) {
          const modelOverride = normalizeModelOverride(options.model)
          if (modelOverride) {
            const sessionModelOverrideKey = buildGatewayConversationRuntimeKey(instanceId, sessionKey)
            const storeState = useGatewayConversationStore.getState()
            const previousModelOverride =
              storeState.sessionModelOverrideByConversationKey[sessionModelOverrideKey]
            const shouldPatchModelOverride =
              previousModelOverride !== modelOverride

            if (shouldPatchModelOverride) {
              await requestGatewayMethod(
                instanceId,
                'sessions.patch',
                {
                  key: sessionKey,
                  model: modelOverride
                },
                {
                  timeoutMs: GATEWAY_REQUEST_TIMEOUT_MS.sessionPatch
                }
              )

              useGatewayConversationStore
                .getState()
                .setSessionModelOverride(sessionModelOverrideKey, modelOverride)
            }
          }
        }

        let gatewayMessage = nextValue
        if (hasImages) {
          if (!options?.connectionConfig) {
            throw new Error('当前实例缺少连接配置，无法上传图片。')
          }
          const workspacePath = await resolveWorkspacePathForImageUpload(instanceId)
          const uploadedImages = await uploadChatImagesToWorkspace({
            images: normalizedImages,
            workspacePath,
            connectionConfig: options?.connectionConfig
          })
          gatewayMessage = buildImageUnderstandingPrompt({
            userMessage: nextValue,
            images: uploadedImages
          })
        }

        const normalizedGatewayMessage = gatewayMessage.trim()
        const sendParams = {
          sessionKey,
          message: normalizedGatewayMessage || userVisibleMessage,
          deliver: false,
          idempotencyKey: runId
        }

        await requestGatewayMethod(instanceId, 'chat.send', sendParams, {
          timeoutMs: GATEWAY_REQUEST_TIMEOUT_MS.chatSend
        })

        startTransition(() => {
          setMessages((currentMessages) =>
            currentMessages.map((message) =>
              message.id === userMessageId && message.role === 'user'
                ? { ...message, status: 'sent' as const }
                : message
            )
          )
        })

        await pullGatewayEvents(instanceId)
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : '消息发送失败'

        startTransition(() => {
          setMessages((currentMessages) => {
            const nextMessages = currentMessages.map((message) =>
              message.id === userMessageId && message.role === 'user'
                ? { ...message, status: 'error' as const }
                : message
            )

            return upsertAssistantMessage(
              nextMessages.filter((message) => message.id !== assistantMessageId),
              createAssistantErrorMessage(errorMessage)
            )
          })
        })

        updateConversationRuntime((current) => {
          const { [runId]: _removedLiveRunId, ...nextLiveAssistantRunStateByRunId } =
            current.liveAssistantRunStateByRunId
          const { [runId]: _removedPendingRunId, ...nextPendingHistoryFallbackRunIdToExpiresAt } =
            current.pendingHistoryFallbackRunIdToExpiresAt

          return {
            ...current,
            liveAssistantRunStateByRunId: nextLiveAssistantRunStateByRunId,
            pendingHistoryFallbackRunIdToExpiresAt: nextPendingHistoryFallbackRunIdToExpiresAt
          }
        })
      } finally {
        setSubmitting(false)
      }
    },
    [
      instanceId,
      isConversationActive,
      pullGatewayEvents,
      resettingConversation,
      resolveWorkspacePathForImageUpload,
      sessionKey,
      setSubmitting,
      updateConversationRuntime
    ]
  )

  const resetConversation = useCallback(async (): Promise<void> => {
    if (!instanceId || !isConversationActive || resettingConversation) {
      return
    }

    if (!hasAppApiMethod('requestGateway')) {
      const errorMessage = getAppApiUnavailableMessage('requestGateway')
      setHistoryError(errorMessage)
      throw new Error(errorMessage)
    }

    setResettingConversation(true)
    setHistoryError(null)

    try {
      await drainGatewayEvents(instanceId)

      await requestGatewayMethod(
        instanceId,
        'sessions.reset',
        {
          key: sessionKey,
          reason: 'new'
        },
        {
          timeoutMs: GATEWAY_REQUEST_TIMEOUT_MS.sessionReset
        }
      )

      await drainGatewayEvents(instanceId)
      await reloadConversation(instanceId, { clearMessages: true })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '清空当前对话失败'
      setHistoryError(errorMessage)
      throw error instanceof Error ? error : new Error(errorMessage)
    } finally {
      setResettingConversation(false)
    }
  }, [
    drainGatewayEvents,
    instanceId,
    isConversationActive,
    reloadConversation,
    resettingConversation,
    sessionKey
  ])

  return {
    messages,
    messageTraces,
    loadingHistory,
    showHistoryLoadingState,
    historyError,
    submitting,
    resettingConversation,
    canResetConversation,
    sendMessage,
    resetConversation
  }
}
