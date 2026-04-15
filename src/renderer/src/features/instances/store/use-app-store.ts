import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

import type { SshConnectionFormValues } from '@/features/instances/model/ssh-connection'
import {
  createDefaultPreferences,
  normalizeAppLanguage,
  normalizeSendKey,
  type AppLanguage,
  type AppPreferences
} from '@/features/preferences/lib/app-preferences'

export type OpenClawConnectionState = 'idle' | 'connecting' | 'connected' | 'disconnected' | 'error'

export type OpenClawInstance = {
  id: string
  name: string
  description: string
  createdAt: string
  updatedAt: string
  connectionConfig: SshConnectionFormValues | null
  connectionState: OpenClawConnectionState
  lastConnectedAt: string | null
  lastError: string | null
  gatewayRole: string | null
  gatewayScopes: string[]
  gatewayDeviceId: string | null
  gatewayServerVersion: string | null
}

type CreateOpenClawPayload = {
  name: string
  description: string
}

type SetConnectionStateOptions = {
  lastConnectedAt?: string | null
  lastError?: string | null
  gatewayRole?: string | null
  gatewayScopes?: string[]
  gatewayDeviceId?: string | null
  gatewayServerVersion?: string | null
}

type AppStoreState = {
  instances: OpenClawInstance[]
  workspaceInstanceId: string | null
  preferences: AppPreferences
}

type AppStoreActions = {
  createOpenClawInstance: (payload: CreateOpenClawPayload) => string
  deleteOpenClawInstance: (instanceId: string) => void
  saveConnectionConfig: (instanceId: string, connectionConfig: SshConnectionFormValues) => void
  setConnectionState: (
    instanceId: string,
    connectionState: OpenClawConnectionState,
    options?: SetConnectionStateOptions
  ) => void
  setWorkspaceInstanceId: (instanceId: string | null) => void
  setPreferencesLanguage: (language: AppLanguage) => void
  setPreferencesSendKey: (sendKey: string) => void
  resetStore: () => void
}

type AppStore = AppStoreState & AppStoreActions

const APP_STORE_PERSIST_KEY = 'openclaw-app-store'

export function createInitialAppStoreState(): AppStoreState {
  return {
    instances: [],
    workspaceInstanceId: null,
    preferences: createDefaultPreferences()
  }
}

function createOpenClawId(): string {
  return `openclaw-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function mapPersistedInstances(instances: OpenClawInstance[]): OpenClawInstance[] {
  return instances.map((instance) => ({
    ...instance,
    connectionState: 'idle',
    lastError: null,
    gatewayRole: typeof instance.gatewayRole === 'string' ? instance.gatewayRole : null,
    gatewayScopes: Array.isArray(instance.gatewayScopes)
      ? instance.gatewayScopes.filter((scope): scope is string => typeof scope === 'string')
      : [],
    gatewayDeviceId: typeof instance.gatewayDeviceId === 'string' ? instance.gatewayDeviceId : null,
    gatewayServerVersion:
      typeof instance.gatewayServerVersion === 'string' ? instance.gatewayServerVersion : null
  }))
}

function mapPersistedPreferences(preferences: Partial<AppPreferences> | undefined): AppPreferences {
  const fallback = createDefaultPreferences()

  return {
    language: normalizeAppLanguage(preferences?.language),
    sendKey: normalizeSendKey(preferences?.sendKey ?? fallback.sendKey)
  }
}

export const useAppStore = create<AppStore>()(
  persist(
    (set) => ({
      ...createInitialAppStoreState(),
      createOpenClawInstance: ({ name, description }) => {
        const createdAt = new Date().toISOString()
        const instanceId = createOpenClawId()

        set((state) => ({
          instances: [
            {
              id: instanceId,
              name,
              description,
              createdAt,
              updatedAt: createdAt,
              connectionConfig: null,
              connectionState: 'idle',
              lastConnectedAt: null,
              lastError: null,
              gatewayRole: null,
              gatewayScopes: [],
              gatewayDeviceId: null,
              gatewayServerVersion: null
            },
            ...state.instances
          ]
        }))

        return instanceId
      },
      deleteOpenClawInstance: (instanceId) => {
        set((state) => ({
          instances: state.instances.filter((instance) => instance.id !== instanceId),
          workspaceInstanceId:
            state.workspaceInstanceId === instanceId ? null : state.workspaceInstanceId
        }))
      },
      saveConnectionConfig: (instanceId, connectionConfig) => {
        set((state) => ({
          instances: state.instances.map((instance) =>
            instance.id === instanceId
              ? {
                  ...instance,
                  connectionConfig,
                  updatedAt: new Date().toISOString(),
                  connectionState: 'idle',
                  lastError: null,
                  gatewayRole: null,
                  gatewayScopes: [],
                  gatewayDeviceId: null,
                  gatewayServerVersion: null
                }
              : instance
          )
        }))
      },
      setConnectionState: (instanceId, connectionState, options) => {
        set((state) => ({
          instances: state.instances.map((instance) =>
            instance.id === instanceId
              ? {
                  ...instance,
                  connectionState,
                  updatedAt: new Date().toISOString(),
                  lastConnectedAt:
                    options && Object.prototype.hasOwnProperty.call(options, 'lastConnectedAt')
                      ? (options.lastConnectedAt ?? null)
                      : instance.lastConnectedAt,
                  lastError:
                    options && Object.prototype.hasOwnProperty.call(options, 'lastError')
                      ? (options.lastError ?? null)
                      : instance.lastError,
                  gatewayRole:
                    options && Object.prototype.hasOwnProperty.call(options, 'gatewayRole')
                      ? (options.gatewayRole ?? null)
                      : instance.gatewayRole,
                  gatewayScopes:
                    options && Object.prototype.hasOwnProperty.call(options, 'gatewayScopes')
                      ? (options.gatewayScopes ?? [])
                      : instance.gatewayScopes,
                  gatewayDeviceId:
                    options && Object.prototype.hasOwnProperty.call(options, 'gatewayDeviceId')
                      ? (options.gatewayDeviceId ?? null)
                      : instance.gatewayDeviceId,
                  gatewayServerVersion:
                    options && Object.prototype.hasOwnProperty.call(options, 'gatewayServerVersion')
                      ? (options.gatewayServerVersion ?? null)
                      : instance.gatewayServerVersion
                }
              : instance
          )
        }))
      },
      setWorkspaceInstanceId: (instanceId) => {
        set(() => ({
          workspaceInstanceId: instanceId
        }))
      },
      setPreferencesLanguage: (language) => {
        set((state) => ({
          preferences: {
            ...state.preferences,
            language: normalizeAppLanguage(language)
          }
        }))
      },
      setPreferencesSendKey: (sendKey) => {
        set((state) => ({
          preferences: {
            ...state.preferences,
            sendKey: normalizeSendKey(sendKey)
          }
        }))
      },
      resetStore: () => {
        set(createInitialAppStoreState())
      }
    }),
    {
      name: APP_STORE_PERSIST_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        instances: mapPersistedInstances(state.instances),
        workspaceInstanceId: state.workspaceInstanceId,
        preferences: mapPersistedPreferences(state.preferences)
      })
    }
  )
)
