import { create } from 'zustand'

import { DEFAULT_CHAT_SESSION_KEY } from '@/features/chat/lib/gateway-chat'
import type {
  ConversationRunTrace
} from '@/features/chat/lib/gateway-run-trace'
import type {
  LiveAssistantRunState
} from '@/features/chat/lib/gateway-conversation-runtime'
import type { ConversationMessage } from '@/shared/contracts/chat-conversation'

export type GatewayConversationRuntimeState = {
  messages: ConversationMessage[]
  messageTraces: Record<string, ConversationRunTrace>
  loadingHistory: boolean
  hasResolvedHistorySnapshot: boolean
  historyError: string | null
  submitting: boolean
  resettingConversation: boolean
  gatewayPullInFlight: boolean
  historyRequestId: number
  liveAssistantRunStateByRunId: Record<string, LiveAssistantRunState>
  streamingHistoryRunIds: string[]
  pendingHistoryFallbackRunIdToExpiresAt: Record<string, number>
}

type GatewayConversationStoreState = {
  conversations: Record<string, GatewayConversationRuntimeState>
  workspacePathByInstanceId: Record<string, string>
  sessionModelOverrideByConversationKey: Record<string, string | null>
}

type GatewayConversationStoreActions = {
  ensureConversation: (conversationKey: string) => void
  updateConversation: (
    conversationKey: string,
    updater: (current: GatewayConversationRuntimeState) => GatewayConversationRuntimeState
  ) => void
  patchConversation: (
    conversationKey: string,
    patch: Partial<GatewayConversationRuntimeState>
  ) => void
  clearConversationsByInstanceId: (instanceId: string) => void
  setWorkspacePath: (instanceId: string, workspacePath: string) => void
  clearWorkspacePath: (instanceId: string) => void
  setSessionModelOverride: (conversationKey: string, modelOverride: string | null) => void
  clearSessionModelOverride: (conversationKey: string) => void
}

type GatewayConversationStore = GatewayConversationStoreState & GatewayConversationStoreActions

export function createInitialGatewayConversationRuntimeState(): GatewayConversationRuntimeState {
  return {
    messages: [],
    messageTraces: {},
    loadingHistory: false,
    hasResolvedHistorySnapshot: false,
    historyError: null,
    submitting: false,
    resettingConversation: false,
    gatewayPullInFlight: false,
    historyRequestId: 0,
    liveAssistantRunStateByRunId: {},
    streamingHistoryRunIds: [],
    pendingHistoryFallbackRunIdToExpiresAt: {}
  }
}

export const EMPTY_GATEWAY_CONVERSATION_RUNTIME_STATE: GatewayConversationRuntimeState =
  createInitialGatewayConversationRuntimeState()

export function buildGatewayConversationRuntimeKey(instanceId: string, sessionKey: string): string {
  const normalizedInstanceId = instanceId.trim()
  const normalizedSessionKey = sessionKey.trim().toLowerCase() || DEFAULT_CHAT_SESSION_KEY
  return `${normalizedInstanceId}::${normalizedSessionKey}`
}

function getInstanceConversationPrefix(instanceId: string): string {
  return `${instanceId.trim()}::`
}

function resolveConversationState(
  conversations: Record<string, GatewayConversationRuntimeState>,
  conversationKey: string
): GatewayConversationRuntimeState {
  return conversations[conversationKey] ?? createInitialGatewayConversationRuntimeState()
}

export const useGatewayConversationStore = create<GatewayConversationStore>()((set) => ({
  conversations: {},
  workspacePathByInstanceId: {},
  sessionModelOverrideByConversationKey: {},
  ensureConversation: (conversationKey) => {
    set((state) => {
      if (state.conversations[conversationKey]) {
        return state
      }

      return {
        conversations: {
          ...state.conversations,
          [conversationKey]: createInitialGatewayConversationRuntimeState()
        }
      }
    })
  },
  updateConversation: (conversationKey, updater) => {
    set((state) => {
      const currentConversation = resolveConversationState(state.conversations, conversationKey)
      const nextConversation = updater(currentConversation)

      if (nextConversation === currentConversation) {
        return state
      }

      return {
        conversations: {
          ...state.conversations,
          [conversationKey]: nextConversation
        }
      }
    })
  },
  patchConversation: (conversationKey, patch) => {
    set((state) => ({
      conversations: {
        ...state.conversations,
        [conversationKey]: {
          ...resolveConversationState(state.conversations, conversationKey),
          ...patch
        }
      }
    }))
  },
  clearConversationsByInstanceId: (instanceId) => {
    const prefix = getInstanceConversationPrefix(instanceId)
    set((state) => {
      const nextConversations = Object.fromEntries(
        Object.entries(state.conversations).filter(([conversationKey]) =>
          !conversationKey.startsWith(prefix)
        )
      )
      const nextSessionModelOverrides = Object.fromEntries(
        Object.entries(state.sessionModelOverrideByConversationKey).filter(([conversationKey]) =>
          !conversationKey.startsWith(prefix)
        )
      )

      if (
        Object.keys(nextConversations).length === Object.keys(state.conversations).length &&
        Object.keys(nextSessionModelOverrides).length ===
          Object.keys(state.sessionModelOverrideByConversationKey).length
      ) {
        return state
      }

      return {
        conversations: nextConversations,
        sessionModelOverrideByConversationKey: nextSessionModelOverrides
      }
    })
  },
  setWorkspacePath: (instanceId, workspacePath) => {
    set((state) => ({
      workspacePathByInstanceId: {
        ...state.workspacePathByInstanceId,
        [instanceId]: workspacePath
      }
    }))
  },
  clearWorkspacePath: (instanceId) => {
    set((state) => {
      if (!(instanceId in state.workspacePathByInstanceId)) {
        return state
      }

      const { [instanceId]: _removed, ...nextWorkspacePathByInstanceId } =
        state.workspacePathByInstanceId

      return {
        workspacePathByInstanceId: nextWorkspacePathByInstanceId
      }
    })
  },
  setSessionModelOverride: (conversationKey, modelOverride) => {
    set((state) => ({
      sessionModelOverrideByConversationKey: {
        ...state.sessionModelOverrideByConversationKey,
        [conversationKey]: modelOverride
      }
    }))
  },
  clearSessionModelOverride: (conversationKey) => {
    set((state) => {
      if (!(conversationKey in state.sessionModelOverrideByConversationKey)) {
        return state
      }

      const { [conversationKey]: _removed, ...nextSessionModelOverrideByConversationKey } =
        state.sessionModelOverrideByConversationKey

      return {
        sessionModelOverrideByConversationKey: nextSessionModelOverrideByConversationKey
      }
    })
  }
}))
