import { OPENCLAW_SKILL_FILE_NAME } from '@/features/skills/lib/openclaw-skills-constants'
import { translateWithAppLanguage } from '@/shared/i18n/app-i18n'

const OPENCLAW_SKILL_FILE_NAME_LOWER = OPENCLAW_SKILL_FILE_NAME.toLowerCase()

function assertSkillFilePath(filePath: string): string {
  const normalized = filePath.trim()
  const lower = normalized.toLowerCase()
  const isSkillFile =
    lower === OPENCLAW_SKILL_FILE_NAME_LOWER ||
    lower.endsWith(`/${OPENCLAW_SKILL_FILE_NAME_LOWER}`) ||
    lower.endsWith(`\\${OPENCLAW_SKILL_FILE_NAME_LOWER}`)

  if (!normalized || !isSkillFile) {
    throw new Error(translateWithAppLanguage('skills.error.file.invalidSkillFilePath'))
  }

  return normalized
}

function normalizePathForCheck(pathValue: string): string {
  return pathValue.replace(/\\/g, '/').toLowerCase()
}

function assertCustomSkillPaths(params: { baseDir: string; filePath: string }): {
  safeBaseDir: string
  safeFilePath: string
} {
  const safeBaseDir = params.baseDir.trim()
  const safeFilePath = assertSkillFilePath(params.filePath)

  if (!safeBaseDir) {
    throw new Error(translateWithAppLanguage('skills.error.file.invalidSkillDirPath'))
  }

  const normalizedBaseDir = normalizePathForCheck(safeBaseDir).replace(/\/+$/, '')
  const normalizedFilePath = normalizePathForCheck(safeFilePath)
  const looksLikeSkillsDir = normalizedBaseDir.includes('/skills/')
  const isRootDir =
    normalizedBaseDir === '/' || /^[a-z]:\/?$/.test(normalizedBaseDir) || normalizedBaseDir === '.'

  if (!looksLikeSkillsDir || isRootDir) {
    throw new Error(translateWithAppLanguage('skills.error.file.deleteScopeInvalid'))
  }

  if (!(normalizedFilePath === `${normalizedBaseDir}/${OPENCLAW_SKILL_FILE_NAME_LOWER}`)) {
    throw new Error(translateWithAppLanguage('skills.error.file.pathMismatch'))
  }

  return { safeBaseDir, safeFilePath }
}

function quoteShell(value: string): string {
  return `'${value.replace(/'/g, "'\"'\"'")}'`
}

function encodeUtf8ToBase64(value: string): string {
  const bytes = new TextEncoder().encode(value)
  let binary = ''
  const chunkSize = 0x8000

  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize)
    binary += String.fromCharCode(...chunk)
  }

  return btoa(binary)
}

export function buildReadSkillFileCommand(filePath: string): string {
  const safePath = assertSkillFilePath(filePath)
  const quotedPath = quoteShell(safePath)

  return [
    'set -e',
    `if [ -f ${quotedPath} ]; then`,
    `  cat ${quotedPath}`,
    'else',
    "  printf ''",
    'fi'
  ].join('\n')
}

export function buildWriteSkillFileCommand(filePath: string, content: string): string {
  const safePath = assertSkillFilePath(filePath)
  const quotedPath = quoteShell(safePath)
  const encodedContent = quoteShell(encodeUtf8ToBase64(content))

  return [
    'set -e',
    `mkdir -p "$(dirname ${quotedPath})"`,
    `if printf '%s' ${encodedContent} | base64 --decode > ${quotedPath} 2>/dev/null; then`,
    '  :',
    `elif printf '%s' ${encodedContent} | base64 -d > ${quotedPath} 2>/dev/null; then`,
    '  :',
    'else',
    `  printf '%s' ${encodedContent} | base64 -D > ${quotedPath}`,
    'fi'
  ].join('\n')
}

export function buildDeleteCustomSkillCommand(params: {
  baseDir: string
  filePath: string
}): string {
  const { safeBaseDir } = assertCustomSkillPaths(params)
  const quotedBaseDir = quoteShell(safeBaseDir)

  return ['set -e', `if [ -d ${quotedBaseDir} ]; then`, `  rm -rf -- ${quotedBaseDir}`, 'fi'].join(
    '\n'
  )
}
