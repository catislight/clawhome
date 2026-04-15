import { formatConversationTime } from '@/features/chat/lib/gateway-chat'
import type {
  ConversationMessage,
  ConversationMessageStatus
} from '@/shared/contracts/chat-conversation'

export type LiveAssistantRunState = {
  currentMessageId: string
  segmentIndex: number
  sawAssistantEvent: boolean
  lastAssistantText: string
}

export const NON_STREAMING_HISTORY_FALLBACK_WINDOW_MS = 8_000

export function createChatRunId(): string {
  return `ui-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

export function createAssistantMessageId(runId: string): string {
  return `assistant-${runId}`
}

export function createAssistantSegmentMessageId(runId: string, segmentIndex: number): string {
  return segmentIndex === 0
    ? createAssistantMessageId(runId)
    : `assistant-${runId}-segment-${segmentIndex}`
}

export function createLiveAssistantRunState(runId: string): LiveAssistantRunState {
  return {
    currentMessageId: createAssistantSegmentMessageId(runId, 0),
    segmentIndex: 0,
    sawAssistantEvent: false,
    lastAssistantText: ''
  }
}

export function createAssistantErrorMessage(errorMessage: string): ConversationMessage {
  return {
    id: `assistant-error-${Date.now()}`,
    role: 'assistant',
    content: `发送失败：${errorMessage}`,
    timeLabel: formatConversationTime(new Date()),
    status: 'error'
  }
}

export function upsertAssistantMessage(
  messages: ConversationMessage[],
  message: ConversationMessage
): ConversationMessage[] {
  const targetIndex = messages.findIndex((item) => item.id === message.id)

  if (targetIndex === -1) {
    return [...messages, message]
  }

  const nextMessages = [...messages]
  nextMessages[targetIndex] = {
    ...nextMessages[targetIndex],
    ...message
  }
  return nextMessages
}

export function updateAssistantMessageStatus(
  messages: ConversationMessage[],
  messageId: string,
  status: ConversationMessageStatus | undefined
): ConversationMessage[] {
  return messages.map((message) =>
    message.id === messageId && message.role === 'assistant' ? { ...message, status } : message
  )
}

export function removeAssistantMessagesByRunId(
  messages: ConversationMessage[],
  runId: string
): ConversationMessage[] {
  return messages.filter((message) => message.runId !== runId)
}

export function resolveConversationTimeLabel(receivedAt?: string): string {
  return formatConversationTime(receivedAt ? new Date(receivedAt) : new Date())
}

export function normalizeModelOverride(model: string | null | undefined): string | null {
  const normalized = model?.trim()
  return normalized ? normalized : null
}
