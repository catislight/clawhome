import { Plus } from 'lucide-react'
import { useEffect, useState } from 'react'

import type { OpenClawCreateSetupPayload } from '@/features/instances/components/openclaw-create-dialog'
import type { SshConnectionFormValues } from '@/features/instances/model/ssh-connection'
import OpenClawConnectionDialog from '@/features/instances/components/openclaw-connection-dialog'
import OpenClawCreateDialog from '@/features/instances/components/openclaw-create-dialog'
import OpenClawFirstInstanceSetupPanel, {
  type OpenClawFirstInstanceSetupPayload
} from '@/features/instances/components/openclaw-first-instance-setup-panel'
import OpenClawRestartGatewayDialog from '@/features/instances/components/openclaw-restart-gateway-dialog'
import { isLocalOpenClawConnection } from '@/features/instances/lib/openclaw-connection-config'
import OpenClawInstanceCard from '@/features/instances/components/openclaw-instance-card'
import { Button } from '@/shared/ui/button'
import AppShellContentArea from '@/shared/layout/app-shell-content-area'
import { useOpenClawConnectionActions } from '@/features/instances/lib/use-openclaw-connection-actions'
import { useAppStore, type OpenClawInstance } from '@/features/instances/store/use-app-store'
import { useAppI18n } from '@/shared/i18n/app-i18n'

function ConfigPage(): React.JSX.Element {
  const { t } = useAppI18n()
  const instances = useAppStore((state) => state.instances)
  const createOpenClawInstance = useAppStore((state) => state.createOpenClawInstance)
  const deleteOpenClawInstance = useAppStore((state) => state.deleteOpenClawInstance)
  const saveConnectionConfig = useAppStore((state) => state.saveConnectionConfig)
  const { connectInstance, disconnectInstance, restartInstance } = useOpenClawConnectionActions()

  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [isFirstSetupSubmitting, setIsFirstSetupSubmitting] = useState(false)
  const [connectionDialogTarget, setConnectionDialogTarget] = useState<OpenClawInstance | null>(
    null
  )
  const [restartDialogTarget, setRestartDialogTarget] = useState<OpenClawInstance | null>(null)
  const [isRestartSubmitting, setIsRestartSubmitting] = useState(false)
  const hasLocalInstance = instances.some((instance) =>
    isLocalOpenClawConnection(instance.connectionConfig)
  )

  const handleSaveConnection = (
    instanceId: string,
    connectionConfig: SshConnectionFormValues
  ): void => {
    saveConnectionConfig(instanceId, connectionConfig)
    setConnectionDialogTarget(null)
  }

  const handleConnect = async (instance: OpenClawInstance): Promise<void> => {
    if (!instance.connectionConfig) {
      setConnectionDialogTarget(instance)
      return
    }

    await connectInstance(instance)
  }

  const handleDisconnect = async (instance: OpenClawInstance): Promise<void> => {
    await disconnectInstance(instance)
  }

  const handleDelete = async (instance: OpenClawInstance): Promise<void> => {
    const confirmed = window.confirm(t('instances.page.confirmDelete', { name: instance.name }))

    if (!confirmed) {
      return
    }

    if (instance.connectionState === 'connected') {
      await disconnectInstance(instance)
    }

    deleteOpenClawInstance(instance.id)
  }

  const handleConfirmRestart = async (instance: OpenClawInstance): Promise<void> => {
    setIsRestartSubmitting(true)

    try {
      await restartInstance(instance)
      setRestartDialogTarget(null)
    } finally {
      setIsRestartSubmitting(false)
    }
  }

  const submitInstanceSetup = async (
    payload: OpenClawFirstInstanceSetupPayload | OpenClawCreateSetupPayload
  ): Promise<{ success: boolean; message: string }> => {
    const hasExistingLocalInstance = useAppStore
      .getState()
      .instances.some((instance) => isLocalOpenClawConnection(instance.connectionConfig))
    if (payload.connectionConfig.connectionType === 'local' && hasExistingLocalInstance) {
      return {
        success: false,
        message: t('instances.page.error.singleLocalOnly')
      }
    }

    const createdInstanceId = createOpenClawInstance({
      name: payload.name,
      description: payload.description
    })
    saveConnectionConfig(createdInstanceId, payload.connectionConfig)

    const createdInstance = useAppStore
      .getState()
      .instances.find((instance) => instance.id === createdInstanceId)

    if (!createdInstance) {
      deleteOpenClawInstance(createdInstanceId)
      return {
        success: false,
        message: t('instances.page.error.createFailed')
      }
    }

    const connectionResult = await connectInstance(createdInstance)
    if (!connectionResult.success) {
      deleteOpenClawInstance(createdInstanceId)
      return {
        success: false,
        message: t('instances.page.error.connectAfterCreateFailed', {
          message: connectionResult.message
        })
      }
    }

    return {
      success: true,
      message: connectionResult.message
    }
  }

  const handleFirstInstanceSetup = async (
    payload: OpenClawFirstInstanceSetupPayload
  ): Promise<{ success: boolean; message: string }> => {
    setIsFirstSetupSubmitting(true)

    try {
      return await submitInstanceSetup(payload)
    } finally {
      setIsFirstSetupSubmitting(false)
    }
  }

  const handleCreateInstanceSetup = async (
    payload: OpenClawCreateSetupPayload
  ): Promise<{ success: boolean; message: string }> => {
    const result = await submitInstanceSetup(payload)
    if (result.success) {
      setCreateDialogOpen(false)
    }
    return result
  }

  useEffect(() => {
    if (
      connectionDialogTarget &&
      !instances.some((instance) => instance.id === connectionDialogTarget.id)
    ) {
      setConnectionDialogTarget(null)
    }
  }, [connectionDialogTarget, instances])

  useEffect(() => {
    if (restartDialogTarget && !instances.some((instance) => instance.id === restartDialogTarget.id)) {
      setRestartDialogTarget(null)
    }
  }, [instances, restartDialogTarget])

  return (
    <AppShellContentArea
      showHeaderWithoutConnectedInstance={instances.length > 0 && !isFirstSetupSubmitting}
      header={
        <div className="flex w-full min-w-0 items-center justify-between">
          <h1 className="truncate text-sm font-semibold tracking-tight text-foreground">
            {t('instances.page.title')}
          </h1>
          {instances.length > 0 && !isFirstSetupSubmitting ? (
            <Button
              type="button"
              size="icon"
              aria-label={t('instances.page.action.create')}
              title={t('instances.page.action.create')}
              className="size-8 rounded-[0.7rem]"
              onClick={() => setCreateDialogOpen(true)}
            >
              <Plus className="size-3.5" />
            </Button>
          ) : null}
        </div>
      }
    >
      {instances.length === 0 || isFirstSetupSubmitting ? (
        <OpenClawFirstInstanceSetupPanel onSubmitSetup={handleFirstInstanceSetup} />
      ) : (
        <>
          <section>
            <div className="grid grid-cols-3 gap-4 max-[1400px]:grid-cols-2 max-[1000px]:grid-cols-1">
              {instances.map((instance) => (
                <OpenClawInstanceCard
                  key={instance.id}
                  instance={instance}
                  onConfigureConnection={setConnectionDialogTarget}
                  onConnect={(currentInstance) => {
                    void handleConnect(currentInstance)
                  }}
                  onDisconnect={(currentInstance) => {
                    void handleDisconnect(currentInstance)
                  }}
                  onRestart={(currentInstance) => {
                    setRestartDialogTarget(currentInstance)
                  }}
                  onDeleteInstance={(currentInstance) => {
                    void handleDelete(currentInstance)
                  }}
                />
              ))}
            </div>
          </section>
        </>
      )}

      <OpenClawCreateDialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        hasLocalInstance={hasLocalInstance}
        onSubmitSetup={handleCreateInstanceSetup}
      />

      <OpenClawConnectionDialog
        instance={connectionDialogTarget}
        open={connectionDialogTarget !== null}
        onClose={() => setConnectionDialogTarget(null)}
        onSave={handleSaveConnection}
      />

      <OpenClawRestartGatewayDialog
        targetInstance={restartDialogTarget}
        submitting={isRestartSubmitting}
        onClose={() => {
          if (isRestartSubmitting) {
            return
          }

          setRestartDialogTarget(null)
        }}
        onConfirm={(instance) => {
          void handleConfirmRestart(instance)
        }}
      />
    </AppShellContentArea>
  )
}

export default ConfigPage
