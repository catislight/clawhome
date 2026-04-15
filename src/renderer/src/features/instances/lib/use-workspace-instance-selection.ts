import { useEffect, useMemo } from 'react'

import { useAppStore, type OpenClawInstance } from '@/features/instances/store/use-app-store'

export function resolveWorkspaceInstance(
  instances: OpenClawInstance[],
  workspaceInstanceId: string | null
): OpenClawInstance | null {
  if (workspaceInstanceId) {
    const matchedInstance = instances.find((instance) => instance.id === workspaceInstanceId)

    if (matchedInstance) {
      return matchedInstance
    }
  }

  return (
    instances.find((instance) => instance.connectionState === 'connected') ??
    instances.find((instance) => instance.connectionConfig !== null) ??
    instances[0] ??
    null
  )
}

export function useWorkspaceInstanceSelection(): {
  selectedInstance: OpenClawInstance | null
  selectedInstanceId: string
  setSelectedInstanceId: (instanceId: string | null) => void
} {
  const instances = useAppStore((state) => state.instances)
  const workspaceInstanceId = useAppStore((state) => state.workspaceInstanceId)
  const setWorkspaceInstanceId = useAppStore((state) => state.setWorkspaceInstanceId)

  const selectedInstance = useMemo(
    () => resolveWorkspaceInstance(instances, workspaceInstanceId),
    [instances, workspaceInstanceId]
  )

  useEffect(() => {
    const resolvedInstanceId = selectedInstance?.id ?? null

    if (resolvedInstanceId === workspaceInstanceId) {
      return
    }

    setWorkspaceInstanceId(resolvedInstanceId)
  }, [selectedInstance, setWorkspaceInstanceId, workspaceInstanceId])

  return {
    selectedInstance,
    selectedInstanceId: selectedInstance?.id ?? '',
    setSelectedInstanceId: setWorkspaceInstanceId
  }
}
