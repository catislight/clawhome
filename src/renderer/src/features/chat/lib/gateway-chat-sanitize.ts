import { stripEnvelope, stripMessageIdHints } from '@/shared/text/chat-envelope'
import { stripInboundMetadata } from '@/shared/text/strip-inbound-meta'
import type { ConversationUserTag } from '@/shared/contracts/chat-conversation'

const MEMORY_FLUSH_PROMPT_PREFIX = 'Pre-compaction memory flush.'
const MEMORY_FLUSH_TARGET_HINT = 'Store durable memories only in memory/'
const MEMORY_FLUSH_READ_ONLY_HINT =
  'Treat workspace bootstrap/reference files such as MEMORY.md, SOUL.md, TOOLS.md, and AGENTS.md as read-only during this flush'
const MEMORY_FLUSH_SILENT_HINT = 'reply with NO_REPLY'
const TRUSTED_SYSTEM_EVENT_START_RE = /^System:\s*\[[^\]\n]+\](?:\s|$)/
const TRUSTED_SYSTEM_EVENT_LINE_RE = /^System:/
const TRUSTED_SYSTEM_EVENT_BULLET_RE = /^System:\s*-\s+/
const TRUSTED_SYSTEM_EVENT_HINT_RE =
  /^System:\s*(?:\[Post-compaction context refresh\]|Current time:|Model switched\.?|Node connected\.?|Session was just compacted\.?|Critical rules from AGENTS\.md:)/i
const INJECTED_TIMESTAMP_PREFIX_RE =
  /^\[(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}(?::\d{2})?(?:\s+[^\]\n]+)?\](?:[ \t]+|$)/
const IMAGE_PROMPT_PREFIX = '你将收到一组图片文件。请先逐张读取图片内容，再回答用户请求。'
const IMAGE_PROMPT_LIST_MARKER = '图片列表：'
const IMAGE_PROMPT_REQUEST_MARKER = '用户请求：'

function stripLeadingTrustedSystemEventBlock(content: string): string {
  const lines = content.split('\n')
  const firstLine = lines[0] ?? ''
  if (!TRUSTED_SYSTEM_EVENT_LINE_RE.test(firstLine)) {
    return content
  }

  let index = 0
  let systemLineCount = 0
  let hasTimestampedSystemLine = false
  let hasLikelyAutoInjectedSystemLine = false
  while (index < lines.length && TRUSTED_SYSTEM_EVENT_LINE_RE.test(lines[index] ?? '')) {
    const line = lines[index] ?? ''
    systemLineCount += 1
    hasTimestampedSystemLine = hasTimestampedSystemLine || TRUSTED_SYSTEM_EVENT_START_RE.test(line)
    hasLikelyAutoInjectedSystemLine =
      hasLikelyAutoInjectedSystemLine ||
      TRUSTED_SYSTEM_EVENT_BULLET_RE.test(line) ||
      TRUSTED_SYSTEM_EVENT_HINT_RE.test(line)
    index += 1
  }

  const shouldStripSystemBlock =
    hasTimestampedSystemLine || hasLikelyAutoInjectedSystemLine || systemLineCount >= 2
  if (!shouldStripSystemBlock) {
    return content
  }

  while (index < lines.length && (lines[index] ?? '').trim() === '') {
    index += 1
  }

  // Preserve user-authored single-line `System:` messages when no additional content exists.
  if (systemLineCount === 1 && index >= lines.length) {
    return content
  }

  return lines.slice(index).join('\n')
}

function stripLeadingInjectedTimestampPrefix(content: string): string {
  return content.replace(INJECTED_TIMESTAMP_PREFIX_RE, '')
}

function parseImageTag(value: string): ConversationUserTag | null {
  const trimmed = value.trim()
  if (!trimmed) {
    return null
  }

  const absolutePathMatched = trimmed.match(/\(\s*absolute:\s*([^)]+)\)\s*$/i)
  const absolutePath = absolutePathMatched?.[1]?.trim() || undefined
  const relativeCandidate = trimmed
    .replace(/\(\s*absolute:\s*([^)]+)\)\s*$/i, '')
    .trim()
  const label = relativeCandidate
    .split(/[\\/]/)
    .filter(Boolean)
    .at(-1)

  if (!label) {
    return null
  }

  return {
    type: 'image',
    label,
    relativePath: relativeCandidate || undefined,
    absolutePath
  }
}

type SanitizedGatewayUserMessage = {
  content: string
  tags: ConversationUserTag[]
}

function parseInjectedImageUnderstandingPrompt(content: string): SanitizedGatewayUserMessage | null {
  const normalized = content.trim()
  if (!normalized.startsWith(IMAGE_PROMPT_PREFIX)) {
    return null
  }

  if (
    !normalized.includes(IMAGE_PROMPT_LIST_MARKER) ||
    !normalized.includes(IMAGE_PROMPT_REQUEST_MARKER)
  ) {
    return null
  }

  const requestMarkerIndex = normalized.lastIndexOf(IMAGE_PROMPT_REQUEST_MARKER)
  if (requestMarkerIndex < 0) {
    return null
  }

  const listMarkerIndex = normalized.indexOf(IMAGE_PROMPT_LIST_MARKER)
  const imageListChunk =
    listMarkerIndex >= 0
      ? normalized.slice(
          listMarkerIndex + IMAGE_PROMPT_LIST_MARKER.length,
          requestMarkerIndex
        )
      : ''
  const tags = imageListChunk
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => /^\d+\.\s+/.test(line))
    .flatMap((line) => {
      const parsedTag = parseImageTag(line.replace(/^\d+\.\s+/, ''))
      if (!parsedTag) {
        return []
      }

      return [parsedTag]
    })

  const userRequest = normalized
    .slice(requestMarkerIndex + IMAGE_PROMPT_REQUEST_MARKER.length)
    .trim()

  return {
    content: userRequest || '请理解我上传的图片内容。',
    tags
  }
}

export function sanitizeGatewayHistoryUserMessage(content: string): SanitizedGatewayUserMessage {
  const sanitized = stripMessageIdHints(stripEnvelope(stripInboundMetadata(content)))
  const injectedImageMessage = parseInjectedImageUnderstandingPrompt(sanitized)
  if (injectedImageMessage) {
    return injectedImageMessage
  }

  return {
    content: stripLeadingInjectedTimestampPrefix(stripLeadingTrustedSystemEventBlock(sanitized)),
    tags: []
  }
}

export function sanitizeGatewayHistoryUserContent(content: string): string {
  return sanitizeGatewayHistoryUserMessage(content).content
}

export function isInternalMemoryFlushPrompt(content: string): boolean {
  const normalized = content.trim()

  if (!normalized.startsWith(MEMORY_FLUSH_PROMPT_PREFIX)) {
    return false
  }

  return (
    normalized.includes(MEMORY_FLUSH_TARGET_HINT) &&
    normalized.includes(MEMORY_FLUSH_READ_ONLY_HINT) &&
    normalized.includes(MEMORY_FLUSH_SILENT_HINT)
  )
}
