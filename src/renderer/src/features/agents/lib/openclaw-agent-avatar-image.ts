import { useEffect, useState } from 'react'

import type { SshConnectionFormValues } from '@/features/instances/model/ssh-connection'
import { translateWithAppLanguage } from '@/shared/i18n/app-i18n'
import { readWorkspaceImage, uploadWorkspaceImage } from '@/shared/api/app-api'

export const MAX_AGENT_AVATAR_FILE_SIZE_BYTES = 5 * 1024 * 1024

const DIRECT_IMAGE_SOURCE_PATTERN = /^(https?:\/\/|data:image\/)/i
const ABSOLUTE_PATH_PATTERN = /^(~[\\/]|\/|[a-z]:[\\/])/i
const avatarPreviewCache = new Map<string, string>()

type ResolveAvatarPreviewSourceParams = {
  avatar: string
  workspacePath?: string
  connectionConfig?: SshConnectionFormValues | null
}

type UploadAgentAvatarFileParams = {
  file: File
  workspacePath: string
  connectionConfig?: SshConnectionFormValues | null
}

type UploadAgentAvatarFileResult = {
  avatar: string
  previewSrc: string
  absolutePath: string
}

function readTrimmedString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function buildAvatarCacheKey(params: ResolveAvatarPreviewSourceParams): string {
  const connection = params.connectionConfig
  return JSON.stringify({
    avatar: readTrimmedString(params.avatar),
    workspacePath: readTrimmedString(params.workspacePath),
    host: readTrimmedString(connection?.host),
    port: typeof connection?.port === 'number' ? connection.port : null,
    username: readTrimmedString(connection?.username)
  })
}

function parseImageDataUrl(value: string): { mimeType?: string; base64Data: string } | null {
  const matched = value.match(/^data:([^;,]+)?;base64,([\s\S]+)$/i)
  if (!matched?.[2]) {
    return null
  }

  return {
    mimeType: readTrimmedString(matched[1]) || undefined,
    base64Data: matched[2].trim()
  }
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => {
      reject(new Error(translateWithAppLanguage('agents.error.avatar.readFailed')))
    }
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : ''
      if (!result) {
        reject(new Error(translateWithAppLanguage('agents.error.avatar.readFailed')))
        return
      }
      resolve(result)
    }
    reader.readAsDataURL(file)
  })
}

export function isDirectAgentAvatarSource(value: string): boolean {
  return DIRECT_IMAGE_SOURCE_PATTERN.test(value.trim())
}

export function isAbsolutePathLike(value: string): boolean {
  return ABSOLUTE_PATH_PATTERN.test(value.trim())
}

export async function resolveAgentAvatarPreviewSource(
  params: ResolveAvatarPreviewSourceParams
): Promise<string | null> {
  const avatar = params.avatar.trim()
  if (!avatar) {
    return null
  }

  if (isDirectAgentAvatarSource(avatar)) {
    return avatar
  }

  const cacheKey = buildAvatarCacheKey(params)
  const cached = avatarPreviewCache.get(cacheKey)
  if (cached) {
    return cached
  }

  const payload = isAbsolutePathLike(avatar)
    ? {
        absolutePath: avatar,
        connection: params.connectionConfig ?? undefined
      }
    : {
        relativePath: avatar,
        workspacePath: readTrimmedString(params.workspacePath) || undefined,
        connection: params.connectionConfig ?? undefined
      }

  if (!('absolutePath' in payload) && !payload.workspacePath) {
    return null
  }

  const response = await readWorkspaceImage(payload)
  if (!response.success || !readTrimmedString(response.base64Data)) {
    return null
  }

  const previewSrc = `data:${response.mimeType || 'application/octet-stream'};base64,${response.base64Data}`
  avatarPreviewCache.set(cacheKey, previewSrc)
  return previewSrc
}

export async function uploadAgentAvatarFile(
  params: UploadAgentAvatarFileParams
): Promise<UploadAgentAvatarFileResult> {
  if (params.file.size > MAX_AGENT_AVATAR_FILE_SIZE_BYTES) {
    throw new Error(translateWithAppLanguage('agents.error.avatar.fileTooLarge'))
  }

  const dataUrl = await readFileAsDataUrl(params.file)
  const parsed = parseImageDataUrl(dataUrl)
  if (!parsed) {
    throw new Error(translateWithAppLanguage('agents.error.avatar.fileTypeUnsupported'))
  }

  const uploadResult = await uploadWorkspaceImage({
    workspacePath: params.workspacePath,
    fileName: params.file.name,
    mimeType: parsed.mimeType,
    base64Data: parsed.base64Data,
    connection: params.connectionConfig ?? undefined
  })

  if (!uploadResult.success) {
    throw new Error(uploadResult.message || translateWithAppLanguage('agents.error.avatar.uploadFailed'))
  }

  const avatarValue = readTrimmedString(uploadResult.relativePath) || readTrimmedString(uploadResult.absolutePath)
  if (!avatarValue) {
    throw new Error(translateWithAppLanguage('agents.error.avatar.uploadPathEmpty'))
  }

  return {
    avatar: avatarValue,
    previewSrc: dataUrl,
    absolutePath: readTrimmedString(uploadResult.absolutePath)
  }
}

export function useResolvedAgentAvatarSource(params: {
  avatar?: string
  workspacePath?: string
  connectionConfig?: SshConnectionFormValues | null
}): string | undefined {
  const avatar = readTrimmedString(params.avatar)
  const workspacePath = readTrimmedString(params.workspacePath)
  const [resolved, setResolved] = useState<string | undefined>(
    avatar && isDirectAgentAvatarSource(avatar) ? avatar : undefined
  )

  useEffect(() => {
    let cancelled = false

    if (!avatar) {
      setResolved(undefined)
      return () => {
        cancelled = true
      }
    }

    if (isDirectAgentAvatarSource(avatar)) {
      setResolved(avatar)
      return () => {
        cancelled = true
      }
    }

    void resolveAgentAvatarPreviewSource({
      avatar,
      workspacePath,
      connectionConfig: params.connectionConfig ?? undefined
    })
      .then((src) => {
        if (!cancelled) {
          setResolved(src ?? undefined)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setResolved(undefined)
        }
      })

    return () => {
      cancelled = true
    }
  }, [avatar, params.connectionConfig, workspacePath])

  return resolved
}
