import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import {
  createOpenClawAgent,
  listOpenClawAgents
} from '@/features/agents/lib/openclaw-agents-api'
import type {
  OpenClawAgentCreatePayload,
  OpenClawAgentSummary,
  OpenClawAgentsListResult
} from '@/features/agents/lib/openclaw-agents-types'
import { translateWithAppLanguage } from '@/shared/i18n/app-i18n'

type UseOpenClawAgentsOptions = {
  instanceId: string | null
  enabled?: boolean
}

type UseOpenClawAgentsResult = {
  loading: boolean
  creating: boolean
  error: string | null
  agentsList: OpenClawAgentsListResult | null
  selectedAgentId: string | null
  selectedAgent: OpenClawAgentSummary | null
  mainSessionKey: string
  setSelectedAgentId: (agentId: string) => void
  reloadAgents: () => Promise<void>
  createAgent: (params: OpenClawAgentCreatePayload) => Promise<string>
}

function resolvePreferredAgentId(list: OpenClawAgentsListResult, currentAgentId: string | null): string | null {
  const hasCurrent = currentAgentId
    ? list.agents.some((agent) => agent.id === currentAgentId)
    : false

  if (hasCurrent) {
    return currentAgentId
  }

  if (list.defaultId) {
    const hasDefault = list.agents.some((agent) => agent.id === list.defaultId)
    if (hasDefault) {
      return list.defaultId
    }
  }

  return list.agents[0]?.id ?? null
}

export function useOpenClawAgents({
  instanceId,
  enabled = true
}: UseOpenClawAgentsOptions): UseOpenClawAgentsResult {
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [agentsList, setAgentsList] = useState<OpenClawAgentsListResult | null>(null)
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null)
  const requestIdRef = useRef(0)

  const selectedAgent = useMemo(() => {
    if (!agentsList || !selectedAgentId) {
      return null
    }

    return agentsList.agents.find((agent) => agent.id === selectedAgentId) ?? null
  }, [agentsList, selectedAgentId])

  const loadAgents = useCallback(async (): Promise<void> => {
    if (!enabled || !instanceId) {
      return
    }

    const requestId = requestIdRef.current + 1
    requestIdRef.current = requestId
    setLoading(true)
    setError(null)

    try {
      const list = await listOpenClawAgents(instanceId)

      if (requestId !== requestIdRef.current) {
        return
      }

      setAgentsList(list)
      setSelectedAgentId((currentAgentId) => resolvePreferredAgentId(list, currentAgentId))
    } catch (loadError) {
      if (requestId === requestIdRef.current) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : translateWithAppLanguage('agents.error.loadAgentsFailed')
        )
      }
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false)
      }
    }
  }, [enabled, instanceId])

  useEffect(() => {
    if (!enabled || !instanceId) {
      requestIdRef.current += 1
      setLoading(false)
      setCreating(false)
      setError(null)
      setAgentsList(null)
      setSelectedAgentId(null)
      return
    }

    void loadAgents()
  }, [enabled, instanceId, loadAgents])

  const createAgentAndReload = useCallback(
    async (params: OpenClawAgentCreatePayload): Promise<string> => {
      if (!enabled || !instanceId) {
        throw new Error(translateWithAppLanguage('agents.error.createUnavailable'))
      }

      setCreating(true)
      setError(null)
      try {
        const result = await createOpenClawAgent(instanceId, params)
        await loadAgents()
        setSelectedAgentId(result.agentId)
        return result.agentId
      } catch (createError) {
        const message = createError instanceof Error
          ? createError.message
          : translateWithAppLanguage('agents.error.createFailed')
        setError(message)
        throw new Error(message)
      } finally {
        setCreating(false)
      }
    },
    [enabled, instanceId, loadAgents]
  )

  const selectAgentId = useCallback((agentId: string) => {
    setSelectedAgentId(agentId)
  }, [])

  return {
    loading,
    creating,
    error,
    agentsList,
    selectedAgentId,
    selectedAgent,
    mainSessionKey: agentsList?.mainKey ?? 'main',
    setSelectedAgentId: selectAgentId,
    reloadAgents: loadAgents,
    createAgent: createAgentAndReload
  }
}
