import { useEffect, useMemo } from 'react'

import { getGatewayConnectionStatus, hasAppApiMethod } from '@/shared/api/app-api'
import {
  OPENCLAW_CONNECTION_POLL_INTERVAL_MS,
  getOpenClawUnexpectedDisconnectMessage
} from '@/features/instances/lib/openclaw-connection-state'
import { useAppStore } from '@/features/instances/store/use-app-store'

export function useOpenClawConnectionPolling(): void {
  const instances = useAppStore((state) => state.instances)
  const connectedInstanceIds = useMemo(
    () =>
      instances
        .filter((instance) => instance.connectionState === 'connected')
        .map((instance) => instance.id),
    [instances]
  )
  const setConnectionState = useAppStore((state) => state.setConnectionState)

  useEffect(() => {
    if (!hasAppApiMethod('getGatewayConnectionStatus') || connectedInstanceIds.length === 0) {
      return
    }

    let cancelled = false
    let polling = false

    const pollConnectionStatus = async (): Promise<void> => {
      if (cancelled || polling) {
        return
      }

      polling = true

      try {
        const results = await Promise.all(
          connectedInstanceIds.map(async (instanceId) => ({
            instanceId,
            result: await getGatewayConnectionStatus({
              instanceId
            })
          }))
        )

        if (cancelled) {
          return
        }

        for (const { instanceId, result } of results) {
          if (!result.success || result.connected) {
            continue
          }

          const currentInstance = useAppStore
            .getState()
            .instances.find((instance) => instance.id === instanceId)

          if (currentInstance?.connectionState !== 'connected') {
            continue
          }

          setConnectionState(instanceId, 'disconnected', {
            lastError: result.message || getOpenClawUnexpectedDisconnectMessage()
          })
        }
      } finally {
        polling = false
      }
    }

    void pollConnectionStatus()

    const timer = window.setInterval(() => {
      void pollConnectionStatus()
    }, OPENCLAW_CONNECTION_POLL_INTERVAL_MS)

    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [connectedInstanceIds, setConnectionState])
}
