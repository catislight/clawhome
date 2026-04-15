import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useChatModelSelector } from '../renderer/src/features/chat/lib/use-chat-model-selector'

const requestGatewayMethodMock = vi.fn()
const useOpenClawModelChoicesMock = vi.fn()

vi.mock('../renderer/src/shared/api/gateway-client', () => ({
  requestGatewayMethod: (...args: unknown[]) => requestGatewayMethodMock(...args)
}))

vi.mock('../renderer/src/features/agents/lib/use-openclaw-model-choices', () => ({
  useOpenClawModelChoices: (...args: unknown[]) => useOpenClawModelChoicesMock(...args)
}))

function ChatModelSelectorHarness(props: {
  instanceId: string | null
  sessionKey: string
}): React.JSX.Element {
  const selector = useChatModelSelector({
    instanceId: props.instanceId,
    sessionKey: props.sessionKey,
    enabled: true
  })

  return (
    <div>
      <div data-testid="selected-model">{selector.value}</div>
      <button
        type="button"
        onClick={() => selector.onValueChange('custom-right-codes/MiniMax-M2.7-highspeed')}
      >
        select-cross-provider-model
      </button>
    </div>
  )
}

describe('useChatModelSelector', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useOpenClawModelChoicesMock.mockReturnValue({
      loading: false,
      error: null,
      models: [
        {
          id: 'MiniMax-M2.7-highspeed',
          name: 'MiniMax M2.7 Highspeed',
          provider: 'custom-right-codes'
        }
      ],
      reloadModels: vi.fn()
    })
  })

  it('keeps selected provider/model ref when current session model arrives later', async () => {
    let resolveSessionList: ((payload: unknown) => void) | null = null

    requestGatewayMethodMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSessionList = resolve
        })
    )

    render(<ChatModelSelectorHarness instanceId="instance-1" sessionKey="agent:main:main" />)

    fireEvent.click(screen.getByRole('button', { name: 'select-cross-provider-model' }))

    expect(screen.getByTestId('selected-model')).toHaveTextContent(
      'custom-right-codes/MiniMax-M2.7-highspeed'
    )

    await act(async () => {
      resolveSessionList?.({
        sessions: [
          {
            key: 'agent:main:main',
            modelProvider: 'openai',
            model: 'gpt-4o-mini'
          }
        ]
      })
      await Promise.resolve()
    })

    await waitFor(() => {
      expect(screen.getByTestId('selected-model')).toHaveTextContent(
        'custom-right-codes/MiniMax-M2.7-highspeed'
      )
    })
  })
})
