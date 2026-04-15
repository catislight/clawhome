import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  buildImageOnlyUserMessage,
  buildImageUnderstandingPrompt,
  parseWorkspacePathFromConfigPayload,
  uploadChatImagesToWorkspace
} from '../renderer/src/features/chat/lib/chat-image-understanding'

describe('chat-image-understanding', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('parses workspace path from config payload', () => {
    const workspacePath = parseWorkspacePathFromConfigPayload({
      config: {
        agents: {
          defaults: {
            workspace: ' ~/.openclaw/workspace-main '
          }
        }
      }
    })

    expect(workspacePath).toBe('~/.openclaw/workspace-main')
  })

  it('builds a stable image-only user message', () => {
    const message = buildImageOnlyUserMessage([
      {
        src: 'data:image/png;base64,AAAA',
        fileName: 'screen.png'
      }
    ])

    expect(message).toContain('screen.png')
  })

  it('builds image understanding prompt with image paths and user request', () => {
    const prompt = buildImageUnderstandingPrompt({
      userMessage: '帮我总结图里的重点',
      images: [
        {
          fileName: 'screen.png',
          relativePath: 'images/1-screen.png',
          absolutePath: '/workspace/images/1-screen.png'
        }
      ]
    })

    expect(prompt).toContain('图片列表：')
    expect(prompt).toContain('images/1-screen.png')
    expect(prompt).toContain('帮我总结图里的重点')
  })

  it('uploads data-url images to workspace/images', async () => {
    const uploadWorkspaceImageMock = vi.mocked(window.api.uploadWorkspaceImage)
    uploadWorkspaceImageMock.mockResolvedValueOnce({
      success: true,
      message: 'ok',
      fileName: 'uploaded-a.png',
      relativePath: 'images/uploaded-a.png',
      absolutePath: '/workspace/images/uploaded-a.png'
    })

    const uploaded = await uploadChatImagesToWorkspace({
      workspacePath: '/workspace',
      connectionConfig: {
        connectionType: 'local',
        title: 'local',
        host: '127.0.0.1',
        port: 22,
        username: 'user',
        password: '',
        privateKey: ''
      },
      images: [
        {
          src: 'data:image/png;base64,QUJDRA==',
          fileName: 'sample.png'
        }
      ]
    })

    expect(uploadWorkspaceImageMock).toHaveBeenCalledTimes(1)
    expect(uploadWorkspaceImageMock).toHaveBeenCalledWith(
      expect.objectContaining({
        workspacePath: '/workspace',
        fileName: 'sample.png'
      })
    )
    expect(uploaded).toEqual([
      {
        fileName: 'uploaded-a.png',
        relativePath: 'images/uploaded-a.png',
        absolutePath: '/workspace/images/uploaded-a.png'
      }
    ])
  })

  it('reuses existing image paths without re-upload', async () => {
    const uploadWorkspaceImageMock = vi.mocked(window.api.uploadWorkspaceImage)

    const uploaded = await uploadChatImagesToWorkspace({
      workspacePath: '/workspace',
      images: [
        {
          src: 'data:image/png;base64,AAAA',
          fileName: 'cached.png',
          relativePath: 'images/cached.png',
          absolutePath: '/workspace/images/cached.png'
        }
      ]
    })

    expect(uploadWorkspaceImageMock).not.toHaveBeenCalled()
    expect(uploaded[0]).toMatchObject({
      relativePath: 'images/cached.png',
      absolutePath: '/workspace/images/cached.png'
    })
  })
})
