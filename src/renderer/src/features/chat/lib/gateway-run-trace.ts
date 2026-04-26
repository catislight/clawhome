import { isSameGatewaySessionKey } from '@/features/chat/lib/gateway-chat'

const TOOL_CALL_TYPES = new Set(['tool_use', 'tooluse', 'toolcall', 'tool_call'])
const ITEM_TOOL_KINDS = new Set(['command', 'tool', 'tool_call', 'toolcall', 'tool_use', 'tooluse'])
const GENERIC_SKILL_PARENT_NAMES = new Set([
  'skills',
  '.skills',
  '.agents',
  'managed-skills',
  'bundled-skills'
])

export type ConversationRunTrace = {
  skills: string[]
  tools: string[]
  toolLogs: Array<{
    id: string
    toolCallId: string
    title: string
    content: string
  }>
  activeToolCallIds: string[]
  activeToolCalls: Array<{
    toolCallId: string
    toolName: string
    skillName?: string
  }>
  isGenerating: boolean
}

type GatewayHistoryMessageLike = {
  runId?: unknown
  run_id?: unknown
  toolCallId?: unknown
  tool_call_id?: unknown
  toolName?: unknown
  tool_name?: unknown
  input?: unknown
  arguments?: unknown
  args?: unknown
  content?: unknown
}

type GatewayAgentPayloadLike = {
  runId?: unknown
  run_id?: unknown
  sessionKey?: unknown
  session_key?: unknown
  stream?: unknown
  data?: unknown
}

export type ParsedGatewayAgentEvent =
  | {
      type: 'tool'
      runId: string
      sessionKey: string
      phase: 'start' | 'update' | 'result' | 'error'
      toolName: string
      toolCallId: string
      args?: unknown
      detail?: unknown
    }
  | {
      type: 'assistant'
      runId: string
      sessionKey: string
      text: string
      delta: string
      receivedAt?: string
    }
  | {
      type: 'lifecycle'
      runId: string
      sessionKey: string
      phase: 'end' | 'error'
    }

type ToolInvocation = {
  toolCallId?: string
  toolName: string
  args?: unknown
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function normalizeNonEmptyString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function readFirstNonEmptyString(source: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = source[key]
    const normalized = normalizeNonEmptyString(value)
    if (normalized) {
      return normalized
    }
  }

  return null
}

function normalizeEventPhase(
  phase: string | null
): 'start' | 'update' | 'result' | 'error' | 'end' | null {
  if (!phase) {
    return null
  }

  const normalized = phase.trim().toLowerCase()
  if (!normalized) {
    return null
  }

  if (normalized === 'start') {
    return 'start'
  }

  if (normalized === 'update' || normalized === 'delta') {
    return 'update'
  }

  if (normalized === 'result') {
    return 'result'
  }

  if (normalized === 'error' || normalized === 'failed' || normalized === 'fail') {
    return 'error'
  }

  if (
    normalized === 'end' ||
    normalized === 'complete' ||
    normalized === 'completed' ||
    normalized === 'finish' ||
    normalized === 'finished' ||
    normalized === 'final'
  ) {
    return 'result'
  }

  return null
}

function appendUniqueLabel(labels: string[], nextLabel: string): string[] {
  const lowered = nextLabel.toLowerCase()
  if (labels.some((label) => label.toLowerCase() === lowered)) {
    return labels
  }
  return [...labels, nextLabel]
}

function appendUniqueToolCallId(ids: string[], nextId: string): string[] {
  return ids.includes(nextId) ? ids : [...ids, nextId]
}

function removeToolCallId(ids: string[], targetId: string): string[] {
  return ids.filter((id) => id !== targetId)
}

function appendActiveToolCall(
  activeToolCalls: ConversationRunTrace['activeToolCalls'],
  nextToolCall: ConversationRunTrace['activeToolCalls'][number]
): ConversationRunTrace['activeToolCalls'] {
  const existingIndex = activeToolCalls.findIndex(
    (toolCall) => toolCall.toolCallId === nextToolCall.toolCallId
  )

  if (existingIndex === -1) {
    return [...activeToolCalls, nextToolCall]
  }

  const nextActiveToolCalls = [...activeToolCalls]
  nextActiveToolCalls[existingIndex] = {
    ...nextActiveToolCalls[existingIndex],
    ...nextToolCall
  }
  return nextActiveToolCalls
}

function removeActiveToolCall(
  activeToolCalls: ConversationRunTrace['activeToolCalls'],
  targetToolCallId: string
): ConversationRunTrace['activeToolCalls'] {
  return activeToolCalls.filter((toolCall) => toolCall.toolCallId !== targetToolCallId)
}

function stringifyToolLogContent(value: unknown): string {
  if (value === null || value === undefined) {
    return ''
  }

  if (typeof value === 'string') {
    return value.trim()
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }

  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

function appendToolLog(
  toolLogs: ConversationRunTrace['toolLogs'],
  nextToolLog: ConversationRunTrace['toolLogs'][number]
): ConversationRunTrace['toolLogs'] {
  if (toolLogs.some((log) => log.id === nextToolLog.id)) {
    return toolLogs
  }

  return [...toolLogs, nextToolLog]
}

function normalizeToolName(value: unknown): string | null {
  return normalizeNonEmptyString(value)
}

function collectToolInvocations(message: GatewayHistoryMessageLike): ToolInvocation[] {
  const invocations: ToolInvocation[] = []
  const messageRecord = message as Record<string, unknown>

  const topLevelToolName = normalizeToolName(message.toolName ?? message.tool_name)
  if (topLevelToolName) {
    invocations.push({
      toolCallId:
        readFirstNonEmptyString(messageRecord, [
          'toolCallId',
          'tool_call_id',
          'toolcallid',
          'id'
        ]) ?? '',
      toolName: topLevelToolName,
      args: message.args ?? message.input ?? message.arguments
    })
  }

  if (!Array.isArray(message.content)) {
    return invocations
  }

  for (const item of message.content) {
    if (!isRecord(item)) {
      continue
    }

    const partType = typeof item.type === 'string' ? item.type.trim().toLowerCase() : ''
    if (!TOOL_CALL_TYPES.has(partType)) {
      continue
    }

    const toolName = normalizeToolName(item.name ?? item.toolName ?? item.tool_name)
    if (!toolName) {
      continue
    }

    invocations.push({
      toolCallId:
        readFirstNonEmptyString(item, ['toolCallId', 'tool_call_id', 'toolcallid', 'id']) ?? '',
      toolName,
      args: item.input ?? item.arguments ?? item.args ?? item.params
    })
  }

  return invocations
}

function extractPathFromArgs(args: unknown): string | null {
  if (typeof args === 'string') {
    return normalizeNonEmptyString(args)
  }

  if (!isRecord(args)) {
    return null
  }

  const directPath =
    normalizeNonEmptyString(args.path) ??
    normalizeNonEmptyString(args.file_path) ??
    normalizeNonEmptyString(args.filePath)

  if (directPath) {
    return directPath
  }

  return null
}

function inferSkillNameFromPath(filePath: string | null): string | null {
  if (!filePath) {
    return null
  }

  const normalizedPath = filePath.trim().replaceAll('\\', '/')
  if (
    !normalizedPath.toLowerCase().endsWith('/skill.md') &&
    normalizedPath.toLowerCase() !== 'skill.md'
  ) {
    return null
  }

  const pathParts = normalizedPath.split('/').filter(Boolean)
  if (pathParts.length === 0) {
    return null
  }

  const parentName = pathParts.at(-2)?.trim()
  if (parentName && !GENERIC_SKILL_PARENT_NAMES.has(parentName.toLowerCase())) {
    return parentName
  }

  const fallbackName = pathParts.at(-3)?.trim()
  if (fallbackName && !GENERIC_SKILL_PARENT_NAMES.has(fallbackName.toLowerCase())) {
    return fallbackName
  }

  return null
}

function inferSkillNameFromToolInvocation(invocation: ToolInvocation): string | null {
  if (invocation.toolName.toLowerCase() !== 'read') {
    return null
  }

  return inferSkillNameFromPath(extractPathFromArgs(invocation.args))
}

function createEmptyTrace(): ConversationRunTrace {
  return {
    skills: [],
    tools: [],
    toolLogs: [],
    activeToolCallIds: [],
    activeToolCalls: [],
    isGenerating: false
  }
}

function withTrace(
  traces: Record<string, ConversationRunTrace>,
  runId: string,
  updater: (trace: ConversationRunTrace) => ConversationRunTrace
): Record<string, ConversationRunTrace> {
  const currentTrace = traces[runId] ?? createEmptyTrace()
  const nextTrace = updater(currentTrace)

  if (
    nextTrace.skills.length === 0 &&
    nextTrace.tools.length === 0 &&
    nextTrace.toolLogs.length === 0 &&
    nextTrace.activeToolCallIds.length === 0 &&
    nextTrace.activeToolCalls.length === 0 &&
    !nextTrace.isGenerating
  ) {
    if (!(runId in traces)) {
      return traces
    }

    const nextTraces = { ...traces }
    delete nextTraces[runId]
    return nextTraces
  }

  return {
    ...traces,
    [runId]: nextTrace
  }
}

export function parseGatewayAgentEvent(
  event: {
    event: string
    payload?: unknown
    receivedAt?: string
  },
  sessionKey: string
): ParsedGatewayAgentEvent | null {
  if (event.event !== 'agent' || !isRecord(event.payload)) {
    return null
  }

  const payload = event.payload as GatewayAgentPayloadLike
  const payloadRecord = payload as Record<string, unknown>
  const runId = readFirstNonEmptyString(payloadRecord, ['runId', 'run_id', 'runID', 'runid'])
  const payloadSessionKey = readFirstNonEmptyString(payloadRecord, [
    'sessionKey',
    'session_key',
    'sessionID',
    'session_id'
  ])
  const stream = readFirstNonEmptyString(payloadRecord, ['stream'])?.toLowerCase() ?? null

  if (
    !runId ||
    !payloadSessionKey ||
    !stream ||
    !isSameGatewaySessionKey(payloadSessionKey, sessionKey)
  ) {
    return null
  }

  const data = isRecord(payload.data) ? payload.data : null
  if (!data) {
    return null
  }

  if (stream === 'tool' || stream === 'item') {
    const itemKind = readFirstNonEmptyString(data, ['kind', 'type'])?.toLowerCase() ?? null
    const phase = normalizeEventPhase(readFirstNonEmptyString(data, ['phase', 'status', 'state']))
    const toolName = normalizeToolName(data.name ?? data.toolName ?? data.tool_name)
    const toolCallId = readFirstNonEmptyString(data, [
      'toolCallId',
      'tool_call_id',
      'toolcallid',
      'itemId',
      'item_id',
      'id'
    ])
    const commandMeta = normalizeNonEmptyString(data.meta)
    const args =
      data.args ??
      data.input ??
      data.arguments ??
      data.params ??
      (commandMeta ? { command: commandMeta } : undefined)
    const detail = data.result ?? data.output ?? data.content ?? data.value ?? data.message ?? args

    const isToolItem =
      stream === 'tool' ||
      Boolean(itemKind && ITEM_TOOL_KINDS.has(itemKind)) ||
      (Boolean(toolName) &&
        Boolean(toolCallId) &&
        (data.args !== undefined ||
          data.input !== undefined ||
          data.arguments !== undefined ||
          data.params !== undefined ||
          data.result !== undefined ||
          data.output !== undefined ||
          commandMeta !== null))

    if (isToolItem) {
      if (!phase || !toolName || !toolCallId) {
        return null
      }

      if (phase !== 'start' && phase !== 'update' && phase !== 'result' && phase !== 'error') {
        return null
      }

      return {
        type: 'tool',
        runId,
        sessionKey: payloadSessionKey,
        phase,
        toolName,
        toolCallId,
        args,
        detail
      }
    }

    if (stream === 'item') {
      const text = readFirstNonEmptyString(data, ['text', 'content', 'message', 'value']) ?? ''
      const delta = readFirstNonEmptyString(data, ['delta', 'chunk', 'append']) ?? ''
      if (text || delta) {
        return {
          type: 'assistant',
          runId,
          sessionKey: payloadSessionKey,
          text,
          delta,
          receivedAt: event.receivedAt
        }
      }

      if (phase === 'error' || phase === 'result') {
        return {
          type: 'lifecycle',
          runId,
          sessionKey: payloadSessionKey,
          phase: phase === 'error' ? 'error' : 'end'
        }
      }
    }

    return null
  }

  if (stream === 'assistant') {
    const text = readFirstNonEmptyString(data, ['text', 'content', 'message', 'value']) ?? ''
    const delta = readFirstNonEmptyString(data, ['delta', 'chunk', 'append']) ?? ''

    if (!text && !delta) {
      return null
    }

    return {
      type: 'assistant',
      runId,
      sessionKey: payloadSessionKey,
      text,
      delta,
      receivedAt: event.receivedAt
    }
  }

  if (stream === 'lifecycle') {
    const phase = normalizeEventPhase(readFirstNonEmptyString(data, ['phase', 'status', 'state']))
    if (phase !== 'result' && phase !== 'error') {
      return null
    }

    return {
      type: 'lifecycle',
      runId,
      sessionKey: payloadSessionKey,
      phase: phase === 'error' ? 'error' : 'end'
    }
  }

  return null
}

export function mapGatewayHistoryMessageTraces(
  payload: unknown
): Record<string, ConversationRunTrace> {
  if (!isRecord(payload) || !Array.isArray(payload.messages)) {
    return {}
  }

  let traces: Record<string, ConversationRunTrace> = {}

  for (const message of payload.messages) {
    if (!isRecord(message)) {
      continue
    }

    const messageRecord = message as Record<string, unknown>
    const historyMessage = message as GatewayHistoryMessageLike
    const runId = readFirstNonEmptyString(messageRecord, ['runId', 'run_id', 'runID', 'runid'])
    if (!runId) {
      continue
    }

    collectToolInvocations(historyMessage).forEach((invocation, invocationIndex) => {
      traces = withTrace(traces, runId, (trace) => {
        const nextSkills = (() => {
          const inferredSkill = inferSkillNameFromToolInvocation(invocation)
          return inferredSkill ? appendUniqueLabel(trace.skills, inferredSkill) : trace.skills
        })()
        const shouldTrackCommandLog = invocation.toolName.trim().toLowerCase() === 'exec'
        const toolLogContent = stringifyToolLogContent(invocation.args)
        const toolLogId = `${runId}:${invocation.toolCallId || `history-${invocationIndex}`}:${invocation.toolName}:${toolLogContent}`

        return {
          ...trace,
          skills: nextSkills,
          tools: appendUniqueLabel(trace.tools, invocation.toolName),
          toolLogs: shouldTrackCommandLog
            ? appendToolLog(trace.toolLogs, {
                id: toolLogId,
                toolCallId: invocation.toolCallId || `history-${invocationIndex}`,
                title: invocation.toolName,
                content: toolLogContent
              })
            : trace.toolLogs,
          activeToolCalls: [],
          isGenerating: false
        }
      })
    })
  }

  return traces
}

export function reduceRunTracesFromGatewayEvents(
  currentTraces: Record<string, ConversationRunTrace>,
  events: Array<{
    event: string
    payload?: unknown
  }>,
  sessionKey: string
): Record<string, ConversationRunTrace> {
  let nextTraces = currentTraces

  for (const event of events) {
    const parsed = parseGatewayAgentEvent(event, sessionKey)
    if (!parsed) {
      continue
    }

    if (parsed.type === 'lifecycle') {
      nextTraces = withTrace(nextTraces, parsed.runId, (trace) => ({
        ...trace,
        activeToolCallIds: [],
        activeToolCalls: [],
        isGenerating: false
      }))
      continue
    }

    if (parsed.type === 'assistant') {
      nextTraces = withTrace(nextTraces, parsed.runId, (trace) => ({
        ...trace,
        isGenerating: true
      }))
      continue
    }

    nextTraces = withTrace(nextTraces, parsed.runId, (trace) => {
      const nextSkills = (() => {
        const inferredSkill = inferSkillNameFromToolInvocation({
          toolName: parsed.toolName,
          args: parsed.args
        })
        return inferredSkill ? appendUniqueLabel(trace.skills, inferredSkill) : trace.skills
      })()
      const shouldTrackCommandLog =
        parsed.phase === 'start' && parsed.toolName.trim().toLowerCase() === 'exec'
      const nextToolLogs = shouldTrackCommandLog
        ? appendToolLog(trace.toolLogs, {
            id: `${parsed.toolCallId}:start:${parsed.toolName}:${stringifyToolLogContent(parsed.args)}`,
            toolCallId: parsed.toolCallId,
            title: parsed.toolName,
            content: stringifyToolLogContent(parsed.args)
          })
        : trace.toolLogs

      if (parsed.phase === 'start') {
        const inferredSkill = inferSkillNameFromToolInvocation({
          toolName: parsed.toolName,
          args: parsed.args
        })

        return {
          skills: nextSkills,
          tools: appendUniqueLabel(trace.tools, parsed.toolName),
          toolLogs: nextToolLogs,
          activeToolCallIds: appendUniqueToolCallId(trace.activeToolCallIds, parsed.toolCallId),
          activeToolCalls: appendActiveToolCall(trace.activeToolCalls, {
            toolCallId: parsed.toolCallId,
            toolName: parsed.toolName,
            ...(inferredSkill ? { skillName: inferredSkill } : {})
          }),
          isGenerating: true
        }
      }

      if (parsed.phase === 'result' || parsed.phase === 'error') {
        return {
          skills: nextSkills,
          tools: appendUniqueLabel(trace.tools, parsed.toolName),
          toolLogs: nextToolLogs,
          activeToolCallIds: removeToolCallId(trace.activeToolCallIds, parsed.toolCallId),
          activeToolCalls: removeActiveToolCall(trace.activeToolCalls, parsed.toolCallId),
          isGenerating: true
        }
      }

      return {
        ...trace,
        skills: nextSkills,
        tools: appendUniqueLabel(trace.tools, parsed.toolName),
        toolLogs: nextToolLogs,
        activeToolCalls: trace.activeToolCalls,
        isGenerating: true
      }
    })
  }

  return nextTraces
}

export function removeRunTracesByRunId(
  currentTraces: Record<string, ConversationRunTrace>,
  runIds: string[]
): Record<string, ConversationRunTrace> {
  if (runIds.length === 0) {
    return currentTraces
  }

  let nextTraces = currentTraces
  for (const runId of runIds) {
    if (!(runId in nextTraces)) {
      continue
    }

    const remainingTraces = { ...nextTraces }
    delete remainingTraces[runId]
    nextTraces = remainingTraces
  }

  return nextTraces
}
