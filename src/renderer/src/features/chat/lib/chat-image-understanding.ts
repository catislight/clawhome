import { uploadWorkspaceImage } from '@/shared/api/app-api'
import type { ChatSubmitImage } from '@/features/chat/lib/chat-send-types'
import type { SshConnectionFormValues } from '@/features/instances/model/ssh-connection'

export type UploadedChatImage = {
  fileName: string
  relativePath: string
  absolutePath: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function readTrimmedString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null
  }

  const normalized = value.trim()
  return normalized ? normalized : null
}

function splitFileName(pathValue: string): string {
  return pathValue.split(/[\\/]/).filter(Boolean).at(-1) || pathValue
}

function resolveImageFileName(image: ChatSubmitImage, index: number): string {
  return (
    readTrimmedString(image.fileName) ||
    (image.relativePath ? splitFileName(image.relativePath) : null) ||
    `image-${index + 1}.png`
  )
}

function parseImageDataUrl(src: string): { mimeType?: string; base64Data: string } | null {
  const matched = src.match(/^data:([^;,]+)?;base64,([\s\S]+)$/i)
  if (!matched) {
    return null
  }

  const mimeType = readTrimmedString(matched[1]) ?? undefined
  const base64Data = matched[2]?.trim()

  if (!base64Data) {
    return null
  }

  return {
    mimeType,
    base64Data
  }
}

export function parseWorkspacePathFromConfigPayload(payload: unknown): string | null {
  if (!isRecord(payload)) {
    return null
  }

  const rootConfig = isRecord(payload.config) ? payload.config : payload
  const agents = isRecord(rootConfig.agents) ? rootConfig.agents : null
  const defaults = agents && isRecord(agents.defaults) ? agents.defaults : null

  return defaults ? readTrimmedString(defaults.workspace) : null
}

export function buildImageOnlyUserMessage(images: ChatSubmitImage[]): string {
  const names = images
    .map((image, index) => resolveImageFileName(image, index))
    .filter((name, index, array) => Boolean(name) && array.indexOf(name) === index)

  if (names.length === 0) {
    return '请理解我上传的图片内容。'
  }

  return `请理解我上传的图片：${names.join('、')}`
}

export function buildImageUnderstandingPrompt(params: {
  userMessage: string
  images: UploadedChatImage[]
}): string {
  const normalizedUserMessage = params.userMessage.trim() || '请读取这些图片并给出关键信息总结。'
  const imageLines = params.images.map(
    (image, index) => `${index + 1}. ${image.relativePath} (absolute: ${image.absolutePath})`
  )

  return [
    '你将收到一组图片文件。请先逐张读取图片内容，再回答用户请求。',
    '如果图片读取失败，请明确说明失败原因。',
    '',
    '图片列表：',
    ...imageLines,
    '',
    '用户请求：',
    normalizedUserMessage
  ].join('\n')
}

export async function uploadChatImagesToWorkspace(params: {
  images: ChatSubmitImage[]
  workspacePath: string
  connectionConfig?: SshConnectionFormValues | null
}): Promise<UploadedChatImage[]> {
  const uploaded: UploadedChatImage[] = []

  for (const [index, image] of params.images.entries()) {
    const fileName = resolveImageFileName(image, index)
    const existingRelativePath = readTrimmedString(image.relativePath)
    const existingAbsolutePath = readTrimmedString(image.absolutePath)

    if (existingRelativePath && existingAbsolutePath) {
      uploaded.push({
        fileName,
        relativePath: existingRelativePath,
        absolutePath: existingAbsolutePath
      })
      continue
    }

    const normalizedSrc = image.src.trim()
    const parsedDataUrl = parseImageDataUrl(normalizedSrc)

    if (!parsedDataUrl) {
      throw new Error(`图片 ${fileName} 无法读取：当前仅支持 data URL 图片输入。`)
    }

    const result = await uploadWorkspaceImage({
      workspacePath: params.workspacePath,
      fileName,
      mimeType: parsedDataUrl.mimeType,
      base64Data: parsedDataUrl.base64Data,
      connection: params.connectionConfig ?? undefined
    })

    if (!result.success) {
      throw new Error(result.message || `图片 ${fileName} 上传失败。`)
    }

    uploaded.push({
      fileName: result.fileName || fileName,
      relativePath: result.relativePath,
      absolutePath: result.absolutePath
    })
  }

  return uploaded
}
