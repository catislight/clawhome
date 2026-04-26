import {
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type SetStateAction
} from 'react'

import {
  DEFAULT_CHAT_SESSION_KEY,
  formatConversationTime,
  isSilentAssistantReply,
  isSilentAssistantReplyFragment,
  isSameGatewaySessionKey,
  parseGatewayChatEvent
} from '@/features/chat/lib/gateway-chat'
import {
  GATEWAY_CHAT_POLL_INTERVAL_MS,
  GATEWAY_EVENTS_DRAIN_MAX_ATTEMPTS,
  GATEWAY_EVENTS_MAX_EVENTS,
  GATEWAY_REQUEST_TIMEOUT_MS
} from '@/features/chat/lib/chat-constants'
import {
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
  loadChatConversationSnapshot,
  saveChatConversationSnapshot,
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
  aborting: boolean
  isConversationRunning: boolean
  resettingConversation: boolean
  canResetConversation: boolean
  abortConversation: () => Promise<void>
  sendMessage: (nextValue: string, options?: SendMessageOptions) => Promise<void>
  resetConversation: () => Promise<void>
}

type SendMessageOptions = {
  model?: string | null
  images?: ChatSubmitImage[]
  userTags?: ChatSubmitTag[]
  connectionConfig?: SshConnectionFormValues | null
}

function hasAssistantRunIds(messages: ConversationMessage[]): boolean {
  return messages.some((message) => message.role === 'assistant' && Boolean(message.runId?.trim()))
}

function toPersistedConversationSnapshot(
  messages: ConversationMessage[],
  messageTraces: Record<string, ConversationRunTrace>
): {
  updatedAt: number
  messages: Array<{
    id: string
    role: 'assistant' | 'user'
    content: string
    timeLabel: string
    status?: 'sending' | 'sent' | 'streaming' | 'error'
    runId?: string
    tags?: Array<{
      type: 'image' | 'attachment' | 'text'
      label: string
      previewSrc?: string
      relativePath?: string
      absolutePath?: string
    }>
  }>
  runTraces: Array<ConversationRunTrace & { runId: string }>
} {
  return {
    updatedAt: Date.now(),
    messages: messages.flatMap((message) => {
      if (message.role !== 'assistant' && message.role !== 'user') {
        return []
      }

      const status =
        message.status === 'sending' ||
        message.status === 'sent' ||
        message.status === 'streaming' ||
        message.status === 'error'
          ? message.status
          : undefined

      return [
        {
          id: message.id,
          role: message.role,
          content: message.content,
          timeLabel: message.timeLabel,
          ...(status ? { status } : {}),
          ...(message.runId?.trim() ? { runId: message.runId.trim() } : {}),
          ...(message.tags && message.tags.length > 0 ? { tags: message.tags } : {})
        }
      ]
    }),
    runTraces: Object.entries(messageTraces).flatMap(([runId, trace]) => {
      const normalizedRunId = runId.trim()
      if (!normalizedRunId) {
        return []
      }

      return [
        {
          runId: normalizedRunId,
          ...trace
        }
      ]
    })
  }
}

function mapPersistedRunTraces(
  runTraces: Array<ConversationRunTrace & { runId: string }>
): Record<string, ConversationRunTrace> {
  return runTraces.reduce<Record<string, ConversationRunTrace>>((current, runTrace) => {
    const normalizedRunId = runTrace.runId.trim()
    if (!normalizedRunId) {
      return current
    }

    current[normalizedRunId] = {
      skills: runTrace.skills,
      tools: runTrace.tools,
      toolLogs: runTrace.toolLogs,
      activeToolCallIds: runTrace.activeToolCallIds,
      activeToolCalls: runTrace.activeToolCalls,
      isGenerating: runTrace.isGenerating
    }
    return current
  }, {})
}

function finalizeRunTraces(
  traces: Record<string, ConversationRunTrace>,
  completedRunIds: Set<string>
): Record<string, ConversationRunTrace> {
  if (completedRunIds.size === 0) {
    return traces
  }

  let hasChanged = false
  const nextTraces: Record<string, ConversationRunTrace> = { ...traces }

  for (const runId of completedRunIds) {
    const currentTrace = nextTraces[runId]
    if (!currentTrace) {
      continue
    }

    if (
      currentTrace.activeToolCallIds.length === 0 &&
      currentTrace.activeToolCalls.length === 0 &&
      !currentTrace.isGenerating
    ) {
      continue
    }

    nextTraces[runId] = {
      ...currentTrace,
      activeToolCallIds: [],
      activeToolCalls: [],
      isGenerating: false
    }
    hasChanged = true
  }

  return hasChanged ? nextTraces : traces
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
  const aborting = conversationRuntime.aborting
  const resettingConversation = conversationRuntime.resettingConversation
  const localSnapshotHydratedConversationKeyRef = useRef<string | null>(null)
  const localSnapshotHydratedRef = useRef(false)
  const [localSnapshotHydratedConversationKey, setLocalSnapshotHydratedConversationKey] = useState<
    string | null
  >(null)

  useEffect(() => {
    if (!conversationRuntimeKey) {
      return
    }

    ensureConversation(conversationRuntimeKey)
  }, [conversationRuntimeKey, ensureConversation])

  useEffect(() => {
    localSnapshotHydratedConversationKeyRef.current = conversationRuntimeKey
    localSnapshotHydratedRef.current = false
    setLocalSnapshotHydratedConversationKey(null)
  }, [conversationRuntimeKey])

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
    (
      updater: (current: GatewayConversationRuntimeState) => GatewayConversationRuntimeState
    ): void => {
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
            ? (
                nextState as (
                  traces: Record<string, ConversationRunTrace>
                ) => Record<string, ConversationRunTrace>
              )(current.messageTraces)
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

  const setAborting = useCallback(
    (nextAborting: boolean): void => {
      patchConversationRuntime({
        aborting: nextAborting
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
  const isConversationActive = enabled && Boolean(instanceId)
  const isConversationRunning =
    isConversationActive && (submitting || aborting || hasStreamingAssistantMessage)
  const chatPollIntervalMs =
    hasStreamingAssistantMessage || submitting || aborting
      ? GATEWAY_CHAT_POLL_INTERVAL_MS.busy
      : GATEWAY_CHAT_POLL_INTERVAL_MS.idle
  const showHistoryLoadingState =
    isConversationActive &&
    !historyError &&
    messages.length === 0 &&
    (loadingHistory || !hasResolvedHistorySnapshot)
  const canResetConversation =
    isConversationActive && !resettingConversation && !isConversationRunning

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

            if (
              parsedAgentEvent.phase === 'end' &&
              streamingHistoryRunIds.has(parsedAgentEvent.runId)
            ) {
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

              const isAgentDrivenRun =
                agentDrivenRunIds.has(parsed.runId) || Boolean(liveRunState?.sawAssistantEvent)
              if (isAgentDrivenRun && parsed.state === 'delta') {
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

              const hasVisibleCurrentMessage = nextMessages.some(
                (message) =>
                  message.id === assistantMessageId &&
                  message.role === 'assistant' &&
                  message.content.trim().length > 0
              )

              if (!content) {
                if (parsed.state !== 'error' && hasVisibleCurrentMessage) {
                  nextMessages = updateAssistantMessageStatus(
                    nextMessages,
                    assistantMessageId,
                    undefined
                  )
                  completedStreamingRunIds.add(parsed.runId)
                  streamingHistoryRunIds.delete(parsed.runId)
                  delete pendingHistoryFallbackRunIdToExpiresAt[parsed.runId]
                  delete liveRunStates[parsed.runId]
                  continue
                }

                if (
                  parsed.state !== 'error' &&
                  pendingHistoryFallbackRunIdToExpiresAt[parsed.runId]
                ) {
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
                if (parsed.state === 'final') {
                  completedStreamingRunIds.add(parsed.runId)
                  streamingHistoryRunIds.delete(parsed.runId)
                  delete pendingHistoryFallbackRunIdToExpiresAt[parsed.runId]
                }
                delete liveRunStates[parsed.runId]
              }
            }

            return nextMessages
          })

          setMessageTraces((current) =>
            finalizeRunTraces(
              removeRunTracesByRunId(
                reduceRunTracesFromGatewayEvents(current, events, sessionKey),
                abortedRunIds
              ),
              completedStreamingRunIds
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
            })(),
            activeRunId: (() => {
              const currentActiveRunId = current.activeRunId
              if (currentActiveRunId && currentActiveRunId in liveRunStates) {
                return currentActiveRunId
              }

              if (
                currentActiveRunId &&
                (abortedRunIds.includes(currentActiveRunId) ||
                  completedStreamingRunIds.has(currentActiveRunId))
              ) {
                return null
              }

              return Object.keys(liveRunStates).at(-1) ?? null
            })(),
            aborting: current.aborting && Object.keys(liveRunStates).length > 0
          }))
        })
      } finally {
        patchConversationRuntime({
          gatewayPullInFlight: false
        })
      }
    },
    [
      getConversationRuntime,
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
        setHistoryError(errorMessage)
        setHasResolvedHistorySnapshot(true)
        setLoadingHistory(false)
        return
      }

      if (clearMessages) {
        updateConversationRuntime((current) => ({
          ...current,
          messages: [],
          messageTraces: {},
          liveAssistantRunStateByRunId: {},
          streamingHistoryRunIds: [],
          pendingHistoryFallbackRunIdToExpiresAt: {},
          activeRunId: null,
          aborting: false
        }))
      }
      setHasResolvedHistorySnapshot(false)
      setHistoryError(null)
      setLoadingHistory(true)

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
      } catch (error) {
        if (getConversationRuntime().historyRequestId === requestId) {
          setHistoryError(error instanceof Error ? error.message : '会话订阅失败')
          setHasResolvedHistorySnapshot(true)
        }
      } finally {
        if (getConversationRuntime().historyRequestId === requestId) {
          setLoadingHistory(false)
          setHasResolvedHistorySnapshot(true)
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

      const configPayload = await requestGatewayMethod(
        targetInstanceId,
        'config.get',
        {},
        {
          timeoutMs: GATEWAY_REQUEST_TIMEOUT_MS.history
        }
      )
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
    if (!conversationRuntimeKey || !instanceId || !isConversationActive) {
      localSnapshotHydratedRef.current = true
      setLocalSnapshotHydratedConversationKey(conversationRuntimeKey)
      return
    }

    if (!hasAppApiMethod('loadChatConversationSnapshot')) {
      localSnapshotHydratedRef.current = true
      setLocalSnapshotHydratedConversationKey(conversationRuntimeKey)
      return
    }

    let cancelled = false
    const targetConversationRuntimeKey = conversationRuntimeKey

    const loadLocalSnapshot = async (): Promise<void> => {
      try {
        const response = await loadChatConversationSnapshot({
          instanceId,
          sessionKey
        })

        if (
          cancelled ||
          !response.success ||
          !response.snapshot ||
          localSnapshotHydratedConversationKeyRef.current !== targetConversationRuntimeKey
        ) {
          return
        }

        const snapshotMessages = response.snapshot.messages.flatMap((message) =>
          message.role === 'assistant' || message.role === 'user' ? [message] : []
        )
        const snapshotMessageTraces = mapPersistedRunTraces(
          response.snapshot.runTraces as Array<ConversationRunTrace & { runId: string }>
        )

        updateConversationRuntime((current) => {
          const canHydrateOverHistoryOnlyRuntime =
            current.messages.length > 0 &&
            !hasAssistantRunIds(current.messages) &&
            Object.keys(current.messageTraces).length === 0 &&
            (snapshotMessages.length > 0 || Object.keys(snapshotMessageTraces).length > 0)

          if (
            current.submitting ||
            current.aborting ||
            (!canHydrateOverHistoryOnlyRuntime &&
              (current.messages.length > 0 || Object.keys(current.messageTraces).length > 0))
          ) {
            return current
          }

          return {
            ...current,
            messages: snapshotMessages,
            messageTraces: snapshotMessageTraces
          }
        })
      } finally {
        if (
          !cancelled &&
          localSnapshotHydratedConversationKeyRef.current === targetConversationRuntimeKey
        ) {
          localSnapshotHydratedRef.current = true
          setLocalSnapshotHydratedConversationKey(targetConversationRuntimeKey)
        }
      }
    }

    void loadLocalSnapshot()

    return () => {
      cancelled = true
    }
  }, [
    conversationRuntimeKey,
    instanceId,
    isConversationActive,
    sessionKey,
    updateConversationRuntime
  ])

  useEffect(() => {
    if (
      !instanceId ||
      !isConversationActive ||
      !localSnapshotHydratedRef.current ||
      localSnapshotHydratedConversationKey !== conversationRuntimeKey
    ) {
      return
    }

    if (!hasAppApiMethod('saveChatConversationSnapshot')) {
      return
    }

    if (
      messages.length === 0 &&
      Object.keys(messageTraces).length === 0 &&
      !hasResolvedHistorySnapshot
    ) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      const currentRuntime = getConversationRuntime()
      const snapshot = toPersistedConversationSnapshot(
        currentRuntime.messages,
        currentRuntime.messageTraces
      )
      void saveChatConversationSnapshot({
        instanceId,
        sessionKey,
        snapshot
      }).catch(() => undefined)
    }, 240)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [
    getConversationRuntime,
    hasResolvedHistorySnapshot,
    instanceId,
    isConversationActive,
    conversationRuntimeKey,
    localSnapshotHydratedConversationKey,
    messageTraces,
    messages,
    sessionKey
  ])

  useEffect(() => {
    if (!isConversationActive || submitting || aborting || hasStreamingAssistantMessage) {
      return
    }

    updateConversationRuntime((current) => {
      if (
        !current.activeRunId &&
        Object.keys(current.liveAssistantRunStateByRunId).length === 0 &&
        current.streamingHistoryRunIds.length === 0
      ) {
        return current
      }

      return {
        ...current,
        activeRunId: null,
        liveAssistantRunStateByRunId: {},
        streamingHistoryRunIds: [],
        aborting: false
      }
    })
  }, [
    aborting,
    hasStreamingAssistantMessage,
    isConversationActive,
    submitting,
    updateConversationRuntime
  ])

  useEffect(() => {
    if (!instanceId) {
      setLoadingHistory(false)
      return
    }

    if (!isConversationActive) {
      setLoadingHistory(false)
      return
    }

    if (conversationRuntimeKey && localSnapshotHydratedConversationKey !== conversationRuntimeKey) {
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
  }, [
    conversationRuntimeKey,
    instanceId,
    isConversationActive,
    localSnapshotHydratedConversationKey,
    reloadConversation,
    setLoadingHistory
  ])

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
        const nextPendingHistoryFallbackRunIdToExpiresAt = {
          ...current.pendingHistoryFallbackRunIdToExpiresAt
        }
        delete nextPendingHistoryFallbackRunIdToExpiresAt[runId]

        return {
          ...current,
          activeRunId: runId,
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
            const sessionModelOverrideKey = buildGatewayConversationRuntimeKey(
              instanceId,
              sessionKey
            )
            const storeState = useGatewayConversationStore.getState()
            const previousModelOverride =
              storeState.sessionModelOverrideByConversationKey[sessionModelOverrideKey]
            const shouldPatchModelOverride = previousModelOverride !== modelOverride

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
          const nextLiveAssistantRunStateByRunId = {
            ...current.liveAssistantRunStateByRunId
          }
          delete nextLiveAssistantRunStateByRunId[runId]
          const nextPendingHistoryFallbackRunIdToExpiresAt = {
            ...current.pendingHistoryFallbackRunIdToExpiresAt
          }
          delete nextPendingHistoryFallbackRunIdToExpiresAt[runId]

          return {
            ...current,
            activeRunId: current.activeRunId === runId ? null : current.activeRunId,
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
      setHistoryError,
      setMessages,
      setSubmitting,
      updateConversationRuntime
    ]
  )

  const resolveAbortRunId = useCallback(
    (runtime: GatewayConversationRuntimeState): string | null => {
      const normalizedActiveRunId = runtime.activeRunId?.trim()
      if (normalizedActiveRunId) {
        return normalizedActiveRunId
      }

      const liveRunId = Object.keys(runtime.liveAssistantRunStateByRunId).at(-1)
      if (liveRunId) {
        return liveRunId
      }

      for (let index = runtime.messages.length - 1; index >= 0; index -= 1) {
        const message = runtime.messages[index]
        if (message.role !== 'assistant' || message.status !== 'streaming') {
          continue
        }

        const runId = message.runId?.trim()
        if (runId) {
          return runId
        }
      }

      return null
    },
    []
  )

  const abortConversation = useCallback(async (): Promise<void> => {
    if (!instanceId || !isConversationActive || resettingConversation || aborting) {
      return
    }

    if (!hasAppApiMethod('requestGateway')) {
      const errorMessage = getAppApiUnavailableMessage('requestGateway')
      setHistoryError(errorMessage)
      return
    }

    const runtime = getConversationRuntime()
    const targetRunId = resolveAbortRunId(runtime)

    setAborting(true)
    try {
      await requestGatewayMethod(
        instanceId,
        'chat.abort',
        {
          sessionKey,
          ...(targetRunId ? { runId: targetRunId } : {})
        },
        {
          timeoutMs: GATEWAY_REQUEST_TIMEOUT_MS.chatAbort
        }
      )

      await pullGatewayEvents(instanceId)
    } catch (error) {
      setHistoryError(error instanceof Error ? error.message : '停止当前对话失败')
    } finally {
      setAborting(false)
    }
  }, [
    aborting,
    getConversationRuntime,
    instanceId,
    isConversationActive,
    pullGatewayEvents,
    resettingConversation,
    resolveAbortRunId,
    sessionKey,
    setAborting,
    setHistoryError
  ])

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
    sessionKey,
    setHistoryError,
    setResettingConversation
  ])

  return {
    messages,
    messageTraces,
    loadingHistory,
    showHistoryLoadingState,
    historyError,
    submitting,
    aborting,
    isConversationRunning,
    resettingConversation,
    canResetConversation,
    abortConversation,
    sendMessage,
    resetConversation
  }
}
