import { describe, expect, it } from 'vitest'

import {
  isMemoryFileName,
  sortMemoryFileNames,
  toMemoryListLabel
} from '../renderer/src/features/agents/lib/openclaw-agent-memory-files'

describe('openclaw-agent-memory-files', () => {
  it('detects supported memory file names', () => {
    expect(isMemoryFileName('MEMORY.md')).toBe(true)
    expect(isMemoryFileName('memory.md')).toBe(true)
    expect(isMemoryFileName('memory/2026-04-03.md')).toBe(true)
    expect(isMemoryFileName('memory/daily/2026-04-03-api-design.md')).toBe(true)
    expect(isMemoryFileName('memory\\daily\\2026-04-03-api-design.md')).toBe(true)
    expect(isMemoryFileName('./memory/2026-04-03.md')).toBe(true)
    expect(isMemoryFileName('memory/heartbeat-state.json')).toBe(true)
    expect(isMemoryFileName('notes/2026-04-03.md')).toBe(false)
  })

  it('sorts memory files by root memory first and recent daily files before others', () => {
    const sorted = sortMemoryFileNames([
      'memory\\projects.md',
      'memory/2026-04-01.md',
      './memory/2026-04-03-api-design.md',
      'MEMORY.md',
      'memory.md',
      'memory/daily/2026-04-02-retro.md'
    ])

    expect(sorted).toEqual([
      'MEMORY.md',
      'memory.md',
      'memory/2026-04-03-api-design.md',
      'memory/daily/2026-04-02-retro.md',
      'memory/2026-04-01.md',
      'memory/projects.md'
    ])
  })

  it('formats list labels for daily and scoped memory files', () => {
    expect(toMemoryListLabel('memory/2026-04-03.md')).toBe('2026-04-03')
    expect(toMemoryListLabel('memory/2026-04-03-api-design.md')).toBe('2026-04-03 · api design')
    expect(toMemoryListLabel('memory\\2026-04-03-team_sync.md')).toBe('2026-04-03 · team sync')
    expect(toMemoryListLabel('memory/notes/project-x.md')).toBe('notes/project-x.md')
  })
})
