import { randomUUID } from 'node:crypto'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import type { GatewayConnectionConfig } from '../preload/bridge-contract'
import { withSshClient } from './node-ssh-util'

type UploadWorkspaceImageParams = {
  workspacePath: string
  fileName?: string
  mimeType?: string
  base64Data: string
  connection?: GatewayConnectionConfig
}

type UploadWorkspaceImageResult = {
  fileName: string
  relativePath: string
  absolutePath: string
}

type ReadWorkspaceImageParams = {
  absolutePath?: string
  relativePath?: string
  workspacePath?: string
  connection?: GatewayConnectionConfig
}

type ReadWorkspaceImageResult = {
  mimeType: string
  base64Data: string
  absolutePath: string
}

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

function isBufferLikeBase64(value: string): boolean {
  return /^[A-Za-z0-9+/=\s]+$/.test(value)
}

function decodeBase64Image(base64Data: string): Buffer {
  const normalized = base64Data.trim().replace(/\s+/g, '')
  if (!normalized) {
    throw new Error('图片内容为空。')
  }
  if (!isBufferLikeBase64(normalized)) {
    throw new Error('图片内容格式无效。')
  }

  const buffer = Buffer.from(normalized, 'base64')
  if (buffer.length === 0) {
    throw new Error('图片内容解码失败。')
  }

  return buffer
}

function sanitizeFileStem(fileName: string): string {
  const baseName = path.basename(fileName || 'image')
  const rawStem = baseName.replace(/\.[^.]+$/, '')
  const sanitized = rawStem
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^[-._]+|[-._]+$/g, '')

  return sanitized || 'image'
}

function detectExtension(fileName: string | undefined, mimeType: string | undefined): string {
  const extFromName = path.extname(fileName || '').toLowerCase().replace(/^\./, '')
  if (extFromName) {
    return extFromName
  }

  const normalizedMime = (mimeType || '').trim().toLowerCase()
  const mimeMap: Record<string, string> = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'image/bmp': 'bmp',
    'image/tiff': 'tiff',
    'image/heic': 'heic',
    'image/heif': 'heif',
    'image/svg+xml': 'svg'
  }

  return mimeMap[normalizedMime] || 'png'
}

function detectMimeTypeFromPath(pathValue: string): string {
  const ext = path.extname(pathValue).toLowerCase()
  const mimeMap: Record<string, string> = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
    '.bmp': 'image/bmp',
    '.tif': 'image/tiff',
    '.tiff': 'image/tiff',
    '.heic': 'image/heic',
    '.heif': 'image/heif',
    '.svg': 'image/svg+xml'
  }

  return mimeMap[ext] || 'application/octet-stream'
}

function buildStoredFileName(fileName?: string, mimeType?: string): string {
  const stem = sanitizeFileStem(fileName || 'image').slice(0, 48)
  const ext = detectExtension(fileName, mimeType)
  const suffix = randomUUID().slice(0, 8)
  return `${Date.now()}-${suffix}-${stem}.${ext}`
}

function normalizePosixPath(value: string): string {
  return value.replace(/\\/g, '/').replace(/\/+$/g, '')
}

function normalizeRelativeImagePath(relativePath: string): string {
  const normalized = relativePath.trim().replace(/\\/g, '/').replace(/^\/+/, '')
  if (!normalized) {
    throw new Error('图片路径无效。')
  }

  if (!normalized.toLowerCase().startsWith('images/')) {
    throw new Error('仅允许读取 images/ 目录下的图片。')
  }

  return normalized
}

function assertImagesAbsolutePath(pathValue: string): string {
  const normalized = pathValue.trim()
  if (!normalized) {
    throw new Error('图片路径无效。')
  }

  const safePath = path.resolve(expandLeadingHomeAlias(normalized))
  const normalizedSafePath = normalizePathForCheck(safePath)
  if (!normalizedSafePath.includes('/images/')) {
    throw new Error('仅允许读取 images 目录下的图片。')
  }

  const parsed = path.parse(safePath)
  if (parsed.root === safePath) {
    throw new Error('图片路径无效。')
  }

  return safePath
}

function assertRemoteImagesAbsolutePath(pathValue: string): string {
  const normalized = normalizePosixPath(pathValue.trim())
  if (!normalized) {
    throw new Error('图片路径无效。')
  }

  if (!normalized.includes('/images/')) {
    throw new Error('仅允许读取 images 目录下的图片。')
  }

  return normalized
}

function escapeSingleQuotes(value: string): string {
  return value.replace(/'/g, `'"'"'`)
}

function assertSshConnectionConfig(
  connection: GatewayConnectionConfig | undefined
): Required<Pick<GatewayConnectionConfig, 'host' | 'port' | 'username' | 'password' | 'privateKey'>> &
  Pick<GatewayConnectionConfig, 'privateKeyPassphrase'> {
  if (!connection) {
    throw new Error('SSH 连接配置缺失，无法上传图片。')
  }

  const host = connection.host?.trim()
  const username = connection.username?.trim()

  if (!host || !username || !Number.isFinite(connection.port)) {
    throw new Error('SSH 连接配置不完整，无法上传图片。')
  }

  return {
    host,
    port: connection.port,
    username,
    password: connection.password ?? '',
    privateKey: connection.privateKey ?? '',
    privateKeyPassphrase: connection.privateKeyPassphrase
  }
}

function normalizeRemoteWorkspacePath(workspacePath: string): string {
  const normalized = normalizePosixPath(workspacePath.trim())
  if (!normalized) {
    throw new Error('工作区路径无效。')
  }

  if (normalized === '/') {
    throw new Error('工作区路径无效。')
  }

  return normalized
}

async function resolveRemoteWorkspacePath(
  workspacePath: string,
  connection: GatewayConnectionConfig
): Promise<string> {
  const normalized = normalizeRemoteWorkspacePath(workspacePath)
  if (!normalized.startsWith('~')) {
    return normalized
  }

  return await withSshClient(assertSshConnectionConfig(connection), async (ssh) => {
    const homeResult = await ssh.execCommand('printf %s "$HOME"')
    const home = normalizePosixPath(homeResult.stdout || '')
    if (!home) {
      throw new Error('无法解析远端 HOME 目录。')
    }

    if (normalized === '~') {
      return home
    }

    return `${home}/${normalized.replace(/^~\//, '')}`
  })
}

async function writeLocalWorkspaceImage(params: {
  workspacePath: string
  storedFileName: string
  bytes: Buffer
}): Promise<UploadWorkspaceImageResult> {
  const safeWorkspacePath = assertWorkspacePath(params.workspacePath)
  const imagesRoot = path.resolve(safeWorkspacePath, 'images')
  const absolutePath = path.resolve(imagesRoot, params.storedFileName)

  const normalizedRoot = normalizePathForCheck(imagesRoot).replace(/\/+$/, '')
  const normalizedTarget = normalizePathForCheck(absolutePath)
  if (!normalizedTarget.startsWith(`${normalizedRoot}/`)) {
    throw new Error('图片保存路径无效。')
  }

  await mkdir(imagesRoot, {
    recursive: true
  })
  await writeFile(absolutePath, params.bytes)

  return {
    fileName: params.storedFileName,
    relativePath: `images/${params.storedFileName}`,
    absolutePath
  }
}

async function writeSshWorkspaceImage(params: {
  workspacePath: string
  connection: GatewayConnectionConfig
  storedFileName: string
  bytes: Buffer
}): Promise<UploadWorkspaceImageResult> {
  const resolvedWorkspacePath = await resolveRemoteWorkspacePath(
    params.workspacePath,
    params.connection
  )
  const imagesDir = `${resolvedWorkspacePath}/images`
  const relativePath = `images/${params.storedFileName}`
  const absolutePath = `${imagesDir}/${params.storedFileName}`

  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'openclaw-image-upload-'))
  const tempFilePath = path.join(tempDir, params.storedFileName)
  await writeFile(tempFilePath, params.bytes)

  try {
    await withSshClient(assertSshConnectionConfig(params.connection), async (ssh) => {
      const mkdirResult = await ssh.execCommand(`mkdir -p '${escapeSingleQuotes(imagesDir)}'`)
      if ((mkdirResult.code ?? 1) !== 0) {
        throw new Error((mkdirResult.stderr || '远端 images 目录创建失败。').trim())
      }

      await ssh.putFile(tempFilePath, absolutePath)
    })

    return {
      fileName: params.storedFileName,
      relativePath,
      absolutePath
    }
  } finally {
    await rm(tempDir, {
      recursive: true,
      force: true
    })
  }
}

function resolveLocalImageAbsolutePath(params: ReadWorkspaceImageParams): string {
  if (params.absolutePath?.trim()) {
    return assertImagesAbsolutePath(params.absolutePath)
  }

  if (!params.workspacePath || !params.relativePath) {
    throw new Error('读取本地图片需要 absolutePath 或 workspacePath + relativePath。')
  }

  const safeWorkspacePath = assertWorkspacePath(params.workspacePath)
  const relativeImagePath = normalizeRelativeImagePath(params.relativePath)
  const absolutePath = path.resolve(safeWorkspacePath, relativeImagePath)
  const imagesRoot = path.resolve(safeWorkspacePath, 'images')
  const normalizedRoot = normalizePathForCheck(imagesRoot).replace(/\/+$/, '')
  const normalizedTarget = normalizePathForCheck(absolutePath)
  if (!normalizedTarget.startsWith(`${normalizedRoot}/`)) {
    throw new Error('仅允许读取 images/ 目录下的图片。')
  }

  return absolutePath
}

async function resolveRemoteImageAbsolutePath(params: ReadWorkspaceImageParams): Promise<string> {
  if (params.absolutePath?.trim()) {
    return assertRemoteImagesAbsolutePath(params.absolutePath)
  }

  if (!params.workspacePath || !params.relativePath || !params.connection) {
    throw new Error('读取远端图片需要 absolutePath 或 workspacePath + relativePath。')
  }

  const remoteWorkspacePath = await resolveRemoteWorkspacePath(params.workspacePath, params.connection)
  const relativeImagePath = normalizeRelativeImagePath(params.relativePath)
  return assertRemoteImagesAbsolutePath(`${remoteWorkspacePath}/${relativeImagePath}`)
}

export async function uploadWorkspaceImageFile(
  params: UploadWorkspaceImageParams
): Promise<UploadWorkspaceImageResult> {
  const bytes = decodeBase64Image(params.base64Data)
  const storedFileName = buildStoredFileName(params.fileName, params.mimeType)
  const connectionType = params.connection?.connectionType === 'local' ? 'local' : 'ssh'

  if (connectionType === 'local') {
    return await writeLocalWorkspaceImage({
      workspacePath: params.workspacePath,
      storedFileName,
      bytes
    })
  }

  if (!params.connection) {
    throw new Error('SSH 连接配置缺失，无法上传图片。')
  }

  return await writeSshWorkspaceImage({
    workspacePath: params.workspacePath,
    connection: params.connection,
    storedFileName,
    bytes
  })
}

export async function readWorkspaceImageFile(
  params: ReadWorkspaceImageParams
): Promise<ReadWorkspaceImageResult> {
  const connectionType = params.connection?.connectionType === 'local' ? 'local' : 'ssh'

  if (connectionType === 'local') {
    const absolutePath = resolveLocalImageAbsolutePath(params)
    const bytes = await readFile(absolutePath)
    return {
      mimeType: detectMimeTypeFromPath(absolutePath),
      base64Data: bytes.toString('base64'),
      absolutePath
    }
  }

  if (!params.connection) {
    throw new Error('SSH 连接配置缺失，无法读取图片。')
  }

  const remoteAbsolutePath = await resolveRemoteImageAbsolutePath(params)
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'openclaw-image-read-'))
  const tempPath = path.join(tempDir, path.basename(remoteAbsolutePath) || 'preview.bin')

  try {
    await withSshClient(assertSshConnectionConfig(params.connection), async (ssh) => {
      await ssh.getFile(tempPath, remoteAbsolutePath)
    })

    const bytes = await readFile(tempPath)
    return {
      mimeType: detectMimeTypeFromPath(remoteAbsolutePath),
      base64Data: bytes.toString('base64'),
      absolutePath: remoteAbsolutePath
    }
  } finally {
    await rm(tempDir, {
      recursive: true,
      force: true
    })
  }
}
