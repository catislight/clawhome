import { executeSshCommand } from '@/shared/api/app-api'
import { sortMemoryFileNames } from '@/features/agents/lib/openclaw-agent-memory-files'
import type { SshConnectionFormValues } from '@/features/instances/model/ssh-connection'
import { translateWithAppLanguage } from '@/shared/i18n/app-i18n'

export const SSH_MEMORY_MISSING_MARKER = '__OPENCLAW_MEMORY_FILE_MISSING__'
export const SSH_MEMORY_DELETED_MARKER = '__OPENCLAW_MEMORY_FILE_DELETED__'

function quoteShell(value: string): string {
  return `'${value.replace(/'/g, `'"'"'`)}'`
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

export function normalizePosixPath(value: string): string {
  return value
    .replace(/\\/g, '/')
    .replace(/\/{2,}/g, '/')
    .replace(/\/+$/, '')
}

function normalizeMemoryRelativePath(value: string): string | null {
  const normalized = value.trim().replace(/\\/g, '/').replace(/^\.\//, '')
  if (!normalized) {
    return null
  }
  return normalized.startsWith('memory/') ? normalized : `memory/${normalized}`
}

function buildWorkspaceFilePath(workspacePath: string, relativeFilePath: string): string {
  const normalizedWorkspace = normalizePosixPath(workspacePath)
  const normalizedFilePath = relativeFilePath.replace(/^\/+/, '')
  return normalizedWorkspace ? `${normalizedWorkspace}/${normalizedFilePath}` : normalizedFilePath
}

function buildListMemoryFilesCommand(workspacePath: string): string {
  const quotedWorkspace = quoteShell(workspacePath)
  return [
    'set -e',
    `workspace=${quotedWorkspace}`,
    'memory_dir="$workspace/memory"',
    'if [ -d "$memory_dir" ]; then',
    '  (cd "$memory_dir" && find . -maxdepth 8 -type f -print) | sed \'s#^\\./##\'',
    'fi'
  ].join('\n')
}

function buildReadWorkspaceFileCommand(workspacePath: string, relativeFilePath: string): string {
  const filePath = buildWorkspaceFilePath(workspacePath, relativeFilePath)
  const quotedFilePath = quoteShell(filePath)
  const quotedMissingMarker = quoteShell(SSH_MEMORY_MISSING_MARKER)

  return [
    'set -e',
    `if [ -f ${quotedFilePath} ]; then`,
    `  cat ${quotedFilePath}`,
    'else',
    `  printf '%s' ${quotedMissingMarker}`,
    'fi'
  ].join('\n')
}

function buildWriteWorkspaceFileCommand(
  workspacePath: string,
  relativeFilePath: string,
  content: string
): string {
  const filePath = buildWorkspaceFilePath(workspacePath, relativeFilePath)
  const quotedFilePath = quoteShell(filePath)
  const encodedContent = quoteShell(encodeUtf8ToBase64(content))

  return [
    'set -e',
    `mkdir -p "$(dirname ${quotedFilePath})"`,
    `if printf '%s' ${encodedContent} | base64 --decode > ${quotedFilePath} 2>/dev/null; then`,
    '  :',
    `elif printf '%s' ${encodedContent} | base64 -d > ${quotedFilePath} 2>/dev/null; then`,
    '  :',
    'else',
    `  printf '%s' ${encodedContent} | base64 -D > ${quotedFilePath}`,
    'fi'
  ].join('\n')
}

function buildDeleteWorkspaceFileCommand(workspacePath: string, relativeFilePath: string): string {
  const filePath = buildWorkspaceFilePath(workspacePath, relativeFilePath)
  const quotedFilePath = quoteShell(filePath)
  const quotedDeletedMarker = quoteShell(SSH_MEMORY_DELETED_MARKER)
  const quotedMissingMarker = quoteShell(SSH_MEMORY_MISSING_MARKER)

  return [
    'set -e',
    `if [ -f ${quotedFilePath} ]; then`,
    `  rm -f ${quotedFilePath}`,
    `  printf '%s' ${quotedDeletedMarker}`,
    'else',
    `  printf '%s' ${quotedMissingMarker}`,
    'fi'
  ].join('\n')
}

export function resolveMemoryWorkspaceCandidates(params: {
  selectedAgentWorkspace?: string
  filesWorkspace?: string
}): string[] {
  const normalizedSet = new Set<string>()
  const resolved: string[] = []

  const pushCandidate = (rawValue: string | null | undefined): void => {
    const trimmed = rawValue?.trim()
    if (!trimmed) {
      return
    }
    const normalized = normalizePosixPath(trimmed)
    if (!normalized || normalizedSet.has(normalized)) {
      return
    }
    normalizedSet.add(normalized)
    resolved.push(trimmed)
  }

  pushCandidate(params.selectedAgentWorkspace)
  pushCandidate(params.filesWorkspace)

  return resolved
}

export async function discoverMemoryFilesViaSsh(params: {
  connection: SshConnectionFormValues
  workspacePath: string
}): Promise<string[]> {
  const command = buildListMemoryFilesCommand(params.workspacePath)
  const result = await executeSshCommand({
    ...params.connection,
    command
  })

  if (!result.success) {
    const fallback = translateWithAppLanguage('agents.error.sshMemory.listFailed')
    const message = (result.stderr || result.message || fallback).trim()
    throw new Error(message || fallback)
  }

  const fileNames = result.stdout
    .split(/\r?\n/g)
    .map((line) => normalizeMemoryRelativePath(line))
    .filter((value): value is string => Boolean(value))

  return sortMemoryFileNames(fileNames)
}

export async function readMemoryFileViaSsh(params: {
  connection: SshConnectionFormValues
  workspacePath: string
  relativeFilePath: string
}): Promise<{ found: boolean; content: string }> {
  const command = buildReadWorkspaceFileCommand(params.workspacePath, params.relativeFilePath)
  const result = await executeSshCommand({
    ...params.connection,
    command
  })

  if (!result.success) {
    const fallback = translateWithAppLanguage('agents.error.sshMemory.readFailed')
    const message = (result.stderr || result.message || fallback).trim()
    throw new Error(message || fallback)
  }

  return {
    found: result.stdout.trim() !== SSH_MEMORY_MISSING_MARKER,
    content: result.stdout
  }
}

export async function writeMemoryFileViaSsh(params: {
  connection: SshConnectionFormValues
  workspacePath: string
  relativeFilePath: string
  content: string
}): Promise<void> {
  const command = buildWriteWorkspaceFileCommand(
    params.workspacePath,
    params.relativeFilePath,
    params.content
  )
  const result = await executeSshCommand({
    ...params.connection,
    command
  })

  if (!result.success) {
    const fallback = translateWithAppLanguage('agents.error.sshMemory.writeFailed')
    const message = (result.stderr || result.message || fallback).trim()
    throw new Error(message || fallback)
  }
}

export async function deleteMemoryFileViaSsh(params: {
  connection: SshConnectionFormValues
  workspacePath: string
  relativeFilePath: string
}): Promise<boolean> {
  const command = buildDeleteWorkspaceFileCommand(params.workspacePath, params.relativeFilePath)
  const result = await executeSshCommand({
    ...params.connection,
    command
  })

  if (!result.success) {
    const fallback = translateWithAppLanguage('agents.error.sshMemory.deleteFailed')
    const message = (result.stderr || result.message || fallback).trim()
    throw new Error(message || fallback)
  }

  return result.stdout.trim() === SSH_MEMORY_DELETED_MARKER
}
