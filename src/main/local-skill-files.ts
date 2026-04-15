import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'

function normalizePathForCheck(pathValue: string): string {
  return pathValue.replace(/\\/g, '/').toLowerCase()
}

function isPathRoot(targetPath: string): boolean {
  const resolved = path.resolve(targetPath)
  return path.parse(resolved).root === resolved
}

function assertSkillFilePath(filePath: string): string {
  const normalized = filePath.trim()
  if (!normalized) {
    throw new Error('技能文件路径无效，仅允许读写 SKILL.md。')
  }

  const resolvedPath = path.resolve(normalized)
  const normalizedResolvedPath = normalizePathForCheck(resolvedPath)
  const isSkillFile =
    normalizedResolvedPath.endsWith('/skill.md') || normalizedResolvedPath === 'skill.md'

  if (!isSkillFile) {
    throw new Error('技能文件路径无效，仅允许读写 SKILL.md。')
  }

  return resolvedPath
}

function assertCustomSkillPaths(params: { baseDir: string; filePath: string }): {
  safeBaseDir: string
  safeFilePath: string
} {
  const safeBaseDirRaw = params.baseDir.trim()
  if (!safeBaseDirRaw) {
    throw new Error('技能目录路径无效，无法删除。')
  }

  const safeBaseDir = path.resolve(safeBaseDirRaw)
  const safeFilePath = assertSkillFilePath(params.filePath)

  const normalizedBaseDir = normalizePathForCheck(safeBaseDir).replace(/\/+$/, '')
  const normalizedFilePath = normalizePathForCheck(safeFilePath)
  const looksLikeSkillsDir =
    normalizedBaseDir.includes('/skills/') || normalizedBaseDir.endsWith('/skills')

  if (!looksLikeSkillsDir || isPathRoot(safeBaseDir)) {
    throw new Error('仅允许删除 workspace 下的自定义 skills 目录。')
  }

  const expectedSkillPath = normalizePathForCheck(path.resolve(safeBaseDir, 'SKILL.md'))
  if (normalizedFilePath !== expectedSkillPath) {
    throw new Error('技能目录与 SKILL.md 路径不匹配，无法删除。')
  }

  return {
    safeBaseDir,
    safeFilePath
  }
}

export async function readLocalSkillFile(filePath: string): Promise<string> {
  const safePath = assertSkillFilePath(filePath)

  try {
    return await readFile(safePath, 'utf8')
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException
    if (nodeError?.code === 'ENOENT') {
      return ''
    }

    throw error
  }
}

export async function writeLocalSkillFile(filePath: string, content: string): Promise<void> {
  const safePath = assertSkillFilePath(filePath)
  await mkdir(path.dirname(safePath), {
    recursive: true
  })
  await writeFile(safePath, content, 'utf8')
}

export async function deleteLocalCustomSkill(params: {
  baseDir: string
  filePath: string
}): Promise<void> {
  const { safeBaseDir } = assertCustomSkillPaths(params)

  await rm(safeBaseDir, {
    recursive: true,
    force: true
  })
}
