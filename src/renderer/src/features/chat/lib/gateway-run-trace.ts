import { isSameGatewaySessionKey } from '@/features/chat/lib/gateway-chat'

const TOOL_CALL_TYPES = new Set(['tool_use', 'tooluse', 'toolcall', 'tool_call'])
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
  toolName?: unknown
  tool_name?: unknown
  input?: unknown
  arguments?: unknown
  args?: unknown
  content?: unknown
}

type GatewayAgentPayloadLike = {
  runId?: unknown
  sessionKey?: unknown
  stream?: unknown
  data?: unknown
}

export type ParsedGatewayAgentEvent =
  | {
      type: 'tool'
      runId: string
      sessionKey: string
      phase: 'start' | 'update' | 'result'
      toolName: string
      toolCallId: string
      args?: unknown
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

function normalizeToolName(value: unknown): string | null {
  return normalizeNonEmptyString(value)
}

function collectToolInvocations(message: GatewayHistoryMessageLike): ToolInvocation[] {
  const invocations: ToolInvocation[] = []

  const topLevelToolName = normalizeToolName(message.toolName ?? message.tool_name)
  if (topLevelToolName) {
    invocations.push({
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
      toolName,
      args: item.input ?? item.arguments ?? item.args
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
  const runId = normalizeNonEmptyString(payload.runId)
  const payloadSessionKey = normalizeNonEmptyString(payload.sessionKey)
  const stream = normalizeNonEmptyString(payload.stream)

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

  if (stream === 'tool') {
    const phase = normalizeNonEmptyString(data.phase)
    const toolName = normalizeToolName(data.name)
    const toolCallId = normalizeNonEmptyString(data.toolCallId)

    if (!phase || !toolName || !toolCallId) {
      return null
    }

    if (phase !== 'start' && phase !== 'update' && phase !== 'result') {
      return null
    }

    return {
      type: 'tool',
      runId,
      sessionKey: payloadSessionKey,
      phase,
      toolName,
      toolCallId,
      args: data.args
    }
  }

  if (stream === 'assistant') {
    const text = typeof data.text === 'string' ? data.text : ''
    const delta = typeof data.delta === 'string' ? data.delta : ''

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
    const phase = normalizeNonEmptyString(data.phase)
    if (phase !== 'end' && phase !== 'error') {
      return null
    }

    return {
      type: 'lifecycle',
      runId,
      sessionKey: payloadSessionKey,
      phase
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

    const historyMessage = message as GatewayHistoryMessageLike
    const runId = normalizeNonEmptyString(historyMessage.runId)
    if (!runId) {
      continue
    }

    for (const invocation of collectToolInvocations(historyMessage)) {
      traces = withTrace(traces, runId, (trace) => {
        const nextSkills = (() => {
          const inferredSkill = inferSkillNameFromToolInvocation(invocation)
          return inferredSkill ? appendUniqueLabel(trace.skills, inferredSkill) : trace.skills
        })()

        return {
          ...trace,
          skills: nextSkills,
          tools: appendUniqueLabel(trace.tools, invocation.toolName),
          activeToolCalls: [],
          isGenerating: false
        }
      })
    }
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

      if (parsed.phase === 'start') {
        const inferredSkill = inferSkillNameFromToolInvocation({
          toolName: parsed.toolName,
          args: parsed.args
        })

        return {
          skills: nextSkills,
          tools: appendUniqueLabel(trace.tools, parsed.toolName),
          activeToolCallIds: appendUniqueToolCallId(trace.activeToolCallIds, parsed.toolCallId),
          activeToolCalls: appendActiveToolCall(trace.activeToolCalls, {
            toolCallId: parsed.toolCallId,
            toolName: parsed.toolName,
            ...(inferredSkill ? { skillName: inferredSkill } : {})
          }),
          isGenerating: true
        }
      }

      if (parsed.phase === 'result') {
        return {
          skills: nextSkills,
          tools: appendUniqueLabel(trace.tools, parsed.toolName),
          activeToolCallIds: removeToolCallId(trace.activeToolCallIds, parsed.toolCallId),
          activeToolCalls: removeActiveToolCall(trace.activeToolCalls, parsed.toolCallId),
          isGenerating: true
        }
      }

      return {
        ...trace,
        skills: nextSkills,
        tools: appendUniqueLabel(trace.tools, parsed.toolName),
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
