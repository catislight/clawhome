import { mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

function normalizePathForCheck(pathValue: string): string {
  return pathValue.replace(/\\/g, '/').toLowerCase()
}

function expandLeadingHomeAlias(pathValue: string): string {
  const trimmed = pathValue.trim()
  if (trimmed === '~') {
    return os.homedir()
  }
  if (trimmed.startsWith('~/') || trimmed.startsWith('~\\')) {
    return path.join(os.homedir(), trimmed.slice(2))
  }
  return trimmed
}

function assertWorkspacePath(workspacePath: string): string {
  const normalized = expandLeadingHomeAlias(workspacePath)
  if (!normalized) {
    throw new Error('工作区路径无效。')
  }

  const resolved = path.resolve(normalized)
  const parsed = path.parse(resolved)
  if (parsed.root === resolved) {
    throw new Error('工作区路径无效。')
  }

  return resolved
}

function resolveMemoryRoot(workspacePath: string): string {
  const safeWorkspace = assertWorkspacePath(workspacePath)
  return path.resolve(safeWorkspace, 'memory')
}

function resolveMemoryFilePath(workspacePath: string, relativeFilePath: string): string {
  const normalizedRelative = relativeFilePath.trim().replace(/\\/g, '/').replace(/^\/+/, '')
  if (!normalizedRelative || !normalizedRelative.toLowerCase().startsWith('memory/')) {
    throw new Error('仅允许读写 memory/ 目录下的文件。')
  }

  const safeWorkspace = assertWorkspacePath(workspacePath)
  const memoryRoot = resolveMemoryRoot(safeWorkspace)
  const resolvedTarget = path.resolve(safeWorkspace, normalizedRelative)
  const normalizedRoot = normalizePathForCheck(memoryRoot).replace(/\/+$/, '')
  const normalizedTarget = normalizePathForCheck(resolvedTarget)

  if (!normalizedTarget.startsWith(`${normalizedRoot}/`)) {
    throw new Error('仅允许读写 memory/ 目录下的文件。')
  }

  return resolvedTarget
}

async function collectMemoryFiles(params: {
  dirPath: string
  prefix: string
  depth: number
}): Promise<string[]> {
  if (params.depth > 8) {
    return []
  }

  const entries = await readdir(params.dirPath, { withFileTypes: true })
  const collected: string[] = []

  for (const entry of entries) {
    const nextRelative = params.prefix ? `${params.prefix}/${entry.name}` : entry.name
    if (entry.isDirectory()) {
      const nested = await collectMemoryFiles({
        dirPath: path.resolve(params.dirPath, entry.name),
        prefix: nextRelative,
        depth: params.depth + 1
      })
      collected.push(...nested)
      continue
    }

    if (entry.isFile()) {
      collected.push(`memory/${nextRelative.replace(/\\/g, '/')}`)
    }
  }

  return collected
}

export async function listLocalMemoryFiles(workspacePath: string): Promise<string[]> {
  const memoryRoot = resolveMemoryRoot(workspacePath)

  try {
    return await collectMemoryFiles({
      dirPath: memoryRoot,
      prefix: '',
      depth: 0
    })
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException
    if (nodeError?.code === 'ENOENT') {
      return []
    }
    throw error
  }
}

export async function readLocalMemoryFile(params: {
  workspacePath: string
  relativeFilePath: string
}): Promise<{ found: boolean; content: string }> {
  const safePath = resolveMemoryFilePath(params.workspacePath, params.relativeFilePath)

  try {
    const content = await readFile(safePath, 'utf8')
    return {
      found: true,
      content
    }
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException
    if (nodeError?.code === 'ENOENT') {
      return {
        found: false,
        content: ''
      }
    }
    throw error
  }
}

export async function writeLocalMemoryFile(params: {
  workspacePath: string
  relativeFilePath: string
  content: string
}): Promise<void> {
  const safePath = resolveMemoryFilePath(params.workspacePath, params.relativeFilePath)
  await mkdir(path.dirname(safePath), {
    recursive: true
  })
  await writeFile(safePath, params.content, 'utf8')
}

export async function deleteLocalMemoryFile(params: {
  workspacePath: string
  relativeFilePath: string
}): Promise<boolean> {
  const safePath = resolveMemoryFilePath(params.workspacePath, params.relativeFilePath)

  try {
    await stat(safePath)
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException
    if (nodeError?.code === 'ENOENT') {
      return false
    }
    throw error
  }

  await rm(safePath, {
    force: true
  })
  return true
}
