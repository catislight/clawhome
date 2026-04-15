import { describe, expect, it } from 'vitest'

import {
  parseOpenClawAgentFile,
  parseOpenClawAgentFilesList
} from '../renderer/src/features/agents/lib/openclaw-agents-parsers'

describe('openclaw-agents-parsers files compatibility', () => {
  it('parses list entries when missing is omitted and file names use mixed separators', () => {
    const parsed = parseOpenClawAgentFilesList({
      agentId: 'main',
      workspace: 'C:\\workspace\\main',
      files: [
        {
          name: 'memory\\daily\\2026-04-03-review.md',
          path: 'C:\\workspace\\main\\memory\\daily\\2026-04-03-review.md'
        },
        {
          name: '2026-04-03.md',
          path: 'C:\\workspace\\main\\memory\\2026-04-03.md'
        },
        {
          path: 'C:\\workspace\\main\\memory\\2026-04-02.md'
        }
      ]
    })

    expect(parsed?.files).toEqual([
      {
        name: 'memory/daily/2026-04-03-review.md',
        path: 'C:/workspace/main/memory/daily/2026-04-03-review.md',
        missing: false,
        size: undefined,
        updatedAtMs: undefined,
        content: undefined
      },
      {
        name: 'memory/2026-04-03.md',
        path: 'C:/workspace/main/memory/2026-04-03.md',
        missing: false,
        size: undefined,
        updatedAtMs: undefined,
        content: undefined
      },
      {
        name: 'memory/2026-04-02.md',
        path: 'C:/workspace/main/memory/2026-04-02.md',
        missing: false,
        size: undefined,
        updatedAtMs: undefined,
        content: undefined
      }
    ])
  })

  it('accepts legacy list payload with entries alias and string items', () => {
    const parsed = parseOpenClawAgentFilesList({
      agentId: 'main',
      workspaceDir: '/workspace/main',
      entries: ['memory/2026-04-03.md']
    })

    expect(parsed?.workspace).toBe('/workspace/main')
    expect(parsed?.files).toEqual([
      {
        name: 'memory/2026-04-03.md',
        path: '/workspace/main/memory/2026-04-03.md',
        missing: false
      }
    ])
  })

  it('extracts nested memory string arrays from non-standard payload fields', () => {
    const parsed = parseOpenClawAgentFilesList({
      agentId: 'main',
      workspace: '/workspace/main',
      memoryFiles: ['memory/2026-03-22.md', 'memory/2026-04-01.md']
    })

    expect(parsed?.files).toEqual([
      {
        name: 'memory/2026-03-22.md',
        path: '/workspace/main/memory/2026-03-22.md',
        missing: false
      },
      {
        name: 'memory/2026-04-01.md',
        path: '/workspace/main/memory/2026-04-01.md',
        missing: false
      }
    ])
  })

  it('falls back to top-level file shape for get payloads', () => {
    const parsed = parseOpenClawAgentFile({
      agentId: 'main',
      workspaceDir: '/workspace/main',
      name: 'memory\\2026-04-03.md',
      path: '/workspace/main/memory/2026-04-03.md',
      content: '# daily'
    })

    expect(parsed?.file).toEqual({
      name: 'memory/2026-04-03.md',
      path: '/workspace/main/memory/2026-04-03.md',
      missing: false,
      size: undefined,
      updatedAtMs: undefined,
      content: '# daily'
    })
  })
})
