import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useState, type ReactNode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { SshConnectionFormValues } from '../renderer/src/features/instances/model/ssh-connection'
import {
  createInitialAppStoreState,
  useAppStore
} from '../renderer/src/features/instances/store/use-app-store'

const { conversationOutputRenderSpy } = vi.hoisted(() => ({
  conversationOutputRenderSpy: vi.fn()
}))

vi.mock('../renderer/src/features/chat/components/conversation-output', () => ({
  default: function MockConversationOutput(): React.JSX.Element {
    conversationOutputRenderSpy()
    return <div data-testid="conversation-output" />
  }
}))

vi.mock('../renderer/src/features/chat/components/editor/SlashInput', () => ({
  default: function MockSlashInput(props: {
    onSend?: (content: {
      raw: { type: string; content: never[] }
      text: string
      images: unknown[]
      attachments: unknown[]
      tags: unknown[]
    }) => void
    ariaLabel?: string
    submitLabel?: string
    disabled?: boolean
    submitting?: boolean
    footerLeading?: ReactNode
  }): React.JSX.Element {
    const [value, setValue] = useState('')
    const locked = Boolean(props.disabled || props.submitting)

    return (
      <form
        onSubmit={(event) => {
          event.preventDefault()
          if (!value.trim() || locked) {
            return
          }
          props.onSend?.({
            raw: { type: 'doc', content: [] },
            text: value,
            images: [],
            attachments: [],
            tags: []
          })
          setValue('')
        }}
      >
        <div>{props.footerLeading}</div>
        <textarea
          aria-label={props.ariaLabel ?? '消息输入框'}
          disabled={locked}
          value={value}
          onChange={(event) => setValue(event.target.value)}
        />
        <button type="submit" aria-label={props.submitLabel ?? '发送'} disabled={locked}>
          {props.submitLabel ?? '发送'}
        </button>
      </form>
    )
  }
}))

import HomePage from '../renderer/src/features/chat/pages/home-page'

const mockConnectionConfig: SshConnectionFormValues = {
  title: 'root@prod',
  port: 22,
  host: '10.0.0.10',
  username: 'root',
  password: 'secret',
  privateKey: 'PRIVATE_KEY',
  privateKeyPassphrase: ''
}

describe('HomePage performance', () => {
  beforeEach(() => {
    window.localStorage.clear()
    useAppStore.setState(createInitialAppStoreState())
    vi.clearAllMocks()
  })

  it('does not rerender the transcript when typing into the chat composer', async () => {
    const instanceId = useAppStore.getState().createOpenClawInstance({
      name: '生产集群',
      description: '线上环境'
    })

    useAppStore.getState().saveConnectionConfig(instanceId, mockConnectionConfig)
    useAppStore.getState().setConnectionState(instanceId, 'connected', {
      lastConnectedAt: '2026-03-21T08:00:00.000Z',
      lastError: null
    })

    const requestGatewayMock = vi.mocked(window.api.requestGateway)
    const pullGatewayEventsMock = vi.mocked(window.api.pullGatewayEvents)

    requestGatewayMock.mockImplementation(async (payload) => {
      if (payload.method === 'chat.history') {
        return {
          success: true,
          message: 'mock history success',
          payload: {
            messages: []
          }
        }
      }

      if (payload.method === 'chat.subscribe') {
        return {
          success: true,
          message: 'mock subscribe success',
          payload: {}
        }
      }

      return {
        success: true,
        message: 'mock request success',
        payload: {}
      }
    })

    pullGatewayEventsMock.mockResolvedValue({
      success: true,
      message: 'mock events success',
      events: []
    })

    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByLabelText('对话输入框')).toBeEnabled()
    })

    conversationOutputRenderSpy.mockClear()

    fireEvent.change(screen.getByLabelText('对话输入框'), {
      target: {
        value: '请保持输入流畅'
      }
    })

    fireEvent.change(screen.getByLabelText('对话输入框'), {
      target: {
        value: '请保持输入流畅，不要重渲染整段对话'
      }
    })

    expect(conversationOutputRenderSpy).not.toHaveBeenCalled()
  })
})
