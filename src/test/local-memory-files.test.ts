import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

import {
  deleteLocalMemoryFile,
  listLocalMemoryFiles,
  readLocalMemoryFile,
  writeLocalMemoryFile
} from '../main/local-memory-files'

describe('local-memory-files', () => {
  let tempHomeDir: string | null = null
  const originalHome = process.env.HOME
  const originalUserProfile = process.env.USERPROFILE

  afterEach(async () => {
    process.env.HOME = originalHome
    process.env.USERPROFILE = originalUserProfile

    if (tempHomeDir) {
      await rm(tempHomeDir, {
        recursive: true,
        force: true
      })
      tempHomeDir = null
    }
  })

  it('expands leading ~ in workspacePath for local memory list/read/write', async () => {
    tempHomeDir = await mkdtemp(path.join(os.tmpdir(), 'openclaw-memory-home-'))
    process.env.HOME = tempHomeDir
    process.env.USERPROFILE = tempHomeDir

    const workspaceDir = path.join(tempHomeDir, 'workspace')
    const memoryDir = path.join(workspaceDir, 'memory')
    await mkdir(memoryDir, { recursive: true })
    await writeFile(path.join(memoryDir, '2026-04-03.md'), '# from home alias\n', 'utf8')

    const files = await listLocalMemoryFiles('~/workspace')
    expect(files).toEqual(['memory/2026-04-03.md'])

    const readResult = await readLocalMemoryFile({
      workspacePath: '~/workspace',
      relativeFilePath: 'memory/2026-04-03.md'
    })
    expect(readResult).toEqual({
      found: true,
      content: '# from home alias\n'
    })

    await writeLocalMemoryFile({
      workspacePath: '~/workspace',
      relativeFilePath: 'memory/2026-04-04.md',
      content: '# written through alias\n'
    })

    const written = await readFile(path.join(memoryDir, '2026-04-04.md'), 'utf8')
    expect(written).toBe('# written through alias\n')

    const deleted = await deleteLocalMemoryFile({
      workspacePath: '~/workspace',
      relativeFilePath: 'memory/2026-04-04.md'
    })
    expect(deleted).toBe(true)

    const afterDelete = await readLocalMemoryFile({
      workspacePath: '~/workspace',
      relativeFilePath: 'memory/2026-04-04.md'
    })
    expect(afterDelete).toEqual({
      found: false,
      content: ''
    })
  })

  it('rejects deleting root MEMORY.md', async () => {
    tempHomeDir = await mkdtemp(path.join(os.tmpdir(), 'openclaw-memory-home-'))
    process.env.HOME = tempHomeDir
    process.env.USERPROFILE = tempHomeDir

    await expect(
      deleteLocalMemoryFile({
        workspacePath: '~/workspace',
        relativeFilePath: 'MEMORY.md'
      })
    ).rejects.toThrow('仅允许读写 memory/ 目录下的文件。')
  })
})
