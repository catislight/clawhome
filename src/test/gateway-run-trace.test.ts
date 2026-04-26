import { describe, expect, it } from 'vitest'

import {
  mapGatewayHistoryMessageTraces,
  parseGatewayAgentEvent,
  reduceRunTracesFromGatewayEvents
} from '../renderer/src/features/chat/lib/gateway-run-trace'

describe('gateway-run-trace', () => {
  it('aggregates tool and skill tags from history messages that share a run id', () => {
    const traces = mapGatewayHistoryMessageTraces({
      messages: [
        {
          id: 'assistant-tool-call',
          role: 'assistant',
          runId: 'run-1',
          content: [
            {
              type: 'tool_use',
              name: 'read',
              input: {
                path: '/workspace/skills/openai-docs/SKILL.md'
              }
            },
            {
              type: 'tool_use',
              name: 'web_search',
              input: {
                q: 'latest model docs'
              }
            }
          ]
        },
        {
          id: 'assistant-final',
          role: 'assistant',
          runId: 'run-1',
          content: [
            {
              type: 'text',
              text: '整理好了'
            }
          ]
        }
      ]
    })

    expect(traces['run-1']).toMatchObject({
      skills: ['openai-docs'],
      tools: ['read', 'web_search'],
      activeToolCallIds: [],
      activeToolCalls: [],
      isGenerating: false
    })
    expect(traces['run-1']?.toolLogs).toEqual([])
  })

  it('supports snake_case history fields when rebuilding traces', () => {
    const traces = mapGatewayHistoryMessageTraces({
      messages: [
        {
          id: 'assistant-tool-call-snake',
          role: 'assistant',
          run_id: 'run-snake-1',
          content: [
            {
              type: 'tool_call',
              name: 'read',
              tool_call_id: 'tool-snake-1',
              arguments: {
                path: '/workspace/skills/openai-docs/SKILL.md'
              }
            }
          ]
        }
      ]
    })

    expect(traces['run-snake-1']).toMatchObject({
      skills: ['openai-docs'],
      tools: ['read'],
      activeToolCallIds: [],
      activeToolCalls: [],
      isGenerating: false
    })
    expect(traces['run-snake-1']?.toolLogs).toEqual([])
  })

  it('tracks tool start and result events for the active session only', () => {
    const traces = reduceRunTracesFromGatewayEvents(
      {},
      [
        {
          event: 'agent',
          payload: {
            runId: 'run-1',
            sessionKey: 'agent:main:main',
            stream: 'tool',
            data: {
              phase: 'start',
              name: 'read',
              toolCallId: 'tool-1',
              args: {
                path: '/workspace/skills/rule-capture/SKILL.md'
              }
            }
          }
        },
        {
          event: 'agent',
          payload: {
            runId: 'run-1',
            sessionKey: 'agent:main:main',
            stream: 'tool',
            data: {
              phase: 'start',
              name: 'write',
              toolCallId: 'tool-2',
              args: {
                path: '/tmp/example.ts'
              }
            }
          }
        },
        {
          event: 'agent',
          payload: {
            runId: 'run-1',
            sessionKey: 'agent:main:main',
            stream: 'tool',
            data: {
              phase: 'result',
              name: 'read',
              toolCallId: 'tool-1'
            }
          }
        },
        {
          event: 'agent',
          payload: {
            runId: 'run-2',
            sessionKey: 'agent:other:main',
            stream: 'tool',
            data: {
              phase: 'start',
              name: 'exec',
              toolCallId: 'tool-3',
              args: {
                command: 'echo hi'
              }
            }
          }
        }
      ],
      'main'
    )

    expect(traces).toMatchObject({
      'run-1': {
        skills: ['rule-capture'],
        tools: ['read', 'write'],
        activeToolCallIds: ['tool-2'],
        activeToolCalls: [
          {
            toolCallId: 'tool-2',
            toolName: 'write'
          }
        ],
        isGenerating: true
      },
      'run-2': {
        skills: [],
        tools: ['exec'],
        activeToolCallIds: ['tool-3'],
        activeToolCalls: [
          {
            toolCallId: 'tool-3',
            toolName: 'exec'
          }
        ],
        isGenerating: true
      }
    })
    expect(traces['run-1']?.toolLogs).toEqual([])
    expect(traces['run-2']?.toolLogs.map((log) => log.title)).toEqual(['exec'])
    expect(traces['run-2']?.toolLogs[0]?.content).toContain('"command": "echo hi"')
  })

  it('supports snake_case agent event fields and maps end to result', () => {
    const traces = reduceRunTracesFromGatewayEvents(
      {},
      [
        {
          event: 'agent',
          payload: {
            run_id: 'run-snake-2',
            session_key: 'agent:main:main',
            stream: 'tool',
            data: {
              phase: 'start',
              tool_name: 'read',
              tool_call_id: 'tool-snake-2',
              args: {
                path: '/workspace/skills/rule-capture/SKILL.md'
              }
            }
          }
        },
        {
          event: 'agent',
          payload: {
            run_id: 'run-snake-2',
            session_key: 'agent:main:main',
            stream: 'tool',
            data: {
              phase: 'end',
              tool_name: 'read',
              tool_call_id: 'tool-snake-2',
              result: {
                ok: true
              }
            }
          }
        }
      ],
      'main'
    )

    expect(traces['run-snake-2']).toMatchObject({
      skills: ['rule-capture'],
      tools: ['read'],
      activeToolCallIds: [],
      activeToolCalls: [],
      isGenerating: true
    })
    expect(traces['run-snake-2']?.toolLogs).toEqual([])
  })

  it('supports stream=item command events and extracts command meta as args', () => {
    const traces = reduceRunTracesFromGatewayEvents(
      {},
      [
        {
          event: 'agent',
          payload: {
            runId: 'run-item-1',
            sessionKey: 'agent:main:main',
            stream: 'item',
            data: {
              itemId: 'command:call_function_1',
              phase: 'start',
              kind: 'command',
              name: 'exec',
              meta: 'chmod +x ~/.local/share/applications/gitcracken.desktop'
            }
          }
        }
      ],
      'main'
    )

    expect(traces['run-item-1']).toMatchObject({
      tools: ['exec'],
      activeToolCallIds: ['command:call_function_1'],
      activeToolCalls: [
        {
          toolCallId: 'command:call_function_1',
          toolName: 'exec'
        }
      ],
      isGenerating: true
    })
    expect(traces['run-item-1']?.toolLogs.map((log) => log.title)).toEqual(['exec'])
    expect(traces['run-item-1']?.toolLogs[0]?.content).toContain(
      'chmod +x ~/.local/share/applications/gitcracken.desktop'
    )
  })

  it('parses stream=item assistant text events', () => {
    const parsed = parseGatewayAgentEvent(
      {
        event: 'agent',
        receivedAt: '2026-04-25T12:00:00.000Z',
        payload: {
          runId: 'run-item-assistant-1',
          sessionKey: 'agent:main:main',
          stream: 'item',
          data: {
            kind: 'assistant',
            phase: 'update',
            delta: '你好，这是增量文本'
          }
        }
      },
      'main'
    )

    expect(parsed).toMatchObject({
      type: 'assistant',
      runId: 'run-item-assistant-1',
      sessionKey: 'agent:main:main',
      text: '',
      delta: '你好，这是增量文本'
    })
  })

  it('parses stream=item lifecycle completion events', () => {
    const parsed = parseGatewayAgentEvent(
      {
        event: 'agent',
        payload: {
          runId: 'run-item-lifecycle-1',
          sessionKey: 'agent:main:main',
          stream: 'item',
          data: {
            kind: 'response',
            phase: 'completed'
          }
        }
      },
      'main'
    )

    expect(parsed).toMatchObject({
      type: 'lifecycle',
      runId: 'run-item-lifecycle-1',
      sessionKey: 'agent:main:main',
      phase: 'end'
    })
  })
})
