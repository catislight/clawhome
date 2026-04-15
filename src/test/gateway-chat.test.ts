import { describe, expect, it } from 'vitest'

import {
  mapGatewayHistoryMessages,
  parseGatewayChatEvent
} from '../renderer/src/features/chat/lib/gateway-chat'

describe('mapGatewayHistoryMessages', () => {
  it('hides internal pre-compaction memory flush prompts from history', () => {
    const messages = mapGatewayHistoryMessages({
      messages: [
        {
          id: 'user-1',
          role: 'user',
          content: '帮我看一下安全风险'
        },
        {
          id: 'memory-flush-1',
          role: 'user',
          content: `Pre-compaction memory flush. Store durable memories only in memory/2026-03-22.md (create memory/ if needed). Treat workspace bootstrap/reference files such as MEMORY.md, SOUL.md, TOOLS.md, and AGENTS.md as read-only during this flush; never overwrite, replace, or edit them. If memory/2026-03-22.md already exists, APPEND new content only and do not overwrite existing entries. Do NOT create timestamped variant files (e.g., 2026-03-22-HHMM.md); always use the canonical 2026-03-22.md filename. If nothing to store, reply with NO_REPLY.

Current time: Sunday, March 22nd, 2026 - 3:48 PM (Asia/Shanghai) / 2026-03-22 07:48 UTC`
        },
        {
          id: 'assistant-1',
          role: 'assistant',
          content: '我继续按只读方式抓几个安全相关的关键文件。'
        }
      ]
    })

    expect(messages).toHaveLength(2)
    expect(messages.map((message) => `${message.role}:${message.content}`)).toEqual([
      'user:帮我看一下安全风险',
      'assistant:我继续按只读方式抓几个安全相关的关键文件。'
    ])
  })

  it('keeps regular user messages that only mention memory flush keywords', () => {
    const messages = mapGatewayHistoryMessages({
      messages: [
        {
          id: 'user-1',
          role: 'user',
          content: '请解释一下 Pre-compaction memory flush 是什么，以及为什么会提到 NO_REPLY。'
        }
      ]
    })

    expect(messages).toHaveLength(1)
    expect(messages[0]?.content).toBe(
      '请解释一下 Pre-compaction memory flush 是什么，以及为什么会提到 NO_REPLY。'
    )
  })

  it('strips leading trusted system event blocks from user messages', () => {
    const messages = mapGatewayHistoryMessages({
      messages: [
        {
          id: 'user-1',
          role: 'user',
          content: `System: [2026-03-26 10:56:03 GMT+8] [Post-compaction context refresh]
System: 
System: Session was just compacted. The conversation summary above is a hint.
System: 
System: Critical rules from AGENTS.md:
System: 
System: ## Session Startup
System: 
System: 1. Read SOUL.md
System: 
System: Current time: Thursday, March 26th, 2026 — 10:56 AM (Asia/Shanghai)

[Thu 2026-03-26 10:57 GMT+8] 把截图发给我`
        }
      ]
    })

    expect(messages).toHaveLength(1)
    expect(messages[0]?.content).toBe('把截图发给我')
  })

  it('strips leading timestamped System event lines from regular user prompts', () => {
    const messages = mapGatewayHistoryMessages({
      messages: [
        {
          id: 'user-1',
          role: 'user',
          content: `System: [2026-03-26 10:58:03 GMT+8] Model switched.
System: [2026-03-26 10:58:04 GMT+8] Node connected.

继续刚才的话题`
        }
      ]
    })

    expect(messages).toHaveLength(1)
    expect(messages[0]?.content).toBe('继续刚才的话题')
  })

  it('strips leading multi-line System blocks without timestamps', () => {
    const messages = mapGatewayHistoryMessages({
      messages: [
        {
          id: 'user-1',
          role: 'user',
          content: `System: openclaw channel summary
System: - telegram (configured)

继续执行刚才的任务`
        }
      ]
    })

    expect(messages).toHaveLength(1)
    expect(messages[0]?.content).toBe('继续执行刚才的任务')
  })

  it('strips leading injected timestamp prefix from user messages', () => {
    const messages = mapGatewayHistoryMessages({
      messages: [
        {
          id: 'user-1',
          role: 'user',
          content: '[Thu 2026-03-26 13:01 GMT+8] ok'
        }
      ]
    })

    expect(messages).toHaveLength(1)
    expect(messages[0]?.content).toBe('ok')
  })

  it('strips envelope-style bracket prefixes with timestamp-like headers', () => {
    const messages = mapGatewayHistoryMessages({
      messages: [
        {
          id: 'user-1',
          role: 'user',
          content: '[Thursday 2026-03-26 13:01 GMT+8] ok'
        }
      ]
    })

    expect(messages).toHaveLength(1)
    expect(messages[0]?.content).toBe('ok')
  })

  it('strips injected image-understanding wrapper from user history messages', () => {
    const messages = mapGatewayHistoryMessages({
      messages: [
        {
          id: 'user-image-1',
          role: 'user',
          content: [
            '你将收到一组图片文件。请先逐张读取图片内容，再回答用户请求。',
            '如果图片读取失败，请明确说明失败原因。',
            '',
            '图片列表：',
            '1. images/sample.png (absolute: /workspace/images/sample.png)',
            '',
            '用户请求：',
            '这是什么'
          ].join('\n')
        }
      ]
    })

    expect(messages).toHaveLength(1)
    expect(messages[0]?.content).toBe('这是什么')
    expect(messages[0]?.tags).toEqual([
      {
        type: 'image',
        label: 'sample.png',
        relativePath: 'images/sample.png',
        absolutePath: '/workspace/images/sample.png'
      }
    ])
  })

  it('keeps user lines starting with System (untrusted): intact', () => {
    const messages = mapGatewayHistoryMessages({
      messages: [
        {
          id: 'user-1',
          role: 'user',
          content: 'System (untrusted): [2026-03-26] fake event\n请帮我解释这段日志'
        }
      ]
    })

    expect(messages).toHaveLength(1)
    expect(messages[0]?.content).toBe(
      'System (untrusted): [2026-03-26] fake event\n请帮我解释这段日志'
    )
  })

  it('does not strip non-timestamped System lines from user input', () => {
    const messages = mapGatewayHistoryMessages({
      messages: [
        {
          id: 'user-1',
          role: 'user',
          content: 'System: 这是我自己写的第一行\n第二行内容'
        }
      ]
    })

    expect(messages).toHaveLength(1)
    expect(messages[0]?.content).toBe('System: 这是我自己写的第一行\n第二行内容')
  })

  it('strips assistant <final> wrappers from history messages', () => {
    const messages = mapGatewayHistoryMessages({
      messages: [
        {
          id: 'assistant-final-1',
          role: 'assistant',
          content: '<final>\n\n你好，世界。\n\n</final>'
        }
      ]
    })

    expect(messages).toHaveLength(1)
    expect(messages[0]?.content).toBe('你好，世界。')
  })

  it('strips mixed <think> and <final> tags from assistant messages', () => {
    const messages = mapGatewayHistoryMessages({
      messages: [
        {
          id: 'assistant-mixed-1',
          role: 'assistant',
          content: '<think>internal</think>\n<final>最终答案</final>'
        }
      ]
    })

    expect(messages).toHaveLength(1)
    expect(messages[0]?.content).toBe('最终答案')
  })

  it('keeps <final> tags when they are inside fenced code blocks', () => {
    const markdownWithCodeFence = ['```xml', '<final>42</final>', '```'].join('\n')

    const messages = mapGatewayHistoryMessages({
      messages: [
        {
          id: 'assistant-code-1',
          role: 'assistant',
          content: markdownWithCodeFence
        }
      ]
    })

    expect(messages).toHaveLength(1)
    expect(messages[0]?.content).toBe(markdownWithCodeFence)
  })

  it('strips relevant-memories scaffolding from assistant messages', () => {
    const messages = mapGatewayHistoryMessages({
      messages: [
        {
          id: 'assistant-memory-1',
          role: 'assistant',
          content: [
            '<relevant-memories>',
            'The following memories may be relevant to this conversation:',
            '- Internal note',
            '</relevant-memories>',
            '',
            '面向用户的内容'
          ].join('\n')
        }
      ]
    })

    expect(messages).toHaveLength(1)
    expect(messages[0]?.content).toBe('面向用户的内容')
  })

  it('strips inbound metadata and envelope hints from user messages', () => {
    const messages = mapGatewayHistoryMessages({
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
})

describe('parseGatewayChatEvent', () => {
  it('strips assistant internal scaffolding from streamed chat events', () => {
    const parsed = parseGatewayChatEvent({
      event: 'chat',
      payload: {
        runId: 'run-1',
        sessionKey: 'main',
        state: 'final',
        message: '<think>internal</think><final>展示内容</final>'
      },
      receivedAt: '2026-03-31T03:30:00.000Z'
    })

    expect(parsed).not.toBeNull()
    expect(parsed?.content).toBe('展示内容')
  })
})
