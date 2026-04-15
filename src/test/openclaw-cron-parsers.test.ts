import { describe, expect, it } from 'vitest'

import { parseOpenClawCronHistoryMessages } from '../renderer/src/features/cron/lib/openclaw-cron-parsers'

describe('parseOpenClawCronHistoryMessages', () => {
  it('sanitizes injected inbound metadata blocks from user history messages', () => {
    const messages = parseOpenClawCronHistoryMessages({
      messages: [
        {
          id: 'user-meta-1',
          role: 'user',
          content: [
            '[WebChat 2026-03-31 11:00]',
            'Conversation info (untrusted metadata):',
            '```json',
            '{"channel":"webchat"}',
            '```',
            'Sender (untrusted metadata):',
            '```json',
            '{"label":"Alice"}',
            '```',
            '',
            '[message_id: msg_123]',
            '请给我总结一下今天的变化'
          ].join('\n')
        }
      ]
    })

    expect(messages).toHaveLength(1)
    expect(messages[0]?.content).toBe('请给我总结一下今天的变化')
  })

  it('hides internal memory flush prompts in cron history too', () => {
    const messages = parseOpenClawCronHistoryMessages({
      messages: [
        {
          id: 'memory-flush-1',
          role: 'user',
          content:
            'Pre-compaction memory flush. Store durable memories only in memory/2026-03-22.md (create memory/ if needed). Treat workspace bootstrap/reference files such as MEMORY.md, SOUL.md, TOOLS.md, and AGENTS.md as read-only during this flush; never overwrite, replace, or edit them. If nothing to store, reply with NO_REPLY.'
        },
        {
          id: 'assistant-1',
          role: 'assistant',
          content: '正常回复'
        }
      ]
    })

    expect(messages).toHaveLength(1)
    expect(messages[0]?.role).toBe('assistant')
    expect(messages[0]?.content).toBe('正常回复')
  })
})
