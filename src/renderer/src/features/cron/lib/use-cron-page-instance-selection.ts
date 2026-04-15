import { useEffect, useMemo, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'

import { resolveWorkspaceInstance } from '@/features/instances/lib/use-workspace-instance-selection'
import { useAppStore, type OpenClawInstance } from '@/features/instances/store/use-app-store'

export function useCronPageInstanceSelection(instances: OpenClawInstance[]): {
  selectedInstance: OpenClawInstance | null
  selectedInstanceId: string
  setSelectedInstanceId: (instanceId: string) => void
} {
  const [searchParams, setSearchParams] = useSearchParams()
  const workspaceInstanceId = useAppStore((state) => state.workspaceInstanceId)
  const setWorkspaceInstanceId = useAppStore((state) => state.setWorkspaceInstanceId)
  const searchInstanceId = searchParams.get('instanceId')
  const previousSearchInstanceIdRef = useRef<string | null | undefined>(undefined)
  const selectedInstance = useMemo(
    () => resolveWorkspaceInstance(instances, workspaceInstanceId),
    [instances, workspaceInstanceId]
  )

  useEffect(() => {
    const previousSearchInstanceId = previousSearchInstanceIdRef.current
    const searchInstanceChanged = previousSearchInstanceId !== searchInstanceId
    previousSearchInstanceIdRef.current = searchInstanceId

    if (!searchInstanceId || searchInstanceId === workspaceInstanceId) {
      return
    }

    if (!instances.some((instance) => instance.id === searchInstanceId)) {
      return
    }

    const workspaceInstanceMissing =
      !workspaceInstanceId || !instances.some((instance) => instance.id === workspaceInstanceId)
    const shouldApplySearchSelection = searchInstanceChanged || workspaceInstanceMissing

    if (!shouldApplySearchSelection) {
      return
    }

    setWorkspaceInstanceId(searchInstanceId)
  }, [instances, searchInstanceId, setWorkspaceInstanceId, workspaceInstanceId])

  useEffect(() => {
    if (!selectedInstance) {
      return
    }

    if (searchInstanceId === selectedInstance.id) {
      return
    }

    const nextParams = new URLSearchParams(searchParams)
    nextParams.set('instanceId', selectedInstance.id)
    setSearchParams(nextParams, { replace: true })
  }, [searchInstanceId, searchParams, selectedInstance, setSearchParams])

  return {
    selectedInstance,
    selectedInstanceId: selectedInstance?.id ?? '',
    setSelectedInstanceId: (instanceId: string) => {
      setWorkspaceInstanceId(instanceId)
    }
  }
}
