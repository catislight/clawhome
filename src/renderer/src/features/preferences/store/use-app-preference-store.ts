import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

type HomeChatPreferences = {
  selectedSessionKeyByInstanceId: Record<string, string>
  selectedModelByConversationKey: Record<string, string>
}

type AppPreferenceStoreState = {
  homeChat: HomeChatPreferences
}

type AppPreferenceStoreActions = {
  setHomeChatSessionPreference: (instanceId: string, sessionKey: string | null | undefined) => void
  setHomeChatModelPreference: (
    conversationKey: string,
    modelValue: string | null | undefined
  ) => void
  resetPreferences: () => void
}

type AppPreferenceStore = AppPreferenceStoreState & AppPreferenceStoreActions

const APP_PREFERENCE_STORE_KEY = 'clawhome-app-preference-store'

function normalizeKey(value: string): string {
  return value.trim()
}

function normalizeValue(value: string | null | undefined): string | null {
  const normalized = value?.trim()
  return normalized ? normalized : null
}

function filterRecordValues(record: Record<string, unknown>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(record).flatMap(([key, value]) => {
      const normalizedKey = normalizeKey(key)
      const normalizedValue = typeof value === 'string' ? normalizeValue(value) : null

      if (!normalizedKey || !normalizedValue) {
        return []
      }

      return [[normalizedKey, normalizedValue]]
    })
  )
}

function mapPersistedHomeChatPreferences(value: unknown): HomeChatPreferences {
  if (typeof value !== 'object' || value === null) {
    return {
      selectedSessionKeyByInstanceId: {},
      selectedModelByConversationKey: {}
    }
  }

  const payload = value as Record<string, unknown>

  return {
    selectedSessionKeyByInstanceId: filterRecordValues(
      (payload.selectedSessionKeyByInstanceId as Record<string, unknown>) ?? {}
    ),
    selectedModelByConversationKey: filterRecordValues(
      (payload.selectedModelByConversationKey as Record<string, unknown>) ?? {}
    )
  }
}

function createInitialAppPreferenceStoreState(): AppPreferenceStoreState {
  return {
    homeChat: {
      selectedSessionKeyByInstanceId: {},
      selectedModelByConversationKey: {}
    }
  }
}

export const useAppPreferenceStore = create<AppPreferenceStore>()(
  persist(
    (set) => ({
      ...createInitialAppPreferenceStoreState(),
      setHomeChatSessionPreference: (instanceId, sessionKey) => {
        const normalizedInstanceId = normalizeKey(instanceId)
        if (!normalizedInstanceId) {
          return
        }

        const normalizedSessionKey = normalizeValue(sessionKey)

        set((state) => {
          const nextSelectedSessionKeyByInstanceId = {
            ...state.homeChat.selectedSessionKeyByInstanceId
          }

          if (!normalizedSessionKey) {
            delete nextSelectedSessionKeyByInstanceId[normalizedInstanceId]
          } else {
            nextSelectedSessionKeyByInstanceId[normalizedInstanceId] = normalizedSessionKey
          }

          return {
            homeChat: {
              ...state.homeChat,
              selectedSessionKeyByInstanceId: nextSelectedSessionKeyByInstanceId
            }
          }
        })
      },
      setHomeChatModelPreference: (conversationKey, modelValue) => {
        const normalizedConversationKey = normalizeKey(conversationKey)
        if (!normalizedConversationKey) {
          return
        }

        const normalizedModelValue = normalizeValue(modelValue)

        set((state) => {
          const nextSelectedModelByConversationKey = {
            ...state.homeChat.selectedModelByConversationKey
          }

          if (!normalizedModelValue) {
            delete nextSelectedModelByConversationKey[normalizedConversationKey]
          } else {
            nextSelectedModelByConversationKey[normalizedConversationKey] = normalizedModelValue
          }

          return {
            homeChat: {
              ...state.homeChat,
              selectedModelByConversationKey: nextSelectedModelByConversationKey
            }
          }
        })
      },
      resetPreferences: () => {
        set(createInitialAppPreferenceStoreState())
      }
    }),
    {
      name: APP_PREFERENCE_STORE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        homeChat: {
          selectedSessionKeyByInstanceId: filterRecordValues(
            state.homeChat.selectedSessionKeyByInstanceId
          ),
          selectedModelByConversationKey: filterRecordValues(
            state.homeChat.selectedModelByConversationKey
          )
        }
      }),
      merge: (persistedState, currentState) => {
        const merged = {
          ...currentState,
          ...(persistedState as Partial<AppPreferenceStoreState> | undefined)
        }

        return {
          ...merged,
          homeChat: mapPersistedHomeChatPreferences(merged.homeChat)
        }
      }
    }
  )
)
