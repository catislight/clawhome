import { useCallback, useEffect, useState } from 'react'

import { listOpenClawModelChoices } from '@/features/agents/lib/openclaw-agents-api'
import type { OpenClawModelChoice } from '@/features/agents/lib/openclaw-agents-types'
import { translateWithAppLanguage } from '@/shared/i18n/app-i18n'

type UseOpenClawModelChoicesOptions = {
  instanceId: string | null
  enabled?: boolean
}

type UseOpenClawModelChoicesResult = {
  loading: boolean
  error: string | null
  models: OpenClawModelChoice[]
  reloadModels: () => Promise<void>
}

export function useOpenClawModelChoices({
  instanceId,
  enabled = true
}: UseOpenClawModelChoicesOptions): UseOpenClawModelChoicesResult {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [models, setModels] = useState<OpenClawModelChoice[]>([])

  const loadModels = useCallback(async (): Promise<void> => {
    if (!enabled || !instanceId) {
      return
    }

    setLoading(true)
    setError(null)
    try {
      const nextModels = await listOpenClawModelChoices(instanceId)
      setModels(nextModels)
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : translateWithAppLanguage('agents.error.loadModelsFailed')
      )
    } finally {
      setLoading(false)
    }
  }, [enabled, instanceId])

  useEffect(() => {
    if (!enabled || !instanceId) {
      setLoading(false)
      setError(null)
      setModels([])
      return
    }

    void loadModels()
  }, [enabled, instanceId, loadModels])

  return {
    loading,
    error,
    models,
    reloadModels: loadModels
  }
}
