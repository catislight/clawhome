import { useCallback } from 'react'

import { connectGateway, disconnectGateway, restartGateway } from '@/shared/api/app-api'
import { invalidateGatewayCapabilities } from '@/shared/api/gateway-capabilities'
import type { OpenClawInstance } from '@/features/instances/store/use-app-store'
import { useAppStore } from '@/features/instances/store/use-app-store'
import { translateWithAppLanguage } from '@/shared/i18n/app-i18n'

type OpenClawConnectionActionResult = {
  success: boolean
  message: string
}

type ConnectInstanceOptions = {
  optimisticConnecting?: boolean
}

const RESTART_RECONNECT_MAX_ATTEMPTS = 6
const RESTART_RECONNECT_INTERVAL_MS = 1_000

function toConnectionErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback
}

async function waitForReconnectRetry(): Promise<void> {
  await new Promise<void>((resolve) => {
    window.setTimeout(resolve, RESTART_RECONNECT_INTERVAL_MS)
  })
}

export function useOpenClawConnectionActions(): {
  connectInstance: (
    instance: OpenClawInstance,
    options?: ConnectInstanceOptions
  ) => Promise<OpenClawConnectionActionResult>
  disconnectInstance: (instance: OpenClawInstance) => Promise<OpenClawConnectionActionResult>
  restartInstance: (instance: OpenClawInstance) => Promise<OpenClawConnectionActionResult>
} {
  const setConnectionState = useAppStore((state) => state.setConnectionState)

  const connectInstance = useCallback(
    async (
      instance: OpenClawInstance,
      options?: ConnectInstanceOptions
    ): Promise<OpenClawConnectionActionResult> => {
      if (!instance.connectionConfig) {
        const message = translateWithAppLanguage('instances.error.connectionConfigRequired')
        setConnectionState(instance.id, 'error', {
          lastError: message
        })

        return {
          success: false,
          message
        }
      }

      if (options?.optimisticConnecting !== false) {
        setConnectionState(instance.id, 'connecting', {
          lastError: null
        })
      }

      try {
        invalidateGatewayCapabilities(instance.id)
        const response = await connectGateway({
          instanceId: instance.id,
          connection: instance.connectionConfig
        })

        if (response.success) {
          setConnectionState(instance.id, 'connected', {
            lastConnectedAt: new Date().toISOString(),
            lastError: null,
            gatewayRole: response.role ?? null,
            gatewayScopes: Array.isArray(response.scopes) ? response.scopes : [],
            gatewayDeviceId: response.deviceId ?? null,
            gatewayServerVersion: response.serverVersion ?? null
          })

          return {
            success: true,
            message: response.message
          }
        }

        setConnectionState(instance.id, 'error', {
          lastError: response.message
        })

        return {
          success: false,
          message: response.message
        }
      } catch (error) {
        const message = toConnectionErrorMessage(
          error,
          translateWithAppLanguage('instances.error.connectFailed')
        )

        setConnectionState(instance.id, 'error', {
          lastError: message
        })

        return {
          success: false,
          message
        }
      }
    },
    [setConnectionState]
  )

  const disconnectInstance = useCallback(
    async (instance: OpenClawInstance): Promise<OpenClawConnectionActionResult> => {
      try {
        invalidateGatewayCapabilities(instance.id)
        const response = await disconnectGateway({
          instanceId: instance.id
        })

        if (response.success) {
          setConnectionState(instance.id, 'idle', {
            lastError: null
          })

          return {
            success: true,
            message: response.message
          }
        }

        setConnectionState(instance.id, 'error', {
          lastError: response.message
        })

        return {
          success: false,
          message: response.message
        }
      } catch (error) {
        const message = toConnectionErrorMessage(
          error,
          translateWithAppLanguage('instances.error.disconnectFailed')
        )

        setConnectionState(instance.id, 'error', {
          lastError: message
        })

        return {
          success: false,
          message
        }
      }
    },
    [setConnectionState]
  )

  const restartInstance = useCallback(
    async (instance: OpenClawInstance): Promise<OpenClawConnectionActionResult> => {
      const currentInstance =
        useAppStore.getState().instances.find((candidate) => candidate.id === instance.id) ?? instance

      if (!currentInstance.connectionConfig) {
        const message = translateWithAppLanguage('instances.error.connectionConfigRequired')
        setConnectionState(currentInstance.id, 'error', {
          lastError: message
        })

        return {
          success: false,
          message
        }
      }

      setConnectionState(currentInstance.id, 'connecting', {
        lastError: null
      })
      invalidateGatewayCapabilities(currentInstance.id)

      const restartResult = await restartGateway({
        instanceId: currentInstance.id,
        connection: currentInstance.connectionConfig
      })
      if (!restartResult.success) {
        setConnectionState(currentInstance.id, 'error', {
          lastError: restartResult.message
        })

        return {
          success: false,
          message: restartResult.message
        }
      }

      let lastConnectResult: OpenClawConnectionActionResult = {
        success: false,
        message: translateWithAppLanguage('instances.error.restartReconnectFailed')
      }

      for (let attempt = 0; attempt < RESTART_RECONNECT_MAX_ATTEMPTS; attempt += 1) {
        const reconnectTarget =
          useAppStore.getState().instances.find((candidate) => candidate.id === currentInstance.id) ??
          currentInstance
        const connectResult = await connectInstance(reconnectTarget, {
          optimisticConnecting: false
        })
        lastConnectResult = connectResult

        if (connectResult.success) {
          return {
            success: true,
            message: restartResult.message
          }
        }

        if (attempt < RESTART_RECONNECT_MAX_ATTEMPTS - 1) {
          setConnectionState(currentInstance.id, 'connecting', {
            lastError: null
          })
          await waitForReconnectRetry()
        }
      }

      return {
        success: false,
        message: translateWithAppLanguage('instances.error.restartReconnectFailedWithReason', {
          message: lastConnectResult.message
        })
      }
    },
    [connectInstance, setConnectionState]
  )

  return {
    connectInstance,
    disconnectInstance,
    restartInstance
  }
}
