import { useCallback, useEffect, useMemo, useState } from 'react'

import { useOpenClawModelChoices } from '@/features/agents/lib/use-openclaw-model-choices'
import { isSameGatewaySessionKey } from '@/features/chat/lib/gateway-chat'
import { parseGatewaySessionsList } from '@/features/chat/lib/gateway-sessions'
import { useAppPreferenceStore } from '@/features/preferences/store/use-app-preference-store'
import { requestGatewayMethod } from '@/shared/api/gateway-client'
import { useAppI18n } from '@/shared/i18n/app-i18n'
import type { SelectOption } from '@/shared/ui/select'
import { buildGatewayConversationRuntimeKey } from '@/stores/use-gateway-conversation-store'

type UseChatModelSelectorOptions = {
  instanceId: string | null
  sessionKey: string
  enabled?: boolean
}

type UseChatModelSelectorResult = {
  value: string
  modelOverride: string | null
  options: SelectOption[]
  placeholder: string
  loading: boolean
  error: string | null
  onValueChange: (value: string) => void
}

function toModelRef(provider: string | undefined, modelId: string | undefined): string {
  const normalizedProvider = provider?.trim()
  const normalizedModelId = modelId?.trim()
  if (!normalizedProvider || !normalizedModelId) {
    return ''
  }

  const modelHead = normalizedModelId.split('/')[0]?.trim().toLowerCase()
  if (modelHead && modelHead === normalizedProvider.toLowerCase()) {
    return normalizedModelId
  }

  return `${normalizedProvider}/${normalizedModelId}`
}

export function useChatModelSelector({
  instanceId,
  sessionKey,
  enabled = true
}: UseChatModelSelectorOptions): UseChatModelSelectorResult {
  const { t } = useAppI18n()
  const [value, setValue] = useState('')
  const [currentSessionModel, setCurrentSessionModel] = useState<string | null>(null)
  const selectedModelByConversationKey = useAppPreferenceStore(
    (state) => state.homeChat.selectedModelByConversationKey
  )
  const setHomeChatModelPreference = useAppPreferenceStore(
    (state) => state.setHomeChatModelPreference
  )
  const models = useOpenClawModelChoices({
    instanceId,
    enabled
  })
  const conversationKey = useMemo(() => {
    if (!instanceId) {
      return null
    }

    return buildGatewayConversationRuntimeKey(instanceId, sessionKey)
  }, [instanceId, sessionKey])
  const preferredModelValue = conversationKey
    ? (selectedModelByConversationKey[conversationKey]?.trim() ?? '')
    : ''

  const options = useMemo<SelectOption[]>(() => {
    const listedOptions = models.models.map((model) => ({
      value: toModelRef(model.provider, model.id),
      label: model.name?.trim() || toModelRef(model.provider, model.id)
    }))

    const hasCurrentModelInList =
      currentSessionModel !== null && listedOptions.some((option) => option.value === currentSessionModel)

    if (!currentSessionModel || hasCurrentModelInList) {
      return listedOptions
    }

    return [
      {
        value: currentSessionModel,
        label: currentSessionModel
      },
      ...listedOptions
    ]
  }, [currentSessionModel, models.models])

  useEffect(() => {
    const persistedValue = conversationKey
      ? (useAppPreferenceStore
          .getState()
          .homeChat.selectedModelByConversationKey[conversationKey]
          ?.trim() ?? '')
      : ''
    setValue(persistedValue)
    setCurrentSessionModel(null)
  }, [conversationKey, instanceId, sessionKey])

  useEffect(() => {
    if (!enabled || !instanceId) {
      setCurrentSessionModel(null)
      return
    }

    let cancelled = false

    const loadCurrentSessionModel = async (): Promise<void> => {
      try {
        const payload = await requestGatewayMethod(
          instanceId,
          'sessions.list',
          {
            limit: 200
          },
          {
            timeoutMs: 12_000
          }
        )

        const sessions = parseGatewaySessionsList(payload)
        const currentSession = sessions.find((session) => isSameGatewaySessionKey(session.key, sessionKey))
        const currentModel = toModelRef(currentSession?.modelProvider, currentSession?.model) || null

        if (!cancelled) {
          setCurrentSessionModel(currentModel)
        }
      } catch {
        if (!cancelled) {
          setCurrentSessionModel(null)
        }
      }
    }

    void loadCurrentSessionModel()

    return () => {
      cancelled = true
    }
  }, [enabled, instanceId, sessionKey])

  useEffect(() => {
    const availableModelValues = new Set(options.map((option) => option.value))
    setValue((current) => {
      if (current && availableModelValues.has(current)) {
        return current
      }

      if (preferredModelValue) {
        return preferredModelValue
      }

      const normalizedCurrentSessionModel = currentSessionModel?.trim()
      if (normalizedCurrentSessionModel) {
        return normalizedCurrentSessionModel
      }

      return ''
    })
  }, [currentSessionModel, options, preferredModelValue])

  const handleValueChange = useCallback(
    (nextValue: string): void => {
      setValue(nextValue)

      if (!conversationKey) {
        return
      }

      setHomeChatModelPreference(conversationKey, nextValue)
    },
    [conversationKey, setHomeChatModelPreference]
  )

  return {
    value,
    modelOverride: value.trim() || null,
    options,
    placeholder: models.loading
      ? t('chat.model.placeholderLoading')
      : models.error
        ? t('chat.model.placeholderLoadFailed')
        : t('chat.model.placeholderSelect'),
    loading: models.loading,
    error: models.error,
    onValueChange: handleValueChange
  }
}
