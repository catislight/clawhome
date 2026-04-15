import { runLocalOpenClawCli } from './local-openclaw-cli'

function normalizeCliMessage(rawMessage: string): string {
  return rawMessage.trim().toLowerCase()
}

export async function approveLocalOpenClawPairing(
  requestId: string
): Promise<{ success: boolean; message: string }> {
  const normalizedRequestId = requestId.trim()
  if (!normalizedRequestId) {
    return {
      success: false,
      message: 'pairing requestId 为空，无法自动配对。'
    }
  }

  try {
    await runLocalOpenClawCli(['devices', 'approve', normalizedRequestId, '--json'])
    return {
      success: true,
      message: '本地配对请求已自动批准。'
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const normalizedMessage = normalizeCliMessage(message)

    if (
      normalizedMessage.includes('unknown requestid') ||
      normalizedMessage.includes('no pending device pairing requests')
    ) {
      return {
        success: false,
        message: '未找到可批准的配对请求，可能已被处理。'
      }
    }

    return {
      success: false,
      message: `自动配对失败：${message}`
    }
  }
}
