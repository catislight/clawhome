import { useCallback, useEffect, useRef, useState } from 'react'

import { listOpenClawToolsCatalog } from '@/features/agents/lib/openclaw-agents-api'
import type { OpenClawToolsCatalogResult } from '@/features/agents/lib/openclaw-agents-types'
import { translateWithAppLanguage } from '@/shared/i18n/app-i18n'

type UseOpenClawToolsCatalogOptions = {
  instanceId: string | null
  agentId: string | null
  enabled?: boolean
  includePlugins?: boolean
}

type UseOpenClawToolsCatalogResult = {
  loading: boolean
  error: string | null
  catalog: OpenClawToolsCatalogResult | null
  reloadCatalog: () => Promise<void>
}

export function useOpenClawToolsCatalog({
  instanceId,
  agentId,
  enabled = true,
  includePlugins = true
}: UseOpenClawToolsCatalogOptions): UseOpenClawToolsCatalogResult {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [catalog, setCatalog] = useState<OpenClawToolsCatalogResult | null>(null)
  const requestIdRef = useRef(0)

  const loadCatalog = useCallback(async (): Promise<void> => {
    if (!enabled || !instanceId || !agentId) {
      return
    }

    const requestId = requestIdRef.current + 1
    requestIdRef.current = requestId
    setLoading(true)
    setError(null)

    try {
      const nextCatalog = await listOpenClawToolsCatalog(instanceId, {
        agentId,
        includePlugins
      })
      if (requestId !== requestIdRef.current) {
        return
      }
      setCatalog(nextCatalog)
    } catch (loadError) {
      if (requestId === requestIdRef.current) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : translateWithAppLanguage('agents.error.loadToolsFailed')
        )
      }
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false)
      }
    }
  }, [agentId, enabled, includePlugins, instanceId])

  useEffect(() => {
    if (!enabled || !instanceId || !agentId) {
      requestIdRef.current += 1
      setLoading(false)
      setError(null)
      setCatalog(null)
      return
    }

    void loadCatalog()
  }, [agentId, enabled, instanceId, loadCatalog])

  return {
    loading,
    error,
    catalog,
    reloadCatalog: loadCatalog
  }
}
