import { useCallback, useEffect, useRef } from 'react'

import { hasAppApiMethod } from '@/shared/api/app-api'
import { requestGatewayMethod } from '@/shared/api/gateway-client'
import { mapGatewayHistoryMessages } from '@/features/chat/lib/gateway-chat'
import {
  mapGatewayHistoryMessageTraces,
  type ConversationRunTrace
} from '@/features/chat/lib/gateway-run-trace'
import type { ConversationMessage } from '@/shared/contracts/chat-conversation'

const STREAMING_HISTORY_RECONCILE_DELAY_MS = 120
const STREAMING_HISTORY_RECONCILE_TIMEOUT_MS = 15_000

export type StreamingHistorySnapshot = {
  messages: ConversationMessage[]
  messageTraces: Record<string, ConversationRunTrace>
}

type UseStreamingHistoryReconcileOptions = {
  enabled: boolean
  instanceId: string | null
  sessionKey: string
  hasStreamingAssistantMessage: boolean
  submitting: boolean
  onHistoryReconciled: (snapshot: StreamingHistorySnapshot) => void
}

type StreamingHistoryReconcileState = {
  enabled: boolean
  instanceId: string | null
  sessionKey: string
  hasStreamingAssistantMessage: boolean
  submitting: boolean
}

/**
 * Temporary workaround for streamed markdown indentation loss in upstream agent events.
 * Delete this hook and its call site once OpenClaw preserves markdown whitespace while streaming.
 */
export function useStreamingHistoryReconcile({
  enabled,
  instanceId,
  sessionKey,
  hasStreamingAssistantMessage,
  submitting,
  onHistoryReconciled
}: UseStreamingHistoryReconcileOptions): {
  markPendingStreamingHistoryReconcile: () => void
} {
  const pendingRef = useRef(false)
  const inFlightRef = useRef(false)
  const generationRef = useRef(0)
  const latestStateRef = useRef<StreamingHistoryReconcileState>({
    enabled,
    instanceId,
    sessionKey,
    hasStreamingAssistantMessage,
    submitting
  })

  latestStateRef.current = {
    enabled,
    instanceId,
    sessionKey,
    hasStreamingAssistantMessage,
    submitting
  }

  useEffect(() => {
    generationRef.current += 1
    pendingRef.current = false
    inFlightRef.current = false
  }, [enabled, instanceId, sessionKey])

  const markPendingStreamingHistoryReconcile = useCallback((): void => {
    const currentState = latestStateRef.current
    if (!currentState.enabled || !currentState.instanceId) {
      return
    }

    pendingRef.current = true
  }, [])

  const reconcileStreamingHistory = useCallback(async (): Promise<void> => {
    const currentState = latestStateRef.current

    if (
      !currentState.enabled ||
      !currentState.instanceId ||
      !pendingRef.current ||
      inFlightRef.current ||
      !hasAppApiMethod('requestGateway')
    ) {
      return
    }

    const reconcileGeneration = generationRef.current
    const reconcileInstanceId = currentState.instanceId
    const reconcileSessionKey = currentState.sessionKey

    pendingRef.current = false
    inFlightRef.current = true

    try {
      const historyPayload = await requestGatewayMethod(
        reconcileInstanceId,
        'chat.history',
        {
          sessionKey: reconcileSessionKey
        },
        {
          timeoutMs: STREAMING_HISTORY_RECONCILE_TIMEOUT_MS
        }
      )

      if (reconcileGeneration !== generationRef.current) {
        return
      }

      const latestState = latestStateRef.current
      if (
        !latestState.enabled ||
        latestState.instanceId !== reconcileInstanceId ||
        latestState.sessionKey !== reconcileSessionKey
      ) {
        return
      }

      if (latestState.hasStreamingAssistantMessage || latestState.submitting) {
        pendingRef.current = true
        return
      }

      onHistoryReconciled({
        messages: mapGatewayHistoryMessages(historyPayload),
        messageTraces: mapGatewayHistoryMessageTraces(historyPayload)
      })
    } catch {
      // Keep this workaround silent; the live transcript already rendered.
    } finally {
      if (reconcileGeneration === generationRef.current) {
        inFlightRef.current = false
      }
    }
  }, [onHistoryReconciled])

  useEffect(() => {
    if (
      !enabled ||
      !instanceId ||
      hasStreamingAssistantMessage ||
      submitting ||
      !pendingRef.current
    ) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      void reconcileStreamingHistory()
    }, STREAMING_HISTORY_RECONCILE_DELAY_MS)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [enabled, hasStreamingAssistantMessage, instanceId, reconcileStreamingHistory, submitting])

  return {
    markPendingStreamingHistoryReconcile
  }
}
