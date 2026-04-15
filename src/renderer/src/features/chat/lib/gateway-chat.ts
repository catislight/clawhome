import {
  isInternalMemoryFlushPrompt,
  sanitizeGatewayHistoryUserMessage
} from '@/features/chat/lib/gateway-chat-sanitize'
import { parseAgentScopedSessionKey } from '@/features/chat/lib/session-scope'
import type { ConversationMessage } from '@/shared/contracts/chat-conversation'
import { stripAssistantInternalScaffolding } from '@/shared/text/assistant-visible-text'

export const DEFAULT_CHAT_SESSION_KEY = 'main'
const SILENT_REPLY_TOKEN = 'NO_REPLY'
const SILENT_REPLY_RE = /^\s*NO_REPLY\s*$/i

type GatewayHistoryMessageLike = {
  id?: unknown
  role?: unknown
  content?: unknown
  text?: unknown
  runId?: unknown
  createdAt?: unknown
  timestamp?: unknown
  ts?: unknown
}

type GatewayChatEventPayload = {
  runId?: unknown
  sessionKey?: unknown
  state?: unknown
  message?: unknown
  errorMessage?: unknown
}

export type ParsedGatewayChatEvent = {
  runId: string
  sessionKey: string
  state: 'delta' | 'final' | 'aborted' | 'error'
  content: string
  errorMessage?: string
  timeLabel: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function parseAgentSessionKey(
  sessionKey: string | undefined | null
): { agentId: string; rest: string } | null {
  const parsed = parseAgentScopedSessionKey(sessionKey)
  if (!parsed) {
    return null
  }

  return {
    agentId: parsed.agentId,
    rest: parsed.scopedKey
  }
}

function normalizeTimestamp(value: unknown): Date | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return new Date(value > 1_000_000_000_000 ? value : value * 1000)
  }

  if (typeof value === 'string') {
    const numeric = Number(value)
    if (Number.isFinite(numeric) && value.trim() !== '') {
      return new Date(numeric > 1_000_000_000_000 ? numeric : numeric * 1000)
    }

    const parsed = Date.parse(value)
    if (!Number.isNaN(parsed)) {
      return new Date(parsed)
    }
  }

  return null
}

export function formatConversationTime(value: Date): string {
  return new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit'
  }).format(value)
}

export function isSameGatewaySessionKey(
  left: string | undefined,
  right: string | undefined
): boolean {
  const normalizedLeft = (left ?? '').trim().toLowerCase()
  const normalizedRight = (right ?? '').trim().toLowerCase()

  if (!normalizedLeft || !normalizedRight) {
    return false
  }

  if (normalizedLeft === normalizedRight) {
    return true
  }

  const parsedLeft = parseAgentSessionKey(normalizedLeft)
  const parsedRight = parseAgentSessionKey(normalizedRight)

  if (parsedLeft && parsedRight) {
    return parsedLeft.agentId === parsedRight.agentId && parsedLeft.rest === parsedRight.rest
  }

  if (parsedLeft) {
    return parsedLeft.rest === normalizedRight
  }

  if (parsedRight) {
    return normalizedLeft === parsedRight.rest
  }

  return false
}

function joinMarkdownTextParts(parts: string[]): string {
  const normalizedParts = parts
    .map((part) => part.replace(/\r\n/g, '\n'))
    .filter((part) => part.length > 0)

  if (normalizedParts.length === 0) {
    return ''
  }

  return normalizedParts.join('\n\n')
}

function collectTextParts(value: unknown): string[] {
  if (typeof value === 'string') {
    return [value]
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) => collectTextParts(item))
  }

  if (!isRecord(value)) {
    return []
  }

  const partType = typeof value.type === 'string' ? value.type.toLowerCase() : ''
  if (
    (partType === 'text' || partType === 'input_text' || partType === 'output_text') &&
    typeof value.text === 'string'
  ) {
    return [value.text]
  }

  if (typeof value.text === 'string') {
    return [value.text]
  }

  if (typeof value.content === 'string') {
    return [value.content]
  }

  if (Array.isArray(value.content)) {
    return value.content.flatMap((item) => collectTextParts(item))
  }

  if (Array.isArray(value.parts)) {
    return value.parts.flatMap((item) => collectTextParts(item))
  }

  return []
}

function normalizeMessageText(value: string): string {
  return stripAssistantInternalScaffolding(value)
    .replace(/\r\n/g, '\n')
    .replace(/^\n+/, '')
    .replace(/\n+$/, '')
}

function resolveMessageTimestamp(message: GatewayHistoryMessageLike): Date {
  return (
    normalizeTimestamp(message.createdAt) ??
    normalizeTimestamp(message.timestamp) ??
    normalizeTimestamp(message.ts) ??
    new Date()
  )
}

export function extractGatewayChatMessageText(message: unknown): string {
  return normalizeMessageText(joinMarkdownTextParts(collectTextParts(message)))
}

export function isSilentAssistantReply(content: string): boolean {
  return SILENT_REPLY_RE.test(content.trim())
}

export function isSilentAssistantReplyFragment(content: string): boolean {
  const normalized = content.trim().toUpperCase()

  if (!normalized || !/^[A-Z_]+$/.test(normalized)) {
    return false
  }

  return SILENT_REPLY_TOKEN.startsWith(normalized)
}

export function mapGatewayHistoryMessages(payload: unknown): ConversationMessage[] {
  if (!isRecord(payload) || !Array.isArray(payload.messages)) {
    return []
  }

  return payload.messages.flatMap((message, index) => {
    if (!isRecord(message)) {
      return []
    }

    const historyMessage = message as GatewayHistoryMessageLike
    const role = typeof historyMessage.role === 'string' ? historyMessage.role.toLowerCase() : ''
    if (role !== 'assistant' && role !== 'user') {
      return []
    }

    const rawContent = extractGatewayChatMessageText(historyMessage)
    const sanitizedUserMessage =
      role === 'user' ? sanitizeGatewayHistoryUserMessage(rawContent) : null
    const content = role === 'user' ? (sanitizedUserMessage?.content ?? '') : rawContent
    if (
      !content ||
      (role === 'assistant' && isSilentAssistantReply(content)) ||
      (role === 'user' && isInternalMemoryFlushPrompt(content))
    ) {
      return []
    }

    const idBase = typeof historyMessage.id === 'string' ? historyMessage.id : `${index}`
    const runId = typeof historyMessage.runId === 'string' ? historyMessage.runId : undefined

    return [
      {
        id: `history-${idBase}`,
        role,
        content,
        timeLabel: formatConversationTime(resolveMessageTimestamp(historyMessage)),
        status: role === 'user' ? 'sent' : undefined,
        runId,
        ...(role === 'user' && sanitizedUserMessage?.tags.length
          ? { tags: sanitizedUserMessage.tags }
          : {})
      }
    ]
  })
}

export function parseGatewayChatEvent(event: {
  event: string
  payload?: unknown
  receivedAt?: string
}): ParsedGatewayChatEvent | null {
  if (event.event !== 'chat' || !isRecord(event.payload)) {
    return null
  }

  const payload = event.payload as GatewayChatEventPayload
  const runId = typeof payload.runId === 'string' ? payload.runId : ''
  const sessionKey =
    typeof payload.sessionKey === 'string' && payload.sessionKey.trim().length > 0
      ? payload.sessionKey
      : DEFAULT_CHAT_SESSION_KEY
  const state = typeof payload.state === 'string' ? payload.state : ''

  if (state !== 'delta' && state !== 'final' && state !== 'aborted' && state !== 'error') {
    return null
  }

  const content = extractGatewayChatMessageText(payload.message)
  const errorMessage = typeof payload.errorMessage === 'string' ? payload.errorMessage : undefined
  const timeLabel = formatConversationTime(normalizeTimestamp(event.receivedAt) ?? new Date())

  return {
    runId,
    sessionKey,
    state,
    content,
    errorMessage,
    timeLabel
  }
}
