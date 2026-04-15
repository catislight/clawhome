import { describe, expect, it } from 'vitest'

import {
  mapGatewayHistoryMessageTraces,
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

    expect(traces['run-1']).toEqual({
      skills: ['openai-docs'],
      tools: ['read', 'web_search'],
      activeToolCallIds: [],
      activeToolCalls: [],
      isGenerating: false
    })
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
              name: 'exec_command',
              toolCallId: 'tool-3'
            }
          }
        }
      ],
      'main'
    )

    expect(traces).toEqual({
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
        tools: ['exec_command'],
        activeToolCallIds: ['tool-3'],
        activeToolCalls: [
          {
            toolCallId: 'tool-3',
            toolName: 'exec_command'
          }
        ],
        isGenerating: true
      }
    })
  })
})
