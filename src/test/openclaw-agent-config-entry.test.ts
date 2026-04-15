import { describe, expect, it } from 'vitest'

import {
  buildAgentSettingsDraft,
  composeAgentEntryFromSettingsDraft
} from '../renderer/src/features/agents/lib/openclaw-agent-config-entry'

describe('openclaw-agent-config-entry', () => {
  it('builds settings draft from identity fields', () => {
    const draft = buildAgentSettingsDraft({
      entry: {
        id: 'assistant',
        name: '助手',
        identity: {
          emoji: '🧠',
          avatar: 'images/agent.png'
        }
      },
      summary: null
    })

    expect(draft.id).toBe('assistant')
    expect(draft.emoji).toBe('🧠')
    expect(draft.avatar).toBe('images/agent.png')
  })

  it('writes local avatar path into identity.avatar', () => {
    const result = composeAgentEntryFromSettingsDraft({
      baseEntry: { id: 'assistant' },
      draft: {
        id: 'assistant',
        default: false,
        name: '助手',
        emoji: '🤖',
        avatar: 'images/avatar.png',
        workspace: '',
        agentDir: '',
        model: '',
        paramsJson: '',
        subagentsAllowAgents: []
      }
    })

    expect(result.error).toBeNull()
    expect(result.entry).toMatchObject({
      id: 'assistant',
      name: '助手',
      identity: {
        emoji: '🤖',
        avatar: 'images/avatar.png'
      }
    })
    expect((result.entry as Record<string, unknown>)?.identity).not.toHaveProperty('avatarUrl')
  })

  it('writes remote avatar url into identity.avatarUrl', () => {
    const result = composeAgentEntryFromSettingsDraft({
      baseEntry: { id: 'assistant' },
      draft: {
        id: 'assistant',
        default: false,
        name: '',
        emoji: '',
        avatar: 'https://example.com/avatar.png',
        workspace: '',
        agentDir: '',
        model: '',
        paramsJson: '',
        subagentsAllowAgents: []
      }
    })

    expect(result.error).toBeNull()
    expect((result.entry as Record<string, unknown>)?.identity).toMatchObject({
      avatarUrl: 'https://example.com/avatar.png'
    })
    expect((result.entry as Record<string, unknown>)?.identity).not.toHaveProperty('avatar')
  })
})
