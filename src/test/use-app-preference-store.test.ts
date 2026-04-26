import { beforeEach, describe, expect, it } from 'vitest'

import { useAppPreferenceStore } from '../renderer/src/features/preferences/store/use-app-preference-store'

describe('useAppPreferenceStore', () => {
  beforeEach(() => {
    window.localStorage.clear()
    useAppPreferenceStore.getState().resetPreferences()
  })

  it('persists home session preference by instance id', () => {
    useAppPreferenceStore.getState().setHomeChatSessionPreference('instance-1', 'agent:main:main')

    expect(
      useAppPreferenceStore.getState().homeChat.selectedSessionKeyByInstanceId['instance-1']
    ).toBe('agent:main:main')
  })

  it('persists model preference by conversation key and supports clearing', () => {
    useAppPreferenceStore
      .getState()
      .setHomeChatModelPreference('instance-1::agent:main:main', 'openai/gpt-5.4')

    expect(
      useAppPreferenceStore.getState().homeChat.selectedModelByConversationKey[
        'instance-1::agent:main:main'
      ]
    ).toBe('openai/gpt-5.4')

    useAppPreferenceStore
      .getState()
      .setHomeChatModelPreference('instance-1::agent:main:main', null)

    expect(
      useAppPreferenceStore.getState().homeChat.selectedModelByConversationKey[
        'instance-1::agent:main:main'
      ]
    ).toBeUndefined()
  })
})
