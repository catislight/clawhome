import type Database from 'better-sqlite3'

import type {
  ChatPersistenceConversationSnapshot,
  ChatPersistenceDeleteConversationSnapshotPayload,
  ChatPersistenceLoadConversationSnapshotPayload,
  ChatPersistenceSaveConversationSnapshotPayload,
  PersistedConversationRunTrace,
  PersistedConversationUserTag
} from '../preload/bridge-contract'
import { getChatPersistenceDatabase } from './chat-persistence-db'

const DEFAULT_CHAT_SESSION_KEY = 'main'

type MessageRow = {
  id: number
  message_uid: string
  role: string
  content: string
  status: string | null
  created_at: number
  metadata_json: string | null
  run_uid: string | null
}

type TagRow = {
  message_id: number
  tag_type: string
  label: string
  preview_src: string | null
  relative_path: string | null
  absolute_path: string | null
}

type RunRow = {
  id: number
  run_uid: string
  metadata_json: string | null
}

type ToolCallRow = {
  id: number
  run_id: number
  source_tool_call_id: string | null
  tool_name: string
  skill_name: string | null
  state: string
}

type ToolLogRow = {
  run_id: number
  tool_call_id: number | null
  source_event_id: string | null
  title: string
  content: string
  seq: number
}

type RunTraceMetadata = Pick<
  PersistedConversationRunTrace,
  'skills' | 'tools' | 'activeToolCallIds' | 'activeToolCalls' | 'isGenerating'
>

type ConversationRow = {
  id: number
  updated_at: number
}

type ConversationLookupRow = ConversationRow & {
  session_key: string
}

function normalizeNonEmptyString(value: string | null | undefined): string | null {
  const normalized = value?.trim()
  return normalized ? normalized : null
}

function normalizeSessionKey(sessionKey: string): string {
  const normalized = sessionKey.trim().toLowerCase()
  return normalized || DEFAULT_CHAT_SESSION_KEY
}

function buildConversationUid(instanceId: string, sessionKey: string): string {
  return `${instanceId.trim()}::${normalizeSessionKey(sessionKey)}`
}

function parseAgentScopedSessionKey(
  sessionKey: string | null | undefined
): { agentId: string; scopedKey: string } | null {
  const normalizedSessionKey = normalizeSessionKey(sessionKey ?? DEFAULT_CHAT_SESSION_KEY)
  if (!normalizedSessionKey.startsWith('agent:')) {
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

function isSameGatewaySessionKey(left: string | undefined, right: string | undefined): boolean {
  const normalizedLeft = normalizeSessionKey(left ?? DEFAULT_CHAT_SESSION_KEY)
  const normalizedRight = normalizeSessionKey(right ?? DEFAULT_CHAT_SESSION_KEY)

  if (normalizedLeft === normalizedRight) {
    return true
  }

  const parsedLeft = parseAgentScopedSessionKey(normalizedLeft)
  const parsedRight = parseAgentScopedSessionKey(normalizedRight)

  if (parsedLeft && parsedRight) {
    return (
      parsedLeft.agentId === parsedRight.agentId && parsedLeft.scopedKey === parsedRight.scopedKey
    )
  }

  if (parsedLeft) {
    return parsedLeft.scopedKey === normalizedRight
  }

  if (parsedRight) {
    return normalizedLeft === parsedRight.scopedKey
  }

  return false
}

function parseJsonObject(value: string | null): Record<string, unknown> {
  if (!value) {
    return {}
  }

  try {
    const parsed = JSON.parse(value)
    if (parsed && typeof parsed === 'object') {
      return parsed as Record<string, unknown>
    }
  } catch {
    // ignore invalid metadata payloads
  }

  return {}
}

function stringifyJson(value: unknown): string {
  return JSON.stringify(value)
}

function formatConversationTime(epochMs: number): string {
  return new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(epochMs))
}

function normalizeTagType(value: string): PersistedConversationUserTag['type'] {
  if (value === 'image' || value === 'attachment' || value === 'text') {
    return value
  }

  return 'text'
}

function normalizeLoadedMessageStatus(
  value: string | null,
  role: 'assistant' | 'user'
): 'sending' | 'sent' | 'streaming' | 'error' | undefined {
  if (role === 'assistant') {
    return value === 'error' ? 'error' : undefined
  }

  if (value === 'error') {
    return 'error'
  }

  if (value === 'sending' || value === 'sent') {
    return 'sent'
  }

  return undefined
}

function detectLogPhaseFromTitle(title: string): 'start' | 'update' | 'result' | 'error' | 'info' {
  const normalized = title.trim().toLowerCase()
  if (normalized.includes('· result')) {
    return 'result'
  }
  if (normalized.includes('· update')) {
    return 'update'
  }
  if (normalized.includes('· start')) {
    return 'start'
  }
  if (normalized.includes('error')) {
    return 'error'
  }
  return 'info'
}

function detectContentFormat(content: string): 'text' | 'json' | 'markdown' {
  const trimmed = content.trim()
  if (!trimmed) {
    return 'text'
  }
  if (
    (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
    (trimmed.startsWith('[') && trimmed.endsWith(']'))
  ) {
    return 'json'
  }
  if (trimmed.includes('```') || trimmed.includes('\n#')) {
    return 'markdown'
  }
  return 'text'
}

function appendUnique(values: string[], value: string): string[] {
  const normalized = value.trim()
  if (!normalized) {
    return values
  }
  return values.includes(normalized) ? values : [...values, normalized]
}

export class ChatPersistenceStore {
  private readonly database: Database.Database

  constructor(database: Database.Database = getChatPersistenceDatabase()) {
    this.database = database
  }

  private findConversation(instanceId: string, sessionKey: string): ConversationLookupRow | null {
    const normalizedInstanceId = instanceId.trim()
    const normalizedSessionKey = normalizeSessionKey(sessionKey)
    const exactConversation = this.database
      .prepare(
        `
SELECT id, updated_at, session_key
FROM chat_conversations
WHERE conversation_uid = ?
LIMIT 1
`
      )
      .get(buildConversationUid(normalizedInstanceId, normalizedSessionKey)) as
      | ConversationLookupRow
      | undefined

    if (exactConversation) {
      return exactConversation
    }

    const conversationsByInstance = this.database
      .prepare(
        `
SELECT id, updated_at, session_key
FROM chat_conversations
WHERE instance_id = ?
ORDER BY updated_at DESC
`
      )
      .all(normalizedInstanceId) as ConversationLookupRow[]

    return (
      conversationsByInstance.find((conversationRow) =>
        isSameGatewaySessionKey(conversationRow.session_key, normalizedSessionKey)
      ) ?? null
    )
  }

  loadConversationSnapshot(
    payload: ChatPersistenceLoadConversationSnapshotPayload
  ): ChatPersistenceConversationSnapshot | null {
    const conversation = this.findConversation(payload.instanceId, payload.sessionKey)

    if (!conversation) {
      return null
    }

    const messageRows = this.database
      .prepare(
        `
SELECT
  m.id,
  m.message_uid,
  m.role,
  m.content,
  m.status,
  m.created_at,
  m.metadata_json,
  r.run_uid
FROM chat_messages m
LEFT JOIN chat_runs r ON m.run_id = r.id
WHERE m.conversation_id = ? AND m.deleted_at IS NULL
ORDER BY m.seq ASC
`
      )
      .all(conversation.id) as MessageRow[]

    const tagRows = this.database
      .prepare(
        `
SELECT
  t.message_id,
  t.tag_type,
  t.label,
  t.preview_src,
  t.relative_path,
  t.absolute_path
FROM chat_message_tags t
JOIN chat_messages m ON m.id = t.message_id
WHERE m.conversation_id = ? AND m.deleted_at IS NULL
ORDER BY t.message_id ASC, t.seq ASC
`
      )
      .all(conversation.id) as TagRow[]

    const tagsByMessageId = tagRows.reduce<Record<number, PersistedConversationUserTag[]>>(
      (current, row) => {
        const tags = current[row.message_id] ?? []
        tags.push({
          type: normalizeTagType(row.tag_type),
          label: row.label,
          ...(normalizeNonEmptyString(row.preview_src)
            ? { previewSrc: row.preview_src ?? undefined }
            : {}),
          ...(normalizeNonEmptyString(row.relative_path)
            ? { relativePath: row.relative_path ?? undefined }
            : {}),
          ...(normalizeNonEmptyString(row.absolute_path)
            ? { absolutePath: row.absolute_path ?? undefined }
            : {})
        })
        current[row.message_id] = tags
        return current
      },
      {}
    )

    const messages = messageRows.flatMap((row) => {
      const role: 'assistant' | 'user' | null =
        row.role === 'assistant' ? 'assistant' : row.role === 'user' ? 'user' : null
      if (!role) {
        return []
      }

      const shouldSkipAssistantStreamingPlaceholder =
        role === 'assistant' && row.status === 'streaming' && row.content.trim().length === 0
      if (shouldSkipAssistantStreamingPlaceholder) {
        return []
      }

      const metadata = parseJsonObject(row.metadata_json)
      const timeLabel = normalizeNonEmptyString(
        typeof metadata.timeLabel === 'string' ? metadata.timeLabel : null
      )
      const normalizedStatus = normalizeLoadedMessageStatus(row.status, role)

      return [
        {
          id: row.message_uid,
          role,
          content: row.content,
          timeLabel: timeLabel ?? formatConversationTime(row.created_at),
          ...(normalizedStatus ? { status: normalizedStatus } : {}),
          ...(normalizeNonEmptyString(row.run_uid) ? { runId: row.run_uid ?? undefined } : {}),
          ...(tagsByMessageId[row.id]?.length ? { tags: tagsByMessageId[row.id] } : {})
        }
      ]
    })

    const runRows = this.database
      .prepare(
        `
SELECT id, run_uid, metadata_json
FROM chat_runs
WHERE conversation_id = ?
ORDER BY started_at ASC
`
      )
      .all(conversation.id) as RunRow[]

    const toolCallRows = this.database
      .prepare(
        `
SELECT
  id,
  run_id,
  source_tool_call_id,
  tool_name,
  skill_name,
  state
FROM chat_tool_calls
WHERE conversation_id = ?
ORDER BY run_id ASC, seq ASC
`
      )
      .all(conversation.id) as ToolCallRow[]

    const toolLogRows = this.database
      .prepare(
        `
SELECT
  run_id,
  tool_call_id,
  source_event_id,
  title,
  content,
  seq
FROM chat_tool_logs
WHERE conversation_id = ?
ORDER BY run_id ASC, seq ASC
`
      )
      .all(conversation.id) as ToolLogRow[]

    const toolCallsByRunId = toolCallRows.reduce<Record<number, ToolCallRow[]>>((current, row) => {
      const toolCalls = current[row.run_id] ?? []
      toolCalls.push(row)
      current[row.run_id] = toolCalls
      return current
    }, {})

    const toolLogsByRunId = toolLogRows.reduce<Record<number, ToolLogRow[]>>((current, row) => {
      const toolLogs = current[row.run_id] ?? []
      toolLogs.push(row)
      current[row.run_id] = toolLogs
      return current
    }, {})

    const runTraces: PersistedConversationRunTrace[] = runRows.map((runRow) => {
      const metadata = parseJsonObject(runRow.metadata_json)
      const metadataTrace = metadata as Partial<RunTraceMetadata>

      const toolCalls = toolCallsByRunId[runRow.id] ?? []
      const toolCallIdById = new Map<number, string>()
      for (const toolCall of toolCalls) {
        const sourceToolCallId =
          normalizeNonEmptyString(toolCall.source_tool_call_id) ?? `tool-call-${toolCall.id}`
        toolCallIdById.set(toolCall.id, sourceToolCallId)
      }

      const toolLogs = (toolLogsByRunId[runRow.id] ?? []).map((toolLogRow) => ({
        id:
          normalizeNonEmptyString(toolLogRow.source_event_id) ??
          `${runRow.run_uid}:${toolLogRow.seq}`,
        toolCallId:
          (toolLogRow.tool_call_id ? toolCallIdById.get(toolLogRow.tool_call_id) : null) ??
          `tool-call-${toolLogRow.seq}`,
        title: toolLogRow.title,
        content: toolLogRow.content
      }))

      const activeToolCalls =
        Array.isArray(metadataTrace.activeToolCalls) && metadataTrace.activeToolCalls.length > 0
          ? metadataTrace.activeToolCalls.flatMap((value) => {
              if (!value || typeof value !== 'object') {
                return []
              }

              const record = value as Record<string, unknown>
              const toolCallId = normalizeNonEmptyString(
                typeof record.toolCallId === 'string' ? record.toolCallId : null
              )
              const toolName = normalizeNonEmptyString(
                typeof record.toolName === 'string' ? record.toolName : null
              )

              if (!toolCallId || !toolName) {
                return []
              }

              const skillName = normalizeNonEmptyString(
                typeof record.skillName === 'string' ? record.skillName : null
              )

              return [
                {
                  toolCallId,
                  toolName,
                  ...(skillName ? { skillName } : {})
                }
              ]
            })
          : toolCalls
              .filter((toolCall) => toolCall.state === 'started' || toolCall.state === 'running')
              .map((toolCall) => ({
                toolCallId:
                  normalizeNonEmptyString(toolCall.source_tool_call_id) ??
                  `tool-call-${toolCall.id}`,
                toolName: toolCall.tool_name,
                ...(normalizeNonEmptyString(toolCall.skill_name)
                  ? { skillName: toolCall.skill_name ?? undefined }
                  : {})
              }))

      let nextSkills = Array.isArray(metadataTrace.skills)
        ? metadataTrace.skills.filter((skill): skill is string => typeof skill === 'string')
        : []
      let nextTools = Array.isArray(metadataTrace.tools)
        ? metadataTrace.tools.filter((tool): tool is string => typeof tool === 'string')
        : []

      for (const toolCall of toolCalls) {
        nextTools = appendUnique(nextTools, toolCall.tool_name)
        if (toolCall.skill_name) {
          nextSkills = appendUnique(nextSkills, toolCall.skill_name)
        }
      }

      const activeToolCallIds =
        Array.isArray(metadataTrace.activeToolCallIds) && metadataTrace.activeToolCallIds.length > 0
          ? metadataTrace.activeToolCallIds.filter(
              (toolCallId): toolCallId is string => typeof toolCallId === 'string'
            )
          : activeToolCalls.map((toolCall) => toolCall.toolCallId)

      return {
        runId: runRow.run_uid,
        skills: nextSkills,
        tools: nextTools,
        toolLogs,
        activeToolCallIds,
        activeToolCalls,
        isGenerating: Boolean(metadataTrace.isGenerating)
      }
    })

    return {
      updatedAt: conversation.updated_at,
      messages,
      runTraces
    }
  }

  saveConversationSnapshot(payload: ChatPersistenceSaveConversationSnapshotPayload): void {
    const executeSave = this.database.transaction(
      (savePayload: ChatPersistenceSaveConversationSnapshotPayload) => {
        const now = Date.now()
        const normalizedInstanceId = savePayload.instanceId.trim()
        const normalizedSessionKey = normalizeSessionKey(savePayload.sessionKey)
        const conversationUid = buildConversationUid(normalizedInstanceId, normalizedSessionKey)
        const snapshotUpdatedAt =
          Number.isFinite(savePayload.snapshot.updatedAt) && savePayload.snapshot.updatedAt > 0
            ? Math.trunc(savePayload.snapshot.updatedAt)
            : now

        const lastMessage = savePayload.snapshot.messages.at(-1)
        const lastMessagePreview = lastMessage?.content?.slice(0, 512) ?? null

        this.database
          .prepare(
            `
INSERT INTO chat_conversations(
  conversation_uid,
  instance_id,
  session_key,
  model_id,
  status,
  last_message_preview,
  last_message_at,
  created_at,
  updated_at
)
VALUES (?, ?, ?, ?, 'active', ?, ?, ?, ?)
ON CONFLICT(conversation_uid) DO UPDATE SET
  instance_id = excluded.instance_id,
  session_key = excluded.session_key,
  model_id = excluded.model_id,
  status = excluded.status,
  last_message_preview = excluded.last_message_preview,
  last_message_at = excluded.last_message_at,
  updated_at = excluded.updated_at
`
          )
          .run(
            conversationUid,
            normalizedInstanceId,
            normalizedSessionKey,
            normalizeNonEmptyString(savePayload.modelId ?? undefined),
            lastMessagePreview,
            snapshotUpdatedAt,
            now,
            snapshotUpdatedAt
          )

        const conversation = this.database
          .prepare('SELECT id FROM chat_conversations WHERE conversation_uid = ? LIMIT 1')
          .get(conversationUid) as { id: number } | undefined

        if (!conversation) {
          throw new Error('无法保存会话快照：conversation 记录创建失败。')
        }

        this.database
          .prepare('DELETE FROM chat_tool_logs WHERE conversation_id = ?')
          .run(conversation.id)
        this.database
          .prepare('DELETE FROM chat_tool_calls WHERE conversation_id = ?')
          .run(conversation.id)
        this.database
          .prepare('DELETE FROM chat_runs WHERE conversation_id = ?')
          .run(conversation.id)
        this.database
          .prepare('DELETE FROM chat_messages WHERE conversation_id = ?')
          .run(conversation.id)

        const runTraceByRunId = savePayload.snapshot.runTraces.reduce<
          Record<string, PersistedConversationRunTrace>
        >((current, runTrace) => {
          const normalizedRunId = normalizeNonEmptyString(runTrace.runId)
          if (!normalizedRunId) {
            return current
          }
          current[normalizedRunId] = {
            ...runTrace,
            runId: normalizedRunId
          }
          return current
        }, {})

        const runIds = new Set<string>()
        for (const message of savePayload.snapshot.messages) {
          const normalizedRunId = normalizeNonEmptyString(message.runId)
          if (normalizedRunId) {
            runIds.add(normalizedRunId)
          }
        }

        for (const runId of Object.keys(runTraceByRunId)) {
          runIds.add(runId)
        }

        const insertRun = this.database.prepare(
          `
INSERT INTO chat_runs(
  run_uid,
  conversation_id,
  session_key,
  model_id,
  state,
  source_run_id,
  started_at,
  ended_at,
  created_at,
  updated_at,
  metadata_json
)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`
        )
        const runIdByUid = new Map<string, number>()

        Array.from(runIds).forEach((runUid, runIndex) => {
          const runTrace = runTraceByRunId[runUid]
          const hasVisibleAssistantStreamingMessage = savePayload.snapshot.messages.some(
            (message) =>
              message.runId === runUid &&
              message.role === 'assistant' &&
              message.status === 'streaming' &&
              message.content.trim().length > 0
          )
          const runState = (() => {
            if (runTrace?.isGenerating && hasVisibleAssistantStreamingMessage) {
              return 'streaming'
            }

            const hasError = savePayload.snapshot.messages.some(
              (message) => message.runId === runUid && message.status === 'error'
            )
            return hasError ? 'error' : 'completed'
          })()
          const runStartedAt = snapshotUpdatedAt + runIndex
          const metadata: RunTraceMetadata = {
            skills: runTrace?.skills ?? [],
            tools: runTrace?.tools ?? [],
            activeToolCallIds: runTrace?.activeToolCallIds ?? [],
            activeToolCalls: runTrace?.activeToolCalls ?? [],
            isGenerating: Boolean(runTrace?.isGenerating && hasVisibleAssistantStreamingMessage)
          }

          const insertResult = insertRun.run(
            runUid,
            conversation.id,
            normalizedSessionKey,
            normalizeNonEmptyString(savePayload.modelId ?? undefined),
            runState,
            runUid,
            runStartedAt,
            runState === 'streaming' ? null : runStartedAt,
            runStartedAt,
            runStartedAt,
            stringifyJson(metadata)
          ) as { lastInsertRowid: number | bigint }

          runIdByUid.set(runUid, Number(insertResult.lastInsertRowid))
        })

        const insertMessage = this.database.prepare(
          `
INSERT INTO chat_messages(
  message_uid,
  conversation_id,
  run_id,
  source_message_id,
  client_message_id,
  seq,
  role,
  status,
  content,
  created_at,
  updated_at,
  metadata_json
)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`
        )
        const insertMessageTag = this.database.prepare(
          `
INSERT INTO chat_message_tags(
  message_id,
  seq,
  tag_type,
  label,
  preview_src,
  relative_path,
  absolute_path
)
VALUES (?, ?, ?, ?, ?, ?, ?)
`
        )

        let persistedMessageSeq = 0
        savePayload.snapshot.messages.forEach((message, index) => {
          const role = message.role
          if (role !== 'assistant' && role !== 'user') {
            return
          }

          const content = message.content ?? ''
          if (role === 'assistant' && content.trim().length === 0 && message.status !== 'error') {
            return
          }

          const messageUid =
            normalizeNonEmptyString(message.id) ?? `message-${snapshotUpdatedAt}-${index}`
          const createdAt = snapshotUpdatedAt + persistedMessageSeq
          const runForeignId = message.runId ? (runIdByUid.get(message.runId) ?? null) : null
          const status = (() => {
            if (role === 'assistant') {
              return message.status === 'error' ? 'error' : null
            }

            if (message.status === 'error') {
              return 'error'
            }

            if (message.status === 'sending' || message.status === 'sent') {
              return 'sent'
            }

            return null
          })()
          const insertResult = insertMessage.run(
            messageUid,
            conversation.id,
            runForeignId,
            messageUid,
            messageUid,
            persistedMessageSeq,
            role,
            status,
            content,
            createdAt,
            createdAt,
            stringifyJson({
              timeLabel: message.timeLabel
            })
          ) as { lastInsertRowid: number | bigint }
          const messageRowId = Number(insertResult.lastInsertRowid)
          persistedMessageSeq += 1

          for (const [tagIndex, tag] of (message.tags ?? []).entries()) {
            const label = normalizeNonEmptyString(tag.label)
            if (!label) {
              continue
            }

            insertMessageTag.run(
              messageRowId,
              tagIndex,
              tag.type,
              label,
              normalizeNonEmptyString(tag.previewSrc),
              normalizeNonEmptyString(tag.relativePath),
              normalizeNonEmptyString(tag.absolutePath)
            )
          }
        })

        const insertToolCall = this.database.prepare(
          `
INSERT INTO chat_tool_calls(
  tool_call_uid,
  run_id,
  conversation_id,
  source_tool_call_id,
  seq,
  tool_name,
  skill_name,
  state,
  started_at,
  finished_at,
  created_at,
  updated_at
)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`
        )
        const insertToolLog = this.database.prepare(
          `
INSERT INTO chat_tool_logs(
  log_uid,
  run_id,
  conversation_id,
  tool_call_id,
  source_event_id,
  seq,
  phase,
  title,
  content,
  content_format,
  created_at
)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`
        )

        for (const runTrace of Object.values(runTraceByRunId)) {
          const runDatabaseId = runIdByUid.get(runTrace.runId)
          if (!runDatabaseId) {
            continue
          }

          const toolCallEntries = new Map<
            string,
            {
              toolCallId: string
              toolName: string
              skillName?: string
              state: 'started' | 'running' | 'completed' | 'error' | 'aborted'
            }
          >()

          for (const activeToolCall of runTrace.activeToolCalls) {
            const toolCallId = normalizeNonEmptyString(activeToolCall.toolCallId)
            const toolName = normalizeNonEmptyString(activeToolCall.toolName)
            if (!toolCallId || !toolName) {
              continue
            }

            toolCallEntries.set(toolCallId, {
              toolCallId,
              toolName,
              ...(normalizeNonEmptyString(activeToolCall.skillName)
                ? { skillName: activeToolCall.skillName?.trim() }
                : {}),
              state: 'running'
            })
          }

          for (const [logIndex, toolLog] of runTrace.toolLogs.entries()) {
            const toolCallId =
              normalizeNonEmptyString(toolLog.toolCallId) ?? `tool-call-${logIndex}`
            const title = normalizeNonEmptyString(toolLog.title) ?? 'tool'
            const inferredToolName =
              normalizeNonEmptyString(title.split('·')[0]) ?? normalizeNonEmptyString(title)
            if (!inferredToolName) {
              continue
            }

            if (!toolCallEntries.has(toolCallId)) {
              toolCallEntries.set(toolCallId, {
                toolCallId,
                toolName: inferredToolName,
                state: 'completed'
              })
            }
          }

          const toolCallRowIdByToolCallId = new Map<string, number>()
          Array.from(toolCallEntries.values()).forEach((toolCall, index) => {
            const startedAt = snapshotUpdatedAt + index
            const insertResult = insertToolCall.run(
              `${runTrace.runId}:${toolCall.toolCallId}`,
              runDatabaseId,
              conversation.id,
              toolCall.toolCallId,
              index,
              toolCall.toolName,
              normalizeNonEmptyString(toolCall.skillName),
              toolCall.state,
              startedAt,
              toolCall.state === 'running' ? null : startedAt,
              startedAt,
              startedAt
            ) as { lastInsertRowid: number | bigint }
            toolCallRowIdByToolCallId.set(toolCall.toolCallId, Number(insertResult.lastInsertRowid))
          })

          runTrace.toolLogs.forEach((toolLog, index) => {
            const toolCallId = normalizeNonEmptyString(toolLog.toolCallId)
            const sourceEventId = normalizeNonEmptyString(toolLog.id)
            insertToolLog.run(
              sourceEventId ?? `${runTrace.runId}:${index}`,
              runDatabaseId,
              conversation.id,
              toolCallId ? (toolCallRowIdByToolCallId.get(toolCallId) ?? null) : null,
              sourceEventId,
              index,
              detectLogPhaseFromTitle(toolLog.title),
              normalizeNonEmptyString(toolLog.title) ?? 'tool',
              toolLog.content,
              detectContentFormat(toolLog.content),
              snapshotUpdatedAt + index
            )
          })
        }
      }
    )

    executeSave(payload)
  }

  deleteConversationSnapshot(payload: ChatPersistenceDeleteConversationSnapshotPayload): boolean {
    const normalizedInstanceId = payload.instanceId.trim()
    const normalizedSessionKey = normalizeSessionKey(payload.sessionKey)
    const candidateRows = this.database
      .prepare(
        `
SELECT id, session_key
FROM chat_conversations
WHERE instance_id = ?
ORDER BY updated_at DESC
`
      )
      .all(normalizedInstanceId) as Array<{ id: number; session_key: string }>
    const matchedRowIds = candidateRows
      .filter((row) => isSameGatewaySessionKey(row.session_key, normalizedSessionKey))
      .map((row) => row.id)

    if (matchedRowIds.length > 0) {
      const deleteById = this.database.prepare('DELETE FROM chat_conversations WHERE id = ?')
      const executeDelete = this.database.transaction((rowIds: number[]) => {
        for (const rowId of rowIds) {
          deleteById.run(rowId)
        }
      })
      executeDelete(matchedRowIds)
      return true
    }

    const deleteResult = this.database
      .prepare('DELETE FROM chat_conversations WHERE conversation_uid = ?')
      .run(buildConversationUid(payload.instanceId, payload.sessionKey)) as {
      changes: number
    }

    return deleteResult.changes > 0
  }
}
