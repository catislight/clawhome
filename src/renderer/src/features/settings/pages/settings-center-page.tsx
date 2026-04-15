import { Loader2, Save } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import OpenClawInstanceGlobalConfigSidebar from '@/features/settings/components/openclaw-instance-global-config-sidebar'
import OpenClawInstanceGlobalDynamicFormPanel from '@/features/settings/components/openclaw-instance-global-dynamic-form-panel'
import { useSettingsCenterController } from '@/features/settings/lib/use-settings-center-controller'
import OpenClawConnectionStatePanel from '@/features/instances/components/openclaw-connection-state-panel'
import OpenClawNoInstanceState from '@/features/instances/components/openclaw-no-instance-state'
import { useOpenClawConnectionActions } from '@/features/instances/lib/use-openclaw-connection-actions'
import { useAppI18n } from '@/shared/i18n/app-i18n'
import AppShellContentArea from '@/shared/layout/app-shell-content-area'
import AppShellSplitWorkspace from '@/shared/layout/app-shell-split-workspace'
import { Button } from '@/shared/ui/button'
import { Textarea } from '@/shared/ui/textarea'

function SettingsCenterPage(): React.JSX.Element {
  const { t } = useAppI18n()
  const navigate = useNavigate()
  const { connectInstance } = useOpenClawConnectionActions()
  const controller = useSettingsCenterController()
  const saveButtonBusy = controller.configSaving || controller.jsonSaving
  const saveButtonLabel = controller.jsonMode
    ? saveButtonBusy
      ? t('settings.saveJson.busy')
      : t('settings.saveJson.idle')
    : saveButtonBusy
      ? t('settings.save.busy')
      : t('settings.save.idle')

  return (
    <AppShellContentArea
      disableInnerPadding
      contentScrollable={false}
      innerClassName="h-full min-h-0 gap-0"
    >
      {controller.instances.length === 0 ? (
        <OpenClawNoInstanceState
          message={t('settings.page.noInstance')}
          onOpenConfig={() => navigate('/config')}
        />
      ) : !controller.selectedInstance ? null : controller.selectedInstanceRequiresConnectionConfig ||
        !controller.selectedInstanceConnected ? (
        <OpenClawConnectionStatePanel
          instance={controller.selectedInstance}
          reconnectPending={controller.reconnectingInstanceId === controller.selectedInstance.id}
          descriptionOverride={t('settings.page.needConnectionDescription')}
          onReconnect={(instance) => {
            controller.setReconnectingInstanceId(instance.id)
            void connectInstance(instance, {
              optimisticConnecting: false
            }).finally(() => {
              controller.setReconnectingInstanceId(null)
            })
          }}
          onOpenConfig={() => navigate('/config')}
        />
      ) : (
        <AppShellSplitWorkspace
          sidebar={
            <OpenClawInstanceGlobalConfigSidebar
              categories={controller.categories}
              activeCategoryId={controller.activeCategory.id}
              onCategoryChange={(categoryId) => {
                controller.changeCategory(categoryId)
              }}
              onOpenJsonConfig={controller.openJsonEditor}
              jsonConfigDisabled={
                controller.configLoading || controller.configSaving || controller.jsonSaving
              }
            />
          }
          contentHeader={
            <div className="flex w-full min-w-0 items-center">
              <h2 className="truncate text-sm font-semibold tracking-tight text-foreground">
                {controller.jsonMode ? t('settings.sidebar.jsonConfig') : controller.activeCategory.label}
              </h2>
            </div>
          }
          contentBodyClassName={
            controller.jsonMode
              ? 'min-h-0 flex-1 overflow-hidden'
              : 'min-h-0 flex-1 overflow-y-auto'
          }
          contentFooter={
            <div className="flex h-full items-center justify-start">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8 rounded-[0.65rem] text-primary hover:bg-primary/8 hover:text-primary"
                aria-label={saveButtonLabel}
                title={saveButtonLabel}
                disabled={
                  controller.configLoading || controller.configSaving || controller.jsonSaving
                }
                onClick={() => {
                  if (controller.jsonMode) {
                    void controller.saveJson()
                    return
                  }

                  void controller.saveConfig()
                }}
              >
                {saveButtonBusy ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Save className="size-3.5" />
                )}
              </Button>
            </div>
          }
        >
          <section
            className={
              controller.jsonMode ? 'flex h-full min-h-0 flex-col px-4 py-3' : 'min-h-0 px-4 py-3'
            }
          >
            <div
              className={controller.jsonMode ? 'flex min-h-0 flex-1 flex-col gap-3' : 'space-y-3'}
            >
              {controller.configError ? (
                <p className="whitespace-pre-line rounded-[0.6rem] border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                  {controller.configError}
                </p>
              ) : null}

              {controller.configLoading ? (
                <div className="flex items-center gap-2 rounded-[0.6rem] bg-[#F8FAFD] px-3 py-2.5 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  {t('settings.page.loadingConfig')}
                </div>
              ) : controller.jsonMode ? (
                <>
                  {controller.jsonError ? (
                    <p className="whitespace-pre-line rounded-[0.6rem] border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                      {controller.jsonError}
                    </p>
                  ) : null}

                  <Textarea
                    value={controller.jsonDraft}
                    className="min-h-0 flex-1 font-mono text-[12px] leading-5"
                    onChange={(event) => {
                      controller.setJsonDraft(event.target.value)
                    }}
                  />
                </>
              ) : (
                <OpenClawInstanceGlobalDynamicFormPanel
                  controller={controller}
                  activeCategoryId={controller.activeCategoryId}
                />
              )}
            </div>
          </section>
        </AppShellSplitWorkspace>
      )}
    </AppShellContentArea>
  )
}

export default SettingsCenterPage
