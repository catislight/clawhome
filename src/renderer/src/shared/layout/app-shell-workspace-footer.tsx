import { Check, ChevronDown, LayoutGrid, Server } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import type { SshConnectionFormValues } from '@/features/instances/model/ssh-connection'
import { OverflowMenu } from '@/shared/ui/overflow-menu'
import OpenClawConnectionDialog from '@/features/instances/components/openclaw-connection-dialog'
import OpenClawRestartGatewayDialog from '@/features/instances/components/openclaw-restart-gateway-dialog'
import { useOpenClawConnectionActions } from '@/features/instances/lib/use-openclaw-connection-actions'
import { useAppI18n } from '@/shared/i18n/app-i18n'
import { cn } from '@/shared/lib/utils'
import { useWorkspaceInstanceSelection } from '@/features/instances/lib/use-workspace-instance-selection'
import { useAppStore, type OpenClawInstance } from '@/features/instances/store/use-app-store'

type AppShellWorkspaceFooterProps = {
  collapsed: boolean
}

function AppShellWorkspaceFooter({
  collapsed
}: AppShellWorkspaceFooterProps): React.JSX.Element {
  const { t } = useAppI18n()
  const navigate = useNavigate()
  const location = useLocation()
  const instances = useAppStore((state) => state.instances)
  const saveConnectionConfig = useAppStore((state) => state.saveConnectionConfig)
  const { selectedInstance, selectedInstanceId, setSelectedInstanceId } =
    useWorkspaceInstanceSelection()
  const [open, setOpen] = useState(false)
  const [connectionDialogTarget, setConnectionDialogTarget] = useState<OpenClawInstance | null>(
    null
  )
  const [restartDialogTarget, setRestartDialogTarget] = useState<OpenClawInstance | null>(null)
  const [isRestartSubmitting, setIsRestartSubmitting] = useState(false)
  const [instanceActionsOpen, setInstanceActionsOpen] = useState(false)
  const [instanceListActionOpenId, setInstanceListActionOpenId] = useState<string | null>(null)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const { connectInstance, disconnectInstance, restartInstance } = useOpenClawConnectionActions()

  const connectedCount = useMemo(
    () => instances.filter((instance) => instance.connectionState === 'connected').length,
    [instances]
  )
  const currentInstanceLabel = selectedInstance?.name ?? t('instances.footer.none')
  const currentInstanceConnected = selectedInstance?.connectionState === 'connected'
  const currentInstanceConnecting = selectedInstance?.connectionState === 'connecting'

  const handleSaveConnection = (
    instanceId: string,
    connectionConfig: SshConnectionFormValues
  ): void => {
    saveConnectionConfig(instanceId, connectionConfig)
    setConnectionDialogTarget(null)
  }

  const handleConnectInstance = async (instance: OpenClawInstance): Promise<void> => {
    if (!instance.connectionConfig) {
      setConnectionDialogTarget(instance)
      return
    }

    await connectInstance(instance)
  }

  const handleDisconnectInstance = async (instance: OpenClawInstance): Promise<void> => {
    await disconnectInstance(instance)
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

  useEffect(() => {
    if (!open) {
      return
    }

    const handlePointerDown = (event: MouseEvent): void => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        setOpen(false)
      }
    }

    const handleWindowBlur = (): void => {
      setOpen(false)
    }

    window.addEventListener('mousedown', handlePointerDown)
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('blur', handleWindowBlur)

    return () => {
      window.removeEventListener('mousedown', handlePointerDown)
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('blur', handleWindowBlur)
    }
  }, [open])

  useEffect(() => {
    setOpen(false)
  }, [location.pathname, location.search])

  useEffect(() => {
    if (!open) {
      setInstanceListActionOpenId(null)
    }
  }, [open])

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

  const handleOpenManagement = (): void => {
    setOpen(false)

    if (location.pathname !== '/config') {
      navigate('/config')
    }
  }

  const popoverContent = open ? (
    <div
      aria-label={t('instances.footer.aria.currentList')}
      className={cn(
        'absolute bottom-0 left-[calc(100%+0.75rem)] z-30 w-56 overflow-hidden rounded-[1rem] border border-black/10 bg-white shadow-[0_20px_48px_-24px_rgba(15,23,42,0.26)]',
        collapsed && 'left-[calc(100%+0.625rem)]'
      )}
      role="listbox"
    >
      {instances.length === 0 ? (
        <div className="p-3">
          <p className="text-sm font-medium text-foreground">{t('instances.footer.empty.title')}</p>
          <p className="mt-1 text-[12px] leading-5 text-muted-foreground">
            {t('instances.footer.empty.description')}
          </p>
          <button
            type="button"
            className="mt-3 inline-flex h-8 items-center gap-1.5 rounded-[0.75rem] px-2.5 text-[12px] font-medium text-primary transition-colors hover:bg-primary/6"
            onClick={handleOpenManagement}
          >
            <LayoutGrid className="size-3.5" />
            {t('instances.page.title')}
          </button>
        </div>
      ) : (
        <div className="p-1.5">
          {instances.map((instance) => {
            const active = instance.id === selectedInstanceId
            const instanceConnected = instance.connectionState === 'connected'
            const instanceConnecting = instance.connectionState === 'connecting'
            const rowActionsOpen = instanceListActionOpenId === instance.id
            const showRowActions = collapsed

            return (
              <div
                key={instance.id}
                className={cn(
                  'group flex h-9 w-full items-center gap-3 rounded-[0.8rem] px-3 text-[13px] font-medium transition-colors',
                  active ? 'bg-slate-100 text-foreground' : 'text-foreground/88 hover:bg-slate-50'
                )}
              >
                <button
                  aria-selected={active}
                  className="flex min-w-0 flex-1 items-center gap-2.5 text-left outline-none"
                  role="option"
                  type="button"
                  onClick={() => {
                    setSelectedInstanceId(instance.id)
                    setOpen(false)
                  }}
                >
                  <span
                    className={cn(
                      'size-[6px] shrink-0 rounded-full',
                      instanceConnected ? 'bg-emerald-500' : 'bg-slate-400'
                    )}
                  />
                  <span className="min-w-0 truncate">{instance.name}</span>
                </button>

                <div className="relative flex h-6 w-7 shrink-0 items-center justify-end">
                  <Check
                    className={cn(
                      'absolute right-0 top-1/2 size-4 -translate-y-1/2 shrink-0 transition-opacity duration-150',
                      active ? 'opacity-100 text-foreground' : 'opacity-0',
                      showRowActions && 'group-hover:opacity-0 group-focus-within:opacity-0',
                      rowActionsOpen && 'opacity-0'
                    )}
                  />

                  {showRowActions ? (
                    <OverflowMenu
                      align="end"
                      side="right"
                      renderInPortal
                      triggerLabel={t('instances.footer.action.moreForInstance', {
                        name: instance.name
                      })}
                      onOpenChange={(isOpen) => {
                        setInstanceListActionOpenId((current) =>
                          isOpen ? instance.id : current === instance.id ? null : current
                        )
                      }}
                      className={cn(
                        'pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 opacity-0 transition-opacity duration-150 group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100',
                        rowActionsOpen && 'pointer-events-auto opacity-100'
                      )}
                      triggerClassName="size-7 rounded-[0.7rem] text-muted-foreground hover:bg-black/[0.05] hover:text-foreground"
                      items={
                        instanceConnected
                          ? [
                              {
                                key: 'disconnect',
                                label: t('instances.instanceCard.menu.disconnect'),
                                onSelect: () => {
                                  void handleDisconnectInstance(instance)
                                }
                              },
                              {
                                key: 'reconnect',
                                label: t('instances.instanceCard.menu.reconnect'),
                                onSelect: () => {
                                  void handleConnectInstance(instance)
                                }
                              },
                              {
                                key: 'restart-gateway',
                                label: t('instances.instanceCard.menu.restartGateway'),
                                onSelect: () => {
                                  setOpen(false)
                                  setRestartDialogTarget(instance)
                                }
                              }
                            ]
                          : [
                              {
                                key: 'connect',
                                label: t('instances.instanceCard.primaryAction.connect'),
                                onSelect: () => {
                                  void handleConnectInstance(instance)
                                },
                                disabled: instanceConnecting
                              },
                              {
                                key: 'configure-connection',
                                label: t('instances.instanceCard.menu.configureConnection'),
                                onSelect: () => {
                                  setConnectionDialogTarget(instance)
                                }
                              }
                            ]
                      }
                    />
                  ) : null}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {collapsed && instances.length > 0 ? (
        <div className="border-t border-black/6 p-1.5">
          <button
            type="button"
            className="flex h-9 w-full items-center gap-2 rounded-[0.8rem] px-3 text-left text-[13px] font-medium text-foreground/88 transition-colors hover:bg-slate-50 hover:text-foreground"
            onClick={handleOpenManagement}
          >
            <LayoutGrid className="size-3.5" />
            {t('instances.page.title')}
          </button>
        </div>
      ) : null}
    </div>
  ) : null

  if (collapsed) {
    return (
      <div ref={rootRef} className="relative flex justify-center overflow-visible">
        <button
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-label={t('instances.footer.aria.openCurrentList')}
          className="relative flex size-10 items-center justify-center rounded-[0.85rem] border border-black/6 bg-white text-primary shadow-[0_10px_18px_-16px_rgba(15,23,42,0.24)] transition-colors hover:border-primary/18 hover:bg-white hover:text-primary"
          type="button"
          onClick={() => setOpen((current) => !current)}
        >
          <Server className="size-4" />
          {selectedInstance ? (
            <span
              className={cn(
                'absolute right-2 bottom-2 size-[6px] rounded-full ring-2 ring-white',
                currentInstanceConnected ? 'bg-emerald-500' : 'bg-slate-400'
              )}
            />
          ) : null}
        </button>

        {popoverContent}

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
      </div>
    )
  }

  return (
    <div ref={rootRef} className="relative overflow-visible border-t border-black/6 pt-4">
      <div className="flex items-center justify-between gap-2 px-2">
        <p className="text-xs font-semibold tracking-[0.08em] text-gray-400">
          {t('instances.footer.currentTitle')}
        </p>
        <button
          aria-label={t('instances.footer.aria.openManage')}
          className="flex size-8 items-center justify-center rounded-[0.7rem] text-muted-foreground transition-colors hover:bg-black/[0.04] hover:text-foreground"
          type="button"
          onClick={handleOpenManagement}
        >
          <LayoutGrid className="size-3.5" />
        </button>
      </div>

      <div className="mt-2">
        <div className="group flex items-center gap-2 rounded-[0.85rem] px-2.5 py-2 transition-colors hover:bg-black/[0.035]">
          <button
            aria-expanded={open}
            aria-haspopup="listbox"
            aria-label={t('instances.footer.aria.switchCurrent')}
            className="flex min-w-0 flex-1 items-center gap-2.5 text-left outline-none"
            type="button"
            onClick={() => setOpen((current) => !current)}
          >
            <span
              className={cn(
                'size-[6px] shrink-0 rounded-full',
                currentInstanceConnected ? 'bg-emerald-500' : 'bg-slate-400'
              )}
            />
            <span className="min-w-0 truncate text-[13px] font-medium text-foreground">
              {currentInstanceLabel}
            </span>
            <ChevronDown
              className={cn(
                'size-3.5 shrink-0 text-muted-foreground transition-transform',
                open && 'rotate-180'
              )}
            />
          </button>

          <div className="relative flex h-6 w-8 shrink-0 items-center justify-end">
            <span
              className={cn(
                'absolute right-0 top-1/2 -translate-y-1/2 text-[11px] font-medium text-muted-foreground transition-opacity duration-150',
                selectedInstance && 'group-hover:opacity-0 group-focus-within:opacity-0',
                instanceActionsOpen && 'opacity-0'
              )}
            >
              {connectedCount}/{instances.length}
            </span>

            {selectedInstance && !open ? (
              <OverflowMenu
                align="end"
                side="right"
                renderInPortal
                onOpenChange={setInstanceActionsOpen}
                triggerLabel={t('instances.footer.action.currentInstance')}
                className={cn(
                  'pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 opacity-0 transition-opacity duration-150 group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100',
                  instanceActionsOpen && 'pointer-events-auto opacity-100'
                )}
                triggerClassName="size-7 rounded-[0.7rem] text-muted-foreground hover:bg-black/[0.05] hover:text-foreground"
                items={
                  currentInstanceConnected
                    ? [
                        {
                          key: 'disconnect',
                          label: t('instances.instanceCard.menu.disconnect'),
                          onSelect: () => {
                            void handleDisconnectInstance(selectedInstance)
                          }
                        },
                        {
                          key: 'reconnect',
                          label: t('instances.instanceCard.menu.reconnect'),
                          onSelect: () => {
                            void handleConnectInstance(selectedInstance)
                          }
                        },
                        {
                          key: 'restart-gateway',
                          label: t('instances.instanceCard.menu.restartGateway'),
                          onSelect: () => {
                            setRestartDialogTarget(selectedInstance)
                          }
                        }
                      ]
                    : [
                        {
                          key: 'connect',
                          label: t('instances.instanceCard.primaryAction.connect'),
                          onSelect: () => {
                            void handleConnectInstance(selectedInstance)
                          },
                          disabled: currentInstanceConnecting
                        },
                        {
                          key: 'configure-connection',
                          label: t('instances.instanceCard.menu.configureConnection'),
                          onSelect: () => {
                            setConnectionDialogTarget(selectedInstance)
                          }
                        }
                      ]
                }
              />
            ) : null}
          </div>
        </div>
      </div>

      {popoverContent}

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
    </div>
  )
}

export default AppShellWorkspaceFooter
